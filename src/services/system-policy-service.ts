import { ApiError, apiRequest } from '@/services/api-client';
import { ErrorCodes } from '@/constants/error-codes';

// smart-locking-be `dev`: SystemPoliciesController / SystemPolicyService.

/** `DeliveryApprovalMode`: 0 Auto, 1 Manual. */
export type ApprovalMode = 'Auto' | 'Manual';

export type SystemPolicyDto = {
  id: string;
  version: number;
  defaultApprovalMode: 0 | 1;
  guestSessionTimeoutMinutes: number;
  manualApprovalTimeoutMinutes: number;
  compartmentReservationMinutes: number;
  overdueStartAfterHours: number;
  overdueFeePerHour: number;
  currency: string;
  maxStorageHours: number;
  clearanceEligibilityAfterHours: number;
  clearanceNoticeBeforeHours: number;
  pickupReminderStartDay: number;
  otpMaxAttempts: number;
  otpLockoutMinutes: number;
  enableOtp: boolean;
  enableRemoteUnlock: boolean;
  enableBluetoothUnlock: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  // Operator replacement (#86): all four are set together or all null.
  operatorReplacementRadiusKm?: number | null;
  operatorReplacementMaxLoad?: number | null;
  operatorReplacementAreas?: string[] | null;
  operatorReplacementEligibleUserIds?: string[] | null;
};

export type SaveSystemPolicyRequestDto = Omit<
  SystemPolicyDto,
  'id' | 'version' | 'effectiveTo' | 'isActive' | 'createdAt'
>;

export type PolicyState = 'active' | 'draft' | 'expired';

export type SystemPolicy = Omit<SystemPolicyDto, 'defaultApprovalMode'> & {
  defaultApprovalMode: ApprovalMode;
  state: PolicyState;
};

/** Numeric inputs are kept as strings while editing. */
export type PolicyFormValues = {
  defaultApprovalMode: ApprovalMode;
  guestSessionTimeoutMinutes: string;
  manualApprovalTimeoutMinutes: string;
  compartmentReservationMinutes: string;
  overdueFeePerHour: string;
  currency: string;
  clearanceEligibilityAfterHours: string;
  clearanceNoticeBeforeHours: string;
  pickupReminderStartDay: string;
  otpMaxAttempts: string;
  otpLockoutMinutes: string;
  enableOtp: boolean;
  enableRemoteUnlock: boolean;
  enableBluetoothUnlock: boolean;
  /** `YYYY-MM-DDTHH:mm` in the browser's local time zone. */
  effectiveFrom: string;
  /** Empty means automatic replacement is not configured; no defaults. */
  replacementRadiusKm: string;
  replacementMaxLoad: string;
  /** One service area per line (or comma separated). */
  replacementAreas: string;
  replacementEligibleUserIds: string[];
};

export type PolicyFormErrors = Partial<Record<keyof PolicyFormValues, string>>;

/** Fixed by the backend: 7 normal days followed by 7 overdue days. */
export const OVERDUE_START_AFTER_HOURS = 7 * 24;
export const MAX_STORAGE_HOURS = 14 * 24;

const APPROVAL_MODES: readonly ApprovalMode[] = ['Auto', 'Manual'];

export const APPROVAL_MODE_LABELS: Record<ApprovalMode, string> = {
  Auto: 'Tự động duyệt',
  Manual: 'Cư dân duyệt thủ công',
};

export const POLICY_STATE_DISPLAY: Record<
  PolicyState,
  { label: string; color: 'success' | 'accent' | 'default' }
> = {
  active: { label: 'Đang áp dụng', color: 'success' },
  draft: { label: 'Bản nháp', color: 'accent' },
  expired: { label: 'Đã hết hiệu lực', color: 'default' },
};

