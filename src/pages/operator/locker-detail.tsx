import { useEffect, useState } from 'react';
import {
  Alert,
  AlertDialog,
  Button,
  Chip,
  Drawer,
  FieldError,
  Label,
  ListBox,
  Modal,
  Select,
  Separator,
  Table,
  TextArea,
  TextField,
  Typography,
  toast,
  useOverlayState,
} from '@heroui/react';
import ChevronDown from '@gravity-ui/icons/ChevronDown';
import ChevronRight from '@gravity-ui/icons/ChevronRight';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import ClockArrowRotateLeft from '@gravity-ui/icons/ClockArrowRotateLeft';
import Funnel from '@gravity-ui/icons/Funnel';
import LockOpen from '@gravity-ui/icons/LockOpen';
import TriangleExclamation from '@gravity-ui/icons/TriangleExclamation';
import Wrench from '@gravity-ui/icons/Wrench';
import Xmark from '@gravity-ui/icons/Xmark';
import { Navigate, useParams } from 'react-router-dom';

import type {
  Compartment,
  CompartmentStatus,
} from './locker-shared';
import {
  CompartmentChip,
  ConnectionChip,
  createCompartments,
  DetailRow,
  LOCKERS,
} from './locker-shared';

type CompartmentFilter = 'all' | 'active' | 'parcel' | 'maintenance';

