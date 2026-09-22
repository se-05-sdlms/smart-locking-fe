import type { AppRole } from '@/config/navigation';
import type { PropsWithChildren } from 'react';

import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';
import { getAppRole } from '@/types/auth';

export function RequireRole({
  children,
  role,
}: PropsWithChildren<{ role: AppRole }>) {
  const location = useLocation();
  const { isLoading, session } = useAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted">Đang kiểm tra phiên đăng nhập...</p>
      </main>
    );
  }

  if (!session) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  if (
    session.user.status !== 'Active' ||
    getAppRole(session.user.role) !== role
  ) {
    return <Navigate replace to="/forbidden" />;
  }

  return children;
}
