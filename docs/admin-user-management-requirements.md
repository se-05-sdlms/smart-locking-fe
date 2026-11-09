# Admin User Management Requirements

## Purpose

Implement the Administrator User Management feature for Boxora at `/admin/users`. The feature manages Locker Operator and Resident accounts using Vietnamese UI and mock data while the Backend API is awaiting review.

The active development branch is `feature/5-admin-user-management`. This document does not authorize switching branches, staging changes, committing, pushing, or modifying remote state.

## Confirmed Scope

The page contains two tabs:

1. `Nhân viên vận hành`
2. `Cư dân`

The task includes:

- Listing, searching, filtering, and client-side pagination.
- Read-only user details.
- Creating Locker Operator accounts.
- Locking and unlocking Operator and Resident accounts with a required reason.
- Managing individual Locker assignments for Operators.
- Mock audit records for state-changing operations.

The task excludes:

- Editing the personal information of an existing Operator or Resident.
- Creating Resident accounts.
- Permanently deleting accounts.
- Implementing the Audit Logs screen.
- Integrating unreviewed Backend endpoints.
- Other Admin modules such as roles, buildings, policies, reports, and system audit pages.

## Account Status

Only these account states are valid in the current task:

| Code | Vietnamese label |
|---|---|
| `ACTIVE` | `Hoạt động` |
| `LOCKED` | `Đã khóa` |

Do not introduce `Inactive`, `Pending`, `Disabled`, `Suspended`, or other states.

## Operator List

The Operator table must show at least:

- Avatar.
- Full name.
- Necessary contact information.
- Number of assigned Lockers.
- Account status.
- Available actions.

`Số tủ đang quản lý` is the number of individual Locker records assigned to the Operator. It is not the number of Buildings or Locker Clusters.

The Operator tab supports:

- Search by full name, phone number, or email.
- Status filters: `Tất cả`, `Hoạt động`, and `Đã khóa`.
- Client-side pagination.
- Read-only detail view.
- Create Operator.
- Lock Operator.
- Unlock Operator.
- View and update assigned Lockers.

## Resident List

The Resident table must show:

- Avatar.
- Full name.
- Phone number.
- Registration date.
- Account status.
- Available actions.

The date column is `Ngày đăng ký`, not an expiration date.

The Resident tab supports:

- Search by full name, phone number, or email.
- Status filters: `Tất cả`, `Hoạt động`, and `Đã khóa`.
- Client-side pagination.
- Read-only detail view.
- Lock Resident.
- Unlock Resident.

Admin cannot create a Resident, edit Resident personal information, or permanently delete a Resident.

## Search Filter and Pagination

- Search full name, phone number, and email.
- Trim leading and trailing whitespace.
- Search case-insensitively for applicable fields.
- Combine search with the selected account-status filter.
- Sorting is performed directly from sortable HeroUI Table column headers; the toolbar no longer has a `Mới nhất`/`Cũ nhất` Select.
  - Operator defaults to `createdAt` descending and Resident defaults to `registeredAt` descending.
  - Sort the entire filtered result after search and status filtering, before pagination.
  - Reset to the first page when search text, status filter, sort descriptor, or active tab changes.
  - Use the user ID as a stable secondary comparison when values are equal. Invalid timestamps must not cause the service to throw.
- Apply search, filtering, and sorting before calculating page count and slicing the current page.
- If the current page becomes invalid after filtering, move to a valid page.
- Pagination is client-side for the mock implementation.

## Read-only User Details

Admin can view but cannot edit personal information.

Operator details include:

- Avatar.
- Employee code.
- Full name.
- Email.
- Phone number.
- Account creation date.
- Account status.
- Assigned Locker count.
- Access to Locker assignment management.

The employee code must be shown in the Operator detail view. It is not required as an Operator table column, and search remains limited to full name, email, and phone number.

Resident details include:

- Avatar.
- Full name.
- Email.
- Phone number.
- Registration date.
- Account status.

Use a HeroUI Modal or Drawer based on the final information density. Do not add a detail route unless the implementation plan demonstrates a clear need.

## Create Operator

Operator accounts are created by an Administrator. Provide a `Thêm nhân viên vận hành` action and a Vietnamese form.

