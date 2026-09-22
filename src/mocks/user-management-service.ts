import type {
  CreateOperatorRequest,
  Locker,
  LockerAssignmentSnapshot,
  LockAccountRequest,
  ManagedUser,
  ManagedUserView,
  MockAuditAction,
  MockAuditRecord,
  MockServiceOperation,
  MockUserManagementServiceOptions,
  OperatorUser,
  OperatorUserView,
  PaginatedResult,
  ServiceFailure,
  ServiceResult,
  UnlockAccountRequest,
  UpdateLockerAssignmentRequest,
  UserFilters,
  UserManagementErrorCode,
  UserManagementService,
  UserRole,
  UserSortDescriptor,
  UserSortField,
} from '@/types/user-management';

import {
  DEFAULT_PAGE_SIZE,
  MOCK_ADMIN_ID,
  OPERATOR_LOCK_REASONS,
  RESIDENT_LOCK_REASONS,
  UNLOCK_REASONS,
} from '@/constants/user-management';
import {
  initialAuditRecords,
  initialLockers,
  initialUsers,
} from '@/mocks/user-management-data';

const DEFAULT_LATENCY_MS = 250;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?\d{9,15}$/;

function wait(durationMs: number) {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, durationMs);
  });
}

function normalizeSearchValue(value: string) {
  return value.trim().toLocaleLowerCase('vi-VN');
}

function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase('vi-VN');
}

function normalizePhone(value: string) {
  return value.trim().replace(/[\s().-]/g, '');
}

function normalizeEmployeeCode(value: string) {
  return value.trim().toLocaleUpperCase('vi-VN');
}

function getTimestamp(value: string) {
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : undefined;
}

const OPERATOR_SORT_FIELDS = new Set<UserSortField>([
  'fullName',
  'employeeCode',
  'email',
  'phoneNumber',
  'assignedLockerCount',
  'createdAt',
  'status',
]);

const RESIDENT_SORT_FIELDS = new Set<UserSortField>([
  'fullName',
  'email',
  'phoneNumber',
  'registeredAt',
  'status',
]);

function getDefaultSortDescriptor(role: UserRole): UserSortDescriptor {
  return {
    column: role === 'LOCKER_OPERATOR' ? 'createdAt' : 'registeredAt',
    direction: 'descending',
  };
}

function getSafeSortDescriptor(
  role: UserRole,
  descriptor: UserSortDescriptor,
): UserSortDescriptor {
  const allowedFields =
    role === 'LOCKER_OPERATOR' ? OPERATOR_SORT_FIELDS : RESIDENT_SORT_FIELDS;

  if (!allowedFields.has(descriptor.column))
    return getDefaultSortDescriptor(role);

  return {
    column: descriptor.column,
    direction:
      descriptor.direction === 'ascending' ? 'ascending' : 'descending',
  };
}

function compareText(first: string, second: string) {
  return first
    .trim()
    .localeCompare(second.trim(), 'vi', { sensitivity: 'base' });
}

function compareTimestamps(
  firstValue: string,
  secondValue: string,
  direction: UserSortDescriptor['direction'],
) {
  const firstTimestamp = getTimestamp(firstValue);
  const secondTimestamp = getTimestamp(secondValue);

  if (firstTimestamp === undefined || secondTimestamp === undefined) {
    if (firstTimestamp === secondTimestamp) return 0;

    return firstTimestamp === undefined ? 1 : -1;
  }

  const difference = firstTimestamp - secondTimestamp;

  return direction === 'ascending' ? difference : -difference;
}

function compareUserViews(
  first: ManagedUserView,
  second: ManagedUserView,
  descriptor: UserSortDescriptor,
) {
  let comparison = 0;
  let directionAlreadyApplied = false;

  switch (descriptor.column) {
    case 'fullName':
      comparison = compareText(first.fullName, second.fullName);
      break;
    case 'employeeCode':
      if (
        first.role === 'LOCKER_OPERATOR' &&
        second.role === 'LOCKER_OPERATOR'
      ) {
        comparison = compareText(first.employeeCode, second.employeeCode);
      }
      break;
    case 'email':
      comparison = compareText(first.email, second.email);
      break;
    case 'phoneNumber':
      comparison = compareText(first.phoneNumber, second.phoneNumber);
      break;
    case 'assignedLockerCount':
      if (
        first.role === 'LOCKER_OPERATOR' &&
        second.role === 'LOCKER_OPERATOR'
      ) {
        comparison = first.assignedLockerCount - second.assignedLockerCount;
      }
      break;
    case 'createdAt':
      if (
        first.role === 'LOCKER_OPERATOR' &&
        second.role === 'LOCKER_OPERATOR'
      ) {
        comparison = compareTimestamps(
          first.createdAt,
          second.createdAt,
          descriptor.direction,
        );
        directionAlreadyApplied = true;
      }
      break;
    case 'registeredAt':
      if (first.role === 'RESIDENT' && second.role === 'RESIDENT') {
        comparison = compareTimestamps(
          first.registeredAt,
          second.registeredAt,
          descriptor.direction,
        );
        directionAlreadyApplied = true;
      }
      break;
    case 'status': {
      const statusOrder = { ACTIVE: 0, LOCKED: 1 } as const;

      comparison = statusOrder[first.status] - statusOrder[second.status];
      break;
    }
  }

  if (comparison === 0) return first.id.localeCompare(second.id);
  if (directionAlreadyApplied) return comparison;

  return descriptor.direction === 'ascending' ? comparison : -comparison;
}

