import type {
  LockerAssignmentSnapshot,
  ManagedUserView,
  UserManagementService,
} from '@/types/user-management';
import type { CSSProperties } from 'react';

import { useEffect, useRef, useState } from 'react';
import { Alert, Avatar, Button, Chip, Modal, Spinner } from '@heroui/react';
import ArrowsRotateRight from '@gravity-ui/icons/ArrowsRotateRight';
import TriangleExclamation from '@gravity-ui/icons/TriangleExclamation';

import {
  ACCOUNT_STATUS_LABELS,
  USER_ROLE_LABELS,
} from '@/constants/user-management';

type UserDetailModalProps = {
  userId: string | null;
  service: UserManagementService;
  onClose: () => void;
  onManageLockers: (operatorId: string) => void;
};

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const tertiaryActionStyle = {
  '--button-bg': 'transparent',
  '--button-bg-hover': 'var(--um-primary-soft)',
  '--button-bg-pressed': '#d6eaff',
  '--button-fg': 'var(--um-primary)',
} as CSSProperties;

const neutralButtonStyle = {
  '--button-bg': '#f2f2f7',
  '--button-bg-hover': '#e5e5ea',
  '--button-bg-pressed': '#d9d9df',
  '--button-fg': 'var(--um-ink)',
} as CSSProperties;

const closeTriggerClassName =
  'bg-[#F2F2F7] text-[#1D1D1F] shadow-none hover:bg-[#E5E5EA] focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2';

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  return parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toLocaleUpperCase('vi-VN')
    : (parts[0]?.[0] ?? '?').toLocaleUpperCase('vi-VN');
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-[var(--um-border)] py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-neutral-600">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-[var(--um-ink)]">
        {value}
      </dd>
    </div>
  );
}

