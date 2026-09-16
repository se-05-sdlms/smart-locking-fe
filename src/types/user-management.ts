export type AccountStatus = 'ACTIVE' | 'LOCKED';

export type UserRole = 'LOCKER_OPERATOR' | 'RESIDENT';

type BaseUser = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  avatarUrl?: string;
  status: AccountStatus;
};

export type OperatorUser = BaseUser & {
  role: 'LOCKER_OPERATOR';
  employeeCode: string;
  createdAt: string;
};

export type ResidentUser = BaseUser & {
  role: 'RESIDENT';
  registeredAt: string;
};

export type ManagedUser = OperatorUser | ResidentUser;

export type OperatorUserView = OperatorUser & {
  assignedLockerCount: number;
};

export type ManagedUserView = OperatorUserView | ResidentUser;

export type Locker = {
  id: string;
  code: string;
  buildingName: string;
  locationLabel: string;
  assignedOperatorId: string | null;
};

export type StatusFilter = AccountStatus | 'ALL';

export type UserSortField =
  | 'fullName'
  | 'employeeCode'
  | 'email'
  | 'phoneNumber'
  | 'assignedLockerCount'
  | 'createdAt'
  | 'registeredAt'
  | 'status';

export type UserSortDirection = 'ascending' | 'descending';

export type UserSortDescriptor = {
  column: UserSortField;
  direction: UserSortDirection;
};

export type UserFilters = {
  role: UserRole;
  search: string;
  status: StatusFilter;
  sortDescriptor: UserSortDescriptor;
  page: number;
  pageSize: number;
};

export type PaginatedResult<T> = {
  items: T[];
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export type CreateOperatorRequest = {
  fullName: string;
  email: string;
  phoneNumber: string;
  avatarUrl?: string;
  lockerIds: string[];
};

export type OperatorLockReasonCode =
  | 'POLICY_VIOLATION'
  | 'SUSPICIOUS_ACTIVITY'
  | 'EMPLOYMENT_ENDED'
  | 'ACCESS_NO_LONGER_REQUIRED'
  | 'MANAGEMENT_REQUEST'
  | 'OTHER';

export type ResidentLockReasonCode =
  | 'POLICY_VIOLATION'
  | 'SUSPICIOUS_ACTIVITY'
  | 'ACCOUNT_ABUSE'
  | 'MANAGEMENT_REQUEST'
  | 'OTHER';

export type LockReasonCode = OperatorLockReasonCode | ResidentLockReasonCode;

export type UnlockReasonCode =
  | 'ACCOUNT_VERIFIED_SAFE'
  | 'VIOLATION_RESOLVED'
  | 'LOCKED_BY_MISTAKE'
  | 'MANAGEMENT_REQUEST'
  | 'RESTORE_ACCESS'
  | 'OTHER';

export type ChangeAccountStatusRequest<TReasonCode extends string> = {
  userId: string;
  reasonCode: TReasonCode;
  reasonDetail?: string;
};

export type LockAccountRequest = ChangeAccountStatusRequest<LockReasonCode>;

export type UnlockAccountRequest = ChangeAccountStatusRequest<UnlockReasonCode>;

export type UpdateLockerAssignmentRequest = {
  operatorId: string;
  lockerIds: string[];
};

export type LockerAssignmentSnapshot = {
  assigned: Locker[];
  available: Locker[];
  assignedToOtherOperators: Locker[];
};

export type MockAuditAction =
  | 'OPERATOR_CREATED'
  | 'OPERATOR_LOCKED'
  | 'OPERATOR_UNLOCKED'
  | 'RESIDENT_LOCKED'
  | 'RESIDENT_UNLOCKED'
  | 'LOCKER_ASSIGNMENTS_UPDATED';

export type MockAuditValue = string | number | boolean | string[];

export type MockAuditRecord = {
  id: string;
  adminId: string;
  action: MockAuditAction;
  targetUserId: string;
  reason?: string;
  occurredAt: string;
  metadata?: Record<string, MockAuditValue>;
};

export type UserManagementErrorCode =
  | 'DUPLICATE_EMAIL'
  | 'DUPLICATE_PHONE'
  | 'INVALID_EMAIL'
  | 'INVALID_PHONE'
  | 'INVALID_REASON'
  | 'LOCKER_CONFLICT'
  | 'LOCKER_NOT_FOUND'
  | 'OPERATOR_NOT_FOUND'
  | 'USER_ALREADY_ACTIVE'
  | 'USER_ALREADY_LOCKED'
  | 'USER_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'MOCK_FAILURE';

export type ServiceSuccess<T> = {
  success: true;
  data: T;
};

export type ServiceFailure = {
  success: false;
  error: {
    code: UserManagementErrorCode;
    message: string;
  };
};

export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

export type MockServiceOperation =
  | 'GET_USERS'
  | 'GET_USER'
  | 'GET_AVAILABLE_LOCKERS'
  | 'CREATE_OPERATOR'
  | 'LOCK_ACCOUNT'
  | 'UNLOCK_ACCOUNT'
  | 'GET_LOCKER_ASSIGNMENT'
  | 'UPDATE_LOCKER_ASSIGNMENT'
  | 'GET_AUDIT_RECORDS';

export type MockUserManagementServiceOptions = {
  latencyMs?: number;
  failureMessages?: Partial<Record<MockServiceOperation, string>>;
  seed?: {
    users?: ReadonlyArray<ManagedUser>;
    lockers?: ReadonlyArray<Locker>;
    auditRecords?: ReadonlyArray<MockAuditRecord>;
  };
};

export interface UserManagementService {
  getUsers(
    filters: UserFilters,
  ): Promise<ServiceResult<PaginatedResult<ManagedUserView>>>;
  getUserById(userId: string): Promise<ServiceResult<ManagedUserView>>;
  getAvailableLockers(): Promise<ServiceResult<Locker[]>>;
  createOperator(
    request: CreateOperatorRequest,
  ): Promise<ServiceResult<OperatorUserView>>;
  lockAccount(
    request: LockAccountRequest,
  ): Promise<ServiceResult<ManagedUserView>>;
  unlockAccount(
    request: UnlockAccountRequest,
  ): Promise<ServiceResult<ManagedUserView>>;
  getLockerAssignment(
    operatorId: string,
  ): Promise<ServiceResult<LockerAssignmentSnapshot>>;
  updateLockerAssignments(
    request: UpdateLockerAssignmentRequest,
  ): Promise<ServiceResult<OperatorUserView>>;
  getAuditRecords(): Promise<ServiceResult<MockAuditRecord[]>>;
}
