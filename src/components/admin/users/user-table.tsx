import type {
  ManagedUserView,
  UserRole,
  UserSortDescriptor,
  UserSortField,
} from '@/types/user-management';

import ArrowsRotateRight from '@gravity-ui/icons/ArrowsRotateRight';
import ChevronLeft from '@gravity-ui/icons/ChevronLeft';
import ChevronRight from '@gravity-ui/icons/ChevronRight';
import Copy from '@gravity-ui/icons/Copy';
import Persons from '@gravity-ui/icons/Persons';
import TriangleExclamation from '@gravity-ui/icons/TriangleExclamation';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  Pagination,
  Spinner,
  Table,
  Typography,
} from '@heroui/react';

import {
  ACCOUNT_STATUS_LABELS,
  USER_ROLE_LABELS,
} from '@/constants/user-management';

type UserTableProps = {
  role: UserRole;
  users: ManagedUserView[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  isLoading: boolean;
  hasError: boolean;
  hasActiveFilters: boolean;
  sortDescriptor: UserSortDescriptor;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onSortChange: (descriptor: UserSortDescriptor) => void;
  onViewDetails: (userId: string) => void;
  onChangeAccountStatus: (user: ManagedUserView) => void;
};

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const tableColumnClassName = 'px-3';
const tableRowClassName = 'cursor-pointer';
const tableCellClassName = 'min-w-0 px-3';
const sortableHeaderClassName =
  'w-full min-w-0 cursor-pointer gap-1 whitespace-nowrap';

const operatorColumnClassNames = {
  employeeCode: 'w-[15%]',
  fullName: 'w-[28%]',
  phoneNumber: 'w-[14%]',
  assignedLockerCount: 'w-[8%] text-center',
  createdAt: 'w-[13%]',
  status: 'w-[10%] text-center',
  action: 'w-[12%] text-center',
} as const;

const residentColumnClassNames = {
  fullName: 'w-[34%]',
  phoneNumber: 'w-[18%]',
  registeredAt: 'w-[18%]',
  status: 'w-[14%] text-center',
  action: 'w-[16%] text-center',
} as const;

const SORTABLE_FIELDS = new Set<UserSortField>([
  'fullName',
  'employeeCode',
  'email',
  'phoneNumber',
  'assignedLockerCount',
  'createdAt',
  'registeredAt',
  'status',
]);

function isUserSortField(value: string | number): value is UserSortField {
  return (
    typeof value === 'string' && SORTABLE_FIELDS.has(value as UserSortField)
  );
}

function SortableColumnLabel({
  label,
  sortDirection,
}: {
  label: string;
  sortDirection?: 'ascending' | 'descending';
}) {
  return (
    <Table.SortableColumnHeader
      className={sortableHeaderClassName}
      sortDirection={sortDirection}
    >
      {label}
    </Table.SortableColumnHeader>
  );
}

function UserDate({ value }: { value: string }) {
  const timestamp = Date.parse(value);
  const isValid = Number.isFinite(timestamp);

  return (
    <time
      className="block truncate whitespace-nowrap text-muted"
      dateTime={isValid ? value : undefined}
      title={isValid ? dateFormatter.format(timestamp) : undefined}
    >
      {isValid ? dateFormatter.format(timestamp) : '—'}
    </time>
  );
}

function getInitials(fullName: string) {
  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);

  if (nameParts.length === 0) return '?';
  if (nameParts.length === 1)
    return nameParts[0].slice(0, 1).toLocaleUpperCase('vi-VN');

  return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toLocaleUpperCase(
    'vi-VN',
  );
}

function UserAvatar({ user }: { user: ManagedUserView }) {
  const colors = ['accent', 'success', 'warning', 'danger'] as const;
  const colorIndex = Array.from(user.id).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );

  return (
    <Avatar
      className="shrink-0"
      color={colors[colorIndex % colors.length]}
      size="sm"
      variant="soft"
    >
      {user.avatarUrl ? (
        <Avatar.Image
          alt={`Ảnh đại diện của ${user.fullName}`}
          src={user.avatarUrl}
        />
      ) : null}
      <Avatar.Fallback>{getInitials(user.fullName)}</Avatar.Fallback>
    </Avatar>
  );
}

function LoadingState() {
  return (
    <Card aria-live="polite" className="min-h-72">
      <Card.Content className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <Spinner aria-label="Đang tải danh sách người dùng" color="accent" />
        <Typography className="text-muted">Đang tải danh sách...</Typography>
      </Card.Content>
    </Card>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert status="danger">
      <Alert.Indicator>
        <TriangleExclamation aria-hidden="true" className="size-5" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>Không thể tải danh sách người dùng</Alert.Title>
        <Alert.Description>
          Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.
        </Alert.Description>
        <Button className="mt-4" size="sm" variant="outline" onPress={onRetry}>
          <ArrowsRotateRight aria-hidden="true" className="size-4" />
          Thử lại
        </Button>
      </Alert.Content>
    </Alert>
  );
}

