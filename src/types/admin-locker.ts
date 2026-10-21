// Administrator locker infrastructure types. `*Dto` mirror smart-locking-be
// `dev` (Application/DTOs/Lockers, numeric enums in JSON).

/** `LockerOperationalStatus` / `LockerCompartmentOperationalStatus`: 0 Operational, 1 OutOfService, 2 Inactive. */
export type OperationalStatusDto = 0 | 1 | 2;
/** `LockerConnectionStatus`: 0 Online, 1 Offline, 2 Unknown. */
export type ConnectionStatusDto = 0 | 1 | 2;
/** `DoorStatus`: 0 Open, 1 Closed, 2 Unknown. */
export type DoorStatusDto = 0 | 1 | 2;

export type AdminLockerSummaryDto = {
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

export type AdminCompartmentDto = {
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

export type AdminLockerDetailDto = Omit<
  AdminLockerSummaryDto,
  'totalCompartments' | 'activeCompartments'
> & { compartments: AdminCompartmentDto[] };

/** `CreateLockerRequest`. */
export type CreateLockerRequestDto = {
  code: string;
  address: string;
  recoveryAddress: string;
  deviceIdentifier: string;
};

/** `UpdateLockerRequest`. */
export type UpdateLockerRequestDto = CreateLockerRequestDto & {
  operationalStatus: OperationalStatusDto;
};

/** `CreateCompartmentRequest`. */
export type CreateCompartmentRequestDto = {
  code: string;
  hardwareCode: string;
  hardwareChannel: number;
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

export type AdminLocker = {
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
  updatedAt: string;
};

export type AdminCompartment = {
  id: string;
  code: string;
  hardwareCode: string;
  hardwareChannel: number;
  operationalStatus: OperationalStatus;
  doorStatus: DoorStatus;
};

export type AdminLockerDetail = AdminLocker & {
  compartments: AdminCompartment[];
};

/** Editable configuration of a locker (#7 infrastructure, #6 locations). */
export type LockerFormValues = {
  code: string;
  address: string;
  recoveryAddress: string;
  deviceIdentifier: string;
  /** Only used when editing. */
  operationalStatus: 'Operational' | 'OutOfService' | 'Inactive';
};

export type CompartmentFormValues = {
  code: string;
  hardwareCode: string;
  hardwareChannel: string;
};

export type LockerFormErrors = Partial<Record<keyof LockerFormValues, string>>;
export type CompartmentFormErrors = Partial<
  Record<keyof CompartmentFormValues, string>
>;

export type AdminLockerFilter =
  | 'all'
  | 'operational'
  | 'out-of-service'
  | 'inactive'
  | 'offline';
