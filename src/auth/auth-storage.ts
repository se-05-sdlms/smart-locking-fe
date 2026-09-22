import type {
  AuthSession,
  AuthUser,
  BackendUserRole,
  BackendUserStatus,
} from '@/types/auth';

const AUTH_SESSION_KEY = 'boxora.auth.session.v1';

export const AUTH_SESSION_CHANGED_EVENT = 'boxora:auth-session-changed';
export const AUTH_FORBIDDEN_EVENT = 'boxora:auth-forbidden';

const backendRoles: BackendUserRole[] = [
  'Administrator',
  'Resident',
  'LockerOperator',
];
const backendStatuses: BackendUserStatus[] = ['Active', 'Disabled', 'Locked'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    isNullableString(value.phoneNumber) &&
    isNullableString(value.email) &&
    backendRoles.includes(value.role as BackendUserRole) &&
    backendStatuses.includes(value.status as BackendUserStatus) &&
    typeof value.mustChangePassword === 'boolean' &&
    isNullableString(value.lastLoginAt)
  );
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value)) return false;

  return (
    typeof value.accessToken === 'string' &&
    value.accessToken.length > 0 &&
    typeof value.refreshToken === 'string' &&
    value.refreshToken.length > 0 &&
    typeof value.accessTokenExpiresAt === 'string' &&
    !Number.isNaN(Date.parse(value.accessTokenExpiresAt)) &&
    typeof value.refreshTokenExpiresAt === 'string' &&
    !Number.isNaN(Date.parse(value.refreshTokenExpiresAt)) &&
    isAuthUser(value.user)
  );
}

function emitSessionChanged(session: AuthSession | null) {
  window.dispatchEvent(
    new CustomEvent<AuthSession | null>(AUTH_SESSION_CHANGED_EVENT, {
      detail: session,
    }),
  );
}

export function readAuthSession(): AuthSession | null {
  const storedSession = window.sessionStorage.getItem(AUTH_SESSION_KEY);

  if (!storedSession) return null;

  try {
    const parsedSession: unknown = JSON.parse(storedSession);

    if (isAuthSession(parsedSession)) return parsedSession;
  } catch {
    // Invalid session data is cleared below.
  }

  window.sessionStorage.removeItem(AUTH_SESSION_KEY);

  return null;
}

export function saveAuthSession(session: AuthSession) {
  window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  emitSessionChanged(session);
}

export function clearAuthSession() {
  window.sessionStorage.removeItem(AUTH_SESSION_KEY);
  emitSessionChanged(null);
}

export function isExpired(expiresAt: string, leewayMs = 0) {
  return Date.parse(expiresAt) <= Date.now() + leewayMs;
}

export function emitForbidden() {
  window.dispatchEvent(new Event(AUTH_FORBIDDEN_EVENT));
}
