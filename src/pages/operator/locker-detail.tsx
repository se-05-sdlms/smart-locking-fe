import type {
  CompartmentFilter,
  CompartmentStatusAction,
  OperatorCompartment,
} from '@/types/operator-locker';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertDialog,
  Button,
  Drawer,
  ListBox,
  Modal,
  Select,
  Separator,
  Skeleton,
  Table,
  Typography,
  toast,
  useOverlayState,
} from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import ChevronDown from '@gravity-ui/icons/ChevronDown';
import ChevronRight from '@gravity-ui/icons/ChevronRight';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import CircleInfo from '@gravity-ui/icons/CircleInfo';
import ClockArrowRotateLeft from '@gravity-ui/icons/ClockArrowRotateLeft';
import Funnel from '@gravity-ui/icons/Funnel';
import LockOpen from '@gravity-ui/icons/LockOpen';
import Wrench from '@gravity-ui/icons/Wrench';
import Xmark from '@gravity-ui/icons/Xmark';
import PowerIcon from '@gravity-ui/icons/Power';
import { useParams } from 'react-router-dom';
import Qrcode from '@gravity-ui/icons/Qrcode';

import { EmergencyUnlockDialog } from './emergency-unlock-dialog';
import {
  CompartmentStatusChip,
  ConnectionChip,
  DetailRow,
  DoorChip,
  formatLockerDateTime,
  LoadErrorAlert,
  LockerStatusChip,
} from './locker-shared';

import {
  formatOperationalRecordKind,
  formatOperationalRecordStatus,
} from '@/constants/operational-record';
import {
  COMPARTMENT_FILTER_OPTIONS,
  COMPARTMENT_STATUS_ACTION_TEXT,
} from '@/constants/operator-locker';
import { LockerQrModal } from '@/components/lockers/locker-qr-modal';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { useOperationsRealtime } from '@/hooks/use-operations-realtime';
import { useLockerAlerts } from '@/hooks/use-locker-alerts';
import { LockerStatusDialog } from '@/components/operator/locker-status-dialog';
import { getEmergencyUnlockAvailability } from '@/services/locker-realtime-events';
import {
  getCompartmentStatusAction,
  matchesCompartmentFilter,
  replaceCompartment,
} from '@/services/operator-locker-mappers';
import {
  getCompartmentStatusErrorMessage,
  getLockerDetail,
  getLockerHistory,
  getLockerLoadErrorMessage,
  updateCompartmentStatus,
  getLockerStatusTarget,
  LOCKER_STATUS_ACTION_TEXT,
} from '@/services/operator-locker-service';

function DetailSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải chi tiết tủ"
      className="flex flex-col gap-4"
    >
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function LockerHistoryTable({ lockerId }: { lockerId: string }) {
  const load = useCallback(
    (signal: AbortSignal) => getLockerHistory(lockerId, signal),
    [lockerId],
  );
  const { state, reload } = useAsyncResource(load, getLockerLoadErrorMessage, [
    lockerId,
  ]);

  if (state.status === 'loading') {
    return (
      <div aria-busy="true" aria-label="Đang tải lịch sử" className="space-y-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (state.status === 'error') {
    return <LoadErrorAlert message={state.message} onRetry={reload} />;
  }

  if (!state.data.length) {
    return <p className="text-sm text-muted">Chưa có sự kiện vận hành nào.</p>;
  }

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Lịch sử vận hành của tủ">
          <Table.Header>
            <Table.Column isRowHeader id="time">
              Thời gian
            </Table.Column>
            <Table.Column id="kind">Loại</Table.Column>
            <Table.Column id="code">Mã</Table.Column>
            <Table.Column id="status">Trạng thái</Table.Column>
            <Table.Column id="summary">Nội dung</Table.Column>
          </Table.Header>
          <Table.Body>
            {state.data.map((item) => (
              <Table.Row
                key={`${item.kind}-${item.id}`}
                id={`${item.kind}-${item.id}`}
              >
                <Table.Cell>{formatLockerDateTime(item.occurredAt)}</Table.Cell>
                <Table.Cell>
                  {formatOperationalRecordKind(item.kind)}
                </Table.Cell>
                <Table.Cell>{item.code}</Table.Cell>
                <Table.Cell>
                  {formatOperationalRecordStatus(item.kind, item.status)}
                </Table.Cell>
                <Table.Cell>
                  <span className="block max-w-80 text-wrap">
                    {item.summary}
                  </span>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

export default function OperatorLockerDetailPage() {
  const { lockerId = '' } = useParams();
  const [compartmentFilter, setCompartmentFilter] =
    useState<CompartmentFilter>('all');
  const [selectedCompartmentId, setSelectedCompartmentId] = useState<
    string | null
  >(null);
  const [pendingAction, setPendingAction] =
    useState<CompartmentStatusAction | null>(null);
  const [statusError, setStatusError] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  // Non-zero key while the locker-level status dialog is open (fresh form each time).
  const [lockerStatusDialog, setLockerStatusDialog] = useState(0);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const statusRequestPending = useRef(false);

  const drawerState = useOverlayState();
  const statusState = useOverlayState();
  const emergencyState = useOverlayState();
  const [emergencyKey, setEmergencyKey] = useState(0);
  const historyState = useOverlayState();

  const load = useCallback(
    (signal: AbortSignal) => getLockerDetail(lockerId, signal),
    [lockerId],
  );
  const { state, setState, reload, refresh } = useAsyncResource(
    load,
    getLockerLoadErrorMessage,
    [lockerId],
  );
  const locker = state.data;

  const alertLockers = useMemo(
    () => (locker ? [{ id: locker.id, code: locker.code }] : []),
    [locker],
  );
  const onLockerEvent = useLockerAlerts(alertLockers);
  const unlockAvailability = locker
    ? getEmergencyUnlockAvailability(locker)
    : ({ allowed: false, reason: '' } as const);

  useOperationsRealtime(locker ? [locker.id] : [], refresh, onLockerEvent);

  const selectedCompartment = locker?.compartments.find(
    (compartment) => compartment.id === selectedCompartmentId,
  );
  const filteredCompartments = useMemo(
    () =>
      locker?.compartments.filter((compartment) =>
        matchesCompartmentFilter(compartment, compartmentFilter),
      ) ?? [],
    [compartmentFilter, locker],
  );
  const statusAction =
    locker && selectedCompartment
      ? getCompartmentStatusAction(locker, selectedCompartment)
      : null;

  if (!locker) {
    return (
      <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
        {state.status === 'error' ? (
          <LoadErrorAlert message={state.message} onRetry={reload} />
        ) : (
          <DetailSkeleton />
        )}
      </section>
    );
  }

  const openCompartment = (compartment: OperatorCompartment) => {
    setSelectedCompartmentId(compartment.id);
    drawerState.open();
  };

  const openStatusDialog = (action: CompartmentStatusAction) => {
    setPendingAction(action);
    setStatusError('');
    statusState.open();
  };

  const confirmStatusChange = async () => {
    if (
      !pendingAction ||
      !selectedCompartment ||
      statusRequestPending.current
    ) {
      return;
    }

    statusRequestPending.current = true;
    setIsUpdatingStatus(true);
    setStatusError('');

    try {
      const updated = await updateCompartmentStatus(
        locker.id,
        selectedCompartment.id,
        pendingAction,
      );

      setState({
        status: 'success',
        data: replaceCompartment(locker, updated),
      });
      statusState.close();
      toast.success(COMPARTMENT_STATUS_ACTION_TEXT[pendingAction].success, {
        description: `Ngăn ${updated.code} · tủ ${locker.code}`,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      // Server state is the source of truth; pick up concurrent changes too.
      refresh();
    } catch (error) {
      setStatusError(getCompartmentStatusErrorMessage(error));
    } finally {
      statusRequestPending.current = false;
      setIsUpdatingStatus(false);
    }
  };

  const lockerStatusTarget = getLockerStatusTarget(locker.operationalStatus);

  const actionText = pendingAction
    ? COMPARTMENT_STATUS_ACTION_TEXT[pendingAction]
    : null;

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
      {isQrOpen ? (
        <LockerQrModal
          lockerAddress={locker.address}
          lockerId={locker.id}
          onClose={() => setIsQrOpen(false)}
        />
      ) : null}
      {lockerStatusDialog && lockerStatusTarget ? (
        <LockerStatusDialog
          key={lockerStatusDialog}
          lockerCode={locker.code}
          lockerId={locker.id}
          target={lockerStatusTarget}
          onChanged={refresh}
          onClose={() => setLockerStatusDialog(0)}
        />
      ) : null}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <Typography type="h3">{locker.code}</Typography>
          <ConnectionChip value={locker.connectionStatus} />
          <LockerStatusChip value={locker.operationalStatus} />
        </div>
        <div className="flex flex-wrap gap-2">
          {lockerStatusTarget ? (
            <Button
              variant={
                lockerStatusTarget === 'OutOfService'
                  ? 'danger-soft'
                  : 'primary'
              }
              onPress={() => setLockerStatusDialog((key) => key + 1)}
            >
              <PowerIcon aria-hidden="true" className="size-4" />
              {LOCKER_STATUS_ACTION_TEXT[lockerStatusTarget].button}
            </Button>
          ) : null}
          <Button variant="secondary" onPress={() => setIsQrOpen(true)}>
            <Qrcode aria-hidden="true" className="size-4" />
            Mã QR
          </Button>
          <Button variant="secondary" onPress={historyState.open}>
            <ClockArrowRotateLeft aria-hidden="true" className="size-4" />
            Lịch sử vận hành
          </Button>
          <Button
            isDisabled={state.status === 'loading'}
            variant="secondary"
            onPress={refresh}
          >
            <ArrowRotateRight aria-hidden="true" className="size-4" />
            Làm mới
          </Button>
        </div>
      </div>

      {state.status === 'error' ? (
        <LoadErrorAlert message={state.message} onRetry={reload} />
      ) : null}

      {locker.operationalStatus === 'Inactive' ? (
        <Alert status="warning">
          <Alert.Indicator>
            <CircleExclamation aria-hidden="true" className="size-5" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Tủ đã bị vô hiệu hóa</Alert.Title>
            <Alert.Description>
              Không thể thay đổi trạng thái ngăn của tủ này. Liên hệ Quản trị
              viên nếu cần kích hoạt lại.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <section>
        <Typography className="mb-3" type="h5">
          Thông tin tủ
        </Typography>
        <dl className="grid gap-x-10 lg:grid-cols-2">
          <DetailRow label="Mã tủ">{locker.code}</DetailRow>
          <DetailRow label="Mã thiết bị">{locker.deviceIdentifier}</DetailRow>
          <DetailRow label="Địa chỉ">{locker.address}</DetailRow>
          <DetailRow label="Địa chỉ lưu hàng quá hạn">
            {locker.recoveryAddress}
          </DetailRow>
          <DetailRow label="Ngăn hoạt động">
            {locker.activeCompartments}/{locker.totalCompartments} ngăn
          </DetailRow>
          <DetailRow label="Kết nối thiết bị">
            <ConnectionChip value={locker.connectionStatus} />
          </DetailRow>
          <DetailRow label="Lần cuối kết nối">
            {formatLockerDateTime(locker.lastSeenAt, 'Chưa từng kết nối')}
          </DetailRow>
          <DetailRow label="Trạng thái vận hành">
            <LockerStatusChip value={locker.operationalStatus} />
          </DetailRow>
        </dl>
        <p className="mt-2 text-xs text-muted">
          Kết nối và trạng thái cửa do thiết bị báo về; trạng thái vận hành do
          người vận hành thiết lập.
        </p>
      </section>

      <Separator />

      <section>
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <Typography type="h5">Danh sách ngăn</Typography>
          <Select
            aria-label="Lọc ngăn theo trạng thái"
            className="w-full sm:w-52"
            value={compartmentFilter}
            variant="secondary"
            onChange={(value) =>
              setCompartmentFilter(value as CompartmentFilter)
            }
          >
            <Select.Trigger>
              <Funnel aria-hidden="true" className="size-4 text-accent" />
              <Select.Value />
              <Select.Indicator>
                <ChevronDown aria-hidden="true" className="size-4" />
              </Select.Indicator>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {COMPARTMENT_FILTER_OPTIONS.map((option) => (
                  <ListBox.Item
                    key={option.value}
                    id={option.value}
                    textValue={option.label}
                  >
                    {option.label}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        {!locker.compartments.length ? (
          <Alert status="default">
            <Alert.Indicator>
              <CircleInfo aria-hidden="true" className="size-5" />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Tủ chưa có ngăn nào</Alert.Title>
              <Alert.Description>
                Quản trị viên chưa cấu hình ngăn cho tủ này.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        {locker.compartments.length && !filteredCompartments.length ? (
          <p className="text-sm text-muted">
            Không có ngăn nào khớp bộ lọc đã chọn.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {filteredCompartments.map((compartment) => (
            <Button
              key={compartment.id}
              fullWidth
              aria-label={`Xem ngăn ${compartment.code}`}
              className="h-auto min-h-24 flex-col items-stretch justify-between gap-3 bg-white p-4 text-left"
              variant="outline"
              onPress={() => openCompartment(compartment)}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="font-semibold">{compartment.code}</span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 text-muted"
                />
              </span>
              <span className="flex w-full flex-wrap items-start gap-2">
                <CompartmentStatusChip value={compartment.operationalStatus} />
                <DoorChip value={compartment.doorStatus} />
              </span>
            </Button>
          ))}
        </div>
      </section>

      <Drawer state={drawerState}>
        <Drawer.Backdrop>
          <Drawer.Content placement="right">
            <Drawer.Dialog>
              <Drawer.CloseTrigger aria-label="Đóng chi tiết ngăn">
                <Xmark aria-hidden="true" className="size-5" />
              </Drawer.CloseTrigger>
              <Drawer.Header>
                <Drawer.Heading>Chi tiết ngăn</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body>
                {selectedCompartment ? (
                  <div className="space-y-5">
                    <dl>
                      <DetailRow label="Mã ngăn">
                        {selectedCompartment.code}
                      </DetailRow>
                      <DetailRow label="Mã phần cứng">
                        {selectedCompartment.hardwareCode} · kênh{' '}
                        {selectedCompartment.hardwareChannel}
                      </DetailRow>
                      <DetailRow label="Trạng thái vận hành">
                        <CompartmentStatusChip
                          value={selectedCompartment.operationalStatus}
                        />
                      </DetailRow>
                      <DetailRow label="Cửa (thiết bị báo)">
                        <DoorChip value={selectedCompartment.doorStatus} />
                      </DetailRow>
                      <DetailRow label="Cập nhật lần cuối">
                        {formatLockerDateTime(selectedCompartment.updatedAt)}
                      </DetailRow>
                      <DetailRow label="Tủ liên quan">{locker.code}</DetailRow>
                    </dl>

                    <Separator />

                    <div>
                      <Typography className="mb-3" type="h6">
                        Thao tác
                      </Typography>
                      <div className="space-y-3">
                        {statusAction ? (
                          <Button
                            fullWidth
                            variant={
                              statusAction === 'restore'
                                ? 'primary'
                                : 'secondary'
                            }
                            onPress={() => openStatusDialog(statusAction)}
                          >
                            {statusAction === 'restore' ? (
                              <CircleCheck
                                aria-hidden="true"
                                className="size-5"
                              />
                            ) : (
                              <Wrench aria-hidden="true" className="size-5" />
                            )}
                            {
                              COMPARTMENT_STATUS_ACTION_TEXT[statusAction]
                                .button
                            }
                          </Button>
                        ) : (
                          <p className="text-sm text-muted">
                            Không có thao tác trạng thái cho ngăn này.
                          </p>
                        )}
                        <Button
                          fullWidth
                          aria-describedby={
                            unlockAvailability.allowed
                              ? undefined
                              : 'emergency-unlock-blocked'
                          }
                          isDisabled={!unlockAvailability.allowed}
                          variant="danger"
                          onPress={() => {
                            setEmergencyKey((value) => value + 1);
                            emergencyState.open();
                          }}
                        >
                          <LockOpen aria-hidden="true" className="size-5" />
                          Mở khẩn cấp
                        </Button>
                        {unlockAvailability.allowed ? null : (
                          <p
                            className="text-sm text-danger"
                            id="emergency-unlock-blocked"
                          >
                            {unlockAvailability.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

      <AlertDialog>
        <AlertDialog.Backdrop
          isDismissable={!isUpdatingStatus}
          isOpen={statusState.isOpen}
          onOpenChange={statusState.setOpen}
        >
          <AlertDialog.Container size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning">
                  <CircleExclamation aria-hidden="true" className="size-6" />
                </AlertDialog.Icon>
                <AlertDialog.Heading>{actionText?.title}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="space-y-3">
                <p>
                  {pendingAction === 'restore'
                    ? `Xác nhận ngăn ${selectedCompartment?.code ?? ''} đã an toàn và có thể nhận bưu kiện trở lại.`
                    : `Ngăn ${selectedCompartment?.code ?? ''} sẽ ngừng nhận bưu kiện mới cho tới khi được khôi phục.`}
                </p>
                {statusError ? (
                  <Alert status="danger">
                    <Alert.Indicator>
                      <CircleExclamation
                        aria-hidden="true"
                        className="size-5"
                      />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Description>{statusError}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                ) : null}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  isDisabled={isUpdatingStatus}
                  slot="close"
                  variant="ghost"
                >
                  Hủy
                </Button>
                <Button
                  isDisabled={isUpdatingStatus}
                  variant="primary"
                  onPress={() => void confirmStatusChange()}
                >
                  {isUpdatingStatus ? 'Đang cập nhật...' : actionText?.confirm}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

      <EmergencyUnlockDialog
        // Fresh form and result for every compartment.
        key={`${selectedCompartmentId ?? 'none'}-${emergencyKey}`}
        compartment={selectedCompartment}
        isOpen={emergencyState.isOpen}
        locker={locker}
        onAttempted={refresh}
        onOpenChange={emergencyState.setOpen}
      />

      <Modal state={historyState}>
        <Modal.Backdrop>
          <Modal.Container size="lg">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label="Đóng lịch sử vận hành">
                <Xmark aria-hidden="true" className="size-5" />
              </Modal.CloseTrigger>
              <Modal.Header>
                <Modal.Icon>
                  <ClockArrowRotateLeft aria-hidden="true" className="size-5" />
                </Modal.Icon>
                <Modal.Heading>Lịch sử vận hành tủ {locker.code}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {historyState.isOpen ? (
                  <LockerHistoryTable lockerId={locker.id} />
                ) : null}
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="primary">
                  Đóng
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
