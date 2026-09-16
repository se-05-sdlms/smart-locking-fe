import type { CSSProperties, FormEvent } from 'react';
import type {
  LockReasonCode,
  ManagedUserView,
  UnlockReasonCode,
  UserManagementService,
} from '@/types/user-management';

import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  FieldError,
  Label,
  ListBox,
  Modal,
  Spinner,
  TextArea,
} from '@heroui/react';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import Lock from '@gravity-ui/icons/Lock';
import LockOpen from '@gravity-ui/icons/LockOpen';
import TriangleExclamation from '@gravity-ui/icons/TriangleExclamation';

import {
  OPERATOR_LOCK_REASONS,
  RESIDENT_LOCK_REASONS,
  UNLOCK_REASONS,
  USER_ROLE_LABELS,
} from '@/constants/user-management';

type AccountStatusMode = 'LOCK' | 'UNLOCK';

type AccountStatusModalProps = {
  isOpen: boolean;
  mode: AccountStatusMode;
  service: UserManagementService;
  user: ManagedUserView | null;
  onClose: () => void;
  onSuccess: (mode: AccountStatusMode) => void;
};

type FormErrors = {
  reason?: string;
  reasonDetail?: string;
  form?: string;
};

const primaryButtonStyle = {
  '--button-bg': 'var(--um-primary)',
  '--button-bg-hover': '#005bb5',
  '--button-bg-pressed': '#005bb5',
  '--button-fg': 'var(--um-on-primary)',
} as CSSProperties;

function getReasonOptions(user: ManagedUserView, mode: AccountStatusMode) {
  if (mode === 'UNLOCK') return UNLOCK_REASONS;

  return user.role === 'LOCKER_OPERATOR'
    ? OPERATOR_LOCK_REASONS
    : RESIDENT_LOCK_REASONS;
}

