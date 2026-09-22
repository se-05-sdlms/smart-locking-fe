import type {
  CreateOperatorRequest,
  Locker,
  LockAccountRequest,
  ManagedUserView,
  OperatorUserView,
  ServiceFailure,
  ServiceResult,
  UnlockAccountRequest,
  UpdateLockerAssignmentRequest,
  UserManagementErrorCode,
  UserManagementService,
} from '@/types/user-management';
import type {
  AssignOperatorDto,
  CreatedUserDto,
  CreateOperatorDto,
  LockerSummaryDto,
  UpdateUserStatusDto,
  UserDetailDto,
  UserListItemDto,
  UsersPageDto,
} from '@/types/user-management-api';

import {
  OPERATOR_LOCK_REASONS,
  RESIDENT_LOCK_REASONS,
  UNLOCK_REASONS,
} from '@/constants/user-management';
import { ApiError } from '@/services/api-client';
import { queryUserViews } from '@/services/user-management-query';
import {
  invalidateUserManagementReads,
  readUserManagement,
  userManagementRequest as apiRequest,
  userManagementRetryAfterMs,
} from '@/services/user-management-requests';

const LOAD_TIMEOUT_MS = 20_000;
const MUTATION_TIMEOUT_MS = 60_000;
const MAX_PAGES = 100;
const BACKEND_PAGE_SIZE = 100;

class UserManagementError extends Error {
  constructor(
    public readonly code: UserManagementErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function unsupported(message: string): never {
  throw new UserManagementError('UNSUPPORTED_CONTRACT', message);
}

function failure(error: unknown): ServiceFailure {
  if (error instanceof UserManagementError) {
    return {
      success: false,
      error: { code: error.code, message: error.message },
    };
  }

  let message = 'Không thể tải hoặc cập nhật dữ liệu. Vui lòng thử lại.';

  if (error instanceof ApiError) {
    if (error.status === 429) {
      const retryAfterMs = userManagementRetryAfterMs() || 60_000;

      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          retryAfterMs,
          message: `Máy chủ đang giới hạn số yêu cầu. Vui lòng thử lại sau khoảng ${Math.ceil(retryAfterMs / 1000)} giây.`,
        },
      };
    }
    if (error.status === 0) message = 'Không thể kết nối đến máy chủ.';
    if (error.status === 408)
      message = 'Yêu cầu hết thời gian chờ. Vui lòng thử lại.';
    if (error.status === 401)
      message = 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.';
    if (error.status === 403)
      message = 'Bạn không có quyền thực hiện thao tác này.';
    if (error.status === 404)
      message = 'Không tìm thấy tài khoản hoặc tủ đã chọn.';
    if (error.status === 400)
      message = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra và thử lại.';
    if (error.status === 409)
      message = 'Dữ liệu đã thay đổi hoặc bị trùng. Vui lòng tải lại.';
  }

  // Never expose arbitrary backend payloads or exception details in the UI.
  return { success: false, error: { code: 'SERVICE_ERROR', message } };
}

async function run<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  onError: (error: unknown) => ServiceFailure = failure,
  timeoutMs = LOAD_TIMEOUT_MS,
): Promise<ServiceResult<T>> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const deadline = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        reject(new ApiError(408, ''));
        controller.abort();
      }, timeoutMs);
    });
    const data = await Promise.race([operation(controller.signal), deadline]);

    return { success: true, data };
  } catch (error) {
    controller.abort();

    return onError(error);
  } finally {
    clearTimeout(timeout);
  }
}

function mapUser(user: UserListItemDto | UserDetailDto): ManagedUserView {
  if (user.role !== 1 && user.role !== 2) {
    return unsupported('Vai trò tài khoản chưa được hỗ trợ trên màn hình này.');
  }
  if (user.status !== 0 && user.status !== 2) {
    return unsupported(
      'Có tài khoản bị vô hiệu hóa hoặc có trạng thái chưa được hỗ trợ. Không thể tự đổi thành trạng thái đã khóa.',
    );
  }

  const common = {
    id: user.id,
    fullName: user.fullName,
    email: user.email ?? '',
    phoneNumber: user.phoneNumber ?? '',
    status: user.status === 0 ? ('ACTIVE' as const) : ('LOCKED' as const),
    ...('avatarUrl' in user ? { avatarUrl: user.avatarUrl ?? undefined } : {}),
  };

  return user.role === 2
    ? {
        ...common,
        role: 'LOCKER_OPERATOR',
        // Display placeholder only, never generate a fake employee identifier.
        employeeCode: 'Chưa có dữ liệu',
        createdAt: user.createdAt,
        assignedLockerCount:
          'assignments' in user
            ? user.assignments.filter((item) => item.revokedAt === null).length
            : user.activeAssignmentsCount,
      }
    : { ...common, role: 'RESIDENT', registeredAt: user.createdAt };
}

