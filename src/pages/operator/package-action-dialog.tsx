import type {
  CompartmentPackageAction,
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
import TriangleExclamation from '@gravity-ui/icons/TriangleExclamation';

import { confirmCompartmentPackageAction } from '@/services/operator-locker-service';
import { ApiError } from '@/services/api-client';

type PackageActionDialogProps = {
  isOpen: boolean;
  locker: OperatorLocker;
  compartment: OperatorCompartment | undefined;
  action: CompartmentPackageAction | null;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess: () => void;
};

export function PackageActionDialog({
  isOpen,
  locker,
  compartment,
  action,
  onOpenChange,
  onSuccess,
}: PackageActionDialogProps) {
  const [reason, setReason] = useState('');
  const [setOutOfService, setSetOutOfService] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const requestPending = useRef(false);

  if (!compartment || !action) return null;

  const isHandover = action === 'Handover';
  const reasonTrimmed = reason.trim();
  const reasonError =
    reasonTrimmed.length === 0
      ? 'Vui lòng nhập lý do xử lý.'
      : reasonTrimmed.length > 500
        ? 'Lý do không được vượt quá 500 ký tự.'
        : '';

  const reset = () => {
    setReason('');
    setSetOutOfService(false);
    setIsSubmitted(false);
    setError('');
  };

  const changeOpen = (nextOpen: boolean) => {
    if (isSending) return;
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const submit = async () => {
    setIsSubmitted(true);
    if (reasonError || requestPending.current) return;

    requestPending.current = true;
    setIsSending(true);
    setError('');

    try {
      await confirmCompartmentPackageAction(locker.id, compartment.id, {
        action,
        reason: reasonTrimmed,
        setOutOfService: !isHandover ? setOutOfService : false,
      });

      toast.success(
        isHandover
          ? 'Đã xác nhận bàn giao bưu phẩm'
          : 'Đã xác nhận thu hồi bưu phẩm',
        {
          description: `Ngăn ${compartment.code} · tủ ${locker.code}`,
          indicator: <CircleCheck aria-hidden="true" className="size-5" />,
        },
      );

      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Không thể xác nhận xử lý bưu phẩm lúc này.');
      } else {
        setError('Có lỗi xảy ra khi gửi yêu cầu. Vui lòng thử lại.');
      }
    } finally {
      requestPending.current = false;
      setIsSending(false);
    }
  };

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
              <AlertDialog.Icon status={isHandover ? 'accent' : 'warning'}>
                <TriangleExclamation aria-hidden="true" className="size-6" />
              </AlertDialog.Icon>
              <AlertDialog.Heading>
                {isHandover
                  ? `Xác nhận bàn giao bưu phẩm (Ngăn ${compartment.code})`
                  : `Xác nhận thu hồi bưu phẩm (Ngăn ${compartment.code})`}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="space-y-4">
              <Alert status="warning">
                <Alert.Indicator>
                  <TriangleExclamation aria-hidden="true" className="size-5" />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Lưu ý quan trọng</Alert.Title>
                  <Alert.Description>
                    Chỉ xác nhận khi bạn đã mở cửa tủ thành công và{' '}
                    <strong>lấy kiện hàng thực tế ra khỏi ngăn</strong>. Thao
                    tác này sẽ cập nhật trạng thái đơn hàng và giải phóng ngăn
                    tủ.
                  </Alert.Description>
                </Alert.Content>
              </Alert>

              {compartment.packageInfo ? (
                <div className="rounded-lg border border-border bg-surface-secondary/40 p-3 text-xs space-y-1">
                  <div>
                    Mã bưu gửi:{' '}
                    <span className="font-semibold text-foreground">
                      {compartment.packageInfo.code}
                    </span>
                  </div>
                  <div>
                    Người gửi/nhận:{' '}
                    <span className="font-medium text-foreground">
                      {compartment.packageInfo.residentName ?? 'Chưa rõ'}
                    </span>{' '}
                    {compartment.packageInfo.phoneNumber
                      ? `(${compartment.packageInfo.phoneNumber})`
                      : ''}
                  </div>
                </div>
              ) : null}

              <TextField
                fullWidth
                isRequired
                isDisabled={isSending}
                isInvalid={isSubmitted && Boolean(reasonError)}
                maxLength={500}
                value={reason}
                onChange={setReason}
              >
                <Label>Lý do xử lý</Label>
                <TextArea
                  placeholder={
                    isHandover
                      ? 'Ví dụ: Đã bàn giao tận tay cho cư dân...'
                      : 'Ví dụ: Hàng quá hạn/hỏng hóc, thu hồi về văn phòng...'
                  }
                  rows={3}
                />
                <Description>{reasonTrimmed.length}/500 ký tự</Description>
                <FieldError>{reasonError}</FieldError>
              </TextField>

              {!isHandover ? (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    checked={setOutOfService}
                    className="rounded text-primary"
                    disabled={isSending}
                    id="package-action-set-out-of-service"
                    type="checkbox"
                    onChange={(e) => setSetOutOfService(e.target.checked)}
                  />
                  <label
                    className="cursor-pointer text-sm text-foreground"
                    htmlFor="package-action-set-out-of-service"
                  >
                    Khóa ngăn sang trạng thái bảo dưỡng (Tạm ngưng)
                  </label>
                </div>
              ) : null}

              {error ? (
                <Alert role="alert" status="danger">
                  <Alert.Indicator>
                    <CircleExclamation aria-hidden="true" className="size-5" />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Không thể hoàn tất thao tác</Alert.Title>
                    <Alert.Description>{error}</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                isDisabled={isSending}
                variant="outline"
                onPress={() => changeOpen(false)}
              >
                Hủy
              </Button>
              <Button
                isDisabled={isSending}
                variant={isHandover ? 'primary' : 'secondary'}
                onPress={submit}
              >
                {isSending
                  ? 'Đang xử lý...'
                  : isHandover
                    ? 'Xác nhận đã bàn giao'
                    : 'Xác nhận đã thu hồi'}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
