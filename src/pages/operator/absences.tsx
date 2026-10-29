import type {
  AbsenceFormValues,
  OperatorAbsence,
  ReplacementProposal,
} from '@/services/operator-coverage-service';

import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Skeleton,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import CirclePlus from '@gravity-ui/icons/CirclePlus';

import { useAuth } from '@/auth/auth-context';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { listAdminLockers } from '@/services/admin-locker-service';
import {
  absenceState,
  absenceStateLabels,
  approvalOutcome,
  approveReplacement,
  cancelAbsence,
  canOperatorCancel,
  createAbsence,
  emptyAbsenceForm,
  formatDistance,
  getCoverageErrorMessage,
  listAbsences,
  needsAdminAction,
  REASON_MAX,
  replacementStatusColor,
  replacementStatusLabels,
  suggestReplacements,
  translateReason,
  validateAbsenceForm,
  validateReason,
} from '@/services/operator-coverage-service';
import { userManagementService } from '@/services/user-management-service';

type Mode = 'operator' | 'admin';
type Lookup = { operators: Map<string, string>; lockers: Map<string, string> };

const KEEP_SUGGESTION = 'suggested';
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

function useLookup(mode: Mode) {
  const { user } = useAuth();
  const { state } = useAsyncResource(
    async (signal) => {
      const [operators, lockers] = await Promise.all([
        mode === 'admin'
          ? userManagementService.getUsers({
              role: 'LOCKER_OPERATOR',
              search: '',
              status: 'ALL',
              sortDescriptor: { column: 'fullName', direction: 'ascending' },
              page: 1,
              pageSize: 10_000,
            })
          : Promise.resolve(null),
        listAdminLockers(signal).catch(() => []),
      ]);

      return {
        operators:
          operators && operators.success
            ? operators.data.items.map((item) => ({
                id: item.id,
                label: item.fullName,
                active: item.status === 'ACTIVE',
              }))
            : [],
        lockers: lockers.map((item) => ({ id: item.id, code: item.code })),
      };
    },
    () => '',
    [mode],
  );
  const data = state.data;

  return useMemo(() => {
    const operators = new Map(
      (data?.operators ?? []).map((item) => [item.id, item.label]),
    );

    if (user && !operators.has(user.id)) operators.set(user.id, 'Bạn');

    return {
      lookup: {
        operators,
        lockers: new Map(
          (data?.lockers ?? []).map((item) => [item.id, item.code]),
        ),
      } satisfies Lookup,
      activeOperators: (data?.operators ?? []).filter((item) => item.active),
    };
  }, [data, user]);
}

const nameOf = (lookup: Lookup, id: string | null) =>
  id ? (lookup.operators.get(id) ?? 'Operator khác') : '—';
const lockerOf = (lookup: Lookup, id: string | null) =>
  id ? (lookup.lockers.get(id) ?? 'Tủ khác') : '—';

