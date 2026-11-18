import type {
  AdminCompartment,
  AdminCompartmentDto,
  AdminLocker,
  AdminLockerDetail,
  AdminLockerDetailDto,
  AdminLockerFilter,
  AdminLockerSummaryDto,
  CompartmentFormErrors,
  CompartmentFormValues,
  ConnectionStatus,
  CreateCompartmentRequestDto,
  CreateLockerRequestDto,
  DoorStatus,
  LockerFormErrors,
  LockerFormValues,
  OperationalStatus,
  OperationalStatusDto,
  UpdateLockerRequestDto,
} from '@/types/admin-locker';

import { LOCKER_FIELD_LIMITS } from '@/constants/admin-locker';
import { ApiError, apiRequest } from '@/services/api-client';
import { ErrorCodes } from '@/constants/error-codes';

// Backend enum order (Domain/Enums/LockerEnums.cs).
const OPERATIONAL = ['Operational', 'OutOfService', 'Inactive'] as const;
const CONNECTION = ['Online', 'Offline', 'Unknown'] as const;
const DOOR = ['Open', 'Closed', 'Unknown'] as const;

function mapEnum<T extends string>(
  value: unknown,
  names: readonly T[],
  fallback: T,
): T {
  if (typeof value === 'number' && Number.isInteger(value))
    return names[value] ?? fallback;
  if (
    typeof value === 'string' &&
    (names as readonly string[]).includes(value)
  ) {
    return value as T;
  }

  return fallback;
}

export const toOperationalStatus = (value: unknown) =>
  mapEnum<OperationalStatus>(value, OPERATIONAL, 'Unknown');
export const toConnectionStatus = (value: unknown) =>
  mapEnum<ConnectionStatus>(value, CONNECTION, 'Unknown');
export const toDoorStatus = (value: unknown) =>
  mapEnum<DoorStatus>(value, DOOR, 'Unknown');

export function toOperationalStatusDto(
  status: LockerFormValues['operationalStatus'],
): OperationalStatusDto {
  return OPERATIONAL.indexOf(status) as OperationalStatusDto;
}

const byCode = (left: { code: string }, right: { code: string }) =>
  left.code.localeCompare(right.code, 'vi', {
    numeric: true,
    sensitivity: 'base',
  });

export function mapAdminLocker(dto: AdminLockerSummaryDto): AdminLocker {
  return {
    id: dto.id,
    code: dto.code,
    address: dto.address,
    recoveryAddress: dto.recoveryAddress,
    deviceIdentifier: dto.deviceIdentifier,
    operationalStatus: toOperationalStatus(dto.operationalStatus),
    connectionStatus: toConnectionStatus(dto.connectionStatus),
    lastSeenAt: dto.lastSeenAt,
    totalCompartments: dto.totalCompartments,
    activeCompartments: dto.activeCompartments,
    updatedAt: dto.updatedAt,
  };
}

export function mapAdminCompartment(
  dto: AdminCompartmentDto,
): AdminCompartment {
  return {
    id: dto.id,
    code: dto.code,
    hardwareCode: dto.hardwareCode,
    hardwareChannel: dto.hardwareChannel,
    operationalStatus: toOperationalStatus(dto.operationalStatus),
    doorStatus: toDoorStatus(dto.doorStatus),
  };
}

