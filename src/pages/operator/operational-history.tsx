import type {
  OperationalRecord,
  OperationalRecordFilters,
} from '@/types/operational-record';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Input,
  Label,
  ListBox,
  Modal,
  Pagination,
  SearchField,
  Select,
  Skeleton,
  Table,
  TextField,
  useOverlayState,
} from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import ChevronDown from '@gravity-ui/icons/ChevronDown';
import ChevronLeft from '@gravity-ui/icons/ChevronLeft';
import ChevronRight from '@gravity-ui/icons/ChevronRight';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import CircleInfo from '@gravity-ui/icons/CircleInfo';
import ClockArrowRotateLeft from '@gravity-ui/icons/ClockArrowRotateLeft';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Xmark from '@gravity-ui/icons/Xmark';

import {
  formatOperationalRecordKind,
  formatOperationalRecordStatus,
  OPERATIONAL_RECORD_KIND_FILTERS,
} from '@/constants/operational-record';
import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  formatRecordDateTime,
  getOperationalRecordDetail,
  getOperationalRecordErrorMessage,
  OPERATIONAL_HISTORY_PAGE_SIZE,
  searchOperationalRecords,
  toDetailRows,
  validateDateRange,
} from '@/services/operational-record-service';
import { listAssignedLockers } from '@/services/operator-locker-service';

const SEARCH_DEBOUNCE_MS = 350;

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

