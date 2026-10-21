import type {
  ConnectionStatus,
  OperationalStatus,
} from '@/types/operator-locker';

// smart-locking-be `dev`: OperationsHub sends `operationUpdated` with a
// RealtimeEvent (Type, EntityId, LockerId, Status, Message, OccurredAt).
// Types raised today: LockerConnectionChanged (Status Online/Offline),
// LockerDoorChanged and LockerDeviceAlert (door open too long, device alerts).

export type LockerRealtimeEvent = {
  type: string;
  entityId: string | null;
  lockerId: string | null;
  status: string;
  message: string | null;
  occurredAt: string;
};

export type LockerAlertTone = 'danger' | 'warning' | 'success';

export type LockerAlert = {
  tone: LockerAlertTone;
  title: string;
  description: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const optionalText = (value: unknown) =>
  typeof value === 'string' && value.length > 0 ? value : null;

/** Validates the untrusted hub payload; returns null when it is not an event. */
export function parseRealtimeEvent(value: unknown): LockerRealtimeEvent | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;

  return {
    type: value.type,
    entityId: optionalText(value.entityId),
    lockerId: optionalText(value.lockerId),
    status: typeof value.status === 'string' ? value.status : '',
    message: optionalText(value.message),
    occurredAt:
      typeof value.occurredAt === 'string'
        ? value.occurredAt
        : new Date().toISOString(),
  };
}

/**
 * A Vietnamese alert for events the operator must notice, or null for events
 * that only need a data refresh (e.g. a door that closed normally).
 */
export function describeLockerAlert(
  event: LockerRealtimeEvent,
  lockerCode?: string,
): LockerAlert | null {
  const locker = lockerCode ? `Tủ ${lockerCode}` : 'Một tủ';

  switch (event.type) {
    case 'LockerConnectionChanged':
      if (event.status === 'Offline') {
        return {
          tone: 'danger',
          title: `${locker} mất kết nối`,
          description:
            'Tủ không còn gửi tín hiệu. Mở khẩn cấp bị chặn cho tới khi tủ trực tuyến lại.',
        };
      }

      if (event.status === 'Online') {
        return {
          tone: 'success',
          title: `${locker} đã kết nối lại`,
          description: 'Tủ đã gửi tín hiệu trở lại hệ thống.',
        };
      }

      return null;
    case 'LockerDeviceAlert':
      return {
        tone: 'warning',
        title: `Cảnh báo thiết bị · ${locker}`,
        description: /door/i.test(event.message ?? '')
          ? 'Có ngăn mở cửa quá thời gian cho phép. Kiểm tra ngăn tủ và sự cố liên quan.'
          : 'Thiết bị báo bất thường. Kiểm tra tủ và lịch sử vận hành.',
      };
    default:
      return null;
  }
}

export type EmergencyUnlockAvailability =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Mirrors the backend rule (LockerAccessService): a non-operational locker is
 * always blocked; connection is enforced only when locker monitoring is on, in
 * which case an Offline locker is rejected. `Unknown` (monitoring off, or no
 * heartbeat yet) is left to the backend to decide.
 */
export function getEmergencyUnlockAvailability(locker: {
  connectionStatus: ConnectionStatus;
  operationalStatus: OperationalStatus;
}): EmergencyUnlockAvailability {
  if (locker.connectionStatus === 'Offline') {
    return {
      allowed: false,
      reason:
        'Tủ đang ngoại tuyến nên không thể gửi lệnh mở. Chờ tủ kết nối lại.',
    };
  }

  if (locker.operationalStatus !== 'Operational') {
    return {
      allowed: false,
      reason: 'Tủ đang không vận hành nên không thể mở khẩn cấp.',
    };
  }

  return { allowed: true };
}
