import type { AppRole } from '@/config/navigation';
import type { PropsWithChildren } from 'react';

import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';
import {
  FIRST_LOGIN_CHANGE_PASSWORD_PATH,
  resolvePasswordChangeAccess,
  resolveRoleAccess,
} from '@/auth/password-change';

function SessionCheckingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted">Đang kiểm tra phiên đăng nhập...</p>
    </main>
  );
}

export function RequireRole({
  children,
  role,
}: PropsWithChildren<{ role: AppRole }>) {
  const location = useLocation();
  const { isLoading, session } = useAuth();

  if (isLoading) return <SessionCheckingScreen />;

  switch (resolveRoleAccess(session, role)) {
    case 'login':
      return (
        <Navigate replace state={{ from: location.pathname }} to="/login" />
      );
    case 'forbidden':
      return <Navigate replace to="/forbidden" />;
    case 'change-password':
      return <Navigate replace to={FIRST_LOGIN_CHANGE_PASSWORD_PATH} />;
    default:
      return children;
  }
}

export function RequirePasswordChange({ children }: PropsWithChildren) {
  const location = useLocation();
  const { isLoading, session } = useAuth();

  if (isLoading) return <SessionCheckingScreen />;

  switch (resolvePasswordChangeAccess(session)) {
    case 'login':
      return (
        <Navigate replace state={{ from: location.pathname }} to="/login" />
      );
    case 'forbidden':
      return <Navigate replace to="/forbidden" />;
    case 'operator':
      return <Navigate replace to="/operator" />;
    default:
      return children;
  }
}