function UsersEmptyState({
  role,
  hasActiveFilters,
}: {
  role: UserRole;
  hasActiveFilters: boolean;
}) {
  const roleLabel = USER_ROLE_LABELS[role].toLocaleLowerCase('vi-VN');

  return (
    <EmptyState className="min-h-72 text-center">
      <Persons aria-hidden="true" className="mx-auto size-10 text-muted" />
      <Typography className="mt-4" type="h5">
        {hasActiveFilters
          ? 'Không tìm thấy người dùng phù hợp'
          : `Chưa có ${roleLabel}`}
      </Typography>
      <Typography className="mx-auto mt-2 max-w-md text-muted">
        {hasActiveFilters
          ? 'Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.'
          : `Danh sách ${roleLabel} hiện đang trống.`}
      </Typography>
    </EmptyState>
  );
}

function UsersPagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
}: Pick<
  UserTableProps,
  'page' | 'pageSize' | 'totalItems' | 'totalPages' | 'onPageChange'
>) {
  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);

  return (
    <Pagination
      aria-label="Phân trang danh sách người dùng"
      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
      size="sm"
    >
      <Pagination.Summary>
        Hiển thị {firstItem}–{lastItem} trong tổng số {totalItems} người dùng
      </Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous
            aria-label="Trang trước"
            className="min-h-11 min-w-11"
            isDisabled={page === 1}
            onPress={() => onPageChange(page - 1)}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Trước</span>
          </Pagination.Previous>
        </Pagination.Item>

        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (pageNumber) => (
            <Pagination.Item key={pageNumber}>
              <Pagination.Link
                aria-label={`Trang ${pageNumber}`}
                isActive={pageNumber === page}
                onPress={() => onPageChange(pageNumber)}
              >
                {pageNumber}
              </Pagination.Link>
            </Pagination.Item>
          ),
        )}

        <Pagination.Item>
          <Pagination.Next
            aria-label="Trang sau"
            className="min-h-11 min-w-11"
            isDisabled={page === totalPages}
            onPress={() => onPageChange(page + 1)}
          >
            <span className="hidden sm:inline">Sau</span>
            <ChevronRight aria-hidden="true" className="size-4" />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

