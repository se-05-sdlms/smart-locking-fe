import type { FormEvent } from 'react';
import type { Selection } from '@heroui/react';
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
  EmptyState,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  Pagination,
  SearchField,
  Spinner,
  Table,
  TextField,
  Typography,
} from '@heroui/react';

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
const lockersPerPage = 5;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?\d{9,15}$/;

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
  const [lockerPage, setLockerPage] = useState(1);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isReadingAvatar, setIsReadingAvatar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lockerRequestIdRef = useRef(0);
  const avatarRequestIdRef = useRef(0);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    avatarRequestIdRef.current += 1;
    setValues(emptyForm);
    setErrors({});
    setSelectedLockerIds([]);
    setLockerSearch('');
    setLockerPage(1);
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
    setLockerPage(1);

    void service
      .getAvailableLockers()
      .then((result) => {
        if (!isActive || requestId !== lockerRequestIdRef.current) return;
        if (!result.success) {
          setAvailableLockers([]);
          setSelectedLockerIds([]);
          setLockerError(result.error.message);

          return;
        }

        const unassignedLockers = result.data.filter(
          (locker) => locker.assignedOperatorId === null,
        );

        setAvailableLockers(unassignedLockers);
        setSelectedLockerIds((ids) =>
          ids.filter((id) =>
            unassignedLockers.some((locker) => locker.id === id),
          ),
        );
      })
      .catch(() => {
        if (!isActive || requestId !== lockerRequestIdRef.current) return;
        setAvailableLockers([]);
        setSelectedLockerIds([]);
        setLockerError('Không thể tải danh sách tủ trống.');
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

    const address = `${locker.buildingName} ${locker.locationLabel}`;

    return [locker.code, address].some((value) =>
      value.toLocaleLowerCase('vi-VN').includes(normalizedLockerSearch),
    );
  });
  const totalLockerPages = Math.max(
    1,
    Math.ceil(filteredAvailableLockers.length / lockersPerPage),
  );
  const paginatedLockers = filteredAvailableLockers.slice(
    (lockerPage - 1) * lockersPerPage,
    lockerPage * lockersPerPage,
  );
  const visibleLockerIds = new Set(paginatedLockers.map((locker) => locker.id));
  const visibleSelectedLockerIds = new Set(
    selectedLockerIds.filter((id) => visibleLockerIds.has(id)),
  );
  const selectedLockerCodes = availableLockers
    .filter((locker) => selectedLockerIds.includes(locker.id))
    .map((locker) => locker.code);

  const handleLockerSelectionChange = (keys: Selection) => {
    setSelectedLockerIds((current) => {
      const hiddenSelections = current.filter(
        (id) => !visibleLockerIds.has(id),
      );
      const visibleSelections =
        keys === 'all'
          ? [...visibleLockerIds]
          : [...keys].map((key) => String(key));

      return [...hiddenSelections, ...visibleSelections];
    });
    setErrors((current) => ({ ...current, lockerIds: undefined }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeForm();
      }}
    >
      <Modal.Backdrop isDismissable={!isSubmitting && !isReadingAvatar}>
        <Modal.Container scroll="inside" size="lg">
          <Modal.Dialog className="max-w-6xl">
            <Modal.Header>
              <Modal.Heading>Thêm nhân viên vận hành</Modal.Heading>
              <Modal.CloseTrigger
                aria-label="Đóng biểu mẫu"
                isDisabled={isSubmitting || isReadingAvatar}
              />
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
              <Modal.Body>
                <>
                  <div className="grid items-start gap-8 lg:grid-cols-[21rem_minmax(0,1fr)]">
                    <section className="space-y-5">
                      <Typography type="h5">Thông tin nhân viên</Typography>

                      <div>
                        <Button
                          isIconOnly
                          aria-label="Chọn ảnh đại diện"
                          className="size-fit rounded-full p-0"
                          isDisabled={isSubmitting || isReadingAvatar}
                          variant="ghost"
                          onPress={() => avatarInputRef.current?.click()}
                        >
                          {isReadingAvatar ? (
                            <Spinner aria-label="Đang đọc ảnh" size="sm" />
                          ) : (
                            <Avatar size="lg">
                              {avatarUrl ? (
                                <Avatar.Image
                                  alt="Ảnh nhân viên"
                                  src={avatarUrl}
                                />
                              ) : null}
                              <Avatar.Fallback>
                                {getInitials(values.fullName)}
                              </Avatar.Fallback>
                            </Avatar>
                          )}
                        </Button>
                        <input
                          ref={avatarInputRef}
                          accept="image/jpeg,image/png,image/webp"
                          aria-label="Chọn ảnh đại diện"
                          className="sr-only"
                          disabled={isSubmitting}
                          type="file"
                          onChange={(event) =>
                            handleAvatarChange(event.target.files?.[0] ?? null)
                          }
                        />
                      </div>
                      {avatarError ? (
                        <FieldError>{avatarError}</FieldError>
                      ) : null}

                      <TextField
                        isRequired
                        isInvalid={Boolean(errors.fullName)}
                        value={values.fullName}
                        onChange={(value) => setFieldValue('fullName', value)}
                      >
                        <Label>Họ và tên</Label>
                        <Input fullWidth variant="primary" />
                        {errors.fullName ? (
                          <FieldError>{errors.fullName}</FieldError>
                        ) : null}
                      </TextField>

                      <TextField
                        isRequired
                        isInvalid={Boolean(errors.email)}
                        type="email"
                        value={values.email}
                        onChange={(value) => setFieldValue('email', value)}
                      >
                        <Label>Email</Label>
                        <Input fullWidth variant="primary" />
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
                        <Input fullWidth variant="primary" />
                        {errors.phoneNumber ? (
                          <FieldError>{errors.phoneNumber}</FieldError>
                        ) : null}
                      </TextField>
                    </section>

                    <section className="min-w-0 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Typography type="h5">Phân công tủ</Typography>
                        <SearchField
                          aria-label="Tìm tủ trống"
                          className="w-full sm:w-72"
                          value={lockerSearch}
                          variant="primary"
                          onChange={(value) => {
                            setLockerSearch(value);
                            setLockerPage(1);
                          }}
                        >
                          <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder="Mã tủ hoặc địa chỉ" />
                            {lockerSearch ? (
                              <SearchField.ClearButton aria-label="Xóa tìm kiếm tủ" />
                            ) : null}
                          </SearchField.Group>
                        </SearchField>
                      </div>

                      {isLoadingLockers ? (
                        <div className="flex min-h-48 items-center justify-center">
                          <Spinner aria-label="Đang tải danh sách tủ" />
                        </div>
                      ) : null}

                      {lockerError ? (
                        <Alert status="danger">
                          <Alert.Indicator />
                          <Alert.Content>
                            <Alert.Description>{lockerError}</Alert.Description>
                            <Button
                              className="mt-2"
                              size="sm"
                              variant="outline"
                              onPress={loadAvailableLockers}
                            >
                              Thử lại
                            </Button>
                          </Alert.Content>
                        </Alert>
                      ) : null}
                      {!isLoadingLockers && !lockerError ? (
                        availableLockers.length ? (
                          filteredAvailableLockers.length ? (
                            <Table>
                              <Table.ScrollContainer className="w-full overflow-x-auto">
                                <Table.Content
                                  aria-label="Danh sách tủ trống"
                                  selectedKeys={visibleSelectedLockerIds}
                                  selectionMode="multiple"
                                  onSelectionChange={
                                    handleLockerSelectionChange
                                  }
                                >
                                  <Table.Header>
                                    <Table.Column
                                      className="w-12"
                                      id="selection"
                                      textValue="Chọn"
                                    >
                                      <Checkbox
                                        aria-label="Chọn tất cả tủ"
                                        slot="selection"
                                      >
                                        <Checkbox.Content>
                                          <Checkbox.Control>
                                            <Checkbox.Indicator />
                                          </Checkbox.Control>
                                        </Checkbox.Content>
                                      </Checkbox>
                                    </Table.Column>
                                    <Table.Column
                                      className="w-32"
                                      id="code"
                                      isRowHeader
                                    >
                                      Mã tủ
                                    </Table.Column>
                                    <Table.Column id="address">
                                      Địa chỉ
                                    </Table.Column>
                                  </Table.Header>
                                  <Table.Body>
                                    {paginatedLockers.map((locker) => (
                                      <Table.Row key={locker.id} id={locker.id}>
                                        <Table.Cell>
                                          <Checkbox
                                            aria-label={`Chọn tủ ${locker.code}`}
                                            slot="selection"
                                          >
                                            <Checkbox.Content>
                                              <Checkbox.Control>
                                                <Checkbox.Indicator />
                                              </Checkbox.Control>
                                            </Checkbox.Content>
                                          </Checkbox>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <span className="font-mono font-semibold">
                                            {locker.code}
                                          </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <span className="block font-medium">
                                            {locker.buildingName}
                                          </span>
                                          <span className="block text-sm text-muted">
                                            {locker.locationLabel}
                                          </span>
                                        </Table.Cell>
                                      </Table.Row>
                                    ))}
                                  </Table.Body>
                                </Table.Content>
                              </Table.ScrollContainer>
                              <Table.Footer className="flex flex-col gap-3 px-4 py-3">
                                <Typography className="text-sm text-muted">
                                  Đã chọn:{' '}
                                  <span className="font-medium text-foreground">
                                    {selectedLockerCodes.join(', ') || '—'}
                                  </span>
                                </Typography>
                                {totalLockerPages > 1 ? (
                                  <Pagination
                                    className="flex items-center justify-between"
                                    size="sm"
                                  >
                                    <Pagination.Summary>
                                      Trang {lockerPage}/{totalLockerPages}
                                    </Pagination.Summary>
                                    <Pagination.Content>
                                      <Pagination.Item>
                                        <Pagination.Previous
                                          aria-label="Trang tủ trước"
                                          isDisabled={lockerPage === 1}
                                          onPress={() =>
                                            setLockerPage((page) => page - 1)
                                          }
                                        >
                                          <Pagination.PreviousIcon />
                                        </Pagination.Previous>
                                      </Pagination.Item>
                                      <Pagination.Item>
                                        <Pagination.Link isActive>
                                          {lockerPage}
                                        </Pagination.Link>
                                      </Pagination.Item>
                                      <Pagination.Item>
                                        <Pagination.Next
                                          aria-label="Trang tủ sau"
                                          isDisabled={
                                            lockerPage === totalLockerPages
                                          }
                                          onPress={() =>
                                            setLockerPage((page) => page + 1)
                                          }
                                        >
                                          <Pagination.NextIcon />
                                        </Pagination.Next>
                                      </Pagination.Item>
                                    </Pagination.Content>
                                  </Pagination>
                                ) : null}
                              </Table.Footer>
                            </Table>
                          ) : (
                            <EmptyState className="min-h-48 py-8 text-center text-muted">
                              Không tìm thấy tủ.
                            </EmptyState>
                          )
                        ) : (
                          <EmptyState className="min-h-48 py-8 text-center text-muted">
                            Chưa có tủ trống.
                          </EmptyState>
                        )
                      ) : null}
                      {errors.lockerIds ? (
                        <FieldError className="mt-2">
                          {errors.lockerIds}
                        </FieldError>
                      ) : null}
                    </section>
                  </div>

                  {errors.form ? (
                    <Alert status="danger">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>
                          Không thể thêm nhân viên vận hành
                        </Alert.Title>
                        <Alert.Description>{errors.form}</Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : null}
                </>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  isDisabled={isSubmitting || isReadingAvatar}
                  variant="danger"
                  onPress={closeForm}
                >
                  Hủy
                </Button>
                <Button
                  isDisabled={isSubmitting || isReadingAvatar}
                  type="submit"
                  variant="primary"
                >
                  {isSubmitting ? (
                    <Spinner
                      aria-label="Đang thêm nhân viên"
                      color="current"
                      size="sm"
                    />
                  ) : null}
                  {isSubmitting ? 'Đang thêm...' : 'Thêm nhân viên'}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
