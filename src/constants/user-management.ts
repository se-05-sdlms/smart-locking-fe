import type {
  AccountStatus,
  OperatorLockReasonCode,
  ResidentLockReasonCode,
  StatusFilter,
  UnlockReasonCode,
  UserRole,
} from '@/types/user-management';

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: 'Hoạt động',
  LOCKED: 'Đã khóa',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  LOCKER_OPERATOR: 'Nhân viên vận hành',
  RESIDENT: 'Cư dân',
};

export const DEFAULT_PAGE_SIZE = 20;

export const ACCOUNT_STATUS_FILTER_OPTIONS: ReadonlyArray<{
  value: StatusFilter;
  label: string;
}> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'ACTIVE', label: ACCOUNT_STATUS_LABELS.ACTIVE },
  { value: 'LOCKED', label: ACCOUNT_STATUS_LABELS.LOCKED },
];

export const MOCK_ADMIN_ID = 'admin-001';

export type ReasonOption<TCode extends string> = {
  code: TCode;
  label: string;
};

export const OPERATOR_LOCK_REASONS: ReadonlyArray<
  ReasonOption<OperatorLockReasonCode>
> = [
  { code: 'POLICY_VIOLATION', label: 'Vi phạm chính sách.' },
  {
    code: 'SUSPICIOUS_ACTIVITY',
    label: 'Hoạt động đáng ngờ hoặc rủi ro bảo mật.',
  },
  { code: 'EMPLOYMENT_ENDED', label: 'Nhân viên đã nghỉ việc.' },
  {
    code: 'ACCESS_NO_LONGER_REQUIRED',
    label: 'Không còn cần quyền truy cập.',
  },
  { code: 'MANAGEMENT_REQUEST', label: 'Theo yêu cầu quản lý.' },
  { code: 'OTHER', label: 'Lý do khác.' },
];

export const RESIDENT_LOCK_REASONS: ReadonlyArray<
  ReasonOption<ResidentLockReasonCode>
> = [
  { code: 'POLICY_VIOLATION', label: 'Vi phạm chính sách.' },
  {
    code: 'SUSPICIOUS_ACTIVITY',
    label: 'Hoạt động đáng ngờ hoặc rủi ro bảo mật.',
  },
  { code: 'ACCOUNT_ABUSE', label: 'Lạm dụng tài khoản.' },
  { code: 'MANAGEMENT_REQUEST', label: 'Theo yêu cầu quản lý.' },
  { code: 'OTHER', label: 'Lý do khác.' },
];

// Temporary values approved for the mock-only implementation. Replace these
// codes with the reviewed backend contract when it becomes available.
export const UNLOCK_REASONS: ReadonlyArray<ReasonOption<UnlockReasonCode>> = [
  {
    code: 'ACCOUNT_VERIFIED_SAFE',
    label: 'Đã xác minh tài khoản an toàn.',
  },
  { code: 'VIOLATION_RESOLVED', label: 'Đã khắc phục vi phạm.' },
  { code: 'LOCKED_BY_MISTAKE', label: 'Khóa nhầm tài khoản.' },
  { code: 'MANAGEMENT_REQUEST', label: 'Theo yêu cầu quản lý.' },
  { code: 'RESTORE_ACCESS', label: 'Khôi phục quyền truy cập.' },
  { code: 'OTHER', label: 'Lý do khác.' },
];
