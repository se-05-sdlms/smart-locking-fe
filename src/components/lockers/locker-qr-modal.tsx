import type { LockerQrContext } from '@/services/locker-qr-service';

import { useEffect, useState } from 'react';
import { Alert, Button, Modal, Skeleton, toast } from '@heroui/react';
import ArrowDownToLine from '@gravity-ui/icons/ArrowDownToLine';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';

import {
  getLockerQrContext,
  getLockerQrErrorMessage,
  qrFileName,
  renderLockerQr,
} from '@/services/locker-qr-service';

type QrState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; context: LockerQrContext; image: string };

/**
 * Preview and download the public QR of a locker (Shipper web + locker code).
 * Admin may open it for any locker; Operators only within their scope (BE).
 */
export function LockerQrModal({
  lockerId,
  lockerAddress,
  onClose,
}: {
  lockerId: string;
  lockerAddress?: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<QrState>({ status: 'loading' });
  const [request, setRequest] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    setState({ status: 'loading' });
    getLockerQrContext(lockerId, controller.signal)
      .then(async (context) => ({
        context,
        image: await renderLockerQr(context),
      }))
      .then(({ context, image }) => {
        if (!controller.signal.aborted)
          setState({ status: 'ready', context, image });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            message: getLockerQrErrorMessage(error),
          });
        }
      });

    return () => controller.abort();
  }, [lockerId, request]);

  // Download always re-reads the current locker data, never a stale preview.
  const download = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const context = await getLockerQrContext(lockerId);
      const image = await renderLockerQr(context);
      const link = document.createElement('a');

      link.href = image;
      link.download = qrFileName(context.lockerCode);
      link.click();
      setState({ status: 'ready', context, image });
      toast.success('Đã tải ảnh QR', { description: link.download });
    } catch (error) {
      toast.danger(getLockerQrErrorMessage(error));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Mã QR của tủ</Modal.Heading>
              <Modal.CloseTrigger aria-label="Đóng mã QR" />
            </Modal.Header>
            <Modal.Body className="flex flex-col items-center gap-4">
              {state.status === 'loading' ? (
                <Skeleton className="aspect-square w-full max-w-72 rounded-xl" />
              ) : null}
              {state.status === 'error' ? (
                <Alert className="w-full" role="alert" status="danger">
                  <Alert.Indicator>
                    <CircleExclamation aria-hidden="true" />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Description>{state.message}</Alert.Description>
                  </Alert.Content>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => setRequest((value) => value + 1)}
                  >
                    <ArrowRotateRight aria-hidden="true" className="size-4" />
                    Thử lại
                  </Button>
                </Alert>
              ) : null}
              {state.status === 'ready' ? (
                <>
                  <img
                    alt={`Mã QR gửi hàng của tủ ${state.context.lockerCode}`}
                    className="aspect-square w-full max-w-72 rounded-xl border border-border bg-white p-2"
                    src={state.image}
                  />
                  <div className="text-center">
                    <p className="text-lg font-semibold">
                      Tủ {state.context.lockerCode}
                    </p>
                    {lockerAddress ? (
                      <p className="text-sm text-muted">{lockerAddress}</p>
                    ) : null}
                    <p className="mt-2 break-all text-xs text-muted">
                      {state.context.shipperUrl}
                    </p>
                  </div>
                  {state.context.operationalStatus !== 0 ? (
                    <p className="text-center text-sm text-warning">
                      Tủ đang không vận hành; shipper quét QR sẽ chưa gửi hàng
                      được.
                    </p>
                  ) : null}
                  <p className="text-center text-xs text-muted">
                    QR chỉ chứa địa chỉ web Shipper và mã tủ, không chứa mã nhận
                    hàng hay thông tin bí mật.
                  </p>
                </>
              ) : null}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose}>
                Đóng
              </Button>
              <Button
                isDisabled={state.status !== 'ready' || isDownloading}
                variant="primary"
                onPress={() => void download()}
              >
                <ArrowDownToLine aria-hidden="true" className="size-4" />
                {isDownloading ? 'Đang tải...' : 'Tải ảnh QR'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
