# Operator task assignee

The task table and handover drawer display `assignedOperatorName` when
`assignedOperatorUserId` is present. If the name is missing, they display the
user ID. A task without an assigned user displays `Chưa phân công riêng`.

The backend projects the current incident assignee. Maintenance and recovery
tasks currently return null for both fields because they have no individual
assignee model. Locker coverage, the viewing operator, maintenance creation,
and handover acknowledgement do not assign an individual task.

The list response supplies both fields; rendering assignees makes no additional
per-task requests. Opening the drawer retains the existing handover-history
request and source-record link. This display does not change authorization,
assignment, or acknowledgement behavior.