async function loadUsers(
  role: 1 | 2,
  signal: AbortSignal,
  fresh = false,
): Promise<UserListItemDto[]> {
  const users: UserListItemDto[] = [];
  const ids = new Set<string>();
  let expectedTotal: number | undefined;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    signal.throwIfAborted();
    const response = await readUserManagement<UsersPageDto>(
      `/api/Users?Role=${role}&PageNumber=${page}&PageSize=${BACKEND_PAGE_SIZE}`,
      signal,
      fresh,
    );

    if (
      !Array.isArray(response.items) ||
      !Number.isSafeInteger(response.totalCount) ||
      response.totalCount < 0 ||
      response.pageNumber !== page ||
      response.pageSize !== BACKEND_PAGE_SIZE ||
      (expectedTotal !== undefined && response.totalCount !== expectedTotal)
    ) {
      throw new UserManagementError(
        'SERVICE_ERROR',
        'Danh sách đã thay đổi hoặc không hợp lệ. Vui lòng tải lại.',
      );
    }
    expectedTotal = response.totalCount;
    for (const user of response.items) {
      if (user.role !== role || ids.has(user.id)) {
        throw new UserManagementError(
          'SERVICE_ERROR',
          'Danh sách đã thay đổi. Vui lòng tải lại.',
        );
      }
      ids.add(user.id);
      users.push(user);
    }
    if (users.length === expectedTotal) return users;
    if (!response.items.length || users.length > expectedTotal) break;
  }

  throw new UserManagementError(
    'SERVICE_ERROR',
    'Không thể tải đầy đủ danh sách. Vui lòng thử lại hoặc thu hẹp phạm vi dữ liệu.',
  );
}

async function loadUser(
  id: string,
  signal: AbortSignal,
  fresh = false,
): Promise<UserDetailDto> {
  signal.throwIfAborted();

  return readUserManagement<UserDetailDto>(
    `/api/Users/${encodeURIComponent(id.trim())}`,
    signal,
    fresh,
  );
}

async function loadLockerSnapshot(
  signal: AbortSignal,
  fresh = false,
): Promise<Locker[]> {
  const [lockers, operators] = await Promise.all([
    readUserManagement<LockerSummaryDto[]>('/api/Lockers', signal, fresh),
    loadUsers(2, signal, fresh),
  ]);
  const owners = new Map<string, string>();

  // No owner is supplied by /Lockers. Derive it only from active assignments.
  // Limit parallel reads; include locked/disabled operators, which still own assignments.
  const assignedOperators = operators.filter(
    (operator) => operator.activeAssignmentsCount > 0,
  );

  for (let offset = 0; offset < assignedOperators.length; offset += 3) {
    signal.throwIfAborted();
    const details = await Promise.all(
      assignedOperators
        .slice(offset, offset + 3)
        .map((operator) => loadUser(operator.id, signal, fresh)),
    );

    for (const operator of details) {
      for (const assignment of operator.assignments) {
        if (assignment.revokedAt !== null) continue;
        const owner = owners.get(assignment.lockerId);

        if (owner && owner !== operator.id) {
          unsupported(
            'Một tủ đang được phân công cho nhiều nhân viên. Cần xử lý dữ liệu phân công trước khi tiếp tục.',
          );
        }
        owners.set(assignment.lockerId, operator.id);
      }
    }
  }

  const lockerIds = new Set(lockers.map((locker) => locker.id));

  if ([...owners.keys()].some((id) => !lockerIds.has(id))) {
    throw new UserManagementError(
      'SERVICE_ERROR',
      'Dữ liệu tủ và phân công chưa đồng nhất. Vui lòng tải lại.',
    );
  }

  return lockers.map((locker) => ({
    id: locker.id,
    code: locker.code,
    buildingName: 'Chưa có dữ liệu',
    locationLabel: locker.address,
    assignedOperatorId: owners.get(locker.id) ?? null,
  }));
}

const pendingStatusChanges = new Map<
  string,
  Promise<ServiceResult<ManagedUserView>>
>();

