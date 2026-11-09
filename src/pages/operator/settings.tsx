import type { AssignedLocker } from '@/services/operator-account-service';

import { useCallback, useEffect, useState } from 'react';
import { Card, Chip, Skeleton } from '@heroui/react';
import Boxes3 from '@gravity-ui/icons/Boxes3';

import { useAuth } from '@/auth/auth-context';
import { formatOptionalText } from '@/auth/account-display';
import {
  ChangePasswordCard,
  ErrorAlert,
  ProfileCard,
  SessionCard,
} from '@/components/account/account-cards';
import {
  getAccountLoadErrorMessage,
  getAssignedLockers,
} from '@/services/operator-account-service';

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

function AssignedLockersCard({
  state,
  onRetry,
}: {
  state: LoadState<AssignedLocker[]>;
  onRetry: () => void;
}) {
  return (
    <Card>
      <Card.Header className="flex-row items-center gap-3">
        <Boxes3 aria-hidden="true" className="size-6 text-accent" />
        <Card.Title>Phạm vi phụ trách</Card.Title>
      </Card.Header>
      <Card.Content className="gap-4">
        {state.status === 'loading' ? (
          <div
            aria-busy="true"
            aria-label="Đang tải danh sách tủ được phân công"
            className="flex flex-wrap gap-2"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-7 w-24 rounded-full" />
            ))}
          </div>
        ) : null}
        {state.status === 'error' ? (
          <ErrorAlert message={state.message} onRetry={onRetry} />
        ) : null}
        {state.status === 'success' && state.data.length === 0 ? (
          <p className="text-sm text-muted">
            Bạn chưa được phân công tủ nào. Liên hệ Quản trị viên để được phân
            công.
          </p>
        ) : null}
        {state.status === 'success' && state.data.length > 0 ? (
          <ul
            aria-label="Danh sách tủ được phân công"
            className="flex flex-col divide-y divide-border"
          >
            {state.data.map((locker) => (
              <li
                key={locker.id}
                className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:gap-4"
              >
                <Chip className="w-fit" size="sm" variant="soft">
                  {locker.code}
                </Chip>
                <span className="min-w-0 break-words text-sm text-muted">
                  {formatOptionalText(locker.address)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-sm text-muted">
          Phân công tủ do Quản trị viên thực hiện và không thể thay đổi tại đây.
        </p>
      </Card.Content>
    </Card>
  );
}

export default function OperatorSettingsPage() {
  // Profile comes from the auth context, which AuthProvider refreshes from
  // GET /api/auth/me on load. Calling /me again here would spend the
  // backend auth rate limit (5 requests/minute) needed for login and
  // password changes.
  const { user } = useAuth();
  const [lockers, setLockers] = useState<LoadState<AssignedLocker[]>>({
    status: 'loading',
  });
  const [lockersRequest, setLockersRequest] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setLockers({ status: 'loading' });
    getAssignedLockers(controller.signal)
      .then((data) => setLockers({ status: 'success', data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLockers({
          status: 'error',
          message: getAccountLoadErrorMessage(error),
        });
      });

    return () => controller.abort();
  }, [lockersRequest]);

  const retryLockers = useCallback(
    () => setLockersRequest((request) => request + 1),
    [],
  );

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      {user ? <ProfileCard user={user} /> : null}
      <AssignedLockersCard state={lockers} onRetry={retryLockers} />
      <ChangePasswordCard />
      <SessionCard />
    </section>
  );
}
