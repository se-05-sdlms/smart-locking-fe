# Overdue Parcel Clearance

## Purpose

Let a Locker Operator process parcels that exceeded the maximum storage time: review them, take them out of the compartment on site, and record the transfer to the locker's recovery address so the resident is notified. This implements SRS UC-20.

GitHub issue: `#16` — branch `feature/16-overdue-parcel-clearance` (from `dev`).

## Backend Contract

Verified against `smart-locking-be` branch `dev` (`ParcelsController`, `ParcelService`). Parcel statuses are **strings** on these endpoints.

| Purpose | Endpoint | Notes |
|---|---|---|
| Queue | `GET /api/parcels?view=ClearancePending` | `Stored`/`Overdue` parcels with `MaxStorageUntil <= now`, scoped to assigned lockers. `view=Overdue` does not exist (`400`). |
| Detail | `GET /api/parcels/{id}` | Includes `lockerRecoveryAddress`, shipper and overdue charge |
| Transfer | `POST /api/parcels/{id}:transferToCollectionPoint` | No body. Sets `Removed`, writes audit `Parcel.Transferred`, notifies the resident. `409` when not eligible or already processed, `403` outside the scope |

Eligibility is decided by the backend; the UI never computes or marks it.

## Behaviour

- List: summary of pending parcels, search by parcel / locker / compartment code, filter by locker, refresh, realtime refresh on locker groups, loading / error + retry / empty states. Oldest deadline first; `Đã quá hạn` is a display value computed from `maxStorageUntil`.
- Detail: parcel, locker, compartment, stored time, pickup due, maximum storage deadline, status, overdue charge, shipper, recovery address.
- Transfer: confirmation dialog with an on-site checkbox (`Tôi đang ở tủ và đã lấy bưu kiện ra khỏi ngăn ...`). The confirm button is disabled until it is ticked and while sending. Success shows the collection address from the server and disables further action; errors are Vietnamese (`409`, `403`, `404`, network, `5xx`).
- Header breadcrumb shows the parcel code instead of the URL UUID.

The backend has no unlock step for clearance (`docs/backend-follow-ups.md` #21); the Operator opens the compartment on site before confirming.

## Files

| File | Responsibility |
|---|---|
| `src/pages/operator/overdue-clearance.tsx` | Queue and detail pages, transfer dialog |
| `src/services/overdue-parcel-service.ts` | API calls, mapping, display helpers, Vietnamese errors |
| `src/types/overdue-parcel.ts` | DTOs and view models |
| `src/hooks/use-async-resource.ts` | Shared loading / retry / refresh hook (same file as in `#12`) |
| `src/components/navigation/app-header.tsx` | Parcel code in the breadcrumb |
| `tests/overdue-parcel-clearance.test.cjs` | Unit tests |

## Verification

```bash
node --test tests/overdue-parcel-clearance.test.cjs
```

Manual check against a local backend: open `Xử lý quá hạn`, confirm only past-deadline parcels of assigned lockers are listed, open one, confirm the transfer button stays disabled until the on-site checkbox is ticked, transfer, and check the database for `Status = Removed` and the `Parcel.Transferred` audit log.
