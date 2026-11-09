import type {
  ManagedUserView,
  UserManagementService,
} from '@/types/user-management';
import type { OperatorProfileErrors } from '@/services/user-management-service';

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

import { validateOperatorProfile } from '@/services/user-management-service';

type ProfileValues = { fullName: string; email: string; phoneNumber: string };

/** Admin edits an Operator's name, email and phone (SRS UC-22). */
export function EditOperatorModal({
  user,
  service,
  onClose,
  onSaved,
}: {
  user: ManagedUserView;
  service: UserManagementService;
  onClose: () => void;
  onSaved: (user: ManagedUserView) => void;
}) {
  const [values, setValues] = useState<ProfileValues>({
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
  });
  const [errors, setErrors] = useState<OperatorProfileErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);

  const update = (patch: Partial<ProfileValues>) => {
    const next = { ...values, ...patch };

    setValues(next);
    if (Object.keys(errors).length) setErrors(validateOperatorProfile(next));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateOperatorProfile(values);

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || pending.current) return;
    if (!service.updateOperator) {
      setSubmitError('Chức năng sửa thông tin chưa được hỗ trợ.');

      return;
    }

    pending.current = true;
    setIsSaving(true);
    setSubmitError('');

    const result = await service.updateOperator({ userId: user.id, ...values });

    pending.current = false;
    setIsSaving(false);

    if (!result.success) {
      setSubmitError(result.error.message);

      return;
    }

    toast.success('Đã cập nhật thông tin nhân viên', {
      description: result.data.fullName,
      indicator: <CircleCheck aria-hidden="true" className="size-5" />,
    });
    onSaved(result.data);
    onClose();
  };

  const emailChanged =
    values.email.trim().toLowerCase() !== user.email.trim().toLowerCase();

  return (
    <Modal isOpen onOpenChange={(open) => !open && !isSaving && onClose()}>
      <Modal.Backdrop isDismissable={!isSaving}>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Sửa thông tin nhân viên vận hành</Modal.Heading>
              <Modal.CloseTrigger aria-label="Đóng biểu mẫu sửa thông tin" />
            </Modal.Header>
            <Form validationBehavior="aria" onSubmit={submit}>
              <Modal.Body className="space-y-4">
                <TextField
                  fullWidth
                  isRequired
                  isDisabled={isSaving}
                  isInvalid={Boolean(errors.fullName)}
                  value={values.fullName}
                  onChange={(fullName) => update({ fullName })}
                >
                  <Label>Họ và tên</Label>
                  <Input variant="secondary" />
                  <FieldError>{errors.fullName}</FieldError>
                </TextField>
                <TextField
                  fullWidth
                  isRequired
                  isDisabled={isSaving}
                  isInvalid={Boolean(errors.email)}
                  type="email"
                  value={values.email}
                  onChange={(email) => update({ email })}
                >
                  <Label>Email đăng nhập</Label>
                  <Input variant="secondary" />
                  <Description>
                    {emailChanged
                      ? 'Nhân viên sẽ đăng nhập bằng email mới; mật khẩu tạm cấp lại sẽ gửi tới email này.'
                      : 'Email dùng để đăng nhập và nhận mật khẩu tạm.'}
                  </Description>
                  <FieldError>{errors.email}</FieldError>
                </TextField>
                <TextField
                  fullWidth
                  isRequired
                  isDisabled={isSaving}
                  isInvalid={Boolean(errors.phoneNumber)}
                  type="tel"
                  value={values.phoneNumber}
                  onChange={(phoneNumber) => update({ phoneNumber })}
                >
                  <Label>Số điện thoại</Label>
                  <Input variant="secondary" />
                  <FieldError>{errors.phoneNumber}</FieldError>
                </TextField>
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
