import type {
  AddIncidentActionRequestDto,
  IncidentAction,
  IncidentActionDto,
  IncidentDetail,
  IncidentDetailDto,
  IncidentListItem,
  IncidentListItemDto,
  IncidentSource,
  IncidentStatus,
  IncidentStatusDto,
  IncidentStatusFilter,
  IncidentTransition,
  UpdateIncidentStatusRequestDto,
} from '@/types/incident';

import {
  INCIDENT_ACTION_TYPE_LABELS,
  INCIDENT_TEXT_MAX_LENGTH,
  INCIDENT_TYPE_LABELS,
  UNKNOWN_INCIDENT_LABEL,
} from '@/constants/incident';
import { ApiError, apiRequest } from '@/services/api-client';

// Backend enum order (Domain/Enums/OperationsEnums.cs).
const STATUSES = ['Open', 'Investigating', 'Resolved', 'Escalated'] as const;
const SOURCES = ['Resident', 'Shipper', 'Guest', 'System'] as const;

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

export function toIncidentStatus(value: unknown): IncidentStatus {
  return mapEnum<IncidentStatus>(value, STATUSES, 'Unknown');
}

export function toIncidentSource(value: unknown): IncidentSource {
  return mapEnum<IncidentSource>(value, SOURCES, 'Unknown');
}

export function toIncidentStatusDto(
  status: IncidentTransition,
): IncidentStatusDto {
  return STATUSES.indexOf(status) as IncidentStatusDto;
}

export function formatIncidentType(type: string) {
  return INCIDENT_TYPE_LABELS[type] ?? UNKNOWN_INCIDENT_LABEL;
}

export function formatIncidentActionType(actionType: string) {
  return INCIDENT_ACTION_TYPE_LABELS[actionType] ?? UNKNOWN_INCIDENT_LABEL;
}

// ---------------------------------------------------------------------------
// DTO -> view model
// ---------------------------------------------------------------------------

