import { Button } from '@heroui/react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';
import { getAppRole } from '@/types/auth';

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const { isLoggingOut, logout, session } = useAuth();
  const appRole = session ? getAppRole(session.user.role) : null;

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-default p-8 text-center">
        <p className="text-sm font-semibold text-accent">403</p>
        <h1 className="mt-2 text-2xl font-semibold">Không có quyền truy cập</h1>
        <p className="mt-3 text-sm text-muted">
          Tài khoản của bạn không có quyền sử dụng trang này.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {appRole ? (
            <Button
              variant="primary"
              onPress={() => navigate(`/${appRole}`, { replace: true })}
            >
              Về trang tổng quan
            </Button>
          ) : null}
          <Button
            isDisabled={isLoggingOut}
            variant="ghost"
            onPress={() => void handleLogout()}
          >
            {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </Button>
        </div>
      </section>
    </main>
  );
}
