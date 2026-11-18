# Email password reset

The login link opens `/forgot-password`, a public route for Administrator and
LockerOperator email accounts. This flow accepts email only. It uses the existing
anonymous `POST /api/auth/forgot-password` endpoint with normalized
`loginIdentifier`, then `POST /api/auth/reset-password` with the same identifier,
six-digit string `otpCode` and `newPassword`. Passwords are not trimmed. The backend
selects the email channel for internal email identifiers, including accounts that
also have a phone number (BE #241). There is no web SMS fallback.

An accepted request shows generic wording without revealing account existence.
Resending uses the same email and clears the old code after successful issuance;
changing email clears code/password inputs. Network, validation, invalid/expired
OTP, throttling and server errors keep a recovery path. Successful reset clears
secret inputs and offers login; it does not create a session. Pending operations
disable controls and synchronously prevent duplicate submission.

Validation tests exercise actual TypeScript rules and service requests. Browser
verification exercised the real UI at 375, 768 and 1440 pixels using controlled
HTTP responses: email-only input, keyboard link, validation, network/429/OTP errors,
resend, change email, duplicate-submit guard, success and return to login. This
does not establish delivery to a real inbox or provider availability. Live delivery
requires backend email-provider configuration and a controlled test account.