export default function OperatorLockerDetailPage() {
  const { lockerId } = useParams();
  const [compartments, setCompartments] = useState<Compartment[]>([]);
  const [compartmentFilter, setCompartmentFilter] =
    useState<CompartmentFilter>('all');
  const [selectedCompartmentId, setSelectedCompartmentId] = useState<
    string | null
  >(null);
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [maintenanceSubmitted, setMaintenanceSubmitted] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [emergencySubmitted, setEmergencySubmitted] = useState(false);

  const drawerState = useOverlayState();
  const maintenanceState = useOverlayState();
  const restoreState = useOverlayState();
  const emergencyState = useOverlayState();
  const historyState = useOverlayState();

  const selectedLocker = LOCKERS.find((locker) => locker.id === lockerId);
  const selectedCompartment = compartments.find(
    (compartment) => compartment.id === selectedCompartmentId,
  );
  const filteredCompartments = compartments.filter((compartment) => {
    if (compartmentFilter === 'all') return true;
    if (compartmentFilter === 'parcel') return Boolean(compartment.parcelId);
    if (compartmentFilter === 'maintenance') {
      return compartment.status === 'maintenance';
    }

    return compartment.status === 'active' && !compartment.parcelId;
  });

  useEffect(() => {
    if (!selectedLocker) return;

    setCompartments(createCompartments(selectedLocker.compartmentCount));
    setCompartmentFilter('all');
    setSelectedCompartmentId(null);
  }, [lockerId]);

  if (!selectedLocker) {
    return <Navigate replace to="/operator/lockers" />;
  }

  const openCompartment = (compartment: Compartment) => {
    setSelectedCompartmentId(compartment.id);
    drawerState.open();
  };

  const updateCompartmentStatus = (status: CompartmentStatus) => {
    if (!selectedCompartmentId) return;

    setCompartments((current) =>
      current.map((compartment) =>
        compartment.id === selectedCompartmentId
          ? { ...compartment, status }
          : compartment,
      ),
    );
  };

  const confirmMaintenance = () => {
    setMaintenanceSubmitted(true);
    if (maintenanceReason.trim().length < 5) return;

    updateCompartmentStatus('maintenance');
    maintenanceState.close();
    setMaintenanceReason('');
    setMaintenanceSubmitted(false);
    toast.success('Đã đưa ngăn vào bảo trì', {
      description: `${selectedCompartmentId} đã ngừng nhận bưu kiện mới.`,
      indicator: <CircleCheck aria-hidden="true" className="size-5" />,
    });
  };

  const confirmRestore = () => {
    updateCompartmentStatus('active');
    restoreState.close();
    toast.success('Đã khôi phục hoạt động', {
      description: `${selectedCompartmentId} đã sẵn sàng nhận bưu kiện.`,
      indicator: <CircleCheck aria-hidden="true" className="size-5" />,
    });
  };

  const confirmEmergencyOpen = () => {
    setEmergencySubmitted(true);
    if (
      selectedLocker.connection !== 'online' ||
      emergencyReason.trim().length < 5
    ) {
      return;
    }

    emergencyState.close();
    setEmergencyReason('');
    setEmergencySubmitted(false);
    toast.warning('Đã gửi lệnh mở khẩn cấp', {
      description: `Lệnh mở ${selectedCompartmentId} đã được ghi vào nhật ký.`,
      indicator: <TriangleExclamation aria-hidden="true" className="size-5" />,
    });
  };

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <Typography type="h3">{selectedLocker.name}</Typography>
        <ConnectionChip value={selectedLocker.connection} />
      </div>

      <section>
        <Typography className="mb-3" type="h5">
          Thông tin tủ
        </Typography>
        <dl className="grid gap-x-10 lg:grid-cols-2">
          <DetailRow label="Mã tủ">{selectedLocker.id}</DetailRow>
          <DetailRow label="Tên tủ">{selectedLocker.name}</DetailRow>
          <DetailRow label="Địa chỉ">{selectedLocker.address}</DetailRow>
          <DetailRow label="Địa chỉ lưu hàng quá hạn">
            Tầng 1, khu lễ tân, cạnh phòng bảo vệ
          </DetailRow>
          <DetailRow label="Tổng số ngăn">
            {selectedLocker.compartmentCount} ngăn
          </DetailRow>
          <DetailRow label="Kết nối">
            <ConnectionChip value={selectedLocker.connection} />
          </DetailRow>
          <DetailRow label="Tình trạng">
            <Chip
              color={
                selectedLocker.condition === 'normal' ? 'success' : 'warning'
              }
              size="sm"
              variant="soft"
            >
              {selectedLocker.condition === 'normal' ? 'Bình thường' : 'Có lỗi'}
            </Chip>
          </DetailRow>
        </dl>
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
                <ListBox.Item id="all" textValue="Tất cả trạng thái">
                  Tất cả trạng thái
                </ListBox.Item>
                <ListBox.Item id="active" textValue="Hoạt động">
                  Hoạt động
                </ListBox.Item>
                <ListBox.Item id="parcel" textValue="Có bưu kiện">
                  Có bưu kiện
                </ListBox.Item>
                <ListBox.Item id="maintenance" textValue="Đang bảo trì">
                  Đang bảo trì
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {filteredCompartments.map((compartment) => (
            <Button
              key={compartment.id}
              fullWidth
              className="h-auto min-h-24 flex-col items-stretch justify-between gap-3 bg-white p-4 text-left"
              variant="outline"
              onPress={() => openCompartment(compartment)}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="font-semibold">{compartment.id}</span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 text-muted"
                />
              </span>
              <span className="flex w-full flex-col items-start gap-2">
                <CompartmentChip compartment={compartment} />
                <span className="text-xs font-normal text-muted">
                  {compartment.parcelId ?? 'Trống'}
                </span>
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
                        {selectedCompartment.id}
                      </DetailRow>
                      <DetailRow label="Trạng thái">
                        <CompartmentChip compartment={selectedCompartment} />
                      </DetailRow>
                      <DetailRow label="Trạng thái cửa">
                        {selectedCompartment.door === 'closed'
                          ? 'Đã đóng'
                          : 'Đang mở'}
                      </DetailRow>
                      <DetailRow label="Bưu kiện hiện tại">
                        {selectedCompartment.parcelId ?? 'Không có'}
                      </DetailRow>
                      <DetailRow label="Thời gian gửi vào">
                        {selectedCompartment.checkedInAt ?? '—'}
                      </DetailRow>
                      <DetailRow label="Tủ liên quan">
                        {selectedLocker.id} · {selectedLocker.name}
                      </DetailRow>
                    </dl>

                    <Separator />

                    <div>
                      <Typography className="mb-3" type="h6">
                        Thao tác
                      </Typography>
                      <div className="space-y-3">
                        <Button
                          fullWidth
                          isDisabled={
                            selectedCompartment.status === 'maintenance'
                          }
                          variant="secondary"
                          onPress={() => {
                            setMaintenanceReason('');
                            setMaintenanceSubmitted(false);
                            maintenanceState.open();
                          }}
                        >
                          <Wrench aria-hidden="true" className="size-5" />
                          Đưa vào bảo trì
                        </Button>
                        <Button
                          fullWidth
                          isDisabled={
                            selectedCompartment.status !== 'maintenance'
                          }
                          variant="primary"
                          onPress={restoreState.open}
                        >
                          <CircleCheck aria-hidden="true" className="size-5" />
                          Khôi phục hoạt động
                        </Button>
                        <Button
                          fullWidth
                          variant="danger"
                          onPress={() => {
                            setEmergencyReason('');
                            setEmergencySubmitted(false);
                            emergencyState.open();
                          }}
                        >
                          <LockOpen aria-hidden="true" className="size-5" />
                          Mở khẩn cấp
                        </Button>
                        <Button
                          fullWidth
                          variant="ghost"
                          onPress={historyState.open}
                        >
                          <ClockArrowRotateLeft
                            aria-hidden="true"
                            className="size-5"
                          />
                          Xem nhật ký
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

      <Modal state={maintenanceState}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label="Đóng biểu mẫu bảo trì">
                <Xmark aria-hidden="true" className="size-5" />
              </Modal.CloseTrigger>
              <Modal.Header>
                <Modal.Icon>
                  <Wrench aria-hidden="true" className="size-5" />
                </Modal.Icon>
                <Modal.Heading>Đưa vào bảo trì</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <TextField
                  fullWidth
                  isInvalid={
                    maintenanceSubmitted && maintenanceReason.trim().length < 5
                  }
                  isRequired
                  value={maintenanceReason}
                  onChange={setMaintenanceReason}
                >
                  <Label>Lý do bảo trì</Label>
                  <TextArea
                    minLength={5}
                    placeholder="Nhập lý do bảo trì..."
                    rows={4}
                  />
                  <FieldError>Vui lòng nhập ít nhất 5 ký tự.</FieldError>
                </TextField>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="ghost">
                  Hủy
                </Button>
                <Button variant="primary" onPress={confirmMaintenance}>
                  Xác nhận
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <AlertDialog>
        <AlertDialog.Backdrop
          isOpen={restoreState.isOpen}
          onOpenChange={restoreState.setOpen}
        >
          <AlertDialog.Container size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning">
                  <CircleExclamation aria-hidden="true" className="size-6" />
                </AlertDialog.Icon>
                <AlertDialog.Heading>Khôi phục hoạt động</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                Hãy xác nhận ngăn {selectedCompartmentId} đã an toàn và có thể
                tiếp tục nhận bưu kiện.
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="ghost">
                  Chưa an toàn
                </Button>
                <Button variant="primary" onPress={confirmRestore}>
                  Đã an toàn
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

      <AlertDialog>
        <AlertDialog.Backdrop
          isOpen={emergencyState.isOpen}
          onOpenChange={emergencyState.setOpen}
        >
          <AlertDialog.Container size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger">
                  <TriangleExclamation aria-hidden="true" className="size-6" />
                </AlertDialog.Icon>
                <AlertDialog.Heading>Mở khẩn cấp</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium">Kết nối của tủ</span>
                  <ConnectionChip value={selectedLocker.connection} />
                </div>
                {selectedLocker.connection === 'offline' ? (
                  <Alert status="danger">
                    <Alert.Indicator>
                      <CircleExclamation
                        aria-hidden="true"
                        className="size-5"
                      />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Title>Không thể gửi lệnh mở</Alert.Title>
                      <Alert.Description>
                        Tủ đang ngoại tuyến. Hãy kiểm tra kết nối tại chỗ.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                ) : null}
                <TextField
                  fullWidth
                  isInvalid={
                    emergencySubmitted && emergencyReason.trim().length < 5
                  }
                  isRequired
                  value={emergencyReason}
                  onChange={setEmergencyReason}
                >
                  <Label>Lý do mở khẩn cấp</Label>
                  <TextArea
                    minLength={5}
                    placeholder="Nhập lý do mở khẩn cấp..."
                    rows={4}
                  />
                  <FieldError>Vui lòng nhập ít nhất 5 ký tự.</FieldError>
                </TextField>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="ghost">
                  Hủy
                </Button>
                <Button
                  isDisabled={selectedLocker.connection === 'offline'}
                  variant="danger"
                  onPress={confirmEmergencyOpen}
                >
                  <LockOpen aria-hidden="true" className="size-5" />
                  Xác nhận mở
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

      <Modal state={historyState}>
        <Modal.Backdrop>
          <Modal.Container size="lg">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label="Đóng nhật ký ngăn">
                <Xmark aria-hidden="true" className="size-5" />
              </Modal.CloseTrigger>
              <Modal.Header>
                <Modal.Icon>
                  <ClockArrowRotateLeft aria-hidden="true" className="size-5" />
                </Modal.Icon>
                <Modal.Heading>
                  Nhật ký ngăn {selectedCompartmentId}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content
                      aria-label={`Nhật ký ngăn ${selectedCompartmentId}`}
                    >
                      <Table.Header>
                        <Table.Column id="time" isRowHeader>
                          Thời gian
                        </Table.Column>
                        <Table.Column id="action">Thao tác</Table.Column>
                        <Table.Column id="actor">Người thực hiện</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        <Table.Row id="log-1">
                          <Table.Cell>14/03/2026 10:30</Table.Cell>
                          <Table.Cell>Gửi bưu kiện vào ngăn</Table.Cell>
                          <Table.Cell>Hệ thống</Table.Cell>
                        </Table.Row>
                        <Table.Row id="log-2">
                          <Table.Cell>13/03/2026 16:05</Table.Cell>
                          <Table.Cell>Kiểm tra trạng thái cửa</Table.Cell>
                          <Table.Cell>operator</Table.Cell>
                        </Table.Row>
                        <Table.Row id="log-3">
                          <Table.Cell>12/03/2026 08:45</Table.Cell>
                          <Table.Cell>Khôi phục hoạt động</Table.Cell>
                          <Table.Cell>operator</Table.Cell>
                        </Table.Row>
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
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
