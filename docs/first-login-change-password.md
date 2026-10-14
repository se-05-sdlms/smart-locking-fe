# First-Login Password Change

## Purpose

Force a Locker Operator to replace the temporary password issued by the Administrator before using the Operator portal. This implements SRS Use Case 02 and Screen 08 (First-login Password Change Screen).

GitHub issue: `#45` — branch `feature/45-first-login-change-password`.

## Confirmed Scope

The task includes:

- Detecting `mustChangePassword` on the authenticated user returned by `POST /api/auth/login` and `GET /api/auth/me`.
- Blocking every `/operator/*` route while `mustChangePassword` is `true`.
- A standalone screen at `/operator/first-login-change-password` with current, new, and confirmation password fields.
- Calling `POST /api/auth/change-password` and replacing the stored session with the response.
- Sign-out from the screen, so a user is never trapped.

The task excludes:

- Administrator first-login handling (see [Known Limitations](#known-limitations)).
- The optional password change inside Operator account settings (issue `#18`).
- Forgot-password and reset-password flows.

## Backend Contract

Verified against `smart-locking-be` branch `dev`.

| Item | Value |
|---|---|
| Endpoint | `POST /api/auth/change-password` |
| Controller | `smart-locking-be.API/Controllers/AuthController.cs` |
| Authorization | `Authorization: Bearer <accessToken>` (`[Authorize]`) |
| Request DTO | `{ "currentPassword": string, "newPassword": string }` |
| Success response | `AuthTokenResponse` — a new access/refresh token pair and `user.mustChangePassword = false` |
| Side effects | All existing refresh tokens are revoked; audit log `Auth.PasswordChanged` is written |

Server rules in `AuthService.ChangePasswordAsync`:

| Rule | Backend message (HTTP 400) | Vietnamese UI message |
|---|---|---|
| Current password must match | `Current password is incorrect.` | `Mật khẩu hiện tại không đúng.` |
| New password has at least 8 characters and is not whitespace only | `Password must contain at least 8 characters.` | `Mật khẩu mới phải có ít nhất 8 ký tự.` |
| New password differs from the current one | `New password must be different from the current password.` | `Mật khẩu mới phải khác mật khẩu hiện tại.` |

The two `ArgumentException` rules come back as ASP.NET ProblemDetails (`{ "title": "Bad Request", "status": 400, "detail": "..." }`) while the current-password rule returns `{ "message": "..." }`. `api-client` reads `message`, then `detail`, then `title`, so both shapes reach the Vietnamese mapping.

While the token claim `must_change_password` is `true`, `PasswordChangeRequiredMiddleware` answers every other API with `403` and code `PasswordChangeRequired`. Only these endpoints stay available:

- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/refresh-token`
- `POST /api/auth/change-password`

This is why the frontend gates the whole Operator area instead of letting individual pages fail.

## Flow

1. The Operator signs in on `/login`.
2. The login page navigates to `/operator`.
3. `RequireRole` sees `mustChangePassword = true` and redirects to `/operator/first-login-change-password`.
4. The Operator submits the form. The submit button is disabled while the request is pending, so the request cannot be sent twice.
5. On success the new session is saved, `mustChangePassword` becomes `false`, and the Operator is redirected to `/operator`.
6. On failure a Vietnamese error is shown and the form stays editable.

## Route Access Rules

Pure functions in `src/auth/password-change.ts` decide every redirect. The React guards in `src/auth/route-guards.tsx` only translate the result into `<Navigate>`.

`resolveRoleAccess(session, role)` for `/admin/*` and `/operator/*`:

| Session | `role = operator` | `role = admin` |
|---|---|---|
| None | `login` | `login` |
| Disabled or Locked account | `forbidden` | `forbidden` |
| Resident | `forbidden` | `forbidden` |
| Operator, `mustChangePassword = true` | `change-password` | `forbidden` |
| Operator, `mustChangePassword = false` | `allow` | `forbidden` |
| Administrator | `forbidden` | `allow` |

`resolvePasswordChangeAccess(session)` for `/operator/first-login-change-password`:

| Session | Result |
|---|---|
| None | `login` |
| Not an active Operator | `forbidden` |
| Operator, `mustChangePassword = true` | `allow` |
| Operator, `mustChangePassword = false` | `operator` (back to `/operator`) |

## Client Validation

Validation runs before the request and mirrors the backend rules:

| Field | Rule | Message |
|---|---|---|
| Current password | Required | `Vui lòng nhập mật khẩu hiện tại.` |
| New password | Required | `Vui lòng nhập mật khẩu mới.` |
| New password | Not whitespace only | `Mật khẩu mới không được chỉ gồm khoảng trắng.` |
| New password | At least 8 characters | `Mật khẩu mới phải có ít nhất 8 ký tự.` |
| New password | Different from current password | `Mật khẩu mới phải khác mật khẩu hiện tại.` |
| Confirmation | Required | `Vui lòng xác nhận mật khẩu mới.` |
| Confirmation | Equal to new password | `Mật khẩu xác nhận không khớp.` |

Each password field has a show/hide toggle (`Eye` / `EyeSlash` from `@gravity-ui/icons`) with a Vietnamese `aria-label`.

## Error Messages

`getChangePasswordErrorMessage` in `src/services/auth-service.ts` never shows raw backend text:

| Condition | Message |
|---|---|
| No connection (`status = 0`) | `Không thể kết nối đến máy chủ. Vui lòng thử lại.` |
| `401` | `Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.` |
| `408` | `Máy chủ phản hồi quá chậm. Vui lòng thử lại.` |
| `429` | `Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.` |
| `5xx` | `Máy chủ đang gặp sự cố. Vui lòng thử lại sau.` |
| Other `400` | `Thông tin đổi mật khẩu không hợp lệ.` |
| Anything else | `Không thể đổi mật khẩu. Vui lòng thử lại.` |

## Files

| File | Responsibility |
|---|---|
| `src/pages/operator/first-login-change-password.tsx` | Screen and form |
| `src/auth/password-change.ts` | Validation rules, route access rules, route path |
| `src/auth/route-guards.tsx` | `RequireRole`, `RequirePasswordChange` |
| `src/auth/auth-context.tsx` | `changePassword` stores the new session |
| `src/services/auth-service.ts` | API call and Vietnamese error mapping |
| `src/types/auth.ts` | `ChangePasswordRequest` |
| `tests/first-login-change-password.test.cjs` | Unit tests |

## Verification

Unit tests (no extra dependency, same runner as the existing user-management tests):

```bash
node --test tests/first-login-change-password.test.cjs
```

Manual check against a local backend:

1. Start the local database and API from `smart-locking-be` (`artifacts/local-postgres/local-dev.ps1 -Action StartDatabase`, then `-Action StartApi`).
2. Use an Operator account whose `MustChangePassword` is `true` and whose temporary password is known.
3. Sign in on `/login` and confirm the redirect to `/operator/first-login-change-password`.
4. Submit a wrong current password and confirm `Mật khẩu hiện tại không đúng.`.
5. Submit the correct temporary password with a valid new password and confirm the redirect to `/operator`.
6. Confirm in the database that `MustChangePassword` is `false` and an `Auth.PasswordChanged` audit log exists.

## Known Limitations

- The backend middleware also blocks an **Administrator** whose `MustChangePassword` is `true` (for example a bootstrap admin). Issue `#45` only covers Operators, so the Admin portal is not gated yet. This should be tracked as a separate issue.
- After the password changes, the Operator dashboard still shows `Not Found` because `src/services/operations-service.ts` calls `GET /api/Lockers/operational-summary`, which does not exist on backend `dev`. That belongs to issues `#11` / `#12`, not this feature.
