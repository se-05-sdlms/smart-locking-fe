import { ErrorCodes } from '@/constants/error-codes';
import { ApiError, apiRequest } from '@/services/api-client';

// smart-locking-be `dev`: OperatorAbsencesController + LockerLocationsController
//   GET  /api/operator-absences                       – own (Operator) / all (Admin)
//   POST /api/operator-absences                       – report an absence
//   POST /api/operator-absences/{id}/proposals        – Admin: (re)compute substitutes
//   POST /api/operator-absences/proposals/{id}/approve – Admin: approve / choose / change
//   POST /api/operator-absences/{id}/cancel           – end coverage (Admin once approved)
//   GET/PUT /api/lockers/{id}/location                – Admin: coordinates + service area
// Distances are between lockers (the substitute's managed "anchor" locker and
// the affected locker), never a staff GPS position or travel time.

export type ReplacementStatus =
  | 'PendingApproval'
  | 'Approved'
  | 'Active'
  | 'NeedsApproval'
  | 'Unassigned'
  | 'Expired'
  | 'Cancelled';

export type ReplacementProposal = {
  id: string;
  lockerId: string;
  originalOperatorUserId: string;
  operatorUserId: string | null;
  status: ReplacementStatus;
  statusReason: string;
  anchorLockerId: string | null;
  distanceKm: number | null;
  serviceArea: string | null;
  loadBefore: number | null;
  loadAfter: number | null;
  policyId: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  activatedAt: string | null;
};

export type OperatorAbsence = {
  id: string;
  operatorUserId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  cancelledAt: string | null;
  proposals: ReplacementProposal[];
};

export type LockerLocation = {
  lockerId: string;
  latitude: number | null;
  longitude: number | null;
  serviceArea: string | null;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
};

export type AbsenceFormValues = {
  operatorUserId: string;
  /** datetime-local, browser time zone */
  startsAt: string;
  endsAt: string;
  reason: string;
};

export type LocationFormValues = {
  latitude: string;
  longitude: string;
  serviceArea: string;
};

type Errors<T> = Partial<Record<keyof T, string>>;

export const REASON_MAX = 1000;

export const replacementStatusLabels: Record<ReplacementStatus, string> = {
  PendingApproval: 'Đề xuất, chờ Admin duyệt',
  Approved: 'Đã duyệt, chờ đến giờ',
  Active: 'Đang thay',
  NeedsApproval: 'Điều kiện thay đổi, cần duyệt lại',
  Unassigned: 'Chưa có người thay',
  Expired: 'Đã hết hạn',
  Cancelled: 'Đã hủy',
};

export const replacementStatusColor = (status: ReplacementStatus) =>
  status === 'Active' || status === 'Approved'
    ? ('success' as const)
    : status === 'Unassigned' || status === 'NeedsApproval'
      ? ('danger' as const)
      : status === 'PendingApproval'
        ? ('warning' as const)
        : ('default' as const);

/** Needs an Admin decision: no candidate, or a suggestion waiting for approval. */
export const needsAdminAction = (
  proposal: Pick<ReplacementProposal, 'status'>,
) =>
  proposal.status === 'Unassigned' ||
  proposal.status === 'NeedsApproval' ||
  proposal.status === 'PendingApproval';

const knownReasons: Record<string, string> = {
  'Missing confirmed coordinates/policy or no eligible original anchor within radius and whole-interval capacity.':
    'Thiếu tọa độ/chính sách, hoặc không có Operator đủ điều kiện có tủ làm mốc trong bán kính và còn tải trong suốt thời gian vắng.',
  'Suggestion only. Explicit Admin approval is required.':
    'Chỉ là đề xuất, cần Admin duyệt.',
  'Selection conditions changed. Review the refreshed proposal and approve again.':
    'Điều kiện chọn đã thay đổi. Xem đề xuất mới và duyệt lại.',
  'System policy changed. Explicit Admin reapproval is required.':
    'Chính sách hệ thống đã thay đổi, cần Admin duyệt lại.',
};

