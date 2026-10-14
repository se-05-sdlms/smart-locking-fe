import type {
  PolicyFormErrors,
  PolicyFormValues,
  SystemPolicy,
} from '@/services/system-policy-service';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertDialog,
  Button,
  Card,
  Chip,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Skeleton,
  Switch,
  Table,
  TextField,
  toast,
} from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import CirclePlus from '@gravity-ui/icons/CirclePlus';
import Xmark from '@gravity-ui/icons/Xmark';

import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  activateSystemPolicy,
  APPROVAL_MODE_LABELS,
  createSystemPolicy,
  getSystemPolicyErrorMessage,
  isPolicyFormDirty,
  listSystemPolicies,
  MAX_STORAGE_HOURS,
  OVERDUE_START_AFTER_HOURS,
  POLICY_STATE_DISPLAY,
  toPolicyFormValues,
  updateSystemPolicy,
  validatePolicyForm,
} from '@/services/system-policy-service';

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});
const numberFormatter = new Intl.NumberFormat('vi-VN');

const formatDateTime = (value: string | null) =>
  value ? dateTimeFormatter.format(new Date(value)) : '—';

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
        <CircleExclamation aria-hidden="true" className="size-5" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
      {onRetry ? (
        <Button size="sm" variant="secondary" onPress={onRetry}>
          <ArrowRotateRight aria-hidden="true" className="size-4" />
          Thử lại
        </Button>
      ) : null}
    </Alert>
  );
}

type NumberFieldProps = {
  name: keyof PolicyFormValues;
  label: string;
  unit: string;
  values: PolicyFormValues;
  errors: PolicyFormErrors;
  isDisabled: boolean;
  description?: string;
  onChange: (patch: Partial<PolicyFormValues>) => void;
};

function NumberField({
  name,
  label,
  unit,
  values,
  errors,
  isDisabled,
  description,
  onChange,
}: NumberFieldProps) {
  return (
    <TextField
      fullWidth
      isRequired
      inputMode="decimal"
      isDisabled={isDisabled}
      isInvalid={Boolean(errors[name])}
      value={String(values[name])}
      onChange={(value) => onChange({ [name]: value })}
    >
      <Label>
        {label} ({unit})
      </Label>
      <Input variant="secondary" />
      {description ? <Description>{description}</Description> : null}
      <FieldError>{errors[name]}</FieldError>
    </TextField>
  );
}

function ToggleField({
  label,
  isSelected,
  isDisabled,
  onChange,
}: {
  label: string;
  isSelected: boolean;
  isDisabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Switch isDisabled={isDisabled} isSelected={isSelected} onChange={onChange}>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Content>{label}</Switch.Content>
    </Switch>
  );
}

