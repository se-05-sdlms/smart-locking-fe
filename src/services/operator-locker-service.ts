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
