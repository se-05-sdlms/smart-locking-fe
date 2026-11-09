# Operational History

## Purpose

Give a Locker Operator one place to search the operational records of the lockers assigned to them and open the details of a record. This implements SRS UC-15 / UC-21 and Screens 62–64, 77–78.

GitHub issue: `#46` — branch `feature/46-operational-history` (stacked on `feature/12-operator-locker-monitoring`, which provides the shared record labels and the assigned locker service).

## Backend Contract

Verified against `smart-locking-be` branch `dev` (`OperationalRecordsController`, `OperationalRecordService`).

| Purpose | Endpoint | Notes |
|---|---|---|
| Search | `GET /api/operational-records?query=&lockerId=&kind=&from=&to=&pageNumber=&pageSize=` | `PagedResult`; scoped to assigned lockers; `lockerId` outside the scope → `403`; `pageSize` ≤ 100; `from` inclusive, `to` exclusive |
| Detail | `GET /api/operational-records/{kind}/{id}` | Supported kinds: Parcel, Return, DeliveryRequest, Incident, MaintenanceRequest, LockerEvent. Locker and LockerCompartment → `400` |

Record kinds returned by search: `Parcel`, `Return`, `Incident`, `DeliveryRequest`, `MaintenanceRequest`, `LockerEvent`, `Locker`, `LockerCompartment`. The kinds named in the issue (`Door`, `Access`, `Emergency`, `Maintenance`) do not exist; see `docs/backend-follow-ups.md` #22–#24.

## Behaviour

- Sidebar item `Lịch sử vận hành` → `/operator/operational-history`.
- Filters: keyword (debounced 350 ms), assigned locker, kind, from / to date. The end date is inclusive in the UI and sent as the next local midnight. A reversed range shows `Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.` without calling the API.
- Table: time, kind, code, locker, status / result, summary; server paging (20 per page).
- Detail modal: kind, status, code, locker, time, plus every non-empty `details` entry with a Vietnamese label. Enum values (priority, severity, incident type) are translated and ISO date-times are formatted with `vi-VN`. Unknown keys show `Thông tin khác` rather than raw English.
- Loading, empty, error + retry states; Vietnamese errors for `400`, `403`, `404`, network and `5xx`.

## Files

| File | Responsibility |
|---|---|
| `src/pages/operator/operational-history.tsx` | Filters, table, paging, detail modal |
| `src/services/operational-record-service.ts` | Query building, date range, detail rows, API calls, errors |
| `src/constants/operational-record.ts` | Kind filters, detail kinds, detail key and value labels (extends `#12`) |
| `src/types/operational-record.ts` | DTOs and view models |
| `src/config/navigation.ts`, `src/App.tsx` | Menu and route |
| `tests/operational-history.test.cjs` | Unit tests |

## Verification

```bash
node --test tests/operational-history.test.cjs
```

Manual check against a local backend: open `Lịch sử vận hành`, confirm paging and the total count, search by a parcel code, open an incident and a parcel detail, enter a reversed date range and confirm the validation message, then a valid range and confirm the filtered rows.
