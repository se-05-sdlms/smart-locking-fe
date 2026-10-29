import type {
  AdminCompartment,
  AdminLockerDetail,
  CompartmentFormErrors,
  CompartmentFormValues,
} from '@/types/admin-locker';

import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  AlertDialog,
  Button,
  Chip,
  Drawer,
  FieldError,
  Form,
  Input,
  Label,
  Separator,
  Skeleton,
  TextField,
  Typography,
  toast,
} from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import CirclePlus from '@gravity-ui/icons/CirclePlus';
import Pencil from '@gravity-ui/icons/Pencil';
import TrashBin from '@gravity-ui/icons/TrashBin';
import Xmark from '@gravity-ui/icons/Xmark';

import {
  ADMIN_CONNECTION_STATUS_DISPLAY,
  ADMIN_DOOR_STATUS_LABELS,
  ADMIN_OPERATIONAL_STATUS_DISPLAY,
  LOCKER_FIELD_LIMITS,
} from '@/constants/admin-locker';
import { CompartmentEditModal } from '@/components/admin/lockers/compartment-edit-modal';
import { LockerCommissioningModal } from '@/components/admin/lockers/locker-commissioning-modal';
import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  createCompartment,
  getCompartmentStatusTarget,
  setCompartmentStatus,
  deactivateLocker,
  getAdminLockerDetail,
  getAdminLockerErrorMessage,
  validateCompartmentForm,
} from '@/services/admin-locker-service';

