import type { CSSProperties } from 'react';
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

const tabPanelStyle = {
  marginTop: 0,
  padding: '1.25rem 0 0',
} satisfies CSSProperties;

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

  const handleOperatorCreated = (
    operator: Extract<ManagedUserView, { role: 'LOCKER_OPERATOR' }>,
  ) => {
    setRole('LOCKER_OPERATOR');
    setSearch('');
    setStatus('ALL');
    setSortDescriptor(getDefaultSortDescriptor('LOCKER_OPERATOR'));
    setPage(1);
    setSuccessMessage(
      `Đã thêm nhân viên vận hành. Mã nhân viên: ${operator.employeeCode}.`,
    );
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
    <div className="-m-8 min-h-[calc(100%+4rem)] overflow-x-clip bg-[var(--um-page)] p-5 font-sans text-[var(--um-ink)] [--accent:var(--um-primary)] [--focus:var(--um-focus)] [--segment-foreground:var(--um-on-primary)] [--segment:var(--um-primary)] [--um-border:#e0e0e0] [--um-focus:#0071e3] [--um-ink:#1d1d1f] [--um-on-primary:#ffffff] [--um-page:#f5f5f7] [--um-primary-border:#b8d8f8] [--um-primary-soft:#eaf3ff] [--um-primary-strong:#004a99] [--um-primary:#0066cc] [--um-row-hover:#f0f7ff] [--um-surface:#ffffff] sm:p-6 lg:p-8">
      <section className="mx-auto w-full max-w-[1440px]">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-[30px]">
            Quản lý người dùng
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 sm:text-base">
            Theo dõi tài khoản nhân viên vận hành và cư dân trong hệ thống.
          </p>
        </div>

        {successMessage ? (
          <Alert className="mb-5" status="success">
            <Alert.Content>
              <Alert.Title>{successMessage}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null}

        <Tabs
          className="gap-0"
          selectedKey={role}
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
                  className="min-h-11 bg-[var(--um-primary)] text-[var(--um-on-primary)] shadow-none"
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

          <Tabs.Panel id="LOCKER_OPERATOR" style={tabPanelStyle}>
            {role === 'LOCKER_OPERATOR' ? currentTable : null}
          </Tabs.Panel>
          <Tabs.Panel id="RESIDENT" style={tabPanelStyle}>
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
    </div>
  );
}
