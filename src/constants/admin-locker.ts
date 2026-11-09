import type {
  AdminLockerFilter,
  ConnectionStatus,
  DoorStatus,
  OperationalStatus,
} from '@/types/admin-locker';

type ChipColor = 'success' | 'warning' | 'danger' | 'default' | 'accent';

/** Field limits enforced by LockerService.ValidateAndTrim* on the backend. */
export const LOCKER_FIELD_LIMITS = {
  code: 50,
  address: 500,
  recoveryAddress: 500,
  deviceIdentifier: 100,
  compartmentCode: 50,
  hardwareCode: 100,
} as const;

export const ADMIN_LOCKER_PAGE_SIZE = 10;

export const ADMIN_OPERATIONAL_STATUS_DISPLAY: Record<
  OperationalStatus,
  { label: string; color: ChipColor }
> = {
  Operational: { label: 'Đang vận hành', color: 'success' },
  OutOfService: { label: 'Ngừng phục vụ', color: 'warning' },
  Inactive: { label: 'Đã vô hiệu hóa', color: 'default' },
  Unknown: { label: 'Không xác định', color: 'default' },
};

export const ADMIN_CONNECTION_STATUS_DISPLAY: Record<
  ConnectionStatus,
  { label: string; color: ChipColor }
> = {
  Online: { label: 'Trực tuyến', color: 'success' },
  Offline: { label: 'Ngoại tuyến', color: 'danger' },
  Unknown: { label: 'Không xác định', color: 'default' },
};

export const ADMIN_DOOR_STATUS_LABELS: Record<DoorStatus, string> = {
  Open: 'Cửa mở',
  Closed: 'Cửa đóng',
  Unknown: 'Cửa: chưa rõ',
};

export const ADMIN_LOCKER_FILTER_OPTIONS: ReadonlyArray<{
  value: AdminLockerFilter;
  label: string;
}> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'operational', label: 'Đang vận hành' },
  { value: 'out-of-service', label: 'Ngừng phục vụ' },
  { value: 'inactive', label: 'Đã vô hiệu hóa' },
  { value: 'offline', label: 'Ngoại tuyến' },
];

/** Statuses an Administrator can set in the edit form (UpdateLockerRequest). */
export const EDITABLE_OPERATIONAL_STATUSES = [
  'Operational',
  'OutOfService',
  'Inactive',
] as const;