function changeStatus(
  request: LockAccountRequest | UnlockAccountRequest,
  status: 0 | 2,
): Promise<ServiceResult<ManagedUserView>> {
  const userId = request.userId.trim();

  if (pendingStatusChanges.has(userId)) {
    return Promise.resolve(
      failure(
        new UserManagementError(
          'VALIDATION_ERROR',
          'Tài khoản đang được cập nhật. Vui lòng chờ.',
        ),
      ),
    );
  }

  const operation = run(async (signal) => {
    // Recheck role/status before mutation; never reactivate Disabled accounts implicitly.
    const current = mapUser(await loadUser(userId, signal, true));
    const options =
      status === 0
        ? UNLOCK_REASONS
        : current.role === 'LOCKER_OPERATOR'
          ? OPERATOR_LOCK_REASONS
          : RESIDENT_LOCK_REASONS;
    const option = options.find((item) => item.code === request.reasonCode);
    const reason =
      request.reasonCode === 'OTHER'
        ? request.reasonDetail?.trim()
        : option?.label;

    if (!option || !reason) {
      throw new UserManagementError(
        'INVALID_REASON',
        'Vui lòng chọn lý do hợp lệ và nhập chi tiết cho lý do khác.',
      );
    }
    if (current.status === (status === 0 ? 'ACTIVE' : 'LOCKED')) return current;

    const body: UpdateUserStatusDto = { status, reason };

    signal.throwIfAborted();

    invalidateUserManagementReads(userId);

    try {
      return mapUser(
        await apiRequest<UserDetailDto>(
          `/api/Users/${encodeURIComponent(userId)}/status`,
          {
            method: 'PUT',
            body: JSON.stringify(body),
            signal,
          },
        ),
      );
    } finally {
      invalidateUserManagementReads(userId);
    }
  });

  pendingStatusChanges.set(userId, operation);
  void operation.finally(() => pendingStatusChanges.delete(userId));

  return operation;
}

// Serialize create/assignment writes in this tab, including operations on the same locker.
// Other clients still require backend uniqueness/transactions for concurrency safety.
let operatorMutationPending = false;

async function mutateOperator(
  operation: (signal: AbortSignal) => Promise<OperatorUserView>,
  onError: (error: unknown) => ServiceFailure,
): Promise<ServiceResult<OperatorUserView>> {
  if (operatorMutationPending) {
    return failure(
      new UserManagementError(
        'VALIDATION_ERROR',
        'Đang lưu thay đổi. Vui lòng chờ.',
      ),
    );
  }
  operatorMutationPending = true;

  try {
    return await run(operation, onError, MUTATION_TIMEOUT_MS);
  } finally {
    operatorMutationPending = false;
  }
}

function requireOperator(user: UserDetailDto): OperatorUserView {
  const view = mapUser(user);

  if (view.role !== 'LOCKER_OPERATOR') {
    throw new UserManagementError(
      'OPERATOR_NOT_FOUND',
      'Tài khoản không phải nhân viên vận hành.',
    );
  }

  return view;
}

function normalizeLockerIds(ids: string[]): string[] {
  const normalized = ids.map((id) => id.trim());

  if (
    normalized.some((id) => !id) ||
    new Set(normalized).size !== normalized.length
  ) {
    throw new UserManagementError(
      'VALIDATION_ERROR',
      'Danh sách tủ không hợp lệ hoặc có tủ bị chọn trùng.',
    );
  }

  return normalized;
}

async function validateLockerSelection(
  ids: string[],
  signal: AbortSignal,
  operatorId?: string,
) {
  const lockers = await loadLockerSnapshot(signal, true);

  for (const id of ids) {
    const locker = lockers.find((item) => item.id === id);

    if (!locker)
      throw new UserManagementError(
        'LOCKER_NOT_FOUND',
        'Không tìm thấy tủ đã chọn.',
      );
    if (
      locker.assignedOperatorId !== null &&
      locker.assignedOperatorId !== operatorId
    ) {
      throw new UserManagementError(
        'LOCKER_CONFLICT',
        'Tủ đã chọn đang được nhân viên khác quản lý. Vui lòng tải lại danh sách.',
      );
    }
  }

  return lockers;
}