function PolicyFormModal({
  draft,
  base,
  onClose,
  onSaved,
}: {
  /** Draft being edited; undefined creates a new version from `base`. */
  draft?: SystemPolicy;
  base?: SystemPolicy;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = useMemo(
    () => toPolicyFormValues(draft ?? base),
    [base, draft],
  );
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<PolicyFormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);
  const isDirty = isPolicyFormDirty(initial, values);

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();

    window.addEventListener('beforeunload', warn);

    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const update = (patch: Partial<PolicyFormValues>) => {
    const next = { ...values, ...patch };

    setValues(next);
    if (Object.keys(errors).length) setErrors(validatePolicyForm(next));
  };

  const requestClose = () => {
    if (isSaving) return;
    if (isDirty && !window.confirm('Bỏ các thay đổi chưa lưu?')) return;
    onClose();
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validatePolicyForm(values);

    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) setIsConfirming(true);
  };

  const save = async () => {
    if (pending.current) return;

    pending.current = true;
    setIsSaving(true);
    setSubmitError('');

    try {
      const saved = draft
        ? await updateSystemPolicy(draft.id, values)
        : await createSystemPolicy(values);

      toast.success(draft ? 'Đã lưu bản nháp' : 'Đã tạo phiên bản mới', {
        description: `Phiên bản ${saved.version} · chưa áp dụng`,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getSystemPolicyErrorMessage(error));
      setIsConfirming(false);
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  const field = (
    name: keyof PolicyFormValues,
    label: string,
    unit: string,
    description?: string,
  ) => (
    <NumberField
      description={description}
      errors={errors}
      isDisabled={isSaving}
      label={label}
      name={name}
      unit={unit}
      values={values}
      onChange={update}
    />
  );

  return (
    <>
      <Modal isOpen onOpenChange={(open) => !open && requestClose()}>
        <Modal.Backdrop isDismissable={!isSaving}>
          <Modal.Container scroll="inside" size="lg">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label="Đóng biểu mẫu chính sách">
                <Xmark aria-hidden="true" className="size-5" />
              </Modal.CloseTrigger>
              <Modal.Header>
                <Modal.Heading>
                  {draft
                    ? `Sửa bản nháp phiên bản ${draft.version}`
                    : 'Tạo phiên bản chính sách mới'}
                </Modal.Heading>
              </Modal.Header>
              <Form validationBehavior="aria" onSubmit={submit}>
                <Modal.Body className="space-y-6">
                  <section className="space-y-3">
                    <h3 className="font-semibold">Giao hàng</h3>
                    <Select
                      isDisabled={isSaving}
                      value={values.defaultApprovalMode}
                      variant="secondary"
                      onChange={(value) =>
                        update({
                          defaultApprovalMode:
                            value as PolicyFormValues['defaultApprovalMode'],
                        })
                      }
                    >
                      <Label>Chế độ duyệt mặc định</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {(['Auto', 'Manual'] as const).map((mode) => (
                            <ListBox.Item
                              key={mode}
                              id={mode}
                              textValue={APPROVAL_MODE_LABELS[mode]}
                            >
                              {APPROVAL_MODE_LABELS[mode]}
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {field(
                        'guestSessionTimeoutMinutes',
                        'Phiên giao hàng',
                        'phút',
                      )}
                      {field(
                        'manualApprovalTimeoutMinutes',
                        'Chờ cư dân duyệt',
                        'phút',
                      )}
                      {field(
                        'compartmentReservationMinutes',
                        'Giữ ngăn',
                        'phút',
                      )}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="font-semibold">Lưu trữ và phí quá hạn</h3>
                    <p className="text-sm text-muted">
                      Thời gian lưu cố định: {OVERDUE_START_AFTER_HOURS / 24}{' '}
                      ngày thường, sau đó{' '}
                      {(MAX_STORAGE_HOURS - OVERDUE_START_AFTER_HOURS) / 24}{' '}
                      ngày tính phí quá hạn (tổng {MAX_STORAGE_HOURS} giờ).
                    </p>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {field(
                        'overdueFeePerHour',
                        'Phí quá hạn',
                        `${values.currency || 'VND'}/giờ`,
                      )}
                      <TextField
                        fullWidth
                        isRequired
                        isDisabled={isSaving}
                        isInvalid={Boolean(errors.currency)}
                        maxLength={3}
                        value={values.currency}
                        onChange={(currency) =>
                          update({ currency: currency.toUpperCase() })
                        }
                      >
                        <Label>Tiền tệ</Label>
                        <Input variant="secondary" />
                        <FieldError>{errors.currency}</FieldError>
                      </TextField>
                      {field(
                        'pickupReminderStartDay',
                        'Bắt đầu nhắc nhận hàng',
                        'ngày thứ',
                      )}
                      {field(
                        'clearanceEligibilityAfterHours',
                        'Được xử lý quá hạn sau',
                        'giờ',
                      )}
                      {field(
                        'clearanceNoticeBeforeHours',
                        'Báo trước khi xử lý',
                        'giờ',
                      )}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="font-semibold">Mở tủ và OTP</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {field('otpMaxAttempts', 'Số lần nhập OTP tối đa', 'lần')}
                      {field(
                        'otpLockoutMinutes',
                        'Khóa OTP khi nhập sai',
                        'phút',
                      )}
                    </div>
                    <div className="flex flex-col gap-3">
                      <ToggleField
                        isDisabled={isSaving}
                        isSelected={values.enableOtp}
                        label="Cho phép mở bằng OTP"
                        onChange={(enableOtp) => update({ enableOtp })}
                      />
                      <ToggleField
                        isDisabled={isSaving}
                        isSelected={values.enableRemoteUnlock}
                        label="Cho phép mở từ xa qua ứng dụng"
                        onChange={(enableRemoteUnlock) =>
                          update({ enableRemoteUnlock })
                        }
                      />
                      <ToggleField
                        isDisabled={isSaving}
                        isSelected={values.enableFaceRecognition}
                        label="Cho phép mở bằng nhận diện khuôn mặt"
                        onChange={(enableFaceRecognition) =>
                          update({ enableFaceRecognition })
                        }
                      />
                    </div>
                  </section>

                  <TextField
                    fullWidth
                    isRequired
                    isDisabled={isSaving}
                    isInvalid={Boolean(errors.effectiveFrom)}
                    type="datetime-local"
                    value={values.effectiveFrom}
                    onChange={(effectiveFrom) => update({ effectiveFrom })}
                  >
                    <Label>Hiệu lực từ</Label>
                    <Input variant="secondary" />
                    <Description>
                      Theo múi giờ của máy bạn ({TIME_ZONE}).
                    </Description>
                    <FieldError>{errors.effectiveFrom}</FieldError>
                  </TextField>

                  {submitError ? <ErrorAlert message={submitError} /> : null}
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    isDisabled={isSaving}
                    variant="ghost"
                    onPress={requestClose}
                  >
                    Hủy
                  </Button>
                  <Button isDisabled={isSaving} type="submit" variant="primary">
                    {draft ? 'Lưu bản nháp' : 'Tạo phiên bản'}
                  </Button>
                </Modal.Footer>
              </Form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <AlertDialog>
        <AlertDialog.Backdrop
          isDismissable={!isSaving}
          isOpen={isConfirming}
          onOpenChange={(open) => !isSaving && setIsConfirming(open)}
        >
          <AlertDialog.Container size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning">
                  <CircleExclamation aria-hidden="true" className="size-6" />
                </AlertDialog.Icon>
                <AlertDialog.Heading>
                  {draft ? 'Lưu bản nháp?' : 'Tạo phiên bản mới?'}
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                Phiên bản được lưu dưới dạng bản nháp và chưa ảnh hưởng hệ thống
                cho tới khi bạn bấm Áp dụng.
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  isDisabled={isSaving}
                  variant="ghost"
                  onPress={() => setIsConfirming(false)}
                >
                  Quay lại
                </Button>
                <Button
                  isDisabled={isSaving}
                  variant="primary"
                  onPress={() => void save()}
                >
                  {isSaving ? 'Đang lưu...' : 'Xác nhận lưu'}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  );
}

export default function AdminSystemPoliciesPage() {
  const { state, reload, refresh } = useAsyncResource(
    listSystemPolicies,
    getSystemPolicyErrorMessage,
    [],
  );
  const [form, setForm] = useState<{
    key: number;
    draft?: SystemPolicy;
  } | null>(null);
  const [activating, setActivating] = useState<SystemPolicy | null>(null);
  const [activateError, setActivateError] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const pending = useRef(false);

  const policies = useMemo(() => state.data ?? [], [state.data]);
  const active = policies.find((policy) => policy.state === 'active');

  const confirmActivate = async () => {
    if (!activating || pending.current) return;

    pending.current = true;
    setIsActivating(true);
    setActivateError('');

    try {
      const result = await activateSystemPolicy(activating.id);

      toast.success('Đã áp dụng chính sách', {
        description: `Phiên bản ${result.version} đang có hiệu lực.`,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      setActivating(null);
    } catch (error) {
      setActivateError(getSystemPolicyErrorMessage(error));
    } finally {
      pending.current = false;
      setIsActivating(false);
      refresh();
    }
  };

  const summary = active
    ? [
        ['Chế độ duyệt', APPROVAL_MODE_LABELS[active.defaultApprovalMode]],
        ['Phiên giao hàng', `${active.guestSessionTimeoutMinutes} phút`],
        ['Chờ cư dân duyệt', `${active.manualApprovalTimeoutMinutes} phút`],
        ['Giữ ngăn', `${active.compartmentReservationMinutes} phút`],
        [
          'Phí quá hạn',
          `${numberFormatter.format(active.overdueFeePerHour)} ${active.currency}/giờ`,
        ],
        ['Bắt đầu nhắc', `Ngày thứ ${active.pickupReminderStartDay}`],
        ['Xử lý quá hạn sau', `${active.clearanceEligibilityAfterHours} giờ`],
        [
          'OTP',
          `${active.otpMaxAttempts} lần · khóa ${active.otpLockoutMinutes} phút`,
        ],
        [
          'Cách mở tủ',
          [
            active.enableOtp && 'OTP',
            active.enableRemoteUnlock && 'Từ xa',
            active.enableFaceRecognition && 'Khuôn mặt',
          ]
            .filter(Boolean)
            .join(', ') || 'Không có',
        ],
        ['Hiệu lực từ', formatDateTime(active.effectiveFrom)],
      ]
    : [];

  return (
    <section className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted">
          Chính sách có phiên bản: phiên bản đang áp dụng không sửa được; tạo
          phiên bản mới rồi áp dụng. Thời gian hiển thị theo múi giờ {TIME_ZONE}
          .
        </p>
        <div className="ml-auto flex gap-2">
          <Button
            isDisabled={state.status === 'loading'}
            variant="secondary"
            onPress={refresh}
          >
            <ArrowRotateRight aria-hidden="true" className="size-4" />
            Làm mới
          </Button>
          <Button
            isDisabled={!state.data}
            variant="primary"
            onPress={() => setForm({ key: Date.now() })}
          >
            <CirclePlus aria-hidden="true" className="size-4" />
            Tạo phiên bản mới
          </Button>
        </div>
      </div>

      {state.status === 'loading' && !state.data ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : null}
      {state.status === 'error' ? (
        <ErrorAlert
          message={state.message}
          onRetry={state.data ? undefined : reload}
        />
      ) : null}

      {state.data ? (
        <>
          <Card>
            <Card.Header className="flex-row items-center justify-between">
              <Card.Title>
                {active
                  ? `Đang áp dụng · phiên bản ${active.version}`
                  : 'Chưa có chính sách đang áp dụng'}
              </Card.Title>
            </Card.Header>
            <Card.Content>
              {active ? (
                <dl className="grid gap-x-8 sm:grid-cols-2">
                  {summary.map(([label, value]) => (
                    <div
                      key={label}
                      className="grid grid-cols-[10rem_1fr] gap-3 py-1.5 text-sm"
                    >
                      <dt className="text-muted">{label}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted">
                  Tạo một phiên bản và áp dụng để hệ thống có chính sách vận
                  hành.
                </p>
              )}
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Các phiên bản</Card.Title>
            </Card.Header>
            <Card.Content className="px-0 pb-0">
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Các phiên bản chính sách">
                    <Table.Header>
                      <Table.Column isRowHeader id="version">
                        Phiên bản
                      </Table.Column>
                      <Table.Column id="state">Trạng thái</Table.Column>
                      <Table.Column id="from">Hiệu lực từ</Table.Column>
                      <Table.Column id="to">Hiệu lực đến</Table.Column>
                      <Table.Column id="created">Tạo lúc</Table.Column>
                      <Table.Column id="action">Thao tác</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {policies.map((policy) => (
                        <Table.Row key={policy.id} id={policy.id}>
                          <Table.Cell>
                            <strong>v{policy.version}</strong>
                          </Table.Cell>
                          <Table.Cell>
                            <Chip
                              color={POLICY_STATE_DISPLAY[policy.state].color}
                              size="sm"
                              variant="soft"
                            >
                              {POLICY_STATE_DISPLAY[policy.state].label}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell>
                            {formatDateTime(policy.effectiveFrom)}
                          </Table.Cell>
                          <Table.Cell>
                            {formatDateTime(policy.effectiveTo)}
                          </Table.Cell>
                          <Table.Cell>
                            {formatDateTime(policy.createdAt)}
                          </Table.Cell>
                          <Table.Cell>
                            {policy.state === 'draft' ? (
                              <div className="flex gap-1">
                                <Button
                                  aria-label={`Sửa phiên bản ${policy.version}`}
                                  size="sm"
                                  variant="ghost"
                                  onPress={() =>
                                    setForm({ key: Date.now(), draft: policy })
                                  }
                                >
                                  Sửa
                                </Button>
                                <Button
                                  aria-label={`Áp dụng phiên bản ${policy.version}`}
                                  size="sm"
                                  variant="secondary"
                                  onPress={() => {
                                    setActivateError('');
                                    setActivating(policy);
                                  }}
                                >
                                  Áp dụng
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm text-muted">—</span>
                            )}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </Card.Content>
          </Card>
        </>
      ) : null}

      {form ? (
        <PolicyFormModal
          key={form.key}
          base={active ?? policies[0]}
          draft={form.draft}
          onClose={() => setForm(null)}
          onSaved={refresh}
        />
      ) : null}

      <AlertDialog>
        <AlertDialog.Backdrop
          isDismissable={!isActivating}
          isOpen={activating !== null}
          onOpenChange={(open) => !open && !isActivating && setActivating(null)}
        >
          <AlertDialog.Container size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning">
                  <CircleExclamation aria-hidden="true" className="size-6" />
                </AlertDialog.Icon>
                <AlertDialog.Heading>
                  Áp dụng phiên bản {activating?.version}?
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="space-y-3">
                <p className="text-sm">
                  Phiên bản đang áp dụng
                  {active ? ` (v${active.version})` : ''} sẽ hết hiệu lực ngay.
                  Chính sách mới ảnh hưởng tới giao hàng, phí quá hạn và cách mở
                  tủ của toàn hệ thống.
                </p>
                {activateError ? <ErrorAlert message={activateError} /> : null}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  isDisabled={isActivating}
                  variant="ghost"
                  onPress={() => setActivating(null)}
                >
                  Hủy
                </Button>
                <Button
                  isDisabled={isActivating}
                  variant="primary"
                  onPress={() => void confirmActivate()}
                >
                  {isActivating ? 'Đang áp dụng...' : 'Áp dụng'}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </section>
  );
}
