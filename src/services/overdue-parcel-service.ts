import type {
  OverdueChargeStatus,
  OverdueParcel,
  OverdueParcelDetail,
  OverdueTransfer,
  OverdueTransferResponseDto,
  ParcelDetailDto,
  ParcelListItemDto,
  ParcelStatus,
} from '@/types/overdue-parcel';

import { ApiError, apiRequest } from '@/services/api-client';

const PARCEL_STATUSES = ['Stored', 'Overdue', 'Retrieved', 'Removed'] as const;
const CHARGE_STATUSES = ['Outstanding', 'Paid'] as const;

export const PARCEL_STATUS_DISPLAY: Record<
  ParcelStatus,
  { label: string; color: 'warning' | 'danger' | 'success' | 'default' }
> = {
  Stored: { label: 'Đang lưu', color: 'warning' },
  Overdue: { label: 'Quá hạn', color: 'danger' },
  Retrieved: { label: 'Đã nhận', color: 'success' },
  Removed: { label: 'Đã thu hồi khỏi tủ', color: 'success' },
  Unknown: { label: 'Không xác định', color: 'default' },
};

export const OVERDUE_CHARGE_STATUS_LABELS: Record<OverdueChargeStatus, string> =
  {
    Outstanding: 'Chưa thanh toán',
    Paid: 'Đã thanh toán',
    Unknown: 'Không xác định',
  };

/** Accepts string names (current contract) and numbers (backend enum order). */
function mapEnum<T extends string>(
  value: unknown,
  names: readonly T[],
  fallback: T,
): T {
  if (
    typeof value === 'string' &&
    (names as readonly string[]).includes(value)
  ) {
    return value as T;
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    return names[value] ?? fallback;
  }

  return fallback;
}

export function toParcelStatus(value: unknown): ParcelStatus {
  return mapEnum<ParcelStatus>(value, PARCEL_STATUSES, 'Unknown');
}

export function toOverdueChargeStatus(
  value: unknown,
): OverdueChargeStatus | null {
  if (value === null || value === undefined) return null;

  return mapEnum<OverdueChargeStatus>(value, CHARGE_STATUSES, 'Unknown');
}

export function mapOverdueParcel(dto: ParcelListItemDto): OverdueParcel {
  return {
    id: dto.id,
    parcelCode: dto.parcelCode,
    status: toParcelStatus(dto.status),
    lockerId: dto.lockerId,
    lockerCode: dto.lockerCode,
    lockerAddress: dto.lockerAddress,
    compartmentCode: dto.compartmentCode,
    storedAt: dto.storedAt,
    pickupDueAt: dto.pickupDueAt,
    maxStorageUntil: dto.maxStorageUntil,
    overdueAmount: dto.overdueAmount,
    currency: dto.currency,
    overdueChargeStatus: toOverdueChargeStatus(dto.overdueChargeStatus),
  };
}

export function mapOverdueParcelDetail(
  dto: ParcelDetailDto,
): OverdueParcelDetail {
  return {
    ...mapOverdueParcel(dto),
    recoveryAddress: dto.lockerRecoveryAddress,
    parcelImageUrl: dto.parcelImageUrl,
    shipperName: dto.shipperName,
    shipperPhone: dto.shipperPhone,
    removedAt: dto.removedAt,
  };
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Time since the maximum storage deadline, e.g. "2 ngày 5 giờ". Purely a
 * display value: eligibility is decided by the backend (ClearancePending).
 */
export function formatTimePastDeadline(
  maxStorageUntil: string,
  now = new Date(),
) {
  const deadline = new Date(maxStorageUntil).getTime();

  if (Number.isNaN(deadline)) return 'Không xác định';

  const totalHours = Math.max(
    0,
    Math.floor((now.getTime() - deadline) / 3_600_000),
  );
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (!days && !hours) return 'Dưới 1 giờ';
  if (!days) return `${hours} giờ`;
  if (!hours) return `${days} ngày`;

  return `${days} ngày ${hours} giờ`;
}

export function formatParcelDateTime(value: string | null | undefined) {
  if (!value) return '—';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date);
}

