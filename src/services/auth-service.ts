import type {
  AuthTokenResponse,
  AuthUser,
  ChangePasswordRequest,
  LoginRequest,
  RefreshTokenRequest,
} from '@/types/auth';

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

    if (error.status === 400) {
      if (/current password is incorrect/i.test(error.message)) {
        return 'Mật khẩu hiện tại không đúng.';
      }

      if (/must be different/i.test(error.message)) {
        return 'Mật khẩu mới phải khác mật khẩu hiện tại.';
      }

      if (/at least 8 characters/i.test(error.message)) {
        return 'Mật khẩu mới phải có ít nhất 8 ký tự.';
      }

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