function RecordDetail({ record }: { record: OperationalRecord }) {
  const load = useCallback(
    (signal: AbortSignal) =>
      getOperationalRecordDetail(record.kind, record.id, signal),
    [record.id, record.kind],
  );
  const { state, reload } = useAsyncResource(
    load,
    getOperationalRecordErrorMessage,
    [record.id, record.kind],
  );

  if (state.status === 'loading') {
    return (
      <div
        aria-busy="true"
        aria-label="Đang tải chi tiết"
        className="space-y-2"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (state.status === 'error') {
    return <ErrorAlert message={state.message} onRetry={reload} />;
  }

  const detail = state.data;
  const rows = toDetailRows(detail.details);

  return (
    <dl className="divide-y divide-border">
      {[
        { label: 'Loại', value: formatOperationalRecordKind(detail.kind) },
        {
          label: 'Trạng thái',
          value: formatOperationalRecordStatus(detail.kind, detail.status),
        },
        { label: 'Mã', value: detail.code },
        { label: 'Tủ', value: detail.lockerCode },
        { label: 'Thời gian', value: formatRecordDateTime(detail.occurredAt) },
        ...rows,
      ].map((row) => (
        <div
          key={row.label + row.value}
          className="grid gap-1 py-2 sm:grid-cols-[10rem_1fr] sm:gap-4"
        >
          <dt className="text-sm text-muted">{row.label}</dt>
          <dd className="min-w-0 whitespace-pre-wrap break-words text-sm font-medium">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function OperatorOperationalHistoryPage() {
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<OperationalRecordFilters>({
    query: '',
    lockerId: 'all',
    kind: 'all',
    fromDate: '',
    toDate: '',
    pageNumber: 1,
    pageSize: OPERATIONAL_HISTORY_PAGE_SIZE,
  });
  const [selected, setSelected] = useState<OperationalRecord | null>(null);
  const detailState = useOverlayState();

  // Debounce the keyword so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) =>
        current.query === searchInput
          ? current
          : { ...current, query: searchInput, pageNumber: 1 },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const updateFilter = (patch: Partial<OperationalRecordFilters>) =>
    setFilters((current) => ({ ...current, ...patch, pageNumber: 1 }));

  const dateError = validateDateRange(filters.fromDate, filters.toDate);
  const filterKey = JSON.stringify(filters);
  const load = useCallback(
    (signal: AbortSignal) =>
      dateError
        ? Promise.reject(new Error(dateError))
        : searchOperationalRecords(filters, signal),
    // filterKey captures every filter value.

    [filterKey, dateError],
  );
  const { state, reload, refresh } = useAsyncResource(
    load,
    getOperationalRecordErrorMessage,
    [filterKey, dateError],
  );
  const lockers = useAsyncResource(
    listAssignedLockers,
    getOperationalRecordErrorMessage,
    [],
  );

  const page = state.data;
  const totalPages = page
    ? Math.max(1, Math.ceil(page.totalCount / page.pageSize))
    : 1;
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, filters.pageNumber - 2);
    const end = Math.min(totalPages, start + 4);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [filters.pageNumber, totalPages]);

  const openDetail = (record: OperationalRecord) => {
    setSelected(record);
    detailState.open();
  };

  const renderTable = () => {
    if (dateError) return null;

    if (state.status === 'loading' && !page) {
      return (
        <div
          aria-busy="true"
          aria-label="Đang tải lịch sử vận hành"
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-full rounded-xl" />
          ))}
        </div>
      );
    }

    if (state.status === 'error' && !page) {
      return <ErrorAlert message={state.message} onRetry={reload} />;
    }

    if (!page?.items.length) {
      return (
        <Alert status="default">
          <Alert.Indicator>
            <CircleInfo aria-hidden="true" className="size-5" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Không có bản ghi</Alert.Title>
            <Alert.Description>
              Không có sự kiện vận hành nào khớp bộ lọc trong các tủ bạn phụ
              trách.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      );
    }

    return (
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Lịch sử vận hành">
            <Table.Header>
              <Table.Column isRowHeader id="time">
                Thời gian
              </Table.Column>
              <Table.Column id="kind">Loại</Table.Column>
              <Table.Column id="code">Mã</Table.Column>
              <Table.Column id="locker">Tủ</Table.Column>
              <Table.Column id="status">Trạng thái / Kết quả</Table.Column>
              <Table.Column id="summary">Nội dung</Table.Column>
              <Table.Column id="action">Thao tác</Table.Column>
            </Table.Header>
            <Table.Body>
              {page.items.map((record) => (
                <Table.Row
                  key={`${record.kind}-${record.id}`}
                  id={`${record.kind}-${record.id}`}
                >
                  <Table.Cell>
                    {formatRecordDateTime(record.occurredAt)}
                  </Table.Cell>
                  <Table.Cell>
                    {formatOperationalRecordKind(record.kind)}
                  </Table.Cell>
                  <Table.Cell>
                    <span className="block max-w-40 truncate">
                      {record.code}
                    </span>
                  </Table.Cell>
                  <Table.Cell>{record.lockerCode}</Table.Cell>
                  <Table.Cell>
                    {formatOperationalRecordStatus(record.kind, record.status)}
                  </Table.Cell>
                  <Table.Cell>
                    <span className="block max-w-72 text-wrap">
                      {record.summary}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {record.hasDetail ? (
                      <Button
                        aria-label={`Xem chi tiết ${formatOperationalRecordKind(record.kind)} ${record.code}`}
                        size="sm"
                        variant="ghost"
                        onPress={() => openDetail(record)}
                      >
                        Chi tiết
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </Button>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
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
      <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_12rem_13rem_10rem_10rem_auto] lg:items-end">
        <SearchField
          fullWidth
          aria-label="Tìm theo mã, nội dung hoặc mã tủ"
          value={searchInput}
          variant="secondary"
          onChange={setSearchInput}
        >
          <SearchField.Group>
            <SearchField.SearchIcon>
              <Magnifier aria-hidden="true" className="size-4" />
            </SearchField.SearchIcon>
            <SearchField.Input placeholder="Mã bưu kiện, mã ngăn, nội dung..." />
            <SearchField.ClearButton aria-label="Xóa từ khóa">
              <Xmark aria-hidden="true" className="size-4" />
            </SearchField.ClearButton>
          </SearchField.Group>
        </SearchField>

        <Select
          aria-label="Lọc theo tủ"
          value={filters.lockerId}
          variant="secondary"
          onChange={(value) =>
            updateFilter({ lockerId: String(value ?? 'all') })
          }
        >
          <Select.Trigger>
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
              {(lockers.state.data ?? []).map((locker) => (
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

        <Select
          aria-label="Lọc theo loại sự kiện"
          value={filters.kind}
          variant="secondary"
          onChange={(value) => updateFilter({ kind: String(value ?? 'all') })}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator>
              <ChevronDown aria-hidden="true" className="size-4" />
            </Select.Indicator>
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="all" textValue="Tất cả loại">
                Tất cả loại
              </ListBox.Item>
              {OPERATIONAL_RECORD_KIND_FILTERS.map((kind) => (
                <ListBox.Item
                  key={kind}
                  id={kind}
                  textValue={formatOperationalRecordKind(kind)}
                >
                  {formatOperationalRecordKind(kind)}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <TextField
          fullWidth
          type="date"
          value={filters.fromDate}
          onChange={(value) => updateFilter({ fromDate: value })}
        >
          <Label>Từ ngày</Label>
          <Input variant="secondary" />
        </TextField>

        <TextField
          fullWidth
          isInvalid={Boolean(dateError)}
          type="date"
          value={filters.toDate}
          onChange={(value) => updateFilter({ toDate: value })}
        >
          <Label>Đến ngày</Label>
          <Input variant="secondary" />
        </TextField>

        <Button
          isDisabled={state.status === 'loading'}
          variant="secondary"
          onPress={refresh}
        >
          <ArrowRotateRight aria-hidden="true" className="size-4" />
          Làm mới
        </Button>
      </div>

      {dateError ? <ErrorAlert message={dateError} /> : null}

      {state.status === 'error' && page && !dateError ? (
        <ErrorAlert message={state.message} onRetry={reload} />
      ) : null}

      {renderTable()}

      {page && page.totalCount > page.pageSize && !dateError ? (
        <Pagination
          aria-label="Phân trang lịch sử vận hành"
          className="justify-end"
          size="sm"
        >
          <Pagination.Summary>
            Trang {filters.pageNumber}/{totalPages} · {page.totalCount} bản ghi
          </Pagination.Summary>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                aria-label="Trang trước"
                isDisabled={filters.pageNumber === 1}
                onPress={() =>
                  setFilters((current) => ({
                    ...current,
                    pageNumber: current.pageNumber - 1,
                  }))
                }
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Pagination.Previous>
            </Pagination.Item>
            {pageNumbers.map((pageNumber) => (
              <Pagination.Item key={pageNumber}>
                <Pagination.Link
                  aria-label={`Trang ${pageNumber}`}
                  isActive={pageNumber === filters.pageNumber}
                  onPress={() =>
                    setFilters((current) => ({ ...current, pageNumber }))
                  }
                >
                  {pageNumber}
                </Pagination.Link>
              </Pagination.Item>
            ))}
            <Pagination.Item>
              <Pagination.Next
                aria-label="Trang sau"
                isDisabled={filters.pageNumber >= totalPages}
                onPress={() =>
                  setFilters((current) => ({
                    ...current,
                    pageNumber: current.pageNumber + 1,
                  }))
                }
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      ) : null}

      <Modal state={detailState}>
        <Modal.Backdrop>
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label="Đóng chi tiết sự kiện">
                <Xmark aria-hidden="true" className="size-5" />
              </Modal.CloseTrigger>
              <Modal.Header>
                <Modal.Icon>
                  <ClockArrowRotateLeft aria-hidden="true" className="size-5" />
                </Modal.Icon>
                <Modal.Heading>Chi tiết sự kiện vận hành</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {selected && detailState.isOpen ? (
                  <RecordDetail
                    key={`${selected.kind}-${selected.id}`}
                    record={selected}
                  />
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
