import type { LockersPageDto } from '@/types/user-management-api';

import { ApiError, apiRequest } from '@/services/api-client';
import { ErrorCodes } from '@/constants/error-codes';

export type AssignedLocker = {
  id: string;
  code: string;
  address: string;
};

/**
 * Lockers in the Operator's active assignment scope. The backend filters
 * `GET /api/Lockers` by OperatorAssignment for the LockerOperator role.
 */
export async function getAssignedLockers(
  signal?: AbortSignal,
): Promise<AssignedLocker[]> {
  const response = await apiRequest<LockersPageDto>('/api/Lockers', {
    signal,
  });
  const lockers = Array.isArray(response) ? response : response.items;

  return lockers
    .map(({ id, code, address }) => ({ id, code, address }))
    .sort((left, right) =>
      left.code.localeCompare(right.code, 'vi', {
        numeric: true,
        sensitivity: 'base',
      }),
    );
}

export function getAccountLoadErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case ErrorCodes.AUTH_PASSWORD_CHANGE_REQUIRED:
        return 'Bạn cần đổi mật khẩu lần đầu trước khi tiếp tục.';
      case ErrorCodes.USER_NOT_FOUND:
        return 'Không tìm thấy tài khoản. Vui lòng đăng nhập lại.';
      case ErrorCodes.USER_INACTIVE:
        return 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.';
    }

    if (error.status === 0) {
      return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
    }

    if (error.status === 401) {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }

    if (error.status === 403) {
      return 'Bạn không có quyền xem thông tin này.';
    }

    if (error.status === 408) {
      return 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.';
    }

    if (error.status >= 500) {
      return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
    }
  }

  return 'Không thể tải dữ liệu. Vui lòng thử lại.';
}