The form can group its content into `Thông tin nhận diện`, `Thông tin liên hệ`, and `Phân công tủ` sections. Use a wide HeroUI Modal or Drawer when needed; do not add a dedicated create route.

The confirmed fields for the mock implementation are:

- Optional avatar.
  - Accept JPEG, PNG, and WebP images only.
  - Apply a temporary 2 MB file-size limit.
  - Show a preview before submission.
  - Convert a valid file to a Data URL for `avatarUrl`.
  - Do not pass or store a URL beginning with `blob:`.
  - The Data URL exists only in the current in-memory mock session and may reset after a page refresh.
  - Use the initials from the full name as the Avatar fallback when no image is selected.
  - Do not integrate Cloud Storage in the current task.
- Employee code is generated by the mock service at mutation time; Admin does not enter it.
  - The mock format is `NVVH-xxx`, beginning at `NVVH-001` and padding to at least three digits.
  - The service finds the largest existing numeric `NVVH-` sequence rather than reusing a missing code.
- Required full name using `fullName`.
  - Trim leading and trailing whitespace.
  - Reject a value containing only whitespace.
- Required and unique email.
  - Trim and normalize it to lowercase.
  - Validate its basic format at the frontend level.
- Required and unique phone number.
  - Trim whitespace and validate its format at the frontend level.
  - Frontend validation is not an official Backend rule.
- Optional individual Locker assignments using `lockerIds` in `CreateOperatorRequest` only.
  - Admin can select zero, one, or multiple Lockers.
  - Show only Lockers that are not assigned to another Operator.
  - Revalidate all selected Lockers in the mock service on submission.

The mock service supplies these values rather than accepting Admin input:

- User ID.
- Employee code.
- Role `LOCKER_OPERATOR`.
- Initial status `ACTIVE`.
- Account creation timestamp.
- Mock audit record.

The form displays the role as read-only `Nhân viên vận hành` and the initial status as read-only `Hoạt động`. Do not add a username, password, or temporary password.

`Locker.assignedOperatorId` is the only source of truth for Locker assignments. `lockerIds` exists only in `CreateOperatorRequest`; do not store `lockerIds`, `assignedLockerIds`, or a Locker count in `OperatorUser`.

Before creating any data, the mock service must atomically validate:

- The email is not already used by another account.
- The phone number is not already used by another account.
- Every selected Locker exists and is still unassigned.

If validation fails, do not create a partial Operator, partial Locker assignment, or audit record.

The form must:

- Validate required fields.
- Validate phone and email formats at the frontend level.
- Show `Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.` for an unsupported avatar file type.
- Show `Ảnh đại diện không được vượt quá 2 MB.` for an oversized avatar file.
- Show field-level Vietnamese validation messages.
- Provide Vietnamese cancel and submit actions.
- Use `Thêm nhân viên` as the default submit label and `Đang thêm...` while submitting.
- Disable repeated submission while the mock request is pending.
- Show pending, success, and error states.
- Display a read-only employee-code line with `Hệ thống tự động tạo sau khi lưu`; do not preview a code before a successful submission.
- Show `Đã thêm nhân viên vận hành. Mã nhân viên: {employeeCode}.` after a successful creation, using only the code returned by the service.
- Do not expose mock, API, Backend, or other technical implementation details in user-visible content.
- Add the created Operator through the mock service rather than mutating mock data inside the component.

### Initial Locker selector

- Search the already loaded available Locker list by Locker code, building name, or location, after trimming and without case sensitivity. Do not refetch on each keystroke.
- Keep selected Locker IDs while searching and provide `Bỏ chọn tất cả` when one or more Lockers are selected.
- Display `Đã chọn: {count} tủ` and use compact, keyboard-accessible selectable rows in two columns on desktop and one column on mobile.
- The selectable list scrolls inside a bounded container without pushing the modal footer out of the viewport.
- Distinguish `Hiện không có tủ khả dụng.` from search no-results: `Không tìm thấy tủ phù hợp.` with `Xóa tìm kiếm`.

## Locker Assignment

Assignments operate on individual Lockers.

Confirmed cardinality and behavior:

- One Operator can manage many Lockers.
- One Locker can belong to at most one Operator.
- An Operator may have zero assigned Lockers.
- Admin may remove every Locker from an Operator.
- Assignment starts from the Operator detail view through `Quản lý tủ`; Resident does not expose this action.
- The assignment modal shows current, available, and other-Operator Lockers separately. Lockers belonging to another Operator are read-only and cannot be transferred.
- Changes are drafted locally and saved atomically. Cancel does not mutate assignment.
- Saving an unchanged assignment does not create an audit record. A successful changed assignment audit records added Locker IDs, removed Locker IDs, the final count, the Operator ID, Admin ID, and timestamp.
- Locking or unlocking an account does not change Locker assignments.

The assignment UI must allow Admin to:

- View Lockers assigned to the selected Operator.
- View Lockers that are not assigned to another Operator.
- Add available Lockers.
- Remove assigned Lockers.
- Remove all Lockers.
- Cancel without saving.
- Save the updated assignment.

On save, the mock service must:

1. Reject a Locker already assigned to another Operator.
2. Update the assignment.
3. Update the displayed Locker count.
4. Create a mock audit record.
5. Return a success or error result for Vietnamese feedback.

The uniqueness constraint must be enforced in the mock service, not only by disabled controls in the UI.

## Lock Account

Operator and Resident accounts can be locked.

Flow:

1. Admin selects `Khóa tài khoản`.
2. Show a Vietnamese confirmation dialog.
3. Admin can cancel without changing data.
4. Continuing requires a lock reason.
5. Selecting `Lý do khác` requires non-empty detail text.
6. Confirm the action.
7. Change status to `LOCKED`.
8. Simulate access revocation in mock state.
9. Create a mock audit record.
10. Refresh list and detail state.
11. Do not show a page-level success banner; service and validation errors remain visible.

After a successful lock, refresh the current list while preserving the active tab, search text, status filter, sort order, and page when it remains valid. If the changed row no longer matches the selected status filter or empties the current page, move pagination to the nearest valid page.

Do not offer the lock action for an account already in `LOCKED` state.

### Operator Lock Reasons

- Vi phạm chính sách.
- Hoạt động đáng ngờ hoặc rủi ro bảo mật.
- Nhân viên đã nghỉ việc.
- Không còn cần quyền truy cập.
- Theo yêu cầu quản lý.
- Lý do khác.

### Resident Lock Reasons

- Vi phạm chính sách.
- Hoạt động đáng ngờ hoặc rủi ro bảo mật.
- Lạm dụng tài khoản.
- Theo yêu cầu quản lý.
- Lý do khác.

## Unlock Account

Operator and Resident accounts can be unlocked. Unlocking requires selecting a reason and must create a mock audit record.

Flow:

1. Admin selects `Mở khóa tài khoản`.
2. Show a Vietnamese confirmation dialog.
3. Require a reason selected from a list.
4. Selecting `Lý do khác` requires non-empty detail text.
5. Confirm the action.
6. Change status to `ACTIVE`.
7. Simulate restoring sign-in access in mock state.
8. Create a mock audit record.
9. Refresh list and detail state.
10. Do not show a page-level success banner; service and validation errors remain visible.

After a successful unlock, refresh the current list while preserving the active tab, search text, status filter, sort order, and page when it remains valid. If the changed row no longer matches the selected status filter or empties the current page, move pagination to the nearest valid page.

Do not offer the unlock action for an account already in `ACTIVE` state.

Unlocking an Operator does not change existing Locker assignments.

For both lock and unlock, generate the mock audit record only after the status mutation succeeds. When `Lý do khác` is selected, validate and store the trimmed reason detail. Locking an Operator changes only account access and must not remove or alter `Locker.assignedOperatorId` assignments.

The official unlock-reason values have not been supplied. Store temporary values in a dedicated mock constant, present the proposed list for user approval before implementation, and do not represent temporary values as confirmed business rules.

## Mock Data and Service Boundary

The Backend API exists but has not been reviewed. Do not integrate it in this task and do not invent official endpoints or DTOs.

Requirements for the mock layer:

- Components do not directly mutate data arrays.
- Reads and mutations pass through a mock service or repository.
- Service functions return Promises.
- Mock behavior supports pending, success, empty, and error states.
- Requests and responses have explicit TypeScript types.
- The boundary should be replaceable by a future API implementation.
- Do not install Axios, TanStack Query, or Zustand for the mock-only implementation.

Suggested domain types to refine during planning:

- `AccountStatus`
- `UserRole`
- `BaseUser`
- `OperatorUser`
- `ResidentUser`
- `Locker`
- `OperatorAssignment`
- `UserFilters`
- `PaginatedResult<T>`
- `CreateOperatorRequest`
- `LockAccountRequest`
- `UnlockAccountRequest`
- `UpdateLockerAssignmentRequest`
- `MockAuditRecord`

Prefer a discriminated union for Operator and Resident data. Do not create one large model with many unrelated optional fields. Do not use `any`.

## Mock Audit Records

Create a mock audit record for:

- Creating an Operator.
- Locking an Operator.
- Unlocking an Operator.
- Locking a Resident.
- Unlocking a Resident.
- Updating Locker assignments.

Each record contains at least:

- Record ID.
- Admin ID.
- Action.
- Target user ID.
- Reason when applicable.
- Timestamp.
- Necessary change metadata for the mock flow.

This does not implement the Admin Audit Logs screen and is not a substitute for backend audit enforcement.

## UI Requirements

- All visible text is Vietnamese.
- Use HeroUI for tabs, tables, inputs, selects, buttons, chips, pagination, forms, modals, and drawers where applicable.
- Use only `@gravity-ui/icons` for icons.
- Reuse the existing Admin application shell.
- Provide initial loading, empty dataset, no search results, error, pending submission, disabled action, confirmation, validation, cancel, success, and duplicate-submission protection states.
- Use `vi-VN` formatting for dates.
- Keep interactive targets accessible and responsive.

Use `docs/DESIGN-apple.md` only for visual principles applicable to the Admin Dashboard. Preserve Boxora navigation and do not reproduce marketing-page structures.

## Suggested Implementation Boundaries

The exact structure should follow existing conventions after repository inspection. A reasonable starting boundary is:

```text
src/
├── pages/admin/
│   └── user-management-page.tsx
├── components/admin/users/
│   ├── user-management-toolbar.tsx
│   ├── operator-table.tsx
│   ├── resident-table.tsx
│   ├── user-detail.tsx
│   ├── create-operator-form.tsx
│   ├── account-status-dialog.tsx
│   └── locker-assignment.tsx
├── mocks/
│   ├── users.ts
│   ├── lockers.ts
│   └── user-management-service.ts
├── types/
│   └── user-management.ts
└── constants/
    └── user-management.ts
```

This tree is guidance, not permission to create unnecessary abstractions. Propose the final file list before implementation.

## Definition of Done

- `/admin/users` renders the real User Management page instead of `EmptyRoutePage`.
- Operator and Resident tabs behave independently.
- All visible UI text is Vietnamese.
- Search by name, phone, and email works with status filtering.
- Client-side pagination operates on filtered results.
- Loading, empty, no-results, error, validation, pending, success, and cancel states are represented.
- Admin can view read-only details.
- Admin can create an Operator through the mock service.
- Admin can lock and unlock Operator and Resident accounts with required reasons.
- `Lý do khác` requires detail text.
- Admin can add, remove, or clear individual Locker assignments.
- A Locker cannot be assigned to multiple Operators.
- Operator Locker counts stay synchronized with assignments.
- State-changing operations create mock audit records.
- HeroUI, Tailwind CSS, and `@gravity-ui/icons` follow repository rules.
- No dependency or lockfile changes are introduced.
- TypeScript build passes when dependencies are available.
- Relevant lint checks pass without formatting unrelated files.
- No Git staging, commit, push, branch switch, merge, rebase, stash, reset, restore, or clean operation is performed.

## Required Planning Output Before Coding

Before editing source files, provide:

1. A requirement summary.
2. Proposed component and folder structure.
3. Files to create and files to modify.
4. Proposed TypeScript models.
5. Proposed mock service interface.
6. A temporary unlock-reason list for approval.
7. Text wireframes for the main page and dialogs.
8. Small implementation phases.
9. Risks and remaining assumptions.

Stop after the plan and wait for user approval before implementation.
