import type {
  MaintenanceFormErrors,
  MaintenanceFormValues,
  MaintenancePriority,
} from '@/services/maintenance-service';
import type { MaintenanceItem } from '@/services/operations-service';

import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  FieldError,
  Form,
  Label,
  ListBox,
  Modal,
  Select,
  Skeleton,
  TextArea,
  TextField,
  toast,
  Typography,
} from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import Wrench from '@gravity-ui/icons/Wrench';

import { COMPARTMENT_OPERATIONAL_STATUS_DISPLAY } from '@/constants/operator-locker';
import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  buildCreateMaintenanceRequest,
  changeMaintenanceLocker,
  describeMaintenanceTarget,
  emptyMaintenanceForm,
  getMaintenanceErrorMessage,
  MAINTENANCE_DESCRIPTION_MAX_LENGTH,
  MAINTENANCE_PRIORITY_LABELS,
  MAINTENANCE_STATUS_DISPLAY,
  validateMaintenanceForm,
  WHOLE_LOCKER,
} from '@/services/maintenance-service';
import { getLockerDetail } from '@/services/operator-locker-service';
import { operationsService } from '@/services/operations-service';

const WHOLE_LOCKER_KEY = '__whole__';
const PRIORITIES: MaintenancePriority[] = [0, 1, 2, 3];
const dateTimeFormat = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert role="alert" status="danger">
      <Alert.Indicator>
        <CircleExclamation aria-hidden="true" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