function getPersistableAvatarUrl(value?: string) {
  const trimmedValue = value?.trim();

  if (!trimmedValue || trimmedValue.toLocaleLowerCase().startsWith('blob:'))
    return undefined;

  return trimmedValue;
}

function cloneUser<TUser extends ManagedUser>(user: TUser): TUser {
  return { ...user };
}

function cloneLocker(locker: Locker): Locker {
  return { ...locker };
}

function cloneAuditRecord(record: MockAuditRecord): MockAuditRecord {
  return {
    ...record,
    metadata: record.metadata
      ? Object.fromEntries(
          Object.entries(record.metadata).map(([key, value]) => [
            key,
            Array.isArray(value) ? [...value] : value,
          ]),
        )
      : undefined,
  };
}

function successful<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

function failed(
  code: UserManagementErrorCode,
  message: string,
): ServiceFailure {
  return { success: false, error: { code, message } };
}

function getReason(
  options: ReadonlyArray<{ code: string; label: string }>,
  reasonCode: string,
  reasonDetail?: string,
) {
  const option = options.find((item) => item.code === reasonCode);

  if (!option) {
    return failed('INVALID_REASON', 'Lý do đã chọn không hợp lệ.');
  }

  const trimmedDetail = reasonDetail?.trim() ?? '';

  if (reasonCode === 'OTHER' && !trimmedDetail) {
    return failed('INVALID_REASON', 'Vui lòng nhập chi tiết cho lý do khác.');
  }

  return reasonCode === 'OTHER' ? trimmedDetail : option.label;
}

class MockUserManagementService implements UserManagementService {
  private readonly latencyMs: number;
  private readonly failureMessages: NonNullable<
    MockUserManagementServiceOptions['failureMessages']
  >;
  private users: ManagedUser[];
  private lockers: Locker[];
  private auditRecords: MockAuditRecord[];
  private idSequence = 1;

  constructor(options: MockUserManagementServiceOptions = {}) {
    this.latencyMs = Math.max(0, options.latencyMs ?? DEFAULT_LATENCY_MS);
    this.failureMessages = options.failureMessages ?? {};
    this.users = (options.seed?.users ?? initialUsers).map(cloneUser);
    this.lockers = (options.seed?.lockers ?? initialLockers).map(cloneLocker);
    this.auditRecords = (options.seed?.auditRecords ?? initialAuditRecords).map(
      cloneAuditRecord,
    );
  }

  async getUsers(
    filters: UserFilters,
  ): Promise<ServiceResult<PaginatedResult<ManagedUserView>>> {
    const forcedFailure = await this.beginRequest('GET_USERS');

    if (forcedFailure) return forcedFailure;

    const search = normalizeSearchValue(filters.search);
    const pageSize =
      Number.isFinite(filters.pageSize) && filters.pageSize > 0
        ? Math.trunc(filters.pageSize)
        : DEFAULT_PAGE_SIZE;

    const filteredUsers = this.users.filter((user) => {
      if (user.role !== filters.role) return false;
      if (filters.status !== 'ALL' && user.status !== filters.status)
        return false;
      if (!search) return true;

      return [user.fullName, user.phoneNumber, user.email].some((value) =>
        normalizeSearchValue(value).includes(search),
      );
    });

    const sortDescriptor = getSafeSortDescriptor(
      filters.role,
      filters.sortDescriptor,
    );
    const sortedUsers = filteredUsers
      .map((user) => this.toUserView(user))
      .sort((first, second) => compareUserViews(first, second, sortDescriptor));
    const totalItems = sortedUsers.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const requestedPage =
      Number.isFinite(filters.page) && filters.page > 0
        ? Math.trunc(filters.page)
        : 1;
    const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
    const startIndex = (page - 1) * pageSize;
    const items = sortedUsers
      .slice(startIndex, startIndex + pageSize)
      .map(cloneUser);

    return successful({
      items,
      totalItems,
      totalPages,
      page,
      pageSize,
    });
  }

