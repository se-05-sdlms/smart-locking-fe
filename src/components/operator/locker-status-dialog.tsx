import type { LockerStatusTarget } from '@/services/operator-locker-service';

import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Description,
  FieldError,
  Form,
  Label,
  Modal,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import Xmark from '@gravity-ui/icons/Xmark';

import {
  getLockerStatusErrorMessage,
  LOCKER_STATUS_ACTION_TEXT,
  LOCKER_STATUS_REASON_MAX_LENGTH,
  updateLockerStatus,
  validateLockerStatusReason,
} from '@/services/operator-locker-service';

/** Pause or restore a whole locker with a mandatory reason (SRS UC-18). */
export function LockerStatusDialog({
  lockerId,
  lockerCode,
  target,
  onClose,
  onChanged,
}: {
  lockerId: string;
  lockerCode: string;
  target: LockerStatusTarget;
  onClose: () => void;
  onChanged: () => void;
}) {
  const text = LOCKER_STATUS_ACTION_TEXT[target];
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const error = validateLockerStatusReason(reason);

    setReasonError(error);
    if (error || pending.current) return;

    pending.current = true;
    setIsSaving(true);
    setSubmitError('');

    try {
      await updateLockerStatus(lockerId, target, reason);
      toast.success(text.success, {
        description: `Tủ ${lockerCode}`,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      onChanged();
      onClose();
    } catch (submitFailure) {
      setSubmitError(getLockerStatusErrorMessage(submitFailure, target));
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onOpenChange={(open) => !open && !isSaving && onClose()}>
      <Modal.Backdrop isDismissable={!isSaving}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label="Đóng hộp thoại trạng thái tủ">
              <Xmark aria-hidden="true" className="size-5" />
            </Modal.CloseTrigger>
            <Modal.Header>
              <Modal.Heading>
                {text.title} {lockerCode}
              </Modal.Heading>
            </Modal.Header>
            <Form validationBehavior="aria" onSubmit={submit}>
              <Modal.Body className="space-y-4">
                <p className="text-sm text-muted">{text.description}</p>
                <TextField
                  fullWidth
                  isRequired
                  isDisabled={isSaving}
                  isInvalid={Boolean(reasonError)}
                  maxLength={LOCKER_STATUS_REASON_MAX_LENGTH}
                  value={reason}
                  onChange={(value) => {
                    setReason(value);
                    if (reasonError)
                      setReasonError(validateLockerStatusReason(value));
                  }}
                >
                  <Label>Lý do</Label>
                  <TextArea
                    placeholder={
                      target === 'OutOfService'
                        ? 'Ví dụ: Bảo trì bộ điều khiển, mất điện khu vực…'
                        : 'Ví dụ: Đã sửa xong, kiểm tra cửa hoạt động bình thường'
                    }
                    rows={3}
                    variant="secondary"
                  />
                  <Description>
                    {reason.trim().length}/{LOCKER_STATUS_REASON_MAX_LENGTH} ký
                    tự. Lý do được ghi vào lịch sử vận hành của tủ.
                  </Description>
                  <FieldError>{reasonError}</FieldError>
                </TextField>
                {submitError ? (
                  <Alert role="alert" status="danger">
                    <Alert.Indicator>
                      <CircleExclamation aria-hidden="true" />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Description>{submitError}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                ) : null}
              </Modal.Body>
              <Modal.Footer>
                <Button isDisabled={isSaving} variant="ghost" onPress={onClose}>
                  Hủy
                </Button>
                <Button
                  isDisabled={isSaving}
                  type="submit"
                  variant={target === 'OutOfService' ? 'danger' : 'primary'}
                >
                  {isSaving ? 'Đang lưu...' : text.button}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