async function saveAssignments(
  operatorId: string,
  lockerIds: string[],
  signal: AbortSignal,
  beforeWrite: () => void,
  selectionAlreadyChecked = false,
): Promise<OperatorUserView> {
  const current = await loadUser(operatorId, signal, true);

  requireOperator(current);

  const active = current.assignments.filter(
    (assignment) => assignment.revokedAt === null,
  );
  const currentIds = new Set(active.map((assignment) => assignment.lockerId));
  const desiredIds = new Set(lockerIds);
  const basePath = `/api/Users/${encodeURIComponent(operatorId)}/assignments`;
  const addedIds = lockerIds.filter((id) => !currentIds.has(id));

  // Removing assignments only needs this operator's assignment IDs. A fresh owner
  // scan is needed once for additions, not for removal/no-op or after each write.
  if (addedIds.length && !selectionAlreadyChecked)
    await validateLockerSelection(addedIds, signal, operatorId);

  // Existing API applies one write at a time. Stop on failure; do not invent rollback.
  for (const lockerId of addedIds) {
    signal.throwIfAborted();
    beforeWrite();

    const body: AssignOperatorDto = {
      lockerId,
      reason: 'Cập nhật phân công tủ bởi quản trị viên',
    };

    await apiRequest(basePath, {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    });
  }
  for (const assignment of active.filter(
    (item) => !desiredIds.has(item.lockerId),
  )) {
    signal.throwIfAborted();
    beforeWrite();
    await apiRequest(
      `${basePath}/${encodeURIComponent(assignment.id)}?reason=${encodeURIComponent('Thu hồi phân công bởi quản trị viên')}`,
      { method: 'DELETE', signal },
    );
  }

  // Only backend reads determine success and the resulting locker count.
  const saved = await loadUser(operatorId, signal, true);
  const actualIds = new Set(
    saved.assignments
      .filter((item) => item.revokedAt === null)
      .map((item) => item.lockerId),
  );

  if (
    actualIds.size !== desiredIds.size ||
    [...actualIds].some((id) => !desiredIds.has(id))
  ) {
    throw new UserManagementError(
      'SERVICE_ERROR',
      'Phân công thực tế chưa khớp danh sách đã chọn. Vui lòng kiểm tra lại.',
    );
  }

  return requireOperator(saved);
}

function updateLockerAssignments(
  request: UpdateLockerAssignmentRequest,
): Promise<ServiceResult<OperatorUserView>> {
  let writeAttempted = false;

  return mutateOperator(
    async (signal) => {
      const ids = normalizeLockerIds(request.lockerIds);

      try {
        return await saveAssignments(
          request.operatorId.trim(),
          ids,
          signal,
          () => {
            writeAttempted = true;
            invalidateUserManagementReads(request.operatorId);
          },
        );
      } finally {
        if (writeAttempted) invalidateUserManagementReads(request.operatorId);
      }
    },
    (error) => {
      const result = failure(error);

      if (writeAttempted) {
        result.error.reloadRequired = true;
        result.error.message = `Chưa xác nhận lưu đầy đủ phân công; một số thay đổi có thể đã được lưu. Hãy kiểm tra danh sách mới trước khi thử lại. ${result.error.message}`;
      }

      return result;
    },
  );
}

function createOperator(
  request: CreateOperatorRequest,
): Promise<ServiceResult<OperatorUserView>> {
  let createdOperatorId = request.createdOperatorId;
  let createAttempted = false;

  return mutateOperator(
    async (signal) => {
      const fullName = request.fullName.trim();
      const email = request.email.trim().toLowerCase();
      const phoneNumber = request.phoneNumber.trim().replace(/[\s().-]/g, '');
      const lockerIds = normalizeLockerIds(request.lockerIds);

      if (!fullName)
        throw new UserManagementError(
          'VALIDATION_ERROR',
          'Vui lòng nhập họ và tên.',
        );
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new UserManagementError(
          'INVALID_EMAIL',
          'Địa chỉ email không hợp lệ.',
        );
      if (!/^\+?\d{9,15}$/.test(phoneNumber))
        throw new UserManagementError(
          'INVALID_PHONE',
          'Số điện thoại không hợp lệ.',
        );
      if (request.avatarUrl) {
        throw new UserManagementError(
          'VALIDATION_ERROR',
          'Chưa hỗ trợ lưu ảnh đại diện. Vui lòng bỏ ảnh trước khi thêm nhân viên.',
        );
      }

      if (createdOperatorId) {
        const existing = await loadUser(createdOperatorId, signal);

        requireOperator(existing);
        if (
          existing.fullName !== fullName ||
          existing.email !== email ||
          existing.phoneNumber !== phoneNumber
        ) {
          throw new UserManagementError(
            'VALIDATION_ERROR',
            'Tài khoản đã được tạo. Vui lòng giữ nguyên thông tin và chỉ tiếp tục phân công tủ.',
          );
        }
      } else {
        if (lockerIds.length) await validateLockerSelection(lockerIds, signal);

        const body: CreateOperatorDto = {
          fullName,
          email,
          phoneNumber,
          role: 2,
          password: null,
          lockerId: lockerIds[0] ?? null,
          assignmentReason: lockerIds.length
            ? 'Phân công ban đầu khi tạo tài khoản'
            : null,
        };

        signal.throwIfAborted();
        invalidateUserManagementReads();
        createAttempted = true;

        const response = await apiRequest<CreatedUserDto>('/api/Users', {
          method: 'POST',
          body: JSON.stringify(body),
          signal,
        });

        if (!response || typeof response.id !== 'string' || !response.id) {
          throw new UserManagementError(
            'SERVICE_ERROR',
            'Chưa nhận được mã tài khoản đã tạo.',
          );
        }
        createdOperatorId = response.id;
      }

      try {
        return await saveAssignments(
          createdOperatorId,
          lockerIds,
          signal,
          () => {
            invalidateUserManagementReads(createdOperatorId);
          },
          createAttempted,
        );
      } finally {
        invalidateUserManagementReads(createdOperatorId);
      }
    },
    (error) => {
      const result = failure(error);

      if (createdOperatorId) {
        result.error.createdOperatorId = createdOperatorId;
        result.error.reloadRequired = true;
        result.error.message = `Tài khoản đã được tạo nhưng chưa hoàn tất xác nhận hoặc phân công tủ. Bấm gửi lại để tiếp tục trên cùng tài khoản. ${result.error.message}`;
      } else if (
        createAttempted &&
        !(
          error instanceof ApiError &&
          [400, 401, 403, 404, 409, 429].includes(error.status)
        )
      ) {
        result.error.reloadRequired = true;
        result.error.message =
          'Chưa xác định được kết quả tạo tài khoản. Hãy đóng biểu mẫu và kiểm tra danh sách trước khi tạo lại.';
      } else if (error instanceof ApiError && error.status === 409) {
        result.error.message =
          'Email hoặc số điện thoại đã được sử dụng. Vui lòng kiểm tra lại.';
      }

      return result;
    },
  );
}

