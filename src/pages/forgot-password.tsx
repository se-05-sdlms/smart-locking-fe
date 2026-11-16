import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  TextField,
} from '@heroui/react';

import boxoraLogo from '@/assets/boxora-logo.svg';
import {
  validateConfirmPassword,
  validateNewPassword,
} from '@/auth/password-change';
import {
  normalizeResetEmail,
  validateResetEmail,
  validateResetOtp,
} from '@/auth/password-reset';
import {
  getPasswordResetErrorMessage,
  requestPasswordReset,
  resetPassword,
} from '@/services/auth-service';

type Stage = 'email' | 'reset' | 'success';

export default function ForgotPasswordPage() {
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const operationPending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [stage]);

  const run = async (operation: () => Promise<void>) => {
    if (operationPending.current) return;
    operationPending.current = true;
    setPending(true);
    setError('');
    setNotice('');
    try {
      await operation();
    } catch (requestError) {
      setError(getPasswordResetErrorMessage(requestError));
    } finally {
      operationPending.current = false;
      setPending(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await requestPasswordReset(email);
      setEmail(normalizeResetEmail(email));
      setOtp('');
      setStage('reset');
      setNotice(
        'Nếu email thuộc tài khoản quản trị viên hoặc nhân viên vận hành, mã OTP sẽ được gửi đến email đó. Vui lòng kiểm tra cả thư rác và dùng mã mới nhất.',
      );
    });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (stage === 'email') {
      if (validateResetEmail(email)) return;
      void sendCode();
    } else if (stage === 'reset') {
      if (
        validateResetOtp(otp) ||
        validateNewPassword(password, '') ||
        validateConfirmPassword(confirmation, password)
      )
        return;
      void run(async () => {
        await resetPassword(email, otp, password);
        setOtp('');
        setPassword('');
        setConfirmation('');
        setStage('success');
      });
    }
  };

  const changeEmail = () => {
    setOtp('');
    setPassword('');
    setConfirmation('');
    setError('');
    setNotice('');
    setStage('email');
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-orange-50 px-4 py-10 text-neutral-900">
      <section className="w-full max-w-md rounded-3xl border border-orange-100 bg-white p-6 shadow-lg sm:p-8">
        <div className="mb-6 flex items-center justify-center gap-3">
          <img alt="Boxora" className="h-11 w-11" src={boxoraLogo} />
          <p className="text-xl font-semibold tracking-[.16em] text-orange-600">
            BOXORA
          </p>
        </div>
        <h1
          ref={heading}
          className="text-2xl font-semibold tracking-tight outline-none"
          tabIndex={-1}
        >
          {stage === 'success' ? 'Đã đặt lại mật khẩu' : 'Quên mật khẩu'}
        </h1>
        {stage === 'success' ? (
          <p className="mt-4 leading-7" role="status">
            Mật khẩu đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới.
          </p>
        ) : (
          <Form className="mt-4" onSubmit={submit}>
            {stage === 'email' ? (
              <>
                <p className="mb-5 text-sm leading-6 text-neutral-600">
                  Nhập email tài khoản quản trị viên hoặc nhân viên vận hành để
                  nhận mã OTP đặt lại mật khẩu.
                </p>
                <TextField
                  isRequired
                  isDisabled={pending}
                  name="email"
                  type="email"
                  validate={validateResetEmail}
                  value={email}
                  onChange={setEmail}
                >
                  <Label>Email tài khoản</Label>
                  <Input autoComplete="email" placeholder="Email đã đăng ký" />
                  <FieldError />
                </TextField>
              </>
            ) : (
              <>
                <p className="mb-4 break-words text-sm leading-6 text-neutral-600">
                  Email nhận mã: {email}
                </p>
                <TextField
                  isRequired
                  isDisabled={pending}
                  name="otpCode"
                  validate={validateResetOtp}
                  value={otp}
                  onChange={setOtp}
                >
                  <Label>Mã OTP</Label>
                  <Input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6 chữ số trong email"
                  />
                  <FieldError />
                </TextField>
                <TextField
                  isRequired
                  className="mt-4"
                  isDisabled={pending}
                  name="newPassword"
                  type="password"
                  validate={(value) => validateNewPassword(value, '')}
                  value={password}
                  onChange={setPassword}
                >
                  <Label>Mật khẩu mới</Label>
                  <Input
                    autoComplete="new-password"
                    placeholder="Ít nhất 8 ký tự"
                  />
                  <FieldError />
                </TextField>
                <TextField
                  isRequired
                  className="mt-4"
                  isDisabled={pending}
                  name="confirmPassword"
                  type="password"
                  validate={(value) => validateConfirmPassword(value, password)}
                  value={confirmation}
                  onChange={setConfirmation}
                >
                  <Label>Xác nhận mật khẩu mới</Label>
                  <Input autoComplete="new-password" />
                  <FieldError />
                </TextField>
              </>
            )}
            {notice && (
              <p
                className="mt-4 text-sm leading-6 text-neutral-600"
                role="status"
              >
                {notice}
              </p>
            )}
            {error && (
              <p className="mt-4 text-sm leading-6 text-red-600" role="alert">
                {error}
              </p>
            )}
            <Button
              className="mt-6 w-full"
              isDisabled={pending}
              type="submit"
              variant="primary"
            >
              {pending
                ? 'Đang xử lý...'
                : stage === 'email'
                  ? 'Gửi mã OTP qua email'
                  : 'Đặt lại mật khẩu'}
            </Button>
            {stage === 'reset' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  isDisabled={pending}
                  type="button"
                  variant="secondary"
                  onPress={() => void sendCode()}
                >
                  Gửi lại mã
                </Button>
                <Button
                  isDisabled={pending}
                  type="button"
                  variant="tertiary"
                  onPress={changeEmail}
                >
                  Đổi email
                </Button>
              </div>
            )}
          </Form>
        )}
        <Link
          replace
          className="mt-6 inline-flex min-h-11 items-center rounded text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600"
          to="/login"
        >
          Về trang đăng nhập
        </Link>
      </section>
    </main>
  );
}
