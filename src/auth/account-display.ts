import type { BackendUserRole, BackendUserStatus } from '@/types/auth';

export const EMPTY_VALUE_LABEL = 'Chưa cập nhật';

export const ACCOUNT_ROLE_LABELS: Record<BackendUserRole, string> = {
  Administrator: 'Quản trị viên',
  LockerOperator: 'Nhân viên vận hành',
  Resident: 'Cư dân',
};

export type AccountStatusDisplay = {
  label: string;
  color: 'success' | 'danger';
};

// Disabled and Locked are both shown as "Đã khóa" across the Admin/Operator UI.
export const ACCOUNT_STATUS_DISPLAY: Record<
  BackendUserStatus,
  AccountStatusDisplay
> = {
  Active: { label: 'Hoạt động', color: 'success' },
  Disabled: { label: 'Đã khóa', color: 'danger' },
  Locked: { label: 'Đã khóa', color: 'danger' },
};

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatOptionalText(value: string | null | undefined) {
  const text = value?.trim();

  return text ? text : EMPTY_VALUE_LABEL;
}

export function formatAccountDateTime(
  value: string | null | undefined,
  emptyLabel = EMPTY_VALUE_LABEL,
) {
  if (!value) return emptyLabel;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? emptyLabel
    : dateTimeFormatter.format(date);
}