export function mapAdminLockerDetail(
  dto: AdminLockerDetailDto,
): AdminLockerDetail {
  const compartments = dto.compartments.map(mapAdminCompartment).sort(byCode);

  return {
    id: dto.id,
    code: dto.code,
    address: dto.address,
    recoveryAddress: dto.recoveryAddress,
    deviceIdentifier: dto.deviceIdentifier,
    operationalStatus: toOperationalStatus(dto.operationalStatus),
    connectionStatus: toConnectionStatus(dto.connectionStatus),
    lastSeenAt: dto.lastSeenAt,
    totalCompartments: compartments.length,
    activeCompartments: compartments.filter(
      (item) => item.operationalStatus === 'Operational',
    ).length,
    updatedAt: dto.updatedAt,
    compartments,
  };
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export function filterAdminLockers(
  lockers: AdminLocker[],
  keyword: string,
  filter: AdminLockerFilter,
) {
  const needle = keyword.trim().toLocaleLowerCase('vi');

  return lockers.filter((locker) => {
    const matchesKeyword =
      !needle ||
      [
        locker.code,
        locker.address,
        locker.recoveryAddress,
        locker.deviceIdentifier,
      ].some((value) => value.toLocaleLowerCase('vi').includes(needle));

    const matchesFilter =
      filter === 'all' ||
      (filter === 'operational' &&
        locker.operationalStatus === 'Operational') ||
      (filter === 'out-of-service' &&
        locker.operationalStatus === 'OutOfService') ||
      (filter === 'inactive' && locker.operationalStatus === 'Inactive') ||
      (filter === 'offline' && locker.connectionStatus === 'Offline');

    return matchesKeyword && matchesFilter;
  });
}

// ---------------------------------------------------------------------------
// Validation (mirrors LockerService.ValidateAndTrim*)
// ---------------------------------------------------------------------------

function requireText(value: string, label: string, max: number) {
  const text = value.trim();

  if (!text) return `Vui lòng nhập ${label}.`;
  if (text.length > max)
    return `${label[0].toLocaleUpperCase('vi')}${label.slice(1)} không được vượt quá ${max} ký tự.`;

  return undefined;
}

export function validateLockerForm(values: LockerFormValues): LockerFormErrors {
  const errors: LockerFormErrors = {
    code: requireText(values.code, 'mã tủ', LOCKER_FIELD_LIMITS.code),
    address: requireText(
      values.address,
      'địa chỉ',
      LOCKER_FIELD_LIMITS.address,
    ),
    recoveryAddress: requireText(
      values.recoveryAddress,
      'địa chỉ tập kết hàng quá hạn',
      LOCKER_FIELD_LIMITS.recoveryAddress,
    ),
    deviceIdentifier: requireText(
      values.deviceIdentifier,
      'mã thiết bị',
      LOCKER_FIELD_LIMITS.deviceIdentifier,
    ),
  };

  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message),
  ) as LockerFormErrors;
}

export function validateCompartmentForm(
  values: CompartmentFormValues,
): CompartmentFormErrors {
  const channel = values.hardwareChannel.trim();
  const errors: CompartmentFormErrors = {
    code: requireText(
      values.code,
      'mã ngăn',
      LOCKER_FIELD_LIMITS.compartmentCode,
    ),
    hardwareCode: requireText(
      values.hardwareCode,
      'mã phần cứng',
      LOCKER_FIELD_LIMITS.hardwareCode,
    ),
    hardwareChannel: !channel
      ? 'Vui lòng nhập kênh phần cứng.'
      : !/^\d+$/.test(channel) || Number(channel) <= 0
        ? 'Kênh phần cứng phải là số nguyên lớn hơn 0.'
        : undefined,
  };

  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message),
  ) as CompartmentFormErrors;
}

export function buildCreateLockerRequest(
  values: LockerFormValues,
): CreateLockerRequestDto {
  return {
    code: values.code.trim(),
    address: values.address.trim(),
    recoveryAddress: values.recoveryAddress.trim(),
    deviceIdentifier: values.deviceIdentifier.trim(),
  };
}

export function buildUpdateLockerRequest(
  values: LockerFormValues,
): UpdateLockerRequestDto {
  return {
    ...buildCreateLockerRequest(values),
    operationalStatus: toOperationalStatusDto(values.operationalStatus),
  };
}

export function buildCreateCompartmentRequest(
  values: CompartmentFormValues,
): CreateCompartmentRequestDto {
  return {
    code: values.code.trim(),
    hardwareCode: values.hardwareCode.trim(),
    hardwareChannel: Number(values.hardwareChannel.trim()),
  };
}

