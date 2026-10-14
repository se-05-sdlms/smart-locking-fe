import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Form } from '@heroui/react';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import Key from '@gravity-ui/icons/Key';

import boxoraLogo from '@/assets/boxora-logo.svg';
import { useAuth } from '@/auth/auth-context';
import { PasswordField } from '@/components/auth/password-field';
import { getChangePasswordErrorMessage } from '@/services/auth-service';
import {
  validateConfirmPassword,
  validateCurrentPassword,
  validateNewPassword,
} from '@/auth/password-change';

export default function FirstLoginChangePasswordPage() {
  const navigate = useNavigate();
  const { changePassword, logout, isLoggingOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionPending = useRef(false);
  const isBusy = isSubmitting || isLoggingOut;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submissionPending.current) return;

    submissionPending.current = true;
    setError('');
    setIsSubmitting(true);

    try {
      await changePassword(currentPassword, newPassword);
      navigate('/operator', { replace: true });
    } catch (submitError) {
      setError(getChangePasswordErrorMessage(submitError));
    } finally {
      submissionPending.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8">
        <div className="mb-6 flex items-center gap-3">
          <img alt="Boxora" className="h-10 w-10" src={boxoraLogo} />
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Key aria-hidden />
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Đổi mật khẩu lần đầu
        </h1>
        <p className="mt-2 text-sm text-muted">
          Tài khoản của bạn đang dùng mật khẩu tạm do quản trị viên cấp. Vui
          lòng đặt mật khẩu mới trước khi tiếp tục sử dụng hệ thống.
        </p>

        <Form className="mt-6 flex flex-col gap-5" onSubmit={submit}>
          <PasswordField
            autoComplete="current-password"
            isDisabled={isBusy}
            label="Mật khẩu hiện tại"
            name="currentPassword"
            validate={validateCurrentPassword}
            value={currentPassword}
            onChange={setCurrentPassword}
          />
          <PasswordField
            autoComplete="new-password"
            isDisabled={isBusy}
            label="Mật khẩu mới"
            name="newPassword"
            validate={(value) => validateNewPassword(value, currentPassword)}
            value={newPassword}
            onChange={setNewPassword}
          />
          <PasswordField
            autoComplete="new-password"
            isDisabled={isBusy}
            label="Xác nhận mật khẩu mới"
            name="confirmPassword"
            validate={(value) => validateConfirmPassword(value, newPassword)}
            value={confirmPassword}
            onChange={setConfirmPassword}
          />

          {error && (
            <Alert status="danger">
              <Alert.Indicator>
                <CircleExclamation aria-hidden />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          <div className="flex flex-col gap-3">
            <Button
              fullWidth
              isDisabled={isBusy}
              type="submit"
              variant="primary"
            >
              {isSubmitting ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
            </Button>
            <Button
              fullWidth
              isDisabled={isBusy}
              variant="ghost"
              onPress={() => void logout()}
            >
              {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
            </Button>
          </div>
        </Form>
      </div>
    </main>
  );
}