  async getUserById(userId: string): Promise<ServiceResult<ManagedUserView>> {
    const forcedFailure = await this.beginRequest('GET_USER');

    if (forcedFailure) return forcedFailure;

    const user = this.users.find((item) => item.id === userId.trim());

    if (!user) return failed('USER_NOT_FOUND', 'Không tìm thấy tài khoản.');

    return successful(this.toUserView(user));
  }

  async getAvailableLockers(): Promise<ServiceResult<Locker[]>> {
    const forcedFailure = await this.beginRequest('GET_AVAILABLE_LOCKERS');

    if (forcedFailure) return forcedFailure;

    return successful(
      this.lockers
        .filter((locker) => locker.assignedOperatorId === null)
        .map(cloneLocker),
    );
  }

  async createOperator(
    request: CreateOperatorRequest,
  ): Promise<ServiceResult<OperatorUserView>> {
    const forcedFailure = await this.beginRequest('CREATE_OPERATOR');

    if (forcedFailure) return forcedFailure;

    const fullName = request.fullName.trim();
    const email = normalizeEmail(request.email);
    const phoneNumber = normalizePhone(request.phoneNumber);
    const avatarUrl = getPersistableAvatarUrl(request.avatarUrl);
    const normalizedLockerIds = request.lockerIds.map((id) => id.trim());
    const requestedLockerIds = new Set(normalizedLockerIds);

    if (!fullName || !email || !phoneNumber) {
      return failed(
        'VALIDATION_ERROR',
        'Vui lòng nhập đầy đủ thông tin bắt buộc.',
      );
    }

    if (!EMAIL_PATTERN.test(email))
      return failed('INVALID_EMAIL', 'Địa chỉ email không hợp lệ.');

    if (!PHONE_PATTERN.test(phoneNumber))
      return failed('INVALID_PHONE', 'Số điện thoại không hợp lệ.');

    if (this.users.some((user) => normalizeEmail(user.email) === email)) {
      return failed('DUPLICATE_EMAIL', 'Địa chỉ email đã được sử dụng.');
    }

    if (
      this.users.some(
        (user) => normalizePhone(user.phoneNumber) === phoneNumber,
      )
    ) {
      return failed('DUPLICATE_PHONE', 'Số điện thoại đã được sử dụng.');
    }

    if (
      normalizedLockerIds.some((id) => !id) ||
      requestedLockerIds.size !== normalizedLockerIds.length
    ) {
      return failed(
        'VALIDATION_ERROR',
        'Danh sách tủ được phân công không hợp lệ.',
      );
    }

    const missingLockerId = normalizedLockerIds.find(
      (id) => !this.lockers.some((locker) => locker.id === id),
    );

    if (missingLockerId) {
      return failed('LOCKER_NOT_FOUND', 'Không tìm thấy tủ đã chọn.');
    }

    const conflictingLocker = this.lockers.find(
      (locker) =>
        requestedLockerIds.has(locker.id) && locker.assignedOperatorId !== null,
    );

    if (conflictingLocker) {
      return failed(
        'LOCKER_CONFLICT',
        `Tủ ${conflictingLocker.code} đã được phân công cho nhân viên khác.`,
      );
    }

    const employeeCode = this.createNextEmployeeCode();
    const operator: OperatorUser = {
      id: this.createId('operator'),
      role: 'LOCKER_OPERATOR',
      employeeCode,
      fullName,
      email,
      phoneNumber,
      ...(avatarUrl ? { avatarUrl } : {}),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    const updatedLockers = this.lockers.map((locker) =>
      requestedLockerIds.has(locker.id)
        ? { ...locker, assignedOperatorId: operator.id }
        : locker,
    );

    this.users = [...this.users, operator];
    this.lockers = updatedLockers;
    this.addAuditRecord('OPERATOR_CREATED', operator.id, undefined, {
      employeeCode: operator.employeeCode,
      email: operator.email,
      phoneNumber: operator.phoneNumber,
      lockerIds: [...requestedLockerIds],
      lockerCount: requestedLockerIds.size,
    });

    return successful(this.toOperatorView(operator));
  }

  async lockAccount(
    request: LockAccountRequest,
  ): Promise<ServiceResult<ManagedUserView>> {
    const forcedFailure = await this.beginRequest('LOCK_ACCOUNT');

    if (forcedFailure) return forcedFailure;

    const userIndex = this.users.findIndex(
      (user) => user.id === request.userId.trim(),
    );

    if (userIndex < 0)
      return failed('USER_NOT_FOUND', 'Không tìm thấy tài khoản.');

    const currentUser = this.users[userIndex];

    if (currentUser.status === 'LOCKED') {
      return failed('USER_ALREADY_LOCKED', 'Tài khoản đã bị khóa.');
    }

    const reason = getReason(
      currentUser.role === 'LOCKER_OPERATOR'
        ? OPERATOR_LOCK_REASONS
        : RESIDENT_LOCK_REASONS,
      request.reasonCode,
      request.reasonDetail,
    );

    if (typeof reason !== 'string') return reason;

    const updatedUser: ManagedUser = { ...currentUser, status: 'LOCKED' };

    this.users = this.users.map((user, index) =>
      index === userIndex ? updatedUser : user,
    );
    this.addAuditRecord(
      currentUser.role === 'LOCKER_OPERATOR'
        ? 'OPERATOR_LOCKED'
        : 'RESIDENT_LOCKED',
      currentUser.id,
      reason,
      { previousStatus: 'ACTIVE', currentStatus: 'LOCKED' },
    );

    return successful(this.toUserView(updatedUser));
  }

  async unlockAccount(
    request: UnlockAccountRequest,
  ): Promise<ServiceResult<ManagedUserView>> {
    const forcedFailure = await this.beginRequest('UNLOCK_ACCOUNT');

    if (forcedFailure) return forcedFailure;

    const userIndex = this.users.findIndex(
      (user) => user.id === request.userId.trim(),
    );

    if (userIndex < 0)
      return failed('USER_NOT_FOUND', 'Không tìm thấy tài khoản.');

    const currentUser = this.users[userIndex];

    if (currentUser.status === 'ACTIVE') {
      return failed('USER_ALREADY_ACTIVE', 'Tài khoản đang hoạt động.');
    }

    const reason = getReason(
      UNLOCK_REASONS,
      request.reasonCode,
      request.reasonDetail,
    );

    if (typeof reason !== 'string') return reason;

    const updatedUser: ManagedUser = { ...currentUser, status: 'ACTIVE' };

    this.users = this.users.map((user, index) =>
      index === userIndex ? updatedUser : user,
    );
    this.addAuditRecord(
      currentUser.role === 'LOCKER_OPERATOR'
        ? 'OPERATOR_UNLOCKED'
        : 'RESIDENT_UNLOCKED',
      currentUser.id,
      reason,
      { previousStatus: 'LOCKED', currentStatus: 'ACTIVE' },
    );

    return successful(this.toUserView(updatedUser));
  }

  async getLockerAssignment(
    operatorId: string,
  ): Promise<ServiceResult<LockerAssignmentSnapshot>> {
    const forcedFailure = await this.beginRequest('GET_LOCKER_ASSIGNMENT');

    if (forcedFailure) return forcedFailure;

    const operator = this.findOperator(operatorId);

    if (!operator) {
      return failed('OPERATOR_NOT_FOUND', 'Không tìm thấy nhân viên vận hành.');
    }

    return successful({
      assigned: this.lockers
        .filter((locker) => locker.assignedOperatorId === operator.id)
        .map(cloneLocker),
      available: this.lockers
        .filter((locker) => locker.assignedOperatorId === null)
        .map(cloneLocker),
      assignedToOtherOperators: this.lockers
        .filter(
          (locker) =>
            locker.assignedOperatorId !== null &&
            locker.assignedOperatorId !== operator.id,
        )
        .map(cloneLocker),
    });
  }

  async updateLockerAssignments(
    request: UpdateLockerAssignmentRequest,
  ): Promise<ServiceResult<OperatorUserView>> {
    const forcedFailure = await this.beginRequest('UPDATE_LOCKER_ASSIGNMENT');

    if (forcedFailure) return forcedFailure;

    const operator = this.findOperator(request.operatorId);

    if (!operator) {
      return failed('OPERATOR_NOT_FOUND', 'Không tìm thấy nhân viên vận hành.');
    }

    const normalizedLockerIds = request.lockerIds.map((id) => id.trim());
    const requestedLockerIds = new Set(normalizedLockerIds);

    if (
      normalizedLockerIds.some((id) => !id) ||
      requestedLockerIds.size !== normalizedLockerIds.length
    ) {
      return failed(
        'VALIDATION_ERROR',
        'Danh sách tủ được phân công không hợp lệ.',
      );
    }

    const missingLockerId = normalizedLockerIds.find(
      (id) => !this.lockers.some((locker) => locker.id === id),
    );

    if (missingLockerId) {
      return failed('LOCKER_NOT_FOUND', 'Không tìm thấy tủ đã chọn.');
    }

    const conflictingLocker = this.lockers.find(
      (locker) =>
        requestedLockerIds.has(locker.id) &&
        locker.assignedOperatorId !== null &&
        locker.assignedOperatorId !== operator.id,
    );

    if (conflictingLocker) {
      return failed(
        'LOCKER_CONFLICT',
        `Tủ ${conflictingLocker.code} đã được phân công cho nhân viên khác.`,
      );
    }

    const previousLockerIds = this.lockers
      .filter((locker) => locker.assignedOperatorId === operator.id)
      .map((locker) => locker.id);
    const addedLockerIds = normalizedLockerIds.filter(
      (id) => !previousLockerIds.includes(id),
    );
    const removedLockerIds = previousLockerIds.filter(
      (id) => !requestedLockerIds.has(id),
    );

    if (addedLockerIds.length === 0 && removedLockerIds.length === 0) {
      return successful(this.toOperatorView(operator));
    }

    this.lockers = this.lockers.map((locker) => {
      if (requestedLockerIds.has(locker.id)) {
        return { ...locker, assignedOperatorId: operator.id };
      }

      if (locker.assignedOperatorId === operator.id) {
        return { ...locker, assignedOperatorId: null };
      }

      return locker;
    });

    this.addAuditRecord('LOCKER_ASSIGNMENTS_UPDATED', operator.id, undefined, {
      addedLockerIds,
      removedLockerIds,
      currentLockerCount: requestedLockerIds.size,
    });

    return successful(this.toOperatorView(operator));
  }

  async getAuditRecords(): Promise<ServiceResult<MockAuditRecord[]>> {
    const forcedFailure = await this.beginRequest('GET_AUDIT_RECORDS');

    if (forcedFailure) return forcedFailure;

    return successful([...this.auditRecords].reverse().map(cloneAuditRecord));
  }

  private async beginRequest(
    operation: MockServiceOperation,
  ): Promise<ServiceFailure | undefined> {
    await wait(this.latencyMs);

    const failureMessage = this.failureMessages[operation];

    return failureMessage ? failed('MOCK_FAILURE', failureMessage) : undefined;
  }

  private findOperator(operatorId: string) {
    const user = this.users.find((item) => item.id === operatorId.trim());

    return user?.role === 'LOCKER_OPERATOR' ? user : undefined;
  }

  private toOperatorView(operator: OperatorUser): OperatorUserView {
    return {
      ...cloneUser(operator),
      assignedLockerCount: this.lockers.filter(
        (locker) => locker.assignedOperatorId === operator.id,
      ).length,
    };
  }

  private toUserView(user: ManagedUser): ManagedUserView {
    return user.role === 'LOCKER_OPERATOR'
      ? this.toOperatorView(user)
      : cloneUser(user);
  }

  private createId(prefix: string) {
    const id = `${prefix}-${Date.now()}-${this.idSequence}`;

    this.idSequence += 1;

    return id;
  }

  private createNextEmployeeCode() {
    const usedCodes = new Set(
      this.users
        .filter((user): user is OperatorUser => user.role === 'LOCKER_OPERATOR')
        .map((user) => normalizeEmployeeCode(user.employeeCode)),
    );
    const highestSequence = [...usedCodes].reduce((highest, code) => {
      const match = /^NVVH-(\d+)$/.exec(code);
      const sequence = match ? Number(match[1]) : Number.NaN;

      return Number.isSafeInteger(sequence)
        ? Math.max(highest, sequence)
        : highest;
    }, 0);
    let nextSequence = highestSequence + 1;
    let employeeCode = `NVVH-${String(nextSequence).padStart(3, '0')}`;

    while (usedCodes.has(employeeCode)) {
      nextSequence += 1;
      employeeCode = `NVVH-${String(nextSequence).padStart(3, '0')}`;
    }

    return employeeCode;
  }

  private addAuditRecord(
    action: MockAuditAction,
    targetUserId: string,
    reason?: string,
    metadata?: MockAuditRecord['metadata'],
  ) {
    this.auditRecords = [
      ...this.auditRecords,
      {
        id: this.createId('audit'),
        adminId: MOCK_ADMIN_ID,
        action,
        targetUserId,
        reason,
        occurredAt: new Date().toISOString(),
        metadata,
      },
    ];
  }
}

export function createMockUserManagementService(
  options?: MockUserManagementServiceOptions,
): UserManagementService {
  return new MockUserManagementService(options);
}

export const userManagementService = createMockUserManagementService();
