import type { AccountChange } from '@/services/account-change-service';

import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Chip,
  Drawer,
  FieldError,
  Label,
  Skeleton,
  Table,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import Xmark from '@gravity-ui/icons/Xmark';

import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  approvalImpact,
  canReview,
  CHANGE_PAGE_SIZE,
  changeKindLabels,
  changeStatusColor,
  changeStatusLabels,
  eventLabel,
  getAccountChange,
  getAccountChangeErrorMessage,
  groupBlockers,
  listAccountChanges,
  REVIEW_REASON_MAX,
  reviewAccountChange,
  translateMessage,
  validateReviewReason,
  wasApprovalBlocked,
} from '@/services/account-change-service';
import { listAdminLockers } from '@/services/admin-locker-service';
import { userManagementService } from '@/services/user-management-service';

type Lookup = { residents: Map<string, string>; lockers: Map<string, string> };

const dateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN') : '—';

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

function useLookup(): Lookup {
  const { state } = useAsyncResource(
    async (signal) => {
      const [residents, lockers] = await Promise.all([
        userManagementService.getUsers({
          role: 'RESIDENT',
          search: '',
          status: 'ALL',
          sortDescriptor: { column: 'fullName', direction: 'ascending' },
          page: 1,
          pageSize: 10_000,
        }),
        listAdminLockers(signal).catch(() => []),
      ]);

      return {
        residents: residents.success
          ? residents.data.items.map(
              (user) => [user.id, user.fullName || user.email] as const,
            )
          : [],
        lockers: lockers.map((locker) => [locker.id, locker.code] as const),
      };
    },
    () => '',
    [],
  );

  return useMemo(
    () => ({
      residents: new Map(state.data?.residents ?? []),
      lockers: new Map(state.data?.lockers ?? []),
    }),
    [state.data],
  );
}

function describeChange(change: AccountChange, lookup: Lookup) {
  if (change.kind === 'Phone') {
    return `${change.originalPhoneNumber ?? '—'} → ${change.newPhoneNumber ?? '—'}`;
  }
  const from = change.originalLockerId
    ? (lookup.lockers.get(change.originalLockerId) ?? 'Tủ hiện tại')
    : 'Chưa đăng ký';

  return `${from} → ${change.targetLockerCode ?? lookup.lockers.get(change.targetLockerId ?? '') ?? '—'}`;
}

