import type { CSSProperties, FormEvent } from 'react';
import type {
  Locker,
  OperatorUserView,
  UserManagementService,
} from '@/types/user-management';

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Checkbox,
  CheckboxGroup,
  Chip,
  FieldError,
  Input,
  Label,
  Modal,
  SearchField,
  Spinner,
  TextField,
} from '@heroui/react';
import ArrowsRotateRight from '@gravity-ui/icons/ArrowsRotateRight';
import Camera from '@gravity-ui/icons/Camera';
import CirclePlus from '@gravity-ui/icons/CirclePlus';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Persons from '@gravity-ui/icons/Persons';
import TriangleExclamation from '@gravity-ui/icons/TriangleExclamation';
import TrashBin from '@gravity-ui/icons/TrashBin';

type CreateOperatorModalProps = {
  isOpen: boolean;
  service: UserManagementService;
  onClose: () => void;
  onCreated: (operator: OperatorUserView) => void;
};

type FormValues = {
  fullName: string;
  email: string;
  phoneNumber: string;
};

type FormErrors = Partial<
  Record<keyof FormValues | 'lockerIds' | 'form', string>
>;

const emptyForm: FormValues = {
  fullName: '',
  email: '',
  phoneNumber: '',
};

const acceptedAvatarTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxAvatarSize = 2 * 1024 * 1024;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?\d{9,15}$/;
const inputClassName =
  'border border-[var(--um-border)] bg-[var(--um-surface)] shadow-none [--field-background:var(--um-surface)] [--field-border:var(--um-border)] [--field-border-focus:var(--um-focus)] [--field-focus:var(--um-surface)] focus:border-[var(--um-focus)]';
const primarySubmitButtonStyle = {
  '--button-bg': 'var(--um-primary)',
  '--button-bg-hover': '#005bb5',
  '--button-bg-pressed': '#005bb5',
  '--button-fg': 'var(--um-on-primary)',
} as CSSProperties;
const secondaryCancelButtonStyle = {
  '--button-bg': 'var(--um-surface)',
  '--button-bg-hover': 'var(--um-page)',
  '--button-bg-pressed': 'var(--um-page)',
  '--button-fg': 'var(--um-ink)',
} as CSSProperties;

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  return parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toLocaleUpperCase('vi-VN')
    : (parts[0]?.[0] ?? '?').toLocaleUpperCase('vi-VN');
}

