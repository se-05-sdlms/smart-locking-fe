import type {
  ManagedUserView,
  PaginatedResult,
  UserFilters,
  UserSortField,
} from '@/types/user-management';

import { DEFAULT_PAGE_SIZE } from '@/constants/user-management';

function sortValue(
  user: ManagedUserView,
  field: UserSortField,
): string | number {
  switch (field) {
    case 'employeeCode':
      return user.role === 'LOCKER_OPERATOR' ? user.employeeCode : '';
    case 'assignedLockerCount':
      return user.role === 'LOCKER_OPERATOR' ? user.assignedLockerCount : 0;
    case 'createdAt':
    case 'registeredAt':
      return Date.parse(
        user.role === 'LOCKER_OPERATOR' ? user.createdAt : user.registeredAt,
      );
    case 'status':
      return user.status === 'ACTIVE' ? 0 : 1;
    default:
      return user[field];
  }
}

export function queryUserViews(
  users: ManagedUserView[],
  filters: UserFilters,
): PaginatedResult<ManagedUserView> {
  const search = filters.search.trim().toLocaleLowerCase('vi-VN');
  const filtered = users.filter(
    (user) =>
      user.role === filters.role &&
      (filters.status === 'ALL' || user.status === filters.status) &&
      [user.fullName, user.phoneNumber, user.email].some((value) =>
        value.trim().toLocaleLowerCase('vi-VN').includes(search),
      ),
  );
  const { column, direction } = filters.sortDescriptor;

  filtered.sort((first, second) => {
    const a = sortValue(first, column);
    const b = sortValue(second, column);
    const invalidA = typeof a === 'number' && !Number.isFinite(a);
    const invalidB = typeof b === 'number' && !Number.isFinite(b);

    // Invalid dates always sort last, even in descending order.
    if (invalidA !== invalidB) return invalidA ? 1 : -1;

    const comparison =
      invalidA && invalidB
        ? 0
        : typeof a === 'number' && typeof b === 'number'
          ? a - b
          : String(a).trim().localeCompare(String(b).trim(), 'vi', {
              sensitivity: 'base',
            });

    if (comparison === 0) return first.id.localeCompare(second.id);

    return direction === 'ascending' ? comparison : -comparison;
  });

  const pageSize =
    Number.isFinite(filters.pageSize) && filters.pageSize >= 1
      ? Math.trunc(filters.pageSize)
      : DEFAULT_PAGE_SIZE;
  const totalPages = Math.ceil(filtered.length / pageSize);
  const requestedPage = Number.isFinite(filters.page)
    ? Math.max(1, Math.trunc(filters.page))
    : 1;
  const page = Math.min(requestedPage, Math.max(1, totalPages));

  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    totalItems: filtered.length,
    totalPages,
    page,
    pageSize,
  };
}
