# Operator Incident Management

## Purpose

Let a Locker Operator review and handle incidents of the lockers assigned to them, record field actions, and move incidents through their lifecycle with real backend data. This implements issue `#13`.

GitHub issue: `#13` — branch `feature/13-operator-incident-management` (from `dev`; replaces the closed PR #35).

## Confirmed Scope

The task includes:

- Route `/operator/incidents` and the `Sự cố` sidebar item.
- Incident list with status filter (server side), keyword search (client side), refresh and realtime refresh.
- Detail drawer: description, related locker / compartment / parcel / return, source, assignee, timestamps, resolution, and a timeline.
- Recording field actions (`Ghi nhận hành động`).
- Status changes with confirmation: `Open → Investigating / Escalated`, `Investigating → Resolved / Escalated`.

The task excludes:

- Manual assignment (the backend routes incidents by `OperatorAssignment`).
- Dynamic role / permission management.
- Emergency unlock (issue `#15`).

## Backend Contract

Verified against `smart-locking-be` branch `dev` (`OperatorIncidentsController`, `IncidentsController`, `IncidentService`). Enums are numbers in JSON.

| Purpose | Endpoint | Notes |
|---|---|---|
| List | `GET /api/operator/incidents?status=` | Plain array, scoped to active assignments; `status` accepts the enum name |
| Detail | `GET /api/incidents/{id}` | Includes `actions` (oldest first) |
| Field action | `POST /api/operator/incidents/{id}/actions` | `{ notes }`, required, ≤ 4000 characters; `409` when Resolved |
| Status | `PATCH /api/operator/incidents/{id}/status` | `{ status, notes, resolutionSummary }` |

`IncidentStatus`: `0` Open `Mới`, `1` Investigating `Đang xử lý`, `2` Resolved `Đã giải quyết`, `3` Escalated `Đã chuyển cấp`.

Transitions allowed for `LockerOperator` (`IncidentService.IsValidTransition`):

| From | To | Required text |
|---|---|---|
| Open | Investigating | — (optional note) |
| Open | Escalated | `notes` (Lý do chuyển cấp) |
| Investigating | Resolved | `resolutionSummary` (Kết quả xử lý) |
| Investigating | Escalated | `notes` |
| Escalated | — | Only an Administrator can continue |

Field actions are allowed for every status except Resolved.

## UI Notes

- All labels (status, source, type, action type) are Vietnamese; unknown values show `Không xác định`.
- Every mutation blocks duplicate submits, shows Vietnamese errors (`400`, `403`, `404`, `409`, `429`, network, `5xx`), replaces the drawer with the server response and refreshes the list.
- The drawer and its forms reset for every incident.
- Realtime: the list subscribes to the locker groups of the loaded incidents; the backend publishes `operationUpdated` on incident changes.

## Files

| File | Responsibility |
|---|---|
| `src/pages/operator/incidents.tsx` | List, filter, search, refresh |
| `src/pages/operator/incident-detail-drawer.tsx` | Detail, timeline, field action form, status dialog |
| `src/services/incident-service.ts` | API calls, mapping, transition rules, Vietnamese errors |
| `src/constants/incident.ts` | Labels, filter options, transition texts |
| `src/types/incident.ts` | DTOs and view models |
| `src/hooks/use-async-resource.ts` | Shared loading / retry / refresh hook (same file as in `#12`) |
| `src/config/navigation.ts`, `src/App.tsx` | `Sự cố` menu and route |
| `tests/operator-incidents.test.cjs` | Unit tests |

## Verification

```bash
node --test tests/operator-incidents.test.cjs
```

Manual check against a local backend (incidents can be created with `POST /api/incidents/guest`):

1. Open `Sự cố` as an Operator and confirm only incidents of assigned lockers are listed.
2. Filter by status and search by title or locker code.
3. Open an `Mới` incident, `Tiếp nhận xử lý` with an optional note.
4. Record a field action and confirm it appears at the top of the timeline.
5. `Đánh dấu đã giải quyết` without a result and confirm the required message; enter a result and confirm.
6. Confirm the resolved incident no longer accepts actions.
7. `Chuyển cấp` another incident with a reason and confirm the escalated notice.