function ChangeDrawer({
  changeId,
  lookup,
  onClose,
  onChanged,
}: {
  changeId: string;
  lookup: Lookup;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { state, setState, reload } = useAsyncResource(
    (signal) => getAccountChange(changeId, signal),
    getAccountChangeErrorMessage,
    [changeId],
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'approve' | 'reject'>('');
  const pending = useRef(false);
  const change = state.data;

  const review = async (approve: boolean) => {
    const reasonError = validateReviewReason(reason);

    if (reasonError) {
      setError(reasonError);

      return;
    }
    if (pending.current) return;
    pending.current = true;
    setBusy(approve ? 'approve' : 'reject');
    setError('');
    try {
      const result = await reviewAccountChange(changeId, approve, reason);

      setState({ status: 'success', data: result });
      onChanged();
      if (approve && wasApprovalBlocked(result)) {
        setError(
          'Chưa áp dụng: hệ thống phát hiện điều kiện chưa đạt tại thời điểm duyệt (xem danh sách bên dưới).',
        );
      } else {
        setReason('');
        toast.success(
          result.status === 'Applied'
            ? 'Đã duyệt và áp dụng thay đổi'
            : 'Đã từ chối yêu cầu',
          {
            description: 'Cư dân đã được thông báo kết quả.',
            indicator: <CircleCheck aria-hidden="true" className="size-5" />,
          },
        );
      }
    } catch (reviewError) {
      setError(getAccountChangeErrorMessage(reviewError));
      reload();
    } finally {
      pending.current = false;
      setBusy('');
    }
  };

  const groups = change ? groupBlockers(change.blockers) : [];

  return (
    <Drawer isOpen onOpenChange={(open) => (open ? null : onClose())}>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="w-full sm:w-[36rem]">
            <Drawer.CloseTrigger aria-label="Đóng yêu cầu">
              <Xmark aria-hidden="true" className="size-5" />
            </Drawer.CloseTrigger>
            <Drawer.Header>
              <Drawer.Heading>
                {change ? changeKindLabels[change.kind] : 'Yêu cầu thay đổi'}
              </Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-4">
              {state.status === 'loading' && !change ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : null}
              {state.status === 'error' && !change ? (
                <ErrorAlert message={state.message} onRetry={reload} />
              ) : null}
              {change ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip
                      color={changeStatusColor(change.status)}
                      variant="soft"
                    >
                      {changeStatusLabels[change.status] ?? change.status}
                    </Chip>
                    <span className="text-sm text-muted">
                      Cập nhật {dateTime(change.updatedAt)}
                    </span>
                  </div>
                  <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2 text-sm">
                    <dt className="text-muted">Cư dân</dt>
                    <dd>
                      {lookup.residents.get(change.residentUserId) ?? 'Cư dân'}
                    </dd>
                    <dt className="text-muted">Hiện tại → đích</dt>
                    <dd>{describeChange(change, lookup)}</dd>
                    {change.kind === 'Phone' ? (
                      <>
                        <dt className="text-muted">Xác minh số mới</dt>
                        <dd>
                          Đã xác minh OTP · hết hạn{' '}
                          {dateTime(change.phoneVerificationExpiresAt)}
                        </dd>
                      </>
                    ) : null}
                    <dt className="text-muted">Lý do của cư dân</dt>
                    <dd className="whitespace-pre-wrap">{change.reason}</dd>
                    <dt className="text-muted">Gửi lúc</dt>
                    <dd>{dateTime(change.createdAt)}</dd>
                    {change.reviewReason ? (
                      <>
                        <dt className="text-muted">Lý do của Admin</dt>
                        <dd className="whitespace-pre-wrap">
                          {change.reviewReason}
                        </dd>
                      </>
                    ) : null}
                    {change.appliedAt ? (
                      <>
                        <dt className="text-muted">Áp dụng lúc</dt>
                        <dd>{dateTime(change.appliedAt)}</dd>
                      </>
                    ) : null}
                  </dl>

                  {canReview(change) ? (
                    groups.length ? (
                      <Alert status="danger">
                        <Alert.Indicator />
                        <Alert.Content>
                          <Alert.Title>Chưa đủ điều kiện áp dụng</Alert.Title>
                          <Alert.Description>
                            <ul className="list-disc space-y-1 pl-4">
                              {groups.map((group) => (
                                <li key={group.label}>
                                  <strong>{group.label}:</strong>{' '}
                                  {group.messages.join(' ')}
                                </li>
                              ))}
                            </ul>
                          </Alert.Description>
                        </Alert.Content>
                      </Alert>
                    ) : (
                      <Alert status="success">
                        <Alert.Indicator />
                        <Alert.Content>
                          <Alert.Description>
                            Hiện đủ điều kiện. Hệ thống sẽ kiểm tra lại khi
                            duyệt.
                          </Alert.Description>
                        </Alert.Content>
                      </Alert>
                    )
                  ) : null}

                  {canReview(change) ? (
                    <Card>
                      <Card.Header>
                        <Card.Title>Duyệt yêu cầu</Card.Title>
                      </Card.Header>
                      <Card.Content className="space-y-3">
                        <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
                          {approvalImpact(change).map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                        <TextField
                          fullWidth
                          isInvalid={Boolean(error)}
                          value={reason}
                          onChange={setReason}
                        >
                          <Label>Lý do (gửi kèm thông báo cho cư dân)</Label>
                          <TextArea
                            maxLength={REVIEW_REASON_MAX}
                            rows={2}
                            variant="secondary"
                          />
                          <FieldError>{error}</FieldError>
                        </TextField>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            isDisabled={Boolean(busy)}
                            isPending={busy === 'reject'}
                            variant="danger-soft"
                            onPress={() => void review(false)}
                          >
                            Từ chối
                          </Button>
                          <Button
                            isDisabled={Boolean(busy) || groups.length > 0}
                            isPending={busy === 'approve'}
                            variant="primary"
                            onPress={() => void review(true)}
                          >
                            Duyệt và áp dụng
                          </Button>
                        </div>
                      </Card.Content>
                    </Card>
                  ) : null}

                  <div>
                    <p className="mb-2 font-medium">Lịch sử</p>
                    <ol className="flex flex-col gap-3 border-l border-separator pl-4">
                      {change.history.map((event) => (
                        <li key={event.id} className="text-sm">
                          <p className="font-medium">
                            {eventLabel(event.action)}
                          </p>
                          <p className="text-muted">
                            {dateTime(event.createdAt)}
                          </p>
                          <p className="whitespace-pre-wrap">
                            {translateMessage(event.message)}
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

export default function AdminAccountChangesPage() {
  const lookup = useLookup();
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const { state, reload, refresh } = useAsyncResource(
    (signal) => listAccountChanges(page, signal),
    getAccountChangeErrorMessage,
    [page],
  );
  const data = state.data;
  const pages = Math.max(
    1,
    Math.ceil((data?.totalCount ?? 0) / CHANGE_PAGE_SIZE),
  );

  return (
    <section className="flex w-full flex-col gap-5">
      <p className="text-sm text-muted">
        Yêu cầu đổi tủ đăng ký hoặc số điện thoại do cư dân gửi từ ứng dụng. Chỉ
        áp dụng khi hệ thống xác nhận đủ điều kiện; số mới luôn phải được cư dân
        xác minh OTP.
      </p>
      {state.status === 'error' ? (
        <ErrorAlert message={state.message} onRetry={reload} />
      ) : null}
      <Card>
        <Card.Content className="p-0">
          <Table>
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Yêu cầu thay đổi tài khoản"
                onRowAction={(key) => setOpenId(String(key))}
              >
                <Table.Header>
                  <Table.Column isRowHeader id="resident">
                    Cư dân
                  </Table.Column>
                  <Table.Column id="kind">Loại</Table.Column>
                  <Table.Column id="change">Hiện tại → đích</Table.Column>
                  <Table.Column id="status">Tiến độ</Table.Column>
                  <Table.Column id="conditions">Điều kiện</Table.Column>
                  <Table.Column id="created">Gửi lúc</Table.Column>
                </Table.Header>
                <Table.Body
                  renderEmptyState={() =>
                    state.status === 'loading' ? (
                      <Skeleton className="m-4 h-8 rounded-lg" />
                    ) : (
                      <p className="p-6 text-center text-muted">
                        Chưa có yêu cầu nào.
                      </p>
                    )
                  }
                >
                  {(data?.items ?? []).map((change) => (
                    <Table.Row
                      key={change.id}
                      className="cursor-pointer"
                      id={change.id}
                    >
                      <Table.Cell>
                        {lookup.residents.get(change.residentUserId) ??
                          'Cư dân'}
                      </Table.Cell>
                      <Table.Cell>
                        {changeKindLabels[change.kind] ?? change.kind}
                      </Table.Cell>
                      <Table.Cell>{describeChange(change, lookup)}</Table.Cell>
                      <Table.Cell>
                        <Chip
                          color={changeStatusColor(change.status)}
                          size="sm"
                          variant="soft"
                        >
                          {changeStatusLabels[change.status] ?? change.status}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        {canReview(change) ? (
                          change.blockers.length ? (
                            <span className="text-danger">
                              {change.blockers.length} điều kiện chưa đạt
                            </span>
                          ) : (
                            <span className="text-success">Đủ điều kiện</span>
                          )
                        ) : (
                          '—'
                        )}
                      </Table.Cell>
                      <Table.Cell>{dateTime(change.createdAt)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card.Content>
      </Card>
      {data ? (
        <div className="flex items-center justify-end gap-2 text-sm text-muted">
          <span>
            Trang {page}/{pages} · {data.totalCount} yêu cầu
          </span>
          <Button
            isDisabled={page <= 1}
            size="sm"
            variant="secondary"
            onPress={() => setPage(page - 1)}
          >
            Trước
          </Button>
          <Button
            isDisabled={page >= pages}
            size="sm"
            variant="secondary"
            onPress={() => setPage(page + 1)}
          >
            Sau
          </Button>
        </div>
      ) : null}
      {openId ? (
        <ChangeDrawer
          key={openId}
          changeId={openId}
          lookup={lookup}
          onChanged={refresh}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </section>
  );
}
