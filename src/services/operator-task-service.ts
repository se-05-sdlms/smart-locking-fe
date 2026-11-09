import { ErrorCodes } from '@/constants/error-codes';
import { ApiError, apiRequest } from '@/services/api-client';

// smart-locking-be `dev`: OperatorTasksController (#189)
//   GET  /api/operator-tasks?offset&limit&lockerId          – open work
//   GET  /api/operator-tasks/{kind}/{id}/handovers          – history
//   POST /api/operator-tasks/{kind}/{id}/handovers          – hand over
//   POST /api/operator-tasks/handovers/{id}/acknowledgements – receive
// Tasks are views over the original incident / maintenance / overdue
// recovery records; nothing is copied. Operators only see lockers they hold
// right now, so every action can fail with 403 after a temporary assignment
// ends — the list is reloaded then.

export type TaskKind = 'incident' | 'maintenance' | 'recovery';

export type OperatorTask = {
  kind: TaskKind;
  id: string;
  lockerId: string;
  lockerCode: string;
  title: string;
  priority: string;
  status: string;
  dueAt: string | null;
  createdAt: string;
  sourcePath: string;
};

export type OperatorTaskPage = {
  items: OperatorTask[];
  offset: number;
  limit: number;
  hasMore: boolean;
};

export type TaskAcknowledgement = {
  id: string;
  receiverUserId: string;
  receiverName: string;
  notes: string;
  createdAt: string;
};

export type TaskHandover = {
  id: string;
  kind: TaskKind;
  taskId: string;
  lockerId: string;
  authorUserId: string;
  authorName: string;
  intendedReceiverUserId: string | null;
  workDone: string;
  blockers: string;
  nextSteps: string;
  createdAt: string;
  acknowledgements: TaskAcknowledgement[];
};

export type HandoverFormValues = {
  workDone: string;
  blockers: string;
  nextSteps: string;
};

export const TASK_PAGE_SIZE = 100;
export const HANDOVER_TEXT_MAX = 2000;
export const ACK_NOTES_MAX = 1000;

export const taskKindLabels: Record<TaskKind, string> = {
  incident: 'Sự cố',
  maintenance: 'Bảo trì',
  recovery: 'Thu hồi bưu kiện quá hạn',
};

const priorityLabels: Record<string, string> = {
  Critical: 'Khẩn cấp',
  High: 'Cao',
  Medium: 'Trung bình',
  Low: 'Thấp',
};

const statusLabels: Record<string, string> = {
  Open: 'Mới',
  Acknowledged: 'Đã tiếp nhận',
  InProgress: 'Đang xử lý',
  Stored: 'Đang lưu trong tủ',
  Overdue: 'Quá hạn',
};

export const priorityLabel = (priority: string) =>
  priorityLabels[priority] ?? priority;

export const taskStatusLabel = (status: string) =>
  statusLabels[status] ?? status;

export const priorityColor = (priority: string) =>
  priority === 'Critical'
    ? ('danger' as const)
    : priority === 'High'
      ? ('warning' as const)
      : ('default' as const);

/** Where the original record is handled in the operator console. */
export function taskSourceHref(task: Pick<OperatorTask, 'kind' | 'id'>) {
  if (task.kind === 'incident') {
    return `/operator/incidents?incident=${encodeURIComponent(task.id)}`;
  }
  if (task.kind === 'maintenance') {
    return `/operator/maintenance?request=${encodeURIComponent(task.id)}`;
  }

  return `/operator/overdue-clearance/${encodeURIComponent(task.id)}`;
}

export const isTaskOverdue = (
  task: Pick<OperatorTask, 'dueAt'>,
  now = Date.now(),
) => task.dueAt !== null && new Date(task.dueAt).getTime() < now;

export const taskKey = (task: Pick<OperatorTask, 'kind' | 'id'>) =>
  `${task.kind}:${task.id}`;

