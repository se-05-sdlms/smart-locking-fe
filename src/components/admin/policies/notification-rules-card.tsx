import type {
  NotificationChannel,
  NotificationRule,
  NotificationRuleFormErrors,
  NotificationRuleFormValues,
} from '@/services/notification-rule-service';
import type { SystemPolicy } from '@/services/system-policy-service';

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import Bell from '@gravity-ui/icons/Bell';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import CirclePlus from '@gravity-ui/icons/CirclePlus';
import Xmark from '@gravity-ui/icons/Xmark';

import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  createNotificationRule,
  emptyRuleForm,
  EVENT_TYPE_MAX_LENGTH,
  getNotificationRuleErrorMessage,
  KNOWN_NOTIFICATION_EVENTS,
  listNotificationRules,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_CHANNELS,
  notificationEventLabel,
  rulesForPolicy,
  toRuleFormValues,
  updateNotificationRule,
  validateRuleForm,
} from '@/services/notification-rule-service';
import { POLICY_STATE_DISPLAY } from '@/services/system-policy-service';

/** Select key for "type another event code". */
const CUSTOM_EVENT = '__custom__';

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
          <ArrowRotateRight aria-hidden="true" className="size-4" />
          Thử lại
        </Button>
      ) : null}
    </Alert>
  );
}

function formatLeadTime(minutes: number | null) {
  return minutes === null || minutes === 0 ? 'Ngay lập tức' : `${minutes} phút`;
}

