import type { AuthUser } from '@/types/auth';
import type { AssignedLocker } from '@/services/operator-account-service';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Chip,
  Form,
  Separator,
  Skeleton,
  toast,
} from '@heroui/react';
import ArrowRightFromSquare from '@gravity-ui/icons/ArrowRightFromSquare';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import Boxes3 from '@gravity-ui/icons/Boxes3';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import FloppyDisk from '@gravity-ui/icons/FloppyDisk';
import Key from '@gravity-ui/icons/Key';
import Person from '@gravity-ui/icons/Person';

import { useAuth } from '@/auth/auth-context';
import {
  ACCOUNT_ROLE_LABELS,
  ACCOUNT_STATUS_DISPLAY,
  formatAccountDateTime,
  formatOptionalText,
} from '@/auth/account-display';
import {
  validateConfirmPassword,
  validateCurrentPassword,
  validateNewPassword,
} from '@/auth/password-change';
import { PasswordField } from '@/components/auth/password-field';
import { getChangePasswordErrorMessage } from '@/services/auth-service';
import {
  getAccountLoadErrorMessage,
  getAssignedLockers,
} from '@/services/operator-account-service';

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

const fieldRowClassName =
  'grid gap-2 md:grid-cols-[13rem_minmax(0,1fr)] md:items-start';

function ErrorAlert({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert role="alert" status="danger">
      <Alert.Indicator>
        <CircleExclamation aria-hidden="true" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
      {onRetry ? (
        <Button size="sm" variant="secondary" onPress={onRetry}>
          <ArrowRotateRight aria-hidden="true" className="size-4" />
          Thử lại
        </Button>
      ) : null}
    </Alert>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium">{children}</dd>
    </div>
  );
}

function ProfileCard({ user }: { user: AuthUser }) {
  return (
    <Card>
      <Card.Header className="flex-row items-center gap-3">
        <Person aria-hidden="true" className="size-6 text-accent" />
        <Card.Title>Thông tin tài khoản</Card.Title>
      </Card.Header>
      <Card.Content>
        <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-8">
          <dl className="space-y-1">
            <DetailRow label="Email đăng nhập">
              {formatOptionalText(user.email)}
            </DetailRow>
            <DetailRow label="Số điện thoại">
              {formatOptionalText(user.phoneNumber)}
            </DetailRow>
            <DetailRow label="Lần đăng nhập gần nhất">
              {formatAccountDateTime(user.lastLoginAt)}
            </DetailRow>
          </dl>
          <Separator className="hidden lg:block" orientation="vertical" />
          <dl className="space-y-1">
            <DetailRow label="Vai trò">
              {ACCOUNT_ROLE_LABELS[user.role]}
            </DetailRow>
            <DetailRow label="Trạng thái tài khoản">
              <Chip
                color={ACCOUNT_STATUS_DISPLAY[user.status].color}
                size="sm"
                variant="soft"
              >
                {ACCOUNT_STATUS_DISPLAY[user.status].label}
              </Chip>
            </DetailRow>
          </dl>
        </div>
        <p className="mt-4 text-sm text-muted">
          Vai trò và thông tin tài khoản do Quản trị viên quản lý. Liên hệ Quản
          trị viên nếu cần thay đổi.
        </p>
      </Card.Content>
    </Card>
  );
}

