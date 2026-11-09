// Operator incident management types.
// `*Dto` mirror smart-locking-be `dev` (Application/DTOs/Incidents, numeric enums);
// the rest are UI view models produced by incident-service.

/** `IncidentStatus`: 0 Open, 1 Investigating, 2 Resolved, 3 Escalated. */
export type IncidentStatusDto = 0 | 1 | 2 | 3;
/** `IncidentSource`: 0 Resident, 1 Shipper, 2 Guest, 3 System. */
export type IncidentSourceDto = 0 | 1 | 2 | 3;

export type IncidentListItemDto = {
  id: string;
  type: string;
  source: IncidentSourceDto;
  status: IncidentStatusDto;
  title: string;
  lockerId: string;
  lockerCode: string;
  lockerAddress: string;
  parcelId: string | null;
  parcelCode: string | null;
  returnRequestId: string | null;
  returnCode: string | null;
  paymentTransactionId: string | null;
  assignedOperatorUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IncidentActionDto = {
  id: string;
  actionByUserId: string;
  actionByName: string;
  actionType: string;
  fromStatus: IncidentStatusDto | null;
  toStatus: IncidentStatusDto | null;
  notes: string | null;
  createdAt: string;
};

export type IncidentDetailDto = IncidentListItemDto & {
  description: string;
  evidenceUrl: string | null;
  /** Guest reporter contact (smart-locking-be#156); null for residents. */
  reporterPhone?: string | null;
  lockerCompartmentId: string | null;
  lockerCompartmentCode: string | null;
  assignedOperatorName: string | null;
  resolutionSummary: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  actions: IncidentActionDto[];
};

/** `UpdateIncidentStatusRequest`. */
export type UpdateIncidentStatusRequestDto = {
  status: IncidentStatusDto;
  notes: string | null;
  resolutionSummary: string | null;
};

/** `AddIncidentActionRequest`. */
export type AddIncidentActionRequestDto = { notes: string };

// ---------------------------------------------------------------------------
// View models
// ---------------------------------------------------------------------------

export type IncidentStatus =
  | 'Open'
  | 'Investigating'
  | 'Resolved'
  | 'Escalated'
  | 'Unknown';

export type IncidentSource =
  | 'Resident'
  | 'Shipper'
  | 'Guest'
  | 'System'
  | 'Unknown';

export type IncidentListItem = {
  id: string;
  type: string;
  source: IncidentSource;
  status: IncidentStatus;
  title: string;
  lockerId: string;
  lockerCode: string;
  lockerAddress: string;
  parcelCode: string | null;
  returnCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IncidentAction = {
  id: string;
  actionByName: string;
  actionType: string;
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus | null;
  notes: string | null;
  createdAt: string;
};

export type IncidentDetail = IncidentListItem & {
  description: string;
  lockerCompartmentId: string | null;
  evidenceUrl: string | null;
  reporterPhone: string | null;
  lockerCompartmentCode: string | null;
  assignedOperatorName: string | null;
  resolutionSummary: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  actions: IncidentAction[];
};

export type IncidentStatusFilter =
  | 'all'
  | 'Open'
  | 'Investigating'
  | 'Resolved'
  | 'Escalated';

/** Status an Operator can move an incident to. */
export type IncidentTransition = 'Investigating' | 'Resolved' | 'Escalated';
