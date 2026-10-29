import type {
  PaymentKind,
  PaymentLookupFilters,
  PaymentRecord,
  PaymentStatus,
  ReconciliationCase,
  ReconciliationStatus,
  RespondStatus,
} from '@/services/payment-reconciliation-service';

import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Drawer,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  Skeleton,
  Table,
  Tabs,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import Xmark from '@gravity-ui/icons/Xmark';

import { useAuth } from '@/auth/auth-context';
import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  assignCase,
  caseActions,
  caseStatusLabels,
  emptyLookupFilters,
  eventActionLabel,
  formatAmount,
  formatDateTime,
  getCase,
  getPayment,
  getReconciliationErrorMessage,
  isCaseUncertain,
  listCases,
  lookupPayments,
  PAYMENT_PAGE_SIZE,
  paymentKindLabels,
  paymentStatusLabels,
  providerStatusLabel,
  respondCase,
  respondStatusLabels,
  RESPONSE_MAX_LENGTH,
  synchronizeCase,
  translateCaseMessage,
  validateLookupFilters,
  validateResponse,
} from '@/services/payment-reconciliation-service';
import { userManagementService } from '@/services/user-management-service';

type TabKey = 'payments' | 'cases';
type Option = { id: string; label: string };

const ALL = 'all';

const kindOptions: Option[] = [
  { id: ALL, label: 'Tất cả loại' },
  ...Object.entries(paymentKindLabels).map(([id, label]) => ({ id, label })),
];
const statusOptions: Option[] = [
  { id: ALL, label: 'Mọi trạng thái' },
  ...Object.entries(paymentStatusLabels).map(([id, label]) => ({ id, label })),
];

const paymentStatusColor: Record<
  PaymentStatus,
  'success' | 'warning' | 'default' | 'danger'
> = {
  Success: 'success',
  Pending: 'warning',
  Cancelled: 'default',
  Failed: 'danger',
};

const caseStatusColor: Record<
  ReconciliationStatus,
  'success' | 'warning' | 'default' | 'danger' | 'accent'
> = {
  Submitted: 'accent',
  InReview: 'warning',
  WaitingProvider: 'warning',
  Conflict: 'danger',
  Resolved: 'success',
  Closed: 'default',
};

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