function AssignedLockersCard({
  state,
  onRetry,
}: {
  state: LoadState<AssignedLocker[]>;
  onRetry: () => void;
}) {
  return (
    <Card>
      <Card.Header className="flex-row items-center gap-3">
        <Boxes3 aria-hidden="true" className="size-6 text-accent" />
        <Card.Title>Phạm vi phụ trách</Card.Title>
      </Card.Header>
      <Card.Content className="gap-4">
        {state.status === 'loading' ? (
          <div
            aria-busy="true"
            aria-label="Đang tải danh sách tủ được phân công"
            className="flex flex-wrap gap-2"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-7 w-24 rounded-full" />
            ))}
          </div>
        ) : null}
        {state.status === 'error' ? (
          <ErrorAlert message={state.message} onRetry={onRetry} />
        ) : null}
        {state.status === 'success' && state.data.length === 0 ? (
          <p className="text-sm text-muted">
            Bạn chưa được phân công tủ nào. Liên hệ Quản trị viên để được phân
            công.
          </p>
        ) : null}
        {state.status === 'success' && state.data.length > 0 ? (
          <ul
            aria-label="Danh sách tủ được phân công"
            className="flex flex-col divide-y divide-border"
          >
            {state.data.map((locker) => (
              <li
                key={locker.id}
                className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:gap-4"
              >
                <Chip className="w-fit" size="sm" variant="soft">
                  {locker.code}
                </Chip>
                <span className="min-w-0 break-words text-sm text-muted">
                  {formatOptionalText(locker.address)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-sm text-muted">
          Phân công tủ do Quản trị viên thực hiện và không thể thay đổi tại đây.
        </p>
      </Card.Content>
    </Card>
  );
}

function ChangePasswordCard() {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const submissionPending = useRef(false);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    // Remount the form so validation messages and visibility toggles reset.
    setFormKey((key) => key + 1);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submissionPending.current) return;

    submissionPending.current = true;
    setError('');
    setIsSubmitting(true);

    try {
      await changePassword(currentPassword, newPassword);
      resetForm();
      toast.success('Đã đổi mật khẩu', {
        description:
          'Mật khẩu mới có hiệu lực ngay. Các phiên đăng nhập khác đã bị đăng xuất.',
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
    } catch (submitError) {
      setError(getChangePasswordErrorMessage(submitError));
    } finally {
      submissionPending.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <Card.Header className="flex-row items-center gap-3">
        <Key aria-hidden="true" className="size-6 text-accent" />
        <Card.Title>Đổi mật khẩu</Card.Title>
      </Card.Header>
      <Card.Content>
        <Form key={formKey} className="space-y-5" onSubmit={submit}>
          <PasswordField
            autoComplete="current-password"
            className={fieldRowClassName}
            isDisabled={isSubmitting}
            label="Mật khẩu hiện tại"
            name="currentPassword"
            placeholder="Nhập mật khẩu hiện tại"
            validate={validateCurrentPassword}
            value={currentPassword}
            onChange={setCurrentPassword}
          />
          <PasswordField
            autoComplete="new-password"
            className={fieldRowClassName}
            isDisabled={isSubmitting}
            label="Mật khẩu mới"
            name="newPassword"
            placeholder="Tối thiểu 8 ký tự"
            validate={(value) => validateNewPassword(value, currentPassword)}
            value={newPassword}
            onChange={setNewPassword}
          />
          <PasswordField
            autoComplete="new-password"
            className={fieldRowClassName}
            isDisabled={isSubmitting}
            label="Xác nhận mật khẩu mới"
            name="confirmPassword"
            placeholder="Nhập lại mật khẩu mới"
            validate={(value) => validateConfirmPassword(value, newPassword)}
            value={confirmPassword}
            onChange={setConfirmPassword}
          />

          {error ? <ErrorAlert message={error} /> : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              isDisabled={isSubmitting}
              type="button"
              variant="ghost"
              onPress={resetForm}
            >
              Hủy
            </Button>
            <Button isDisabled={isSubmitting} type="submit" variant="primary">
              <FloppyDisk aria-hidden="true" className="size-5" />
              {isSubmitting ? 'Đang đổi mật khẩu...' : 'Lưu mật khẩu mới'}
            </Button>
          </div>
        </Form>
      </Card.Content>
    </Card>
  );
}

function SessionCard() {
  const navigate = useNavigate();
  const { isLoggingOut, logout, session } = useAuth();

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <Card>
      <Card.Header className="flex-row items-center gap-3">
        <ArrowRightFromSquare
          aria-hidden="true"
          className="size-6 text-accent"
        />
        <Card.Title>Phiên đăng nhập</Card.Title>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <dl>
          <DetailRow label="Phiên hết hạn lúc">
            {formatAccountDateTime(session?.refreshTokenExpiresAt)}
          </DetailRow>
        </dl>
        <Button
          className="w-full sm:w-auto"
          isDisabled={isLoggingOut}
          variant="danger-soft"
          onPress={() => void signOut()}
        >
          <ArrowRightFromSquare aria-hidden="true" className="size-4" />
          {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
        </Button>
      </Card.Content>
    </Card>
  );
}

export default function OperatorSettingsPage() {
  // Profile comes from the auth context, which AuthProvider refreshes from
  // GET /api/auth/me on load. Calling /me again here would spend the
  // backend auth rate limit (5 requests/minute) needed for login and
  // password changes.
  const { user } = useAuth();
  const [lockers, setLockers] = useState<LoadState<AssignedLocker[]>>({
    status: 'loading',
  });
  const [lockersRequest, setLockersRequest] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setLockers({ status: 'loading' });
    getAssignedLockers(controller.signal)
      .then((data) => setLockers({ status: 'success', data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLockers({
          status: 'error',
          message: getAccountLoadErrorMessage(error),
        });
      });

    return () => controller.abort();
  }, [lockersRequest]);

  const retryLockers = useCallback(
    () => setLockersRequest((request) => request + 1),
    [],
  );

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      {user ? <ProfileCard user={user} /> : null}
      <AssignedLockersCard state={lockers} onRetry={retryLockers} />
      <ChangePasswordCard />
      <SessionCard />
    </section>
  );
}
