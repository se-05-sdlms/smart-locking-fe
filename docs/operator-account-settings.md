# Operator Account Settings

## Purpose

Replace the mock data on `/operator/settings` with the real account, assignment scope, password change, and sign-out flows for the Locker Operator. This implements SRS UC-02.

GitHub issue: `#18` — branch `feature/18-operator-account-settings`. The branch is stacked on `feature/45-first-login-change-password` because it reuses the password change flow from `#45`.

## Confirmed Scope

The task includes:

- Showing the signed-in account from the auth context (no mock employee data).
- Showing the lockers in the Operator's active assignment scope, read-only.
- Optional password change with current / new / confirmation validation.
- Signing out, which clears the session and returns to `/login`.

The task excludes:

- Editing profile fields, role, permission, or locker assignment (managed by the Administrator).
- The mandatory first-login password change (issue `#45`).

## Backend Contract

Verified against `smart-locking-be` branch `dev`.

| Purpose | Endpoint | Notes |
|---|---|---|
| Profile | `GET /api/auth/me` | Called by `AuthProvider` on app load; the settings page reads the result from the auth context |
| Assigned lockers | `GET /api/Lockers` | For `LockerOperator` the backend returns only lockers with an active `OperatorAssignment`; response is a plain array of `LockerSummaryResponse` |
| Change password | `POST /api/auth/change-password` | Same contract as `#45`; returns a new token pair and revokes every other refresh token |
| Sign out | `POST /api/auth/logout` | `{ refreshToken }`; the client clears the session even if the request fails |

`UserProfileResponse` only contains `id`, `phoneNumber`, `email`, `role`, `status`, `mustChangePassword`, and `lastLoginAt`. The mock fields "Họ và tên" and "Mã nhân viên" were removed because the backend does not return them.

### Auth rate limit

All `AuthController` endpoints share the `Auth` rate limit policy: 5 requests per 60 seconds per client (`appsettings.json`). This includes `GET /api/auth/me`. To keep that budget for login and password changes, the settings page does **not** call `/me` again; it uses the profile `AuthProvider` already refreshed on load. A `429` is shown as `Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.`

## Screen

| Card | Content | States |
|---|---|---|
| Thông tin tài khoản | Email, phone, last sign-in (`vi-VN`), role, status chip (`Hoạt động` / `Đã khóa`) | Missing values show `Chưa cập nhật` |
| Phạm vi phụ trách | Locker code and address, sorted by code | Loading skeleton, error with `Thử lại`, empty (`Bạn chưa được phân công tủ nào...`) |
| Đổi mật khẩu | Current, new, confirmation fields with show/hide toggles | Inline validation, pending state, Vietnamese error alert, success toast, `Hủy` resets the form |
| Phiên đăng nhập | Session expiry time and `Đăng xuất` | Pending state while signing out |

Detail rows stack vertically below the `sm` breakpoint so nothing overflows on phones.

## Password Change

Validation and error messages are shared with the first-login screen (`src/auth/password-change.ts`, `getChangePasswordErrorMessage`). See `docs/first-login-change-password.md` for the full rule table.

After a successful change:

1. The new session returned by the backend is saved by `AuthContext.changePassword`.
2. The form is cleared and remounted so validation messages and visibility toggles reset.
3. A toast confirms `Đã đổi mật khẩu` and explains that other sessions were signed out.

## Files

| File | Responsibility |
|---|---|
| `src/pages/operator/settings.tsx` | Settings page composition |
| `src/components/auth/password-field.tsx` | Shared password input with show/hide toggle (also used by the first-login screen) |
| `src/auth/account-display.ts` | Vietnamese role/status labels and `vi-VN` date formatting |
| `src/services/operator-account-service.ts` | Assigned lockers API and Vietnamese load error messages |
| `tests/operator-account-settings.test.cjs` | Unit tests |

## Verification

Unit tests:

```bash
node --test tests/operator-account-settings.test.cjs
```

Manual check against a local backend:

1. Sign in as an Operator with active assignments.
2. Open `/operator/settings` and confirm the profile and assigned lockers match the database.
3. Submit a wrong current password and confirm `Mật khẩu hiện tại không đúng.`.
4. Submit the correct current password with a valid new password and confirm the success toast and cleared form.
5. Press `Đăng xuất` in `Phiên đăng nhập` and confirm the redirect to `/login` with no stored session.
6. Repeat on a 375px viewport and confirm there is no horizontal overflow inside the page.
