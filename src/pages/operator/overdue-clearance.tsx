import type { ReactNode } from 'react';
import type {
  OverdueParcelDetail,
  OverdueTransfer,
} from '@/types/overdue-parcel';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Chip,
  ListBox,
  Modal,
  SearchField,
  Select,
  Separator,
  Skeleton,
  Table,
  Typography,
  toast,
  useOverlayState,
} from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import Box from '@gravity-ui/icons/Box';
import ChevronDown from '@gravity-ui/icons/ChevronDown';
import ChevronRight from '@gravity-ui/icons/ChevronRight';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import CircleInfo from '@gravity-ui/icons/CircleInfo';
import Clock from '@gravity-ui/icons/Clock';
import LocationArrow from '@gravity-ui/icons/LocationArrow';
import Magnifier from '@gravity-ui/icons/Magnifier';
import TriangleExclamation from '@gravity-ui/icons/TriangleExclamation';
import Xmark from '@gravity-ui/icons/Xmark';
import { useNavigate, useParams } from 'react-router-dom';

import { useAsyncResource } from '@/hooks/use-async-resource';
import { useOperationsRealtime } from '@/hooks/use-operations-realtime';
import {
  filterOverdueParcels,
  formatOverdueAmount,
  formatParcelDateTime,
  formatTimePastDeadline,
  getOverdueLoadErrorMessage,
  getOverdueParcelDetail,
  getQueueLockers,
  getTransferErrorMessage,
  listClearancePendingParcels,
  OVERDUE_CHARGE_STATUS_LABELS,
  PARCEL_STATUS_DISPLAY,
  transferToCollectionPoint,
} from '@/services/overdue-parcel-service';

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[11rem_1fr] sm:gap-5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

function ParcelStatusChip({
  status,
}: {
  status: OverdueParcelDetail['status'];
}) {
  const display = PARCEL_STATUS_DISPLAY[status];

  return (
    <Chip color={display.color} size="sm" variant="soft">
      {display.label}
    </Chip>
  );
}

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
        <CircleExclamation aria-hidden="true" className="size-5" />
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

function OverdueListPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [lockerFilter, setLockerFilter] = useState('all');
  const { state, reload, refresh } = useAsyncResource(
    listClearancePendingParcels,
    getOverdueLoadErrorMessage,
    [],
  );
  const queue = useMemo(() => state.data ?? [], [state.data]);
  const lockers = useMemo(() => getQueueLockers(queue), [queue]);
  const parcels = useMemo(
    () => filterOverdueParcels(queue, keyword, lockerFilter),
    [keyword, lockerFilter, queue],
  );
  const oldest = queue[0];

  // Parcel changes are published to the locker groups.
  useOperationsRealtime(
    lockers.map((locker) => locker.id),
    refresh,
  );

  const renderTable = () => {
    if (state.status === 'loading' && !state.data) {
      return (
        <div
          aria-busy="true"
          aria-label="Đang tải danh sách bưu kiện quá hạn"
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      );
    }

    if (state.status === 'error' && !state.data) {
      return <ErrorAlert message={state.message} onRetry={reload} />;
    }

    if (!parcels.length) {
      return (
        <Alert status="default">
          <Alert.Indicator>
            <CircleInfo aria-hidden="true" className="size-5" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>
              {queue.length
                ? 'Không tìm thấy bưu kiện'
                : 'Không có bưu kiện cần xử lý'}
            </Alert.Title>
            <Alert.Description>
              {queue.length
                ? 'Hãy thử đổi mã bưu kiện hoặc bộ lọc.'
                : 'Chưa có bưu kiện nào vượt thời hạn lưu tối đa trong các tủ bạn phụ trách.'}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      );
    }

    return (
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Danh sách bưu kiện quá hạn">
            <Table.Header>
              <Table.Column isRowHeader id="parcel">
                Mã bưu kiện
              </Table.Column>
              <Table.Column id="locker">Tủ / Ngăn</Table.Column>
              <Table.Column id="stored">Gửi vào</Table.Column>
              <Table.Column id="deadline">Hạn lưu tối đa</Table.Column>
              <Table.Column id="past">Đã quá hạn</Table.Column>
              <Table.Column id="status">Trạng thái</Table.Column>
              <Table.Column id="action">Thao tác</Table.Column>
            </Table.Header>
            <Table.Body>
              {parcels.map((parcel) => (
                <Table.Row key={parcel.id} id={parcel.id}>
                  <Table.Cell>
                    <span className="font-semibold">{parcel.parcelCode}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="block font-medium">
                      {parcel.lockerCode} · {parcel.compartmentCode}
                    </span>
                    <span className="block max-w-64 text-wrap text-xs text-muted">
                      {parcel.lockerAddress}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {formatParcelDateTime(parcel.storedAt)}
                  </Table.Cell>
                  <Table.Cell>
                    {formatParcelDateTime(parcel.maxStorageUntil)}
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-semibold text-danger">
                      {formatTimePastDeadline(parcel.maxStorageUntil)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <ParcelStatusChip status={parcel.status} />
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      aria-label={`Xem chi tiết bưu kiện ${parcel.parcelCode}`}
                      size="sm"
                      variant="ghost"
                      onPress={() =>
                        navigate(`/operator/overdue-clearance/${parcel.id}`, {
                          state: { parcelCode: parcel.parcelCode },
                        })
                      }
                    >
                      Xem chi tiết
                      <ChevronRight aria-hidden="true" className="size-4" />
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    );
  };

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      {queue.length ? (
        <Alert status="warning">
          <Alert.Indicator>
            <Clock aria-hidden="true" className="size-5" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>{queue.length} bưu kiện đang chờ xử lý</Alert.Title>
            <Alert.Description>
              {oldest
                ? `Kiện quá hạn lâu nhất đã quá ${formatTimePastDeadline(oldest.maxStorageUntil)}. `
                : ''}
              Hãy lấy hàng khỏi ngăn, chuyển tới địa chỉ thu hồi của tủ rồi xác
              nhận đã thu hồi.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {state.status === 'error' && state.data ? (
        <ErrorAlert message={state.message} onRetry={reload} />
      ) : null}

      <Card>
        <Card.Header>
          <Card.Title>Tìm kiếm và lọc</Card.Title>
          <Card.Description>
            Tra cứu theo mã bưu kiện, mã tủ hoặc mã ngăn trong phạm vi được phân
            công.
          </Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_13rem_auto]">
          <SearchField
            fullWidth
            aria-label="Tìm theo mã bưu kiện, mã tủ hoặc mã ngăn"
            value={keyword}
            variant="secondary"
            onChange={setKeyword}
          >
            <SearchField.Group>
              <SearchField.SearchIcon>
                <Magnifier aria-hidden="true" className="size-4" />
              </SearchField.SearchIcon>
              <SearchField.Input placeholder="Nhập mã bưu kiện, mã tủ..." />
              <SearchField.ClearButton aria-label="Xóa từ khóa">
                <Xmark aria-hidden="true" className="size-4" />
              </SearchField.ClearButton>
            </SearchField.Group>
          </SearchField>

          <Select
            aria-label="Lọc theo tủ"
            value={lockerFilter}
            variant="secondary"
            onChange={(value) => setLockerFilter(String(value ?? 'all'))}
          >
            <Select.Trigger>
              <Box aria-hidden="true" className="size-4 text-accent" />
              <Select.Value />
              <Select.Indicator>
                <ChevronDown aria-hidden="true" className="size-4" />
              </Select.Indicator>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="all" textValue="Tất cả tủ">
                  Tất cả tủ
                </ListBox.Item>
                {lockers.map((locker) => (
                  <ListBox.Item
                    key={locker.id}
                    id={locker.id}
                    textValue={`Tủ ${locker.code}`}
                  >
                    Tủ {locker.code}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <Button
            isDisabled={state.status === 'loading'}
            variant="secondary"
            onPress={refresh}
          >
            <ArrowRotateRight aria-hidden="true" className="size-4" />
            Làm mới
          </Button>
        </Card.Content>
      </Card>

      {renderTable()}
    </section>
  );
}

function OverdueDetailPage({ parcelId }: { parcelId: string }) {
  const navigate = useNavigate();
  const confirmState = useOverlayState();
  // Confirms the parcel was delivered to the locker RecoveryAddress (no extra tracking states).
  const [isDelivered, setIsDelivered] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transfer, setTransfer] = useState<OverdueTransfer | null>(null);
  const pending = useRef(false);

  const load = useCallback(
    (signal: AbortSignal) => getOverdueParcelDetail(parcelId, signal),
    [parcelId],
  );
  const { state, reload, refresh } = useAsyncResource(
    load,
    getOverdueLoadErrorMessage,
    [parcelId],
  );
  const parcel = state.data;

  if (!parcel) {
    return (
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        {state.status === 'error' ? (
          <>
            <ErrorAlert message={state.message} onRetry={reload} />
            <Button
              className="self-start"
              variant="ghost"
              onPress={() => navigate('/operator/overdue-clearance')}
            >
              Quay lại danh sách
            </Button>
          </>
        ) : (
          <div
            aria-busy="true"
            aria-label="Đang tải bưu kiện"
            className="space-y-3"
          >
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        )}
      </section>
    );
  }

  const isDone = parcel.status === 'Removed' || parcel.status === 'Retrieved';

  const openConfirm = () => {
    setIsDelivered(false);
    setTransferError('');
    confirmState.open();
  };

  const confirmTransfer = async () => {
    if (!isDelivered || pending.current) return;

    pending.current = true;
    setIsTransferring(true);
    setTransferError('');

    try {
      const result = await transferToCollectionPoint(parcel.id);

      setTransfer(result);
      confirmState.close();
      toast.success('Đã thu hồi bưu kiện khỏi tủ', {
        description: `${result.parcelCode} · đã chuyển tới địa chỉ thu hồi, cư dân đã được thông báo.`,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      refresh();
    } catch (error) {
      setTransferError(getTransferErrorMessage(error));
    } finally {
      pending.current = false;
      setIsTransferring(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {transfer || isDone ? (
        <Alert role="status" status="success">
          <Alert.Indicator>
            <CircleCheck aria-hidden="true" className="size-5" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Hoàn tất xử lý</Alert.Title>
            <Alert.Description>
              Bưu kiện {parcel.parcelCode} đã được thu hồi khỏi tủ và chuyển tới
              địa chỉ thu hồi{' '}
              {transfer?.collectionAddress ?? parcel.recoveryAddress}. Hệ thống
              đã ghi nhật ký và gửi thông báo cho cư dân.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : (
        <Alert status="danger">
          <Alert.Indicator>
            <TriangleExclamation aria-hidden="true" className="size-5" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>
              Bưu kiện đã quá hạn lưu tối đa{' '}
              {formatTimePastDeadline(parcel.maxStorageUntil)}
            </Alert.Title>
            <Alert.Description>
              Lấy bưu kiện khỏi ngăn, chuyển tới địa chỉ thu hồi của tủ, sau đó
              xác nhận đã thu hồi.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <Card.Header>
            <Card.Title>Thông tin bưu kiện quá hạn</Card.Title>
            <Card.Description>
              Vị trí, thời hạn và phí lưu của {parcel.parcelCode}.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <dl>
              <DetailRow label="Mã bưu kiện">{parcel.parcelCode}</DetailRow>
              <DetailRow label="Tủ">
                {parcel.lockerCode} · {parcel.lockerAddress}
              </DetailRow>
              <DetailRow label="Mã ngăn">{parcel.compartmentCode}</DetailRow>
              <DetailRow label="Thời gian gửi vào">
                {formatParcelDateTime(parcel.storedAt)}
              </DetailRow>
              <DetailRow label="Hạn nhận hàng">
                {formatParcelDateTime(parcel.pickupDueAt)}
              </DetailRow>
              <DetailRow label="Hạn lưu tối đa">
                {formatParcelDateTime(parcel.maxStorageUntil)}
              </DetailRow>
              <DetailRow label="Trạng thái">
                <ParcelStatusChip status={parcel.status} />
              </DetailRow>
            </dl>

            <Separator className="my-4" />

            <Typography className="mb-2" type="h6">
              Phí lưu quá hạn
            </Typography>
            <dl>
              <DetailRow label="Số tiền">
                {formatOverdueAmount(parcel.overdueAmount, parcel.currency)}
              </DetailRow>
              {parcel.overdueChargeStatus ? (
                <DetailRow label="Thanh toán">
                  {OVERDUE_CHARGE_STATUS_LABELS[parcel.overdueChargeStatus]}
                </DetailRow>
              ) : null}
            </dl>

            {parcel.shipperName || parcel.shipperPhone ? (
              <>
                <Separator className="my-4" />
                <Typography className="mb-2" type="h6">
                  Người giao hàng
                </Typography>
                <dl>
                  {parcel.shipperName ? (
                    <DetailRow label="Họ tên">{parcel.shipperName}</DetailRow>
                  ) : null}
                  {parcel.shipperPhone ? (
                    <DetailRow label="Số điện thoại">
                      {parcel.shipperPhone}
                    </DetailRow>
                  ) : null}
                </dl>
              </>
            ) : null}
          </Card.Content>
        </Card>

        <div className="flex flex-col gap-4">
          <Card variant="secondary">
            <Card.Header>
              <Card.Title>Địa chỉ thu hồi của tủ</Card.Title>
            </Card.Header>
            <Card.Content className="flex gap-3">
              <LocationArrow
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-accent"
              />
              <span className="text-sm font-medium">
                {parcel.recoveryAddress}
              </span>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Xử lý</Card.Title>
              <Card.Description>
                Hệ thống chỉ hiển thị bưu kiện đã vượt hạn lưu tối đa trong tủ
                bạn phụ trách.
              </Card.Description>
            </Card.Header>
            <Card.Footer>
              <Button
                fullWidth
                isDisabled={isDone || Boolean(transfer)}
                variant="primary"
                onPress={openConfirm}
              >
                <Box aria-hidden="true" className="size-5" />
                {isDone || transfer ? 'Đã thu hồi' : 'Xác nhận đã thu hồi'}
              </Button>
            </Card.Footer>
          </Card>
        </div>
      </div>

      <Modal state={confirmState}>
        <Modal.Backdrop isDismissable={!isTransferring}>
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label="Đóng xác nhận xử lý">
                <Xmark aria-hidden="true" className="size-5" />
              </Modal.CloseTrigger>
              <Modal.Header>
                <Modal.Icon>
                  <TriangleExclamation aria-hidden="true" className="size-5" />
                </Modal.Icon>
                <Modal.Heading>Xác nhận thu hồi bưu kiện</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4">
                <dl>
                  <DetailRow label="Bưu kiện">{parcel.parcelCode}</DetailRow>
                  <DetailRow label="Tủ / Ngăn">
                    {parcel.lockerCode} · {parcel.compartmentCode}
                  </DetailRow>
                  <DetailRow label="Địa chỉ thu hồi">
                    {parcel.recoveryAddress}
                  </DetailRow>
                </dl>
                <Alert status="warning">
                  <Alert.Indicator>
                    <CircleInfo aria-hidden="true" className="size-5" />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Description>
                      Chỉ xác nhận sau khi bưu kiện đã được chuyển tới địa chỉ
                      thu hồi ở trên. Khi xác nhận, bưu kiện được ghi nhận đã
                      thu hồi khỏi tủ, ngăn được giải phóng và cư dân nhận thông
                      báo. Không thể hoàn tác.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
                <Checkbox
                  isDisabled={isTransferring}
                  isSelected={isDelivered}
                  onChange={setIsDelivered}
                >
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Content>
                    Tôi đã lấy bưu kiện {parcel.parcelCode} khỏi ngăn{' '}
                    {parcel.compartmentCode} và chuyển tới địa chỉ thu hồi{' '}
                    {parcel.recoveryAddress}.
                  </Checkbox.Content>
                </Checkbox>
                {transferError ? <ErrorAlert message={transferError} /> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  isDisabled={isTransferring}
                  variant="ghost"
                  onPress={confirmState.close}
                >
                  Hủy
                </Button>
                <Button
                  isDisabled={!isDelivered || isTransferring}
                  variant="primary"
                  onPress={() => void confirmTransfer()}
                >
                  {isTransferring ? 'Đang xử lý...' : 'Xác nhận đã thu hồi'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}

export default function OperatorOverdueClearancePage() {
  const { parcelId } = useParams();

  return parcelId ? (
    <OverdueDetailPage key={parcelId} parcelId={parcelId} />
  ) : (
    <OverdueListPage />
  );
}
