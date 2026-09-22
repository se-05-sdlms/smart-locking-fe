import type { FormEvent } from 'react';
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
  Card,
  FieldError,
  Form,
  Label,
  ListBox,
  Modal,
  Spinner,
  TextArea,
  TextField,
  Typography,
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
        <Modal.Container scroll="inside" size="sm">
          <Modal.Dialog className="max-h-full overflow-hidden">
            <Modal.Header className="shrink-0 pb-3 pr-10">
              <Modal.Icon>
                {isLocking ? (
                  <Lock aria-hidden="true" className="size-5" />
                ) : (
                  <LockOpen aria-hidden="true" className="size-5" />
                )}
              </Modal.Icon>
              <Modal.Heading>{title}</Modal.Heading>
              <Modal.CloseTrigger
                aria-label="Đóng hộp thoại"
                isDisabled={isSubmitting}
              />
            </Modal.Header>
            <Form
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              onSubmit={handleSubmit}
            >
              <Modal.Body className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="space-y-5">
                  <Card variant="secondary">
                    <Card.Content>
                      <Typography className="font-semibold">
                        {user.fullName}
                      </Typography>
                      <Typography className="mt-1 text-muted">
                        {USER_ROLE_LABELS[user.role]}
                      </Typography>
                      <Typography className="mt-2 break-words text-muted">
                        {user.email || user.phoneNumber}
                      </Typography>
                    </Card.Content>
                  </Card>

                  {isLocking ? (
                    <Alert status="danger">
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

                  <div className="space-y-2">
                    <Label>Lý do</Label>
                    <ListBox
                      aria-label={`Lý do ${isLocking ? 'khóa' : 'mở khóa'} tài khoản`}
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
                        <ListBox.Item key={option.code} id={option.code}>
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
                    <TextField
                      fullWidth
                      isInvalid={Boolean(errors.reasonDetail)}
                      value={reasonDetail}
                      onChange={(value) => {
                        setReasonDetail(value);
                        setErrors((current) => ({
                          ...current,
                          reasonDetail: undefined,
                          form: undefined,
                        }));
                      }}
                    >
                      <Label>Chi tiết lý do</Label>
                      <TextArea
                        aria-label="Chi tiết lý do khác"
                        disabled={isSubmitting}
                        rows={4}
                      />
                      <FieldError>{errors.reasonDetail}</FieldError>
                    </TextField>
                  ) : null}

                  {errors.form ? (
                    <Alert status="danger">
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
              <Modal.Footer className="shrink-0">
                <Button
                  className="min-h-11"
                  isDisabled={isSubmitting}
                  variant="ghost"
                  onPress={closeModal}
                >
                  Hủy
                </Button>
                <Button
                  className="min-h-11"
                  isDisabled={isSubmitting}
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
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
