import type {
  LockerSummaryDto,
  LockersPageDto,
  UserDetailDto,
  UserListItemDto,
  UsersPageDto,
} from '@/types/user-management-api';

import { ApiError, apiRequest } from '@/services/api-client';
import { ErrorCodes } from '@/constants/error-codes';

/** UsersController role / status enums. */
const OPERATOR_ROLE = 2;
const ACTIVE_STATUS = 0;
const PAGE_SIZE = 100;
const DETAIL_CONCURRENCY = 3;

export const ASSIGNMENT_REASON_MAX_LENGTH = 500;

export type AssignmentOperator = {
  id: string;
  fullName: string;
  email: string | null;
  isActive: boolean;
};

export type LockerAssignmentRow = {
  lockerId: string;
  lockerCode: string;
  lockerAddress: string;
  operator: AssignmentOperator | null;
  assignmentId: string | null;
  assignedAt: string | null;
};

export type AssignmentBoard = {
  rows: LockerAssignmentRow[];
  operators: AssignmentOperator[];
};

export type AssignmentFilter = 'all' | 'assigned' | 'unassigned';

export type AssignmentAction = 'assign' | 'replace' | 'revoke';

const byCode = (left: { lockerCode: string }, right: { lockerCode: string }) =>
  left.lockerCode.localeCompare(right.lockerCode, 'vi', {
    numeric: true,
    sensitivity: 'base',
  });

function toOperator(dto: UserListItemDto | UserDetailDto): AssignmentOperator {
  return {
    id: dto.id,
    fullName: dto.fullName,
    email: dto.email,
    isActive: dto.status === ACTIVE_STATUS,
  };
}

async function listOperators(signal?: AbortSignal) {
  const operators: UserListItemDto[] = [];

  for (let page = 1; ; page++) {
    const response = await apiRequest<UsersPageDto>(
      `/api/Users?Role=${OPERATOR_ROLE}&PageNumber=${page}&PageSize=${PAGE_SIZE}`,
      { signal },
    );

    operators.push(...response.items);
    if (operators.length >= response.totalCount || !response.items.length)
      break;
  }

  return operators;
}

/**
 * Builds the locker-centric view. The backend does not return the owner of a
 * locker, so it is derived from the active assignments of operators that
 * have any (one active operator per locker is enforced by the backend).
 */
export function buildAssignmentBoard(
  lockers: LockerSummaryDto[],
  operators: UserListItemDto[],
  details: UserDetailDto[],
): AssignmentBoard {
  const owners = new Map<
    string,
    { operator: AssignmentOperator; id: string; at: string }
  >();

  for (const detail of details) {
    for (const assignment of detail.assignments) {
      if (assignment.revokedAt !== null) continue;
      owners.set(assignment.lockerId, {
        operator: toOperator(detail),
        id: assignment.id,
        at: assignment.assignedAt,
      });
    }
  }

  return {
    rows: lockers
      .map((locker) => {
        const owner = owners.get(locker.id);

        return {
          lockerId: locker.id,
          lockerCode: locker.code,
          lockerAddress: locker.address,
          operator: owner?.operator ?? null,
          assignmentId: owner?.id ?? null,
          assignedAt: owner?.at ?? null,
        };
      })
      .sort(byCode),
    operators: operators
      .map(toOperator)
      .sort((left, right) => left.fullName.localeCompare(right.fullName, 'vi')),
  };
}

export async function loadAssignmentBoard(
  signal?: AbortSignal,
): Promise<AssignmentBoard> {
  const [lockerResponse, operators] = await Promise.all([
    apiRequest<LockersPageDto>('/api/Lockers', { signal }),
    listOperators(signal),
  ]);
  const lockers = Array.isArray(lockerResponse)
    ? lockerResponse
    : lockerResponse.items;
  const withAssignments = operators.filter(
    (operator) => operator.activeAssignmentsCount > 0,
  );
  const details: UserDetailDto[] = [];

  for (
    let offset = 0;
    offset < withAssignments.length;
    offset += DETAIL_CONCURRENCY
  ) {
    details.push(
      ...(await Promise.all(
        withAssignments
          .slice(offset, offset + DETAIL_CONCURRENCY)
          .map((operator) =>
            apiRequest<UserDetailDto>(
              `/api/Users/${encodeURIComponent(operator.id)}`,
              {
                signal,
              },
            ),
          ),
      )),
    );
  }

  return buildAssignmentBoard(lockers, operators, details);
}