function getClientErrors(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  const email = values.email.trim();
  const phoneNumber = values.phoneNumber.trim().replace(/[\s().-]/g, '');

  if (!values.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên.';
  if (!email) errors.email = 'Vui lòng nhập email.';
  else if (!emailPattern.test(email))
    errors.email = 'Địa chỉ email không hợp lệ.';
  if (!phoneNumber) errors.phoneNumber = 'Vui lòng nhập số điện thoại.';
  else if (!phonePattern.test(phoneNumber))
    errors.phoneNumber = 'Số điện thoại không hợp lệ.';

  return errors;
}

function LockerOption({ locker }: { locker: Locker }) {
  return (
    <Checkbox
      className="[&[data-focus-visible=true]_[data-slot=checkbox-content]]:ring-2 [&[data-focus-visible=true]_[data-slot=checkbox-content]]:ring-[var(--um-focus)] [&[data-focus-visible=true]_[data-slot=checkbox-content]]:ring-offset-2 [&:hover_[data-slot=checkbox-content]]:border-[var(--um-primary-border)] [&:hover_[data-slot=checkbox-content]]:bg-[var(--um-row-hover)] [&[data-selected=true]_[data-slot=checkbox-content]]:border-[var(--um-primary)] [&[data-selected=true]_[data-slot=checkbox-content]]:bg-[var(--um-primary-soft)]"
      value={locker.id}
    >
      <Checkbox.Content className="min-h-16 w-full rounded-lg border border-[var(--um-border)] bg-[var(--um-surface)] px-3 py-2 shadow-none transition-colors">
        <Checkbox.Control className="border border-[var(--um-border)] bg-[var(--um-surface)] shadow-none">
          <Checkbox.Indicator />
        </Checkbox.Control>
        <span className="ml-3 min-w-0">
          <span className="block font-medium text-[var(--um-ink)]">
            {locker.code}
          </span>
          <span className="block text-sm text-neutral-600">
            {locker.buildingName} — {locker.locationLabel}
          </span>
        </span>
      </Checkbox.Content>
    </Checkbox>
  );
}

export function CreateOperatorModal({
  isOpen,
  service,
  onClose,
  onCreated,
}: CreateOperatorModalProps) {
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [selectedLockerIds, setSelectedLockerIds] = useState<string[]>([]);
  const [availableLockers, setAvailableLockers] = useState<Locker[]>([]);
  const [isLoadingLockers, setIsLoadingLockers] = useState(false);
  const [lockerError, setLockerError] = useState<string | null>(null);
  const [lockerSearch, setLockerSearch] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isReadingAvatar, setIsReadingAvatar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lockerRequestIdRef = useRef(0);
  const avatarRequestIdRef = useRef(0);

  const resetForm = () => {
    avatarRequestIdRef.current += 1;
    setValues(emptyForm);
    setErrors({});
    setSelectedLockerIds([]);
    setLockerSearch('');
    setAvatarUrl(undefined);
    setAvatarError(null);
    setIsReadingAvatar(false);
    setLockerError(null);
  };

  const closeForm = () => {
    if (isSubmitting || isReadingAvatar) return;
    resetForm();
    onClose();
  };

  const loadAvailableLockers = () => {
    const requestId = lockerRequestIdRef.current + 1;
    let isActive = true;

    lockerRequestIdRef.current = requestId;
    setIsLoadingLockers(true);
    setLockerError(null);

    void service
      .getAvailableLockers()
      .then((result) => {
        if (!isActive || requestId !== lockerRequestIdRef.current) return;
        if (!result.success) {
          setAvailableLockers([]);
          setLockerError(result.error.message);

          return;
        }

        setAvailableLockers(result.data);
        setSelectedLockerIds((ids) =>
          ids.filter((id) => result.data.some((locker) => locker.id === id)),
        );
      })
      .catch(() => {
        if (!isActive || requestId !== lockerRequestIdRef.current) return;
        setAvailableLockers([]);
        setLockerError('Không thể tải danh sách Locker khả dụng.');
      })
      .finally(() => {
        if (isActive && requestId === lockerRequestIdRef.current)
          setIsLoadingLockers(false);
      });

    return () => {
      isActive = false;
    };
  };

  useEffect(() => {
    if (!isOpen) return;

    return loadAvailableLockers();
  }, [isOpen, service]);

  const setFieldValue = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      form: undefined,
    }));
  };

  const handleAvatarChange = (file: File | null) => {
    avatarRequestIdRef.current += 1;

    const requestId = avatarRequestIdRef.current;

    setAvatarError(null);

    if (!file) {
      setAvatarUrl(undefined);
      setIsReadingAvatar(false);

      return;
    }

    if (!acceptedAvatarTypes.has(file.type)) {
      setAvatarUrl(undefined);
      setAvatarError('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.');
      setIsReadingAvatar(false);

      return;
    }

    if (file.size > maxAvatarSize) {
      setAvatarUrl(undefined);
      setAvatarError('Ảnh đại diện không được vượt quá 2 MB.');
      setIsReadingAvatar(false);

      return;
    }

    const reader = new FileReader();

    setIsReadingAvatar(true);
    reader.onload = () => {
      if (requestId !== avatarRequestIdRef.current || !isOpen) return;
      setAvatarUrl(
        typeof reader.result === 'string' ? reader.result : undefined,
      );
      setIsReadingAvatar(false);
    };
    reader.onerror = () => {
      if (requestId !== avatarRequestIdRef.current || !isOpen) return;
      setAvatarUrl(undefined);
      setAvatarError('Không thể đọc ảnh đại diện. Vui lòng thử lại.');
      setIsReadingAvatar(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || isReadingAvatar) return;

    const clientErrors = getClientErrors(values);

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);

      return;
    }

    setIsSubmitting(true);
    setErrors({});
    void service
      .createOperator({
        fullName: values.fullName,
        email: values.email,
        phoneNumber: values.phoneNumber,
        ...(avatarUrl ? { avatarUrl } : {}),
        lockerIds: selectedLockerIds,
      })
      .then((result) => {
        if (!result.success) {
          const fieldByCode: Partial<Record<string, keyof FormErrors>> = {
            DUPLICATE_EMAIL: 'email',
            DUPLICATE_PHONE: 'phoneNumber',
            INVALID_EMAIL: 'email',
            INVALID_PHONE: 'phoneNumber',
            LOCKER_CONFLICT: 'lockerIds',
            LOCKER_NOT_FOUND: 'lockerIds',
          };
          const field = fieldByCode[result.error.code] ?? 'form';

          setErrors({ [field]: result.error.message });
          if (field === 'lockerIds') loadAvailableLockers();

          return;
        }

        resetForm();
        onClose();
        onCreated(result.data);
      })
      .catch(() => {
        setErrors({
          form: 'Không thể thêm nhân viên vận hành. Vui lòng thử lại.',
        });
      })
      .finally(() => setIsSubmitting(false));
  };

  const normalizedLockerSearch = lockerSearch.trim().toLocaleLowerCase('vi-VN');
  const filteredAvailableLockers = availableLockers.filter((locker) => {
    if (!normalizedLockerSearch) return true;

    return [locker.code, locker.buildingName, locker.locationLabel].some(
      (value) =>
        value.toLocaleLowerCase('vi-VN').includes(normalizedLockerSearch),
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeForm();
      }}
    >
      <Modal.Backdrop isDismissable={!isSubmitting && !isReadingAvatar}>
        <Modal.Container className="p-0 sm:p-4" scroll="inside" size="lg">
          <Modal.Dialog className="h-[100dvh] max-h-[100dvh] w-full max-w-none rounded-none p-0 shadow-none sm:h-[min(90dvh,760px)] sm:max-h-[calc(100dvh-32px)] sm:w-[min(920px,calc(100dvw-32px))] sm:max-w-[920px] sm:rounded-[18px]">
            <Modal.Header className="relative z-10 shrink-0 gap-1 border-b border-[var(--um-border)] bg-[var(--um-surface)] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-[var(--um-primary-soft)] text-[var(--um-primary)]">
                  <Persons aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <Modal.Heading>Thêm nhân viên vận hành</Modal.Heading>
                  <p className="mt-0.5 text-sm text-neutral-600">
                    Tạo tài khoản và phân công tủ cho nhân viên mới.
                  </p>
                </div>
              </div>
              <Modal.CloseTrigger
                aria-label="Đóng biểu mẫu"
                isDisabled={isSubmitting || isReadingAvatar}
              />
            </Modal.Header>
            <form
              noValidate
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              onSubmit={handleSubmit}
            >
              <Modal.Body className="m-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 [scrollbar-gutter:stable] sm:px-6">
                <div className="space-y-6">
                  <section>
                    <h3 className="border-s-2 border-[var(--um-primary)] ps-2 text-base font-semibold text-[var(--um-ink)]">
                      Thông tin nhận diện
                    </h3>
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <Avatar size="lg">
                        {avatarUrl ? (
                          <Avatar.Image alt="Ảnh xem trước" src={avatarUrl} />
                        ) : null}
                        <Avatar.Fallback className="bg-[var(--um-primary-soft)] text-[var(--um-primary-strong)]">
                          {getInitials(values.fullName)}
                        </Avatar.Fallback>
                      </Avatar>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[var(--um-primary-border)] bg-[var(--um-surface)] px-3 text-sm font-medium text-[var(--um-primary)]">
                          <Camera aria-hidden="true" className="size-4" />
                          Chọn ảnh
                          <input
                            accept="image/jpeg,image/png,image/webp"
                            aria-label="Chọn ảnh đại diện"
                            className="sr-only"
                            disabled={isSubmitting}
                            type="file"
                            onChange={(event) =>
                              handleAvatarChange(
                                event.target.files?.[0] ?? null,
                              )
                            }
                          />
                        </label>
                        {avatarUrl ? (
                          <Button
                            isDisabled={isSubmitting || isReadingAvatar}
                            variant="outline"
                            onPress={() => handleAvatarChange(null)}
                          >
                            <TrashBin aria-hidden="true" className="size-4" />
                            Bỏ ảnh
                          </Button>
                        ) : null}
                        {isReadingAvatar ? (
                          <span className="text-sm text-neutral-600">
                            Đang đọc ảnh...
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {avatarError ? (
                      <p className="mt-2 text-sm text-red-600">{avatarError}</p>
                    ) : null}

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border border-[var(--um-border)] bg-[var(--um-page)] px-3 py-2.5">
                        <p className="text-sm text-neutral-600">Mã nhân viên</p>
                        <p className="mt-1 text-sm font-medium text-[var(--um-primary-strong)]">
                          Hệ thống tự động tạo sau khi lưu
                        </p>
                      </div>
                      <TextField
                        isRequired
                        isInvalid={Boolean(errors.fullName)}
                        value={values.fullName}
                        onChange={(value) => setFieldValue('fullName', value)}
                      >
                        <Label>Họ và tên</Label>
                        <Input className={inputClassName} />
                        {errors.fullName ? (
                          <FieldError>{errors.fullName}</FieldError>
                        ) : null}
                      </TextField>
                    </div>
                  </section>

                  <section>
                    <h3 className="border-s-2 border-[var(--um-primary)] ps-2 text-base font-semibold text-[var(--um-ink)]">
                      Thông tin liên hệ
                    </h3>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <TextField
                        isRequired
                        isInvalid={Boolean(errors.email)}
                        type="email"
                        value={values.email}
                        onChange={(value) => setFieldValue('email', value)}
                      >
                        <Label>Email cá nhân</Label>
                        <Input className={inputClassName} />
                        {errors.email ? (
                          <FieldError>{errors.email}</FieldError>
                        ) : null}
                      </TextField>
                      <TextField
                        isRequired
                        isInvalid={Boolean(errors.phoneNumber)}
                        type="tel"
                        value={values.phoneNumber}
                        onChange={(value) =>
                          setFieldValue('phoneNumber', value)
                        }
                      >
                        <Label>Số điện thoại</Label>
                        <Input className={inputClassName} />
                        {errors.phoneNumber ? (
                          <FieldError>{errors.phoneNumber}</FieldError>
                        ) : null}
                      </TextField>
                    </div>
                  </section>

                  <section>
                    <h3 className="border-s-2 border-[var(--um-primary)] ps-2 text-base font-semibold text-[var(--um-ink)]">
                      Thông tin tài khoản
                    </h3>
                    <div className="mt-4 grid gap-4 rounded-lg bg-[var(--um-page)] p-4 sm:grid-cols-2">
                      <div>
                        <p className="text-sm text-neutral-600">Vai trò</p>
                        <Chip
                          className="mt-2 bg-[var(--um-primary-soft)] text-[var(--um-primary-strong)]"
                          size="sm"
                        >
                          Nhân viên vận hành
                        </Chip>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-600">
                          Trạng thái ban đầu
                        </p>
                        <Chip
                          className="mt-2"
                          color="success"
                          size="sm"
                          variant="soft"
                        >
                          Hoạt động
                        </Chip>
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="border-s-2 border-[var(--um-primary)] ps-2 text-base font-semibold text-[var(--um-ink)]">
                        Phân công tủ
                      </h3>
                      <span className="text-sm font-medium text-[var(--um-primary-strong)]">
                        Đã chọn: {selectedLockerIds.length} tủ
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">
                      Bạn có thể tạo nhân viên mà không cần phân công tủ.
                    </p>
                    {isLoadingLockers ? (
                      <div className="mt-4 flex items-center gap-2 text-sm text-neutral-600">
                        <Spinner
                          aria-label="Đang tải danh sách Locker"
                          size="sm"
                        />
                        Đang tải danh sách Locker...
                      </div>
                    ) : null}
                    {lockerError ? (
                      <Alert className="mt-4" status="danger">
                        <Alert.Indicator>
                          <TriangleExclamation
                            aria-hidden="true"
                            className="size-5"
                          />
                        </Alert.Indicator>
                        <Alert.Content>
                          <Alert.Title>
                            Không thể tải danh sách Locker
                          </Alert.Title>
                          <Alert.Description>{lockerError}</Alert.Description>
                          <Button
                            className="mt-3"
                            variant="outline"
                            onPress={loadAvailableLockers}
                          >
                            <ArrowsRotateRight
                              aria-hidden="true"
                              className="size-4"
                            />
                            Thử lại
                          </Button>
                        </Alert.Content>
                      </Alert>
                    ) : null}
                    {!isLoadingLockers && !lockerError ? (
                      availableLockers.length ? (
                        <>
                          <SearchField
                            aria-label="Tìm Locker khả dụng"
                            className="mt-4"
                            value={lockerSearch}
                            onChange={setLockerSearch}
                          >
                            <SearchField.Group className="min-h-11 rounded-lg border border-[var(--um-border)] bg-[var(--um-surface)] shadow-none [--field-background:var(--um-surface)] [--field-border-focus:var(--um-focus)] [--field-border-hover:var(--um-border)] [--field-border:var(--um-border)] [--field-focus:var(--um-surface)] [--field-hover:var(--um-surface)] focus-within:border-[var(--um-focus)]">
                              <Magnifier
                                aria-hidden="true"
                                className="ml-3 size-5 shrink-0 text-neutral-500"
                              />
                              <SearchField.Input placeholder="Tìm theo mã tủ, tòa nhà hoặc vị trí..." />
                              {lockerSearch ? (
                                <SearchField.ClearButton aria-label="Xóa tìm kiếm Locker" />
                              ) : null}
                            </SearchField.Group>
                          </SearchField>
                          {selectedLockerIds.length ? (
                            <Button
                              className="mt-3 h-auto min-h-0 px-0 text-sm font-medium text-[var(--um-primary)] shadow-none"
                              variant="ghost"
                              onPress={() => setSelectedLockerIds([])}
                            >
                              Bỏ chọn tất cả
                            </Button>
                          ) : null}
                          {filteredAvailableLockers.length ? (
                            <CheckboxGroup
                              aria-label="Locker được phân công ban đầu"
                              className="mt-3 grid max-h-80 gap-3 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2"
                              value={selectedLockerIds}
                              onChange={setSelectedLockerIds}
                            >
                              {filteredAvailableLockers.map((locker) => (
                                <LockerOption key={locker.id} locker={locker} />
                              ))}
                            </CheckboxGroup>
                          ) : (
                            <div className="mt-4 rounded-lg border border-[var(--um-border)] bg-[var(--um-surface)] px-4 py-3 text-sm text-neutral-600">
                              <p className="font-medium text-[var(--um-ink)]">
                                Không tìm thấy tủ phù hợp.
                              </p>
                              <Button
                                className="mt-2 h-auto min-h-0 px-0 text-sm font-medium text-[var(--um-primary)] shadow-none"
                                variant="ghost"
                                onPress={() => setLockerSearch('')}
                              >
                                Xóa tìm kiếm
                              </Button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="mt-4 rounded-lg border border-[var(--um-border)] bg-[var(--um-surface)] px-4 py-3 text-sm text-neutral-600">
                          <p className="font-medium text-[var(--um-ink)]">
                            Hiện không có tủ khả dụng.
                          </p>
                          <p className="mt-1">
                            Bạn vẫn có thể tạo nhân viên và phân công tủ sau.
                          </p>
                        </div>
                      )
                    ) : null}
                    {errors.lockerIds ? (
                      <p className="mt-2 text-sm text-red-600">
                        {errors.lockerIds}
                      </p>
                    ) : null}
                  </section>

                  {errors.form ? (
                    <Alert status="danger">
                      <Alert.Indicator>
                        <TriangleExclamation
                          aria-hidden="true"
                          className="size-5"
                        />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>
                          Không thể thêm nhân viên vận hành
                        </Alert.Title>
                        <Alert.Description>{errors.form}</Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : null}
                </div>
              </Modal.Body>
              <Modal.Footer className="shrink-0 border-t border-[var(--um-border)] bg-[var(--um-surface)] px-5 py-3 sm:px-6">
                <Button
                  className="min-h-12 rounded-full border-[var(--um-border)] px-5 font-medium shadow-none"
                  isDisabled={isSubmitting || isReadingAvatar}
                  style={secondaryCancelButtonStyle}
                  variant="outline"
                  onPress={closeForm}
                >
                  Hủy
                </Button>
                <Button
                  className="min-h-12 rounded-full px-6 font-semibold shadow-none focus-visible:ring-2 focus-visible:ring-[var(--um-focus)] focus-visible:ring-offset-2"
                  isDisabled={
                    isSubmitting ||
                    isReadingAvatar ||
                    isLoadingLockers ||
                    Boolean(lockerError)
                  }
                  style={primarySubmitButtonStyle}
                  type="submit"
                  variant="primary"
                >
                  {isSubmitting ? (
                    <Spinner
                      aria-label="Đang thêm nhân viên"
                      color="current"
                      size="sm"
                    />
                  ) : (
                    <CirclePlus aria-hidden="true" className="size-4" />
                  )}
                  {isSubmitting ? 'Đang thêm...' : 'Thêm nhân viên'}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