function RuleFormModal({
  policy,
  rule,
  onClose,
  onSaved,
}: {
  policy: SystemPolicy;
  /** Present when editing; event and channel are fixed after creation. */
  rule?: NotificationRule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<NotificationRuleFormValues>(() =>
    rule ? toRuleFormValues(rule) : emptyRuleForm(),
  );
  const [isCustomEvent, setIsCustomEvent] = useState(
    () => Boolean(rule) && !KNOWN_NOTIFICATION_EVENTS.includes(rule!.eventType),
  );
  const [errors, setErrors] = useState<NotificationRuleFormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);

  const update = (patch: Partial<NotificationRuleFormValues>) => {
    const next = { ...values, ...patch };

    setValues(next);
    if (Object.keys(errors).length) setErrors(validateRuleForm(next));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateRuleForm(values);

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || pending.current) return;

    pending.current = true;
    setIsSaving(true);
    setSubmitError('');

    try {
      if (rule) {
        await updateNotificationRule(rule.id, values);
      } else {
        await createNotificationRule(policy.id, values);
      }

      toast.success(rule ? 'Đã cập nhật quy tắc' : 'Đã thêm quy tắc', {
        description: `${notificationEventLabel(values.eventType.trim())} · ${NOTIFICATION_CHANNEL_LABELS[values.channel]}`,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getNotificationRuleErrorMessage(error));
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  const eventSelectKey = isCustomEvent ? CUSTOM_EVENT : values.eventType;

  return (
    <Modal isOpen onOpenChange={(open) => !open && !isSaving && onClose()}>
      <Modal.Backdrop isDismissable={!isSaving}>
        <Modal.Container scroll="inside" size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label="Đóng biểu mẫu quy tắc thông báo">
              <Xmark aria-hidden="true" className="size-5" />
            </Modal.CloseTrigger>
            <Modal.Header>
              <Modal.Heading>
                {rule
                  ? 'Sửa quy tắc thông báo'
                  : `Thêm quy tắc · phiên bản ${policy.version}`}
              </Modal.Heading>
            </Modal.Header>
            <Form validationBehavior="aria" onSubmit={submit}>
              <Modal.Body className="space-y-5">
                <Select
                  isDisabled={isSaving || Boolean(rule)}
                  isInvalid={Boolean(errors.eventType) && !isCustomEvent}
                  value={eventSelectKey}
                  variant="secondary"
                  onChange={(key) => {
                    const custom = key === CUSTOM_EVENT;

                    setIsCustomEvent(custom);
                    update({ eventType: custom ? '' : String(key) });
                  }}
                >
                  <Label>Sự kiện</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {KNOWN_NOTIFICATION_EVENTS.map((eventType) => (
                        <ListBox.Item
                          key={eventType}
                          id={eventType}
                          textValue={notificationEventLabel(eventType)}
                        >
                          {notificationEventLabel(eventType)}
                        </ListBox.Item>
                      ))}
                      <ListBox.Item
                        id={CUSTOM_EVENT}
                        textValue="Sự kiện khác (nhập mã)"
                      >
                        Sự kiện khác (nhập mã)
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>

                {isCustomEvent ? (
                  <TextField
                    fullWidth
                    isRequired
                    isDisabled={isSaving || Boolean(rule)}
                    isInvalid={Boolean(errors.eventType)}
                    maxLength={EVENT_TYPE_MAX_LENGTH}
                    value={values.eventType}
                    onChange={(eventType) => update({ eventType })}
                  >
                    <Label>Mã sự kiện</Label>
                    <Input
                      placeholder="Ví dụ: PickupReminder"
                      variant="secondary"
                    />
                    <Description>
                      Mã sự kiện do hệ thống phát ra, tối đa{' '}
                      {EVENT_TYPE_MAX_LENGTH} ký tự.
                    </Description>
                    <FieldError>{errors.eventType}</FieldError>
                  </TextField>
                ) : null}

                <Select
                  isDisabled={isSaving || Boolean(rule)}
                  value={String(values.channel)}
                  variant="secondary"
                  onChange={(key) =>
                    update({ channel: Number(key) as NotificationChannel })
                  }
                >
                  <Label>Kênh gửi</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {NOTIFICATION_CHANNELS.map((channel) => (
                        <ListBox.Item
                          key={channel}
                          id={String(channel)}
                          textValue={NOTIFICATION_CHANNEL_LABELS[channel]}
                        >
                          {NOTIFICATION_CHANNEL_LABELS[channel]}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                {rule ? (
                  <p className="text-sm text-muted">
                    Sự kiện và kênh gửi không đổi được sau khi tạo; chỉ sửa được
                    thời gian báo trước và trạng thái bật/tắt.
                  </p>
                ) : null}

                <TextField
                  fullWidth
                  inputMode="numeric"
                  isDisabled={isSaving}
                  isInvalid={Boolean(errors.leadTimeMinutes)}
                  value={values.leadTimeMinutes}
                  onChange={(leadTimeMinutes) => update({ leadTimeMinutes })}
                >
                  <Label>Báo trước (phút)</Label>
                  <Input placeholder="Để trống: gửi ngay" variant="secondary" />
                  <Description>
                    Gửi thông báo sớm hơn thời điểm sự kiện bao nhiêu phút.
                  </Description>
                  <FieldError>{errors.leadTimeMinutes}</FieldError>
                </TextField>

                <Switch
                  isDisabled={isSaving}
                  isSelected={values.isEnabled}
                  onChange={(isEnabled) => update({ isEnabled })}
                >
                  <Switch.Content className="flex items-center gap-3">
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    Bật quy tắc
                  </Switch.Content>
                </Switch>

                {submitError ? <ErrorAlert message={submitError} /> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button isDisabled={isSaving} variant="ghost" onPress={onClose}>
                  Hủy
                </Button>
                <Button isDisabled={isSaving} type="submit" variant="primary">
                  {isSaving
                    ? 'Đang lưu...'
                    : rule
                      ? 'Lưu thay đổi'
                      : 'Thêm quy tắc'}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/**
 * Rules of one policy version. Rendered with `key={policy.id}` so switching
 * versions mounts a fresh section: no rules, open form or pending toggle from
 * the previous version can be shown or sent while the new one loads or fails.
 */
function PolicyRulesSection({ policy }: { policy: SystemPolicy }) {
  const isEditable = policy.state === 'draft';
  const [form, setForm] = useState<{
    key: number;
    rule?: NotificationRule;
  } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { state, reload, refresh } = useAsyncResource(
    (signal) => listNotificationRules(policy.id, signal),
    getNotificationRuleErrorMessage,
    [policy.id],
  );
  // Defence in depth: never show or act on a rule of another policy version.
  const rules = rulesForPolicy(state.data ?? [], policy.id);
  const isReady = state.status === 'success';

  const toggleRule = async (rule: NotificationRule, isEnabled: boolean) => {
    if (togglingId || rule.systemPolicyId !== policy.id) return;

    setTogglingId(rule.id);

    try {
      await updateNotificationRule(rule.id, {
        ...toRuleFormValues(rule),
        isEnabled,
      });
      toast.success(isEnabled ? 'Đã bật quy tắc' : 'Đã tắt quy tắc', {
        description: notificationEventLabel(rule.eventType),
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
    } catch (error) {
      toast.danger(getNotificationRuleErrorMessage(error));
    } finally {
      setTogglingId(null);
      refresh();
    }
  };

  const stateLabel = POLICY_STATE_DISPLAY[policy.state].label.toLowerCase();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {isEditable
            ? `Phiên bản ${policy.version} là bản nháp: thêm, sửa hoặc bật/tắt quy tắc trước khi áp dụng.`
            : `Phiên bản ${policy.version} đang ở trạng thái ${stateLabel} nên chỉ xem được. Tạo phiên bản mới để thay đổi quy tắc.`}
        </p>
        <Button
          isDisabled={!isEditable || !isReady}
          variant="primary"
          onPress={() => setForm({ key: Date.now() })}
        >
          <CirclePlus aria-hidden="true" className="size-4" />
          Thêm quy tắc
        </Button>
      </div>

      {state.status === 'loading' ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : null}
      {state.status === 'error' ? (
        <ErrorAlert message={state.message} onRetry={reload} />
      ) : null}
      {isReady && rules.length === 0 ? (
        <p className="text-sm text-muted">
          Phiên bản này chưa có quy tắc thông báo nào.
        </p>
      ) : null}

      {isReady && rules.length > 0 ? (
        <Table>
          <Table.ScrollContainer>
            <Table.Content
              aria-label={`Quy tắc thông báo phiên bản ${policy.version}`}
            >
              <Table.Header>
                <Table.Column isRowHeader id="event">
                  Sự kiện
                </Table.Column>
                <Table.Column id="channel">Kênh gửi</Table.Column>
                <Table.Column id="lead">Báo trước</Table.Column>
                <Table.Column id="enabled">Trạng thái</Table.Column>
                <Table.Column id="action">Thao tác</Table.Column>
              </Table.Header>
              <Table.Body>
                {rules.map((rule) => (
                  <Table.Row key={rule.id} id={rule.id}>
                    <Table.Cell>
                      <span className="block font-medium">
                        {notificationEventLabel(rule.eventType)}
                      </span>
                      <span className="block text-xs text-muted">
                        {rule.eventType}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      {NOTIFICATION_CHANNEL_LABELS[rule.channel] ??
                        'Không xác định'}
                    </Table.Cell>
                    <Table.Cell>
                      {formatLeadTime(rule.leadTimeMinutes)}
                    </Table.Cell>
                    <Table.Cell>
                      {isEditable ? (
                        <Switch
                          aria-label={`Bật quy tắc ${notificationEventLabel(rule.eventType)}`}
                          isDisabled={togglingId !== null}
                          isSelected={rule.isEnabled}
                          onChange={(isEnabled) =>
                            void toggleRule(rule, isEnabled)
                          }
                        >
                          <Switch.Content className="flex items-center gap-2 text-sm">
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                            {rule.isEnabled ? 'Bật' : 'Tắt'}
                          </Switch.Content>
                        </Switch>
                      ) : (
                        <Chip
                          color={rule.isEnabled ? 'success' : 'default'}
                          size="sm"
                          variant="soft"
                        >
                          {rule.isEnabled ? 'Đang bật' : 'Đang tắt'}
                        </Chip>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {isEditable ? (
                        <Button
                          aria-label={`Sửa quy tắc ${notificationEventLabel(rule.eventType)}`}
                          size="sm"
                          variant="ghost"
                          onPress={() => setForm({ key: Date.now(), rule })}
                        >
                          Sửa
                        </Button>
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
      ) : null}

      {form ? (
        <RuleFormModal
          key={form.key}
          policy={policy}
          rule={form.rule}
          onClose={() => setForm(null)}
          onSaved={refresh}
        />
      ) : null}
    </>
  );
}

/**
 * Notification rules of one system policy version (SRS UC-26). Only draft
 * versions can be changed; the active and expired versions are read-only.
 */
export function NotificationRulesCard({
  policies,
}: {
  policies: SystemPolicy[];
}) {
  const defaultPolicyId =
    policies.find((policy) => policy.state === 'draft')?.id ??
    policies.find((policy) => policy.state === 'active')?.id ??
    policies[0]?.id ??
    '';
  const [policyId, setPolicyId] = useState(defaultPolicyId);

  // Keep the selection valid when the version list changes (new draft, activation).
  useEffect(() => {
    if (!policies.some((policy) => policy.id === policyId)) {
      setPolicyId(defaultPolicyId);
    }
  }, [defaultPolicyId, policies, policyId]);

  const policy = policies.find((item) => item.id === policyId);

  if (!policies.length) return null;

  return (
    <Card>
      <Card.Header className="flex-row flex-wrap items-center gap-3">
        <Bell aria-hidden="true" className="size-6 text-accent" />
        <div className="min-w-0 flex-1">
          <Card.Title>Quy tắc thông báo</Card.Title>
          <Card.Description>
            Sự kiện nào gửi thông báo qua kênh nào. Chỉ sửa được trên phiên bản
            nháp.
          </Card.Description>
        </div>
        <Select
          aria-label="Chọn phiên bản chính sách"
          className="w-56"
          value={policyId}
          variant="secondary"
          onChange={(key) => setPolicyId(String(key))}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {policies.map((item) => (
                <ListBox.Item
                  key={item.id}
                  id={item.id}
                  textValue={`Phiên bản ${item.version} · ${POLICY_STATE_DISPLAY[item.state].label}`}
                >
                  Phiên bản {item.version} ·{' '}
                  {POLICY_STATE_DISPLAY[item.state].label}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </Card.Header>
      <Card.Content className="gap-4">
        {policy ? <PolicyRulesSection key={policy.id} policy={policy} /> : null}
      </Card.Content>
    </Card>
  );
}