function CreateMaintenanceCard({ onCreated }: { onCreated: () => void }) {
  const [searchParams] = useSearchParams();
  const [values, setValues] = useState<MaintenanceFormValues>(() =>
    emptyMaintenanceForm({
      lockerId: searchParams.get('lockerId') ?? undefined,
      compartmentId: searchParams.get('compartmentId') ?? undefined,
      incidentId: searchParams.get('incidentId') ?? undefined,
    }),
  );
  const [errors, setErrors] = useState<MaintenanceFormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);

  const lockers = useAsyncResource(
    (signal) => operationsService.lockers(signal),
    getMaintenanceErrorMessage,
    [],
  );
  const detail = useAsyncResource(
    (signal) =>
      values.lockerId
        ? getLockerDetail(values.lockerId, signal)
        : Promise.resolve(null),
    getMaintenanceErrorMessage,
    [values.lockerId],
  );

  const lockerList = lockers.state.data ?? [];
  const compartments =
    detail.state.status === 'success' &&
    detail.state.data?.id === values.lockerId
      ? detail.state.data.compartments
      : [];
  const selectedLocker = lockerList.find(
    (locker) => locker.id === values.lockerId,
  );
  const selectedCompartment = compartments.find(
    (compartment) => compartment.id === values.compartmentId,
  );

  const update = (next: MaintenanceFormValues) => {
    setValues(next);
    if (Object.keys(errors).length) setErrors(validateMaintenanceForm(next));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateMaintenanceForm(values);

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || pending.current) return;

    pending.current = true;
    setIsSaving(true);
    setSubmitError('');

    try {
      await operationsService.createMaintenance(
        buildCreateMaintenanceRequest(values),
      );
      toast.success('Đã tạo phiếu bảo trì', {
        description: describeMaintenanceTarget(
          selectedLocker?.code,
          selectedCompartment?.code,
        ),
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      setValues(emptyMaintenanceForm({ lockerId: values.lockerId }));
      onCreated();
    } catch (error) {
      setSubmitError(getMaintenanceErrorMessage(error));
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <Card.Header className="flex-row items-center gap-3">
        <Wrench aria-hidden="true" className="size-5 text-accent" />
        <Card.Title>Tạo phiếu bảo trì</Card.Title>
      </Card.Header>
      <Card.Content>
        <Form
          className="grid gap-4 md:grid-cols-2"
          validationBehavior="aria"
          onSubmit={submit}
        >
          <Select
            isDisabled={isSaving || lockers.state.status === 'loading'}
            isInvalid={Boolean(errors.lockerId)}
            value={values.lockerId || null}
            variant="secondary"
            onChange={(key) =>
              update(changeMaintenanceLocker(values, String(key)))
            }
          >
            <Label>Tủ</Label>
            <Select.Trigger>
              <Select.Value>
                {selectedLocker ? undefined : 'Chọn tủ trong phạm vi phụ trách'}
              </Select.Value>
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {lockerList.map((locker) => (
                  <ListBox.Item
                    key={locker.id}
                    id={locker.id}
                    textValue={`${locker.code} ${locker.address}`}
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{locker.code}</span>
                      <span className="text-xs text-muted">
                        {locker.address}
                      </span>
                    </span>
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
            <FieldError>{errors.lockerId}</FieldError>
          </Select>

          <Select
            isDisabled={
              isSaving || !values.lockerId || detail.state.status === 'loading'
            }
            value={values.compartmentId || WHOLE_LOCKER_KEY}
            variant="secondary"
            onChange={(key) =>
              update({
                ...values,
                compartmentId:
                  key === WHOLE_LOCKER_KEY ? WHOLE_LOCKER : String(key),
              })
            }
          >
            <Label>Ngăn</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id={WHOLE_LOCKER_KEY} textValue="Bảo trì cả tủ">
                  Bảo trì cả tủ
                </ListBox.Item>
                {compartments.map((compartment) => (
                  <ListBox.Item
                    key={compartment.id}
                    id={compartment.id}
                    textValue={compartment.code}
                  >
                    {compartment.code} ·{' '}
                    {
                      COMPARTMENT_OPERATIONAL_STATUS_DISPLAY[
                        compartment.operationalStatus
                      ].label
                    }
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
            <Description>
              {detail.state.status === 'error'
                ? 'Không tải được danh sách ngăn; vẫn có thể bảo trì cả tủ.'
                : 'Đổi tủ sẽ bỏ ngăn đã chọn trước đó.'}
            </Description>
          </Select>

          <Select
            isDisabled={isSaving}
            value={String(values.priority)}
            variant="secondary"
            onChange={(key) =>
              update({
                ...values,
                priority: Number(key) as MaintenancePriority,
              })
            }
          >
            <Label>Mức ưu tiên</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {PRIORITIES.map((priority) => (
                  <ListBox.Item
                    key={priority}
                    id={String(priority)}
                    textValue={MAINTENANCE_PRIORITY_LABELS[priority]}
                  >
                    {MAINTENANCE_PRIORITY_LABELS[priority]}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <div className="flex flex-col justify-end gap-1 text-sm">
            <span className="text-muted">Đối tượng bảo trì</span>
            <span className="font-medium">
              {describeMaintenanceTarget(
                selectedLocker?.code,
                selectedCompartment?.code,
              )}
            </span>
            {values.incidentId ? (
              <span className="text-xs text-muted">
                Liên kết với sự cố đang xử lý.
              </span>
            ) : null}
          </div>

          <TextField
            fullWidth
            isRequired
            className="md:col-span-2"
            isDisabled={isSaving}
            isInvalid={Boolean(errors.description)}
            maxLength={MAINTENANCE_DESCRIPTION_MAX_LENGTH}
            value={values.description}
            onChange={(description) => update({ ...values, description })}
          >
            <Label>Mô tả lỗi / lý do bảo trì</Label>
            <TextArea
              placeholder="Ví dụ: Cửa ngăn đóng không khít, khóa không bật"
              rows={3}
              variant="secondary"
            />
            <FieldError>{errors.description}</FieldError>
          </TextField>

          {submitError ? (
            <div className="md:col-span-2">
              <ErrorAlert message={submitError} />
            </div>
          ) : null}

          <div className="flex justify-end md:col-span-2">
            <Button isDisabled={isSaving} type="submit" variant="primary">
              {isSaving ? 'Đang tạo...' : 'Tạo phiếu bảo trì'}
            </Button>
          </div>
        </Form>
      </Card.Content>
    </Card>
  );
}

type PendingAction = { item: MaintenanceItem; kind: 'close' | 'cancel' };

function FinishMaintenanceModal({
  action,
  onClose,
  onDone,
}: {
  action: PendingAction;
  onClose: () => void;
  onDone: () => void;
}) {
  const isClosing = action.kind === 'close';
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) {
      setError(
        isClosing ? 'Vui lòng nhập kết quả xử lý.' : 'Vui lòng nhập lý do hủy.',
      );

      return;
    }
    if (isSaving) return;

    setIsSaving(true);
    setSubmitError('');

    try {
      await operationsService.updateMaintenance(
        action.item.id,
        isClosing
          ? { status: 2, resolutionSummary: text.trim() }
          : { status: 3, notes: text.trim() },
      );
      toast.success(
        isClosing ? 'Đã đóng phiếu bảo trì' : 'Đã hủy phiếu bảo trì',
        {
          indicator: <CircleCheck aria-hidden="true" className="size-5" />,
        },
      );
      onDone();
      onClose();
    } catch (failure) {
      setSubmitError(getMaintenanceErrorMessage(failure));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onOpenChange={(open) => !open && !isSaving && onClose()}>
      <Modal.Backdrop isDismissable={!isSaving}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>
                {isClosing ? 'Đóng phiếu bảo trì' : 'Hủy phiếu bảo trì'} ·{' '}
                {action.item.lockerCode}
                {action.item.compartmentCode
                  ? ` · ${action.item.compartmentCode}`
                  : ''}
              </Modal.Heading>
            </Modal.Header>
            <Form validationBehavior="aria" onSubmit={submit}>
              <Modal.Body className="space-y-4">
                <TextField
                  fullWidth
                  isRequired
                  isDisabled={isSaving}
                  isInvalid={Boolean(error)}
                  value={text}
                  onChange={(value) => {
                    setText(value);
                    if (error && value.trim()) setError('');
                  }}
                >
                  <Label>{isClosing ? 'Kết quả xử lý' : 'Lý do hủy'}</Label>
                  <TextArea rows={3} variant="secondary" />
                  <FieldError>{error}</FieldError>
                </TextField>
                {submitError ? <ErrorAlert message={submitError} /> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button isDisabled={isSaving} variant="ghost" onPress={onClose}>
                  Quay lại
                </Button>
                <Button
                  isDisabled={isSaving}
                  type="submit"
                  variant={isClosing ? 'primary' : 'danger'}
                >
                  {isSaving
                    ? 'Đang lưu...'
                    : isClosing
                      ? 'Đóng phiếu'
                      : 'Hủy phiếu'}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export default function OperatorMaintenancePage() {
  const { state, reload, refresh } = useAsyncResource(
    () => operationsService.maintenance(),
    getMaintenanceErrorMessage,
    [],
  );
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [startingId, setStartingId] = useState<string | null>(null);

  const start = useCallback(
    async (item: MaintenanceItem) => {
      if (startingId) return;
      setStartingId(item.id);
      try {
        await operationsService.updateMaintenance(item.id, { status: 1 });
        toast.success('Đã chuyển phiếu sang đang xử lý');
      } catch (error) {
        toast.danger(getMaintenanceErrorMessage(error));
      } finally {
        setStartingId(null);
        refresh();
      }
    },
    [refresh, startingId],
  );

  const items = state.data ?? [];

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Typography type="h2">Bảo trì locker</Typography>
        <p className="text-muted">
          Tạo, theo dõi và đóng công việc bảo trì trong phạm vi tủ bạn đang phụ
          trách.
        </p>
      </div>

      <CreateMaintenanceCard onCreated={refresh} />

      <div className="flex items-center justify-between">
        <Typography type="h4">Phiếu bảo trì</Typography>
        <Button
          isDisabled={state.status === 'loading'}
          variant="secondary"
          onPress={refresh}
        >
          <ArrowRotateRight aria-hidden="true" className="size-4" />
          Làm mới
        </Button>
      </div>

      {state.status === 'error' ? (
        <Alert role="alert" status="danger">
          <Alert.Content>
            <Alert.Description>{state.message}</Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="secondary" onPress={reload}>
            Thử lại
          </Button>
        </Alert>
      ) : null}
      {state.status === 'loading' && !state.data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : null}
      {state.data && items.length === 0 ? (
        <p className="text-sm text-muted">Chưa có phiếu bảo trì nào.</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => {
          const status = MAINTENANCE_STATUS_DISPLAY[item.status];
          const isOpen = item.status === 0 || item.status === 1;

          return (
            <Card key={item.id}>
              <Card.Header className="flex-row items-center justify-between gap-2">
                <Card.Title>
                  {describeMaintenanceTarget(
                    item.lockerCode,
                    item.compartmentCode ?? undefined,
                  )}
                </Card.Title>
                <Chip color={status.color} size="sm" variant="soft">
                  {status.label}
                </Chip>
              </Card.Header>
              <Card.Content className="space-y-2 pb-6">
                <p>{item.description}</p>
                <p className="text-sm text-muted">
                  Ưu tiên: {MAINTENANCE_PRIORITY_LABELS[item.priority]} · Tạo
                  lúc {dateTimeFormat.format(new Date(item.createdAt))}
                </p>
                {item.resolutionSummary ? (
                  <p className="text-sm text-success">
                    Kết quả: {item.resolutionSummary}
                  </p>
                ) : null}
                {isOpen ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.status === 0 ? (
                      <Button
                        isDisabled={startingId !== null}
                        size="sm"
                        variant="secondary"
                        onPress={() => void start(item)}
                      >
                        Bắt đầu xử lý
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="primary"
                      onPress={() => setPendingAction({ item, kind: 'close' })}
                    >
                      Đóng phiếu
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => setPendingAction({ item, kind: 'cancel' })}
                    >
                      Hủy phiếu
                    </Button>
                  </div>
                ) : null}
              </Card.Content>
            </Card>
          );
        })}
      </div>

      {pendingAction ? (
        <FinishMaintenanceModal
          key={`${pendingAction.item.id}-${pendingAction.kind}`}
          action={pendingAction}
          onClose={() => setPendingAction(null)}
          onDone={refresh}
        />
      ) : null}
    </section>
  );
}
