import type {
  CompartmentStatusAction,
  LockerCompartmentResponseDto,
  LockerDetailResponseDto,
  LockerHistoryItem,
  LockerSummaryResponseDto,
  OperationalRecordResponseDto,
  OperatorCompartment,
  OperatorLocker,
  OperatorLockerDetail,
  PagedResponseDto,
} from '@/types/operator-locker';

import { LOCKER_HISTORY_PAGE_SIZE } from '@/constants/operator-locker';
import { ApiError, apiRequest } from '@/services/api-client';
import { ErrorCodes } from '@/constants/error-codes';
import {
  buildCompartmentStatusRequest,
  mapCompartment,
  mapHistoryItem,
  mapLockerDetail,
  mapLockerSummary,
} from '@/services/operator-locker-mappers';

type ListResponse<T> = T[] | PagedResponseDto<T>;

function listItems<T>(response: ListResponse<T>): T[] {
  return Array.isArray(response) ? response : response.items;
}

/**
 * Lockers in the Operator's active assignment scope. The backend filters
 * `GET /api/Lockers` by OperatorAssignment for the LockerOperator role.
 */
export async function listAssignedLockers(
  signal?: AbortSignal,
): Promise<OperatorLocker[]> {
  const response = await apiRequest<ListResponse<LockerSummaryResponseDto>>(
    '/api/Lockers',
    { signal },
  );

  return listItems(response)
    .map(mapLockerSummary)
    .sort((left, right) =>
      left.code.localeCompare(right.code, 'vi', { numeric: true }),
    );
}

/** Locker detail with compartments (`GET /api/Lockers/{id}`). */
export async function getLockerDetail(
  lockerId: string,
  signal?: AbortSignal,
): Promise<OperatorLockerDetail> {
  const response = await apiRequest<LockerDetailResponseDto>(
    `/api/Lockers/${encodeURIComponent(lockerId)}`,
    { signal },
  );

  return mapLockerDetail(response);
}

/** Operational status change (`PUT /api/Lockers/{id}/compartments/{cid}/status`). */
export async function updateCompartmentStatus(
  lockerId: string,
  compartmentId: string,
  action: CompartmentStatusAction,
): Promise<OperatorCompartment> {
  const response = await apiRequest<LockerCompartmentResponseDto>(
    `/api/Lockers/${encodeURIComponent(lockerId)}/compartments/${encodeURIComponent(compartmentId)}/status`,
    {
      method: 'PUT',
      body: JSON.stringify(buildCompartmentStatusRequest(action)),
    },
  );

  return mapCompartment(response);
}

/** Recent operational records of one locker (`GET /api/operational-records`). */
export async function getLockerHistory(
  lockerId: string,
  signal?: AbortSignal,
): Promise<LockerHistoryItem[]> {
  const query = new URLSearchParams({
    lockerId,
    pageNumber: '1',
    pageSize: String(LOCKER_HISTORY_PAGE_SIZE),
  });
  const response = await apiRequest<ListResponse<OperationalRecordResponseDto>>(
    `/api/operational-records?${query.toString()}`,
    { signal },
  );

  return listItems(response).map(mapHistoryItem);
}

// ---------------------------------------------------------------------------
// Vietnamese error messages
// ---------------------------------------------------------------------------

function commonErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;

  if (error.status === 0) {
    return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
  }

  if (error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }

  if (error.status === 403) {
    return 'Tủ này không thuộc phạm vi bạn được phân công.';
  }

  if (error.status === 408) {
    return 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.';
  }

  if (error.status === 429) {
    return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
  }

  if (error.status >= 500) {
    return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  }

  return null;
}

export function getLockerLoadErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 404) {
    return 'Không tìm thấy tủ hoặc tủ đã bị gỡ khỏi phạm vi phụ trách.';
  }

  return (
    commonErrorMessage(error) ?? 'Không thể tải dữ liệu tủ. Vui lòng thử lại.'
  );
}

