import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  TextField,
} from '@heroui/react';

import ShapeGrid from '@/components/react-bits/shape-grid';
import { authenticate } from '@/mocks/auth';
import boxoraLogo from '@/assets/boxora-logo.svg';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const account = authenticate(username, password);

    if (account) navigate(`/${account.role}`);
    else setError('Tên đăng nhập hoặc mật khẩu không đúng.');
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
            <Button className="mt-7 w-full" type="submit" variant="primary">
              Đăng nhập
            </Button>
          </Form>
        </section>
      </div>
    </main>
  );
}
