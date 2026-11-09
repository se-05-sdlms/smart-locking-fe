import type {
  AdminCompartment,
  CompartmentFormErrors,
  CompartmentFormValues,
} from '@/types/admin-locker';

import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  TextField,
  toast,
} from '@heroui/react';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import Xmark from '@gravity-ui/icons/Xmark';

import { LOCKER_FIELD_LIMITS } from '@/constants/admin-locker';
import {
  getAdminLockerErrorMessage,
  toCompartmentFormValues,
  updateCompartment,
  validateCompartmentForm,
} from '@/services/admin-locker-service';

/** Edit a compartment's code and hardware mapping (SRS UC-24). */
export function CompartmentEditModal({
  lockerId,
  lockerCode,
  compartment,
  onClose,
  onSaved,
}: {
  lockerId: string;
  lockerCode: string;
  compartment: AdminCompartment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<CompartmentFormValues>(() =>
    toCompartmentFormValues(compartment),
  );
  const [errors, setErrors] = useState<CompartmentFormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);

  const update = (patch: Partial<CompartmentFormValues>) => {
    const next = { ...values, ...patch };

    setValues(next);
    if (Object.keys(errors).length) setErrors(validateCompartmentForm(next));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateCompartmentForm(values);

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || pending.current) return;

    pending.current = true;
    setIsSaving(true);
    setSubmitError('');

    try {
      const saved = await updateCompartment(lockerId, compartment.id, values);

      toast.success('Đã cập nhật ngăn', {
        description: `Ngăn ${saved.code} · tủ ${lockerCode}`,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getAdminLockerErrorMessage(error));
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onOpenChange={(open) => !open && !isSaving && onClose()}>
      <Modal.Backdrop isDismissable={!isSaving}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label="Đóng biểu mẫu sửa ngăn">
              <Xmark aria-hidden="true" className="size-5" />
            </Modal.CloseTrigger>
            <Modal.Header>
              <Modal.Heading>
                Sửa ngăn {compartment.code} · tủ {lockerCode}
              </Modal.Heading>
            </Modal.Header>
            <Form validationBehavior="aria" onSubmit={submit}>
              <Modal.Body className="space-y-4">
                <TextField
                  fullWidth
                  isRequired
                  isDisabled={isSaving}
                  isInvalid={Boolean(errors.code)}
                  maxLength={LOCKER_FIELD_LIMITS.compartmentCode}
                  value={values.code}
                  onChange={(code) => update({ code })}
                >
                  <Label>Mã ngăn</Label>
                  <Input variant="secondary" />
                  <FieldError>{errors.code}</FieldError>
                </TextField>
                <TextField
                  fullWidth
                  isRequired
                  isDisabled={isSaving}
                  isInvalid={Boolean(errors.hardwareCode)}
                  maxLength={LOCKER_FIELD_LIMITS.hardwareCode}
                  value={values.hardwareCode}
                  onChange={(hardwareCode) => update({ hardwareCode })}
                >
                  <Label>Mã phần cứng</Label>
                  <Input variant="secondary" />
                  <FieldError>{errors.hardwareCode}</FieldError>
                </TextField>
                <TextField
                  fullWidth
                  isRequired
                  inputMode="numeric"
                  isDisabled={isSaving}
                  isInvalid={Boolean(errors.hardwareChannel)}
                  value={values.hardwareChannel}
                  onChange={(hardwareChannel) => update({ hardwareChannel })}
                >
                  <Label>Kênh phần cứng</Label>
                  <Input variant="secondary" />
                  <Description>
                    Phải khớp kênh relay của ngăn trên ESP32; không trùng ngăn
                    khác trong tủ.
                  </Description>
                  <FieldError>{errors.hardwareChannel}</FieldError>
                </TextField>
                <p className="text-sm text-muted">
                  Chỉ sửa được khi ngăn không còn bưu kiện, hàng trả hoặc lượt
                  giữ chỗ.
                </p>
                {submitError ? (
                  <Alert role="alert" status="danger">
                    <Alert.Indicator>
                      <CircleExclamation aria-hidden="true" />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Description>{submitError}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                ) : null}
              </Modal.Body>
              <Modal.Footer>
                <Button isDisabled={isSaving} variant="ghost" onPress={onClose}>
                  Hủy
                </Button>
                <Button isDisabled={isSaving} type="submit" variant="primary">
                  {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