export function mapIncidentListItem(
  dto: IncidentListItemDto,
): IncidentListItem {
  return {
    id: dto.id,
    type: dto.type,
    source: toIncidentSource(dto.source),
    status: toIncidentStatus(dto.status),
    title: dto.title,
    lockerId: dto.lockerId,
    lockerCode: dto.lockerCode,
    lockerAddress: dto.lockerAddress,
    parcelCode: dto.parcelCode,
    returnCode: dto.returnCode,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export function mapIncidentAction(dto: IncidentActionDto): IncidentAction {
  return {
    id: dto.id,
    actionByName: dto.actionByName,
    actionType: dto.actionType,
    fromStatus:
      dto.fromStatus === null ? null : toIncidentStatus(dto.fromStatus),
    toStatus: dto.toStatus === null ? null : toIncidentStatus(dto.toStatus),
    notes: dto.notes,
    createdAt: dto.createdAt,
  };
}

export function mapIncidentDetail(dto: IncidentDetailDto): IncidentDetail {
  return {
    ...mapIncidentListItem(dto),
    description: dto.description,
    evidenceUrl: dto.evidenceUrl,
    lockerCompartmentCode: dto.lockerCompartmentCode,
    assignedOperatorName: dto.assignedOperatorName,
    resolutionSummary: dto.resolutionSummary,
    escalatedAt: dto.escalatedAt,
    resolvedAt: dto.resolvedAt,
    // Newest first in the timeline; the backend returns oldest first.
    actions: dto.actions
      .map(mapIncidentAction)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  };
}

// ---------------------------------------------------------------------------
// Rules (mirror IncidentService)
// ---------------------------------------------------------------------------

/**
 * Transitions a LockerOperator may request (IncidentService.IsValidTransition).
 * Only an Administrator can move an Escalated incident, so the Operator UI
 * offers nothing for Escalated or Resolved incidents.
 */
export function getOperatorTransitions(
  status: IncidentStatus,
): IncidentTransition[] {
  switch (status) {
    case 'Open':
      return ['Investigating', 'Escalated'];
    case 'Investigating':
      return ['Resolved', 'Escalated'];
    default:
      return [];
  }
}

/** Resolved incidents reject new actions with 409. */
export function canAddIncidentAction(status: IncidentStatus) {
  return status !== 'Resolved' && status !== 'Unknown';
}

export function validateIncidentText(value: string, required: boolean) {
  const text = value.trim();

  if (required && !text) return 'Vui lòng nhập nội dung.';

  if (text.length > INCIDENT_TEXT_MAX_LENGTH) {
    return `Nội dung không được vượt quá ${INCIDENT_TEXT_MAX_LENGTH} ký tự.`;
  }

  return undefined;
}

/**
 * Builds the status request. Resolved needs `resolutionSummary`, Escalated
 * needs `notes`; the backend rejects missing values with 400.
 */
export function buildIncidentStatusRequest(
  transition: IncidentTransition,
  text: string,
): UpdateIncidentStatusRequestDto {
  const value = text.trim() || null;

  return {
    status: toIncidentStatusDto(transition),
    notes: transition === 'Resolved' ? null : value,
    resolutionSummary: transition === 'Resolved' ? value : null,
  };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** `GET /api/operator/incidents?status=` — scoped to assigned lockers by the backend. */
export async function listOperatorIncidents(
  filter: IncidentStatusFilter,
  signal?: AbortSignal,
): Promise<IncidentListItem[]> {
  const query = filter === 'all' ? '' : `?status=${encodeURIComponent(filter)}`;
  const response = await apiRequest<IncidentListItemDto[]>(
    `/api/operator/incidents${query}`,
    { signal },
  );

  return response.map(mapIncidentListItem);
}

/** `GET /api/incidents/{id}` — description, related records and timeline. */
export async function getIncidentDetail(
  incidentId: string,
  signal?: AbortSignal,
): Promise<IncidentDetail> {
  const response = await apiRequest<IncidentDetailDto>(
    `/api/incidents/${encodeURIComponent(incidentId)}`,
    { signal },
  );

  return mapIncidentDetail(response);
}

/** `POST /api/operator/incidents/{id}/actions`. */
export async function addIncidentAction(
  incidentId: string,
  notes: string,
): Promise<IncidentDetail> {
  const body: AddIncidentActionRequestDto = { notes: notes.trim() };
  const response = await apiRequest<IncidentDetailDto>(
    `/api/operator/incidents/${encodeURIComponent(incidentId)}/actions`,
    { method: 'POST', body: JSON.stringify(body) },
  );

  return mapIncidentDetail(response);
}

/** `PATCH /api/operator/incidents/{id}/status`. */
export async function updateIncidentStatus(
  incidentId: string,
  transition: IncidentTransition,
  text: string,
): Promise<IncidentDetail> {
  const response = await apiRequest<IncidentDetailDto>(
    `/api/operator/incidents/${encodeURIComponent(incidentId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify(buildIncidentStatusRequest(transition, text)),
    },
  );

  return mapIncidentDetail(response);
}

// ---------------------------------------------------------------------------
// Vietnamese error messages
// ---------------------------------------------------------------------------

function commonErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;

  if (error.status === 0) {
    return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
  }

  if (error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }

  if (error.status === 403) {
    return 'Sự cố này không thuộc tủ bạn được phân công.';
  }

  if (error.status === 404) {
    return 'Không tìm thấy sự cố. Sự cố có thể đã bị gỡ khỏi phạm vi của bạn.';
  }

  if (error.status === 408) {
    return 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.';
  }

  if (error.status === 429) {
    return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
  }

  if (error.status >= 500) {
    return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  }

  return null;
}

export function getIncidentLoadErrorMessage(error: unknown) {
  return (
    commonErrorMessage(error) ??
    'Không thể tải dữ liệu sự cố. Vui lòng thử lại.'
  );
}

export function getIncidentMutationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return 'Thông tin chưa hợp lệ. Kiểm tra nội dung bắt buộc (kết quả xử lý hoặc lý do chuyển cấp).';
    }

    if (error.status === 409) {
      return 'Trạng thái sự cố đã thay đổi hoặc không cho phép thao tác này. Vui lòng tải lại.';
    }
  }

  return (
    commonErrorMessage(error) ?? 'Không thể cập nhật sự cố. Vui lòng thử lại.'
  );
}
