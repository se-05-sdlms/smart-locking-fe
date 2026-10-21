// Vietnamese labels for GET /api/operational-records.
// Kinds and statuses mirror smart-locking-be `dev`
// (OperationalRecordService + Domain/Enums). Unknown values never show raw
// English text; they fall back to UNKNOWN_RECORD_LABEL.

export const UNKNOWN_RECORD_LABEL = 'Không xác định';

export const OPERATIONAL_RECORD_KIND_LABELS: Record<string, string> = {
  Parcel: 'Bưu kiện',
  Return: 'Hàng gửi trả',
  ReturnRequest: 'Hàng gửi trả',
  Incident: 'Sự cố',
  DeliveryRequest: 'Yêu cầu giao hàng',
  MaintenanceRequest: 'Bảo trì',
  LockerEvent: 'Sự kiện thiết bị',
  Locker: 'Tủ',
  LockerCompartment: 'Ngăn tủ',
};

const OPERATIONAL_STATUS_LABELS: Record<string, string> = {
  Operational: 'Hoạt động',
  OutOfService: 'Ngừng phục vụ',
  Inactive: 'Đã vô hiệu hóa',
};

const RETURN_STATUS_LABELS: Record<string, string> = {
  Created: 'Đã tạo',
  Allocated: 'Đã cấp ngăn',
  Deposited: 'Đã gửi vào tủ',
  Completed: 'Hoàn tất',
  Cancelled: 'Đã hủy',
  Expired: 'Hết hạn',
  Failed: 'Thất bại',
};

export const OPERATIONAL_RECORD_STATUS_LABELS: Record<
  string,
  Record<string, string>
> = {
  Parcel: {
    Stored: 'Đang lưu',
    Overdue: 'Quá hạn',
    Retrieved: 'Đã nhận',
    Removed: 'Đã thu hồi',
  },
  Return: RETURN_STATUS_LABELS,
  ReturnRequest: RETURN_STATUS_LABELS,
  Incident: {
    Open: 'Mới',
    Investigating: 'Đang xử lý',
    Resolved: 'Đã giải quyết',
    Escalated: 'Đã chuyển cấp',
  },
  DeliveryRequest: {
    Started: 'Bắt đầu',
    PendingApproval: 'Chờ duyệt',
    Approved: 'Đã duyệt',
    Allocated: 'Đã cấp ngăn',
    Deposited: 'Đã gửi vào tủ',
    Rejected: 'Bị từ chối',
    Expired: 'Hết hạn',
    Cancelled: 'Đã hủy',
    Failed: 'Thất bại',
  },
  MaintenanceRequest: {
    Open: 'Mới',
    InProgress: 'Đang xử lý',
    Closed: 'Đã đóng',
    Cancelled: 'Đã hủy',
  },
  LockerEvent: {
    ConnectionChanged: 'Thay đổi kết nối',
    DoorChanged: 'Thay đổi trạng thái cửa',
    OperationalStatusChanged: 'Thay đổi trạng thái vận hành',
    DeviceAlert: 'Cảnh báo thiết bị',
  },
  Locker: OPERATIONAL_STATUS_LABELS,
  LockerCompartment: OPERATIONAL_STATUS_LABELS,
};

export function formatOperationalRecordKind(kind: string) {
  return OPERATIONAL_RECORD_KIND_LABELS[kind] ?? UNKNOWN_RECORD_LABEL;
}

export function formatOperationalRecordStatus(kind: string, status: string) {
  return (
    OPERATIONAL_RECORD_STATUS_LABELS[kind]?.[status] ?? UNKNOWN_RECORD_LABEL
  );
}
