import type { AppRole } from '@/config/navigation';

export type BackendUserRole = 'Administrator' | 'Resident' | 'LockerOperator';

export type BackendUserStatus = 'Active' | 'Disabled' | 'Locked';

export type LoginRequest = {
  loginIdentifier: string;
  password: string;
};

export type RefreshTokenRequest = {
  refreshToken: string;
};

export type AuthUser = {
  id: string;
  phoneNumber: string | null;
  email: string | null;
  role: BackendUserRole;
  status: BackendUserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

export type AuthTokenResponse = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  user: AuthUser;
};

export type AuthSession = AuthTokenResponse;

export type ValidationProblemDetails = {
  type: string;
  title: string;
  status: number;
  errors: Record<string, string[]>;
  traceId: string;
};

export function getAppRole(role: BackendUserRole): AppRole | null {
  if (role === 'Administrator') return 'admin';
  if (role === 'LockerOperator') return 'operator';

  return null;
}
