import { ErrorCodes } from '@/constants/error-codes';
import { ApiError, apiRequest } from '@/services/api-client';

// smart-locking-be `dev`: PaymentReconciliationsController (#186)
//   GET  /api/payment-reconciliations/payments              – payment lookup
//   GET  /api/payment-reconciliations/payments/{kind}/{id}  – one payment
//   GET  /api/payment-reconciliations                       – cases (paged)
//   GET  /api/payment-reconciliations/{id}                  – case + history
//   POST /api/payment-reconciliations/{id}:assign           – take the case
//   POST /api/payment-reconciliations/{id}:respond          – InReview | WaitingProvider | Closed
//   POST /api/payment-reconciliations/{id}:synchronize      – verify with the gateway
// Only a verified gateway check can mark a payment paid; there is no manual
// "paid" or refund action, so the UI never offers one.

export type PaymentKind = 'Subscription' | 'Overdue';
export type PaymentStatus = 'Success' | 'Pending' | 'Cancelled' | 'Failed';
export type ReconciliationStatus =
  | 'Submitted'
  | 'InReview'
  | 'WaitingProvider'
  | 'Conflict'
  | 'Resolved'
  | 'Closed';
export type RespondStatus = 'InReview' | 'WaitingProvider' | 'Closed';

export type PaymentRecord = {
  kind: PaymentKind;
  id: string;
  residentUserId: string;
  orderCode: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  completedAt: string | null;
  externalTransactionId: string | null;
};

export type ReconciliationEvent = {
  id: string;
  action: string;
  status: ReconciliationStatus;
  message: string;
  createdAt: string;
  actorUserId: string;
  providerEvidence: string | null;
};

export type ReconciliationCase = {
  id: string;
  reference: string;
  kind: PaymentKind;
  paymentId: string;
  reason: string;
  status: ReconciliationStatus;
  assignedAdminUserId: string | null;
  response: string | null;
  providerStatus: string | null;
  providerCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  nextStep: string;
  history: ReconciliationEvent[];
};

export type Paged<T> = {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
};

export type PaymentLookupFilters = {
  kind: PaymentKind | '';
  status: PaymentStatus | '';
  orderCode: string;
  residentUserId: string;
  /** yyyy-mm-dd from a date input, local time. */
  from: string;
  to: string;
  page: number;
};

export const PAYMENT_PAGE_SIZE = 20;
export const RESPONSE_MAX_LENGTH = 2000;

export const emptyLookupFilters = (): PaymentLookupFilters => ({
  kind: '',
  status: '',
  orderCode: '',
  residentUserId: '',
  from: '',
  to: '',
  page: 1,
});

export const paymentKindLabels: Record<PaymentKind, string> = {
  Subscription: 'Gói dịch vụ',
  Overdue: 'Phí lưu quá hạn',
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  Success: 'Đã thanh toán',
  Pending: 'Chờ thanh toán',
  Cancelled: 'Đã hủy, không thu tiền',
  Failed: 'Thất bại',
};

export const caseStatusLabels: Record<ReconciliationStatus, string> = {
  Submitted: 'Mới gửi',
  InReview: 'Đang xử lý',
  WaitingProvider: 'Đang đối chiếu với cổng thanh toán',
  Conflict: 'Kết quả chưa khớp',
  Resolved: 'Đã có kết luận',
  Closed: 'Đã đóng',
};

export const respondStatusLabels: Record<RespondStatus, string> = {
  InReview: 'Tiếp tục xử lý',
  WaitingProvider: 'Chờ cổng thanh toán xác minh',
  Closed: 'Đóng hồ sơ',
};

const providerStatusLabels: Record<string, string> = {
  PAID: 'Cổng báo đã thanh toán',
  PENDING: 'Cổng báo chờ thanh toán',
  PROCESSING: 'Cổng đang xử lý',
  UNDERPAID: 'Cổng báo trả thiếu',
  CANCELLED: 'Cổng báo đã hủy',
  EXPIRED: 'Cổng báo hết hạn',
};