export function mapSystemPolicy(dto: SystemPolicyDto): SystemPolicy {
  return {
    ...dto,
    defaultApprovalMode: APPROVAL_MODES[dto.defaultApprovalMode] ?? 'Auto',
    state: dto.isActive ? 'active' : dto.effectiveTo ? 'expired' : 'draft',
  };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** ISO date-time → `YYYY-MM-DDTHH:mm` in local time for datetime-local inputs. */
export function toLocalDateTimeInput(iso: string) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return '';

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toPolicyFormValues(
  policy?: SystemPolicy,
  now = new Date(),
): PolicyFormValues {
  return {
    defaultApprovalMode: policy?.defaultApprovalMode ?? 'Auto',
    guestSessionTimeoutMinutes: String(
      policy?.guestSessionTimeoutMinutes ?? 15,
    ),
    manualApprovalTimeoutMinutes: String(
      policy?.manualApprovalTimeoutMinutes ?? 30,
    ),
    compartmentReservationMinutes: String(
      policy?.compartmentReservationMinutes ?? 10,
    ),
    overdueFeePerHour: String(policy?.overdueFeePerHour ?? 0),
    currency: policy?.currency ?? 'VND',
    clearanceEligibilityAfterHours: String(
      policy?.clearanceEligibilityAfterHours ?? MAX_STORAGE_HOURS,
    ),
    clearanceNoticeBeforeHours: String(
      policy?.clearanceNoticeBeforeHours ?? 24,
    ),
    pickupReminderStartDay: String(policy?.pickupReminderStartDay ?? 5),
    otpMaxAttempts: String(policy?.otpMaxAttempts ?? 5),
    otpLockoutMinutes: String(policy?.otpLockoutMinutes ?? 15),
    enableOtp: policy?.enableOtp ?? true,
    enableRemoteUnlock: policy?.enableRemoteUnlock ?? true,
    enableBluetoothUnlock: policy?.enableBluetoothUnlock ?? false,
    // A new version starts from "now" unless an existing draft is edited.
    effectiveFrom:
      policy && policy.state === 'draft'
        ? toLocalDateTimeInput(policy.effectiveFrom)
        : toLocalDateTimeInput(now.toISOString()),
    replacementRadiusKm:
      policy?.operatorReplacementRadiusKm != null
        ? String(policy.operatorReplacementRadiusKm)
        : '',
    replacementMaxLoad:
      policy?.operatorReplacementMaxLoad != null
        ? String(policy.operatorReplacementMaxLoad)
        : '',
    replacementAreas: (policy?.operatorReplacementAreas ?? []).join('\n'),
    replacementEligibleUserIds: [
      ...(policy?.operatorReplacementEligibleUserIds ?? []),
    ],
  };
}

export function parseReplacementAreas(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((area) => area.trim())
        .filter(Boolean),
    ),
  ];
}

export const isReplacementConfigured = (values: PolicyFormValues) =>
  Boolean(
    values.replacementRadiusKm.trim() ||
      values.replacementMaxLoad.trim() ||
      parseReplacementAreas(values.replacementAreas).length ||
      values.replacementEligibleUserIds.length,
  );

// ---------------------------------------------------------------------------
// Validation (mirrors SystemPolicyService.Validate)
// ---------------------------------------------------------------------------

function integer(value: string) {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
}

