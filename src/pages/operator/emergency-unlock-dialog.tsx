import type { EmergencyUnlock } from '@/types/emergency-unlock';
import type {
  OperatorCompartment,
  OperatorLocker,
} from '@/types/operator-locker';

import { useRef, useState } from 'react';
import {
  Alert,
  AlertDialog,
  Button,
  Description,
  FieldError,
  Label,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import LockOpen from '@gravity-ui/icons/LockOpen';
import TriangleExclamation from '@gravity-ui/icons/TriangleExclamation';

import { ConnectionChip, formatLockerDateTime } from './locker-shared';

import {
  EMERGENCY_REASON_MAX_LENGTH,
  EMERGENCY_REASON_MIN_LENGTH,
  EMERGENCY_UNLOCK_BLOCKER_TEXT,
  EMERGENCY_UNLOCK_RESULT_DISPLAY,
} from '@/constants/emergency-unlock';
import {
  createEmergencyUnlock,
  getEmergencyUnlockBlockers,
  getEmergencyUnlockErrorMessage,
  validateEmergencyReason,
} from '@/services/emergency-unlock-service';

type EmergencyUnlockDialogProps = {
  isOpen: boolean;
  locker: OperatorLocker;
  compartment: OperatorCompartment | undefined;
  onOpenChange: (isOpen: boolean) => void;
  /** Called after any request reached the server, so the page can refetch. */
  onAttempted: () => void;
};

export function EmergencyUnlockDialog({
  isOpen,
  locker,
  compartment,
  onOpenChange,
  onAttempted,
}: EmergencyUnlockDialogProps) {
  const [reason, setReason] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<EmergencyUnlock | null>(null);
  const requestPending = useRef(false);

  const blockers = compartment
    ? getEmergencyUnlockBlockers(locker, compartment)
    : [];
  const reasonError = validateEmergencyReason(reason);
  const isBlocked = blockers.length > 0;

  const reset = () => {
    setReason('');
    setIsSubmitted(false);
    setError('');
    setResult(null);
  };

  const changeOpen = (nextOpen: boolean) => {
    if (isSending) return;
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const send = async () => {
    setIsSubmitted(true);

    if (!compartment || isBlocked || reasonError || requestPending.current) {
      return;
    }

    requestPending.current = true;
    setIsSending(true);
    setError('');
    setResult(null);

    try {
      const unlock = await createEmergencyUnlock(
        locker.id,
        compartment.id,
        reason,
      );
      const display = EMERGENCY_UNLOCK_RESULT_DISPLAY[unlock.result];

      setResult(unlock);
      onAttempted();
      (unlock.result === 'Succeeded' ? toast.success : toast.danger)(
        display.label,
        {
          description: `Ngăn ${unlock.compartmentCode} · tủ ${locker.code}`,
          indicator:
            unlock.result === 'Succeeded' ? (
              <CircleCheck aria-hidden="true" className="size-5" />
            ) : (
              <CircleExclamation aria-hidden="true" className="size-5" />
            ),
        },
      );
    } catch (sendError) {
      setError(getEmergencyUnlockErrorMessage(sendError));
      onAttempted();
    } finally {
      requestPending.current = false;
      setIsSending(false);
    }
  };

  const resultDisplay = result
    ? EMERGENCY_UNLOCK_RESULT_DISPLAY[result.result]
    : null;

  return (
    <AlertDialog>
      <AlertDialog.Backdrop
        isDismissable={!isSending}
        isOpen={isOpen}
        onOpenChange={changeOpen}
      >
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger">
                <TriangleExclamation aria-hidden="true" className="size-6" />
              </AlertDialog.Icon>
              <AlertDialog.Heading>
                Mở khẩn cấp ngăn {compartment?.code ?? ''}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="space-y-4">
              <p className="text-sm text-muted">
                Lệnh mở khẩn cấp được ghi vào nhật ký kiểm toán kèm tài khoản và
                lý do của bạn. Chỉ thực hiện khi đang có mặt tại tủ.
              </p>

              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium">
                  Kết nối của tủ {locker.code}
                </span>
                <ConnectionChip value={locker.connectionStatus} />
              </div>

              {isBlocked ? (
                <Alert role="alert" status="danger">
                  <Alert.Indicator>
                    <CircleExclamation aria-hidden="true" className="size-5" />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Không thể gửi lệnh mở lúc này</Alert.Title>
                    <Alert.Description>
                      <ul className="list-disc pl-4">
                        {blockers.map((blocker) => (
                          <li key={blocker}>
                            {EMERGENCY_UNLOCK_BLOCKER_TEXT[blocker]}
                          </li>
                        ))}
                      </ul>
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}

              {result && resultDisplay ? (
                <Alert role="alert" status={resultDisplay.color}>
                  <Alert.Indicator>
                    {result.result === 'Succeeded' ? (
                      <CircleCheck aria-hidden="true" className="size-5" />
                    ) : (
                      <CircleExclamation
                        aria-hidden="true"
                        className="size-5"
                      />
                    )}
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>{resultDisplay.label}</Alert.Title>
                    <Alert.Description>
                      {resultDisplay.description} Thời điểm yêu cầu:{' '}
                      {formatLockerDateTime(result.requestedAt)}.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : (
                <TextField
                  fullWidth
                  isRequired
                  isDisabled={isSending || isBlocked}
                  isInvalid={isSubmitted && Boolean(reasonError)}
                  maxLength={EMERGENCY_REASON_MAX_LENGTH}
                  value={reason}
                  onChange={setReason}
                >
                  <Label>Lý do mở khẩn cấp</Label>
                  <TextArea
                    placeholder="Ví dụ: Cửa ngăn kẹt, cư dân cần lấy hàng gấp..."
                    rows={4}
                  />
                  <Description>
                    Tối thiểu {EMERGENCY_REASON_MIN_LENGTH} ký tự ·{' '}
                    {reason.trim().length}/{EMERGENCY_REASON_MAX_LENGTH}
                  </Description>
                  <FieldError>{reasonError}</FieldError>
                </TextField>
              )}

              {error ? (
                <Alert role="alert" status="danger">
                  <Alert.Indicator>
                    <CircleExclamation aria-hidden="true" className="size-5" />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Description>{error}</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                isDisabled={isSending}
                variant="ghost"
                onPress={() => changeOpen(false)}
              >
                {result ? 'Đóng' : 'Hủy'}
              </Button>
              {result?.result === 'Succeeded' ? null : (
                <Button
                  isDisabled={isSending || isBlocked}
                  variant="danger"
                  onPress={() => void send()}
                >
                  <LockOpen aria-hidden="true" className="size-5" />
                  {isSending
                    ? 'Đang gửi lệnh...'
                    : result?.result === 'Failed'
                      ? 'Thử lại'
                      : 'Xác nhận mở'}
                </Button>
              )}
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
