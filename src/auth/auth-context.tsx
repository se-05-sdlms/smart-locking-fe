import type { AuthSession, AuthUser } from '@/types/auth';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';

import {
  AUTH_FORBIDDEN_EVENT,
  AUTH_SESSION_CHANGED_EVENT,
  clearAuthSession,
  isExpired,
  readAuthSession,
  saveAuthSession,
} from '@/auth/auth-storage';
import { getAppRole } from '@/types/auth';
import {
  getCurrentUser,
  login as requestLogin,
  logout as requestLogout,
} from '@/services/auth-service';
import { ApiError } from '@/services/api-client';

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingOut: boolean;
  login: (loginIdentifier: string, password: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutPromise = useRef<Promise<void> | null>(null);
  const restoreRequest = useRef<Promise<AuthUser> | null>(null);
  const authRevision = useRef(0);

  useEffect(() => {
    const handleSessionChanged = (event: Event) => {
      const sessionEvent = event as CustomEvent<AuthSession | null>;

      setSession(sessionEvent.detail);
    };
    const handleForbidden = () => navigate('/forbidden');

    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleSessionChanged);
    window.addEventListener(AUTH_FORBIDDEN_EVENT, handleForbidden);

    return () => {
      window.removeEventListener(
        AUTH_SESSION_CHANGED_EVENT,
        handleSessionChanged,
      );
      window.removeEventListener(AUTH_FORBIDDEN_EVENT, handleForbidden);
    };
  }, [navigate]);

  useEffect(() => {
    const storedSession = readAuthSession();

    if (!storedSession) {
      setIsLoading(false);

      return;
    }

    let isActive = true;
    const revision = authRevision.current;

    // Reuse the request across StrictMode's setup/cleanup/setup cycle.
    // Route navigation must never restart session restoration.
    restoreRequest.current ??= getCurrentUser();
    restoreRequest.current
      .then((user) => {
        if (!isActive || revision !== authRevision.current) return;

        const currentSession = readAuthSession();

        if (!currentSession || currentSession.user.id !== user.id) return;

        saveAuthSession({ ...currentSession, user });
      })
      .catch((error: unknown) => {
        if (!isActive || revision !== authRevision.current) return;

        const currentSession = readAuthSession();
        const isTemporaryFailure =
          error instanceof ApiError &&
          (error.status === 0 ||
            error.status === 408 ||
            error.status === 429 ||
            error.status >= 500);

        // Connectivity failures do not invalidate a still-valid access token.
        // Expired/unverified sessions stay stored but cannot bypass Login.
        setSession(
          isTemporaryFailure &&
            currentSession &&
            !isExpired(currentSession.accessTokenExpiresAt)
            ? currentSession
            : null,
        );
      })
      .finally(() => {
        if (isActive && revision === authRevision.current) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const login = useCallback(
    async (loginIdentifier: string, password: string) => {
      // Ignore any bootstrap response arriving after an explicit login attempt.
      authRevision.current++;
      setIsLoading(false);
      const response = await requestLogin({ loginIdentifier, password });
      const appRole = getAppRole(response.user.role);

      if (!appRole) {
        try {
          await requestLogout({ refreshToken: response.refreshToken });
        } catch {
          // The unsupported session is intentionally not stored locally.
        }

        throw new Error(
          'Vai trò tài khoản chưa được hỗ trợ trên hệ thống này.',
        );
      }

      if (response.user.status !== 'Active') {
        throw new Error('Tài khoản hiện không ở trạng thái hoạt động.');
      }

      saveAuthSession(response);

      return response;
    },
    [],
  );

  const logout = useCallback(() => {
    if (logoutPromise.current) return logoutPromise.current;

    const operation = (async () => {
      authRevision.current++;
      setIsLoading(false);
      setIsLoggingOut(true);
      const currentSession = readAuthSession();

      try {
        if (currentSession) {
          await requestLogout({ refreshToken: currentSession.refreshToken });
        }
      } catch {
        // Local sign-out still completes if the server is temporarily unavailable.
      } finally {
        clearAuthSession();
        setIsLoggingOut(false);
      }
    })();

    logoutPromise.current = operation;
    const releaseLogout = () => {
      if (logoutPromise.current === operation) logoutPromise.current = null;
    };

    void operation.then(releaseLogout, releaseLogout);

    return operation;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: session !== null,
      isLoading,
      isLoggingOut,
      login,
      logout,
    }),
    [isLoading, isLoggingOut, login, logout, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}