export function filterAssignmentRows(
  rows: LockerAssignmentRow[],
  keyword: string,
  filter: AssignmentFilter,
) {
  const needle = keyword.trim().toLocaleLowerCase('vi');

  return rows.filter(
    (row) =>
      (filter === 'all' ||
        (filter === 'assigned'
          ? row.operator !== null
          : row.operator === null)) &&
      (!needle ||
        [
          row.lockerCode,
          row.lockerAddress,
          row.operator?.fullName ?? '',
          row.operator?.email ?? '',
        ].some((value) => value.toLocaleLowerCase('vi').includes(needle))),
  );
}

/** Active operators that can take the locker (excludes the current owner). */
export function getAssignableOperators(
  operators: AssignmentOperator[],
  row: LockerAssignmentRow,
) {
  return operators.filter(
    (operator) => operator.isActive && operator.id !== row.operator?.id,
  );
}

export function getAssignmentActions(
  row: LockerAssignmentRow,
): AssignmentAction[] {
  return row.operator ? ['replace', 'revoke'] : ['assign'];
}

export function validateAssignmentReason(value: string) {
  const reason = value.trim();

  if (!reason) return 'Vui lòng nhập lý do.';
  if (reason.length > ASSIGNMENT_REASON_MAX_LENGTH) {
    return `Lý do không được vượt quá ${ASSIGNMENT_REASON_MAX_LENGTH} ký tự.`;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function assignLocker(
  operatorId: string,
  lockerId: string,
  reason: string,
) {
  return apiRequest<unknown>(
    `/api/Users/${encodeURIComponent(operatorId)}/assignments`,
    {
      method: 'POST',
      body: JSON.stringify({ lockerId, reason: reason.trim() }),
    },
  );
}

export function revokeAssignment(
  operatorId: string,
  assignmentId: string,
  reason: string,
) {
  return apiRequest<void>(
    `/api/Users/${encodeURIComponent(operatorId)}/assignments/${encodeURIComponent(assignmentId)}?reason=${encodeURIComponent(reason.trim())}`,
    { method: 'DELETE' },
  );
}

export class PartialReplaceError extends Error {
  constructor(public readonly cause: unknown) {
    super('Replace stopped after revoking the previous operator.');
    this.name = 'PartialReplaceError';
  }
}

/**
 * Replace = revoke the current owner, then assign the new operator (the API
 * has no atomic replace). If the second step fails the locker is left
 * unassigned and the caller must tell the user.
 */
export async function replaceAssignment(
  row: LockerAssignmentRow,
  newOperatorId: string,
  reason: string,
) {
  if (!row.operator || !row.assignmentId) {
    throw new Error('Locker has no active assignment to replace.');
  }

  await revokeAssignment(row.operator.id, row.assignmentId, reason);

  try {
    await assignLocker(newOperatorId, row.lockerId, reason);
  } catch (error) {
    throw new PartialReplaceError(error);
  }
}

// ---------------------------------------------------------------------------
// Vietnamese error messages
// ---------------------------------------------------------------------------

export function getAssignmentErrorMessage(error: unknown): string {
  if (error instanceof PartialReplaceError) {
    return `Đã thu hồi Operator cũ nhưng chưa phân công được Operator mới: ${getAssignmentErrorMessage(error.cause)} Tủ hiện chưa có người phụ trách.`;
  }

  if (error instanceof ApiError) {
    switch (error.code) {
      case ErrorCodes.USER_ASSIGNMENT_CONFLICT:
        return 'Tủ đã được phân công cho nhân viên khác hoặc phân công đã bị thu hồi. Vui lòng tải lại.';
      case ErrorCodes.USER_NOT_FOUND:
        return 'Không tìm thấy nhân viên hoặc phân công. Vui lòng tải lại.';
      case ErrorCodes.USER_INACTIVE:
        return 'Nhân viên đã bị khóa nên không thể phân công.';
      case ErrorCodes.LOCKER_NOT_FOUND:
        return 'Không tìm thấy tủ. Dữ liệu có thể đã thay đổi, vui lòng tải lại.';
    }

    if (error.status === 409) {
      return 'Tủ đã được phân công cho nhân viên khác hoặc phân công đã bị thu hồi. Vui lòng tải lại.';
    }

    switch (error.status) {
      case 0:
        return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
      case 400:
        return 'Thông tin phân công không hợp lệ.';
      case 401:
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      case 403:
        return 'Bạn không có quyền thực hiện thao tác này.';
      case 404:
        return 'Không tìm thấy nhân viên hoặc phân công. Vui lòng tải lại.';
      case 429:
        return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
      default:
        if (error.status >= 500)
          return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
    }
  }

  return 'Không thể xử lý phân công. Vui lòng thử lại.';
}