export const translateReason = (reason: string) =>
  knownReasons[reason] ?? reason;

export type AbsenceState = 'upcoming' | 'active' | 'ended' | 'cancelled';

export function absenceState(
  absence: Pick<OperatorAbsence, 'startsAt' | 'endsAt' | 'cancelledAt'>,
  now = Date.now(),
): AbsenceState {
  if (absence.cancelledAt) return 'cancelled';
  if (new Date(absence.endsAt).getTime() <= now) return 'ended';
  if (new Date(absence.startsAt).getTime() <= now) return 'active';

  return 'upcoming';
}

export const absenceStateLabels: Record<AbsenceState, string> = {
  upcoming: 'Sắp tới',
  active: 'Đang vắng',
  ended: 'Đã kết thúc',
  cancelled: 'Đã hủy',
};

/** Operators may cancel only before an Admin approved any coverage. */
export const canOperatorCancel = (absence: OperatorAbsence) =>
  absence.proposals.every((proposal) => !proposal.approvedAt);

export const formatDistance = (km: number | null) =>
  km === null
    ? '—'
    : `${km.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`;

export const emptyAbsenceForm = (operatorUserId = ''): AbsenceFormValues => ({
  operatorUserId,
  startsAt: '',
  endsAt: '',
  reason: '',
});

export function validateAbsenceForm(
  values: AbsenceFormValues,
  now = Date.now(),
) {
  const errors: Errors<AbsenceFormValues> = {};
  const start = new Date(values.startsAt).getTime();
  const end = new Date(values.endsAt).getTime();

  if (!values.operatorUserId) errors.operatorUserId = 'Vui lòng chọn Operator.';
  if (!values.startsAt || Number.isNaN(start))
    errors.startsAt = 'Chọn thời điểm bắt đầu.';
  if (!values.endsAt || Number.isNaN(end))
    errors.endsAt = 'Chọn thời điểm kết thúc.';
  else if (end <= start) errors.endsAt = 'Kết thúc phải sau bắt đầu.';
  else if (end <= now) errors.endsAt = 'Kết thúc phải ở tương lai.';
  const reason = validateReason(values.reason);

  if (reason) errors.reason = reason;

  return errors;
}

export function validateReason(reason: string) {
  const text = reason.trim();

  if (!text) return 'Vui lòng nhập lý do.';
  if (text.length > REASON_MAX) return `Lý do tối đa ${REASON_MAX} ký tự.`;

  return '';
}

export const toLocationForm = (
  location: LockerLocation | null,
): LocationFormValues => ({
  latitude: location?.latitude != null ? String(location.latitude) : '',
  longitude: location?.longitude != null ? String(location.longitude) : '',
  serviceArea: location?.serviceArea ?? '',
});

const coordinate = (value: string) =>
  /^-?\d+(\.\d+)?$/.test(value.trim()) ? Number(value.trim()) : Number.NaN;

/** Mirrors OperatorCoverageService.ConfirmLocationAsync. */
export function validateLocationForm(values: LocationFormValues) {
  const errors: Errors<LocationFormValues> = {};
  const lat = coordinate(values.latitude);
  const lng = coordinate(values.longitude);

  if (Number.isNaN(lat) || lat < -90 || lat > 90)
    errors.latitude = 'Vĩ độ từ -90 đến 90.';
  if (Number.isNaN(lng) || lng < -180 || lng > 180)
    errors.longitude = 'Kinh độ từ -180 đến 180.';
  if (!values.serviceArea.trim())
    errors.serviceArea = 'Vui lòng nhập khu vực phục vụ.';
  else if (values.serviceArea.trim().length > 100)
    errors.serviceArea = 'Khu vực tối đa 100 ký tự.';

  return errors;
}

export function locationWarning(location: LockerLocation | null) {
  if (!location || location.latitude === null || location.longitude === null) {
    return 'Tủ chưa có tọa độ đã xác nhận; hệ thống không thể tự đề xuất người thay cho tủ này.';
  }
  if (!location.serviceArea) return 'Tủ chưa có khu vực phục vụ.';
  if (!location.confirmedAt) return 'Vị trí chưa được Admin xác nhận.';

  return '';
}

