import type {
  AdminLocker,
  AdminLockerDetail,
  AdminLockerFilter,
} from '@/types/admin-locker';

import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Chip,
  ListBox,
  Pagination,
  SearchField,
  Select,
  Skeleton,
  Table,
} from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import ChevronDown from '@gravity-ui/icons/ChevronDown';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import CircleInfo from '@gravity-ui/icons/CircleInfo';
import CirclePlus from '@gravity-ui/icons/CirclePlus';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Pencil from '@gravity-ui/icons/Pencil';
import Xmark from '@gravity-ui/icons/Xmark';

import { LockerDetailDrawer } from '@/components/admin/lockers/locker-detail-drawer';
import { LockerFormModal } from '@/components/admin/lockers/locker-form-modal';
import {
  ADMIN_CONNECTION_STATUS_DISPLAY,
  ADMIN_LOCKER_FILTER_OPTIONS,
  ADMIN_LOCKER_PAGE_SIZE,
  ADMIN_OPERATIONAL_STATUS_DISPLAY,
} from '@/constants/admin-locker';
import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  filterAdminLockers,
  getAdminLockerErrorMessage,
  listAdminLockers,
} from '@/services/admin-locker-service';

type FormState = { key: number; locker?: AdminLocker };

export default function AdminLockersPage() {
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<AdminLockerFilter>('all');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const { state, reload, refresh } = useAsyncResource(
    listAdminLockers,
    getAdminLockerErrorMessage,
    [],
  );

  const lockers = useMemo(() => state.data ?? [], [state.data]);
  const filtered = useMemo(
    () => filterAdminLockers(lockers, keyword, filter),
    [filter, keyword, lockers],
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / ADMIN_LOCKER_PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (currentPage - 1) * ADMIN_LOCKER_PAGE_SIZE,
    currentPage * ADMIN_LOCKER_PAGE_SIZE,
  );

  const openDetail = (lockerId: string) => {
    setDetailId(lockerId);
    setIsDetailOpen(true);
  };
  const openCreate = () => setForm({ key: Date.now() });
  const openEdit = (locker: AdminLocker) =>
    setForm({ key: Date.now(), locker });
  const handleSaved = (saved: AdminLockerDetail) => {
    refresh();
    // Keep the drawer in sync with the saved locker.
    setDetailId(saved.id);
  };

  const renderTable = () => {
    if (state.status === 'loading' && !state.data) {
      return (
        <div
          aria-busy="true"
          aria-label="Đang tải danh sách tủ"
          className="space-y-2 p-4"
        >
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      );
    }

    if (state.status === 'error' && !state.data) {
      return (
        <div className="p-4">
          <Alert role="alert" status="danger">
            <Alert.Indicator>
              <CircleExclamation aria-hidden="true" className="size-5" />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Description>{state.message}</Alert.Description>
            </Alert.Content>
            <Button size="sm" variant="secondary" onPress={reload}>
              <ArrowRotateRight aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          </Alert>
        </div>
      );
    }

    if (!visible.length) {
      return (
        <div className="p-4">
          <Alert status="default">
            <Alert.Indicator>
              <CircleInfo aria-hidden="true" className="size-5" />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>
                {lockers.length ? 'Không tìm thấy tủ' : 'Chưa có tủ nào'}
              </Alert.Title>
              <Alert.Description>
                {lockers.length
                  ? 'Hãy thử đổi từ khóa hoặc bộ lọc trạng thái.'
                  : 'Bấm "Thêm tủ" để đăng ký tủ đầu tiên.'}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        </div>
      );
    }

    return (
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Danh sách tủ trong hệ thống">
            <Table.Header>
              <Table.Column isRowHeader id="code">
                Mã tủ
              </Table.Column>
              <Table.Column id="address">Địa chỉ / Điểm tập kết</Table.Column>
              <Table.Column id="device">Mã thiết bị</Table.Column>
              <Table.Column id="compartments">Ngăn vận hành</Table.Column>
              <Table.Column id="connection">Kết nối</Table.Column>
              <Table.Column id="status">Vận hành</Table.Column>
              <Table.Column id="action">Thao tác</Table.Column>
            </Table.Header>
            <Table.Body>
              {visible.map((locker) => (
                <Table.Row key={locker.id} id={locker.id}>
                  <Table.Cell>
                    <strong>{locker.code}</strong>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="block max-w-80 text-wrap">
                      {locker.address}
                    </span>
                    <span className="block max-w-80 text-wrap text-xs text-muted">
                      Tập kết: {locker.recoveryAddress}
                    </span>
                  </Table.Cell>
                  <Table.Cell>{locker.deviceIdentifier}</Table.Cell>
                  <Table.Cell>
                    {locker.activeCompartments}/{locker.totalCompartments}
                  </Table.Cell>
                  <Table.Cell>
                    <Chip
                      color={
                        ADMIN_CONNECTION_STATUS_DISPLAY[locker.connectionStatus]
                          .color
                      }
                      size="sm"
                      variant="soft"
                    >
                      {
                        ADMIN_CONNECTION_STATUS_DISPLAY[locker.connectionStatus]
                          .label
                      }
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>
                    <Chip
                      color={
                        ADMIN_OPERATIONAL_STATUS_DISPLAY[
                          locker.operationalStatus
                        ].color
                      }
                      size="sm"
                      variant="soft"
                    >
                      {
                        ADMIN_OPERATIONAL_STATUS_DISPLAY[
                          locker.operationalStatus
                        ].label
                      }
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-1">
                      <Button
                        aria-label={`Xem chi tiết tủ ${locker.code}`}
                        size="sm"
                        variant="ghost"
                        onPress={() => openDetail(locker.id)}
                      >
                        Chi tiết
                      </Button>
                      <Button
                        isIconOnly
                        aria-label={`Chỉnh sửa tủ ${locker.code}`}
                        size="sm"
                        variant="ghost"
                        onPress={() => openEdit(locker)}
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
        {filtered.length > ADMIN_LOCKER_PAGE_SIZE ? (
          <Table.Footer className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted">
              Hiển thị {(currentPage - 1) * ADMIN_LOCKER_PAGE_SIZE + 1}–
              {Math.min(currentPage * ADMIN_LOCKER_PAGE_SIZE, filtered.length)}{' '}
              / {filtered.length}
            </span>
            <Pagination aria-label="Phân trang danh sách tủ" size="sm">
              <Pagination.Content>
                <Pagination.Item>
                  <Pagination.Previous
                    aria-label="Trang trước"
                    isDisabled={currentPage === 1}
                    onPress={() => setPage(currentPage - 1)}
                  >
                    <Pagination.PreviousIcon />
                  </Pagination.Previous>
                </Pagination.Item>
                <Pagination.Item>
                  <Pagination.Link isActive>
                    {currentPage}/{totalPages}
                  </Pagination.Link>
                </Pagination.Item>
                <Pagination.Item>
                  <Pagination.Next
                    aria-label="Trang sau"
                    isDisabled={currentPage === totalPages}
                    onPress={() => setPage(currentPage + 1)}
                  >
                    <Pagination.NextIcon />
                  </Pagination.Next>
                </Pagination.Item>
              </Pagination.Content>
            </Pagination>
          </Table.Footer>
        ) : null}
      </Table>
    );
  };

  return (
    <section className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchField
          fullWidth
          aria-label="Tìm tủ theo mã, địa chỉ hoặc mã thiết bị"
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
              <Magnifier aria-hidden="true" className="size-4" />
            </SearchField.SearchIcon>
            <SearchField.Input placeholder="Mã tủ, địa chỉ hoặc mã thiết bị" />
            <SearchField.ClearButton aria-label="Xóa từ khóa">
              <Xmark aria-hidden="true" className="size-4" />
            </SearchField.ClearButton>
          </SearchField.Group>
        </SearchField>
        <Select
          aria-label="Lọc theo trạng thái"
          className="w-full lg:w-56"
          value={filter}
          variant="secondary"
          onChange={(value) => {
            setFilter(value as AdminLockerFilter);
            setPage(1);
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator>
              <ChevronDown aria-hidden="true" className="size-4" />
            </Select.Indicator>
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {ADMIN_LOCKER_FILTER_OPTIONS.map((option) => (
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
        <div className="flex gap-2 lg:ml-auto">
          <Button
            isDisabled={state.status === 'loading'}
            variant="secondary"
            onPress={refresh}
          >
            <ArrowRotateRight aria-hidden="true" className="size-4" />
            Làm mới
          </Button>
          <Button variant="primary" onPress={openCreate}>
            <CirclePlus aria-hidden="true" className="size-4" />
            Thêm tủ
          </Button>
        </div>
      </div>

      {state.status === 'error' && state.data ? (
        <Alert role="alert" status="danger">
          <Alert.Indicator>
            <CircleExclamation aria-hidden="true" className="size-5" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Description>{state.message}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <Card>
        <Card.Header className="flex-row items-center justify-between">
          <Card.Title>Danh sách tủ</Card.Title>
          <span className="text-sm text-muted">{filtered.length} tủ</span>
        </Card.Header>
        <Card.Content className="px-0 pb-0">{renderTable()}</Card.Content>
      </Card>

      {detailId ? (
        <LockerDetailDrawer
          key={detailId}
          isOpen={isDetailOpen}
          lockerId={detailId}
          onChanged={refresh}
          onEdit={openEdit}
          onOpenChange={setIsDetailOpen}
        />
      ) : null}

      {form ? (
        <LockerFormModal
          key={form.key}
          isOpen
          locker={form.locker}
          onOpenChange={(open) => {
            if (!open) setForm(null);
          }}
          onSaved={(saved) => {
            handleSaved(saved);
            if (form.locker) setIsDetailOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}
