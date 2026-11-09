import type {
  AuthTokenResponse,
  AuthUser,
  ChangePasswordRequest,
  LoginRequest,
  RefreshTokenRequest,
} from '@/types/auth';

import { ErrorCodes } from '@/constants/error-codes';
import { MIN_PASSWORD_LENGTH } from '@/auth/password-change';
import { ApiError, apiRequest } from '@/services/api-client';

export function login(request: LoginRequest) {
  return apiRequest<AuthTokenResponse>('/api/auth/login', {
    auth: false,
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function getCurrentUser() {
  return apiRequest<AuthUser>('/api/auth/me');
}

export function changePassword(request: ChangePasswordRequest) {
  return apiRequest<AuthTokenResponse>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function getChangePasswordErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
    }

    switch (error.code) {
      case ErrorCodes.AUTH_INVALID_PASSWORD:
        // The form already rejects a new password equal to the current one,
        // so this code means the current password is wrong.
        return 'Mật khẩu hiện tại không đúng.';
      case ErrorCodes.INVALID_INPUT:
        return error.errors?.newPassword
          ? `Mật khẩu mới chưa hợp lệ (tối thiểu ${MIN_PASSWORD_LENGTH} ký tự).`
          : 'Thông tin đổi mật khẩu không hợp lệ.';
      case ErrorCodes.RATE_LIMITED:
        return 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.';
    }

    if (error.status === 400) {
      return 'Thông tin đổi mật khẩu không hợp lệ.';
    }

    if (error.status === 401) {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }

    if (error.status === 408) {
      return 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.';
    }

    if (error.status === 429) {
      return 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.';
    }

    if (error.status >= 500) {
      return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
    }
  }

  return 'Không thể đổi mật khẩu. Vui lòng thử lại.';
}

export function logout(request: RefreshTokenRequest) {
  return apiRequest<void>('/api/auth/logout', {
    auth: false,
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function getLoginErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
    }

    switch (error.code) {
      case ErrorCodes.AUTH_INVALID_CREDENTIALS:
        return 'Tên đăng nhập hoặc mật khẩu không đúng.';
      case ErrorCodes.USER_INACTIVE:
        return 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.';
      case ErrorCodes.RATE_LIMITED:
        return 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.';
    }

    if (error.status === 400 || error.status === 401) {
      return 'Tên đăng nhập hoặc mật khẩu không đúng.';
    }

    if (error.status === 403) {
      return 'Tài khoản không có quyền đăng nhập vào hệ thống này.';
    }

    if (error.status === 408) {
      return 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.';
    }

    if (error.status === 429) {
      return 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.';
    }

    if (error.status >= 500) {
      return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
    }
  }

  if (error instanceof Error && error.message) return error.message;

  return 'Không thể đăng nhập. Vui lòng thử lại.';
}
