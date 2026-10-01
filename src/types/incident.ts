export type IncidentSource = 0 | 1 | 2;
export type IncidentStatus = 0 | 1 | 2 | 3;

export type IncidentListItem = {
  id: string;
  type: string;
  source: IncidentSource;
  status: IncidentStatus;
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

export type IncidentAction = {
  id: string;
  actionByUserId: string;
  actionByName: string;
  actionType: string;
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus | null;
  notes: string | null;
  createdAt: string;
};

export type IncidentDetail = IncidentListItem & {
  description: string;
  evidenceUrl: string | null;
  lockerCompartmentId: string | null;
  lockerCompartmentCode: string | null;
  assignedOperatorName: string | null;
  resolutionSummary: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  actions: IncidentAction[];
};
