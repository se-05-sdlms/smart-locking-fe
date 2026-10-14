// Operator locker monitoring types.
// `*Dto` types mirror smart-locking-be `dev` (numeric enums, camelCase JSON);
// the other types are the UI view models produced by operator-locker-mappers.

/** `LockerOperationalStatus` / `LockerCompartmentOperationalStatus`. */
export type OperationalStatusDto = 0 | 1 | 2;
/** `LockerConnectionStatus`. */
export type ConnectionStatusDto = 0 | 1 | 2;
/** `DoorStatus`. */
export type DoorStatusDto = 0 | 1 | 2;

export type LockerSummaryResponseDto = {
  id: string;
  code: string;
  address: string;
  recoveryAddress: string;
  deviceIdentifier: string;
  operationalStatus: OperationalStatusDto;
  connectionStatus: ConnectionStatusDto;
  lastSeenAt: string | null;
  totalCompartments: number;
  activeCompartments: number;
  createdAt: string;
  updatedAt: string;
};

export type LockerCompartmentResponseDto = {
  id: string;
  lockerId: string;
  code: string;
  hardwareCode: string;
  hardwareChannel: number;
  operationalStatus: OperationalStatusDto;
  doorStatus: DoorStatusDto;
  createdAt: string;
  updatedAt: string;
};

export type LockerDetailResponseDto = Omit<
  LockerSummaryResponseDto,
  'totalCompartments' | 'activeCompartments'
> & {
  compartments: LockerCompartmentResponseDto[];
};

/** `UpdateCompartmentStatusRequest`. */
export type UpdateCompartmentStatusRequestDto = {
  operationalStatus: OperationalStatusDto;
};

/** `OperationalRecordResponse` (statuses are strings on this endpoint). */
export type OperationalRecordResponseDto = {
  kind: string;
  id: string;
  code: string;
  status: string;
  lockerCode: string;
  summary: string;
  occurredAt: string;
};

export type PagedResponseDto<T> = {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
};

// ---------------------------------------------------------------------------
// View models
// ---------------------------------------------------------------------------

export type OperationalStatus =
  | 'Operational'
  | 'OutOfService'
  | 'Inactive'
  | 'Unknown';

export type ConnectionStatus = 'Online' | 'Offline' | 'Unknown';

export type DoorStatus = 'Open' | 'Closed' | 'Unknown';

export type OperatorLocker = {
  id: string;
  code: string;
  address: string;
  recoveryAddress: string;
  deviceIdentifier: string;
  operationalStatus: OperationalStatus;
  connectionStatus: ConnectionStatus;
  lastSeenAt: string | null;
  totalCompartments: number;
  activeCompartments: number;
};

export type OperatorCompartment = {
  id: string;
  lockerId: string;
  code: string;
  hardwareCode: string;
  hardwareChannel: number;
  operationalStatus: OperationalStatus;
  doorStatus: DoorStatus;
  updatedAt: string;
};

export type OperatorLockerDetail = OperatorLocker & {
  compartments: OperatorCompartment[];
};

export type LockerHistoryItem = {
  kind: string;
  id: string;
  code: string;
  status: string;
  summary: string;
  occurredAt: string;
};

export type LockerListFilter =
  | 'all'
  | 'online'
  | 'offline'
  | 'unknown'
  | 'out-of-service';

export type CompartmentFilter =
  | 'all'
  | 'operational'
  | 'out-of-service'
  | 'inactive'
  | 'door-open';

/** Status change an Operator may request for a compartment. */
export type CompartmentStatusAction = 'take-out-of-service' | 'restore';
