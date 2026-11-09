# Operator Locker Monitoring

## Purpose

Replace the mock locker data on `/operator/lockers` and `/operator/lockers/:lockerId` with the real assigned-locker scope, compartment states, operational status changes, and operational history. This implements SRS UC-14, UC-18 and UC-21.

GitHub issue: `#12` — branch `feature/12-operator-locker-monitoring`.

## Confirmed Scope

The task includes:

- Listing the lockers in the Operator's active assignment scope, with search, filter and client pagination.
- Locker detail with compartments, connection, last-seen time, and operational status.
- Taking a compartment out of service and restoring it, with confirmation.
- Recent operational history of a locker.
- Refreshing on SignalR `operationUpdated`, with a manual `Làm mới` fallback.

The task excludes:

- Emergency unlock (issue `#15`). The button stays as the existing placeholder.
- The Operator dashboard KPIs (issue `#11`, see `docs/backend-follow-ups.md` #12).
- The full operational history page with filters (issue `#46`).

## Backend Contract

Verified against `smart-locking-be` branch `dev`. Enums are serialized as **numbers**.

| Purpose | Endpoint | Notes |
|---|---|---|
| Assigned lockers | `GET /api/Lockers` | Plain array of `LockerSummaryResponse`; for `LockerOperator` the backend keeps only lockers with an active `OperatorAssignment` |
| Locker detail | `GET /api/Lockers/{id}` | `LockerDetailResponse` with `compartments`; `403` outside the scope, `404` when missing |
| Compartment status | `PUT /api/Lockers/{id}/compartments/{compartmentId}/status` | Body `{ operationalStatus }` only; `400` when the locker is `Inactive`, `403` outside the scope |
| History | `GET /api/operational-records?lockerId=&pageNumber=1&pageSize=20` | Paged; `kind` and `status` are strings |
| Realtime | SignalR `/hubs/operations`, `SubscribeLocker(lockerId)`, event `operationUpdated` | Emitted for deliveries, incidents, parcels and returns |

Enum order (`Domain/Enums/LockerEnums.cs`):

| Value | `LockerOperationalStatus` / compartment | `LockerConnectionStatus` | `DoorStatus` |
|---|---|---|---|
| 0 | Operational — `Đang vận hành` / `Hoạt động` | Online — `Trực tuyến` | Open — `Cửa mở` |
| 1 | OutOfService — `Ngừng phục vụ` | Offline — `Ngoại tuyến` | Closed — `Cửa đóng` |
| 2 | Inactive — `Đã vô hiệu hóa` | Unknown — `Không xác định` | Unknown — `Cửa: chưa rõ` |

Unknown numbers map to `Unknown` instead of crashing. String enum names are also accepted, so enabling `JsonStringEnumConverter` on the backend later needs no frontend change.

## State Labels

The UI keeps three kinds of state apart:

- **Connection** and **door** are reported by the device (`Kết nối thiết bị`, `Cửa (thiết bị báo)`).
- **Operational status** is set by people (`Trạng thái vận hành`).
- `Lần cuối kết nối` shows `lastSeenAt`; the backend defines no stale threshold, so the UI does not invent one.

## Status Actions

`getCompartmentStatusAction` decides what the Operator may do:

| Locker | Compartment | Action |
|---|---|---|
| `Inactive` | any | none (backend returns `400`) |
| other | `Operational` | `Ngừng phục vụ` |
| other | `OutOfService` | `Khôi phục hoạt động` |
| other | `Inactive` / `Unknown` | none (administrator configuration) |

Both actions use a confirmation dialog, block duplicate submits, show Vietnamese errors (`400`, `403`, `404`, `409`, `429`, network, `5xx`), apply the server response, and then refetch.

### Extension points

- **Reason for Out of Service.** The backend does not accept a reason yet (`docs/backend-follow-ups.md` #11). When it does, add the field in `buildCompartmentStatusRequest` (`src/services/operator-locker-mappers.ts`) and add a reason input to the confirmation dialog.
- **New statuses or record kinds.** Update the label tables in `src/constants/operator-locker.ts` and `src/constants/operational-record.ts`.

## Files

| File | Responsibility |
|---|---|
| `src/pages/operator/lockers.tsx` | Assigned locker list |
| `src/pages/operator/locker-detail.tsx` | Locker detail, compartments, status dialog, history modal |
| `src/pages/operator/locker-shared.tsx` | Status chips, detail row, error alert, date formatting |
| `src/types/operator-locker.ts` | Backend DTOs and view models |
| `src/constants/operator-locker.ts` | Vietnamese labels, filters, action texts |
| `src/constants/operational-record.ts` | Vietnamese labels for operational record kinds and statuses (reusable by `#46`) |
| `src/services/operator-locker-mappers.ts` | Pure mapping, filtering and action rules |
| `src/services/operator-locker-service.ts` | API calls and Vietnamese error messages |
| `src/hooks/use-async-resource.ts` | Loading / error / retry / silent refresh with cancellation |
| `src/hooks/use-operations-realtime.ts` | `withCredentials: false` so SignalR works with the backend CORS policy |
| `src/components/navigation/app-header.tsx` | Breadcrumb shows the locker code instead of the URL UUID |
| `tests/operator-locker-monitoring.test.cjs` | Unit tests |

## Verification

```bash
node --test tests/operator-locker-monitoring.test.cjs
```

Manual check against a local backend:

1. Sign in as an Operator with assigned lockers and open `Tủ của tôi`.
2. Confirm codes, addresses, connection, operational status and last-seen time match the database; try search and each filter.
3. Open a locker and confirm the compartments and their door states.
4. Take an `Operational` compartment out of service, confirm the toast, the chip and the `Ngăn hoạt động` counter; restore it again.
5. Open an `Inactive` compartment and confirm no status action is offered.
6. Open `Lịch sử vận hành` and confirm all labels are Vietnamese.
7. Open `/operator/lockers/<unknown-id>` and confirm the Vietnamese error with `Thử lại`.
