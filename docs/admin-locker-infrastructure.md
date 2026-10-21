# Admin Locker Infrastructure and Locations

## Purpose

Let the Administrator register, update and deactivate lockers, manage each locker's physical address and overdue collection (recovery) address, and add compartments, using the real backend. This implements issue `#7` (locker infrastructure, SRS UC-25) and issue `#6` (locker locations, SRS UC-24) on the same screen `/admin/lockers`.

GitHub issues: `#7`, `#6` — branch `feature/7-admin-locker-infrastructure` (from `dev`).

## Backend Contract

Verified against `smart-locking-be` branch `dev` (`LockersController`, `LockerService`). Enums are numbers in JSON.

| Purpose | Endpoint | Notes |
|---|---|---|
| List | `GET /api/Lockers` | Plain array of `LockerSummaryResponse` (all lockers for Administrator) |
| Detail | `GET /api/Lockers/{id}` | Includes `compartments` |
| Create | `POST /api/Lockers` | `{ code, address, recoveryAddress, deviceIdentifier }` |
| Update | `PUT /api/Lockers/{id}` | Same fields + `operationalStatus` |
| Deactivate | `DELETE /api/Lockers/{id}` | Soft delete: sets `Inactive`, keeps history |
| Add compartment | `POST /api/Lockers/{id}/compartments` | `{ code, hardwareCode, hardwareChannel }`; rejected for Inactive lockers |

Validation (`LockerService.ValidateAndTrim*`), mirrored on the client: code ≤ 50, address ≤ 500, recovery address ≤ 500, device identifier ≤ 100, compartment code ≤ 50, hardware code ≤ 100, hardware channel integer > 0. Uniqueness (locker code, device identifier, compartment code / hardware code / channel per locker) is checked by the backend; its `400` messages are already Vietnamese and are shown as-is. English or empty messages fall back to a Vietnamese text.

## Behaviour

- List: search by code / address / recovery address / device identifier, filter by operational status or offline connection, client paging (10), refresh, create.
- Configuration status (`Đang vận hành`, `Ngừng phục vụ`, `Đã vô hiệu hóa`) is editable; connection and door state are reported by the device and shown read-only (`Trạng thái thiết bị báo về`). The client never writes telemetry.
- Form: required fields with inline Vietnamese errors, duplicate-submit protection, server error alert. The edit form adds `Trạng thái vận hành`, which can also re-activate an Inactive locker.
- Detail drawer: configuration, reported state, compartments with status and door, add-compartment form (hidden for Inactive lockers), edit and deactivate.
- Deactivate: confirmation dialog explaining that data and history are kept.
- Operator assignment is not part of this screen (issue `#8`).

## Files

| File | Responsibility |
|---|---|
| `src/pages/admin/lockers.tsx` | List, filters, paging, opens form and drawer |
| `src/components/admin/lockers/locker-form-modal.tsx` | Create / edit form |
| `src/components/admin/lockers/locker-detail-drawer.tsx` | Detail, compartments, add compartment, deactivate |
| `src/services/admin-locker-service.ts` | API calls, mapping, filtering, validation, request builders, errors |
| `src/constants/admin-locker.ts` | Field limits, labels, filter options |
| `src/types/admin-locker.ts` | DTOs, view models, form types |
| `src/hooks/use-async-resource.ts` | Shared loading / retry / refresh hook (same file as in `#12`) |
| `tests/admin-locker-infrastructure.test.cjs` | Unit tests |

## Verification

```bash
node --test tests/admin-locker-infrastructure.test.cjs
```

Manual check against a local backend (Administrator account): submit an empty form, create a locker with an existing code and confirm the backend message, create a new locker, add a compartment with channel `0` and then `1`, edit the recovery address, deactivate the locker and confirm the add-compartment form is hidden.
