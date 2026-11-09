import type { LockerListFilter, OperatorLocker } from '@/types/operator-locker';

import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  ListBox,
  Pagination,
  SearchField,
  Select,
  Skeleton,
  Table,
} from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import ChevronDown from '@gravity-ui/icons/ChevronDown';
import ChevronLeft from '@gravity-ui/icons/ChevronLeft';
import ChevronRight from '@gravity-ui/icons/ChevronRight';
import CircleInfo from '@gravity-ui/icons/CircleInfo';
import Funnel from '@gravity-ui/icons/Funnel';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Xmark from '@gravity-ui/icons/Xmark';
import { useNavigate } from 'react-router-dom';

import {
  ConnectionChip,
  formatLockerDateTime,
  LoadErrorAlert,
  LockerStatusChip,
} from './locker-shared';

import {
  LOCKER_LIST_FILTER_OPTIONS,
  LOCKER_PAGE_SIZE,
} from '@/constants/operator-locker';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { useOperationsRealtime } from '@/hooks/use-operations-realtime';
import { useLockerAlerts } from '@/hooks/use-locker-alerts';
import { filterLockers } from '@/services/operator-locker-mappers';
import {
  getLockerLoadErrorMessage,
  listAssignedLockers,
} from '@/services/operator-locker-service';

function EmptyAlert({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Alert status="default">
      <Alert.Indicator>
        <CircleInfo aria-hidden="true" className="size-5" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        <Alert.Description>{description}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

function LockerTableSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải danh sách tủ"
      className="flex flex-col gap-3"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}

export default function OperatorLockersPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<LockerListFilter>('all');
  const [page, setPage] = useState(1);
  const { state, reload, refresh } = useAsyncResource(
    listAssignedLockers,
    getLockerLoadErrorMessage,
    [],
  );
  const lockers = useMemo(() => state.data ?? [], [state.data]);

  const onLockerEvent = useLockerAlerts(lockers);

  useOperationsRealtime(
    lockers.map((locker) => locker.id),
    refresh,
    onLockerEvent,
  );

  const filteredLockers = useMemo(
    () => filterLockers(lockers, keyword, statusFilter),
    [keyword, lockers, statusFilter],
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredLockers.length / LOCKER_PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const pagedLockers = filteredLockers.slice(
    (currentPage - 1) * LOCKER_PAGE_SIZE,
    currentPage * LOCKER_PAGE_SIZE,
  );

  const openLocker = (locker: OperatorLocker) => {
    navigate(`/operator/lockers/${locker.id}`, {
      state: { lockerCode: locker.code },
    });
  };

  const renderContent = () => {
    if (state.status === 'loading' && !state.data) {
      return <LockerTableSkeleton />;
    }

    if (state.status === 'error' && !state.data) {
      return <LoadErrorAlert message={state.message} onRetry={reload} />;
    }

    if (!lockers.length) {
      return (
        <EmptyAlert
          description="Liên hệ Quản trị viên để được phân công tủ."
          title="Bạn chưa được phân công tủ nào"
        />
      );
    }

    if (!pagedLockers.length) {
      return (
        <EmptyAlert
          description="Hãy thử đổi từ khóa tìm kiếm hoặc trạng thái."
          title="Không tìm thấy tủ phù hợp"
        />
      );
    }

    return (
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Danh sách tủ được phân công">
            <Table.Header>
              <Table.Column isRowHeader id="code">
                Mã tủ
              </Table.Column>
              <Table.Column id="address">Địa chỉ</Table.Column>
              <Table.Column id="compartments">Ngăn hoạt động</Table.Column>
              <Table.Column id="connection">Kết nối</Table.Column>
              <Table.Column id="status">Vận hành</Table.Column>
              <Table.Column id="lastSeen">Lần cuối kết nối</Table.Column>
              <Table.Column id="action">Thao tác</Table.Column>
            </Table.Header>
            <Table.Body>
              {pagedLockers.map((locker) => (
                <Table.Row key={locker.id} id={locker.id}>
                  <Table.Cell>
                    <span className="font-semibold">{locker.code}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="block max-w-72 text-wrap">
                      {locker.address}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {locker.activeCompartments}/{locker.totalCompartments}
                  </Table.Cell>
                  <Table.Cell>
                    <ConnectionChip value={locker.connectionStatus} />
                  </Table.Cell>
                  <Table.Cell>
                    <LockerStatusChip value={locker.operationalStatus} />
                  </Table.Cell>
                  <Table.Cell>
                    {formatLockerDateTime(locker.lastSeenAt, 'Chưa kết nối')}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      aria-label={`Xem chi tiết tủ ${locker.code}`}
                      size="sm"
                      variant="ghost"
                      onPress={() => openLocker(locker)}
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          fullWidth
          aria-label="Tìm theo mã tủ hoặc địa chỉ"
          className="sm:max-w-md"
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
            <SearchField.Input placeholder="Tìm theo mã tủ hoặc địa chỉ..." />
            <SearchField.ClearButton aria-label="Xóa từ khóa">
              <Xmark aria-hidden="true" className="size-4" />
            </SearchField.ClearButton>
          </SearchField.Group>
        </SearchField>

        <Select
          aria-label="Lọc theo trạng thái"
          className="w-full sm:w-56"
          value={statusFilter}
          variant="secondary"
          onChange={(value) => {
            setStatusFilter(value as LockerListFilter);
            setPage(1);
          }}
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
              {LOCKER_LIST_FILTER_OPTIONS.map((option) => (
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

        <Button
          className="sm:ml-auto"
          isDisabled={state.status === 'loading'}
          variant="secondary"
          onPress={refresh}
        >
          <ArrowRotateRight aria-hidden="true" className="size-4" />
          Làm mới
        </Button>
      </div>

      {state.status === 'error' && state.data ? (
        <LoadErrorAlert message={state.message} onRetry={reload} />
      ) : null}

      {renderContent()}

      {filteredLockers.length > LOCKER_PAGE_SIZE ? (
        <Pagination
          aria-label="Phân trang danh sách tủ"
          className="justify-end"
          size="sm"
        >
          <Pagination.Summary>
            Hiển thị {(currentPage - 1) * LOCKER_PAGE_SIZE + 1}–
            {Math.min(currentPage * LOCKER_PAGE_SIZE, filteredLockers.length)}{' '}
            trong {filteredLockers.length} tủ
          </Pagination.Summary>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                aria-label="Trang trước"
                isDisabled={currentPage === 1}
                onPress={() => setPage(currentPage - 1)}
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Pagination.Previous>
            </Pagination.Item>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (pageNumber) => (
                <Pagination.Item key={pageNumber}>
                  <Pagination.Link
                    aria-label={`Trang ${pageNumber}`}
                    isActive={pageNumber === currentPage}
                    onPress={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </Pagination.Link>
                </Pagination.Item>
              ),
            )}
            <Pagination.Item>
              <Pagination.Next
                aria-label="Trang sau"
                isDisabled={currentPage === totalPages}
                onPress={() => setPage(currentPage + 1)}
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      ) : null}
    </section>
  );
}
