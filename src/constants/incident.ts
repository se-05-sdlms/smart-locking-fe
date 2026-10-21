import type {
  IncidentSource,
  IncidentStatus,
  IncidentStatusFilter,
  IncidentTransition,
} from '@/types/incident';

export const UNKNOWN_INCIDENT_LABEL = 'Không xác định';

/** Backend NormalizeOptional / RequireValue limit for notes and resolution. */
export const INCIDENT_TEXT_MAX_LENGTH = 4000;

export const INCIDENT_STATUS_DISPLAY: Record<
  IncidentStatus,
  {
    label: string;
    color: 'accent' | 'warning' | 'success' | 'danger' | 'default';
  }
> = {
  Open: { label: 'Mới', color: 'accent' },
  Investigating: { label: 'Đang xử lý', color: 'warning' },
  Resolved: { label: 'Đã giải quyết', color: 'success' },
  Escalated: { label: 'Đã chuyển cấp', color: 'danger' },
  Unknown: { label: UNKNOWN_INCIDENT_LABEL, color: 'default' },
};

export const INCIDENT_SOURCE_LABELS: Record<IncidentSource, string> = {
  Resident: 'Cư dân',
  Shipper: 'Người giao hàng',
  Guest: 'Khách',
  System: 'Hệ thống',
  Unknown: UNKNOWN_INCIDENT_LABEL,
};

/** IncidentService.SupportedTypes. */
export const INCIDENT_TYPE_LABELS: Record<string, string> = {
  Locker: 'Tủ',
  Compartment: 'Ngăn tủ',
  Parcel: 'Bưu kiện',
  Retrieval: 'Nhận hàng',
  Return: 'Hàng gửi trả',
  Payment: 'Thanh toán',
  Other: 'Khác',
};

/** ActionType values written by IncidentService. */
export const INCIDENT_ACTION_TYPE_LABELS: Record<string, string> = {
  Created: 'Tạo sự cố',
  NoteAdded: 'Ghi nhận hành động',
  StatusChanged: 'Đổi trạng thái',
};

export const INCIDENT_STATUS_FILTER_OPTIONS: ReadonlyArray<{
  value: IncidentStatusFilter;
  label: string;
}> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'Open', label: INCIDENT_STATUS_DISPLAY.Open.label },
  {
    value: 'Investigating',
    label: INCIDENT_STATUS_DISPLAY.Investigating.label,
  },
  { value: 'Escalated', label: INCIDENT_STATUS_DISPLAY.Escalated.label },
  { value: 'Resolved', label: INCIDENT_STATUS_DISPLAY.Resolved.label },
];

export const INCIDENT_TRANSITION_TEXT: Record<
  IncidentTransition,
  {
    button: string;
    title: string;
    description: string;
    fieldLabel: string;
    fieldRequired: boolean;
    confirm: string;
    success: string;
  }
> = {
  Investigating: {
    button: 'Tiếp nhận xử lý',
    title: 'Tiếp nhận xử lý sự cố',
    description:
      'Sự cố sẽ chuyển sang Đang xử lý. Có thể ghi chú hành động ban đầu.',
    fieldLabel: 'Ghi chú (không bắt buộc)',
    fieldRequired: false,
    confirm: 'Tiếp nhận',
    success: 'Đã tiếp nhận xử lý sự cố',
  },
  Resolved: {
    button: 'Đánh dấu đã giải quyết',
    title: 'Giải quyết sự cố',
    description:
      'Sự cố sẽ được đóng. Sau khi giải quyết không thể ghi thêm hành động.',
    fieldLabel: 'Kết quả xử lý',
    fieldRequired: true,
    confirm: 'Xác nhận đã giải quyết',
    success: 'Đã giải quyết sự cố',
  },
  Escalated: {
    button: 'Chuyển cấp',
    title: 'Chuyển cấp sự cố',
    description:
      'Sự cố sẽ được chuyển cho Quản trị viên. Chỉ Quản trị viên mới tiếp tục xử lý sau khi chuyển cấp.',
    fieldLabel: 'Lý do chuyển cấp',
    fieldRequired: true,
    confirm: 'Xác nhận chuyển cấp',
    success: 'Đã chuyển cấp sự cố',
  },
};
