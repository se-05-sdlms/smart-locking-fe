import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  ListBox,
  Pagination,
  SearchField,
  Select,
  Table,
} from '@heroui/react';
import ChevronDown from '@gravity-ui/icons/ChevronDown';
import ChevronLeft from '@gravity-ui/icons/ChevronLeft';
import ChevronRight from '@gravity-ui/icons/ChevronRight';
import CircleInfo from '@gravity-ui/icons/CircleInfo';
import Funnel from '@gravity-ui/icons/Funnel';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Xmark from '@gravity-ui/icons/Xmark';
import { useNavigate } from 'react-router-dom';

import type { Locker, LockerConnection } from './locker-shared';
import { ConnectionChip, LOCKERS } from './locker-shared';

type StatusFilter = 'all' | LockerConnection | 'issue';

const PAGE_SIZE = 20;

export default function OperatorLockersPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  const filteredLockers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi');

    return LOCKERS.filter(
      (locker) =>
        (!normalizedKeyword ||
          locker.name.toLocaleLowerCase('vi').includes(normalizedKeyword)) &&
        (statusFilter === 'all' ||
          (statusFilter === 'issue'
            ? locker.condition === 'issue'
            : locker.connection === statusFilter)),
    );
  }, [keyword, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLockers.length / PAGE_SIZE));
  const pagedLockers = filteredLockers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const openLocker = (locker: Locker) => {
    navigate(`/operator/lockers/${locker.id}`);
  };

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          fullWidth
          aria-label="Tìm theo tên tủ"
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
            <SearchField.Input placeholder="Tìm theo tên tủ..." />
            <SearchField.ClearButton aria-label="Xóa từ khóa">
              <Xmark aria-hidden="true" className="size-4" />
            </SearchField.ClearButton>
          </SearchField.Group>
        </SearchField>

        <Select
          aria-label="Lọc theo trạng thái"
          className="w-full sm:w-52"
          value={statusFilter}
          variant="secondary"
          onChange={(value) => {
            setStatusFilter(value as StatusFilter);
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
              <ListBox.Item id="all" textValue="Tất cả trạng thái">
                Tất cả trạng thái
              </ListBox.Item>
              <ListBox.Item id="online" textValue="Trực tuyến">
                Trực tuyến
              </ListBox.Item>
              <ListBox.Item id="offline" textValue="Ngoại tuyến">
                Ngoại tuyến
              </ListBox.Item>
              <ListBox.Item id="issue" textValue="Có lỗi">
                Có lỗi
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {pagedLockers.length ? (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Danh sách tủ được phân công">
              <Table.Header>
                <Table.Column id="code" isRowHeader>
                  Mã tủ
                </Table.Column>
                <Table.Column id="name">Tên tủ</Table.Column>
                <Table.Column id="address">Địa chỉ</Table.Column>
                <Table.Column id="compartments">Số ngăn</Table.Column>
                <Table.Column id="status">Trạng thái</Table.Column>
                <Table.Column id="action">Thao tác</Table.Column>
              </Table.Header>
              <Table.Body>
                {pagedLockers.map((locker) => (
                  <Table.Row key={locker.id} id={locker.id}>
                    <Table.Cell>
                      <span className="font-semibold">{locker.id}</span>
                    </Table.Cell>
                    <Table.Cell>{locker.name}</Table.Cell>
                    <Table.Cell>
                      <span className="block max-w-72 text-wrap">
                        {locker.address}
                      </span>
                    </Table.Cell>
                    <Table.Cell>{locker.compartmentCount}</Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap gap-2">
                        <ConnectionChip value={locker.connection} />
                        {locker.condition === 'issue' ? (
                          <Chip color="warning" size="sm" variant="soft">
                            Có lỗi
                          </Chip>
                        ) : null}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Button
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
      ) : (
        <Alert status="default">
          <Alert.Indicator>
            <CircleInfo aria-hidden="true" className="size-5" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Không tìm thấy tủ phù hợp</Alert.Title>
            <Alert.Description>
              Hãy thử đổi tên tìm kiếm hoặc trạng thái.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {filteredLockers.length > PAGE_SIZE ? (
        <Pagination
          size="sm"
          aria-label="Phân trang danh sách tủ"
          className="justify-end"
        >
          <Pagination.Summary>
            Hiển thị {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filteredLockers.length)} trong{' '}
            {filteredLockers.length} tủ
          </Pagination.Summary>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                aria-label="Trang trước"
                isDisabled={page === 1}
                onPress={() => setPage((current) => current - 1)}
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Pagination.Previous>
            </Pagination.Item>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (pageNumber) => (
                <Pagination.Item key={pageNumber}>
                  <Pagination.Link
                    aria-label={`Trang ${pageNumber}`}
                    isActive={pageNumber === page}
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
                isDisabled={page === totalPages}
                onPress={() => setPage((current) => current + 1)}
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