const eventActionLabels: Record<string, string> = {
  Submitted: 'Cư dân gửi tra soát',
  Assigned: 'Quản trị viên nhận xử lý',
  Responded: 'Quản trị viên phản hồi',
  ProviderChecked: 'Đối chiếu cổng thanh toán',
};

// Fixed BE messages; free-text admin responses are shown as written.
const knownMessages: Record<string, string> = {
  'Request received. Keep this reference and do not pay again while the result is unclear.':
    'Đã nhận yêu cầu. Giữ mã tham chiếu, không thanh toán lại khi kết quả chưa rõ.',
  'An administrator has accepted this reconciliation.':
    'Quản trị viên đã nhận xử lý hồ sơ.',
  'Your request is recorded. Keep your reference and do not pay again until the payment result is verified.':
    'Yêu cầu đã được ghi nhận. Chưa có kết luận — không hướng dẫn cư dân thanh toán lại.',
  'Payment result is unclear. Await provider verification; do not pay again.':
    'Kết quả thanh toán chưa rõ. Chờ cổng thanh toán xác minh; không thanh toán lại.',
  'Gateway payment verified and recorded. Benefits were applied once.':
    'Cổng thanh toán xác nhận đã thu tiền; giao dịch đã được ghi nhận và áp dụng quyền lợi một lần.',
  'The gateway confirms payment but the internal record conflicts. An administrator must investigate; do not pay again.':
    'Cổng xác nhận đã thu tiền nhưng dữ liệu nội bộ không khớp. Cần quản trị viên điều tra; không thanh toán lại.',
  'The gateway confirms this order ended without payment. This order was not charged. Contact support if your bank reports a debit.':
    'Cổng xác nhận đơn kết thúc mà không thu tiền. Đơn này không bị trừ tiền; nếu ngân hàng báo trừ tiền, liên hệ hỗ trợ.',
  'The gateway and internal payment results conflict. Keep your reference and await administrator review.':
    'Kết quả của cổng và hệ thống không khớp. Giữ mã tham chiếu và chờ quản trị viên xem xét.',
  'Payment amounts or results conflict. No payment state was overwritten; an administrator must investigate. Do not pay again.':
    'Số tiền hoặc kết quả không khớp. Không có trạng thái nào bị ghi đè; cần quản trị viên điều tra. Không thanh toán lại.',
  'The gateway could not be reached. Your reconciliation remains open; do not pay again while the payment result is unclear.':
    'Không kết nối được cổng thanh toán. Hồ sơ vẫn mở; không thanh toán lại khi kết quả chưa rõ.',
  'Verified payment data could not be applied safely. An administrator must investigate; do not pay again.':
    'Không thể áp dụng an toàn dữ liệu đã xác minh. Cần quản trị viên điều tra; không thanh toán lại.',
};

export const translateCaseMessage = (message: string) =>
  knownMessages[message] ?? message;

export const eventActionLabel = (action: string) =>
  eventActionLabels[action] ?? action;

export const providerStatusLabel = (status: string | null) =>
  status
    ? (providerStatusLabels[status] ?? `Cổng báo: ${status}`)
    : 'Chưa đối chiếu';

/** Waiting or conflicting results must read as "no conclusion yet". */
export const isCaseUncertain = (status: ReconciliationStatus) =>
  status === 'Submitted' ||
  status === 'InReview' ||
  status === 'WaitingProvider' ||
  status === 'Conflict';

/** Closed/Resolved cases are final; no further actions are offered. */
export function caseActions(
  item: Pick<ReconciliationCase, 'status' | 'assignedAdminUserId'>,
  currentUserId: string | undefined,
) {
  const open = item.status !== 'Closed' && item.status !== 'Resolved';

  return {
    canAssign:
      open &&
      !(
        item.assignedAdminUserId === currentUserId && item.status === 'InReview'
      ),
    canRespond: open,
    canSynchronize: open,
  };
}

const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export const formatAmount = (amount: number, currency: string) =>
  currency === 'VND' ? vnd.format(amount) : `${amount} ${currency}`;

export const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN') : '—';

