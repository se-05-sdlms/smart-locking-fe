import type {
  EmergencyUnlock,
  EmergencyUnlockBlocker,
  EmergencyUnlockRequestDto,
  EmergencyUnlockResponseDto,
  EmergencyUnlockResult,
} from '@/types/emergency-unlock';
import type {
  OperatorCompartment,
  OperatorLocker,
} from '@/types/operator-locker';

import {
  EMERGENCY_REASON_MAX_LENGTH,
  EMERGENCY_REASON_MIN_LENGTH,
} from '@/constants/emergency-unlock';
import { ApiError, apiRequest } from '@/services/api-client';

const RESULTS = ['Pending', 'Succeeded', 'Failed'] as const;

export function toEmergencyUnlockResult(value: unknown): EmergencyUnlockResult {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return RESULTS[value] ?? 'Failed';
  }

  if (
    typeof value === 'string' &&
    (RESULTS as readonly string[]).includes(value)
  ) {
    return value as EmergencyUnlockResult;
  }

  // Never report success for a value the UI does not understand.
  return 'Failed';
}

export function mapEmergencyUnlock(
  dto: EmergencyUnlockResponseDto,
): EmergencyUnlock {
  return {
    id: dto.id,
    result: toEmergencyUnlockResult(dto.result),
    compartmentCode: dto.compartmentCode,
    requestedAt: dto.requestedAt,
  };
}

export function validateEmergencyReason(value: string) {
  const reason = value.trim();

  if (!reason) return 'Vui lòng nhập lý do mở khẩn cấp.';

  if (reason.length < EMERGENCY_REASON_MIN_LENGTH) {
    return `Lý do phải có ít nhất ${EMERGENCY_REASON_MIN_LENGTH} ký tự.`;
  }

  if (reason.length > EMERGENCY_REASON_MAX_LENGTH) {
    return `Lý do không được vượt quá ${EMERGENCY_REASON_MAX_LENGTH} ký tự.`;
  }

  return undefined;
}

/**
 * Conditions under which the backend records the emergency unlock as Failed
 * without contacting the device (LockerAccessService.GetBlockedReason).
 */
export function getEmergencyUnlockBlockers(
  locker: Pick<OperatorLocker, 'operationalStatus' | 'connectionStatus'>,
  compartment: Pick<OperatorCompartment, 'operationalStatus'>,
): EmergencyUnlockBlocker[] {
  const blockers: EmergencyUnlockBlocker[] = [];

  if (locker.operationalStatus !== 'Operational') {
    blockers.push('locker-not-operational');
  }

  if (locker.connectionStatus !== 'Online') blockers.push('locker-not-online');

  if (compartment.operationalStatus !== 'Operational') {
    blockers.push('compartment-not-operational');
  }

  return blockers;
}

export function buildEmergencyUnlockRequest(
  lockerId: string,
  compartmentId: string,
  reason: string,
): EmergencyUnlockRequestDto {
  // Emergency unlock is not tied to an incident from this screen (issue #15).
  return { lockerId, compartmentId, incidentId: null, reason: reason.trim() };
}

/** `POST /api/emergency-unlocks` — the backend audits every attempt. */
export async function createEmergencyUnlock(
  lockerId: string,
  compartmentId: string,
  reason: string,
): Promise<EmergencyUnlock> {
  const response = await apiRequest<EmergencyUnlockResponseDto>(
    '/api/emergency-unlocks',
    {
      method: 'POST',
      body: JSON.stringify(
        buildEmergencyUnlockRequest(lockerId, compartmentId, reason),
      ),
    },
  );

  return mapEmergencyUnlock(response);
}

export function getEmergencyUnlockErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 0:
        return 'Không thể kết nối đến máy chủ. Lệnh mở chưa được gửi, vui lòng thử lại.';
      case 400:
        return 'Thông tin mở khẩn cấp không hợp lệ. Kiểm tra lý do (tối thiểu 10 ký tự) và ngăn đã chọn.';
      case 401:
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      case 403:
        return 'Tủ này không thuộc phạm vi bạn được phân công.';
      case 404:
        return 'Không tìm thấy ngăn tủ. Dữ liệu có thể đã thay đổi, vui lòng tải lại.';
      case 408:
        // The request may still have reached the device; avoid a blind retry.
        return 'Máy chủ phản hồi quá chậm. Hãy kiểm tra Lịch sử vận hành và cửa ngăn trước khi thử lại.';
      case 409:
        return 'Trạng thái tủ đã thay đổi. Vui lòng tải lại rồi thử lại.';
      case 429:
        return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
      default:
        if (error.status >= 500) {
          return 'Máy chủ đang gặp sự cố. Hãy kiểm tra Lịch sử vận hành trước khi thử lại.';
        }
    }
  }

  return 'Không thể mở khẩn cấp. Vui lòng thử lại.';
}
