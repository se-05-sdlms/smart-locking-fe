import type {
  ManagedUserView,
  PaginatedResult,
  StatusFilter,
  UserManagementService,
  UserRole,
  UserSortDescriptor,
} from '@/types/user-management';

import { useEffect, useRef, useState } from 'react';
import { Button, Tabs, toast } from '@heroui/react';
import CirclePlus from '@gravity-ui/icons/CirclePlus';

import { AccountStatusModal } from '@/components/admin/users/account-status-modal';
import { CreateOperatorModal } from '@/components/admin/users/create-operator-modal';
import { OperatorLockerAssignmentModal } from '@/components/admin/users/operator-locker-assignment-modal';
import { UserDetailModal } from '@/components/admin/users/user-detail-modal';
import { UserManagementToolbar } from '@/components/admin/users/user-management-toolbar';
import { UserTable } from '@/components/admin/users/user-table';
import { DEFAULT_PAGE_SIZE } from '@/constants/user-management';
import { userManagementService } from '@/services/user-management-service';

type UserManagementPageProps = {
  service?: UserManagementService;
};

type AccountStatusTarget = {
  user: ManagedUserView;
  mode: 'LOCK' | 'UNLOCK';
};

const emptyResult: PaginatedResult<ManagedUserView> = {
  items: [],
  totalItems: 0,
  totalPages: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

function getDefaultSortDescriptor(role: UserRole): UserSortDescriptor {
  return {
    column: role === 'LOCKER_OPERATOR' ? 'createdAt' : 'registeredAt',
    direction: 'descending',
  };
}

export default function UserManagementPage({
  service = userManagementService,
}: UserManagementPageProps) {
  const [role, setRole] = useState<UserRole>('LOCKER_OPERATOR');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [sortDescriptor, setSortDescriptor] = useState<UserSortDescriptor>(() =>
    getDefaultSortDescriptor('LOCKER_OPERATOR'),
  );
  const [page, setPage] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] =
    useState<PaginatedResult<ManagedUserView>>(emptyResult);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [assignmentOperatorId, setAssignmentOperatorId] = useState<
    string | null
  >(null);
  const [isCreateOperatorOpen, setIsCreateOperatorOpen] = useState(false);
  const [accountStatusTarget, setAccountStatusTarget] =
    useState<AccountStatusTarget | null>(null);
  const latestRequestId = useRef(0);
  const successToastId = useRef<string | null>(null);

  const dismissSuccessToast = () => {
    if (successToastId.current) toast.close(successToastId.current);
    successToastId.current = null;
  };

  const showSuccessToast = (message: string) => {
    // Reuse this page's toast slot without clearing other application notifications.
    successToastId.current = successToastId.current
      ? toast.update(successToastId.current, message, {
          variant: 'success',
          timeout: 3000,
        })
      : toast.success(message, { timeout: 3000 });
  };

  useEffect(() => {
    return () => {
      if (successToastId.current) toast.close(successToastId.current);
      successToastId.current = null;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const requestId = latestRequestId.current + 1;
    let isActive = true;

    latestRequestId.current = requestId;
    setIsLoading(true);
    setHasError(false);
    setErrorMessage(undefined);

    void service
      .getUsers({
        role,
        search: debouncedSearch,
        status,
        sortDescriptor,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
      })
      .then((response) => {
        if (!isActive || requestId !== latestRequestId.current) return;

        if (!response.success) {
          setResult(emptyResult);
          setHasError(true);
          setErrorMessage(response.error.message);

          return;
        }

        setResult(response.data);
        if (response.data.page !== page) setPage(response.data.page);
      })
      .catch(() => {
        if (!isActive || requestId !== latestRequestId.current) return;

        setResult(emptyResult);
        setHasError(true);
      })
      .finally(() => {
        if (!isActive || requestId !== latestRequestId.current) return;

        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [
    page,
    retryCount,
    role,
    debouncedSearch,
    service,
    sortDescriptor,
    status,
  ]);

  const handleRoleChange = (nextRole: UserRole) => {
    setRole(nextRole);
    setSortDescriptor(getDefaultSortDescriptor(nextRole));
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: StatusFilter) => {
    setStatus(value);
    setPage(1);
  };

  const handleSortChange = (descriptor: UserSortDescriptor) => {
    setSortDescriptor(descriptor);
    setPage(1);
  };

  const handleOperatorCreated = () => {
    setRole('LOCKER_OPERATOR');
    setSearch('');
    setStatus('ALL');
    setSortDescriptor(getDefaultSortDescriptor('LOCKER_OPERATOR'));
    setPage(1);
    showSuccessToast('Đã thêm nhân viên vận hành.');
    setRetryCount((current) => current + 1);
  };

  const currentTable = (
    <UserTable
      errorMessage={errorMessage}
      hasActiveFilters={search.trim().length > 0 || status !== 'ALL'}
      hasError={hasError}
      isLoading={isLoading}
      page={result.page}
      pageSize={result.pageSize}
      role={role}
      sortDescriptor={sortDescriptor}
      totalItems={result.totalItems}
      totalPages={result.totalPages}
      users={result.items}
      onChangeAccountStatus={(user) => {
        setSelectedUserId(null);
        setAccountStatusTarget({
          user,
          mode: user.status === 'ACTIVE' ? 'LOCK' : 'UNLOCK',
        });
      }}
      onPageChange={setPage}
      onRetry={() => {
        service.invalidateCache?.();
        setRetryCount((current) => current + 1);
      }}
      onSortChange={handleSortChange}
      onViewDetails={setSelectedUserId}
    />
  );

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      <Tabs
        align="start"
        selectedKey={role}
        variant="secondary"
        onSelectionChange={(key) => {
          if (key === 'LOCKER_OPERATOR' || key === 'RESIDENT') {
            handleRoleChange(key);
          }
        }}
      >
        <UserManagementToolbar
          actions={
            role === 'LOCKER_OPERATOR' ? (
              <Button
                variant="primary"
                onPress={() => setIsCreateOperatorOpen(true)}
              >
                <CirclePlus aria-hidden="true" className="size-4" />
                Thêm nhân viên
              </Button>
            ) : undefined
          }
          search={search}
          status={status}
          onSearchChange={handleSearchChange}
          onStatusChange={handleStatusChange}
        />

        <Tabs.Panel className="pt-5" id="LOCKER_OPERATOR">
          {role === 'LOCKER_OPERATOR' ? currentTable : null}
        </Tabs.Panel>
        <Tabs.Panel className="pt-5" id="RESIDENT">
          {role === 'RESIDENT' ? currentTable : null}
        </Tabs.Panel>
      </Tabs>

      <UserDetailModal
        service={service}
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onManageLockers={(operatorId) => {
          setSelectedUserId(null);
          setAssignmentOperatorId(operatorId);
        }}
      />
      <OperatorLockerAssignmentModal
        operatorId={assignmentOperatorId}
        service={service}
        onClose={() => setAssignmentOperatorId(null)}
        onDataChanged={() => {
          dismissSuccessToast();
          setRetryCount((current) => current + 1);
        }}
        onSaved={() => {
          setAssignmentOperatorId(null);
          showSuccessToast('Đã cập nhật phân công tủ.');
          setRetryCount((current) => current + 1);
        }}
      />
      <CreateOperatorModal
        isOpen={isCreateOperatorOpen}
        service={service}
        onClose={() => setIsCreateOperatorOpen(false)}
        onCreated={handleOperatorCreated}
        onDataChanged={() => {
          dismissSuccessToast();
          setRetryCount((current) => current + 1);
        }}
      />
      <AccountStatusModal
        isOpen={Boolean(accountStatusTarget)}
        mode={accountStatusTarget?.mode ?? 'LOCK'}
        service={service}
        user={accountStatusTarget?.user ?? null}
        onClose={() => setAccountStatusTarget(null)}
        onSuccess={(mode) => {
          setAccountStatusTarget(null);
          showSuccessToast(
            mode === 'LOCK' ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.',
          );
          setRetryCount((current) => current + 1);
        }}
      />
    </section>
  );
}
