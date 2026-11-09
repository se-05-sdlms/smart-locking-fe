import type {
  EmergencyUnlockBlocker,
  EmergencyUnlockResult,
} from '@/types/emergency-unlock';

/** Mirrors EmergencyUnlockService: trimmed reason of at least 10 characters. */
export const EMERGENCY_REASON_MIN_LENGTH = 10;
export const EMERGENCY_REASON_MAX_LENGTH = 500;

export const EMERGENCY_UNLOCK_RESULT_DISPLAY: Record<
  EmergencyUnlockResult,
  {
    label: string;
    description: string;
    color: 'success' | 'danger' | 'warning';
  }
> = {
  Pending: {
    label: 'Đang chờ thiết bị',
    description: 'Lệnh mở đã được ghi nhận và đang chờ thiết bị phản hồi.',
    color: 'warning',
  },
  Succeeded: {
    label: 'Đã gửi lệnh mở',
    description:
      'Thiết bị đã nhận lệnh mở ngăn. Kiểm tra cửa ngăn tại hiện trường.',
    color: 'success',
  },
  Failed: {
    label: 'Mở khẩn cấp thất bại',
    description:
      'Không thể gửi lệnh mở tới thiết bị. Kiểm tra kết nối và trạng thái ngăn rồi thử lại.',
    color: 'danger',
  },
};

/** Same conditions as LockerAccessService.GetBlockedReason on the backend. */
export const EMERGENCY_UNLOCK_BLOCKER_TEXT: Record<
  EmergencyUnlockBlocker,
  string
> = {
  'locker-not-operational': 'Tủ không ở trạng thái Đang vận hành.',
  'locker-not-online': 'Tủ không trực tuyến.',
  'compartment-not-operational': 'Ngăn không ở trạng thái Hoạt động.',
};
