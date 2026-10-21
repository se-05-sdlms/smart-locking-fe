import { apiRequest } from '@/services/api-client';

type PageResponse<T> =
  | T[]
  | { items: T[]; totalCount: number; pageNumber: number; pageSize: number };
/** `GET /api/Lockers` item (LockerSummaryResponse). */
type LockerSummaryDto = {
  id: string;
  code: string;
  address: string;
  operationalStatus: 0 | 1 | 2;
  connectionStatus: 0 | 1 | 2;
  lastSeenAt: string | null;
  totalCompartments: number;
  activeCompartments: number;
};
/** `GET /api/parcels?view=Active` item (ParcelListItemResponse) — fields used here. */
type ActiveParcelDto = { lockerId: string };
/** `GET /api/operator/incidents` item — fields used here. */
type IncidentDto = { lockerId: string | null; status: number | string };

export type OperationalLocker = {
  id: string;
  code: string;
  address: string;
  status: 'Operational' | 'OutOfService' | 'Inactive';
  connection: 'Online' | 'Offline' | 'Unknown';
  lastSeenAt: string | null;
  /**
   * Operational compartments. The backend has no "available" (free) count per
   * locker (no /api/Lockers/operational-summary), so this is not "empty".
   */
  activeCompartments: number;
  totalCompartments: number;
  storedParcels: number;
  openIncidents: number;
};
export type MaintenanceItem = {
  id: string;
  lockerCode: string;
  compartmentCode: string | null;
  priority: 0 | 1 | 2 | 3;
  status: 0 | 1 | 2 | 3;
  description: string;
  resolutionSummary: string | null;
  createdAt: string;
  updatedAt: string;
};
export type AuditItem = {
  id: string;
  actorUserId: string | null;
  actor: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  result: 0 | 1;
  ipAddress: string | null;
  details: string | null;
  occurredAt: string;
};

const lockerStatuses = ['Operational', 'OutOfService', 'Inactive'] as const;
const connectionStatuses = ['Online', 'Offline', 'Unknown'] as const;
const pageItems = <T>(response: PageResponse<T>): T[] =>
  Array.isArray(response) ? response : response.items;

/** IncidentStatus values that still need handling (numeric or string JSON). */
const OPEN_INCIDENT_STATUSES = new Set<number | string>([
  0,
  1,
  2,
  'Open',
  'Investigating',
  'Escalated',
]);

export function buildOperationalLockers(
  lockers: LockerSummaryDto[],
  parcels: ActiveParcelDto[],
  incidents: IncidentDto[],
): OperationalLocker[] {
  const count = (ids: Array<string | null>) =>
    ids.reduce<Map<string, number>>((counts, id) => {
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);

      return counts;
    }, new Map());
  const parcelsByLocker = count(parcels.map((parcel) => parcel.lockerId));
  const incidentsByLocker = count(
    incidents
      .filter((incident) => OPEN_INCIDENT_STATUSES.has(incident.status))
      .map((incident) => incident.lockerId),
  );

  return lockers.map((locker) => ({
    id: locker.id,
    code: locker.code,
    address: locker.address,
    status: lockerStatuses[locker.operationalStatus] ?? 'Inactive',
    connection: connectionStatuses[locker.connectionStatus] ?? 'Unknown',
    lastSeenAt: locker.lastSeenAt,
    activeCompartments: locker.activeCompartments,
    totalCompartments: locker.totalCompartments,
    storedParcels: parcelsByLocker.get(locker.id) ?? 0,
    openIncidents: incidentsByLocker.get(locker.id) ?? 0,
  }));
}

export const operationsService = {
  /**
   * Operator dashboard rows built only from existing endpoints: lockers in
   * scope, active parcels and incidents (each already scoped by the backend).
   */
  lockers: async (signal?: AbortSignal) => {
    const [lockers, parcels, incidents] = await Promise.all([
      apiRequest<PageResponse<LockerSummaryDto>>('/api/Lockers', { signal }),
      apiRequest<PageResponse<ActiveParcelDto>>('/api/parcels?view=Active', {
        signal,
      }),
      apiRequest<PageResponse<IncidentDto>>('/api/operator/incidents', {
        signal,
      }),
    ]);

    return buildOperationalLockers(
      pageItems(lockers),
      pageItems(parcels),
      pageItems(incidents),
    );
  },
  maintenance: async () =>
    pageItems(
      await apiRequest<PageResponse<MaintenanceItem>>(
        '/api/maintenance-requests?pageSize=100',
      ),
    ),
  createMaintenance: (body: {
    lockerId: string;
    compartmentId?: string;
    priority: 0 | 1 | 2 | 3;
    description: string;
  }) =>
    apiRequest<MaintenanceItem>('/api/maintenance-requests', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateMaintenance: (
    id: string,
    body: { status: 0 | 1 | 2 | 3; notes?: string; resolutionSummary?: string },
  ) =>
    apiRequest<MaintenanceItem>(`/api/maintenance-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  emergencyUnlock: (body: {
    lockerId: string;
    compartmentId: string;
    reason: string;
  }) =>
    apiRequest('/api/emergency-unlocks', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  audit: async (query = '') =>
    pageItems(
      await apiRequest<PageResponse<AuditItem>>(
        `/api/audit-logs?query=${encodeURIComponent(query)}&pageSize=100`,
      ),
    ),
};
