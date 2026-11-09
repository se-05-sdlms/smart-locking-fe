import type { IncidentDetail, IncidentTransition } from '@/types/incident';

import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertDialog,
  Button,
  Chip,
  Description,
  Drawer,
  FieldError,
  Label,
  Separator,
  Skeleton,
  TextArea,
  TextField,
  Typography,
  toast,
} from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import Xmark from '@gravity-ui/icons/Xmark';

import {
  INCIDENT_SOURCE_LABELS,
  INCIDENT_STATUS_DISPLAY,
  INCIDENT_TEXT_MAX_LENGTH,
  INCIDENT_TRANSITION_TEXT,
} from '@/constants/incident';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { maintenanceFormHref } from '@/services/maintenance-service';
import {
  addIncidentAction,
  canAddIncidentAction,
  formatIncidentActionType,
  formatIncidentType,
  getIncidentDetail,
  getIncidentLoadErrorMessage,
  getIncidentMutationErrorMessage,
  getOperatorTransitions,
  updateIncidentStatus,
  validateIncidentText,
} from '@/services/incident-service';

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatIncidentDateTime(value: string | null | undefined) {
  if (!value) return '—';

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

export function IncidentStatusChip({
  status,
}: {
  status: IncidentDetail['status'];
}) {
  const display = INCIDENT_STATUS_DISPLAY[status];

  return (
    <Chip color={display.color} size="sm" variant="soft">
      {display.label}
    </Chip>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert role="alert" status="danger">
      <Alert.Indicator>
        <CircleExclamation aria-hidden="true" className="size-5" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(7rem,0.7fr)_1.3fr] gap-4 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

function Timeline({ incident }: { incident: IncidentDetail }) {
  if (!incident.actions.length) {
    return <p className="text-sm text-muted">Chưa có hoạt động nào.</p>;
  }

  return (
    <ol aria-label="Dòng thời gian xử lý" className="space-y-4">
      {incident.actions.map((action) => (
        <li key={action.id} className="border-l-2 border-border pl-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">
              {formatIncidentActionType(action.actionType)}
            </span>
            {action.toStatus ? (
              <IncidentStatusChip status={action.toStatus} />
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            {action.actionByName} · {formatIncidentDateTime(action.createdAt)}
          </p>
          {action.notes ? (
            <p className="mt-2 whitespace-pre-wrap text-sm">{action.notes}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

type IncidentDetailDrawerProps = {
  incidentId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Called after a successful mutation so the list can refresh. */
  onChanged: () => void;
};

export function IncidentDetailDrawer({
  incidentId,
  isOpen,
  onOpenChange,
  onChanged,
}: IncidentDetailDrawerProps) {
  const load = useCallback(
    (signal: AbortSignal) => getIncidentDetail(incidentId, signal),
    [incidentId],
  );
  const { state, setState, reload } = useAsyncResource(
    load,
    getIncidentLoadErrorMessage,
    [incidentId],
  );
  const incident = state.data;
  const navigate = useNavigate();

  const [note, setNote] = useState('');
  const [noteSubmitted, setNoteSubmitted] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  const [transition, setTransition] = useState<IncidentTransition | null>(null);
  const [transitionText, setTransitionText] = useState('');
  const [transitionSubmitted, setTransitionSubmitted] = useState(false);
  const [transitionError, setTransitionError] = useState('');
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const pending = useRef(false);

  const applyUpdate = (updated: IncidentDetail) => {
    setState({ status: 'success', data: updated });
    onChanged();
  };

  const saveNote = async () => {
    setNoteSubmitted(true);
    if (!incident || validateIncidentText(note, true) || pending.current)
      return;

    pending.current = true;
    setIsSavingNote(true);
    setNoteError('');

    try {
      applyUpdate(await addIncidentAction(incident.id, note));
      setNote('');
      setNoteSubmitted(false);
      toast.success('Đã ghi nhận hành động', {
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
    } catch (error) {
      setNoteError(getIncidentMutationErrorMessage(error));
    } finally {
      pending.current = false;
      setIsSavingNote(false);
    }
  };

  const openTransition = (next: IncidentTransition) => {
    setTransition(next);
    setTransitionText('');
    setTransitionSubmitted(false);
    setTransitionError('');
  };

  const closeTransition = () => {
    if (isChangingStatus) return;
    setTransition(null);
  };

  const transitionCopy = transition
    ? INCIDENT_TRANSITION_TEXT[transition]
    : null;
  const transitionValidation = transition
    ? validateIncidentText(
        transitionText,
        INCIDENT_TRANSITION_TEXT[transition].fieldRequired,
      )
    : undefined;

  const confirmTransition = async () => {
    setTransitionSubmitted(true);
    if (!incident || !transition || transitionValidation || pending.current) {
      return;
    }

    pending.current = true;
    setIsChangingStatus(true);
    setTransitionError('');

    try {
      applyUpdate(
        await updateIncidentStatus(incident.id, transition, transitionText),
      );
      toast.success(INCIDENT_TRANSITION_TEXT[transition].success, {
        description: incident.title,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      setTransition(null);
    } catch (error) {
      setTransitionError(getIncidentMutationErrorMessage(error));
    } finally {
      pending.current = false;
      setIsChangingStatus(false);
    }
  };

  const transitions = incident ? getOperatorTransitions(incident.status) : [];
  const canAddAction = incident ? canAddIncidentAction(incident.status) : false;

  return (
    <>
      <Drawer isOpen={isOpen} onOpenChange={onOpenChange}>
        <Drawer.Backdrop>
          <Drawer.Content placement="right">
            <Drawer.Dialog className="w-full sm:max-w-lg">
              <Drawer.CloseTrigger aria-label="Đóng chi tiết sự cố">
                <Xmark aria-hidden="true" className="size-5" />
              </Drawer.CloseTrigger>
              <Drawer.Header>
                <Drawer.Heading>Chi tiết sự cố</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body>
                {state.status === 'loading' && !incident ? (
                  <div
                    aria-busy="true"
                    aria-label="Đang tải chi tiết sự cố"
                    className="space-y-3"
                  >
                    <Skeleton className="h-6 w-2/3 rounded-lg" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-40 w-full rounded-xl" />
                  </div>
                ) : null}

                {state.status === 'error' && !incident ? (
                  <div className="space-y-3">
                    <ErrorAlert message={state.message} />
                    <Button size="sm" variant="secondary" onPress={reload}>
                      <ArrowRotateRight aria-hidden="true" className="size-4" />
                      Thử lại
                    </Button>
                  </div>
                ) : null}

                {incident ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <IncidentStatusChip status={incident.status} />
                        <Chip size="sm" variant="soft">
                          {formatIncidentType(incident.type)}
                        </Chip>
                      </div>
                      <Typography type="h5">{incident.title}</Typography>
                      <p className="whitespace-pre-wrap text-sm">
                        {incident.description}
                      </p>
                    </div>

                    <dl>
                      <DetailRow label="Tủ">
                        {incident.lockerCode} · {incident.lockerAddress}
                      </DetailRow>
                      {incident.lockerCompartmentCode ? (
                        <DetailRow label="Ngăn">
                          {incident.lockerCompartmentCode}
                        </DetailRow>
                      ) : null}
                      {incident.parcelCode ? (
                        <DetailRow label="Bưu kiện">
                          {incident.parcelCode}
                        </DetailRow>
                      ) : null}
                      {incident.returnCode ? (
                        <DetailRow label="Hàng gửi trả">
                          {incident.returnCode}
                        </DetailRow>
                      ) : null}
                      <DetailRow label="Nguồn báo cáo">
                        {INCIDENT_SOURCE_LABELS[incident.source]}
                      </DetailRow>
                      {incident.reporterPhone ? (
                        <DetailRow label="Liên hệ người báo">
                          <a
                            className="text-accent underline-offset-2 hover:underline"
                            href={`tel:${incident.reporterPhone}`}
                          >
                            {incident.reporterPhone}
                          </a>
                        </DetailRow>
                      ) : null}
                      <DetailRow label="Người phụ trách">
                        {incident.assignedOperatorName ?? 'Chưa có'}
                      </DetailRow>
                      <DetailRow label="Thời điểm báo">
                        {formatIncidentDateTime(incident.createdAt)}
                      </DetailRow>
                      {incident.escalatedAt ? (
                        <DetailRow label="Chuyển cấp lúc">
                          {formatIncidentDateTime(incident.escalatedAt)}
                        </DetailRow>
                      ) : null}
                      {incident.resolvedAt ? (
                        <DetailRow label="Giải quyết lúc">
                          {formatIncidentDateTime(incident.resolvedAt)}
                        </DetailRow>
                      ) : null}
                      {incident.resolutionSummary ? (
                        <DetailRow label="Kết quả xử lý">
                          {incident.resolutionSummary}
                        </DetailRow>
                      ) : null}
                    </dl>
                    {incident.status !== 'Resolved' ? (
                      <Button
                        className="self-start"
                        size="sm"
                        variant="secondary"
                        onPress={() =>
                          navigate(
                            maintenanceFormHref({
                              lockerId: incident.lockerId,
                              compartmentId: incident.lockerCompartmentId,
                              incidentId: incident.id,
                            }),
                          )
                        }
                      >
                        Tạo phiếu bảo trì từ sự cố
                      </Button>
                    ) : null}

                    {incident.status === 'Escalated' ? (
                      <Alert status="warning">
                        <Alert.Indicator>
                          <CircleExclamation
                            aria-hidden="true"
                            className="size-5"
                          />
                        </Alert.Indicator>
                        <Alert.Content>
                          <Alert.Description>
                            Sự cố đã chuyển cấp. Quản trị viên sẽ tiếp tục xử
                            lý; bạn vẫn có thể ghi nhận thêm hành động.
                          </Alert.Description>
                        </Alert.Content>
                      </Alert>
                    ) : null}

                    {transitions.length ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        {transitions.map((next) => (
                          <Button
                            key={next}
                            fullWidth
                            variant={
                              next === 'Escalated' ? 'danger-soft' : 'primary'
                            }
                            onPress={() => openTransition(next)}
                          >
                            {INCIDENT_TRANSITION_TEXT[next].button}
                          </Button>
                        ))}
                      </div>
                    ) : null}

                    <Separator />

                    {canAddAction ? (
                      <div className="space-y-3">
                        <TextField
                          fullWidth
                          isRequired
                          isDisabled={isSavingNote}
                          isInvalid={
                            noteSubmitted &&
                            Boolean(validateIncidentText(note, true))
                          }
                          maxLength={INCIDENT_TEXT_MAX_LENGTH}
                          value={note}
                          onChange={setNote}
                        >
                          <Label>Ghi nhận hành động tại hiện trường</Label>
                          <TextArea
                            placeholder="Ví dụ: Đã kiểm tra, cửa ngăn kẹt do lò xo, đã reset thiết bị..."
                            rows={3}
                          />
                          <Description>
                            {note.trim().length}/{INCIDENT_TEXT_MAX_LENGTH}
                          </Description>
                          <FieldError>
                            {validateIncidentText(note, true)}
                          </FieldError>
                        </TextField>
                        {noteError ? <ErrorAlert message={noteError} /> : null}
                        <Button
                          isDisabled={isSavingNote}
                          variant="secondary"
                          onPress={() => void saveNote()}
                        >
                          {isSavingNote ? 'Đang lưu...' : 'Lưu hành động'}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted">
                        Sự cố đã được giải quyết, không thể ghi thêm hành động.
                      </p>
                    )}

                    <Separator />

                    <div className="space-y-3">
                      <Typography type="h6">Dòng thời gian xử lý</Typography>
                      <Timeline incident={incident} />
                    </div>
                  </div>
                ) : null}
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

      <AlertDialog>
        <AlertDialog.Backdrop
          isDismissable={!isChangingStatus}
          isOpen={transition !== null}
          onOpenChange={(open) => {
            if (!open) closeTransition();
          }}
        >
          <AlertDialog.Container size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon
                  status={transition === 'Escalated' ? 'danger' : 'warning'}
                >
                  <CircleExclamation aria-hidden="true" className="size-6" />
                </AlertDialog.Icon>
                <AlertDialog.Heading>
                  {transitionCopy?.title}
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="space-y-4">
                <p className="text-sm">{transitionCopy?.description}</p>
                {transitionCopy ? (
                  <TextField
                    fullWidth
                    isDisabled={isChangingStatus}
                    isInvalid={
                      transitionSubmitted && Boolean(transitionValidation)
                    }
                    isRequired={transitionCopy.fieldRequired}
                    maxLength={INCIDENT_TEXT_MAX_LENGTH}
                    value={transitionText}
                    onChange={setTransitionText}
                  >
                    <Label>{transitionCopy.fieldLabel}</Label>
                    <TextArea rows={4} />
                    <FieldError>{transitionValidation}</FieldError>
                  </TextField>
                ) : null}
                {transitionError ? (
                  <ErrorAlert message={transitionError} />
                ) : null}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  isDisabled={isChangingStatus}
                  variant="ghost"
                  onPress={closeTransition}
                >
                  Hủy
                </Button>
                <Button
                  isDisabled={isChangingStatus}
                  variant={transition === 'Escalated' ? 'danger' : 'primary'}
                  onPress={() => void confirmTransition()}
                >
                  {isChangingStatus
                    ? 'Đang cập nhật...'
                    : transitionCopy?.confirm}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  );
}
