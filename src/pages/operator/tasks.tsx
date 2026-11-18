import type {
  HandoverFormValues,
  OperatorTask,
  TaskHandover,
  TaskKind,
} from '@/services/operator-task-service';

import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Chip,
  Drawer,
  FieldError,
  Label,
  ListBox,
  Select,
  Skeleton,
  Table,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import Xmark from '@gravity-ui/icons/Xmark';

import { useAuth } from '@/auth/auth-context';
import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  ACK_NOTES_MAX,
  acknowledgeHandover,
  canAcknowledge,
  createHandover,
  emptyHandoverForm,
  filterTasks,
  getHandovers,
  getTaskErrorMessage,
  HANDOVER_TEXT_MAX,
  isAccessLost,
  isTaskOverdue,
  listTasks,
  lockerOptions,
  priorityColor,
  priorityLabel,
  TASK_PAGE_SIZE,
  taskKey,
  taskKindLabels,
  taskSourceHref,
  taskStatusLabel,
  validateHandoverForm,
} from '@/services/operator-task-service';

const ALL = 'all';
const dateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN') : '—';

function ErrorAlert({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert role="alert" status="danger">
      <Alert.Indicator>
        <CircleExclamation aria-hidden="true" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
      {onRetry ? (
        <Button size="sm" variant="secondary" onPress={onRetry}>
          Thử lại
        </Button>
      ) : null}
    </Alert>
  );
}

function FilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      className="w-full sm:w-56"
      value={value}
      variant="secondary"
      onChange={(key) => onChange(String(key))}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((item) => (
            <ListBox.Item key={item.id} id={item.id} textValue={item.label}>
              {item.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function HandoverEntry({
  handover,
  canAct,
  onAcknowledged,
  onAccessLost,
}: {
  handover: TaskHandover;
  canAct: boolean;
  onAcknowledged: () => void;
  onAccessLost: () => void;
}) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);
  const showAck = canAct && canAcknowledge(handover, user?.id);

  const acknowledge = async () => {
    if (pending.current) return;
    if (notes.trim().length > ACK_NOTES_MAX) {
      setError(`Ghi chú tối đa ${ACK_NOTES_MAX} ký tự.`);

      return;
    }
    pending.current = true;
    setIsSaving(true);
    setError('');
    try {
      await acknowledgeHandover(handover.id, notes);
      toast.success('Đã xác nhận tiếp nhận bàn giao', {
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      onAcknowledged();
    } catch (ackError) {
      setError(getTaskErrorMessage(ackError));
      if (isAccessLost(ackError)) onAccessLost();
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  return (
    <li className="space-y-2 rounded-xl border border-separator p-3 text-sm">
      <p className="font-medium">
        {handover.authorName} bàn giao ·{' '}
        <span className="text-muted">{dateTime(handover.createdAt)}</span>
      </p>
      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted">Đã làm</dt>
        <dd className="whitespace-pre-wrap">{handover.workDone}</dd>
        <dt className="text-muted">Vướng mắc</dt>
        <dd className="whitespace-pre-wrap">{handover.blockers || '—'}</dd>
        <dt className="text-muted">Bước tiếp</dt>
        <dd className="whitespace-pre-wrap">{handover.nextSteps}</dd>
      </dl>
      {handover.acknowledgements.length ? (
        <ul className="space-y-1 border-l border-separator pl-3">
          {handover.acknowledgements.map((ack) => (
            <li key={ack.id}>
              <CircleCheck
                aria-hidden="true"
                className="mr-1 inline size-4 text-success"
              />
              {ack.receiverName} đã tiếp nhận · {dateTime(ack.createdAt)}
              {ack.notes ? (
                <span className="block text-muted">{ack.notes}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-warning">Chưa có ai xác nhận tiếp nhận.</p>
      )}
      {showAck ? (
        <div className="space-y-2">
          <TextField fullWidth value={notes} onChange={setNotes}>
            <Label>Ghi chú khi tiếp nhận (không bắt buộc)</Label>
            <TextArea maxLength={ACK_NOTES_MAX} rows={2} variant="secondary" />
          </TextField>
          {error ? <ErrorAlert message={error} /> : null}
          <Button
            isPending={isSaving}
            size="sm"
            variant="primary"
            onPress={() => void acknowledge()}
          >
            Xác nhận tiếp nhận
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function TaskDrawer({
  task,
  canAct,
  onClose,
  onAccessLost,
}: {
  task: OperatorTask;
  canAct: boolean;
  onClose: () => void;
  onAccessLost: () => void;
}) {
  const { state, reload, refresh } = useAsyncResource(
    (signal) => getHandovers(task, signal),
    getTaskErrorMessage,
    [task.kind, task.id],
  );
  const [values, setValues] = useState<HandoverFormValues>(emptyHandoverForm);
  const [errors, setErrors] = useState<
    Partial<Record<keyof HandoverFormValues, string>>
  >({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);

  const update = (patch: Partial<HandoverFormValues>) => {
    const next = { ...values, ...patch };

    setValues(next);
    if (Object.keys(errors).length) setErrors(validateHandoverForm(next));
  };

  const submit = async () => {
    const next = validateHandoverForm(values);

    setErrors(next);
    if (Object.keys(next).length || pending.current) return;
    pending.current = true;
    setIsSaving(true);
    setSubmitError('');
    try {
      await createHandover(task, values);
      toast.success('Đã ghi bàn giao', {
        description: `${taskKindLabels[task.kind]} · Tủ ${task.lockerCode}`,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      setValues(emptyHandoverForm());
      refresh();
    } catch (error) {
      setSubmitError(getTaskErrorMessage(error));
      if (
        isAccessLost(error) ||
        (error as { code?: string }).code === 'TASK_CLOSED'
      )
        onAccessLost();
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  const textField = (key: keyof HandoverFormValues, label: string) => (
    <TextField
      fullWidth
      isInvalid={Boolean(errors[key])}
      value={values[key]}
      onChange={(value) => update({ [key]: value })}
    >
      <Label>{label}</Label>
      <TextArea maxLength={HANDOVER_TEXT_MAX} rows={2} variant="secondary" />
      <FieldError>{errors[key]}</FieldError>
    </TextField>
  );

  return (
    <Drawer isOpen onOpenChange={(open) => (open ? null : onClose())}>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="w-full sm:w-[34rem]">
            <Drawer.CloseTrigger aria-label="Đóng bàn giao">
              <Xmark aria-hidden="true" className="size-5" />
            </Drawer.CloseTrigger>
            <Drawer.Header>
              <Drawer.Heading>{task.title}</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-4">
              <p className="text-sm text-muted">
                {taskKindLabels[task.kind]} · Tủ {task.lockerCode} ·{' '}
                {priorityLabel(task.priority)} · {taskStatusLabel(task.status)}
              </p>
              {canAct ? (
                <Link
                  className="text-sm text-accent underline"
                  to={taskSourceHref(task)}
                >
                  Mở hồ sơ gốc
                </Link>
              ) : null}

              {canAct ? (
                <Card>
                  <Card.Header>
                    <Card.Title>Ghi bàn giao</Card.Title>
                    <Card.Description>
                      Người nhận ca hoặc Operator thay tạm sẽ xác nhận tiếp
                      nhận.
                    </Card.Description>
                  </Card.Header>
                  <Card.Content className="space-y-3">
                    {textField('workDone', 'Việc đã làm')}
                    {textField('blockers', 'Vướng mắc (không bắt buộc)')}
                    {textField('nextSteps', 'Bước tiếp theo')}
                    {submitError ? <ErrorAlert message={submitError} /> : null}
                    <Button
                      isPending={isSaving}
                      variant="primary"
                      onPress={() => void submit()}
                    >
                      Ghi bàn giao
                    </Button>
                  </Card.Content>
                </Card>
              ) : null}

              <div>
                <p className="mb-2 font-medium">Lịch sử bàn giao</p>
                {state.status === 'loading' && !state.data ? (
                  <Skeleton className="h-24 w-full rounded-xl" />
                ) : null}
                {state.status === 'error' && !state.data ? (
                  <ErrorAlert message={state.message} onRetry={reload} />
                ) : null}
                {state.data && !state.data.length ? (
                  <p className="text-sm text-muted">
                    Chưa có bàn giao cho công việc này.
                  </p>
                ) : null}
                {state.data?.length ? (
                  <ol className="space-y-3">
                    {[...state.data].reverse().map((handover) => (
                      <HandoverEntry
                        key={handover.id}
                        canAct={canAct}
                        handover={handover}
                        onAccessLost={onAccessLost}
                        onAcknowledged={refresh}
                      />
                    ))}
                  </ol>
                ) : null}
              </div>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

/** Operators act on lockers they hold now; admins get a read-only system view. */
export function OperatorTasksView({ mode }: { mode: 'operator' | 'admin' }) {
  const canAct = mode === 'operator';
  const [pages, setPages] = useState(1);
  const [lockerId, setLockerId] = useState('');
  const [kind, setKind] = useState<TaskKind | ''>('');
  const [open, setOpen] = useState<OperatorTask | null>(null);
  const { state, reload } = useAsyncResource(
    async (signal) => {
      const items: OperatorTask[] = [];
      let hasMore = false;

      for (let page = 0; page < pages; page += 1) {
        const result = await listTasks(page * TASK_PAGE_SIZE, signal);

        items.push(...result.items);
        hasMore = result.hasMore;
        if (!hasMore) break;
      }

      return { items, hasMore };
    },
    getTaskErrorMessage,
    [pages],
  );
  const tasks = useMemo(() => state.data?.items ?? [], [state.data]);
  const lockers = useMemo(() => lockerOptions(tasks), [tasks]);
  const rows = useMemo(
    () => filterTasks(tasks, { lockerId, kind }),
    [tasks, lockerId, kind],
  );

  const accessLost = () => {
    setOpen(null);
    reload();
  };

  return (
    <section className="flex w-full flex-col gap-5">
      <p className="text-sm text-muted">
        {canAct
          ? 'Việc chưa xong ở các tủ bạn đang được phân công (kể cả phân công tạm). Mở công việc để xem và ghi bàn giao.'
          : 'Toàn bộ việc chưa xong của hệ thống. Chỉ xem; Operator phụ trách tủ ghi và tiếp nhận bàn giao.'}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <FilterSelect
          label="Tủ"
          options={[
            { id: ALL, label: 'Tất cả tủ' },
            ...lockers.map((item) => ({ id: item.id, label: item.code })),
          ]}
          value={lockerId || ALL}
          onChange={(id) => setLockerId(id === ALL ? '' : id)}
        />
        <FilterSelect
          label="Loại việc"
          options={[
            { id: ALL, label: 'Tất cả loại' },
            ...Object.entries(taskKindLabels).map(([id, label]) => ({
              id,
              label,
            })),
          ]}
          value={kind || ALL}
          onChange={(id) => setKind(id === ALL ? '' : (id as TaskKind))}
        />
        <Button
          className="sm:ml-auto"
          isDisabled={state.status === 'loading'}
          variant="secondary"
          onPress={reload}
        >
          <ArrowRotateRight aria-hidden="true" className="size-4" />
          Tải lại
        </Button>
      </div>

      {state.status === 'error' ? (
        <ErrorAlert message={state.message} onRetry={reload} />
      ) : null}

      <Card>
        <Card.Content className="p-0">
          <Table>
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Công việc đang mở"
                onRowAction={(key) =>
                  setOpen(rows.find((task) => taskKey(task) === key) ?? null)
                }
              >
                <Table.Header>
                  <Table.Column isRowHeader id="title">
                    Công việc
                  </Table.Column>
                  <Table.Column id="kind">Loại</Table.Column>
                  <Table.Column id="locker">Tủ</Table.Column>
                  <Table.Column id="priority">Ưu tiên</Table.Column>
                  <Table.Column id="status">Trạng thái</Table.Column>
                  <Table.Column id="due">Hạn</Table.Column>
                </Table.Header>
                <Table.Body
                  renderEmptyState={() =>
                    state.status === 'loading' ? (
                      <Skeleton className="m-4 h-8 rounded-lg" />
                    ) : (
                      <p className="p-6 text-center text-muted">
                        Không có việc đang mở.
                      </p>
                    )
                  }
                >
                  {rows.map((task) => (
                    <Table.Row
                      key={taskKey(task)}
                      className="cursor-pointer"
                      id={taskKey(task)}
                    >
                      <Table.Cell>
                        <span className="line-clamp-2 max-w-96">
                          {task.title}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        {taskKindLabels[task.kind] ?? task.kind}
                      </Table.Cell>
                      <Table.Cell>{task.lockerCode}</Table.Cell>
                      <Table.Cell>
                        <Chip
                          color={priorityColor(task.priority)}
                          size="sm"
                          variant="soft"
                        >
                          {priorityLabel(task.priority)}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>{taskStatusLabel(task.status)}</Table.Cell>
                      <Table.Cell>
                        <span
                          className={
                            isTaskOverdue(task) ? 'text-danger' : undefined
                          }
                        >
                          {dateTime(task.dueAt)}
                          {isTaskOverdue(task) ? ' · Quá hạn' : ''}
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card.Content>
      </Card>
      {state.data?.hasMore ? (
        <Button
          className="self-center"
          variant="secondary"
          onPress={() => setPages(pages + 1)}
        >
          Tải thêm
        </Button>
      ) : null}

      {open ? (
        <TaskDrawer
          key={taskKey(open)}
          canAct={canAct}
          task={open}
          onAccessLost={accessLost}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </section>
  );
}

export default function OperatorTasksPage() {
  return <OperatorTasksView mode="operator" />;
}
