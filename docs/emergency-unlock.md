# Emergency Unlock

## Purpose

Let a Locker Operator open a compartment of an assigned locker in an emergency, with a mandatory reason and a real server result. Every attempt is audited by the backend. This implements SRS UC-17.

GitHub issue: `#15` — branch `feature/15-emergency-unlock` (stacked on `feature/12-operator-locker-monitoring`, which provides the locker detail page).

## Confirmed Scope

The task includes:

- `Mở khẩn cấp` in the compartment drawer of `/operator/lockers/:lockerId`.
- A dangerous-action confirmation dialog with a required reason.
- Pre-checks for the conditions the backend blocks, so the Operator sees why before sending.
- Showing the server result (`Đã gửi lệnh mở` / `Mở khẩn cấp thất bại`) and allowing a manual retry.
- Duplicate-submit protection and Vietnamese errors for `400`, `401`, `403`, `404`, `408`, `409`, `429`, network and `5xx`.

The task excludes:

- Linking the unlock to an incident (`incidentId` is sent as `null`; incidents are issue `#13`).
- Normal parcel unlock and incident actions.

## Backend Contract

Verified against `smart-locking-be` branch `dev` (`EmergencyUnlocksController`, `EmergencyUnlockService`, `LockerAccessService`).

| Item | Value |
|---|---|
| Endpoint | `POST /api/emergency-unlocks` (`Administrator`, `LockerOperator`) |
| Request | `{ lockerId, compartmentId, incidentId: null, reason }` |
| Response `201` | `{ id, result, compartmentCode, requestedAt }`, `result`: `0` Pending, `1` Succeeded, `2` Failed |
| Reason rule | Trimmed, at least 10 characters (`400` otherwise) |
| Scope | Operator must have an active assignment on the locker (`403`) |
| Audit | `EmergencyUnlock` row, `LockerAccessEvent` (`OperatorEmergency`), `AuditLog` `Locker.EmergencyUnlock` |

The backend sends the command synchronously and returns `Succeeded` or `Failed`. It records `Failed` **without contacting the device** when:

| Condition | UI text |
|---|---|
| Locker operational status is not `Operational` | `Tủ không ở trạng thái Đang vận hành.` |
| Locker connection is not `Online` | `Tủ không trực tuyến.` |
| Compartment operational status is not `Operational` | `Ngăn không ở trạng thái Hoạt động.` |

The dialog shows these blockers and disables `Xác nhận mở`. Limitations are tracked in `docs/backend-follow-ups.md` #15–#17 (no status endpoint / `TimedOut`, out-of-service compartments cannot be opened, no failure reason in the response).

## Behaviour

1. Operator opens a compartment and presses `Mở khẩn cấp`.
2. The dialog explains that the action is audited, shows the locker connection, and lists any blocker.
3. The reason is validated (required, 10–500 characters after trimming) with a live counter.
4. `Xác nhận mở` sends one request; buttons are disabled and the dialog cannot be dismissed while sending.
5. The result is shown in a `role="alert"` panel and as a toast. On `Failed`, `Thử lại` resends the same reason.
6. After any attempt the locker detail refetches. For `408` and `5xx` the message asks the Operator to check `Lịch sử vận hành` and the door before retrying, because the command may already have reached the device.
7. The dialog resets for every compartment and every time it opens.

Unknown result values are treated as `Failed` so the UI never reports a false success.

## Files

| File | Responsibility |
|---|---|
| `src/pages/operator/emergency-unlock-dialog.tsx` | Confirmation dialog, reason input, result and retry |
| `src/pages/operator/locker-detail.tsx` | Opens the dialog for the selected compartment and refetches after an attempt |
| `src/services/emergency-unlock-service.ts` | API call, result mapping, reason validation, blockers, Vietnamese errors |
| `src/constants/emergency-unlock.ts` | Reason limits, result and blocker texts |
| `src/types/emergency-unlock.ts` | DTOs and view model |
| `tests/emergency-unlock.test.cjs` | Unit tests |

## Verification

```bash
node --test tests/emergency-unlock.test.cjs
```

Manual check against a local backend:

1. Open an online locker, select an `Operational` compartment, press `Mở khẩn cấp`.
2. Enter a reason shorter than 10 characters and confirm the validation message.
3. Enter a valid reason and confirm. Without a device or MQTT broker the local backend returns `Failed`; confirm the result panel, the toast and `Thử lại`.
4. Confirm in the database: `EmergencyUnlock` row with the reason, `AuditLog` `Locker.EmergencyUnlock`, and a `LockerAccessEvent` with the failure reason.
5. Open an `Ngừng phục vụ` compartment and an offline locker; confirm the blocker list and the disabled confirm button.