export function validatePolicyForm(values: PolicyFormValues): PolicyFormErrors {
  const errors: PolicyFormErrors = {};
  const positive = (key: keyof PolicyFormValues, label: string) => {
    const number = integer(String(values[key]));

    if (number === null || number <= 0)
      errors[key] = `${label} phải là số nguyên lớn hơn 0.`;
  };

  positive('guestSessionTimeoutMinutes', 'Thời gian phiên giao hàng');
  positive('manualApprovalTimeoutMinutes', 'Thời gian chờ cư dân duyệt');
  positive('compartmentReservationMinutes', 'Thời gian giữ ngăn');
  positive('otpMaxAttempts', 'Số lần nhập OTP');
  positive('otpLockoutMinutes', 'Thời gian khóa OTP');

  for (const [key, label] of [
    ['clearanceEligibilityAfterHours', 'Thời điểm được xử lý quá hạn'],
    ['clearanceNoticeBeforeHours', 'Thời điểm báo trước'],
  ] as const) {
    if (integer(values[key]) === null)
      errors[key] = `${label} phải là số nguyên không âm.`;
  }

  const reminderDay = integer(values.pickupReminderStartDay);
  const storageDays = Math.ceil(MAX_STORAGE_HOURS / 24);

  if (reminderDay === null || reminderDay < 1 || reminderDay > storageDays) {
    errors.pickupReminderStartDay = `Ngày bắt đầu nhắc phải từ 1 đến ${storageDays}.`;
  }

  const fee = values.overdueFeePerHour.trim();

  if (!/^\d+(\.\d{1,2})?$/.test(fee)) {
    errors.overdueFeePerHour =
      'Phí quá hạn phải là số không âm (tối đa 2 chữ số thập phân).';
  }

  if (!/^[A-Za-z]{3}$/.test(values.currency.trim())) {
    errors.currency = 'Mã tiền tệ gồm đúng 3 chữ cái (ví dụ VND).';
  }

  // SystemPolicyService.Validate: radius, load, areas and operators together.
  if (isReplacementConfigured(values)) {
    const radius = Number(values.replacementRadiusKm.trim());
    const load = integer(values.replacementMaxLoad);
    const areas = parseReplacementAreas(values.replacementAreas);

    if (
      !/^\d+(\.\d+)?$/.test(values.replacementRadiusKm.trim()) ||
      !(radius > 0)
    ) {
      errors.replacementRadiusKm = 'Bán kính phải là số km lớn hơn 0.';
    }
    if (load === null || load <= 0) {
      errors.replacementMaxLoad = 'Giới hạn tải phải là số nguyên lớn hơn 0.';
    }
    if (!areas.length) {
      errors.replacementAreas = 'Nhập ít nhất một khu vực phục vụ.';
    } else if (areas.some((area) => area.length > 100)) {
      errors.replacementAreas = 'Mỗi khu vực tối đa 100 ký tự.';
    }
    if (!values.replacementEligibleUserIds.length) {
      errors.replacementEligibleUserIds =
        'Chọn ít nhất một Operator đủ điều kiện.';
    }
  }

  if (
    Number.isNaN(new Date(values.effectiveFrom).getTime()) ||
    !values.effectiveFrom
  ) {
    errors.effectiveFrom = 'Vui lòng chọn thời điểm hiệu lực.';
  }

  return errors;
}

export function buildPolicyRequest(
  values: PolicyFormValues,
): SaveSystemPolicyRequestDto {
  return {
    defaultApprovalMode: values.defaultApprovalMode === 'Manual' ? 1 : 0,
    guestSessionTimeoutMinutes: Number(values.guestSessionTimeoutMinutes),
    manualApprovalTimeoutMinutes: Number(values.manualApprovalTimeoutMinutes),
    compartmentReservationMinutes: Number(values.compartmentReservationMinutes),
    overdueStartAfterHours: OVERDUE_START_AFTER_HOURS,
    overdueFeePerHour: Number(values.overdueFeePerHour),
    currency: values.currency.trim().toUpperCase(),
    maxStorageHours: MAX_STORAGE_HOURS,
    clearanceEligibilityAfterHours: Number(
      values.clearanceEligibilityAfterHours,
    ),
    clearanceNoticeBeforeHours: Number(values.clearanceNoticeBeforeHours),
    pickupReminderStartDay: Number(values.pickupReminderStartDay),
    otpMaxAttempts: Number(values.otpMaxAttempts),
    otpLockoutMinutes: Number(values.otpLockoutMinutes),
    enableOtp: values.enableOtp,
    enableRemoteUnlock: values.enableRemoteUnlock,
    enableBluetoothUnlock: values.enableBluetoothUnlock,
    // datetime-local is local time; send an absolute instant.
    effectiveFrom: new Date(values.effectiveFrom).toISOString(),
    ...(isReplacementConfigured(values)
      ? {
          operatorReplacementRadiusKm: Number(
            values.replacementRadiusKm.trim(),
          ),
          operatorReplacementMaxLoad: Number(values.replacementMaxLoad.trim()),
          operatorReplacementAreas: parseReplacementAreas(
            values.replacementAreas,
          ),
          operatorReplacementEligibleUserIds: values.replacementEligibleUserIds,
        }
      : {
          operatorReplacementRadiusKm: null,
          operatorReplacementMaxLoad: null,
          operatorReplacementAreas: null,
          operatorReplacementEligibleUserIds: null,
        }),
  };
}