function OperatorSelect({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  return (
    <Select
      className="w-full"
      isInvalid={Boolean(error)}
      placeholder="Chọn Operator"
      value={value || null}
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
      <FieldError>{error}</FieldError>
    </Select>
  );
}

function AbsenceFormModal({
  mode,
  operators,
  onClose,
  onSaved,
}: {
  mode: Mode;
  operators: Array<{ id: string; label: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [values, setValues] = useState<AbsenceFormValues>(() =>
    emptyAbsenceForm(mode === 'operator' ? (user?.id ?? '') : ''),
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof AbsenceFormValues, string>>
  >({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);

  const update = (patch: Partial<AbsenceFormValues>) => {
    const next = { ...values, ...patch };

    setValues(next);
    if (Object.keys(errors).length) setErrors(validateAbsenceForm(next));
  };

  const save = async () => {
    const next = validateAbsenceForm(values);

    setErrors(next);
    if (Object.keys(next).length || pending.current) return;
    pending.current = true;
    setIsSaving(true);
    setSubmitError('');
    try {
      await createAbsence(values);
      toast.success('Đã ghi nhận vắng mặt', {
        description:
          mode === 'admin'
            ? 'Hệ thống đã tính đề xuất người thay cho các tủ bị ảnh hưởng.'
            : 'Admin sẽ duyệt người thay cho các tủ của bạn.',
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getCoverageErrorMessage(error));
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onOpenChange={(open) => !open && !isSaving && onClose()}>
      <Modal.Backdrop isDismissable={!isSaving}>
        <Modal.Container scroll="inside" size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Ghi nhận vắng mặt</Modal.Heading>
              <Modal.CloseTrigger aria-label="Đóng biểu mẫu vắng mặt" />
            </Modal.Header>
            <Modal.Body className="space-y-4">
              {mode === 'admin' ? (
                <OperatorSelect
                  error={errors.operatorUserId}
                  label="Operator vắng mặt"
                  options={operators}
                  value={values.operatorUserId}
                  onChange={(operatorUserId) => update({ operatorUserId })}
                />
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  fullWidth
                  isInvalid={Boolean(errors.startsAt)}
                  type="datetime-local"
                  value={values.startsAt}
                  onChange={(startsAt) => update({ startsAt })}
                >
                  <Label>Từ</Label>
                  <Input variant="secondary" />
                  <FieldError>{errors.startsAt}</FieldError>
                </TextField>
                <TextField
                  fullWidth
                  isInvalid={Boolean(errors.endsAt)}
                  type="datetime-local"
                  value={values.endsAt}
                  onChange={(endsAt) => update({ endsAt })}
                >
                  <Label>Đến</Label>
                  <Input variant="secondary" />
                  <FieldError>{errors.endsAt}</FieldError>
                </TextField>
              </div>
              <TextField
                fullWidth
                isInvalid={Boolean(errors.reason)}
                value={values.reason}
                onChange={(reason) => update({ reason })}
              >
                <Label>Lý do</Label>
                <TextArea maxLength={REASON_MAX} rows={2} variant="secondary" />
                <FieldError>{errors.reason}</FieldError>
              </TextField>
              {submitError ? <ErrorAlert message={submitError} /> : null}
            </Modal.Body>
            <Modal.Footer>
              <Button
                isDisabled={isSaving}
                variant="secondary"
                onPress={onClose}
              >
                Hủy
              </Button>
              <Button
                isPending={isSaving}
                variant="primary"
                onPress={() => void save()}
              >
                Ghi nhận
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

type ReasonDialog =
  | { kind: 'approve'; proposal: ReplacementProposal }
  | { kind: 'cancel'; absence: OperatorAbsence };

function ReasonModal({
  dialog,
  operators,
  lookup,
  onClose,
  onDone,
}: {
  dialog: ReasonDialog;
  operators: Array<{ id: string; label: string }>;
  lookup: Lookup;
  onClose: () => void;
  onDone: (absence: OperatorAbsence) => void;
}) {
  const [reason, setReason] = useState('');
  const [proposal, setProposal] = useState(
    dialog.kind === 'approve' ? dialog.proposal : null,
  );
  const [notice, setNotice] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);
  const approving = dialog.kind === 'approve';
  const suggested = proposal?.operatorUserId ?? null;

  const confirm = async () => {
    const reasonError = validateReason(reason);

    if (reasonError) {
      setError(reasonError);

      return;
    }
    if (approving && !operatorId && !suggested) {
      setError('Chưa có đề xuất; hãy chọn Operator thay.');

      return;
    }
    if (pending.current) return;
    pending.current = true;
    setIsSaving(true);
    setError('');
    try {
      const absence = approving
        ? await approveReplacement(proposal!.id, operatorId || null, reason)
        : await cancelAbsence(dialog.absence.id, reason);

      onDone(absence);
      if (approving) {
        const outcome = approvalOutcome(absence, proposal!.id);

        if (!outcome.granted) {
          // Nothing was granted: show the refreshed proposal and keep the
          // dialog open so the admin reviews it and approves again.
          if (outcome.proposal) setProposal(outcome.proposal);
          setOperatorId('');
          setNotice(
            outcome.proposal?.status === 'NeedsApproval'
              ? 'Chưa cấp quyền thay: điều kiện (chính sách, tọa độ hoặc tải) đã đổi nên hệ thống đã cập nhật đề xuất. Xem lại người thay bên dưới và bấm Duyệt lần nữa.'
              : `Chưa cấp quyền thay: trạng thái hiện tại là "${outcome.proposal ? replacementStatusLabels[outcome.proposal.status] : 'không xác định'}". Kiểm tra lại đề xuất.`,
          );

          return;
        }
      }
      toast.success(approving ? 'Đã duyệt người thay' : 'Đã hủy vắng mặt', {
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      onClose();
    } catch (confirmError) {
      setError(getCoverageErrorMessage(confirmError));
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onOpenChange={(open) => !open && !isSaving && onClose()}>
      <Modal.Backdrop isDismissable={!isSaving}>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>
                {approving
                  ? `Duyệt người thay · Tủ ${lockerOf(lookup, proposal!.lockerId)}`
                  : 'Hủy vắng mặt và kết thúc thay thế'}
              </Modal.Heading>
              <Modal.CloseTrigger aria-label="Đóng" />
            </Modal.Header>
            <Modal.Body className="space-y-4">
              {approving && proposal ? (
                <>
                  {notice ? (
                    <Alert role="alert" status="warning">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Description>{notice}</Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : null}
                  <p className="text-sm">
                    Đề xuất của hệ thống:{' '}
                    <strong>
                      {suggested
                        ? nameOf(lookup, suggested)
                        : 'không có người phù hợp'}
                    </strong>
                    {proposal.anchorLockerId
                      ? ` · mốc tủ ${lockerOf(lookup, proposal.anchorLockerId)}, cách ${formatDistance(proposal.distanceKm)}, tải ${proposal.loadBefore ?? '—'} → ${proposal.loadAfter ?? '—'}`
                      : ''}
                  </p>
                  <p className="text-xs text-muted">
                    {replacementStatusLabels[proposal.status]} ·{' '}
                    {translateReason(proposal.statusReason)}
                  </p>
                  <OperatorSelect
                    label="Chỉ định / đổi người thay (không bắt buộc)"
                    options={[
                      {
                        id: KEEP_SUGGESTION,
                        label: suggested
                          ? 'Giữ đề xuất của hệ thống'
                          : 'Chọn Operator',
                      },
                      ...operators,
                    ]}
                    value={operatorId || KEEP_SUGGESTION}
                    onChange={(id) =>
                      setOperatorId(id === KEEP_SUGGESTION ? '' : id)
                    }
                  />
                  <p className="text-xs text-muted">
                    Người được chọn vẫn phải thỏa bán kính, khu vực và giới hạn
                    tải của chính sách; nếu không BE sẽ từ chối.
                  </p>
                </>
              ) : (
                <p className="text-sm">
                  Mọi phân công thay chưa kết thúc của khoảng vắng mặt này sẽ bị
                  hủy và người thay mất quyền tại tủ.
                </p>
              )}
              <TextField
                fullWidth
                isInvalid={Boolean(error)}
                value={reason}
                onChange={setReason}
              >
                <Label>Lý do</Label>
                <TextArea maxLength={REASON_MAX} rows={2} variant="secondary" />
                <FieldError>{error}</FieldError>
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button
                isDisabled={isSaving}
                variant="secondary"
                onPress={onClose}
              >
                Đóng
              </Button>
              <Button
                isPending={isSaving}
                variant={approving ? 'primary' : 'danger'}
                onPress={() => void confirm()}
              >
                {approving ? 'Duyệt' : 'Hủy vắng mặt'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function ProposalRow({
  proposal,
  lookup,
  canApprove,
  onApprove,
}: {
  proposal: ReplacementProposal;
  lookup: Lookup;
  canApprove: boolean;
  onApprove: () => void;
}) {
  return (
    <li className="space-y-1 rounded-xl border border-separator p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <strong>Tủ {lockerOf(lookup, proposal.lockerId)}</strong>
        <Chip
          color={replacementStatusColor(proposal.status)}
          size="sm"
          variant="soft"
        >
          {replacementStatusLabels[proposal.status] ?? proposal.status}
        </Chip>
        {canApprove ? (
          <Button
            className="ml-auto"
            size="sm"
            variant={needsAdminAction(proposal) ? 'primary' : 'secondary'}
            onPress={onApprove}
          >
            {needsAdminAction(proposal) ? 'Duyệt / chỉ định' : 'Đổi người thay'}
          </Button>
        ) : null}
      </div>
      <dl className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted">Người quản lý gốc</dt>
        <dd>{nameOf(lookup, proposal.originalOperatorUserId)}</dd>
        <dt className="text-muted">Người thay</dt>
        <dd>{nameOf(lookup, proposal.operatorUserId)}</dd>
        <dt className="text-muted">Tủ làm mốc</dt>
        <dd>
          {lockerOf(lookup, proposal.anchorLockerId)}
          {proposal.distanceKm !== null
            ? ` · cách ${formatDistance(proposal.distanceKm)} (giữa hai tủ)`
            : ''}
        </dd>
        <dt className="text-muted">Khu vực</dt>
        <dd>{proposal.serviceArea ?? '—'}</dd>
        <dt className="text-muted">Tải trước → sau</dt>
        <dd>
          {proposal.loadBefore ?? '—'} → {proposal.loadAfter ?? '—'} tủ
        </dd>
        <dt className="text-muted">Lý do / trạng thái</dt>
        <dd>{translateReason(proposal.statusReason)}</dd>
        {proposal.approvedAt ? (
          <>
            <dt className="text-muted">Duyệt lúc</dt>
            <dd>{dateTime(proposal.approvedAt)}</dd>
          </>
        ) : null}
      </dl>
    </li>
  );
}

export function OperatorAbsencesView({ mode }: { mode: Mode }) {
  const isAdmin = mode === 'admin';
  const { lookup, activeOperators } = useLookup(mode);
  const { state, setState, reload } = useAsyncResource(
    listAbsences,
    getCoverageErrorMessage,
    [],
  );
  const [isCreating, setIsCreating] = useState(false);
  const [dialog, setDialog] = useState<ReasonDialog | null>(null);
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');
  const operatorOptions = activeOperators.map((item) => ({
    id: item.id,
    label: item.label,
  }));

  const replace = (absence: OperatorAbsence) =>
    setState((current) => ({
      status: 'success',
      data: (current.data ?? []).map((item) =>
        item.id === absence.id ? absence : item,
      ),
    }));

  const recompute = async (absence: OperatorAbsence) => {
    if (busyId) return;
    setBusyId(absence.id);
    setActionError('');
    try {
      replace(await suggestReplacements(absence.id));
      toast.success('Đã tính lại đề xuất người thay');
    } catch (error) {
      setActionError(getCoverageErrorMessage(error));
    } finally {
      setBusyId('');
    }
  };

  const absences = [...(state.data ?? [])].sort((a, b) =>
    b.startsAt.localeCompare(a.startsAt),
  );
  const pendingCount = absences
    .filter((absence) => ['upcoming', 'active'].includes(absenceState(absence)))
    .flatMap((absence) => absence.proposals)
    .filter(needsAdminAction).length;

  return (
    <section className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted">
          {isAdmin
            ? 'Vắng mặt của Operator và người thay tại từng tủ. Hệ thống chỉ đề xuất theo khoảng cách giữa các tủ (không dùng GPS nhân viên hay thời gian đi đường); Admin duyệt hoặc chỉ định.'
            : 'Báo vắng mặt để Admin sắp xếp người thay tại các tủ bạn quản lý.'}
        </p>
        <div className="ml-auto flex gap-2">
          <Button
            isDisabled={state.status === 'loading'}
            variant="secondary"
            onPress={reload}
          >
            <ArrowRotateRight aria-hidden="true" className="size-4" />
            Tải lại
          </Button>
          <Button variant="primary" onPress={() => setIsCreating(true)}>
            <CirclePlus aria-hidden="true" className="size-4" />
            Ghi nhận vắng mặt
          </Button>
        </div>
      </div>

      {isAdmin && pendingCount ? (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {pendingCount} tủ đang chờ xử lý người thay
            </Alert.Title>
            <Alert.Description>
              Thiếu tọa độ/tủ làm mốc, không có người đủ điều kiện trong bán
              kính, hoặc đề xuất chưa được duyệt.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {state.status === 'error' ? (
        <ErrorAlert message={state.message} onRetry={reload} />
      ) : null}
      {actionError ? <ErrorAlert message={actionError} /> : null}
      {state.status === 'loading' && !state.data ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : null}
      {state.data && !absences.length ? (
        <p className="py-8 text-center text-muted">
          Chưa có khoảng vắng mặt nào.
        </p>
      ) : null}

      {absences.map((absence) => {
        const status = absenceState(absence);
        const open = status === 'upcoming' || status === 'active';

        return (
          <Card key={absence.id}>
            <Card.Header className="flex-row flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <Card.Title>
                  {nameOf(lookup, absence.operatorUserId)} ·{' '}
                  {dateTime(absence.startsAt)} → {dateTime(absence.endsAt)}
                </Card.Title>
                <Card.Description className="whitespace-pre-wrap">
                  {absence.reason}
                </Card.Description>
              </div>
              <Chip
                color={open ? 'warning' : 'default'}
                size="sm"
                variant="soft"
              >
                {absenceStateLabels[status]}
              </Chip>
            </Card.Header>
            <Card.Content className="space-y-3">
              {absence.proposals.length ? (
                <ul className="space-y-2">
                  {absence.proposals.map((proposal) => (
                    <ProposalRow
                      key={proposal.id}
                      canApprove={
                        isAdmin &&
                        open &&
                        !['Cancelled', 'Expired'].includes(proposal.status)
                      }
                      lookup={lookup}
                      proposal={proposal}
                      onApprove={() => setDialog({ kind: 'approve', proposal })}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Không có tủ bị ảnh hưởng.</p>
              )}
              {open ? (
                <div className="flex flex-wrap gap-2">
                  {isAdmin ? (
                    <Button
                      isPending={busyId === absence.id}
                      size="sm"
                      variant="secondary"
                      onPress={() => void recompute(absence)}
                    >
                      Tính lại đề xuất
                    </Button>
                  ) : null}
                  {isAdmin || canOperatorCancel(absence) ? (
                    <Button
                      size="sm"
                      variant="danger-soft"
                      onPress={() => setDialog({ kind: 'cancel', absence })}
                    >
                      Hủy vắng mặt
                    </Button>
                  ) : (
                    <p className="text-xs text-muted">
                      Đã có người thay được duyệt; liên hệ Admin nếu cần hủy.
                    </p>
                  )}
                </div>
              ) : null}
            </Card.Content>
          </Card>
        );
      })}

      {isCreating ? (
        <AbsenceFormModal
          mode={mode}
          operators={operatorOptions}
          onClose={() => setIsCreating(false)}
          onSaved={reload}
        />
      ) : null}
      {dialog ? (
        <ReasonModal
          dialog={dialog}
          lookup={lookup}
          operators={operatorOptions}
          onClose={() => setDialog(null)}
          onDone={replace}
        />
      ) : null}
    </section>
  );
}

export default function OperatorAbsencesPage() {
  return <OperatorAbsencesView mode="operator" />;
}
