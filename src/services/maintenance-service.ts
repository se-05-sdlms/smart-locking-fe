import { ErrorCodes } from '@/constants/error-codes';
import { ApiError } from '@/services/api-client';

// smart-locking-be `dev`: MaintenanceRequestsController
// (POST/PATCH /api/maintenance-requests). Operators act only on lockers in
// their current scope (including temporary assignments); the backend checks it.

/** `MaintenancePriority`: 0 Low, 1 Normal, 2 High, 3 Urgent. */
export type MaintenancePriority = 0 | 1 | 2 | 3;
/** `MaintenanceStatus`: 0 Open, 1 InProgress, 2 Closed, 3 Cancelled. */
export type MaintenanceStatus = 0 | 1 | 2 | 3;

export const MAINTENANCE_PRIORITY_LABELS: Record<MaintenancePriority, string> =
  { 0: 'Thấp', 1: 'Bình thường', 2: 'Cao', 3: 'Khẩn cấp' };

export const MAINTENANCE_STATUS_DISPLAY: Record<
  MaintenanceStatus,
  { label: string; color: 'default' | 'accent' | 'success' | 'warning' }
> = {
  0: { label: 'Mới tạo', color: 'warning' },
  1: { label: 'Đang xử lý', color: 'accent' },
  2: { label: 'Đã đóng', color: 'success' },
  3: { label: 'Đã hủy', color: 'default' },
};

export const MAINTENANCE_DESCRIPTION_MAX_LENGTH = 1000;
/** Empty compartment selection means the whole locker. */
export const WHOLE_LOCKER = '';

export type MaintenanceFormValues = {
  lockerId: string;
  compartmentId: string;
  incidentId: string;
  priority: MaintenancePriority;
  description: string;
};

export type MaintenanceFormErrors = Partial<
  Record<'lockerId' | 'description', string>
>;

export function emptyMaintenanceForm(
  context: Partial<
    Pick<MaintenanceFormValues, 'lockerId' | 'compartmentId' | 'incidentId'>
  > = {},
): MaintenanceFormValues {
  return {
    lockerId: context.lockerId ?? '',
    compartmentId: context.compartmentId ?? WHOLE_LOCKER,
    incidentId: context.incidentId ?? '',
    priority: 1,
    description: '',
  };
}

/** Changing the locker always drops the previously chosen compartment. */
export function changeMaintenanceLocker(
  values: MaintenanceFormValues,
  lockerId: string,
): MaintenanceFormValues {
  if (values.lockerId === lockerId) return values;

  return { ...values, lockerId, compartmentId: WHOLE_LOCKER, incidentId: '' };
}

export function validateMaintenanceForm(
  values: MaintenanceFormValues,
): MaintenanceFormErrors {
  const errors: MaintenanceFormErrors = {};
  const description = values.description.trim();

  if (!values.lockerId) errors.lockerId = 'Vui lòng chọn tủ cần bảo trì.';
  if (!description) errors.description = 'Vui lòng mô tả lỗi cần xử lý.';
  else if (description.length > MAINTENANCE_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Mô tả tối đa ${MAINTENANCE_DESCRIPTION_MAX_LENGTH} ký tự.`;
  }

  return errors;
}

export function buildCreateMaintenanceRequest(values: MaintenanceFormValues) {
  return {
    lockerId: values.lockerId,
    compartmentId: values.compartmentId || null,
    incidentId: values.incidentId || null,
    priority: values.priority,
    description: values.description.trim(),
  };
}

/** Human readable target shown before submitting ("Tủ LK-01 · ngăn A03" / "cả tủ"). */
export function describeMaintenanceTarget(
  lockerCode: string | undefined,
  compartmentCode: string | undefined,
) {
  if (!lockerCode) return 'Chưa chọn tủ';

  return compartmentCode
    ? `Tủ ${lockerCode} · ngăn ${compartmentCode}`
    : `Tủ ${lockerCode} · bảo trì cả tủ`;
}

const FIELD_MESSAGES: Record<string, string> = {
  description: 'Vui lòng mô tả lỗi cần xử lý.',
  priority: 'Mức ưu tiên không hợp lệ.',
  result: 'Vui lòng nhập kết quả xử lý khi đóng phiếu.',
  notes: 'Vui lòng nhập lý do hủy phiếu.',
  status: 'Trạng thái phiếu không hợp lệ.',
};

export function getMaintenanceErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case ErrorCodes.LOCKER_INVALID_COMPARTMENT:
        return 'Ngăn không thuộc tủ đã chọn. Vui lòng chọn lại ngăn.';
      case ErrorCodes.LOCKER_ACCESS_DENIED:
        return 'Tủ này không thuộc phạm vi bạn đang phụ trách.';
      case ErrorCodes.LOCKER_NOT_FOUND:
        return 'Không tìm thấy tủ. Vui lòng tải lại.';
      case ErrorCodes.MAINTENANCE_NOT_FOUND:
        return 'Không tìm thấy phiếu bảo trì. Vui lòng tải lại.';
      case ErrorCodes.MAINTENANCE_INVALID_REQUEST:
        return error.status === 409
          ? 'Phiếu đã đóng hoặc đã hủy nên không đổi trạng thái được.'
          : 'Sự cố liên kết không thuộc đúng tủ hoặc ngăn đang bảo trì.';
      case ErrorCodes.INVALID_INPUT: {
        const field = Object.keys(error.errors ?? {}).find(
          (key) => key in FIELD_MESSAGES,
        );

        return field
          ? FIELD_MESSAGES[field]
          : 'Thông tin phiếu bảo trì chưa hợp lệ.';
      }
    }

    if (error.status === 0)
      return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
    if (error.status === 403)
      return 'Bạn không có quyền thao tác phiếu bảo trì này.';
    if (error.status >= 500)
      return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  }

  return 'Không thể xử lý phiếu bảo trì. Vui lòng thử lại.';
}

/** Link to the maintenance form pre-filled with a locker/compartment/incident. */
export function maintenanceFormHref(context: {
  lockerId: string;
  compartmentId?: string | null;
  incidentId?: string | null;
}) {
  const query = new URLSearchParams({ lockerId: context.lockerId });

  if (context.compartmentId) query.set('compartmentId', context.compartmentId);
  if (context.incidentId) query.set('incidentId', context.incidentId);

  return `/operator/maintenance?${query}`;
}