const EMPTY_COMPARTMENT: CompartmentFormValues = {
  code: '',
  hardwareCode: '',
  hardwareChannel: '',
};

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function formatDateTime(value: string | null) {
  if (!value) return 'Chưa từng kết nối';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Chưa từng kết nối'
    : dateTimeFormatter.format(date);
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{children}</dd>
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert role="alert" status="danger">
      <Alert.Indicator>
        <CircleExclamation aria-hidden="true" className="size-5" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

type LockerDetailDrawerProps = {
  lockerId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onEdit: (locker: AdminLockerDetail) => void;
  /** Called after any change so the list can refresh. */
  onChanged: () => void;
};

export function LockerDetailDrawer({
  lockerId,
  isOpen,
  onOpenChange,
  onEdit,
  onChanged,
}: LockerDetailDrawerProps) {
  const load = useCallback(
    (signal: AbortSignal) => getAdminLockerDetail(lockerId, signal),
    [lockerId],
  );
  const { state, reload, refresh } = useAsyncResource(
    load,
    getAdminLockerErrorMessage,
    [lockerId],
  );
  const locker = state.data;

  const [compartment, setCompartment] =
    useState<CompartmentFormValues>(EMPTY_COMPARTMENT);
  const [compartmentErrors, setCompartmentErrors] =
    useState<CompartmentFormErrors>({});
  const [compartmentError, setCompartmentError] = useState('');
  const [isAddingCompartment, setIsAddingCompartment] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCommissioningOpen, setIsCommissioningOpen] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const pending = useRef(false);
  const [editing, setEditing] = useState<AdminCompartment | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminCompartment | null>(
    null,
  );
  const [statusError, setStatusError] = useState('');
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const changeCompartmentStatus = async (item: AdminCompartment) => {
    if (!locker || pending.current) return;

    const target = getCompartmentStatusTarget(item.operationalStatus);

    pending.current = true;
    setIsChangingStatus(true);
    setStatusError('');

    try {
      await setCompartmentStatus(locker.id, item.id, target);
      toast.success(
        target === 'Inactive'
          ? 'Đã ngừng hoạt động ngăn'
          : 'Đã kích hoạt lại ngăn',
        {
          description: `Ngăn ${item.code} · tủ ${locker.code}`,
          indicator: <CircleCheck aria-hidden="true" className="size-5" />,
        },
      );
      setStatusTarget(null);
      refresh();
      onChanged();
    } catch (error) {
      setStatusError(getAdminLockerErrorMessage(error));
    } finally {
      pending.current = false;
      setIsChangingStatus(false);
    }
  };

  const isInactive = locker?.operationalStatus === 'Inactive';

  const updateCompartment = (patch: Partial<CompartmentFormValues>) => {
    const next = { ...compartment, ...patch };

    setCompartment(next);
    if (Object.keys(compartmentErrors).length) {
      setCompartmentErrors(validateCompartmentForm(next));
    }
  };

  const addCompartment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateCompartmentForm(compartment);

    setCompartmentErrors(errors);
    if (!locker || Object.keys(errors).length || pending.current) return;

    pending.current = true;
    setIsAddingCompartment(true);
    setCompartmentError('');

    try {
      const created = await createCompartment(locker.id, compartment);

      toast.success('Đã thêm ngăn', {
        description: `Ngăn ${created.code} · tủ ${locker.code}`,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      setCompartment(EMPTY_COMPARTMENT);
      refresh();
      onChanged();
    } catch (error) {
      setCompartmentError(getAdminLockerErrorMessage(error));
    } finally {
      pending.current = false;
      setIsAddingCompartment(false);
    }
  };

  const confirmDeactivate = async () => {
    if (!locker || pending.current) return;

    pending.current = true;
    setIsDeactivating(true);
    setDeactivateError('');

    try {
      await deactivateLocker(locker.id);
      toast.success('Đã vô hiệu hóa tủ', {
        description: `${locker.code} ngừng nhận giao dịch mới; lịch sử được giữ nguyên.`,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      setIsConfirmOpen(false);
      refresh();
      onChanged();
    } catch (error) {
      setDeactivateError(getAdminLockerErrorMessage(error));
    } finally {
      pending.current = false;
      setIsDeactivating(false);
    }
  };

  return (
    <>
      <Drawer isOpen={isOpen} onOpenChange={onOpenChange}>
        <Drawer.Backdrop>
          <Drawer.Content placement="right">
            <Drawer.Dialog className="w-full sm:w-[32rem]">
              <Drawer.CloseTrigger aria-label="Đóng chi tiết tủ">
                <Xmark aria-hidden="true" className="size-5" />
              </Drawer.CloseTrigger>
              <Drawer.Header>
                <Drawer.Heading>
                  {locker ? `Tủ ${locker.code}` : 'Chi tiết tủ'}
                </Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body>
                {state.status === 'loading' && !locker ? (
                  <div
                    aria-busy="true"
                    aria-label="Đang tải chi tiết tủ"
                    className="space-y-3"
                  >
                    <Skeleton className="h-6 w-1/2 rounded-lg" />
                    <Skeleton className="h-40 w-full rounded-xl" />
                    <Skeleton className="h-32 w-full rounded-xl" />
                  </div>
                ) : null}

                {state.status === 'error' && !locker ? (
                  <div className="space-y-3">
                    <ErrorAlert message={state.message} />
                    <Button size="sm" variant="secondary" onPress={reload}>
                      <ArrowRotateRight aria-hidden="true" className="size-4" />
                      Thử lại
                    </Button>
                  </div>
                ) : null}

                {locker ? (
                  <div className="space-y-6">
                    <div className="flex flex-wrap gap-2">
                      <Chip
                        color={
                          ADMIN_OPERATIONAL_STATUS_DISPLAY[
                            locker.operationalStatus
                          ].color
                        }
                        size="sm"
                        variant="soft"
                      >
                        {
                          ADMIN_OPERATIONAL_STATUS_DISPLAY[
                            locker.operationalStatus
                          ].label
                        }
                      </Chip>
                      <Chip
                        color={
                          ADMIN_CONNECTION_STATUS_DISPLAY[
                            locker.connectionStatus
                          ].color
                        }
                        size="sm"
                        variant="soft"
                      >
                        {
                          ADMIN_CONNECTION_STATUS_DISPLAY[
                            locker.connectionStatus
                          ].label
                        }
                      </Chip>
                    </div>

                    <section>
                      <Typography className="mb-1" type="h6">
                        Cấu hình
                      </Typography>
                      <dl>
                        <DetailRow label="Mã tủ">{locker.code}</DetailRow>
                        <DetailRow label="Mã thiết bị">
                          {locker.deviceIdentifier}
                        </DetailRow>
                        <DetailRow label="Địa chỉ đặt tủ">
                          {locker.address}
                        </DetailRow>
                        <DetailRow label="Địa chỉ tập kết">
                          {locker.recoveryAddress}
                        </DetailRow>
                      </dl>
                    </section>

                    <section>
                      <Typography className="mb-1" type="h6">
                        Trạng thái thiết bị báo về
                      </Typography>
                      <dl>
                        <DetailRow label="Kết nối">
                          {
                            ADMIN_CONNECTION_STATUS_DISPLAY[
                              locker.connectionStatus
                            ].label
                          }
                        </DetailRow>
                        <DetailRow label="Lần cuối kết nối">
                          {formatDateTime(locker.lastSeenAt)}
                        </DetailRow>
                      </dl>
                    </section>

                    <Separator />

                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Typography type="h6">Ngăn tủ</Typography>
                        <span className="text-sm text-muted">
                          {locker.activeCompartments}/{locker.totalCompartments}{' '}
                          đang vận hành
                        </span>
                      </div>

                      {locker.compartments.length ? (
                        <ul
                          aria-label="Danh sách ngăn"
                          className="divide-y divide-border"
                        >
                          {locker.compartments.map((item) => (
                            <li
                              key={item.id}
                              className="flex flex-wrap items-center justify-between gap-2 py-2"
                            >
                              <span className="text-sm">
                                <strong>{item.code}</strong>
                                <span className="text-muted">
                                  {' '}
                                  · {item.hardwareCode} · kênh{' '}
                                  {item.hardwareChannel}
                                </span>
                              </span>
                              <span className="flex gap-2">
                                <Chip
                                  color={
                                    ADMIN_OPERATIONAL_STATUS_DISPLAY[
                                      item.operationalStatus
                                    ].color
                                  }
                                  size="sm"
                                  variant="soft"
                                >
                                  {
                                    ADMIN_OPERATIONAL_STATUS_DISPLAY[
                                      item.operationalStatus
                                    ].label
                                  }
                                </Chip>
                                <Chip size="sm" variant="soft">
                                  {ADMIN_DOOR_STATUS_LABELS[item.doorStatus]}
                                </Chip>
                                {isInactive ? null : (
                                  <>
                                    <Button
                                      aria-label={`Sửa ngăn ${item.code}`}
                                      isDisabled={isChangingStatus}
                                      size="sm"
                                      variant="ghost"
                                      onPress={() => setEditing(item)}
                                    >
                                      <Pencil
                                        aria-hidden="true"
                                        className="size-4"
                                      />
                                      Sửa
                                    </Button>
                                    <Button
                                      aria-label={
                                        item.operationalStatus === 'Inactive'
                                          ? `Kích hoạt lại ngăn ${item.code}`
                                          : `Ngừng hoạt động ngăn ${item.code}`
                                      }
                                      isDisabled={isChangingStatus}
                                      size="sm"
                                      variant={
                                        item.operationalStatus === 'Inactive'
                                          ? 'secondary'
                                          : 'danger-soft'
                                      }
                                      onPress={() => {
                                        setStatusError('');
                                        if (
                                          item.operationalStatus === 'Inactive'
                                        ) {
                                          void changeCompartmentStatus(item);
                                        } else {
                                          setStatusTarget(item);
                                        }
                                      }}
                                    >
                                      {item.operationalStatus === 'Inactive'
                                        ? 'Kích hoạt lại'
                                        : 'Ngừng hoạt động'}
                                    </Button>
                                  </>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted">
                          Tủ chưa có ngăn nào.
                        </p>
                      )}

                      {statusError && !statusTarget ? (
                        <Alert role="alert" status="danger">
                          <Alert.Indicator>
                            <CircleExclamation aria-hidden="true" />
                          </Alert.Indicator>
                          <Alert.Content>
                            <Alert.Description>{statusError}</Alert.Description>
                          </Alert.Content>
                        </Alert>
                      ) : null}

                      {isInactive ? (
                        <p className="text-sm text-muted">
                          Tủ đã bị vô hiệu hóa nên không thể thêm ngăn.
                        </p>
                      ) : (
                        <Form
                          className="space-y-3 rounded-xl border border-border p-3"
                          validationBehavior="aria"
                          onSubmit={addCompartment}
                        >
                          <span className="text-sm font-semibold">
                            Thêm ngăn
                          </span>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <TextField
                              fullWidth
                              isRequired
                              isDisabled={isAddingCompartment}
                              isInvalid={Boolean(compartmentErrors.code)}
                              maxLength={LOCKER_FIELD_LIMITS.compartmentCode}
                              value={compartment.code}
                              onChange={(code) => updateCompartment({ code })}
                            >
                              <Label>Mã ngăn</Label>
                              <Input placeholder="A01" variant="secondary" />
                              <FieldError>{compartmentErrors.code}</FieldError>
                            </TextField>
                            <TextField
                              fullWidth
                              isRequired
                              isDisabled={isAddingCompartment}
                              isInvalid={Boolean(
                                compartmentErrors.hardwareCode,
                              )}
                              maxLength={LOCKER_FIELD_LIMITS.hardwareCode}
                              value={compartment.hardwareCode}
                              onChange={(hardwareCode) =>
                                updateCompartment({ hardwareCode })
                              }
                            >
                              <Label>Mã phần cứng</Label>
                              <Input placeholder="CH01" variant="secondary" />
                              <FieldError>
                                {compartmentErrors.hardwareCode}
                              </FieldError>
                            </TextField>
                            <TextField
                              fullWidth
                              isRequired
                              inputMode="numeric"
                              isDisabled={isAddingCompartment}
                              isInvalid={Boolean(
                                compartmentErrors.hardwareChannel,
                              )}
                              value={compartment.hardwareChannel}
                              onChange={(hardwareChannel) =>
                                updateCompartment({ hardwareChannel })
                              }
                            >
                              <Label>Kênh</Label>
                              <Input placeholder="1" variant="secondary" />
                              <FieldError>
                                {compartmentErrors.hardwareChannel}
                              </FieldError>
                            </TextField>
                          </div>
                          {compartmentError ? (
                            <ErrorAlert message={compartmentError} />
                          ) : null}
                          <Button
                            isDisabled={isAddingCompartment}
                            size="sm"
                            type="submit"
                            variant="secondary"
                          >
                            <CirclePlus aria-hidden="true" className="size-4" />
                            {isAddingCompartment ? 'Đang thêm...' : 'Thêm ngăn'}
                          </Button>
                        </Form>
                      )}
                    </section>
                  </div>
                ) : null}
              </Drawer.Body>
              {locker ? (
                <Drawer.Footer>
                  <Button
                    isDisabled={isInactive}
                    variant="danger-soft"
                    onPress={() => {
                      setDeactivateError('');
                      setIsConfirmOpen(true);
                    }}
                  >
                    <TrashBin aria-hidden="true" className="size-4" />
                    Vô hiệu hóa
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={() => setIsCommissioningOpen(true)}
                  >
                    Quy trình bàn giao
                  </Button>
                  <Button variant="primary" onPress={() => onEdit(locker)}>
                    <Pencil aria-hidden="true" className="size-4" />
                    Chỉnh sửa
                  </Button>
                </Drawer.Footer>
              ) : null}
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

      <AlertDialog>
        <AlertDialog.Backdrop
          isDismissable={!isDeactivating}
          isOpen={isConfirmOpen}
          onOpenChange={(open) => !isDeactivating && setIsConfirmOpen(open)}
        >
          <AlertDialog.Container size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger">
                  <CircleExclamation aria-hidden="true" className="size-6" />
                </AlertDialog.Icon>
                <AlertDialog.Heading>
                  Vô hiệu hóa tủ {locker?.code}?
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="space-y-3">
                <p className="text-sm">
                  Tủ chuyển sang trạng thái Đã vô hiệu hóa, ngừng nhận giao dịch
                  mới và không thể thêm ngăn. Dữ liệu và lịch sử của tủ được giữ
                  nguyên; có thể kích hoạt lại bằng cách chỉnh sửa trạng thái
                  vận hành.
                </p>
                {deactivateError ? (
                  <ErrorAlert message={deactivateError} />
                ) : null}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  isDisabled={isDeactivating}
                  variant="ghost"
                  onPress={() => setIsConfirmOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  isDisabled={isDeactivating}
                  variant="danger"
                  onPress={() => void confirmDeactivate()}
                >
                  {isDeactivating ? 'Đang xử lý...' : 'Vô hiệu hóa'}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

      {isCommissioningOpen && locker ? (
        <LockerCommissioningModal
          lockerCode={locker.code}
          lockerId={locker.id}
          onChanged={() => {
            refresh();
            onChanged();
          }}
          onClose={() => setIsCommissioningOpen(false)}
        />
      ) : null}

      {editing && locker ? (
        <CompartmentEditModal
          key={editing.id}
          compartment={editing}
          lockerCode={locker.code}
          lockerId={locker.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            onChanged();
          }}
        />
      ) : null}

      <AlertDialog>
        <AlertDialog.Backdrop
          isDismissable={!isChangingStatus}
          isOpen={statusTarget !== null}
          onOpenChange={(open) =>
            !open && !isChangingStatus && setStatusTarget(null)
          }
        >
          <AlertDialog.Container size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger">
                  <CircleExclamation aria-hidden="true" className="size-6" />
                </AlertDialog.Icon>
                <AlertDialog.Heading>
                  Ngừng hoạt động ngăn {statusTarget?.code}?
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="space-y-3">
                <p className="text-sm">
                  Ngăn sẽ không được cấp cho lượt gửi hàng mới. Hệ thống từ chối
                  nếu ngăn còn bưu kiện, hàng trả hoặc lượt giữ chỗ.
                </p>
                {statusError ? (
                  <Alert role="alert" status="danger">
                    <Alert.Indicator>
                      <CircleExclamation aria-hidden="true" />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Description>{statusError}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                ) : null}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  isDisabled={isChangingStatus}
                  variant="ghost"
                  onPress={() => setStatusTarget(null)}
                >
                  Hủy
                </Button>
                <Button
                  isDisabled={isChangingStatus}
                  variant="danger"
                  onPress={() =>
                    statusTarget && void changeCompartmentStatus(statusTarget)
                  }
                >
                  {isChangingStatus ? 'Đang lưu...' : 'Ngừng hoạt động'}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  );
}
