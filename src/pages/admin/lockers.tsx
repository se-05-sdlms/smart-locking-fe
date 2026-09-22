import type { FormEvent } from 'react';

import { useMemo, useState } from 'react';
import {
  AlertDialog,
  Button,
  Card,
  Chip,
  Drawer,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Pagination,
  SearchField,
  Select,
  Separator,
  Table,
  TextField,
  toast,
  useOverlayState,
} from '@heroui/react';
import ChevronDown from '@gravity-ui/icons/ChevronDown';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CirclePlus from '@gravity-ui/icons/CirclePlus';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Pencil from '@gravity-ui/icons/Pencil';
import PersonWorker from '@gravity-ui/icons/PersonWorker';
import TrashBin from '@gravity-ui/icons/TrashBin';
import Xmark from '@gravity-ui/icons/Xmark';

import type { AdminLocker, AdminLockerStatus } from './admin-data';
import { ADMIN_LOCKERS, OPERATORS } from './admin-data';

const PAGE_SIZE = 5;

const EMPTY_LOCKER: AdminLocker = {
  id: '',
  name: '',
  address: '',
  recoveryAddress: '',
  deviceId: '',
  compartmentCount: 24,
  connection: 'online',
  status: 'active',
  operator: null,
  occupied: 0,
};

function StatusChip({ status }: { status: AdminLockerStatus }) {
  if (status === 'maintenance')
    return (
      <Chip color="warning" size="sm" variant="soft">
        Bảo trì
      </Chip>
    );
  if (status === 'suspended')
    return (
      <Chip color="danger" size="sm" variant="soft">
        Tạm ngưng
      </Chip>
    );
  return (
    <Chip color="success" size="sm" variant="soft">
      Hoạt động
    </Chip>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 font-medium">{value}</dd>
    </div>
  );
}

