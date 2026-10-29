import type {
  ContactFormValues,
  FormErrors,
  LockerSupport,
  SettingsFormValues,
} from '@/services/support-contact-service';

import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Chip,
  Description,
  FieldError,
  Input,
  Label,
  Modal,
  Skeleton,
  Switch,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';

import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  emptyContactForm,
  getLockerSupport,
  getLockerSupportSettings,
  getOperatorContact,
  getSupportErrorMessage,
  saveLockerSupportSettings,
  saveOperatorContact,
  supportWarnings,
  toContactForm,
  toSettingsForm,
  validateContactForm,
  validateSettingsForm,
  WEEKDAY_LABELS,
} from '@/services/support-contact-service';

type Operator = { id: string; fullName: string };

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

/** What residents see right now; shared with the locker detail drawer. */
export function SupportSummary({ support }: { support: LockerSupport }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          color={
            support.isAvailable
              ? support.isFallback
                ? 'warning'
                : 'success'
              : 'danger'
          }
          size="sm"
          variant="soft"
        >
          {!support.isAvailable
            ? 'Không có số liên hệ'
            : support.isFallback
              ? 'Đang hiện đầu mối dự phòng'
              : 'Đang hiện Operator phụ trách'}
        </Chip>
      </div>
      <p>
        <span className="text-muted">Liên hệ: </span>
        {support.contactName ?? '—'}
        {support.phoneNumber ? ` · ${support.phoneNumber}` : ''}
      </p>
      <p>
        <span className="text-muted">Giờ hỗ trợ: </span>
        {support.supportHours ?? '—'}
      </p>
      <p className="whitespace-pre-wrap">
        <span className="text-muted">Hướng dẫn: </span>
        {support.instructions}
      </p>
    </div>
  );
}

