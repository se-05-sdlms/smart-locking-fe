import { Link } from 'react-router-dom';

import { useAuth } from '@/auth/auth-context';
import { FIRST_LOGIN_CHANGE_PASSWORD_PATH } from '@/auth/password-change';
import { getAppRole } from '@/types/auth';

export default function NotFoundPage() {
  const { isLoading, session } = useAuth();
  const role = session ? getAppRole(session.user.role) : null;
  const destination = !session
    ? '/login'
    : session.user.status !== 'Active' || !role
      ? '/forbidden'
      : role === 'operator' && session.user.mustChangePassword
        ? FIRST_LOGIN_CHANGE_PASSWORD_PATH
        : `/${role}`;
  const label = !session
    ? 'Về trang đăng nhập'
    : destination === '/forbidden'
      ? 'Xem quyền truy cập'
      : destination === FIRST_LOGIN_CHANGE_PASSWORD_PATH
        ? 'Đổi mật khẩu để tiếp tục'
        : 'Về trang tổng quan';

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-default p-6 text-center sm:p-8">
        <p className="text-sm font-semibold text-accent">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Không tìm thấy trang</h1>
        <p className="mt-3 text-sm text-muted">
          Đường dẫn không tồn tại hoặc trang đã được di chuyển. Bạn có thể quay
          về để tiếp tục sử dụng Boxora.
        </p>
        {isLoading ? (
          <p
            aria-live="polite"
            className="mt-6 text-sm text-muted"
            role="status"
          >
            Đang kiểm tra phiên đăng nhập...
          </p>
        ) : (
          <Link
            replace
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 py-3 font-semibold text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            to={destination}
          >
            {label}
          </Link>
        )}
      </section>
    </main>
  );
}
