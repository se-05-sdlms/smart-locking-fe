import type {
  OperationalRecordDetailDto,
  OperationalRecordDetailRow,
  OperationalRecordFilters,
  OperationalRecordPage,
  OperationalRecordPageDto,
} from '@/types/operational-record';

import {
  OPERATIONAL_RECORD_DETAIL_KINDS,
  OPERATIONAL_RECORD_DETAIL_LABELS,
  OPERATIONAL_RECORD_DETAIL_VALUE_LABELS,
} from '@/constants/operational-record';
import { ApiError, apiRequest } from '@/services/api-client';

export const OPERATIONAL_HISTORY_PAGE_SIZE = 20;

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function hasOperationalRecordDetail(kind: string) {
  return (OPERATIONAL_RECORD_DETAIL_KINDS as readonly string[]).includes(kind);
}

/**
 * Turns `YYYY-MM-DD` date inputs into the backend range. `from` is inclusive
 * and `to` is exclusive, so the end date is moved to the next local midnight.
 */
export function toDateRange(fromDate: string, toDate: string) {
  const toIso = (value: string, addDays = 0) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day + addDays);

    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };

  return { from: toIso(fromDate), to: toIso(toDate, 1) };
}

export function validateDateRange(fromDate: string, toDate: string) {
  if (fromDate && toDate && fromDate > toDate) {
    return 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.';
  }

  return undefined;
}

export function buildOperationalRecordQuery(filters: OperationalRecordFilters) {
  const params = new URLSearchParams();
  const query = filters.query.trim();
  const { from, to } = toDateRange(filters.fromDate, filters.toDate);

  if (query) params.set('query', query);
  if (filters.lockerId !== 'all') params.set('lockerId', filters.lockerId);
  if (filters.kind !== 'all') params.set('kind', filters.kind);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  params.set('pageNumber', String(filters.pageNumber));
  params.set('pageSize', String(filters.pageSize));

  return params.toString();
}

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatRecordDateTime(value: string | null | undefined) {
  if (!value) return '—';

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

/** Vietnamese label and value for every non-empty `details` entry. */
export function toDetailRows(
  details: Record<string, string | null>,
): OperationalRecordDetailRow[] {
  return Object.entries(details)
    .filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
    .map(([key, value]) => {
      const enumLabel = OPERATIONAL_RECORD_DETAIL_VALUE_LABELS[key]?.[value];
      const displayValue =
        enumLabel ??
        (ISO_DATE_TIME.test(value) ? formatRecordDateTime(value) : value);

      return {
        key,
        label: OPERATIONAL_RECORD_DETAIL_LABELS[key] ?? 'Thông tin khác',
        value: displayValue,
      };
    });
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** `GET /api/operational-records` — scoped to assigned lockers by the backend. */
export async function searchOperationalRecords(
  filters: OperationalRecordFilters,
  signal?: AbortSignal,
): Promise<OperationalRecordPage> {
  const response = await apiRequest<OperationalRecordPageDto>(
    `/api/operational-records?${buildOperationalRecordQuery(filters)}`,
    { signal },
  );

  return {
    ...response,
    items: response.items.map((item) => ({
      ...item,
      hasDetail: hasOperationalRecordDetail(item.kind),
    })),
  };
}

/** `GET /api/operational-records/{kind}/{id}`. */
export function getOperationalRecordDetail(
  kind: string,
  id: string,
  signal?: AbortSignal,
) {
  return apiRequest<OperationalRecordDetailDto>(
    `/api/operational-records/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`,
    { signal },
  );
}

export function getOperationalRecordErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 0:
        return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
      case 400:
        return 'Bộ lọc không hợp lệ. Kiểm tra lại khoảng ngày và loại sự kiện.';
      case 401:
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      case 403:
        return 'Tủ đã chọn không thuộc phạm vi bạn được phân công.';
      case 404:
        return 'Không tìm thấy bản ghi. Bản ghi có thể đã thay đổi.';
      case 408:
        return 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.';
      case 429:
        return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
      default:
        if (error.status >= 500) {
          return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
        }
    }
  }

  return 'Không thể tải lịch sử vận hành. Vui lòng thử lại.';
}
