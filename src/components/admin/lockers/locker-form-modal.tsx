import type {
  AdminLocker,
  AdminLockerDetail,
  LockerFormErrors,
  LockerFormValues,
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
  ListBox,
  Modal,
  Select,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import Xmark from '@gravity-ui/icons/Xmark';

import {
  ADMIN_OPERATIONAL_STATUS_DISPLAY,
  EDITABLE_OPERATIONAL_STATUSES,
  LOCKER_FIELD_LIMITS,
} from '@/constants/admin-locker';
import {
  createLocker,
  getAdminLockerErrorMessage,
  toLockerFormValues,
  updateLocker,
  validateLockerForm,
} from '@/services/admin-locker-service';

type LockerFormModalProps = {
  isOpen: boolean;
  /** Locker being edited; undefined creates a new locker. */
  locker?: AdminLocker;
  onOpenChange: (isOpen: boolean) => void;
  onSaved: (locker: AdminLockerDetail) => void;
};

export function LockerFormModal({
  isOpen,
  locker,
  onOpenChange,
  onSaved,
}: LockerFormModalProps) {
  const isEdit = Boolean(locker);
  const [values, setValues] = useState<LockerFormValues>(() =>
    toLockerFormValues(locker),
  );
  const [errors, setErrors] = useState<LockerFormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);

  const update = (patch: Partial<LockerFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    if (Object.keys(errors).length)
      setErrors(validateLockerForm({ ...values, ...patch }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateLockerForm(values);

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || pending.current) return;

    pending.current = true;
    setIsSaving(true);
    setSubmitError('');

    try {
      const saved = locker
        ? await updateLocker(locker.id, values)
        : await createLocker(values);

      toast.success(isEdit ? 'Đã cập nhật tủ' : 'Đã khai báo tủ', {
        description: isEdit
          ? saved.code
          : `${saved.code} chưa hoạt động. Mở chi tiết tủ → Quy trình bàn giao để cấu hình thiết bị.`,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(getAdminLockerErrorMessage(error));
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !isSaving && onOpenChange(open)}
    >
      <Modal.Backdrop isDismissable={!isSaving}>
        <Modal.Container scroll="inside" size="lg">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label="Đóng biểu mẫu tủ">
              <Xmark aria-hidden="true" className="size-5" />
            </Modal.CloseTrigger>
            <Modal.Header>
              <Modal.Heading>
                {isEdit ? `Chỉnh sửa tủ ${locker?.code}` : 'Thêm tủ'}
              </Modal.Heading>
            </Modal.Header>
            <Form validationBehavior="aria" onSubmit={submit}>
              <Modal.Body>
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField
                    fullWidth
                    isRequired
                    isDisabled={isSaving}
                    isInvalid={Boolean(errors.code)}
                    maxLength={LOCKER_FIELD_LIMITS.code}
                    value={values.code}
                    onChange={(code) => update({ code })}
                  >
                    <Label>Mã tủ</Label>
                    <Input placeholder="Ví dụ: LK-HN-001" variant="secondary" />
                    <FieldError>{errors.code}</FieldError>
                  </TextField>
                  <TextField
                    fullWidth
                    isRequired
                    isDisabled={isSaving}
                    isInvalid={Boolean(errors.deviceIdentifier)}
                    maxLength={LOCKER_FIELD_LIMITS.deviceIdentifier}
                    value={values.deviceIdentifier}
                    onChange={(deviceIdentifier) =>
                      update({ deviceIdentifier })
                    }
                  >
                    <Label>Mã thiết bị</Label>
                    <Input
                      placeholder="Mã định danh ESP32"
                      variant="secondary"
                    />
                    <Description>
                      Phải trùng với mã cấu hình trên thiết bị.
                    </Description>
                    <FieldError>{errors.deviceIdentifier}</FieldError>
                  </TextField>
                  <TextField
                    fullWidth
                    isRequired
                    className="sm:col-span-2"
                    isDisabled={isSaving}
                    isInvalid={Boolean(errors.address)}
                    maxLength={LOCKER_FIELD_LIMITS.address}
                    value={values.address}
                    onChange={(address) => update({ address })}
                  >
                    <Label>Địa chỉ đặt tủ</Label>
                    <TextArea rows={2} variant="secondary" />
                    <FieldError>{errors.address}</FieldError>
                  </TextField>
                  <TextField
                    fullWidth
                    isRequired
                    className="sm:col-span-2"
                    isDisabled={isSaving}
                    isInvalid={Boolean(errors.recoveryAddress)}
                    maxLength={LOCKER_FIELD_LIMITS.recoveryAddress}
                    value={values.recoveryAddress}
                    onChange={(recoveryAddress) => update({ recoveryAddress })}
                  >
                    <Label>Địa chỉ tập kết hàng quá hạn</Label>
                    <TextArea rows={2} variant="secondary" />
                    <Description>
                      Operator chuyển bưu kiện quá hạn về đây; cư dân được thông
                      báo địa chỉ này.
                    </Description>
                    <FieldError>{errors.recoveryAddress}</FieldError>
                  </TextField>
                  {isEdit ? (
                    <Select
                      className="sm:col-span-2"
                      isDisabled={isSaving}
                      value={values.operationalStatus}
                      variant="secondary"
                      onChange={(value) =>
                        update({
                          operationalStatus:
                            value as LockerFormValues['operationalStatus'],
                        })
                      }
                    >
                      <Label>Trạng thái vận hành</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {EDITABLE_OPERATIONAL_STATUSES.map((status) => (
                            <ListBox.Item
                              key={status}
                              id={status}
                              textValue={
                                ADMIN_OPERATIONAL_STATUS_DISPLAY[status].label
                              }
                            >
                              {ADMIN_OPERATIONAL_STATUS_DISPLAY[status].label}
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                      <Description>
                        Kết nối và trạng thái cửa do thiết bị báo về, không
                        chỉnh tại đây.
                      </Description>
                    </Select>
                  ) : null}
                </div>
                {submitError ? (
                  <Alert className="mt-5" role="alert" status="danger">
                    <Alert.Indicator>
                      <CircleExclamation
                        aria-hidden="true"
                        className="size-5"
                      />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Description>{submitError}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                ) : null}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  isDisabled={isSaving}
                  variant="ghost"
                  onPress={() => onOpenChange(false)}
                >
                  Hủy
                </Button>
                <Button isDisabled={isSaving} type="submit" variant="primary">
                  {isSaving
                    ? 'Đang lưu...'
                    : isEdit
                      ? 'Lưu thay đổi'
                      : 'Thêm tủ'}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