export function filterTasks(
  tasks: OperatorTask[],
  filters: { lockerId: string; kind: TaskKind | '' },
) {
  return tasks.filter(
    (task) =>
      (!filters.lockerId || task.lockerId === filters.lockerId) &&
      (!filters.kind || task.kind === filters.kind),
  );
}

export function lockerOptions(tasks: OperatorTask[]) {
  const seen = new Map<string, string>();

  for (const task of tasks) seen.set(task.lockerId, task.lockerCode);

  return [...seen]
    .map(([id, code]) => ({ id, code }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** The receiver (not the author) acknowledges once per handover. */
export const canAcknowledge = (
  handover: TaskHandover,
  userId: string | undefined,
) =>
  Boolean(userId) &&
  handover.authorUserId !== userId &&
  !handover.acknowledgements.some((item) => item.receiverUserId === userId);

export const emptyHandoverForm = (): HandoverFormValues => ({
  workDone: '',
  blockers: '',
  nextSteps: '',
});

export function validateHandoverForm(values: HandoverFormValues) {
  const errors: Partial<Record<keyof HandoverFormValues, string>> = {};

  if (!values.workDone.trim()) errors.workDone = 'Vui lòng ghi việc đã làm.';
  if (!values.nextSteps.trim())
    errors.nextSteps = 'Vui lòng ghi bước tiếp theo.';
  for (const key of ['workDone', 'blockers', 'nextSteps'] as const) {
    if (values[key].trim().length > HANDOVER_TEXT_MAX) {
      errors[key] = `Tối đa ${HANDOVER_TEXT_MAX} ký tự.`;
    }
  }

  return errors;
}

export const listTasks = (offset: number, signal?: AbortSignal) =>
  apiRequest<OperatorTaskPage>(
    `/api/operator-tasks?offset=${Math.max(0, offset)}&limit=${TASK_PAGE_SIZE}`,
    { signal },
  );

const taskPath = (task: Pick<OperatorTask, 'kind' | 'id'>) =>
  `/api/operator-tasks/${task.kind}/${encodeURIComponent(task.id)}/handovers`;

export const getHandovers = (
  task: Pick<OperatorTask, 'kind' | 'id'>,
  signal?: AbortSignal,
) => apiRequest<TaskHandover[]>(taskPath(task), { signal });

export const createHandover = (
  task: Pick<OperatorTask, 'kind' | 'id'>,
  values: HandoverFormValues,
) =>
  apiRequest<TaskHandover>(taskPath(task), {
    method: 'POST',
    body: JSON.stringify({
      workDone: values.workDone.trim(),
      blockers: values.blockers.trim(),
      nextSteps: values.nextSteps.trim(),
      intendedReceiverUserId: null,
    }),
  });

export const acknowledgeHandover = (handoverId: string, notes: string) =>
  apiRequest<TaskAcknowledgement>(
    `/api/operator-tasks/handovers/${encodeURIComponent(handoverId)}/acknowledgements`,
    { method: 'POST', body: JSON.stringify({ notes: notes.trim() }) },
  );

/** True when the user lost access (e.g. a temporary assignment ended). */
export const isAccessLost = (error: unknown) =>
  error instanceof ApiError && error.status === 403;

export function getTaskErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'TASK_CLOSED':
        return 'Công việc đã đóng, không thể bàn giao nữa. Danh sách đã được tải lại.';
      case 'TASK_HANDOVER_NOT_FOUND':
      case 'OPERATOR_TASK_NOT_FOUND':
        return 'Không tìm thấy công việc hoặc bàn giao. Vui lòng tải lại.';
      case ErrorCodes.INVALID_INPUT:
        return 'Nội dung chưa hợp lệ. Kiểm tra các ô bắt buộc và độ dài.';
    }
    if (error.status === 403) {
      return 'Bạn không còn quyền với tủ này (phân công có thể đã kết thúc). Danh sách đã được tải lại.';
    }
    if (error.status === 0)
      return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
    if (error.status >= 500)
      return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  }

  return 'Không thể xử lý công việc. Vui lòng thử lại.';
}
