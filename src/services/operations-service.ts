import { apiRequest } from '@/services/api-client';

export type OperationalLocker = { id: string; code: string; address: string; status: string; connection: string; lastSeenAt: string | null; availableCompartments: number; storedParcels: number; openIncidents: number };
export type MaintenanceItem = { id: string; lockerCode: string; compartmentCode: string | null; priority: 0 | 1 | 2 | 3; status: 0 | 1 | 2 | 3; description: string; resolutionSummary: string | null; createdAt: string; updatedAt: string };
export type OperationsReport = { from: string; to: string; deliveries: number; returns: number; retrievedParcels: number; openIncidents: number; maintenanceRequests: number; emergencyUnlocks: number };
export type AuditItem = { id: string; actor: string; action: string; entityType: string | null; entityId: string | null; result: string; details: string | null; occurredAt: string };

export const operationsService = {
  lockers: () => apiRequest<OperationalLocker[]>('/api/operations/lockers'),
  maintenance: () => apiRequest<MaintenanceItem[]>('/api/operations/maintenance'),
  createMaintenance: (body: { lockerId: string; compartmentId?: string; priority: 0 | 1 | 2 | 3; description: string }) => apiRequest<MaintenanceItem>('/api/operations/maintenance', { method: 'POST', body: JSON.stringify(body) }),
  updateMaintenance: (id: string, body: { status: 0 | 1 | 2 | 3; notes?: string; resolutionSummary?: string }) => apiRequest<MaintenanceItem>(`/api/operations/maintenance/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  emergencyUnlock: (body: { lockerId: string; compartmentId: string; reason: string }) => apiRequest('/api/operations/emergency-unlocks', { method: 'POST', body: JSON.stringify(body) }),
  report: (from?: string, to?: string) => apiRequest<OperationsReport>(`/api/reports/summary?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) })}`),
  audit: (query = '') => apiRequest<AuditItem[]>(`/api/audit-logs?query=${encodeURIComponent(query)}`),
};
