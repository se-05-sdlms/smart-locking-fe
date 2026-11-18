import type {
  PolicyFormErrors,
  PolicyFormValues,
  SystemPolicy,
} from '@/services/system-policy-service';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  AlertDialog,
  Button,
  Card,
  Checkbox,
  Chip,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  Skeleton,
  Switch,
  Table,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import ArrowLeft from '@gravity-ui/icons/ArrowLeft';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import CirclePlus from '@gravity-ui/icons/CirclePlus';

import { NotificationRulesCard } from '@/components/admin/policies/notification-rules-card';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { userManagementService } from '@/services/user-management-service';
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
  toLocalDateTimeInput,
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
      {/* Switch.Content is the pressable part; keep the control inside it so
          clicking the toggle itself works, not only the label text. */}
      <Switch.Content className="flex items-center gap-3">
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        {label}
      </Switch.Content>
    </Switch>
  );
}

/** Automatic operator replacement (#86). No defaults: leave all empty to disable. */
function ReplacementSection({
  values,
  errors,
  isDisabled,
  onChange,
}: {
  values: PolicyFormValues;
  errors: PolicyFormErrors;
  isDisabled: boolean;
  onChange: (patch: Partial<PolicyFormValues>) => void;
}) {
  const { state } = useAsyncResource(
    async () => {
      const result = await userManagementService.getUsers({
        role: 'LOCKER_OPERATOR',
        search: '',
        status: 'ACTIVE',
        sortDescriptor: { column: 'fullName', direction: 'ascending' },
        page: 1,
        pageSize: 10_000,
      });

      if (!result.success) throw new Error(result.error.message);

      return result.data.items;
    },
    () => 'Không tải được danh sách Operator.',
    [],
  );
  const selected = new Set(values.replacementEligibleUserIds);
  const toggle = (id: string, on: boolean) =>
    onChange({
      replacementEligibleUserIds: on
        ? [...selected, id]
        : values.replacementEligibleUserIds.filter((item) => item !== id),
    });
  // Keep IDs saved earlier even if the account is no longer listed.
  const unknown = values.replacementEligibleUserIds.filter(
    (id) => !(state.data ?? []).some((user) => user.id === id),
  );

  return (
    <section className="space-y-3">
      <div>
        <p className="font-medium">Tự đề xuất Operator thay thế</p>
        <p className="text-sm text-muted">
          Khi Operator vắng mặt, hệ thống đề xuất người đang quản lý một tủ cùng
          khu vực, gần tủ bị ảnh hưởng nhất (khoảng cách giữa các tủ, không phải
          GPS nhân viên) và còn dưới giới hạn tải. Để trống cả bốn mục nếu chưa
          dùng; phải điền đủ cả bốn khi bật.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          fullWidth
          isDisabled={isDisabled}
          isInvalid={Boolean(errors.replacementRadiusKm)}
          value={values.replacementRadiusKm}
          onChange={(replacementRadiusKm) => onChange({ replacementRadiusKm })}
        >
          <Label>Bán kính phục vụ (km)</Label>
          <Input inputMode="decimal" variant="secondary" />
          <FieldError>{errors.replacementRadiusKm}</FieldError>
        </TextField>
        <TextField
          fullWidth
          isDisabled={isDisabled}
          isInvalid={Boolean(errors.replacementMaxLoad)}
          value={values.replacementMaxLoad}
          onChange={(replacementMaxLoad) => onChange({ replacementMaxLoad })}
        >
          <Label>Giới hạn tải (số tủ tối đa)</Label>
          <Input inputMode="numeric" variant="secondary" />
          <FieldError>{errors.replacementMaxLoad}</FieldError>
        </TextField>
      </div>
      <TextField
        fullWidth
        isDisabled={isDisabled}
        isInvalid={Boolean(errors.replacementAreas)}
        value={values.replacementAreas}
        onChange={(replacementAreas) => onChange({ replacementAreas })}
      >
        <Label>Khu vực phục vụ được áp dụng</Label>
        <TextArea rows={2} variant="secondary" />
        <Description>
          Mỗi dòng một khu vực, ghi đúng như khu vực đã xác nhận ở từng tủ.
        </Description>
        <FieldError>{errors.replacementAreas}</FieldError>
      </TextField>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Operator đủ điều kiện thay thế
        </legend>
        {state.status === 'loading' && !state.data ? (
          <Skeleton className="h-10 w-full rounded-lg" />
        ) : null}
        {state.status === 'error' ? (
          <p className="text-sm text-danger">{state.message}</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {(state.data ?? []).map((user) => (
            <Checkbox
              key={user.id}
              isDisabled={isDisabled}
              isSelected={selected.has(user.id)}
              onChange={(on) => toggle(user.id, on)}
            >
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                {user.fullName}
                <span className="block text-xs text-muted">{user.email}</span>
              </Checkbox.Content>
            </Checkbox>
          ))}
        </div>
        {unknown.length ? (
          <p className="text-sm text-warning">
            {unknown.length} Operator đã chọn trước đây không còn hoạt động.{' '}
            <Button
              size="sm"
              variant="tertiary"
              onPress={() =>
                onChange({
                  replacementEligibleUserIds:
                    values.replacementEligibleUserIds.filter(
                      (id) => !unknown.includes(id),
                    ),
                })
              }
            >
              Bỏ chọn
            </Button>
          </p>
        ) : null}
        {errors.replacementEligibleUserIds ? (
          <p className="text-sm text-danger">
            {errors.replacementEligibleUserIds}
          </p>
        ) : null}
      </fieldset>
    </section>
  );
}

function PolicyFormView({
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
  const nowInputMin = useMemo(
    () => toLocalDateTimeInput(new Date().toISOString()),
    [],
  );

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
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            isDisabled={isSaving}
            size="sm"
            variant="ghost"
            onPress={requestClose}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Quay lại danh sách
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {draft
                ? `Sửa bản nháp phiên bản ${draft.version}`
                : 'Tạo phiên bản chính sách mới'}
            </h1>
            <Chip color={draft ? 'warning' : 'accent'} size="sm" variant="soft">
              {draft ? `Bản nháp v${draft.version}` : 'Phiên bản mới'}
            </Chip>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            isDisabled={isSaving}
            variant="secondary"
            onPress={requestClose}
          >
            Hủy
          </Button>
          <Button
            form="policy-edit-form"
            isDisabled={isSaving}
            type="submit"
            variant="primary"
          >
            {draft ? 'Lưu bản nháp' : 'Tạo phiên bản'}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted">
        {draft
          ? 'Chỉnh sửa các tham số của bản nháp. Bản nháp này chưa ảnh hưởng đến hệ thống cho tới khi được bấm Áp dụng.'
          : 'Tạo một phiên bản chính sách mới kế thừa từ phiên bản hiện tại. Sau khi lưu, phiên bản sẽ ở trạng thái Bản nháp và có thể kiểm tra trước khi áp dụng.'}
      </p>

      <Form
        className="flex flex-col gap-6"
        id="policy-edit-form"
        validationBehavior="aria"
        onSubmit={submit}
      >
        <Card>
          <Card.Header>
            <Card.Title>Giao hàng</Card.Title>
            <Card.Description>
              Cấu hình phương thức duyệt gửi hàng và các khoảng thời gian chờ
              của phiên giao nhận.
            </Card.Description>
          </Card.Header>
          <Card.Content className="space-y-4">
            <div className="max-w-md">
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
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {field('guestSessionTimeoutMinutes', 'Phiên giao hàng', 'phút')}
              {field(
                'manualApprovalTimeoutMinutes',
                'Chờ cư dân duyệt',
                'phút',
              )}
              {field('compartmentReservationMinutes', 'Giữ ngăn', 'phút')}
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Lưu trữ và phí quá hạn</Card.Title>
            <Card.Description>
              Thời gian lưu cố định: {OVERDUE_START_AFTER_HOURS / 24} ngày
              thường, sau đó{' '}
              {(MAX_STORAGE_HOURS - OVERDUE_START_AFTER_HOURS) / 24} ngày tính
              phí quá hạn (tổng {MAX_STORAGE_HOURS} giờ).
            </Card.Description>
          </Card.Header>
          <Card.Content className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Mở tủ và OTP</Card.Title>
            <Card.Description>
              Giới hạn nhập mã OTP và các phương thức mở ngăn tủ được hỗ trợ.
            </Card.Description>
          </Card.Header>
          <Card.Content className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {field('otpMaxAttempts', 'Số lần nhập OTP tối đa', 'lần')}
              {field('otpLockoutMinutes', 'Khóa OTP khi nhập sai', 'phút')}
            </div>
            <div className="grid gap-3 sm:grid-cols-3 rounded-xl border border-border p-4 bg-muted/5">
              <ToggleField
                isDisabled={isSaving}
                isSelected={values.enableOtp}
                label="Cho phép mở bằng OTP"
                onChange={(enableOtp) => update({ enableOtp })}
              />
              <ToggleField
                isDisabled={isSaving}
                isSelected={values.enableRemoteUnlock}
                label="Cho phép mở qua máy chủ"
                onChange={(enableRemoteUnlock) =>
                  update({ enableRemoteUnlock })
                }
              />
              <ToggleField
                isDisabled={isSaving}
                isSelected={values.enableBluetoothUnlock}
                label="Cho phép mở bằng Bluetooth"
                onChange={(enableBluetoothUnlock) =>
                  update({ enableBluetoothUnlock })
                }
              />
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Tự đề xuất Operator thay thế</Card.Title>
            <Card.Description>
              Khi Operator vắng mặt, hệ thống đề xuất người đang quản lý một tủ
              cùng khu vực, gần tủ bị ảnh hưởng nhất và còn dưới giới hạn tải.
              Để trống cả bốn mục nếu chưa dùng; phải điền đủ cả bốn khi bật.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <ReplacementSection
              errors={errors}
              isDisabled={isSaving}
              values={values}
              onChange={update}
            />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Thời gian có hiệu lực</Card.Title>
            <Card.Description>
              Thời điểm chính sách bắt đầu có hiệu lực sau khi được kích hoạt.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="max-w-md">
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
                <Input min={nowInputMin} variant="secondary" />
                <Description>
                  Theo múi giờ của máy bạn ({TIME_ZONE}).
                </Description>
                <FieldError>{errors.effectiveFrom}</FieldError>
              </TextField>
            </div>
          </Card.Content>
        </Card>

        {submitError ? <ErrorAlert message={submitError} /> : null}

        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2">
            {isDirty ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-warning">
                <span className="size-2 rounded-full bg-warning animate-pulse" />
                Có thay đổi chưa lưu
              </span>
            ) : (
              <span className="text-sm text-muted">Chưa có thay đổi</span>
            )}
          </div>
          <div className="flex items-center gap-3">
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
          </div>
        </div>
      </Form>

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
    </section>
  );
}

export default function AdminSystemPoliciesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, reload, refresh } = useAsyncResource(
    listSystemPolicies,
    getSystemPolicyErrorMessage,
    [],
  );
  const [activating, setActivating] = useState<SystemPolicy | null>(null);
  const [activateError, setActivateError] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const pending = useRef(false);

  const policies = useMemo(() => state.data ?? [], [state.data]);
  const active = policies.find((policy) => policy.state === 'active');

  const action = searchParams.get('action');
  const editId = searchParams.get('id');

  const draftToEdit = useMemo(() => {
    if (action === 'edit' && editId) {
      return policies.find((p) => p.id === editId);
    }

    return undefined;
  }, [action, editId, policies]);

  const isFormView = action === 'new' || (action === 'edit' && Boolean(editId));

  const openCreateForm = () => {
    setSearchParams({ action: 'new' });
  };

  const openEditForm = (policy: SystemPolicy) => {
    setSearchParams({ action: 'edit', id: policy.id });
  };

  const closeForm = () => {
    setSearchParams({}, { replace: true });
  };

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

  if (isFormView) {
    if (state.status === 'loading' && !state.data) {
      return (
        <section className="flex w-full flex-col gap-6">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" onPress={closeForm}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Quay lại danh sách
            </Button>
            <Skeleton className="h-8 w-64 rounded-lg" />
          </div>
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </section>
      );
    }

    if (action === 'edit' && state.data && !draftToEdit) {
      return (
        <section className="flex w-full flex-col gap-6">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" onPress={closeForm}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Quay lại danh sách
            </Button>
          </div>
          <Alert role="alert" status="warning">
            <Alert.Indicator>
              <CircleExclamation aria-hidden="true" className="size-5" />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Không tìm thấy bản nháp</Alert.Title>
              <Alert.Description>
                Bản nháp chính sách bạn đang cố sửa không tồn tại hoặc đã được
                áp dụng.
              </Alert.Description>
            </Alert.Content>
            <Button size="sm" variant="secondary" onPress={closeForm}>
              Về danh sách chính sách
            </Button>
          </Alert>
        </section>
      );
    }

    return (
      <PolicyFormView
        key={draftToEdit?.id ?? 'new'}
        base={active ?? policies[0]}
        draft={draftToEdit}
        onClose={closeForm}
        onSaved={refresh}
      />
    );
  }

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
            active.enableRemoteUnlock && 'Qua máy chủ',
            active.enableBluetoothUnlock && 'Bluetooth',
          ]
            .filter(Boolean)
            .join(', ') || 'Không có',
        ],
        [
          'Thay thế Operator',
          active.operatorReplacementRadiusKm
            ? `${active.operatorReplacementRadiusKm} km · tối đa ${active.operatorReplacementMaxLoad} tủ · ${active.operatorReplacementAreas?.length ?? 0} khu vực · ${active.operatorReplacementEligibleUserIds?.length ?? 0} người`
            : 'Chưa cấu hình',
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
            onPress={openCreateForm}
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
                                  onPress={() => openEditForm(policy)}
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

          <NotificationRulesCard policies={policies} />
        </>
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
