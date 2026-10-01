import type {
  IncidentDetail,
  IncidentListItem,
  IncidentStatus,
} from '@/types/incident';

import { apiRequest } from '@/services/api-client';

export const incidentService = {
  getAll: (status?: IncidentStatus, signal?: AbortSignal) =>
    apiRequest<IncidentListItem[]>(
      `/api/operator/incidents${status === undefined ? '' : `?status=${status}`}`,
      { signal },
    ),
  getDetail: (id: string, signal?: AbortSignal) =>
    apiRequest<IncidentDetail>(`/api/incidents/${encodeURIComponent(id)}`, {
      signal,
    }),
  addAction: (id: string, notes: string) =>
    apiRequest<IncidentDetail>(
      `/api/operator/incidents/${encodeURIComponent(id)}/actions`,
      { method: 'POST', body: JSON.stringify({ notes }) },
    ),
  updateStatus: (
    id: string,
    request: {
      status: IncidentStatus;
      notes?: string;
      resolutionSummary?: string;
    },
  ) =>
    apiRequest<IncidentDetail>(
      `/api/operator/incidents/${encodeURIComponent(id)}/status`,
      { method: 'PATCH', body: JSON.stringify(request) },
    ),
};