export function toLockerFormValues(locker?: AdminLocker): LockerFormValues {
  return {
    code: locker?.code ?? '',
    address: locker?.address ?? '',
    recoveryAddress: locker?.recoveryAddress ?? '',
    deviceIdentifier: locker?.deviceIdentifier ?? '',
    operationalStatus:
      locker && locker.operationalStatus !== 'Unknown'
        ? locker.operationalStatus
        : 'Operational',
  };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

type ListResponse<T> = T[] | { items: T[] };

export async function listAdminLockers(
  signal?: AbortSignal,
): Promise<AdminLocker[]> {
  const response = await apiRequest<ListResponse<AdminLockerSummaryDto>>(
    '/api/Lockers',
    {
      signal,
    },
  );
  const items = Array.isArray(response) ? response : response.items;

  return items.map(mapAdminLocker).sort(byCode);
}

export async function getAdminLockerDetail(
  lockerId: string,
  signal?: AbortSignal,
): Promise<AdminLockerDetail> {
  return mapAdminLockerDetail(
    await apiRequest<AdminLockerDetailDto>(
      `/api/Lockers/${encodeURIComponent(lockerId)}`,
      {
        signal,
      },
    ),
  );
}

export async function createLocker(
  values: LockerFormValues,
): Promise<AdminLockerDetail> {
  return mapAdminLockerDetail(
    await apiRequest<AdminLockerDetailDto>('/api/Lockers', {
      method: 'POST',
      body: JSON.stringify(buildCreateLockerRequest(values)),
    }),
  );
}

export async function updateLocker(
  lockerId: string,
  values: LockerFormValues,
): Promise<AdminLockerDetail> {
  return mapAdminLockerDetail(
    await apiRequest<AdminLockerDetailDto>(
      `/api/Lockers/${encodeURIComponent(lockerId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(buildUpdateLockerRequest(values)),
      },
    ),
  );
}

/** Soft delete: the backend sets the locker to Inactive and keeps its history. */
export function deactivateLocker(lockerId: string) {
  return apiRequest<void>(`/api/Lockers/${encodeURIComponent(lockerId)}`, {
    method: 'DELETE',
  });
}

export async function createCompartment(
  lockerId: string,
  values: CompartmentFormValues,
): Promise<AdminCompartment> {
  return mapAdminCompartment(
    await apiRequest<AdminCompartmentDto>(
      `/api/Lockers/${encodeURIComponent(lockerId)}/compartments`,
      {
        method: 'POST',
        body: JSON.stringify(buildCreateCompartmentRequest(values)),
      },
    ),
  );
}

const compartmentPath = (lockerId: string, compartmentId: string) =>
  `/api/Lockers/${encodeURIComponent(lockerId)}/compartments/${encodeURIComponent(compartmentId)}`;

/** Edit a compartment's code and hardware mapping (PUT …/compartments/{cid}). */
export async function updateCompartment(
  lockerId: string,
  compartmentId: string,
  values: CompartmentFormValues,
): Promise<AdminCompartment> {
  return mapAdminCompartment(
    await apiRequest<AdminCompartmentDto>(
      compartmentPath(lockerId, compartmentId),
      {
        method: 'PUT',
        body: JSON.stringify(buildCreateCompartmentRequest(values)),
      },
    ),
  );
}

export type CompartmentStatusTarget = 'Operational' | 'Inactive';

/** Admin deactivates or reactivates a compartment (PUT …/compartments/{cid}/status). */
export async function setCompartmentStatus(
  lockerId: string,
  compartmentId: string,
  target: CompartmentStatusTarget,
): Promise<AdminCompartment> {
  return mapAdminCompartment(
    await apiRequest<AdminCompartmentDto>(
      `${compartmentPath(lockerId, compartmentId)}/status`,
      {
        method: 'PUT',
        body: JSON.stringify({
          operationalStatus: toOperationalStatusDto(target),
        }),
      },
    ),
  );
}

/** Form values for editing an existing compartment. */
export function toCompartmentFormValues(
  compartment: Pick<
    AdminCompartment,
    'code' | 'hardwareCode' | 'hardwareChannel'
  >,
): CompartmentFormValues {
  return {
    code: compartment.code,
    hardwareCode: compartment.hardwareCode,
    hardwareChannel: String(compartment.hardwareChannel),
  };
}

/** Next status for the compartment toggle: deactivate unless already inactive. */
export function getCompartmentStatusTarget(
  status: AdminCompartment['operationalStatus'],
): CompartmentStatusTarget {
  return status === 'Inactive' ? 'Operational' : 'Inactive';
}

// ---------------------------------------------------------------------------
// Vietnamese error messages
// ---------------------------------------------------------------------------

/** Backend validation field keys → Vietnamese (validation/invalid_input). */
const LOCKER_FIELD_MESSAGES: Record<string, string> = {
  code: 'Mã tủ hoặc mã ngăn không hợp lệ (bắt buộc, không quá giới hạn ký tự).',
  address: 'Địa chỉ đặt tủ không hợp lệ (bắt buộc, tối đa 500 ký tự).',
  recoveryAddress: 'Địa chỉ tập kết không hợp lệ (bắt buộc, tối đa 500 ký tự).',
  deviceIdentifier: 'Mã thiết bị không hợp lệ (bắt buộc, tối đa 100 ký tự).',
  hardwareCode: 'Mã phần cứng không hợp lệ (bắt buộc, tối đa 100 ký tự).',
  hardwareChannel: 'Kênh phần cứng phải là số nguyên dương.',
  operationalStatus: 'Trạng thái hoạt động không hợp lệ.',
};

function validationMessage(error: ApiError) {
  const field = Object.keys(error.errors ?? {})
    .map((key) => key.charAt(0).toLowerCase() + key.slice(1))
    .find((key) => key in LOCKER_FIELD_MESSAGES);

  return field ? LOCKER_FIELD_MESSAGES[field] : undefined;
}

/** Conflicts mapped from backend error codes (SRS UC-24). */
const LOCKER_CODE_MESSAGES: Partial<Record<string, string>> = {
  [ErrorCodes.LOCKER_ACTIVE_OPERATIONS]:
    'Không thể thực hiện: tủ hoặc ngăn còn bưu kiện, hàng trả hoặc lượt giữ chỗ đang hiệu lực. Hãy xử lý hết trước khi ngừng hoạt động hoặc sửa cấu hình.',
  [ErrorCodes.LOCKER_COMPARTMENT_ALREADY_EXISTS]:
    'Mã ngăn, mã phần cứng hoặc kênh phần cứng đã được dùng trong tủ này.',
  [ErrorCodes.LOCKER_CODE_ALREADY_EXISTS]: 'Mã tủ đã tồn tại.',
  [ErrorCodes.LOCKER_DEVICE_ALREADY_EXISTS]:
    'Mã thiết bị đã được dùng cho tủ khác.',
  [ErrorCodes.LOCKER_NOT_OPERATIONAL]:
    'Tủ đã bị vô hiệu hóa nên không thể thực hiện thao tác này.',
  [ErrorCodes.LOCKER_INVALID_COMPARTMENT]:
    'Không tìm thấy ngăn trong tủ này. Dữ liệu có thể đã thay đổi, vui lòng tải lại.',
  [ErrorCodes.LOCKER_NOT_FOUND]:
    'Không tìm thấy tủ. Dữ liệu có thể đã thay đổi, vui lòng tải lại.',
};

export function getAdminLockerErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const byCode = error.code ? LOCKER_CODE_MESSAGES[error.code] : undefined;

    if (byCode) return byCode;
    if (error.code === ErrorCodes.INVALID_INPUT) {
      return (
        validationMessage(error) ??
        'Thông tin tủ chưa hợp lệ. Vui lòng kiểm tra lại.'
      );
    }

    switch (error.status) {
      case 0:
        return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
      case 400:
        return 'Thông tin tủ chưa hợp lệ. Vui lòng kiểm tra lại.';
      case 401:
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      case 403:
        return 'Bạn không có quyền thực hiện thao tác này.';
      case 404:
        return 'Không tìm thấy tủ. Dữ liệu có thể đã thay đổi, vui lòng tải lại.';
      case 408:
        return 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.';
      case 429:
        return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
      default:
        if (error.status >= 500)
          return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
    }
  }

  return 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
}