export function validateLookupFilters(filters: PaymentLookupFilters) {
  if (filters.from && filters.to && filters.from > filters.to) {
    return 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.';
  }

  return '';
}

export function buildLookupQuery(filters: PaymentLookupFilters) {
  const params = new URLSearchParams();

  if (filters.kind) params.set('Kind', filters.kind);
  if (filters.status) params.set('Status', filters.status);
  if (filters.orderCode.trim())
    params.set('OrderCode', filters.orderCode.trim());
  if (filters.residentUserId)
    params.set('ResidentUserId', filters.residentUserId);
  // Whole local days: from 00:00 to 23:59:59.999.
  if (filters.from)
    params.set('From', new Date(`${filters.from}T00:00:00`).toISOString());
  if (filters.to)
    params.set('To', new Date(`${filters.to}T23:59:59.999`).toISOString());
  params.set('PageNumber', String(Math.max(1, filters.page)));
  params.set('PageSize', String(PAYMENT_PAGE_SIZE));

  return params.toString();
}

export function validateResponse(status: RespondStatus | '', response: string) {
  if (!status) return 'Vui lòng chọn tiến độ.';
  const text = response.trim();

  if (!text) return 'Vui lòng nhập nội dung phản hồi.';
  if (text.length > RESPONSE_MAX_LENGTH) {
    return `Nội dung tối đa ${RESPONSE_MAX_LENGTH} ký tự.`;
  }

  return '';
}

const base = '/api/payment-reconciliations';

export const lookupPayments = (
  filters: PaymentLookupFilters,
  signal?: AbortSignal,
) =>
  apiRequest<Paged<PaymentRecord>>(
    `${base}/payments?${buildLookupQuery(filters)}`,
    { signal },
  );

export const getPayment = (
  kind: PaymentKind,
  id: string,
  signal?: AbortSignal,
) =>
  apiRequest<PaymentRecord>(
    `${base}/payments/${kind}/${encodeURIComponent(id)}`,
    { signal },
  );

export const listCases = (page: number, signal?: AbortSignal) =>
  apiRequest<Paged<ReconciliationCase>>(
    `${base}?pageNumber=${Math.max(1, page)}&pageSize=${PAYMENT_PAGE_SIZE}`,
    { signal },
  );

export const getCase = (id: string, signal?: AbortSignal) =>
  apiRequest<ReconciliationCase>(`${base}/${encodeURIComponent(id)}`, {
    signal,
  });

export const assignCase = (id: string) =>
  apiRequest<ReconciliationCase>(`${base}/${encodeURIComponent(id)}:assign`, {
    method: 'POST',
  });

export const respondCase = (
  id: string,
  status: RespondStatus,
  response: string,
) =>
  apiRequest<ReconciliationCase>(`${base}/${encodeURIComponent(id)}:respond`, {
    method: 'POST',
    body: JSON.stringify({ status, response: response.trim() }),
  });

export const synchronizeCase = (id: string) =>
  apiRequest<ReconciliationCase>(
    `${base}/${encodeURIComponent(id)}:synchronize`,
    {
      method: 'POST',
    },
  );

export function getReconciliationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case ErrorCodes.PAYMENT_NOT_FOUND:
        return 'Không tìm thấy giao dịch hoặc hồ sơ tra soát. Vui lòng tải lại.';
      case ErrorCodes.PAYMENT_INVALID_REQUEST:
        return 'Thao tác không hợp lệ với giao dịch này (ví dụ đơn không có mã cổng thanh toán).';
      case ErrorCodes.INVALID_INPUT:
        return 'Thông tin chưa hợp lệ. Kiểm tra bộ lọc ngày hoặc nội dung phản hồi.';
    }
    if (error.status === 0)
      return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
    if (error.status === 403)
      return 'Bạn không có quyền thực hiện thao tác này.';
    if (error.status === 429)
      return 'Thao tác quá nhanh. Vui lòng thử lại sau ít phút.';
    if (error.status >= 500)
      return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  }

  return 'Không thể xử lý yêu cầu thanh toán. Vui lòng thử lại.';
}
