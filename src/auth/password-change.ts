import type { AppRole } from '@/config/navigation';
import type { AuthSession } from '@/types/auth';

import { getAppRole } from '@/types/auth';

/** Mirrors the backend rule in AuthService.ChangePasswordAsync. */
export const MIN_PASSWORD_LENGTH = 8;

export const FIRST_LOGIN_CHANGE_PASSWORD_PATH =
  '/operator/first-login-change-password';

export function validateCurrentPassword(value: string) {
  return value ? undefined : 'Vui lòng nhập mật khẩu hiện tại.';
}

export function validateNewPassword(value: string, currentPassword: string) {
  if (!value) return 'Vui lòng nhập mật khẩu mới.';

  // Backend rejects passwords made only of whitespace (IsNullOrWhiteSpace).
  if (!value.trim()) return 'Mật khẩu mới không được chỉ gồm khoảng trắng.';

  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
  }

  if (value === currentPassword) {
    return 'Mật khẩu mới phải khác mật khẩu hiện tại.';
  }

  return undefined;
}

export function validateConfirmPassword(value: string, newPassword: string) {
  if (!value) return 'Vui lòng xác nhận mật khẩu mới.';

  if (value !== newPassword) return 'Mật khẩu xác nhận không khớp.';

  return undefined;
}

/**
 * Where a role-protected route should send the current session.
 * `allow` renders the route; every other value is a redirect target.
 */
export type RouteAccess = 'allow' | 'login' | 'forbidden' | 'change-password';

export function resolveRoleAccess(
  session: AuthSession | null,
  role: AppRole,
): RouteAccess {
  if (!session) return 'login';

  if (
    session.user.status !== 'Active' ||
    getAppRole(session.user.role) !== role
  ) {
    return 'forbidden';
  }

  // Backend rejects every operator request until the temporary password
  // is replaced, so the whole operator area is gated here.
  if (role === 'operator' && session.user.mustChangePassword) {
    return 'change-password';
  }

  return 'allow';
}

/**
 * Access rule for the first-login screen itself: only an active operator
 * that still has to replace the temporary password may stay there.
 */
export type PasswordChangeAccess = 'allow' | 'login' | 'forbidden' | 'operator';

export function resolvePasswordChangeAccess(
  session: AuthSession | null,
): PasswordChangeAccess {
  if (!session) return 'login';

  if (
    session.user.status !== 'Active' ||
    getAppRole(session.user.role) !== 'operator'
  ) {
    return 'forbidden';
  }

  return session.user.mustChangePassword ? 'allow' : 'operator';
}
