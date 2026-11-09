import type {
  CompartmentFilter,
  CompartmentStatusAction,
  ConnectionStatus,
  DoorStatus,
  LockerCompartmentResponseDto,
  LockerDetailResponseDto,
  LockerHistoryItem,
  LockerListFilter,
  LockerSummaryResponseDto,
  OperationalRecordResponseDto,
  OperationalStatus,
  OperationalStatusDto,
  OperatorCompartment,
  OperatorLocker,
  OperatorLockerDetail,
  UpdateCompartmentStatusRequestDto,
} from '@/types/operator-locker';

// Backend enum order (smart-locking-be Domain/Enums/LockerEnums.cs).
const OPERATIONAL_STATUSES = [
  'Operational',
  'OutOfService',
  'Inactive',
] as const;
const CONNECTION_STATUSES = ['Online', 'Offline', 'Unknown'] as const;
const DOOR_STATUSES = ['Open', 'Closed', 'Unknown'] as const;

/**
 * Maps a backend enum that is serialized as a number today. String names are
 * accepted too, so enabling JsonStringEnumConverter on the backend later does
 * not break the UI. Unexpected values become `fallback` instead of crashing.
 */
function mapEnum<T extends string>(
  value: unknown,
  names: readonly T[],
  fallback: T,
): T {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return names[value] ?? fallback;
  }

  if (
    typeof value === 'string' &&
    (names as readonly string[]).includes(value)
  ) {
    return value as T;
  }

  return fallback;
}

export function toOperationalStatus(value: unknown): OperationalStatus {
  return mapEnum<OperationalStatus>(value, OPERATIONAL_STATUSES, 'Unknown');
}

export function toConnectionStatus(value: unknown): ConnectionStatus {
  return mapEnum<ConnectionStatus>(value, CONNECTION_STATUSES, 'Unknown');
}

export function toDoorStatus(value: unknown): DoorStatus {
  return mapEnum<DoorStatus>(value, DOOR_STATUSES, 'Unknown');
}

export function toOperationalStatusDto(
  status: 'Operational' | 'OutOfService',
): OperationalStatusDto {
  return OPERATIONAL_STATUSES.indexOf(status) as OperationalStatusDto;
}

// ---------------------------------------------------------------------------
// DTO -> view model
// ---------------------------------------------------------------------------

export function mapLockerSummary(
  dto: LockerSummaryResponseDto,
): OperatorLocker {
  return {
    id: dto.id,
    code: dto.code,
    address: dto.address,
    recoveryAddress: dto.recoveryAddress,
    deviceIdentifier: dto.deviceIdentifier,
    operationalStatus: toOperationalStatus(dto.operationalStatus),
    connectionStatus: toConnectionStatus(dto.connectionStatus),
    lastSeenAt: dto.lastSeenAt,
    totalCompartments: dto.totalCompartments,
    activeCompartments: dto.activeCompartments,
  };
}

export function mapCompartment(
  dto: LockerCompartmentResponseDto,
): OperatorCompartment {
  return {
    id: dto.id,
    lockerId: dto.lockerId,
    code: dto.code,
    hardwareCode: dto.hardwareCode,
    hardwareChannel: dto.hardwareChannel,
    operationalStatus: toOperationalStatus(dto.operationalStatus),
    doorStatus: toDoorStatus(dto.doorStatus),
    updatedAt: dto.updatedAt,
  };
}

export function sortCompartments(
  compartments: OperatorCompartment[],
): OperatorCompartment[] {
  return [...compartments].sort((left, right) =>
    left.code.localeCompare(right.code, 'vi', { numeric: true }),
  );
}

export function mapLockerDetail(
  dto: LockerDetailResponseDto,
): OperatorLockerDetail {
  const compartments = sortCompartments(dto.compartments.map(mapCompartment));

  return {
    id: dto.id,
    code: dto.code,
    address: dto.address,
    recoveryAddress: dto.recoveryAddress,
    deviceIdentifier: dto.deviceIdentifier,
    operationalStatus: toOperationalStatus(dto.operationalStatus),
    connectionStatus: toConnectionStatus(dto.connectionStatus),
    lastSeenAt: dto.lastSeenAt,
    // The detail endpoint has no counters; derive them the same way the
    // backend does for LockerSummaryResponse.
    totalCompartments: compartments.length,
    activeCompartments: compartments.filter(
      (compartment) => compartment.operationalStatus === 'Operational',
    ).length,
    compartments,
  };
}