export function isPolicyFormDirty(
  initial: PolicyFormValues,
  current: PolicyFormValues,
) {
  return JSON.stringify(initial) !== JSON.stringify(current);
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

type PagedPolicies = { items: SystemPolicyDto[]; totalCount: number };

export async function listSystemPolicies(
  signal?: AbortSignal,
): Promise<SystemPolicy[]> {
  const response = await apiRequest<PagedPolicies>(
    '/api/system-policies?pageNumber=1&pageSize=50',
    {
      signal,
    },
  );

  return response.items
    .map(mapSystemPolicy)
    .sort((left, right) => right.version - left.version);
}

export async function createSystemPolicy(values: PolicyFormValues) {
  return mapSystemPolicy(
    await apiRequest<SystemPolicyDto>('/api/system-policies', {
      method: 'POST',
      body: JSON.stringify(buildPolicyRequest(values)),
    }),
  );
}

export async function updateSystemPolicy(id: string, values: PolicyFormValues) {
  return mapSystemPolicy(
    await apiRequest<SystemPolicyDto>(
      `/api/system-policies/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(buildPolicyRequest(values)),
      },
    ),
  );
}

export async function activateSystemPolicy(id: string) {
  return mapSystemPolicy(
    await apiRequest<SystemPolicyDto>(
      `/api/system-policies/${encodeURIComponent(id)}:activate`,
      {
        method: 'POST',
      },
    ),
  );
}

// ---------------------------------------------------------------------------
// Vietnamese error messages
// ---------------------------------------------------------------------------

/** Validation field keys from the backend (`errors` of validation/invalid_input) → Vietnamese. */
const VALIDATION_FIELD_MESSAGES: Record<string, string> = {
  timeout: 'Các thời gian chờ phải lớn hơn 0.',
  storageTimeline: 'Thời gian lưu phải là 7 ngày thường và 7 ngày quá hạn.',
  pickupReminderStartDay: 'Ngày bắt đầu nhắc nằm ngoài thời gian lưu.',
  fee: 'Phí quá hạn hoặc mã tiền tệ không hợp lệ.',
  otpPolicy: 'Cấu hình OTP không hợp lệ.',
};

function getValidationMessage(error: ApiError) {
  const field = Object.keys(error.errors ?? {}).find(
    (key) => key in VALIDATION_FIELD_MESSAGES,
  );

  return field ? VALIDATION_FIELD_MESSAGES[field] : undefined;
}

export function getSystemPolicyErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case ErrorCodes.INVALID_INPUT:
        return (
          getValidationMessage(error) ?? 'Cấu hình chính sách không hợp lệ.'
        );
      case ErrorCodes.POLICY_IMMUTABLE:
        return 'Phiên bản đang áp dụng không thể chỉnh sửa. Hãy tạo phiên bản mới.';
      case ErrorCodes.POLICY_NOT_FOUND:
        return 'Không tìm thấy phiên bản chính sách. Vui lòng tải lại.';
    }

    switch (error.status) {
      case 0:
        return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
      case 400:
        return 'Cấu hình chính sách không hợp lệ.';
      case 401:
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      case 403:
        return 'Bạn không có quyền quản lý chính sách hệ thống.';
      case 404:
        return 'Không tìm thấy phiên bản chính sách. Vui lòng tải lại.';
      case 409:
        return 'Phiên bản đang áp dụng không thể chỉnh sửa. Hãy tạo phiên bản mới.';
      case 429:
        return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
      default:
        if (error.status >= 500)
          return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
    }
  }

  return 'Không thể xử lý chính sách. Vui lòng thử lại.';
}
