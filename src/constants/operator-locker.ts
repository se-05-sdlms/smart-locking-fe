import type {
  CompartmentFilter,
  CompartmentStatusAction,
  ConnectionStatus,
  DoorStatus,
  LockerListFilter,
  OperationalStatus,
} from '@/types/operator-locker';

type ChipColor = 'success' | 'warning' | 'danger' | 'default' | 'accent';

export type StatusDisplay = { label: string; color: ChipColor };

export const LOCKER_PAGE_SIZE = 20;
export const LOCKER_HISTORY_PAGE_SIZE = 20;

export const CONNECTION_STATUS_DISPLAY: Record<
  ConnectionStatus,
  StatusDisplay
> = {
  Online: { label: 'Trực tuyến', color: 'success' },
  Offline: { label: 'Ngoại tuyến', color: 'danger' },
  Unknown: { label: 'Không xác định', color: 'default' },
};

export const LOCKER_OPERATIONAL_STATUS_DISPLAY: Record<
  OperationalStatus,
  StatusDisplay
> = {
  Operational: { label: 'Đang vận hành', color: 'success' },
  OutOfService: { label: 'Ngừng phục vụ', color: 'warning' },
  Inactive: { label: 'Đã vô hiệu hóa', color: 'default' },
  Unknown: { label: 'Không xác định', color: 'default' },
};

export const COMPARTMENT_OPERATIONAL_STATUS_DISPLAY: Record<
  OperationalStatus,
  StatusDisplay
> = {
  Operational: { label: 'Hoạt động', color: 'success' },
  OutOfService: { label: 'Ngừng phục vụ', color: 'warning' },
  Inactive: { label: 'Đã vô hiệu hóa', color: 'default' },
  Unknown: { label: 'Không xác định', color: 'default' },
};

/** Door state as last reported by the device — not a command result. */
export const DOOR_STATUS_DISPLAY: Record<DoorStatus, StatusDisplay> = {
  Closed: { label: 'Cửa đóng', color: 'default' },
  Open: { label: 'Cửa mở', color: 'accent' },
  Unknown: { label: 'Cửa: chưa rõ', color: 'default' },
};

export const LOCKER_LIST_FILTER_OPTIONS: ReadonlyArray<{
  value: LockerListFilter;
  label: string;
}> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'online', label: 'Trực tuyến' },
  { value: 'offline', label: 'Ngoại tuyến' },
  { value: 'unknown', label: 'Không xác định kết nối' },
  { value: 'out-of-service', label: 'Ngừng phục vụ' },
];

export const COMPARTMENT_FILTER_OPTIONS: ReadonlyArray<{
  value: CompartmentFilter;
  label: string;
}> = [
  { value: 'all', label: 'Tất cả ngăn' },
  { value: 'operational', label: 'Hoạt động' },
  { value: 'out-of-service', label: 'Ngừng phục vụ' },
  { value: 'inactive', label: 'Đã vô hiệu hóa' },
  { value: 'door-open', label: 'Cửa đang mở' },
];

export const COMPARTMENT_STATUS_ACTION_TEXT: Record<
  CompartmentStatusAction,
  {
    button: string;
    title: string;
    confirm: string;
    success: string;
  }
> = {
  'take-out-of-service': {
    button: 'Ngừng phục vụ',
    title: 'Ngừng phục vụ ngăn tủ',
    confirm: 'Xác nhận ngừng phục vụ',
    success: 'Đã chuyển ngăn sang Ngừng phục vụ',
  },
  restore: {
    button: 'Khôi phục hoạt động',
    title: 'Khôi phục hoạt động',
    confirm: 'Đã an toàn, khôi phục',
    success: 'Đã khôi phục hoạt động cho ngăn',
  },
};