export default function AdminLockersPage() {
  const [lockers, setLockers] = useState(ADMIN_LOCKERS);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'all' | AdminLockerStatus | 'offline'>(
    'all',
  );
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AdminLocker>(EMPTY_LOCKER);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const detailState = useOverlayState();
  const formState = useOverlayState();
  const deleteState = useOverlayState();

  const selectedLocker =
    lockers.find((locker) => locker.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase('vi');
    return lockers.filter(
      (locker) =>
        (!query ||
          [locker.id, locker.name, locker.address].some((value) =>
            value.toLocaleLowerCase('vi').includes(query),
          )) &&
        (status === 'all' ||
          (status === 'offline'
            ? locker.connection === 'offline'
            : locker.status === status)),
    );
  }, [keyword, lockers, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleLockers = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const openDetails = (locker: AdminLocker) => {
    setSelectedId(locker.id);
    detailState.open();
  };
  const openCreate = () => {
    setFormMode('create');
    setDraft({
      ...EMPTY_LOCKER,
      id: `LK-${String(lockers.length + 1).padStart(2, '0')}`,
      deviceId: `DEV-LK-${String(lockers.length + 1).padStart(3, '0')}`,
    });
    formState.open();
  };
  const openEdit = (locker: AdminLocker) => {
    setFormMode('edit');
    setDraft({ ...locker });
    formState.open();
  };
  const saveLocker = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formMode === 'create') setLockers((current) => [...current, draft]);
    else
      setLockers((current) =>
        current.map((locker) => (locker.id === draft.id ? draft : locker)),
      );
    setSelectedId(draft.id);
    formState.close();
    toast.success(
      formMode === 'create' ? 'Đã thêm locker' : 'Đã cập nhật locker',
      { indicator: <CircleCheck className="size-5" /> },
    );
  };
  const deleteLocker = () => {
    if (!selectedLocker) return;
    setLockers((current) =>
      current.filter((locker) => locker.id !== selectedLocker.id),
    );
    deleteState.close();
    detailState.close();
    setSelectedId(null);
    toast.success('Đã vô hiệu hóa locker');
  };

  return (
    <section className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchField
          fullWidth
          aria-label="Tìm locker"
          className="lg:max-w-md"
          value={keyword}
          variant="secondary"
          onChange={(value) => {
            setKeyword(value);
            setPage(1);
          }}
        >
          <SearchField.Group>
            <SearchField.SearchIcon>
              <Magnifier className="size-4" />
            </SearchField.SearchIcon>
            <SearchField.Input placeholder="Mã tủ, tên hoặc địa chỉ" />
            <SearchField.ClearButton aria-label="Xóa tìm kiếm">
              <Xmark className="size-4" />
            </SearchField.ClearButton>
          </SearchField.Group>
        </SearchField>
        <Select
          aria-label="Lọc trạng thái"
          className="w-full lg:w-56"
          value={status}
          variant="secondary"
          onChange={(value) => {
            setStatus(value as typeof status);
            setPage(1);
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator>
              <ChevronDown className="size-4" />
            </Select.Indicator>
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="all">Tất cả trạng thái</ListBox.Item>
              <ListBox.Item id="active">Hoạt động</ListBox.Item>
              <ListBox.Item id="maintenance">Bảo trì</ListBox.Item>
              <ListBox.Item id="suspended">Tạm ngưng</ListBox.Item>
              <ListBox.Item id="offline">Offline</ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
        <Button className="lg:ml-auto" variant="primary" onPress={openCreate}>
          <CirclePlus className="size-4" />
          Thêm locker
        </Button>
      </div>

      <Card>
        <Card.Header className="flex-row items-center justify-between">
          <Card.Title>Danh sách locker</Card.Title>
          <span className="text-sm text-muted">{filtered.length} tủ</span>
        </Card.Header>
        <Card.Content className="px-0 pb-0">
          <Table>
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Danh sách locker hệ thống"
                onRowAction={(key) => {
                  const locker = lockers.find(
                    (item) => item.id === String(key),
                  );
                  if (locker) openDetails(locker);
                }}
              >
                <Table.Header>
                  <Table.Column id="code" isRowHeader>
                    Mã tủ
                  </Table.Column>
                  <Table.Column id="name">Tên tủ</Table.Column>
                  <Table.Column id="address">Địa chỉ</Table.Column>
                  <Table.Column id="compartments">Số ngăn</Table.Column>
                  <Table.Column id="operator">Operator</Table.Column>
                  <Table.Column id="connection">Kết nối</Table.Column>
                  <Table.Column id="status">Vận hành</Table.Column>
                  <Table.Column id="action">Thao tác</Table.Column>
                </Table.Header>
                <Table.Body>
                  {visibleLockers.map((locker) => (
                    <Table.Row key={locker.id} id={locker.id}>
                      <Table.Cell>
                        <strong>{locker.id}</strong>
                      </Table.Cell>
                      <Table.Cell>{locker.name}</Table.Cell>
                      <Table.Cell>
                        <span className="block max-w-72 text-wrap">
                          {locker.address}
                        </span>
                      </Table.Cell>
                      <Table.Cell>{locker.compartmentCount}</Table.Cell>
                      <Table.Cell>
                        {locker.operator ?? (
                          <span className="text-warning">Chưa phân công</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Chip
                          color={
                            locker.connection === 'online'
                              ? 'success'
                              : 'danger'
                          }
                          size="sm"
                          variant="soft"
                        >
                          {locker.connection === 'online'
                            ? 'Online'
                            : 'Offline'}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <StatusChip status={locker.status} />
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onPress={() => openDetails(locker)}
                          >
                            Chi tiết
                          </Button>
                          <Button
                            isIconOnly
                            aria-label={`Sửa ${locker.id}`}
                            size="sm"
                            variant="ghost"
                            onPress={() => openEdit(locker)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
            <Table.Footer className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted">
                Hiển thị {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, filtered.length)}
              </span>
              <Pagination size="sm">
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.Previous
                      isDisabled={page === 1}
                      onPress={() => setPage(page - 1)}
                    >
                      <Pagination.PreviousIcon />
                    </Pagination.Previous>
                  </Pagination.Item>
                  <Pagination.Item>
                    <Pagination.Link isActive>
                      {page}/{totalPages}
                    </Pagination.Link>
                  </Pagination.Item>
                  <Pagination.Item>
                    <Pagination.Next
                      isDisabled={page === totalPages}
                      onPress={() => setPage(page + 1)}
                    >
                      <Pagination.NextIcon />
                    </Pagination.Next>
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            </Table.Footer>
          </Table>
        </Card.Content>
      </Card>

      <Drawer state={detailState}>
        <Drawer.Backdrop>
          <Drawer.Content placement="right">
            <Drawer.Dialog className="w-full sm:w-[30rem]">
              <Drawer.CloseTrigger aria-label="Đóng chi tiết">
                <Xmark className="size-5" />
              </Drawer.CloseTrigger>
              <Drawer.Header>
                <Drawer.Heading>
                  {selectedLocker?.id ?? 'Chi tiết locker'}
                </Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body>
                {selectedLocker ? (
                  <div className="space-y-6">
                    <div className="flex flex-wrap gap-2">
                      <StatusChip status={selectedLocker.status} />
                      <Chip
                        color={
                          selectedLocker.connection === 'online'
                            ? 'success'
                            : 'danger'
                        }
                        size="sm"
                        variant="soft"
                      >
                        {selectedLocker.connection === 'online'
                          ? 'Online'
                          : 'Offline'}
                      </Chip>
                    </div>
                    <dl>
                      <DetailRow label="Tên tủ" value={selectedLocker.name} />
                      <DetailRow
                        label="Địa chỉ"
                        value={selectedLocker.address}
                      />
                      <DetailRow
                        label="Địa chỉ thu hồi"
                        value={selectedLocker.recoveryAddress}
                      />
                      <DetailRow
                        label="Device ID"
                        value={selectedLocker.deviceId}
                      />
                      <DetailRow
                        label="Operator"
                        value={selectedLocker.operator ?? 'Chưa phân công'}
                      />
                      <DetailRow
                        label="Số ngăn"
                        value={selectedLocker.compartmentCount}
                      />
                    </dl>
                    <Separator />
                    <div>
                      <h3 className="mb-3 font-semibold">Danh sách ngăn</h3>
                      <div className="grid grid-cols-4 gap-2">
                        {Array.from(
                          {
                            length: Math.min(
                              selectedLocker.compartmentCount,
                              24,
                            ),
                          },
                          (_, index) => {
                            const occupied = index < selectedLocker.occupied;
                            return (
                              <Chip
                                key={index}
                                color={occupied ? 'accent' : 'default'}
                                variant="soft"
                              >
                                N{String(index + 1).padStart(2, '0')}
                              </Chip>
                            );
                          },
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </Drawer.Body>
              <Drawer.Footer>
                <Button variant="danger" onPress={deleteState.open}>
                  <TrashBin className="size-4" />
                  Vô hiệu hóa
                </Button>
                <Button
                  variant="primary"
                  onPress={() => selectedLocker && openEdit(selectedLocker)}
                >
                  <Pencil className="size-4" />
                  Chỉnh sửa
                </Button>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

      <Modal state={formState}>
        <Modal.Backdrop>
          <Modal.Container scroll="inside" size="lg">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label="Đóng biểu mẫu">
                <Xmark className="size-5" />
              </Modal.CloseTrigger>
              <Modal.Header>
                <Modal.Heading>
                  {formMode === 'create'
                    ? 'Thêm locker'
                    : `Chỉnh sửa ${draft.id}`}
                </Modal.Heading>
              </Modal.Header>
              <Form onSubmit={saveLocker}>
                <Modal.Body>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <TextField
                      isRequired
                      value={draft.id}
                      onChange={(value) => setDraft({ ...draft, id: value })}
                    >
                      <Label>Mã tủ</Label>
                      <Input fullWidth />
                    </TextField>
                    <TextField
                      isRequired
                      value={draft.name}
                      onChange={(value) => setDraft({ ...draft, name: value })}
                    >
                      <Label>Tên tủ</Label>
                      <Input fullWidth />
                    </TextField>
                    <TextField
                      isRequired
                      className="sm:col-span-2"
                      value={draft.address}
                      onChange={(value) =>
                        setDraft({ ...draft, address: value })
                      }
                    >
                      <Label>Địa chỉ</Label>
                      <Input fullWidth />
                    </TextField>
                    <TextField
                      isRequired
                      className="sm:col-span-2"
                      value={draft.recoveryAddress}
                      onChange={(value) =>
                        setDraft({ ...draft, recoveryAddress: value })
                      }
                    >
                      <Label>Địa chỉ thu hồi</Label>
                      <Input fullWidth />
                    </TextField>
                    <TextField
                      isRequired
                      value={draft.deviceId}
                      onChange={(value) =>
                        setDraft({ ...draft, deviceId: value })
                      }
                    >
                      <Label>Device ID</Label>
                      <Input fullWidth />
                    </TextField>
                    <TextField
                      isRequired
                      type="number"
                      value={String(draft.compartmentCount)}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          compartmentCount: Number(value) || 1,
                        })
                      }
                    >
                      <Label>Số ngăn</Label>
                      <Input fullWidth />
                    </TextField>
                    <Select
                      aria-label="Trạng thái vận hành"
                      value={draft.status}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          status: value as AdminLockerStatus,
                        })
                      }
                    >
                      <Label>Trạng thái</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="active">Hoạt động</ListBox.Item>
                          <ListBox.Item id="maintenance">Bảo trì</ListBox.Item>
                          <ListBox.Item id="suspended">Tạm ngưng</ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <Select
                      aria-label="Operator phụ trách"
                      value={draft.operator ?? 'none'}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          operator: value === 'none' ? null : String(value),
                        })
                      }
                    >
                      <Label>Operator phụ trách</Label>
                      <Select.Trigger>
                        <PersonWorker className="size-4" />
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="none">Chưa phân công</ListBox.Item>
                          {OPERATORS.map((operator) => (
                            <ListBox.Item key={operator} id={operator}>
                              {operator}
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" variant="danger">
                    Hủy
                  </Button>
                  <Button type="submit" variant="primary">
                    {formMode === 'create' ? 'Thêm locker' : 'Lưu thay đổi'}
                  </Button>
                </Modal.Footer>
              </Form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <AlertDialog>
        <AlertDialog.Backdrop
          isOpen={deleteState.isOpen}
          onOpenChange={deleteState.setOpen}
        >
          <AlertDialog.Container size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>
                  Vô hiệu hóa {selectedLocker?.id}?
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                Locker sẽ bị gỡ khỏi danh sách vận hành.
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="ghost">
                  Hủy
                </Button>
                <Button variant="danger" onPress={deleteLocker}>
                  Xác nhận
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </section>
  );
}
