// Run explicitly from the local Vite tab after signing in through the normal UI:
// await (await import('/tests/user-management-local-smoke.mjs')).runLocalUserManagementSmoke()
// Creates ONE test Operator, uses up to two available seeded lockers, then unassigns them.
// The test account remains: this backend has no user-delete endpoint.
import { API_BASE_URL } from '/src/config/api.ts';
import { userManagementService as service } from '/src/services/user-management-service.ts';

let running = false;

export async function runLocalUserManagementSmoke({ testDuplicate = false } = {}) {
  if (location.origin !== 'http://localhost:5173' || API_BASE_URL !== 'http://localhost:5005') {
    throw new Error('Chỉ chạy kiểm thử tại frontend localhost:5173 và backend localhost:5005.');
  }
  if (running) throw new Error('Kiểm thử đang chạy.');
  running = true;

  const checks = [];
  let createdOperatorId;
  let cleanupNeeded = false;
  const requireSuccess = (result) => {
    if (!result.success) {
      const error = new Error(result.error.message);
      error.retryAfterMs = result.error.retryAfterMs;
      throw error;
    }
    return result.data;
  };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  let outcome;

  try {
    const lockers = requireSuccess(await service.getAvailableLockers());
    checks.push('Đọc tủ và phân công từ dữ liệu local');
    const lockerIds = lockers.slice(0, 2).map((locker) => locker.id);
    const suffix = crypto.randomUUID().replaceAll('-', '');
    const request = {
      fullName: `Kiểm thử tích hợp ${suffix.slice(0, 8)}`,
      email: `fe-smoke-${suffix}@example.test`,
      phoneNumber: `09${String(crypto.getRandomValues(new Uint32Array(1))[0] % 100000000).padStart(8, '0')}`,
      lockerIds,
    };
    const creation = await service.createOperator(request);

    createdOperatorId = creation.success ? creation.data.id : creation.error.createdOperatorId;
    cleanupNeeded = Boolean(createdOperatorId);
    const operator = requireSuccess(creation);
    const detail = requireSuccess(await service.getUserById(operator.id));

    assert(detail.role === 'LOCKER_OPERATOR', 'Vai trò tài khoản tạo mới không đúng.');
    assert(detail.assignedLockerCount === lockerIds.length, 'Số tủ sau tạo chưa khớp.');
    const list = requireSuccess(await service.getUsers({
      role: 'LOCKER_OPERATOR', search: request.email, status: 'ALL',
      sortDescriptor: { column: 'createdAt', direction: 'descending' }, page: 1, pageSize: 20,
    }));

    assert(list.items.some((user) => user.id === operator.id), 'Chưa tìm thấy tài khoản qua API danh sách.');
    checks.push('Tạo Operator, tải lại chi tiết và danh sách');
    if (testDuplicate) {
      const duplicate = await service.createOperator({ ...request, lockerIds: [] });

      assert(!duplicate.success, 'Tạo trùng tài khoản không bị từ chối.');
      assert(duplicate.error.message.includes('Email hoặc số điện thoại đã được sử dụng'), 'Chưa xác nhận được lỗi trùng email/số điện thoại.');
      checks.push('Từ chối trùng thành công: HTTP 409 là kết quả mong đợi');
    }
    if (lockerIds.length) {
      requireSuccess(await service.updateLockerAssignments({ operatorId: operator.id, lockerIds: [] }));
      assert(requireSuccess(await service.getUserById(operator.id)).assignedLockerCount === 0, 'Bỏ phân công chưa được lưu.');
      checks.push('Bỏ toàn bộ phân công và đọc lại');
      requireSuccess(await service.updateLockerAssignments({ operatorId: operator.id, lockerIds }));
      assert(requireSuccess(await service.getUserById(operator.id)).assignedLockerCount === lockerIds.length, 'Phân công lại chưa được lưu.');
      checks.push('Phân công lại tủ và đọc lại');
    } else {
      checks.push('Chưa kiểm thử ghi phân công: dữ liệu seed không có tủ trống');
    }
    outcome = { success: true, checks, createdOperatorId };
  } catch (error) {
    outcome = {
      success: false, checks, createdOperatorId,
      message: error instanceof Error ? error.message : 'Kiểm thử chưa hoàn tất.',
      retryAfterMs: error.retryAfterMs,
    };
  } finally {
    if (cleanupNeeded && !outcome.retryAfterMs) {
      const cleanup = await service.updateLockerAssignments({ operatorId: createdOperatorId, lockerIds: [] });

      outcome.cleanupSucceeded = cleanup.success;
      if (!cleanup.success) {
        outcome.success = false;
        outcome.cleanupMessage = 'Cần kiểm tra phân công còn lại của tài khoản kiểm thử.';
      }
    }
    if (cleanupNeeded && outcome.retryAfterMs) {
      outcome.cleanupSucceeded = false;
      outcome.cleanupMessage = 'Đang giới hạn yêu cầu. Sau thời gian chờ, dùng cleanupLocalUserManagementSmoke(createdOperatorId) để bỏ phân công của tài khoản thử.';
    }
    running = false;
  }

  // Only a safe summary is returned. No token, password, header, or raw API response.
  return outcome;
}

export async function cleanupLocalUserManagementSmoke(operatorId) {
  if (location.origin !== 'http://localhost:5173' || API_BASE_URL !== 'http://localhost:5005') throw new Error('Chỉ chạy trên local.');
  const result = await service.getUserById(operatorId);

  if (!result.success) return { success: false, message: result.error.message };
  if (result.data.role !== 'LOCKER_OPERATOR' || !result.data.email.startsWith('fe-smoke-') || !result.data.email.endsWith('@example.test') || !result.data.fullName.startsWith('Kiểm thử tích hợp ')) {
    throw new Error('Tài khoản này không phải tài khoản do smoke test tạo.');
  }
  const cleanup = await service.updateLockerAssignments({ operatorId, lockerIds: [] });

  return cleanup.success ? { success: true, assignedLockerCount: cleanup.data.assignedLockerCount } : { success: false, message: cleanup.error.message };
}