export const userManagementService: UserManagementService = {
  invalidateCache: () => invalidateUserManagementReads(),
  getUserDetail: (id) =>
    run(async (signal) => {
      const detail = await loadUser(id, signal);
      const user = mapUser(detail);
      const active = detail.assignments.filter(
        (assignment) => assignment.revokedAt === null,
      );
      const lockers =
        user.role === 'LOCKER_OPERATOR' && active.length
          ? await readUserManagement<LockerSummaryDto[]>('/api/Lockers', signal)
          : [];

      return {
        user,
        assigned: active.map((assignment) => {
          const locker = lockers.find(
            (item) => item.id === assignment.lockerId,
          );

          return {
            id: assignment.lockerId,
            code: locker?.code ?? assignment.lockerCode ?? 'Chưa có dữ liệu',
            buildingName: 'Chưa có dữ liệu',
            locationLabel: locker?.address ?? 'Chưa có dữ liệu',
            assignedOperatorId: detail.id,
          };
        }),
      };
    }),
  getUsers: (filters) =>
    run(async (signal) => {
      const users = await loadUsers(
        filters.role === 'LOCKER_OPERATOR' ? 2 : 1,
        signal,
      );
      const selected =
        filters.status === 'ALL'
          ? users
          : users.filter(
              (user) => user.status === (filters.status === 'ACTIVE' ? 0 : 2),
            );

      return queryUserViews(selected.map(mapUser), filters);
    }),
  getUserById: (id) =>
    run(async (signal) => mapUser(await loadUser(id, signal))),
  getAvailableLockers: () =>
    run(async (signal) =>
      (await loadLockerSnapshot(signal)).filter(
        (locker) => locker.assignedOperatorId === null,
      ),
    ),
  getLockerAssignment: (operatorId) =>
    run(async (signal) => {
      const operator = await loadUser(operatorId, signal);

      if (operator.role !== 2)
        unsupported('Tài khoản không phải nhân viên vận hành.');
      const lockers = await loadLockerSnapshot(signal);

      return {
        assigned: lockers.filter(
          (locker) => locker.assignedOperatorId === operator.id,
        ),
        available: lockers.filter(
          (locker) => locker.assignedOperatorId === null,
        ),
        assignedToOtherOperators: lockers.filter(
          (locker) =>
            locker.assignedOperatorId !== null &&
            locker.assignedOperatorId !== operator.id,
        ),
      };
    }),
  lockAccount: (request) => changeStatus(request, 2),
  unlockAccount: (request) => changeStatus(request, 0),
  createOperator,
  updateLockerAssignments,
  getAuditRecords: () =>
    run(async () => unsupported('Chưa hỗ trợ xem nhật ký trên màn hình này.')),
};
