/**
 * Domain error codes returned by the backend in ProblemDetails `code`
 * (smart-locking-be `dev`: Application/Errors/*ErrorCodes.cs).
 * Services map these codes to Vietnamese messages instead of matching the
 * English `detail` text, which the backend may reword at any time.
 */
export const ErrorCodes = {
  // Common
  INVALID_INPUT: 'validation/invalid_input',
  ACCESS_DENIED: 'common/access_denied',
  INVALID_REQUEST: 'common/invalid_request',
  INTERNAL_ERROR: 'common/internal_error',
  RATE_LIMITED: 'common/rate_limited',
  REQUEST_TIMED_OUT: 'common/request_timed_out',
  ROUTE_NOT_FOUND: 'common/route_not_found',

  // Auth
  AUTH_INVALID_CREDENTIALS: 'auth/invalid_credentials',
  AUTH_INVALID_TOKEN: 'auth/invalid_token',
  AUTH_AUTHENTICATION_REQUIRED: 'auth/authentication_required',
  AUTH_TOKEN_EXPIRED: 'auth/token_expired',
  AUTH_INVALID_REFRESH_TOKEN: 'auth/invalid_refresh_token',
  AUTH_PASSWORD_CHANGE_REQUIRED: 'auth/password_change_required',
  AUTH_INVALID_PASSWORD: 'auth/invalid_password',

  // Locker
  LOCKER_NOT_FOUND: 'locker/not_found',
  LOCKER_NOT_OPERATIONAL: 'locker/not_operational',
  LOCKER_NO_AVAILABLE_COMPARTMENT: 'locker/no_available_compartment',
  LOCKER_ACCESS_DENIED: 'locker/access_denied',
  LOCKER_INVALID_COMPARTMENT: 'locker/invalid_compartment',
  LOCKER_OPEN_FAILED: 'locker/open_failed',
  LOCKER_CODE_ALREADY_EXISTS: 'locker/code_already_exists',
  LOCKER_DEVICE_ALREADY_EXISTS: 'locker/device_already_exists',
  LOCKER_COMPARTMENT_ALREADY_EXISTS: 'locker/compartment_already_exists',

  // Incident
  INCIDENT_NOT_FOUND: 'incident/not_found',
  INCIDENT_INVALID_LINK: 'incident/invalid_link',
  INCIDENT_INVALID_STATE: 'incident/invalid_state',
  INCIDENT_ACCESS_DENIED: 'incident/access_denied',

  // Parcel
  PARCEL_NOT_FOUND: 'parcel/not_found',
  PARCEL_INVALID_STATE: 'parcel/invalid_state',
  PARCEL_ACCESS_DENIED: 'parcel/access_denied',

  // User
  USER_NOT_FOUND: 'user/not_found',
  USER_ALREADY_EXISTS: 'user/already_exists',
  USER_INACTIVE: 'user/inactive',
  USER_ASSIGNMENT_CONFLICT: 'user/assignment_conflict',
  USER_EMAIL_UNAVAILABLE: 'user/email_unavailable',

  // System policy
  POLICY_NOT_FOUND: 'policy/not_found',
  POLICY_IMMUTABLE: 'policy/immutable',

  // Notification
  NOTIFICATION_NOT_FOUND: 'notification/not_found',
  NOTIFICATION_RULE_ALREADY_EXISTS: 'notification/rule_already_exists',

  // Maintenance
  MAINTENANCE_NOT_FOUND: 'maintenance/not_found',
  MAINTENANCE_INVALID_REQUEST: 'maintenance/invalid_request',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