export function mapHistoryItem(
  dto: OperationalRecordResponseDto,
): LockerHistoryItem {
  return {
    kind: dto.kind,
    id: dto.id,
    code: dto.code,
    status: dto.status,
    summary: dto.summary,
    occurredAt: dto.occurredAt,
  };
}

/** Replaces one compartment with the server response, keeping order. */
export function replaceCompartment(
  locker: OperatorLockerDetail,
  updated: OperatorCompartment,
): OperatorLockerDetail {
  const compartments = locker.compartments.map((compartment) =>
    compartment.id === updated.id ? updated : compartment,
  );

  return {
    ...locker,
    compartments,
    activeCompartments: compartments.filter(
      (compartment) => compartment.operationalStatus === 'Operational',
    ).length,
  };
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('vi');
}

export function matchesLockerKeyword(locker: OperatorLocker, keyword: string) {
  const needle = normalize(keyword);

  if (!needle) return true;

  return [locker.code, locker.address, locker.deviceIdentifier].some((value) =>
    normalize(value).includes(needle),
  );
}

export function matchesLockerFilter(
  locker: OperatorLocker,
  filter: LockerListFilter,
) {
  switch (filter) {
    case 'online':
      return locker.connectionStatus === 'Online';
    case 'offline':
      return locker.connectionStatus === 'Offline';
    case 'unknown':
      return locker.connectionStatus === 'Unknown';
    case 'out-of-service':
      return locker.operationalStatus === 'OutOfService';
    default:
      return true;
  }
}

export function filterLockers(
  lockers: OperatorLocker[],
  keyword: string,
  filter: LockerListFilter,
) {
  return lockers.filter(
    (locker) =>
      matchesLockerKeyword(locker, keyword) &&
      matchesLockerFilter(locker, filter),
  );
}

export function matchesCompartmentFilter(
  compartment: OperatorCompartment,
  filter: CompartmentFilter,
) {
  switch (filter) {
    case 'operational':
      return compartment.operationalStatus === 'Operational';
    case 'out-of-service':
      return compartment.operationalStatus === 'OutOfService';
    case 'inactive':
      return compartment.operationalStatus === 'Inactive';
    case 'door-open':
      return compartment.doorStatus === 'Open';
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Operational status actions
// ---------------------------------------------------------------------------

/**
 * Which status change the Operator may request. Mirrors the backend:
 * - an Inactive locker rejects every compartment change (400);
 * - Inactive compartments are an Administrator configuration state, so the
 *   Operator only toggles between Operational and OutOfService.
 */
export function getCompartmentStatusAction(
  locker: Pick<OperatorLocker, 'operationalStatus'>,
  compartment: Pick<OperatorCompartment, 'operationalStatus'>,
): CompartmentStatusAction | null {
  if (locker.operationalStatus === 'Inactive') return null;

  if (compartment.operationalStatus === 'Operational') {
    return 'take-out-of-service';
  }

  if (compartment.operationalStatus === 'OutOfService') return 'restore';

  return null;
}

export function getTargetStatus(
  action: CompartmentStatusAction,
): 'Operational' | 'OutOfService' {
  return action === 'restore' ? 'Operational' : 'OutOfService';
}

/**
 * Single place that builds the request body. When the backend accepts a
 * reason (docs/backend-follow-ups.md #11), add it here and add the
 * reason field to the confirmation dialog in locker-detail.tsx.
 */
export function buildCompartmentStatusRequest(
  action: CompartmentStatusAction,
): UpdateCompartmentStatusRequestDto {
  return { operationalStatus: toOperationalStatusDto(getTargetStatus(action)) };
}