function ContactForm({
  operator,
  initial,
  onSaved,
}: {
  operator: Operator;
  initial: ContactFormValues;
  onSaved: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FormErrors<ContactFormValues>>({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);

  const update = (patch: Partial<ContactFormValues>) => {
    const next = { ...values, ...patch };

    setValues(next);
    if (Object.keys(errors).length) setErrors(validateContactForm(next));
  };
  const toggleDay = (day: number, on: boolean) =>
    update({
      weekdays: on
        ? [...values.weekdays, day].sort()
        : values.weekdays.filter((item) => item !== day),
    });

  const save = async () => {
    const next = validateContactForm(values);

    setErrors(next);
    if (Object.keys(next).length || pending.current) return;
    pending.current = true;
    setIsSaving(true);
    setError('');
    try {
      await saveOperatorContact(operator.id, values);
      toast.success('Đã lưu liên hệ của Operator', {
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      onSaved();
    } catch (saveError) {
      setError(getSupportErrorMessage(saveError));
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <TextField
        fullWidth
        isInvalid={Boolean(errors.displayName)}
        value={values.displayName}
        onChange={(displayName) => update({ displayName })}
      >
        <Label>Tên hiển thị cho cư dân</Label>
        <Input variant="secondary" />
        <FieldError>{errors.displayName}</FieldError>
      </TextField>
      <TextField
        fullWidth
        isInvalid={Boolean(errors.workPhoneNumber)}
        value={values.workPhoneNumber}
        onChange={(workPhoneNumber) => update({ workPhoneNumber })}
      >
        <Label>Số điện thoại công việc</Label>
        <Input
          inputMode="tel"
          placeholder="VD: 0901234567"
          variant="secondary"
        />
        <Description>
          Chỉ dùng số công việc được phép công khai, không dùng số cá nhân.
        </Description>
        <FieldError>{errors.workPhoneNumber}</FieldError>
      </TextField>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Ngày hỗ trợ (giờ Việt Nam)
        </legend>
        <div className="flex flex-wrap gap-3">
          {WEEKDAY_LABELS.map((label, day) => (
            <Checkbox
              key={label}
              isSelected={values.weekdays.includes(day)}
              onChange={(on) => toggleDay(day, on)}
            >
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>{label}</Checkbox.Content>
            </Checkbox>
          ))}
        </div>
        {errors.weekdays ? (
          <p className="text-sm text-danger">{errors.weekdays}</p>
        ) : null}
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          isInvalid={Boolean(errors.startsAt)}
          type="time"
          value={values.startsAt}
          onChange={(startsAt) => update({ startsAt })}
        >
          <Label>Từ</Label>
          <Input variant="secondary" />
          <FieldError>{errors.startsAt}</FieldError>
        </TextField>
        <TextField
          isInvalid={Boolean(errors.endsAt)}
          type="time"
          value={values.endsAt}
          onChange={(endsAt) => update({ endsAt })}
        >
          <Label>Đến</Label>
          <Input variant="secondary" />
          <Description>Giờ đến nhỏ hơn giờ từ nghĩa là ca qua đêm.</Description>
          <FieldError>{errors.endsAt}</FieldError>
        </TextField>
      </div>
      <TextField
        fullWidth
        isInvalid={Boolean(errors.instructions)}
        value={values.instructions}
        onChange={(instructions) => update({ instructions })}
      >
        <Label>Hướng dẫn liên hệ</Label>
        <TextArea maxLength={1000} rows={2} variant="secondary" />
        <FieldError>{errors.instructions}</FieldError>
      </TextField>
      <Switch
        isSelected={values.isPublic}
        onChange={(isPublic) => update({ isPublic })}
      >
        <Switch.Content className="flex items-center gap-3">
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Công khai cho cư dân
        </Switch.Content>
      </Switch>
      {error ? <ErrorAlert message={error} /> : null}
      <Button
        isPending={isSaving}
        variant="primary"
        onPress={() => void save()}
      >
        Lưu liên hệ Operator
      </Button>
    </div>
  );
}

function SettingsForm({
  lockerId,
  initial,
  onSaved,
}: {
  lockerId: string;
  initial: SettingsFormValues;
  onSaved: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FormErrors<SettingsFormValues>>({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);

  const update = (patch: Partial<SettingsFormValues>) => {
    const next = { ...values, ...patch };

    setValues(next);
    if (Object.keys(errors).length) setErrors(validateSettingsForm(next));
  };

  const save = async () => {
    const next = validateSettingsForm(values);

    setErrors(next);
    if (Object.keys(next).length || pending.current) return;
    pending.current = true;
    setIsSaving(true);
    setError('');
    try {
      await saveLockerSupportSettings(lockerId, values);
      toast.success('Đã lưu đầu mối dự phòng', {
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      onSaved();
    } catch (saveError) {
      setError(getSupportErrorMessage(saveError));
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  const field = (
    key: 'fallbackName' | 'fallbackPhoneNumber' | 'fallbackHours',
    label: string,
    placeholder: string,
  ) => (
    <TextField
      fullWidth
      isInvalid={Boolean(errors[key])}
      value={values[key]}
      onChange={(value) => update({ [key]: value })}
    >
      <Label>{label}</Label>
      <Input placeholder={placeholder} variant="secondary" />
      <FieldError>{errors[key]}</FieldError>
    </TextField>
  );

  return (
    <div className="space-y-3">
      {field('fallbackName', 'Tên đầu mối dự phòng', 'VD: Ban quản lý tòa nhà')}
      {field(
        'fallbackPhoneNumber',
        'Số điện thoại dự phòng',
        'VD: 02812345678',
      )}
      {field(
        'fallbackHours',
        'Giờ hỗ trợ dự phòng',
        'VD: 24/7 hoặc T2–CN 07:00–22:00',
      )}
      <TextField
        fullWidth
        isInvalid={Boolean(errors.fallbackInstructions)}
        value={values.fallbackInstructions}
        onChange={(fallbackInstructions) => update({ fallbackInstructions })}
      >
        <Label>Hướng dẫn khi không liên hệ được Operator</Label>
        <TextArea maxLength={1000} rows={2} variant="secondary" />
        <FieldError>{errors.fallbackInstructions}</FieldError>
      </TextField>
      {error ? <ErrorAlert message={error} /> : null}
      <Button
        isPending={isSaving}
        variant="primary"
        onPress={() => void save()}
      >
        Lưu đầu mối dự phòng
      </Button>
    </div>
  );
}

export function LockerSupportModal({
  lockerId,
  lockerCode,
  operator,
  onClose,
}: {
  lockerId: string;
  lockerCode: string;
  operator: Operator | null;
  onClose: () => void;
}) {
  const { state, refresh } = useAsyncResource(
    async (signal) => {
      const [support, contact, settings] = await Promise.all([
        getLockerSupport(lockerId, signal),
        operator
          ? getOperatorContact(operator.id, signal)
          : Promise.resolve(null),
        getLockerSupportSettings(lockerId, signal),
      ]);

      return { support, contact, settings };
    },
    getSupportErrorMessage,
    [lockerId, operator?.id],
  );
  const data = state.data;
  const warnings = data
    ? supportWarnings({
        hasOperator: Boolean(operator),
        contact: data.contact,
        settings: data.settings,
      })
    : [];

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container scroll="inside" size="lg">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Đầu mối hỗ trợ · Tủ {lockerCode}</Modal.Heading>
              <Modal.CloseTrigger aria-label="Đóng đầu mối hỗ trợ" />
            </Modal.Header>
            <Modal.Body className="space-y-4">
              {state.status === 'loading' && !data ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : null}
              {state.status === 'error' && !data ? (
                <ErrorAlert message={state.message} />
              ) : null}
              {data ? (
                <>
                  <Card>
                    <Card.Header>
                      <Card.Title>Cư dân đang thấy</Card.Title>
                    </Card.Header>
                    <Card.Content>
                      <SupportSummary support={data.support} />
                    </Card.Content>
                  </Card>
                  {warnings.length ? (
                    <Alert status="warning">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>Cần bổ sung</Alert.Title>
                        <Alert.Description>
                          <ul className="list-disc pl-4">
                            {warnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : null}
                  <Card>
                    <Card.Header>
                      <Card.Title>Operator phụ trách</Card.Title>
                      <Card.Description>
                        {operator
                          ? `${operator.fullName}. Đổi người phụ trách ở cột Thao tác, liên hệ công khai sẽ tự theo người mới.`
                          : 'Tủ chưa có Operator phụ trách. Phân công Operator trước khi cấu hình liên hệ.'}
                      </Card.Description>
                    </Card.Header>
                    {operator ? (
                      <Card.Content>
                        <ContactForm
                          initial={
                            data.contact
                              ? toContactForm(data.contact)
                              : emptyContactForm(operator.fullName)
                          }
                          operator={operator}
                          onSaved={refresh}
                        />
                      </Card.Content>
                    ) : null}
                  </Card>
                  <Card>
                    <Card.Header>
                      <Card.Title>Đầu mối dự phòng của tủ</Card.Title>
                      <Card.Description>
                        Hiển thị khi ngoài giờ của Operator, Operator ẩn liên hệ
                        hoặc tủ chưa có người phụ trách.
                      </Card.Description>
                    </Card.Header>
                    <Card.Content>
                      <SettingsForm
                        initial={toSettingsForm(data.settings)}
                        lockerId={lockerId}
                        onSaved={refresh}
                      />
                    </Card.Content>
                  </Card>
                </>
              ) : null}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={onClose}>
                Đóng
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