export function getCompartmentStatusErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return 'Không thể cập nhật trạng thái: tủ đã bị vô hiệu hóa hoặc trạng thái không hợp lệ.';
    }

    if (error.status === 404) {
      return 'Không tìm thấy ngăn tủ. Dữ liệu có thể đã thay đổi, vui lòng tải lại.';
    }

    if (error.status === 409) {
      return 'Trạng thái ngăn đã thay đổi bởi người khác. Vui lòng tải lại.';
    }
  }

  return (
    commonErrorMessage(error) ??
    'Không thể cập nhật trạng thái ngăn. Vui lòng thử lại.'
  );
}

// ---------------------------------------------------------------------------
// Locker-level operational status (SRS UC-18):
// `PUT /api/Lockers/{id}/status` with `{ operationalStatus, reason }`.
// The Operator may only pause (OutOfService) or restore (Operational) an
// assigned locker; Inactive is reserved for the Administrator.
// ---------------------------------------------------------------------------

export type LockerStatusTarget = 'Operational' | 'OutOfService';

/** `LockerOperationalStatus` numbers accepted by this endpoint. */
const LOCKER_STATUS_DTO: Record<LockerStatusTarget, 0 | 1> = {
  Operational: 0,
  OutOfService: 1,
};

export const LOCKER_STATUS_REASON_MAX_LENGTH = 500;

export const LOCKER_STATUS_ACTION_TEXT: Record<
  LockerStatusTarget,
  { button: string; title: string; description: string; success: string }
> = {
  OutOfService: {
    button: 'Tạm ngừng tủ',
    title: 'Tạm ngừng phục vụ tủ',
    description:
      'Tủ sẽ không nhận gửi hàng mới cho tới khi được khôi phục. Chỉ tạm ngừng được khi tủ không còn bưu kiện, hàng trả hoặc ngăn đang giữ chỗ.',
    success: 'Đã tạm ngừng phục vụ tủ',
  },
  Operational: {
    button: 'Khôi phục hoạt động',
    title: 'Khôi phục hoạt động tủ',
    description: 'Tủ sẽ nhận gửi hàng trở lại ngay sau khi khôi phục.',
    success: 'Đã khôi phục hoạt động tủ',
  },
};

/**
 * Which locker-level action the Operator can take, or null when none applies
 * (an Inactive locker can only be changed by the Administrator).
 */
export function getLockerStatusTarget(
  status: OperatorLocker['operationalStatus'],
): LockerStatusTarget | null {
  if (status === 'Operational') return 'OutOfService';
  if (status === 'OutOfService') return 'Operational';

  return null;
}

export function validateLockerStatusReason(reason: string) {
  const value = reason.trim();

  if (!value) return 'Vui lòng nhập lý do.';
  if (value.length > LOCKER_STATUS_REASON_MAX_LENGTH) {
    return `Lý do tối đa ${LOCKER_STATUS_REASON_MAX_LENGTH} ký tự.`;
  }

  return undefined;
}

export async function updateLockerStatus(
  lockerId: string,
  target: LockerStatusTarget,
  reason: string,
) {
  await apiRequest<unknown>(
    `/api/Lockers/${encodeURIComponent(lockerId)}/status`,
    {
      method: 'PUT',
      body: JSON.stringify({
        operationalStatus: LOCKER_STATUS_DTO[target],
        reason: reason.trim(),
      }),
    },
  );
}

export function getLockerStatusErrorMessage(
  error: unknown,
  target: LockerStatusTarget,
) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case ErrorCodes.LOCKER_NOT_OPERATIONAL:
        return target === 'OutOfService'
          ? 'Không thể tạm ngừng: tủ còn bưu kiện, hàng trả hoặc ngăn đang giữ chỗ. Hãy xử lý hết trước khi tạm ngừng.'
          : 'Tủ đã bị vô hiệu hóa; chỉ Quản trị viên mới khôi phục được.';
      case ErrorCodes.LOCKER_ACCESS_DENIED:
        return 'Tủ này không thuộc phạm vi bạn được phân công.';
      case ErrorCodes.LOCKER_NOT_FOUND:
        return 'Không tìm thấy tủ. Dữ liệu có thể đã thay đổi, vui lòng tải lại.';
      case ErrorCodes.INVALID_INPUT:
        return 'Lý do không hợp lệ (bắt buộc, tối đa 500 ký tự).';
    }
  }

  return (
    commonErrorMessage(error) ??
    'Không thể cập nhật trạng thái tủ. Vui lòng thử lại.'
  );
}