export function formatOverdueAmount(
  amount: number | null,
  currency: string | null,
) {
  if (amount === null) return 'Chưa phát sinh';

  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: currency || 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency ?? ''}`.trim();
  }
}

/** Distinct lockers present in the queue, for the locker filter. */
export function getQueueLockers(parcels: OverdueParcel[]) {
  const lockers = new Map<string, string>();

  for (const parcel of parcels) lockers.set(parcel.lockerId, parcel.lockerCode);

  return [...lockers.entries()]
    .map(([id, code]) => ({ id, code }))
    .sort((left, right) =>
      left.code.localeCompare(right.code, 'vi', { numeric: true }),
    );
}

export function filterOverdueParcels(
  parcels: OverdueParcel[],
  keyword: string,
  lockerId: string,
) {
  const needle = keyword.trim().toLocaleLowerCase('vi');

  return parcels.filter(
    (parcel) =>
      (lockerId === 'all' || parcel.lockerId === lockerId) &&
      (!needle ||
        [parcel.parcelCode, parcel.lockerCode, parcel.compartmentCode].some(
          (value) => value.toLocaleLowerCase('vi').includes(needle),
        )),
  );
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Clearance queue: `GET /api/parcels?view=ClearancePending`. The backend keeps
 * only Stored/Overdue parcels past MaxStorageUntil in the Operator's scope.
 */
export async function listClearancePendingParcels(
  signal?: AbortSignal,
): Promise<OverdueParcel[]> {
  const response = await apiRequest<ParcelListItemDto[]>(
    '/api/parcels?view=ClearancePending',
    { signal },
  );

  return response
    .map(mapOverdueParcel)
    .sort((left, right) =>
      left.maxStorageUntil.localeCompare(right.maxStorageUntil),
    );
}

/** `GET /api/parcels/{id}`. */
export async function getOverdueParcelDetail(
  parcelId: string,
  signal?: AbortSignal,
): Promise<OverdueParcelDetail> {
  const response = await apiRequest<ParcelDetailDto>(
    `/api/parcels/${encodeURIComponent(parcelId)}`,
    { signal },
  );

  return mapOverdueParcelDetail(response);
}

/**
 * `POST /api/parcels/{id}:transferToCollectionPoint` — marks the parcel as
 * Removed, audits the action and notifies the resident.
 */
export async function transferToCollectionPoint(
  parcelId: string,
): Promise<OverdueTransfer> {
  const response = await apiRequest<OverdueTransferResponseDto>(
    `/api/parcels/${encodeURIComponent(parcelId)}:transferToCollectionPoint`,
    { method: 'POST' },
  );

  return {
    parcelId: response.parcelId,
    parcelCode: response.parcelCode,
    collectionAddress: response.collectionAddress,
    status: toParcelStatus(response.status),
  };
}

// ---------------------------------------------------------------------------
// Vietnamese error messages
// ---------------------------------------------------------------------------

function commonErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;

  switch (error.status) {
    case 0:
      return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
    case 401:
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    case 403:
      return 'Bưu kiện này không thuộc tủ bạn được phân công.';
    case 404:
      return 'Không tìm thấy bưu kiện. Bưu kiện có thể đã được xử lý.';
    case 408:
      return 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.';
    case 429:
      return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
    default:
      return error.status >= 500
        ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.'
        : null;
  }
}

export function getOverdueLoadErrorMessage(error: unknown) {
  return (
    commonErrorMessage(error) ??
    'Không thể tải danh sách bưu kiện quá hạn. Vui lòng thử lại.'
  );
}

export function getTransferErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 409) {
    return 'Bưu kiện chưa đủ điều kiện thu hồi hoặc đã được xử lý. Vui lòng tải lại.';
  }

  return (
    commonErrorMessage(error) ?? 'Không thể chuyển bưu kiện. Vui lòng thử lại.'
  );
}