export function UserDetailModal({
  userId,
  service,
  onClose,
  onManageLockers,
}: UserDetailModalProps) {
  const [user, setUser] = useState<ManagedUserView | null>(null);
  const [assignment, setAssignment] = useState<LockerAssignmentSnapshot | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!userId) {
      setUser(null);
      setAssignment(null);
      setErrorMessage(null);
      setIsLoading(false);

      return;
    }

    const requestId = requestIdRef.current + 1;
    let isActive = true;

    requestIdRef.current = requestId;
    setIsLoading(true);
    setErrorMessage(null);
    setUser(null);
    setAssignment(null);

    void service
      .getUserById(userId)
      .then(async (userResult) => {
        if (!isActive || requestId !== requestIdRef.current) return;
        if (!userResult.success) throw new Error(userResult.error.message);

        let nextAssignment: LockerAssignmentSnapshot | null = null;

        if (userResult.data.role === 'LOCKER_OPERATOR') {
          const assignmentResult = await service.getLockerAssignment(userId);

          if (!assignmentResult.success)
            throw new Error(assignmentResult.error.message);
          nextAssignment = assignmentResult.data;
        }

        if (!isActive || requestId !== requestIdRef.current) return;
        setUser(userResult.data);
        setAssignment(nextAssignment);
      })
      .catch((error: unknown) => {
        if (!isActive || requestId !== requestIdRef.current) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Không thể tải thông tin người dùng.',
        );
      })
      .finally(() => {
        if (isActive && requestId === requestIdRef.current) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [retryCount, service, userId]);

  return (
    <Modal
      isOpen={userId !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container scroll="inside" size="lg">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Chi tiết người dùng</Modal.Heading>
              <Modal.CloseTrigger
                aria-label="Đóng chi tiết người dùng"
                className={closeTriggerClassName}
              />
            </Modal.Header>
            <Modal.Body>
              {isLoading ? (
                <div className="flex min-h-64 items-center justify-center">
                  <Spinner
                    aria-label="Đang tải chi tiết người dùng"
                    color="accent"
                  />
                </div>
              ) : null}

              {!isLoading && errorMessage ? (
                <Alert status="danger">
                  <Alert.Indicator>
                    <TriangleExclamation
                      aria-hidden="true"
                      className="size-5"
                    />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Không thể tải chi tiết người dùng</Alert.Title>
                    <Alert.Description>{errorMessage}</Alert.Description>
                    <Button
                      className="mt-4"
                      variant="outline"
                      onPress={() => setRetryCount((count) => count + 1)}
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

              {!isLoading && !errorMessage && user ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <Avatar size="lg">
                      {user.avatarUrl ? (
                        <Avatar.Image
                          alt={`Ảnh đại diện của ${user.fullName}`}
                          src={user.avatarUrl}
                        />
                      ) : null}
                      <Avatar.Fallback className="bg-[var(--um-primary-soft)] text-[var(--um-primary-strong)]">
                        {getInitials(user.fullName)}
                      </Avatar.Fallback>
                    </Avatar>
                    <div>
                      <p className="text-lg font-semibold text-[var(--um-ink)]">
                        {user.fullName}
                      </p>
                      <p className="mt-1 text-sm text-neutral-600">
                        {USER_ROLE_LABELS[user.role]}
                      </p>
                    </div>
                  </div>

                  <dl>
                    {user.role === 'LOCKER_OPERATOR' ? (
                      <DetailRow
                        label="Mã nhân viên"
                        value={user.employeeCode}
                      />
                    ) : null}
                    <DetailRow label="Họ và tên" value={user.fullName} />
                    <DetailRow label="Email" value={user.email} />
                    <DetailRow label="Số điện thoại" value={user.phoneNumber} />
                    <DetailRow
                      label="Vai trò"
                      value={USER_ROLE_LABELS[user.role]}
                    />
                    <DetailRow
                      label="Trạng thái"
                      value={
                        <Chip
                          color={
                            user.status === 'ACTIVE' ? 'success' : 'danger'
                          }
                          size="sm"
                          variant="soft"
                        >
                          {ACCOUNT_STATUS_LABELS[user.status]}
                        </Chip>
                      }
                    />
                    {user.role === 'LOCKER_OPERATOR' ? (
                      <>
                        <DetailRow
                          label="Ngày tạo"
                          value={dateFormatter.format(new Date(user.createdAt))}
                        />
                        <DetailRow
                          label="Số Locker đang quản lý"
                          value={user.assignedLockerCount}
                        />
                      </>
                    ) : (
                      <DetailRow
                        label="Ngày đăng ký"
                        value={dateFormatter.format(
                          new Date(user.registeredAt),
                        )}
                      />
                    )}
                  </dl>

                  {user.role === 'LOCKER_OPERATOR' ? (
                    <section>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-[var(--um-ink)]">
                          Locker được phân công
                        </h3>
                        <Button
                          className="min-h-11 px-3 font-semibold text-[var(--um-primary)] shadow-none focus-visible:ring-2 focus-visible:ring-[var(--um-focus)] focus-visible:ring-offset-2"
                          style={tertiaryActionStyle}
                          variant="tertiary"
                          onPress={() => onManageLockers(user.id)}
                        >
                          Quản lý tủ
                        </Button>
                      </div>
                      {assignment?.assigned.length ? (
                        <ul className="mt-3 space-y-2">
                          {assignment.assigned.map((locker) => (
                            <li
                              key={locker.id}
                              className="rounded-lg border border-[var(--um-border)] bg-[var(--um-surface)] px-3 py-2 text-sm"
                            >
                              <span className="font-medium">{locker.code}</span>
                              <span className="text-neutral-600">
                                {' '}
                                · {locker.buildingName} — {locker.locationLabel}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-neutral-600">
                          Chưa được phân công Locker.
                        </p>
                      )}
                    </section>
                  ) : null}
                </div>
              ) : null}
            </Modal.Body>
            <Modal.Footer>
              <Button
                className="min-h-10 rounded-full border-0 px-5 text-[var(--um-ink)] shadow-none focus-visible:ring-2 focus-visible:ring-[var(--um-focus)] focus-visible:ring-offset-2"
                style={neutralButtonStyle}
                variant="primary"
                onPress={onClose}
              >
                Đóng
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
