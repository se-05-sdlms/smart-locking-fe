import type {
  ManagedUserView,
  PaginatedResult,
  StatusFilter,
  UserManagementService,
  UserRole,
  UserSortDescriptor,
} from '@/types/user-management';

import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Tabs } from '@heroui/react';
import CirclePlus from '@gravity-ui/icons/CirclePlus';

import { AccountStatusModal } from '@/components/admin/users/account-status-modal';
import { CreateOperatorModal } from '@/components/admin/users/create-operator-modal';
import { OperatorLockerAssignmentModal } from '@/components/admin/users/operator-locker-assignment-modal';
import { UserDetailModal } from '@/components/admin/users/user-detail-modal';
import { UserManagementToolbar } from '@/components/admin/users/user-management-toolbar';
import { UserTable } from '@/components/admin/users/user-table';
import { DEFAULT_PAGE_SIZE } from '@/constants/user-management';
import { userManagementService } from '@/mocks/user-management-service';

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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [assignmentOperatorId, setAssignmentOperatorId] = useState<
    string | null
  >(null);
  const [isCreateOperatorOpen, setIsCreateOperatorOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [accountStatusTarget, setAccountStatusTarget] =
    useState<AccountStatusTarget | null>(null);
  const latestRequestId = useRef(0);

  useEffect(() => {
    const requestId = latestRequestId.current + 1;
    let isActive = true;

    latestRequestId.current = requestId;
    setIsLoading(true);
    setHasError(false);

    void service
      .getUsers({
        role,
        search,
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
  }, [page, retryCount, role, search, service, sortDescriptor, status]);

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
    setSuccessMessage('Đã thêm nhân viên vận hành.');
    setRetryCount((current) => current + 1);
  };

  const currentTable = (
    <UserTable
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
      onRetry={() => setRetryCount((current) => current + 1)}
      onSortChange={handleSortChange}
      onViewDetails={setSelectedUserId}
    />
  );

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      {successMessage ? (
        <Alert status="success">
          <Alert.Content>
            <Alert.Title>{successMessage}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

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
        onSaved={() => {
          setAssignmentOperatorId(null);
          setRetryCount((current) => current + 1);
        }}
      />
      <CreateOperatorModal
        isOpen={isCreateOperatorOpen}
        service={service}
        onClose={() => setIsCreateOperatorOpen(false)}
        onCreated={handleOperatorCreated}
      />
      <AccountStatusModal
        isOpen={Boolean(accountStatusTarget)}
        mode={accountStatusTarget?.mode ?? 'LOCK'}
        service={service}
        user={accountStatusTarget?.user ?? null}
        onClose={() => setAccountStatusTarget(null)}
        onSuccess={() => {
          setAccountStatusTarget(null);
          setRetryCount((current) => current + 1);
        }}
      />
    </section>
  );
}
