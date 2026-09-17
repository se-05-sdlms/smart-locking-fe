import { useState } from 'react';
import {
  Button,
  Card,
  Chip,
  FieldError,
  Form,
  InputGroup,
  Label,
  Separator,
  TextField,
  toast,
} from '@heroui/react';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import Eye from '@gravity-ui/icons/Eye';
import EyeSlash from '@gravity-ui/icons/EyeSlash';
import FloppyDisk from '@gravity-ui/icons/FloppyDisk';
import Key from '@gravity-ui/icons/Key';
import Person from '@gravity-ui/icons/Person';

export default function OperatorSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordsDoNotMatch =
    confirmPassword.length > 0 && confirmPassword !== newPassword;

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const savePassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword ||
      passwordsDoNotMatch
    ) {
      return;
    }

    resetForm();
    toast.success('Đã đổi mật khẩu', {
      description: 'Mật khẩu tài khoản Operator đã được cập nhật.',
      indicator: <CircleCheck aria-hidden="true" className="size-5" />,
    });
  };

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <Card>
        <Card.Header className="flex-row items-center gap-3">
          <Person aria-hidden="true" className="size-6 text-accent" />
          <Card.Title>Thông tin cá nhân</Card.Title>
        </Card.Header>
        <Card.Content className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-8">
          <dl className="space-y-1">
            <div className="grid grid-cols-[9rem_1fr] gap-4 py-2.5">
              <dt className="text-sm text-muted">Họ và tên</dt>
              <dd className="text-sm font-medium">Nguyễn Văn A</dd>
            </div>
            <div className="grid grid-cols-[9rem_1fr] gap-4 py-2.5">
              <dt className="text-sm text-muted">Mã nhân viên</dt>
              <dd className="text-sm font-medium">OP-001</dd>
            </div>
            <div className="grid grid-cols-[9rem_1fr] gap-4 py-2.5">
              <dt className="text-sm text-muted">Email đăng nhập</dt>
              <dd className="min-w-0 break-words text-sm font-medium">
                nguyenvana@smartlock.vn
              </dd>
            </div>
            <div className="grid grid-cols-[9rem_1fr] gap-4 py-2.5">
              <dt className="text-sm text-muted">Số điện thoại</dt>
              <dd className="text-sm font-medium">0901 234 567</dd>
            </div>
          </dl>

          <Separator className="hidden lg:block" orientation="vertical" />

          <dl className="space-y-1">
            <div className="grid grid-cols-[9rem_1fr] gap-4 py-2.5">
              <dt className="text-sm text-muted">Vai trò</dt>
              <dd className="text-sm font-medium">Locker Operator</dd>
            </div>
            <div className="grid grid-cols-[9rem_1fr] gap-4 py-2.5">
              <dt className="text-sm text-muted">Phạm vi phụ trách</dt>
              <dd className="text-sm font-medium">LK-01, LK-02, LK-03</dd>
            </div>
            <div className="grid grid-cols-[9rem_1fr] gap-4 py-2.5">
              <dt className="text-sm text-muted">Trạng thái tài khoản</dt>
              <dd>
                <Chip color="success" size="sm" variant="soft">
                  Đang hoạt động
                </Chip>
              </dd>
            </div>
          </dl>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="flex-row items-center gap-3">
          <Key aria-hidden="true" className="size-6 text-accent" />
          <Card.Title>Đổi mật khẩu</Card.Title>
        </Card.Header>
        <Card.Content>
          <Form className="space-y-5" onSubmit={savePassword}>
            <TextField
              fullWidth
              isRequired
              className="grid gap-2 md:grid-cols-[13rem_minmax(0,1fr)] md:items-center"
              name="currentPassword"
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
            >
              <Label>Mật khẩu hiện tại</Label>
              <InputGroup fullWidth variant="secondary">
                <InputGroup.Input
                  placeholder="Nhập mật khẩu hiện tại"
                  type={showCurrentPassword ? 'text' : 'password'}
                />
                <InputGroup.Suffix>
                  <Button
                    isIconOnly
                    aria-label={
                      showCurrentPassword
                        ? 'Ẩn mật khẩu hiện tại'
                        : 'Hiện mật khẩu hiện tại'
                    }
                    size="sm"
                    variant="ghost"
                    onPress={() =>
                      setShowCurrentPassword((isVisible) => !isVisible)
                    }
                  >
                    {showCurrentPassword ? (
                      <EyeSlash aria-hidden="true" className="size-4" />
                    ) : (
                      <Eye aria-hidden="true" className="size-4" />
                    )}
                  </Button>
                </InputGroup.Suffix>
              </InputGroup>
              <FieldError className="md:col-start-2">
                Vui lòng nhập mật khẩu hiện tại.
              </FieldError>
            </TextField>

            <TextField
              fullWidth
              isRequired
              className="grid gap-2 md:grid-cols-[13rem_minmax(0,1fr)] md:items-center"
              name="newPassword"
              type="password"
              value={newPassword}
              onChange={setNewPassword}
            >
              <Label>Mật khẩu mới</Label>
              <InputGroup fullWidth variant="secondary">
                <InputGroup.Input
                  placeholder="Nhập mật khẩu mới"
                  type={showNewPassword ? 'text' : 'password'}
                />
                <InputGroup.Suffix>
                  <Button
                    isIconOnly
                    aria-label={
                      showNewPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'
                    }
                    size="sm"
                    variant="ghost"
                    onPress={() =>
                      setShowNewPassword((isVisible) => !isVisible)
                    }
                  >
                    {showNewPassword ? (
                      <EyeSlash aria-hidden="true" className="size-4" />
                    ) : (
                      <Eye aria-hidden="true" className="size-4" />
                    )}
                  </Button>
                </InputGroup.Suffix>
              </InputGroup>
              <FieldError className="md:col-start-2">
                Vui lòng nhập mật khẩu mới.
              </FieldError>
            </TextField>

            <TextField
              fullWidth
              isInvalid={passwordsDoNotMatch}
              isRequired
              className="grid gap-2 md:grid-cols-[13rem_minmax(0,1fr)] md:items-center"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            >
              <Label>Xác nhận mật khẩu mới</Label>
              <InputGroup fullWidth variant="secondary">
                <InputGroup.Input
                  placeholder="Nhập lại mật khẩu mới"
                  type={showConfirmPassword ? 'text' : 'password'}
                />
                <InputGroup.Suffix>
                  <Button
                    isIconOnly
                    aria-label={
                      showConfirmPassword
                        ? 'Ẩn mật khẩu xác nhận'
                        : 'Hiện mật khẩu xác nhận'
                    }
                    size="sm"
                    variant="ghost"
                    onPress={() =>
                      setShowConfirmPassword((isVisible) => !isVisible)
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeSlash aria-hidden="true" className="size-4" />
                    ) : (
                      <Eye aria-hidden="true" className="size-4" />
                    )}
                  </Button>
                </InputGroup.Suffix>
              </InputGroup>
              <FieldError className="md:col-start-2">
                {passwordsDoNotMatch
                  ? 'Mật khẩu xác nhận không khớp.'
                  : 'Vui lòng xác nhận mật khẩu mới.'}
              </FieldError>
            </TextField>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onPress={resetForm}>
                Hủy
              </Button>
              <Button type="submit" variant="primary">
                <FloppyDisk aria-hidden="true" className="size-5" />
                Lưu thay đổi
              </Button>
            </div>
          </Form>
        </Card.Content>
      </Card>
    </section>
  );
}
