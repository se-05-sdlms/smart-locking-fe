import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  TextField,
} from '@heroui/react';

import ShapeGrid from '@/components/react-bits/shape-grid';
import boxoraLogo from '@/assets/boxora-logo.svg';
import { useAuth } from '@/auth/auth-context';
import { getAppRole } from '@/types/auth';
import { getLoginErrorMessage } from '@/services/auth-service';

type LoginLocationState = {
  from?: string;
};

function getDestination(role: 'admin' | 'operator', requestedPath?: string) {
  const roleRoot = `/${role}`;

  return requestedPath === roleRoot || requestedPath?.startsWith(`${roleRoot}/`)
    ? requestedPath
    : roleRoot;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, login, session } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionPending = useRef(false);
  const requestedPath = (location.state as LoginLocationState | null)?.from;

  useEffect(() => {
    if (isLoading || isSubmitting || error || !session) return;

    if (session.user.status !== 'Active') return;

    const appRole = getAppRole(session.user.role);

    if (appRole) {
      navigate(getDestination(appRole, requestedPath), { replace: true });
    }
  }, [error, isLoading, isSubmitting, navigate, requestedPath, session]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submissionPending.current || isLoading) return;

    submissionPending.current = true;
    setError('');
    setIsSubmitting(true);

    try {
      await login(username.trim(), password);
    } catch (submitError) {
      setError(getLoginErrorMessage(submitError));
    } finally {
      submissionPending.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-neutral-900">
      <div className="absolute inset-0">
        <ShapeGrid
          borderColor="#F97316"
          direction="diagonal"
          hoverFillColor="#F97316"
          hoverTrailAmount={4}
          shape="square"
          speed={0.5}
          squareSize={50}
        />
      </div>
      <div className="pointer-events-none relative z-10 grid min-h-screen lg:grid-cols-2">
        <section className="hidden items-center p-12 lg:flex">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[.3em] text-orange-600">
              BOXORA / Tủ khóa thông minh
            </p>
            <h1 className="max-w-lg text-6xl font-semibold leading-[.95] tracking-[-.06em]">
              Quản lý mạng lưới tủ khóa.
            </h1>
            <p className="mt-6 max-w-sm text-base leading-7 text-neutral-600">
              Trung tâm điều khiển an toàn cho mọi tủ khóa thông minh của bạn.
            </p>
          </div>
        </section>
        <section className="flex items-center justify-center px-6 py-12 lg:px-16">
          <Form
            className="pointer-events-auto w-full max-w-sm rounded-3xl border border-orange-100 bg-white/90 p-8 shadow-[0_24px_80px_rgba(154,52,18,.12)] backdrop-blur"
            onSubmit={submit}
          >
            <div className="mb-8 text-center">
              <div className="flex items-center justify-center gap-3">
                <img alt="Boxora" className="h-11 w-11" src={boxoraLogo} />
                <p className="text-xl font-semibold tracking-[.16em] text-orange-600">
                  BOXORA
                </p>
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight">
                Đăng nhập
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                Nhập thông tin tài khoản để tiếp tục.
              </p>
            </div>
            <TextField
              isRequired
              isDisabled={isSubmitting}
              name="username"
              type="text"
              validate={(value) =>
                value ? undefined : 'Vui lòng nhập tên đăng nhập.'
              }
              value={username}
              onChange={setUsername}
            >
              <Label>Tên đăng nhập</Label>
              <Input placeholder="Nhập tên đăng nhập" />
              <FieldError />
            </TextField>
            <TextField
              isRequired
              className="mt-5"
              isDisabled={isSubmitting}
              name="password"
              type="password"
              validate={(value) =>
                value ? undefined : 'Vui lòng nhập mật khẩu.'
              }
              value={password}
              onChange={setPassword}
            >
              <Label>Mật khẩu</Label>
              <Input placeholder="Nhập mật khẩu" />
              <FieldError />
            </TextField>
            <p className="mt-3 text-right text-sm text-neutral-900 underline underline-offset-4">
              Quên mật khẩu?
            </p>
            {error && (
              <p className="mt-4 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <Button
              className="mt-7 w-full"
              isDisabled={isSubmitting}
              type="submit"
              variant="primary"
            >
              {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </Form>
        </section>
      </div>
    </main>
  );
}