function OptionSelect({
  label,
  options,
  value,
  onChange,
  className = 'w-full',
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Select
      className={className}
      value={value}
      variant="secondary"
      onChange={(key) => onChange(String(key))}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((item) => (
            <ListBox.Item key={item.id} id={item.id} textValue={item.label}>
              {item.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function Pager({
  page,
  totalCount,
  onPage,
}: {
  page: number;
  totalCount: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(totalCount / PAYMENT_PAGE_SIZE));

  return (
    <div className="flex items-center justify-end gap-2 text-sm text-muted">
      <span>
        Trang {page}/{pages} · {totalCount} mục
      </span>
      <Button
        isDisabled={page <= 1}
        size="sm"
        variant="secondary"
        onPress={() => onPage(page - 1)}
      >
        Trước
      </Button>
      <Button
        isDisabled={page >= pages}
        size="sm"
        variant="secondary"
        onPress={() => onPage(page + 1)}
      >
        Sau
      </Button>
    </div>
  );
}

function useResidentNames() {
  const { state } = useAsyncResource(
    async () => {
      const result = await userManagementService.getUsers({
        role: 'RESIDENT',
        search: '',
        status: 'ALL',
        sortDescriptor: { column: 'fullName', direction: 'ascending' },
        page: 1,
        pageSize: 10_000,
      });

      if (!result.success) throw new Error(result.error.message);

      return result.data.items;
    },
    () => 'Không tải được danh sách cư dân.',
    [],
  );
  const residents = state.data ?? [];
  const names = useMemo(
    () =>
      new Map(residents.map((user) => [user.id, user.fullName || user.email])),
    [residents],
  );

  return {
    residents,
    names,
    error: state.status === 'error' ? state.message : '',
  };
}

function PaymentsTab({
  names,
  residents,
}: {
  names: Map<string, string>;
  residents: Option[];
}) {
  const [draft, setDraft] = useState<PaymentLookupFilters>(emptyLookupFilters);
  const [filters, setFilters] =
    useState<PaymentLookupFilters>(emptyLookupFilters);
  const [filterError, setFilterError] = useState('');
  const { state, reload } = useAsyncResource(
    (signal) => lookupPayments(filters, signal),
    getReconciliationErrorMessage,
    [filters],
  );

  const update = (patch: Partial<PaymentLookupFilters>) =>
    setDraft({ ...draft, ...patch });
  const search = () => {
    const error = validateLookupFilters(draft);

    setFilterError(error);
    if (!error) setFilters({ ...draft, page: 1 });
  };
  const data = state.data;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Card.Content className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <TextField
            fullWidth
            value={draft.orderCode}
            onChange={(orderCode) => update({ orderCode })}
          >
            <Label>Mã đơn / mã giao dịch</Label>
            <Input placeholder="VD: 1730000000" variant="secondary" />
          </TextField>
          <OptionSelect
            label="Cư dân"
            options={[{ id: ALL, label: 'Tất cả cư dân' }, ...residents]}
            value={draft.residentUserId || ALL}
            onChange={(id) => update({ residentUserId: id === ALL ? '' : id })}
          />
          <OptionSelect
            label="Loại thanh toán"
            options={kindOptions}
            value={draft.kind || ALL}
            onChange={(id) =>
              update({ kind: id === ALL ? '' : (id as PaymentKind) })
            }
          />
          <OptionSelect
            label="Trạng thái nội bộ"
            options={statusOptions}
            value={draft.status || ALL}
            onChange={(id) =>
              update({ status: id === ALL ? '' : (id as PaymentStatus) })
            }
          />
          <TextField
            fullWidth
            type="date"
            value={draft.from}
            onChange={(from) => update({ from })}
          >
            <Label>Từ ngày</Label>
            <Input variant="secondary" />
          </TextField>
          <TextField
            fullWidth
            isInvalid={Boolean(filterError)}
            type="date"
            value={draft.to}
            onChange={(to) => update({ to })}
          >
            <Label>Đến ngày</Label>
            <Input variant="secondary" />
            <FieldError>{filterError}</FieldError>
          </TextField>
          <div className="flex gap-2 md:col-span-3 xl:col-span-6">
            <Button variant="primary" onPress={search}>
              Tra cứu
            </Button>
            <Button
              variant="secondary"
              onPress={() => {
                setDraft(emptyLookupFilters());
                setFilters(emptyLookupFilters());
                setFilterError('');
              }}
            >
              Xóa bộ lọc
            </Button>
          </div>
        </Card.Content>
      </Card>

      {state.status === 'error' ? (
        <ErrorAlert message={state.message} onRetry={reload} />
      ) : null}

      <Card>
        <Card.Content className="p-0">
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Giao dịch thanh toán">
                <Table.Header>
                  <Table.Column isRowHeader id="order">
                    Mã đơn
                  </Table.Column>
                  <Table.Column id="kind">Loại</Table.Column>
                  <Table.Column id="resident">Cư dân</Table.Column>
                  <Table.Column id="amount">Số tiền</Table.Column>
                  <Table.Column id="status">Trạng thái nội bộ</Table.Column>
                  <Table.Column id="gateway">Mã giao dịch cổng</Table.Column>
                  <Table.Column id="time">Tạo lúc / hoàn tất</Table.Column>
                </Table.Header>
                <Table.Body
                  renderEmptyState={() =>
                    state.status === 'loading' ? (
                      <Skeleton className="m-4 h-8 rounded-lg" />
                    ) : (
                      <p className="p-6 text-center text-muted">
                        Không có giao dịch phù hợp.
                      </p>
                    )
                  }
                >
                  {(data?.items ?? []).map((item: PaymentRecord) => (
                    <Table.Row
                      key={`${item.kind}-${item.id}`}
                      id={`${item.kind}-${item.id}`}
                    >
                      <Table.Cell>{item.orderCode ?? '—'}</Table.Cell>
                      <Table.Cell>{paymentKindLabels[item.kind]}</Table.Cell>
                      <Table.Cell>
                        {names.get(item.residentUserId) ?? item.residentUserId}
                      </Table.Cell>
                      <Table.Cell>
                        {formatAmount(item.amount, item.currency)}
                      </Table.Cell>
                      <Table.Cell>
                        <Chip
                          color={paymentStatusColor[item.status]}
                          size="sm"
                          variant="soft"
                        >
                          {paymentStatusLabels[item.status] ?? item.status}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        {item.externalTransactionId ?? '—'}
                      </Table.Cell>
                      <Table.Cell>
                        {formatDateTime(item.createdAt)}
                        <br />
                        <span className="text-muted">
                          {formatDateTime(item.completedAt)}
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card.Content>
      </Card>
      {data ? (
        <Pager
          page={filters.page}
          totalCount={data.totalCount}
          onPage={(page) => setFilters({ ...filters, page })}
        />
      ) : null}
    </div>
  );
}

function CaseDrawer({
  caseId,
  names,
  onClose,
  onChanged,
}: {
  caseId: string;
  names: Map<string, string>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const { state, setState, reload } = useAsyncResource(
    async (signal) => {
      const item = await getCase(caseId, signal);
      const payment = await getPayment(item.kind, item.paymentId, signal).catch(
        () => null,
      );

      return { item, payment };
    },
    getReconciliationErrorMessage,
    [caseId],
  );
  const [respondStatus, setRespondStatus] = useState<RespondStatus | ''>('');
  const [response, setResponse] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState<'' | 'assign' | 'respond' | 'sync'>('');
  const pending = useRef(false);

  const run = async (
    kind: 'assign' | 'respond' | 'sync',
    action: () => Promise<ReconciliationCase>,
    success: string,
  ) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(kind);
    setFormError('');
    try {
      const item = await action();

      setState((current) => ({
        status: 'success',
        data: { item, payment: current.data?.payment ?? null },
      }));
      toast.success(success, {
        description: `${item.reference} · ${caseStatusLabels[item.status]}`,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      if (kind === 'respond') {
        setResponse('');
        setRespondStatus('');
      }
      onChanged();
    } catch (error) {
      setFormError(getReconciliationErrorMessage(error));
    } finally {
      pending.current = false;
      setBusy('');
    }
  };

  const item = state.data?.item;
  const payment = state.data?.payment;
  const actions = item ? caseActions(item, user?.id) : null;
  const personName = (id: string | null) =>
    !id
      ? 'Chưa có người nhận'
      : id === user?.id
        ? 'Bạn'
        : (names.get(id) ?? 'Quản trị viên');

  return (
    <Drawer isOpen onOpenChange={(open) => (open ? null : onClose())}>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="w-full sm:w-[36rem]">
            <Drawer.CloseTrigger aria-label="Đóng hồ sơ tra soát">
              <Xmark aria-hidden="true" className="size-5" />
            </Drawer.CloseTrigger>
            <Drawer.Header>
              <Drawer.Heading>
                {item ? item.reference : 'Hồ sơ tra soát'}
              </Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-4">
              {state.status === 'loading' && !item ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : null}
              {state.status === 'error' && !item ? (
                <ErrorAlert message={state.message} onRetry={reload} />
              ) : null}
              {item ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip color={caseStatusColor[item.status]} variant="soft">
                      {caseStatusLabels[item.status] ?? item.status}
                    </Chip>
                    <span className="text-sm text-muted">
                      Cập nhật {formatDateTime(item.updatedAt)}
                    </span>
                  </div>

                  {isCaseUncertain(item.status) ? (
                    <Alert status="warning">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>Chưa có kết luận</Alert.Title>
                        <Alert.Description>
                          Kết quả thanh toán chưa được xác minh. Không hướng dẫn
                          cư dân thanh toán lại hay hứa hoàn tiền cho đến khi có
                          kết luận từ cổng thanh toán.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : null}

                  <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2 text-sm">
                    <dt className="text-muted">Loại</dt>
                    <dd>{paymentKindLabels[item.kind]}</dd>
                    <dt className="text-muted">Cư dân</dt>
                    <dd>
                      {payment
                        ? (names.get(payment.residentUserId) ??
                          payment.residentUserId)
                        : '—'}
                    </dd>
                    <dt className="text-muted">Mã đơn</dt>
                    <dd>{payment?.orderCode ?? '—'}</dd>
                    <dt className="text-muted">Số tiền</dt>
                    <dd>
                      {payment
                        ? formatAmount(payment.amount, payment.currency)
                        : '—'}
                    </dd>
                    <dt className="text-muted">Trạng thái nội bộ</dt>
                    <dd>
                      {payment
                        ? (paymentStatusLabels[payment.status] ??
                          payment.status)
                        : '—'}
                    </dd>
                    <dt className="text-muted">Cổng thanh toán</dt>
                    <dd>
                      {providerStatusLabel(item.providerStatus)}
                      {item.providerCheckedAt
                        ? ` · ${formatDateTime(item.providerCheckedAt)}`
                        : ''}
                    </dd>
                    <dt className="text-muted">Người xử lý</dt>
                    <dd>{personName(item.assignedAdminUserId)}</dd>
                    <dt className="text-muted">Nội dung cư dân</dt>
                    <dd className="whitespace-pre-wrap">{item.reason}</dd>
                    <dt className="text-muted">Kết quả / bước tiếp</dt>
                    <dd className="whitespace-pre-wrap">
                      {translateCaseMessage(item.nextStep)}
                    </dd>
                  </dl>

                  {formError ? <ErrorAlert message={formError} /> : null}

                  {actions && (actions.canAssign || actions.canSynchronize) ? (
                    <div className="flex flex-wrap gap-2">
                      {actions.canAssign ? (
                        <Button
                          isPending={busy === 'assign'}
                          variant="secondary"
                          onPress={() =>
                            run(
                              'assign',
                              () => assignCase(item.id),
                              'Đã nhận xử lý hồ sơ',
                            )
                          }
                        >
                          Nhận xử lý
                        </Button>
                      ) : null}
                      {actions.canSynchronize ? (
                        <Button
                          isPending={busy === 'sync'}
                          variant="secondary"
                          onPress={() =>
                            run(
                              'sync',
                              () => synchronizeCase(item.id),
                              'Đã đối chiếu với cổng thanh toán',
                            )
                          }
                        >
                          <ArrowRotateRight
                            aria-hidden="true"
                            className="size-4"
                          />
                          Đối chiếu cổng thanh toán
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {actions?.canRespond ? (
                    <Card>
                      <Card.Content className="flex flex-col gap-3">
                        <OptionSelect
                          label="Tiến độ"
                          options={Object.entries(respondStatusLabels).map(
                            ([id, label]) => ({ id, label }),
                          )}
                          value={respondStatus}
                          onChange={(id) =>
                            setRespondStatus(id as RespondStatus)
                          }
                        />
                        <TextField
                          fullWidth
                          value={response}
                          onChange={setResponse}
                        >
                          <Label>Phản hồi cho cư dân</Label>
                          <TextArea
                            maxLength={RESPONSE_MAX_LENGTH}
                            rows={3}
                            variant="secondary"
                          />
                          <Description>
                            Chỉ đánh dấu đã thanh toán qua đối chiếu cổng thanh
                            toán; không xác nhận từ ảnh chụp.
                          </Description>
                        </TextField>
                        <Button
                          className="self-start"
                          isPending={busy === 'respond'}
                          variant="primary"
                          onPress={() => {
                            const error = validateResponse(
                              respondStatus,
                              response,
                            );

                            if (error) {
                              setFormError(error);

                              return;
                            }
                            void run(
                              'respond',
                              () =>
                                respondCase(
                                  item.id,
                                  respondStatus as RespondStatus,
                                  response,
                                ),
                              'Đã gửi phản hồi',
                            );
                          }}
                        >
                          Gửi phản hồi
                        </Button>
                      </Card.Content>
                    </Card>
                  ) : null}

                  <div>
                    <p className="mb-2 font-medium">Lịch sử xử lý</p>
                    <ol className="flex flex-col gap-3 border-l border-separator pl-4">
                      {item.history.map((event) => (
                        <li key={event.id} className="text-sm">
                          <p className="font-medium">
                            {eventActionLabel(event.action)} ·{' '}
                            {caseStatusLabels[event.status] ?? event.status}
                          </p>
                          <p className="text-muted">
                            {formatDateTime(event.createdAt)} ·{' '}
                            {personName(event.actorUserId)}
                          </p>
                          <p className="whitespace-pre-wrap">
                            {translateCaseMessage(event.message)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              ) : null}
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

function CasesTab({ names }: { names: Map<string, string> }) {
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const { state, reload, refresh } = useAsyncResource(
    (signal) => listCases(page, signal),
    getReconciliationErrorMessage,
    [page],
  );
  const data = state.data;

  return (
    <div className="flex flex-col gap-4">
      {state.status === 'error' ? (
        <ErrorAlert message={state.message} onRetry={reload} />
      ) : null}
      <Card>
        <Card.Content className="p-0">
          <Table>
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Hồ sơ tra soát"
                onRowAction={(key) => setOpenId(String(key))}
              >
                <Table.Header>
                  <Table.Column isRowHeader id="reference">
                    Mã tham chiếu
                  </Table.Column>
                  <Table.Column id="kind">Loại</Table.Column>
                  <Table.Column id="reason">Nội dung</Table.Column>
                  <Table.Column id="status">Tiến độ</Table.Column>
                  <Table.Column id="owner">Người xử lý</Table.Column>
                  <Table.Column id="updated">Cập nhật</Table.Column>
                </Table.Header>
                <Table.Body
                  renderEmptyState={() =>
                    state.status === 'loading' ? (
                      <Skeleton className="m-4 h-8 rounded-lg" />
                    ) : (
                      <p className="p-6 text-center text-muted">
                        Chưa có hồ sơ tra soát.
                      </p>
                    )
                  }
                >
                  {(data?.items ?? []).map((item) => (
                    <Table.Row
                      key={item.id}
                      className="cursor-pointer"
                      id={item.id}
                    >
                      <Table.Cell>{item.reference}</Table.Cell>
                      <Table.Cell>{paymentKindLabels[item.kind]}</Table.Cell>
                      <Table.Cell>
                        <span className="line-clamp-2 max-w-80">
                          {item.reason}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip
                          color={caseStatusColor[item.status]}
                          size="sm"
                          variant="soft"
                        >
                          {caseStatusLabels[item.status] ?? item.status}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        {item.assignedAdminUserId
                          ? (names.get(item.assignedAdminUserId) ??
                            'Quản trị viên')
                          : 'Chưa có'}
                      </Table.Cell>
                      <Table.Cell>{formatDateTime(item.updatedAt)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card.Content>
      </Card>
      {data ? (
        <Pager page={page} totalCount={data.totalCount} onPage={setPage} />
      ) : null}
      {openId ? (
        <CaseDrawer
          key={openId}
          caseId={openId}
          names={names}
          onChanged={refresh}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}

export default function AdminPaymentReconciliationsPage() {
  const [tab, setTab] = useState<TabKey>('cases');
  const { residents, names, error } = useResidentNames();
  const residentOptions = useMemo(
    () =>
      residents.map((user) => ({
        id: user.id,
        label: `${user.fullName} · ${user.email}`,
      })),
    [residents],
  );

  return (
    <section className="flex w-full flex-col gap-5">
      <p className="text-sm text-muted">
        Tra cứu giao dịch phí lưu quá hạn và gói dịch vụ, xử lý phản ánh thanh
        toán của cư dân. Trạng thái đã thanh toán chỉ được ghi nhận khi cổng
        thanh toán xác minh.
      </p>
      {error ? (
        <ErrorAlert message={`${error} Tên cư dân sẽ hiển thị dạng mã.`} />
      ) : null}
      <Tabs
        align="start"
        selectedKey={tab}
        variant="secondary"
        onSelectionChange={(key) => setTab(key as TabKey)}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Thanh toán">
            <Tabs.Tab id="cases">
              <Tabs.Indicator />
              Hồ sơ tra soát
            </Tabs.Tab>
            <Tabs.Tab id="payments">
              <Tabs.Indicator />
              Tra cứu giao dịch
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel className="pt-5" id="cases">
          {tab === 'cases' ? <CasesTab names={names} /> : null}
        </Tabs.Panel>
        <Tabs.Panel className="pt-5" id="payments">
          {tab === 'payments' ? (
            <PaymentsTab names={names} residents={residentOptions} />
          ) : null}
        </Tabs.Panel>
      </Tabs>
    </section>
  );
}
