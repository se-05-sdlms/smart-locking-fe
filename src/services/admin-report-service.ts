import { readAuthSession } from '@/auth/auth-storage';
import { getApiUrl } from '@/config/api';
import {
  ApiError,
  apiRequest,
  refreshAuthSession,
} from '@/services/api-client';

// smart-locking-be `dev`: GET /api/reports/summary?from&to&lockerId
// (Administrator). `Accept: text/csv` returns the same summary as a CSV file.
// Without from/to the backend reports the last 30 days.

export type ReportSummary = {
  from: string;
  to: string;
  deliveries: number;
  returns: number;
  retrievedParcels: number;
  openIncidents: number;
  maintenanceRequests: number;
  emergencyUnlocks: number;
};

/** Dates are `YYYY-MM-DD` from date inputs (browser local time); empty = default. */
export type ReportFilters = {
  from: string;
  to: string;
  /** Empty string means all lockers. */
  lockerId: string;
};

export type ReportFilterErrors = Partial<Record<'from' | 'to', string>>;

export const DEFAULT_REPORT_DAYS = 30;

export const REPORT_METRICS: ReadonlyArray<{
  key: keyof Omit<ReportSummary, 'from' | 'to'>;
  label: string;
  description: string;
}> = [
  {
    key: 'deliveries',
    label: 'Lượt giao hàng',
    description: 'Yêu cầu gửi hàng của shipper trong kỳ.',
  },
  {
    key: 'returns',
    label: 'Yêu cầu trả hàng',
    description: 'Cư dân gửi trả hàng qua tủ.',
  },
  {
    key: 'retrievedParcels',
    label: 'Bưu kiện đã nhận',
    description: 'Cư dân đã lấy hàng khỏi tủ.',
  },
  {
    key: 'openIncidents',
    label: 'Sự cố đang mở',
    description: 'Sự cố chưa được giải quyết.',
  },
  {
    key: 'maintenanceRequests',
    label: 'Yêu cầu bảo trì',
    description: 'Công việc bảo trì phát sinh trong kỳ.',
  },
  {
    key: 'emergencyUnlocks',
    label: 'Lượt mở khẩn cấp',
    description: 'Operator mở tủ khẩn cấp (có ghi audit).',
  },
];

export function emptyReportFilters(): ReportFilters {
  return { from: '', to: '', lockerId: '' };
}

/** `YYYY-MM-DD` → ISO start or end of that day in the browser's time zone. */
function toBoundary(date: string, edge: 'start' | 'end') {
  const [year, month, day] = date.split('-').map(Number);
  const value =
    edge === 'start'
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);

  return value.toISOString();
}

export function validateReportFilters(
  filters: ReportFilters,
  today = new Date(),
): ReportFilterErrors {
  const errors: ReportFilterErrors = {};
  const todayText = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  if (filters.from && filters.from > todayText) {
    errors.from = 'Ngày bắt đầu không được sau hôm nay.';
  }

  if (filters.from && filters.to && filters.from > filters.to) {
    errors.to = 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.';
  }

  return errors;
}

export function buildReportQuery(filters: ReportFilters) {
  const query = new URLSearchParams();

  if (filters.from) query.set('from', toBoundary(filters.from, 'start'));
  if (filters.to) query.set('to', toBoundary(filters.to, 'end'));
  if (filters.lockerId) query.set('lockerId', filters.lockerId);

  return query;
}

export function getReportSummary(filters: ReportFilters, signal?: AbortSignal) {
  return apiRequest<ReportSummary>(
    `/api/reports/summary?${buildReportQuery(filters)}`,
    { signal },
  );
}

async function fetchCsv(path: string, accessToken: string | undefined) {
  const headers = new Headers({ Accept: 'text/csv' });

  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  return fetch(getApiUrl(path), { headers });
}

/** Downloads the CSV for the same filters as the on-screen summary. */
export async function downloadReportCsv(filters: ReportFilters) {
  const path = `/api/reports/summary?${buildReportQuery(filters)}`;
  let response = await fetchCsv(path, readAuthSession()?.accessToken).catch(
    () => {
      throw new ApiError(0, 'Không thể kết nối đến máy chủ.');
    },
  );

  // The CSV request bypasses apiRequest, so refresh an expired token once here.
  if (response.status === 401) {
    const session = await refreshAuthSession();

    response = await fetchCsv(path, session.accessToken);
  }

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const suffix = filters.lockerId ? '-locker' : '';

  link.href = url;
  link.download = `boxora-report${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function getReportErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 0:
        return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
      case 400:
        return 'Bộ lọc báo cáo không hợp lệ. Kiểm tra lại khoảng thời gian.';
      case 401:
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      case 403:
        return 'Bạn không có quyền xem báo cáo hệ thống.';
      case 404:
        return 'Không tìm thấy tủ đã chọn. Vui lòng tải lại danh sách tủ.';
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

  return 'Không thể tải báo cáo. Vui lòng thử lại.';
}

/** True when two filter sets describe the same report (same scope and dates). */
export function sameReportFilters(left: ReportFilters, right: ReportFilters) {
  return (
    left.from === right.from &&
    left.to === right.to &&
    left.lockerId === right.lockerId
  );
}
