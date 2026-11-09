import type {
  PlanFormErrors,
  PlanFormValues,
  PlanSaleFilter,
  SubscriptionPlan,
} from '@/services/subscription-plan-service';

import { useRef, useState } from 'react';
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
  Table,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import CirclePlus from '@gravity-ui/icons/CirclePlus';

import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  createPlan,
  emptyPlanForm,
  filterPlans,
  formatPlanDuration,
  formatPlanPrice,
  getPlanErrorMessage,
  listPlans,
  PLAN_LIMITS,
  setPlanOnSale,
  toPlanFormValues,
  updatePlan,
  validatePlanForm,
} from '@/services/subscription-plan-service';

const SALE_FILTERS: Array<{ id: PlanSaleFilter; label: string }> = [
  { id: 'all', label: 'Tất cả gói' },
  { id: 'active', label: 'Đang bán' },
  { id: 'inactive', label: 'Ngừng bán' },
];

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

function PlanFormModal({
  plan,
  onClose,
  onSaved,
}: {
  plan?: SubscriptionPlan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const mode = plan ? 'edit' : 'create';
  const [values, setValues] = useState<PlanFormValues>(() =>
    plan ? toPlanFormValues(plan) : emptyPlanForm(),
  );
  const [errors, setErrors] = useState<PlanFormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);

  const update = (patch: Partial<PlanFormValues>) => {
    const next = { ...values, ...patch };

    setValues(next);
    if (Object.keys(errors).length) setErrors(validatePlanForm(next, mode));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validatePlanForm(values, mode);

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || pending.current) return;

    pending.current = true;
    setIsSaving(true);
    setSubmitError('');

    try {
      const saved = plan
        ? await updatePlan(plan.id, values)
        : await createPlan(values);

      toast.success(plan ? 'Đã cập nhật gói' : 'Đã tạo gói', {
        description: `${saved.name} · ${formatPlanPrice(saved.price)}`,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getPlanErrorMessage(error));
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  const numberField = (
    key: 'price' | 'durationDays' | 'maxActiveParcels',
    label: string,
    hint: string,
  ) => (
    <TextField
      fullWidth
      isRequired
      inputMode="numeric"
      isDisabled={isSaving}
      isInvalid={Boolean(errors[key])}
      value={values[key]}
      onChange={(value) => update({ [key]: value })}
    >
      <Label>{label}</Label>
      <Input variant="secondary" />
      <Description>{hint}</Description>
      <FieldError>{errors[key]}</FieldError>
    </TextField>
  );

  return (
    <Modal isOpen onOpenChange={(open) => !open && !isSaving && onClose()}>
      <Modal.Backdrop isDismissable={!isSaving}>
        <Modal.Container scroll="inside" size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>
                {plan ? `Sửa gói ${plan.code}` : 'Tạo gói dịch vụ'}
              </Modal.Heading>
              <Modal.CloseTrigger aria-label="Đóng biểu mẫu gói" />
            </Modal.Header>
            <Form validationBehavior="aria" onSubmit={submit}>
              <Modal.Body className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    fullWidth
                    isRequired
                    isDisabled={isSaving || Boolean(plan)}
                    isInvalid={Boolean(errors.code)}
                    maxLength={PLAN_LIMITS.code}
                    value={values.code}
                    onChange={(code) => update({ code })}
                  >
                    <Label>Mã gói</Label>
                    <Input
                      placeholder="Ví dụ: MONTHLY_BASIC"
                      variant="secondary"
                    />
                    <Description>
                      {plan
                        ? 'Mã gói cố định sau khi tạo.'
                        : 'Không đổi được sau khi tạo.'}
                    </Description>
                    <FieldError>{errors.code}</FieldError>
                  </TextField>
                  <TextField
                    fullWidth
                    isRequired
                    isDisabled={isSaving}
                    isInvalid={Boolean(errors.name)}
                    maxLength={PLAN_LIMITS.name}
                    value={values.name}
                    onChange={(name) => update({ name })}
                  >
                    <Label>Tên gói</Label>
                    <Input variant="secondary" />
                    <FieldError>{errors.name}</FieldError>
                  </TextField>
                  {numberField(
                    'price',
                    'Giá (VND)',
                    'Số nguyên, 0 nếu miễn phí.',
                  )}
                  {numberField(
                    'durationDays',
                    'Thời hạn (ngày)',
                    'Ví dụ 30 = 1 tháng.',
                  )}
                  {numberField(
                    'maxActiveParcels',
                    'Hạn mức kiện',
                    'Số kiện đang lưu tối đa cùng lúc.',
                  )}
                </div>
                <TextField
                  fullWidth
                  isDisabled={isSaving}
                  maxLength={PLAN_LIMITS.description}
                  value={values.description}
                  onChange={(description) => update({ description })}
                >
                  <Label>Mô tả</Label>
                  <TextArea rows={2} variant="secondary" />
                </TextField>
                {plan ? (
                  <p className="text-sm text-muted">
                    Thay đổi chỉ áp dụng cho lượt mua mới; cư dân đã mua giữ
                    nguyên quyền lợi đã mua.
                  </p>
                ) : null}
                {submitError ? <ErrorAlert message={submitError} /> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button isDisabled={isSaving} variant="ghost" onPress={onClose}>
                  Hủy
                </Button>
                <Button isDisabled={isSaving} type="submit" variant="primary">
                  {isSaving ? 'Đang lưu...' : plan ? 'Lưu thay đổi' : 'Tạo gói'}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export default function AdminSubscriptionPlansPage() {
  const { state, reload, refresh } = useAsyncResource(
    listPlans,
    getPlanErrorMessage,
    [],
  );
  const [filter, setFilter] = useState<PlanSaleFilter>('all');
  const [form, setForm] = useState<{
    key: number;
    plan?: SubscriptionPlan;
  } | null>(null);
  const [saleTarget, setSaleTarget] = useState<SubscriptionPlan | null>(null);
  const [saleError, setSaleError] = useState('');
  const [isChangingSale, setIsChangingSale] = useState(false);

  const plans = filterPlans(state.data ?? [], filter);

  const confirmSaleChange = async () => {
    if (!saleTarget || isChangingSale) return;

    const nextActive = !saleTarget.isActive;

    setIsChangingSale(true);
    setSaleError('');

    try {
      await setPlanOnSale(saleTarget, nextActive);
      toast.success(nextActive ? 'Đã mở bán gói' : 'Đã ngừng bán gói', {
        description: saleTarget.name,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      setSaleTarget(null);
      refresh();
    } catch (error) {
      setSaleError(getPlanErrorMessage(error));
    } finally {
      setIsChangingSale(false);
    }
  };

  return (
    <section className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted">
          Gói dịch vụ cho cư dân. Ngừng bán không xóa gói: lịch sử và quyền lợi
          đã mua được giữ nguyên.
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
          <Select
            aria-label="Lọc theo trạng thái bán"
            className="w-40"
            value={filter}
            variant="secondary"
            onChange={(key) => setFilter(key as PlanSaleFilter)}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {SALE_FILTERS.map((item) => (
                  <ListBox.Item
                    key={item.id}
                    id={item.id}
                    textValue={item.label}
                  >
                    {item.label}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <Button
            isDisabled={state.status === 'loading'}
            variant="secondary"
            onPress={refresh}
          >
            <ArrowRotateRight aria-hidden="true" className="size-4" />
            Làm mới
          </Button>
          <Button
            variant="primary"
            onPress={() => setForm({ key: Date.now() })}
          >
            <CirclePlus aria-hidden="true" className="size-4" />
            Tạo gói
          </Button>
        </div>
      </div>

      {state.status === 'error' ? (
        <ErrorAlert message={state.message} onRetry={reload} />
      ) : null}
      {state.status === 'loading' && !state.data ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : null}

      {state.data ? (
        <Card>
          <Card.Content className="px-0 pb-0">
            {plans.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted">
                Không có gói nào phù hợp.
              </p>
            ) : (
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Danh sách gói dịch vụ">
                    <Table.Header>
                      <Table.Column isRowHeader id="name">
                        Gói
                      </Table.Column>
                      <Table.Column id="price">Giá</Table.Column>
                      <Table.Column id="duration">Thời hạn</Table.Column>
                      <Table.Column id="capacity">Hạn mức kiện</Table.Column>
                      <Table.Column id="state">Trạng thái bán</Table.Column>
                      <Table.Column id="action">Thao tác</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {plans.map((plan) => (
                        <Table.Row key={plan.id} id={plan.id}>
                          <Table.Cell>
                            <span className="block font-medium">
                              {plan.name}
                            </span>
                            <span className="block text-xs text-muted">
                              {plan.code}
                            </span>
                            {plan.description ? (
                              <span className="block max-w-72 truncate text-xs text-muted">
                                {plan.description}
                              </span>
                            ) : null}
                          </Table.Cell>
                          <Table.Cell>{formatPlanPrice(plan.price)}</Table.Cell>
                          <Table.Cell>
                            {formatPlanDuration(plan.durationDays)}
                          </Table.Cell>
                          <Table.Cell>{plan.maxActiveParcels} kiện</Table.Cell>
                          <Table.Cell>
                            <Chip
                              color={plan.isActive ? 'success' : 'default'}
                              size="sm"
                              variant="soft"
                            >
                              {plan.isActive ? 'Đang bán' : 'Ngừng bán'}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex gap-1">
                              <Button
                                aria-label={`Sửa gói ${plan.name}`}
                                size="sm"
                                variant="ghost"
                                onPress={() =>
                                  setForm({ key: Date.now(), plan })
                                }
                              >
                                Sửa
                              </Button>
                              <Button
                                aria-label={`${plan.isActive ? 'Ngừng bán' : 'Mở bán'} gói ${plan.name}`}
                                size="sm"
                                variant={
                                  plan.isActive ? 'danger-soft' : 'secondary'
                                }
                                onPress={() => {
                                  setSaleError('');
                                  setSaleTarget(plan);
                                }}
                              >
                                {plan.isActive ? 'Ngừng bán' : 'Mở bán'}
                              </Button>
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            )}
          </Card.Content>
        </Card>
      ) : null}

      {form ? (
        <PlanFormModal
          key={form.key}
          plan={form.plan}
          onClose={() => setForm(null)}
          onSaved={refresh}
        />
      ) : null}

      <AlertDialog>
        <AlertDialog.Backdrop
          isDismissable={!isChangingSale}
          isOpen={saleTarget !== null}
          onOpenChange={(open) =>
            !open && !isChangingSale && setSaleTarget(null)
          }
        >
          <AlertDialog.Container size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning">
                  <CircleExclamation aria-hidden="true" className="size-6" />
                </AlertDialog.Icon>
                <AlertDialog.Heading>
                  {saleTarget?.isActive ? 'Ngừng bán' : 'Mở bán'} gói{' '}
                  {saleTarget?.name}?
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="space-y-3">
                <p className="text-sm">
                  {saleTarget?.isActive
                    ? 'Cư dân sẽ không mua mới được gói này. Lượt đã mua vẫn giữ nguyên thời hạn và hạn mức; gói vẫn tra cứu được trong lịch sử.'
                    : 'Gói sẽ hiển thị lại để cư dân mua mới.'}
                </p>
                {saleError ? <ErrorAlert message={saleError} /> : null}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  isDisabled={isChangingSale}
                  variant="ghost"
                  onPress={() => setSaleTarget(null)}
                >
                  Hủy
                </Button>
                <Button
                  isDisabled={isChangingSale}
                  variant={saleTarget?.isActive ? 'danger' : 'primary'}
                  onPress={() => void confirmSaleChange()}
                >
                  {isChangingSale
                    ? 'Đang lưu...'
                    : saleTarget?.isActive
                      ? 'Ngừng bán'
                      : 'Mở bán'}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </section>
  );
}
