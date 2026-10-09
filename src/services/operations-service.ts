import { apiRequest } from '@/services/api-client';

type PageResponse<T> = T[] | { items: T[]; totalCount: number; pageNumber: number; pageSize: number };
type OperationalLockerDto = Omit<OperationalLocker, 'status' | 'connection'> & { status: 0 | 1 | 2; connection: 0 | 1 | 2 };

export type OperationalLocker = { id: string; code: string; address: string; status: 'Operational' | 'OutOfService' | 'Inactive'; connection: 'Online' | 'Offline' | 'Unknown'; lastSeenAt: string | null; availableCompartments: number; storedParcels: number; openIncidents: number };
export type MaintenanceItem = { id: string; lockerCode: string; compartmentCode: string | null; priority: 0 | 1 | 2 | 3; status: 0 | 1 | 2 | 3; description: string; resolutionSummary: string | null; createdAt: string; updatedAt: string };
export type OperationsReport = { from: string; to: string; deliveries: number; returns: number; retrievedParcels: number; openIncidents: number; maintenanceRequests: number; emergencyUnlocks: number };
export type AuditItem = { id: string; actorUserId: string | null; actor: string; action: string; entityType: string | null; entityId: string | null; result: 0 | 1; ipAddress: string | null; details: string | null; occurredAt: string };

const lockerStatuses = ['Operational', 'OutOfService', 'Inactive'] as const;
const connectionStatuses = ['Online', 'Offline', 'Unknown'] as const;
const pageItems = <T>(response: PageResponse<T>): T[] => Array.isArray(response) ? response : response.items;

export const operationsService = {
  lockers: async () => {
    const response = await apiRequest<PageResponse<OperationalLockerDto>>('/api/Lockers/operational-summary?pageSize=100');
    return pageItems(response).map((locker) => ({ ...locker, status: lockerStatuses[locker.status], connection: connectionStatuses[locker.connection] }));
  },
  maintenance: async () => pageItems(await apiRequest<PageResponse<MaintenanceItem>>('/api/maintenance-requests?pageSize=100')),
  createMaintenance: (body: { lockerId: string; compartmentId?: string; priority: 0 | 1 | 2 | 3; description: string }) => apiRequest<MaintenanceItem>('/api/maintenance-requests', { method: 'POST', body: JSON.stringify(body) }),
  updateMaintenance: (id: string, body: { status: 0 | 1 | 2 | 3; notes?: string; resolutionSummary?: string }) => apiRequest<MaintenanceItem>(`/api/maintenance-requests/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  emergencyUnlock: (body: { lockerId: string; compartmentId: string; reason: string }) => apiRequest('/api/emergency-unlocks', { method: 'POST', body: JSON.stringify(body) }),
  report: (from?: string, to?: string) => apiRequest<OperationsReport>(`/api/reports/summary?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) })}`),
  audit: async (query = '') => pageItems(await apiRequest<PageResponse<AuditItem>>(`/api/audit-logs?query=${encodeURIComponent(query)}&pageSize=100`)),
};