export function AccountStatusModal({
  isOpen,
  mode,
  service,
  user,
  onClose,
  onSuccess,
}: AccountStatusModalProps) {
  const [reasonCode, setReasonCode] = useState<string>('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setReasonCode('');
    setReasonDetail('');
    setErrors({});
    setIsSubmitting(false);
  }, [isOpen, mode, user?.id]);

  const closeModal = () => {
    if (isSubmitting) return;

    onClose();
  };

  if (!user) return null;

  const isLocking = mode === 'LOCK';
  const title = isLocking ? 'Khóa tài khoản' : 'Mở khóa tài khoản';
  const reasonOptions = getReasonOptions(user, mode);
  const selectedReasonKeys = reasonCode
    ? new Set<string>([reasonCode])
    : new Set<string>();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const nextErrors: FormErrors = {};
    const trimmedDetail = reasonDetail.trim();

    if (!reasonCode) nextErrors.reason = 'Vui lòng chọn lý do.';
    if (reasonCode === 'OTHER' && !trimmedDetail) {
      nextErrors.reasonDetail = 'Vui lòng nhập chi tiết cho lý do khác.';
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);

      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const mutation = isLocking
      ? service.lockAccount({
          userId: user.id,
          reasonCode: reasonCode as LockReasonCode,
          ...(reasonCode === 'OTHER' ? { reasonDetail: trimmedDetail } : {}),
        })
      : service.unlockAccount({
          userId: user.id,
          reasonCode: reasonCode as UnlockReasonCode,
          ...(reasonCode === 'OTHER' ? { reasonDetail: trimmedDetail } : {}),
        });

    void mutation
      .then((result) => {
        if (!result.success) {
          setErrors({ form: result.error.message });

          return;
        }

        onSuccess(mode);
      })
      .catch(() => {
        setErrors({
          form: isLocking
            ? 'Không thể khóa tài khoản. Vui lòng thử lại.'
            : 'Không thể mở khóa tài khoản. Vui lòng thử lại.',
        });
      })
      .finally(() => setIsSubmitting(false));
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeModal();
      }}
    >
      <Modal.Backdrop isDismissable={!isSubmitting}>
        <Modal.Container className="p-4" scroll="inside" size="sm">
          <Modal.Dialog className="max-h-[calc(100dvh-32px)] p-0 shadow-none">
            <Modal.Header className="shrink-0 border-b border-[var(--um-border)] bg-[var(--um-surface)] px-5 py-4">
              <div className="flex items-center gap-3">
                <span
                  className={`flex size-10 items-center justify-center rounded-full ${
                    isLocking
                      ? 'bg-red-50 text-red-700'
                      : 'bg-[var(--um-primary-soft)] text-[var(--um-primary)]'
                  }`}
                >
                  {isLocking ? (
                    <Lock aria-hidden="true" className="size-5" />
                  ) : (
                    <LockOpen aria-hidden="true" className="size-5" />
                  )}
                </span>
                <Modal.Heading>{title}</Modal.Heading>
              </div>
              <Modal.CloseTrigger
                aria-label="Đóng hộp thoại"
                isDisabled={isSubmitting}
              />
            </Modal.Header>
            <form
              noValidate
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={handleSubmit}
            >
              <Modal.Body className="m-0 flex-1 overflow-y-auto px-5 py-5">
                <div className="space-y-5">
                  <div className="rounded-lg border border-[var(--um-border)] bg-[var(--um-page)] px-4 py-3">
                    <p className="font-semibold text-[var(--um-ink)]">
                      {user.fullName}
                    </p>
                    <p className="mt-1 text-sm text-neutral-600">
                      {USER_ROLE_LABELS[user.role]}
                    </p>
                    <p className="mt-2 break-words text-sm text-neutral-700">
                      {user.email || user.phoneNumber}
                    </p>
                  </div>

                  {isLocking ? (
                    <Alert
                      className="border border-red-200 shadow-none"
                      status="danger"
                    >
                      <Alert.Indicator>
                        <CircleExclamation
                          aria-hidden="true"
                          className="size-5"
                        />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Description>
                          Người dùng sẽ không thể truy cập hệ thống sau khi bị
                          khóa.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : null}

                  <div>
                    <p className="text-sm font-medium text-[var(--um-ink)]">
                      Lý do
                    </p>
                    <ListBox
                      aria-label={`Lý do ${isLocking ? 'khóa' : 'mở khóa'} tài khoản`}
                      className="mt-2 w-full rounded-lg border border-[var(--um-border)] bg-[var(--um-surface)] p-1 shadow-none"
                      disabledKeys={
                        isSubmitting
                          ? new Set<string>(
                              reasonOptions.map((option) => option.code),
                            )
                          : undefined
                      }
                      selectedKeys={selectedReasonKeys}
                      selectionMode="single"
                      onSelectionChange={(keys) => {
                        const [selectedKey] =
                          keys === 'all' ? [] : Array.from(keys);
                        const nextReasonCode =
                          typeof selectedKey === 'string' ? selectedKey : '';

                        setReasonCode(nextReasonCode);
                        if (nextReasonCode !== 'OTHER') setReasonDetail('');
                        setErrors((current) => ({
                          ...current,
                          reason: undefined,
                          reasonDetail: undefined,
                          form: undefined,
                        }));
                      }}
                    >
                      {reasonOptions.map((option) => (
                        <ListBox.Item
                          key={option.code}
                          className={`min-h-11 w-full rounded-md px-3 py-2 text-left text-sm text-[var(--um-ink)] data-[selected=true]:bg-[var(--um-primary-soft)] ${isLocking ? 'data-[selected=true]:bg-red-50' : ''}`}
                          id={option.code}
                        >
                          <span className="text-wrap">{option.label}</span>
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                    {errors.reason ? (
                      <FieldError>{errors.reason}</FieldError>
                    ) : null}
                  </div>

                  {reasonCode === 'OTHER' ? (
                    <div>
                      <Label htmlFor="account-status-reason-detail">
                        Chi tiết lý do
                      </Label>
                      <TextArea
                        aria-label="Chi tiết lý do khác"
                        className="mt-2 min-h-24 w-full rounded-lg border border-[var(--um-border)] bg-[var(--um-surface)] px-3 py-2 shadow-none outline-none focus:border-[var(--um-focus)] focus:ring-2 focus:ring-[var(--um-focus)]"
                        disabled={isSubmitting}
                        id="account-status-reason-detail"
                        value={reasonDetail}
                        onChange={(event) => {
                          setReasonDetail(event.target.value);
                          setErrors((current) => ({
                            ...current,
                            reasonDetail: undefined,
                            form: undefined,
                          }));
                        }}
                      />
                      {errors.reasonDetail ? (
                        <FieldError>{errors.reasonDetail}</FieldError>
                      ) : null}
                    </div>
                  ) : null}

                  {errors.form ? (
                    <Alert
                      className="border border-red-200 shadow-none"
                      status="danger"
                    >
                      <Alert.Indicator>
                        <TriangleExclamation
                          aria-hidden="true"
                          className="size-5"
                        />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Description>{errors.form}</Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : null}
                </div>
              </Modal.Body>
              <Modal.Footer className="shrink-0 border-t border-[var(--um-border)] bg-[var(--um-surface)] px-5 py-3">
                <Button
                  className="min-h-11 rounded-full border-[var(--um-border)] bg-[var(--um-surface)] px-5 text-[var(--um-ink)] shadow-none"
                  isDisabled={isSubmitting}
                  variant="outline"
                  onPress={closeModal}
                >
                  Hủy
                </Button>
                <Button
                  className="min-h-11 rounded-full px-5 font-semibold shadow-none focus-visible:ring-2 focus-visible:ring-[var(--um-focus)] focus-visible:ring-offset-2"
                  isDisabled={isSubmitting}
                  style={isLocking ? undefined : primaryButtonStyle}
                  type="submit"
                  variant={isLocking ? 'danger' : 'primary'}
                >
                  {isSubmitting ? (
                    <Spinner
                      aria-label={
                        isLocking
                          ? 'Đang khóa tài khoản'
                          : 'Đang mở khóa tài khoản'
                      }
                      color="current"
                      size="sm"
                    />
                  ) : isLocking ? (
                    <Lock aria-hidden="true" className="size-4" />
                  ) : (
                    <LockOpen aria-hidden="true" className="size-4" />
                  )}
                  {isSubmitting
                    ? isLocking
                      ? 'Đang khóa...'
                      : 'Đang mở khóa...'
                    : isLocking
                      ? 'Xác nhận khóa'
                      : 'Xác nhận mở khóa'}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