export const listAbsences = (signal?: AbortSignal) =>
  apiRequest<OperatorAbsence[]>('/api/operator-absences', { signal });

export const createAbsence = (values: AbsenceFormValues) =>
  apiRequest<OperatorAbsence>('/api/operator-absences', {
    method: 'POST',
    body: JSON.stringify({
      operatorUserId: values.operatorUserId,
      startsAt: new Date(values.startsAt).toISOString(),
      endsAt: new Date(values.endsAt).toISOString(),
      reason: values.reason.trim(),
    }),
  });

export const suggestReplacements = (absenceId: string) =>
  apiRequest<OperatorAbsence>(
    `/api/operator-absences/${encodeURIComponent(absenceId)}/proposals`,
    { method: 'POST' },
  );

/** `operatorUserId` null approves the system suggestion as shown. */
export const approveReplacement = (
  proposalId: string,
  operatorUserId: string | null,
  reason: string,
) =>
  apiRequest<OperatorAbsence>(
    `/api/operator-absences/proposals/${encodeURIComponent(proposalId)}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ operatorUserId, reason: reason.trim() }),
    },
  );

export const cancelAbsence = (absenceId: string, reason: string) =>
  apiRequest<OperatorAbsence>(
    `/api/operator-absences/${encodeURIComponent(absenceId)}/cancel`,
    { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) },
  );

export const getLockerLocation = (lockerId: string, signal?: AbortSignal) =>
  apiRequest<LockerLocation>(
    `/api/lockers/${encodeURIComponent(lockerId)}/location`,
    {
      signal,
    },
  );

export const confirmLockerLocation = (
  lockerId: string,
  values: LocationFormValues,
) =>
  apiRequest<LockerLocation>(
    `/api/lockers/${encodeURIComponent(lockerId)}/location`,
    {
      method: 'PUT',
      body: JSON.stringify({
        latitude: coordinate(values.latitude),
        longitude: coordinate(values.longitude),
        serviceArea: values.serviceArea.trim(),
      }),
    },
  );

export function getCoverageErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'OPERATOR_ABSENCE_OVERLAP':
        return 'Operator đã có khoảng vắng mặt trùng thời gian.';
      case 'OPERATOR_ABSENCE_ADMIN_REVIEW_REQUIRED':
        return 'Đã có người thay được duyệt; hãy nhờ Admin hủy.';
      case 'OPERATOR_ABSENCE_ACCESS_DENIED':
        return 'Bạn chỉ được thao tác với khoảng vắng mặt của mình.';
      case 'OPERATOR_ABSENCE_CLOSED':
        return 'Khoảng vắng mặt đã hủy hoặc đã kết thúc.';
      case 'OPERATOR_ABSENCE_NOT_FOUND':
      case 'OPERATOR_REPLACEMENT_NOT_FOUND':
        return 'Không tìm thấy dữ liệu. Vui lòng tải lại.';
      case 'OPERATOR_REPLACEMENT_CLOSED':
        return 'Phân công thay đã kết thúc. Tạo khoảng vắng mặt mới để gia hạn.';
      case 'OPERATOR_REPLACEMENT_INELIGIBLE':
        return 'Người được chọn không còn đủ điều kiện (tọa độ, chính sách hoặc tải). Hãy tính lại đề xuất.';
      case ErrorCodes.LOCKER_NOT_FOUND:
        return 'Không tìm thấy tủ.';
      case ErrorCodes.INVALID_INPUT:
        return 'Thông tin chưa hợp lệ. Kiểm tra thời gian, lý do hoặc tọa độ.';
    }
    if (error.status === 0)
      return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
    if (error.status === 403)
      return 'Bạn không có quyền thực hiện thao tác này.';
    if (error.status >= 500)
      return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  }

  return 'Không thể xử lý vắng mặt/thay thế. Vui lòng thử lại.';
}