export function UserTable({
  role,
  users,
  page,
  pageSize,
  totalItems,
  totalPages,
  isLoading,
  hasError,
  hasActiveFilters,
  sortDescriptor,
  onPageChange,
  onRetry,
  onSortChange,
  onViewDetails,
  onChangeAccountStatus,
}: UserTableProps) {
  if (isLoading) return <LoadingState />;
  if (hasError) return <ErrorState onRetry={onRetry} />;
  if (users.length === 0)
    return <UsersEmptyState hasActiveFilters={hasActiveFilters} role={role} />;

  const isOperatorTable = role === 'LOCKER_OPERATOR';

  return (
    <>
      <Table>
        <Table.ScrollContainer className="w-full max-w-full overflow-x-auto">
          <Table.Content
            aria-label={`Danh sách ${USER_ROLE_LABELS[role].toLocaleLowerCase('vi-VN')}`}
            className={`w-full table-fixed ${
              isOperatorTable
                ? 'min-w-[1040px] xl:min-w-0'
                : 'min-w-[820px] lg:min-w-0'
            }`}
            sortDescriptor={sortDescriptor}
            onRowAction={(key) => onViewDetails(String(key))}
            onSortChange={(descriptor) => {
              if (isUserSortField(descriptor.column)) {
                onSortChange({
                  column: descriptor.column,
                  direction: descriptor.direction,
                });
              }
            }}
          >
            <Table.Header>
              {isOperatorTable ? (
                <Table.Column
                  allowsSorting
                  className={`${tableColumnClassName} ${operatorColumnClassNames.employeeCode}`}
                  id="employeeCode"
                  textValue="Mã nhân viên"
                >
                  {({ sortDirection }) => (
                    <SortableColumnLabel
                      label="Mã nhân viên"
                      sortDirection={sortDirection}
                    />
                  )}
                </Table.Column>
              ) : null}
              <Table.Column
                allowsSorting
                isRowHeader
                className={`${tableColumnClassName} ${
                  isOperatorTable
                    ? operatorColumnClassNames.fullName
                    : residentColumnClassNames.fullName
                }`}
                id="fullName"
                textValue="Họ và tên"
              >
                {({ sortDirection }) => (
                  <SortableColumnLabel
                    label="Họ và tên"
                    sortDirection={sortDirection}
                  />
                )}
              </Table.Column>
              <Table.Column
                allowsSorting
                className={`${tableColumnClassName} ${
                  isOperatorTable
                    ? operatorColumnClassNames.phoneNumber
                    : residentColumnClassNames.phoneNumber
                }`}
                id="phoneNumber"
                textValue="Số điện thoại"
              >
                {({ sortDirection }) => (
                  <SortableColumnLabel
                    label="Số điện thoại"
                    sortDirection={sortDirection}
                  />
                )}
              </Table.Column>
              {isOperatorTable ? (
                <Table.Column
                  allowsSorting
                  aria-label="Số tủ đang quản lý"
                  className={`${tableColumnClassName} ${operatorColumnClassNames.assignedLockerCount}`}
                  id="assignedLockerCount"
                  textValue="Số tủ"
                >
                  {({ sortDirection }) => (
                    <SortableColumnLabel
                      label="Số tủ"
                      sortDirection={sortDirection}
                    />
                  )}
                </Table.Column>
              ) : (
                <Table.Column
                  allowsSorting
                  className={`${tableColumnClassName} ${residentColumnClassNames.registeredAt}`}
                  id="registeredAt"
                  textValue="Ngày đăng ký"
                >
                  {({ sortDirection }) => (
                    <SortableColumnLabel
                      label="Ngày đăng ký"
                      sortDirection={sortDirection}
                    />
                  )}
                </Table.Column>
              )}
              {isOperatorTable ? (
                <Table.Column
                  allowsSorting
                  className={`${tableColumnClassName} ${operatorColumnClassNames.createdAt}`}
                  id="createdAt"
                  textValue="Ngày tạo"
                >
                  {({ sortDirection }) => (
                    <SortableColumnLabel
                      label="Ngày tạo"
                      sortDirection={sortDirection}
                    />
                  )}
                </Table.Column>
              ) : null}
              <Table.Column
                allowsSorting
                className={`${tableColumnClassName} ${
                  isOperatorTable
                    ? operatorColumnClassNames.status
                    : residentColumnClassNames.status
                }`}
                id="status"
                textValue="Trạng thái"
              >
                {({ sortDirection }) => (
                  <SortableColumnLabel
                    label="Trạng thái"
                    sortDirection={sortDirection}
                  />
                )}
              </Table.Column>
              <Table.Column
                className={`${tableColumnClassName} ${
                  isOperatorTable
                    ? operatorColumnClassNames.action
                    : residentColumnClassNames.action
                }`}
                id="action"
                textValue="Thao tác"
              >
                Thao tác
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {users.map((user) => (
                <Table.Row
                  key={user.id}
                  aria-label={`Xem chi tiết ${user.fullName}`}
                  className={tableRowClassName}
                  id={user.id}
                >
                  {isOperatorTable && user.role === 'LOCKER_OPERATOR' ? (
                    <Table.Cell className={tableCellClassName}>
                      <div className="flex min-w-0 items-center gap-1">
                        <span
                          className="truncate font-mono text-sm font-medium"
                          title={`#${user.employeeCode}`}
                        >
                          #{user.employeeCode}
                        </span>
                        <Button
                          isIconOnly
                          aria-label={`Sao chép mã nhân viên ${user.employeeCode}`}
                          className="shrink-0"
                          size="sm"
                          variant="ghost"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                          onPress={() =>
                            void navigator.clipboard.writeText(
                              user.employeeCode,
                            )
                          }
                        >
                          <Copy aria-hidden="true" className="size-4" />
                        </Button>
                      </div>
                    </Table.Cell>
                  ) : null}
                  <Table.Cell className={tableCellClassName}>
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={user} />
                      <span className="min-w-0">
                        <span
                          className="block truncate font-semibold"
                          title={user.fullName}
                        >
                          {user.fullName}
                        </span>
                        <span
                          className="block truncate text-sm text-muted"
                          title={user.email}
                        >
                          {user.email}
                        </span>
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell className={tableCellClassName}>
                    <span
                      className="block truncate whitespace-nowrap text-muted"
                      title={user.phoneNumber}
                    >
                      {user.phoneNumber}
                    </span>
                  </Table.Cell>
                  {user.role === 'LOCKER_OPERATOR' ? (
                    <Table.Cell className={`${tableCellClassName} text-center`}>
                      <span className="tabular-nums text-muted">
                        {user.assignedLockerCount}
                      </span>
                    </Table.Cell>
                  ) : (
                    <Table.Cell className={tableCellClassName}>
                      <UserDate value={user.registeredAt} />
                    </Table.Cell>
                  )}
                  {user.role === 'LOCKER_OPERATOR' ? (
                    <Table.Cell className={tableCellClassName}>
                      <UserDate value={user.createdAt} />
                    </Table.Cell>
                  ) : null}
                  <Table.Cell className={`${tableCellClassName} text-center`}>
                    <Chip
                      color={user.status === 'ACTIVE' ? 'success' : 'danger'}
                      size="sm"
                      variant="soft"
                    >
                      {ACCOUNT_STATUS_LABELS[user.status]}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell className={`${tableCellClassName} text-center`}>
                    <Button
                      aria-label={`${user.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'} ${user.fullName}`}
                      size="sm"
                      variant={
                        user.status === 'ACTIVE' ? 'danger-soft' : 'primary'
                      }
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      onPress={() => onChangeAccountStatus(user)}
                    >
                      {user.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {totalPages > 1 ? (
        <UsersPagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      ) : null}
    </>
  );
}
