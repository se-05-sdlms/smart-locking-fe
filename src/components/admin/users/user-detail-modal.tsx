import type {
  LockerAssignmentSnapshot,
  ManagedUserView,
  UserManagementService,
} from '@/types/user-management';

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  Modal,
  Separator,
  Spinner,
  Typography,
} from '@heroui/react';
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
    <div className="grid gap-1 border-b border-default py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-sm font-medium">{value}</dd>
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

    const request = service.getUserDetail
      ? service.getUserDetail(userId)
      : service.getUserById(userId).then(async (userResult) => {
          if (!userResult.success) return userResult;

          if (userResult.data.role === 'LOCKER_OPERATOR') {
            const assignmentResult = await service.getLockerAssignment(userId);

            if (!assignmentResult.success) return assignmentResult;

            return {
              success: true as const,
              data: {
                user: userResult.data,
                assigned: assignmentResult.data.assigned,
              },
            };
          }

          return {
            success: true as const,
            data: { user: userResult.data, assigned: [] },
          };
        });

    void request
      .then((result) => {
        if (!result.success) throw new Error(result.error.message);

        if (!isActive || requestId !== requestIdRef.current) return;
        setUser(result.data.user);
        setAssignment({
          assigned: result.data.assigned,
          available: [],
          assignedToOtherOperators: [],
        });
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
              <Modal.CloseTrigger aria-label="Đóng chi tiết người dùng" />
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
                      onPress={() => {
                        service.invalidateCache?.();
                        setRetryCount((count) => count + 1);
                      }}
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
                      <Avatar.Fallback>
                        {getInitials(user.fullName)}
                      </Avatar.Fallback>
                    </Avatar>
                    <div>
                      <Typography type="h5">{user.fullName}</Typography>
                      <Typography className="mt-1 text-muted">
                        {USER_ROLE_LABELS[user.role]}
                      </Typography>
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
                        <Typography className="font-semibold">
                          Locker được phân công
                        </Typography>
                        <Button
                          size="sm"
                          variant="tertiary"
                          onPress={() => onManageLockers(user.id)}
                        >
                          Quản lý tủ
                        </Button>
                      </div>
                      {assignment?.assigned.length ? (
                        <Card className="mt-3" variant="secondary">
                          <Card.Content>
                            {assignment.assigned.map((locker, index) => (
                              <div key={locker.id}>
                                {index ? <Separator /> : null}
                                <Typography className="py-2">
                                  <span className="font-medium">
                                    {locker.code}
                                  </span>
                                  <span className="text-muted">
                                    {' '}
                                    · {locker.buildingName} —{' '}
                                    {locker.locationLabel}
                                  </span>
                                </Typography>
                              </div>
                            ))}
                          </Card.Content>
                        </Card>
                      ) : (
                        <Typography className="mt-2 text-muted">
                          Chưa được phân công Locker.
                        </Typography>
                      )}
                    </section>
                  ) : null}
                </div>
              ) : null}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="primary" onPress={onClose}>
                Đóng
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
