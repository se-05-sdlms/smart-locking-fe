import { ApiError, apiRequest } from '@/services/api-client';

// smart-locking-be `dev`: GET /api/Admin/dashboard (AdminDashboardResponse).
// Enums are numbers: LockerConnectionStatus 0 Online / 1 Offline / 2 Unknown,
// LockerOperationalStatus 0 Operational / 1 OutOfService / 2 Inactive,
// AuditLogResult 0 Succeeded / 1 Failed.

export type AdminDashboard = {
  statistics: {
    totalLockers: number;
    activeLockers: number;
    totalCompartments: number;
    availableCompartments: number;
    occupiedCompartments: number;
    totalUsers: number;
    residentCount: number;
    operatorCount: number;
    storedParcelsCount: number;
    newParcelsTodayCount: number;
    overdueParcelsCount: number;
    offlineLockersCount: number;
    openIncidentsCount: number;
    highPriorityIncidentsCount: number;
    totalOverdueFeeAmountLast30Days: number;
  };
  lockerStatus: {
    total: number;
    operational: number;
    maintenance: number;
    suspended: number;
    offline: number;
  };
  compartmentStatus: {
    total: number;
    available: number;
    occupied: number;
    overdue: number;
    maintenance: number;
    disabled: number;
  };
  recentParcelsTrend: Array<{ date: string; dayLabel: string; count: number }>;
  attentionLockers: Array<{
    id: string;
    code: string;
    address: string;
    connectionStatus: number;
    operationalStatus: number;
  }>;
  recentLockers: Array<{
    id: string;
    code: string;
    address: string;
    operatorName: string | null;
    connectionStatus: number;
    operationalStatus: number;
    updatedAt: string;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    actorName: string;
    target: string | null;
    result: number;
    occurredAt: string;
  }>;
  /** Server snapshot time; older backend builds do not send it. */
  generatedAt?: string;
};

export type LoadedDashboard = AdminDashboard & {
  /** `generatedAt` when available, otherwise when the client received the data. */
  loadedAt: string;
};

export const CONNECTION_LABELS = [
  'Trực tuyến',
  'Ngoại tuyến',
  'Không xác định',
] as const;
export const OPERATIONAL_LABELS = [
  'Đang vận hành',
  'Ngừng phục vụ',
  'Đã vô hiệu hóa',
] as const;

export function connectionLabel(value: number) {
  return CONNECTION_LABELS[value] ?? 'Không xác định';
}

export function operationalLabel(value: number) {
  return OPERATIONAL_LABELS[value] ?? 'Không xác định';
}

/** Why a locker needs attention, derived from the reported statuses. */
export function attentionReasons(locker: {
  connectionStatus: number;
  operationalStatus: number;
}) {
  const reasons: string[] = [];

  if (locker.connectionStatus !== 0)
    reasons.push(connectionLabel(locker.connectionStatus));
  if (locker.operationalStatus !== 0)
    reasons.push(operationalLabel(locker.operationalStatus));

  return reasons;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  AssignOperatorScope: 'Phân công Operator',
  RevokeOperatorScope: 'Thu hồi phân công',
  CreateUser: 'Tạo tài khoản',
  UpdateUser: 'Cập nhật tài khoản',
  UpdateUserStatus: 'Đổi trạng thái tài khoản',
  RegisterResident: 'Cư dân đăng ký',
  ResetPassword: 'Đặt lại mật khẩu',
  'Auth.PasswordChanged': 'Đổi mật khẩu',
  'Incident.GuestCreated': 'Khách báo sự cố',
  'Locker.EmergencyUnlock': 'Mở khẩn cấp',
  'Parcel.Transferred': 'Chuyển bưu kiện quá hạn',
  'SystemPolicy.Created': 'Tạo phiên bản chính sách',
  'SystemPolicy.Updated': 'Sửa bản nháp chính sách',
  'SystemPolicy.Activated': 'Áp dụng chính sách',
};

/** Unknown action codes never show raw English. */
export function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? 'Hoạt động hệ thống';
}

/** Share of `total` as a 0–100 percentage for distribution bars. */
export function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export async function getAdminDashboard(
  signal?: AbortSignal,
): Promise<LoadedDashboard> {
  const response = await apiRequest<AdminDashboard>('/api/Admin/dashboard', {
    signal,
  });

  return {
    ...response,
    loadedAt: response.generatedAt ?? new Date().toISOString(),
  };
}

export function getAdminDashboardErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 0)
      return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (error.status === 403)
      return 'Bạn không có quyền xem tổng quan hệ thống.';
    if (error.status >= 500)
      return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  }

  return 'Không thể tải tổng quan hệ thống. Vui lòng thử lại.';
}
