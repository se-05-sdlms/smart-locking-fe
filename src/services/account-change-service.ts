import { ErrorCodes } from '@/constants/error-codes';
import { ApiError, apiRequest } from '@/services/api-client';

// smart-locking-be `dev`: ResidentAccountChangesController (#191)
//   GET  /api/resident-account-changes?pageNumber&pageSize – all (Admin)
//   GET  /api/resident-account-changes/{id}               – detail + live blockers
//   POST /api/resident-account-changes/{id}:review        – { approve, reason }
// Residents submit from the mobile app; a new phone is verified there with
// password + OTP. Approval re-checks every condition server-side: when
// something new blocks it, the response comes back still "Submitted" with
// the blockers and an "ApprovalBlocked" history entry, nothing applied.

export type AccountChangeKind = 'Locker' | 'Phone';
export type AccountChangeStatus =
  | 'Submitted'
  | 'Applied'
  | 'Rejected'
  | 'Cancelled';

export type AccountChangeBlocker = {
  kind: string;
  id: string;
  message: string;
};
export type AccountChangeEvent = {
  id: string;
  action: string;
  message: string;
  createdAt: string;
};

export type AccountChange = {
  id: string;
  residentUserId: string;
  kind: AccountChangeKind;
  status: AccountChangeStatus;
  reason: string;
  originalLockerId: string | null;
  targetLockerId: string | null;
  targetLockerCode: string | null;
  originalPhoneNumber: string | null;
  newPhoneNumber: string | null;
  phoneVerificationExpiresAt: string | null;
  reviewReason: string | null;
  createdAt: string;
  updatedAt: string;
  appliedAt: string | null;
  blockers: AccountChangeBlocker[];
  history: AccountChangeEvent[];
};

export type AccountChangePage = {
  items: AccountChange[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
};

export const CHANGE_PAGE_SIZE = 20;
export const REVIEW_REASON_MAX = 2000;

export const changeKindLabels: Record<AccountChangeKind, string> = {
  Locker: 'Đổi tủ đăng ký',
  Phone: 'Đổi số điện thoại',
};

export const changeStatusLabels: Record<AccountChangeStatus, string> = {
  Submitted: 'Chờ duyệt',
  Applied: 'Đã áp dụng',
  Rejected: 'Đã từ chối',
  Cancelled: 'Cư dân đã hủy',
};

export const changeStatusColor = (status: AccountChangeStatus) =>
  status === 'Applied'
    ? ('success' as const)
    : status === 'Rejected'
      ? ('danger' as const)
      : status === 'Submitted'
        ? ('warning' as const)
        : ('default' as const);

export const blockerKindLabels: Record<string, string> = {
  Parcel: 'Bưu kiện / phí quá hạn',
  Delivery: 'Giao hàng / phiên mở ngăn',
  Return: 'Gửi trả',
  OverduePayment: 'Thanh toán phí',
  Reconciliation: 'Tra soát thanh toán',
  Subscription: 'Gói dịch vụ',
  Locker: 'Tủ đích',
  Account: 'Tài khoản',
  PhoneVerification: 'Xác minh số mới',
};

const eventLabels: Record<string, string> = {
  Submitted: 'Cư dân gửi yêu cầu',
  PhoneReverified: 'Cư dân xác minh lại số mới',
  Cancelled: 'Cư dân hủy',
  Rejected: 'Admin từ chối',
  ApprovalBlocked: 'Admin duyệt nhưng bị chặn',
  Applied: 'Đã áp dụng',
};

export const eventLabel = (action: string) => eventLabels[action] ?? action;

const fixedMessages: Record<string, string> = {
  'An overdue charge is outstanding.': 'Còn phí lưu quá hạn chưa thanh toán.',
  'Payment is pending or its provider result has not been confirmed.':
    'Có thanh toán đang chờ hoặc chưa có kết quả từ cổng thanh toán.',
  'Delivery approval, allocation or compartment access has not finished.':
    'Có đơn giao chưa xong (chờ duyệt, cấp ngăn hoặc phiên mở ngăn).',
  'Return delivery, pickup or compartment access has not finished.':
    'Có yêu cầu gửi trả chưa xong (giao, lấy hoặc phiên mở ngăn).',
  'A compartment reservation or access session still needs release confirmation.':
    'Có ngăn đang giữ hoặc phiên mở ngăn chưa xác nhận giải phóng.',
  'Purchased benefits need reconciliation before they can be preserved at the target locker.':
    'Quyền lợi gói đã mua cần đối soát trước khi giữ lại ở tủ mới.',
  'Subscription payment is pending or unclear.':
    'Thanh toán gói đang chờ hoặc chưa rõ kết quả.',
  'Choose a different locker.': 'Tủ đích trùng tủ hiện tại.',
  'Target locker is unavailable for registration.':
    'Tủ đích không nhận đăng ký (ngừng hoạt động/bảo trì).',
  'The registered locker changed after this request was submitted. Cancel and create a new request.':
    'Tủ đăng ký đã đổi sau khi gửi yêu cầu; cư dân cần hủy và gửi lại.',
  'The account phone changed after submission. Cancel and create a new request.':
    'Số điện thoại tài khoản đã đổi sau khi gửi; cư dân cần hủy và gửi lại.',
  'New phone verification expired. Verify a new OTP and resubmit this request.':
    'Xác minh OTP số mới đã hết hạn; cư dân cần xác minh lại.',
  'The new phone number is already in use.':
    'Số mới đã được tài khoản khác sử dụng.',
  'Locker change requested. Goods remain at their physical location; purchased benefits remain unchanged.':
    'Đã gửi yêu cầu đổi tủ. Hàng vẫn ở vị trí hiện tại; quyền lợi gói đã mua giữ nguyên.',
  'Current password and the new phone OTP verified. Administrator approval is still required within 24 hours.':
    'Đã xác minh mật khẩu và OTP số mới. Cần Admin duyệt trong 24 giờ.',
  'The resident cancelled this request.': 'Cư dân đã hủy yêu cầu.',
};

export function translateMessage(message: string) {
  if (fixedMessages[message]) return fixedMessages[message];
  const parcel =
    /^Parcel (.+) must be collected or physically confirmed at the recovery address\.$/.exec(
      message,
    );

  if (parcel)
    return `Bưu kiện ${parcel[1]} cần được nhận hoặc xác nhận đã chuyển tới địa chỉ thu hồi.`;
  const reconciliation = /^Reconciliation (.+) is unresolved\.$/.exec(message);

  if (reconciliation)
    return `Hồ sơ tra soát ${reconciliation[1]} chưa có kết luận.`;

  return message;
}

/** Groups blockers by condition so each unmet requirement is listed once. */
export function groupBlockers(blockers: AccountChangeBlocker[]) {
  const groups = new Map<string, string[]>();

  for (const blocker of blockers) {
    const label = blockerKindLabels[blocker.kind] ?? blocker.kind;
    const message = translateMessage(blocker.message);
    const list = groups.get(label) ?? [];

    if (!list.includes(message)) list.push(message);
    groups.set(label, list);
  }

  return [...groups].map(([label, messages]) => ({ label, messages }));
}

/** What the admin must know before approving. */
export function approvalImpact(change: Pick<AccountChange, 'kind'>) {
  return change.kind === 'Locker'
    ? [
        'Chỉ đổi tủ đăng ký cho các đơn mới; hàng đang ở tủ cũ không bị chuyển.',
        'Gói dịch vụ và quyền lợi đã mua được giữ nguyên.',
        'Hệ thống kiểm tra lại mọi điều kiện ngay lúc duyệt; nếu phát sinh vướng mắc mới thì không áp dụng.',
      ]
    : [
        'Số mới đã được cư dân xác minh bằng mật khẩu và OTP; Admin không thể bỏ qua bước này.',
        'Sau khi áp dụng, cư dân bị đăng xuất khỏi mọi thiết bị và phải đăng nhập lại.',
        'Nếu số mới đã thuộc tài khoản khác, hệ thống từ chối áp dụng.',
      ];
}

export const canReview = (change: Pick<AccountChange, 'status'>) =>
  change.status === 'Submitted';

/** True when an approve attempt was blocked (nothing applied). */
export const wasApprovalBlocked = (
  change: Pick<AccountChange, 'status' | 'blockers'>,
) => change.status === 'Submitted' && change.blockers.length > 0;

export function validateReviewReason(reason: string) {
  const text = reason.trim();

  if (!text) return 'Vui lòng nhập lý do.';
  if (text.length > REVIEW_REASON_MAX)
    return `Lý do tối đa ${REVIEW_REASON_MAX} ký tự.`;

  return '';
}

const base = '/api/resident-account-changes';

export const listAccountChanges = (page: number, signal?: AbortSignal) =>
  apiRequest<AccountChangePage>(
    `${base}?pageNumber=${Math.max(1, page)}&pageSize=${CHANGE_PAGE_SIZE}`,
    { signal },
  );

export const getAccountChange = (id: string, signal?: AbortSignal) =>
  apiRequest<AccountChange>(`${base}/${encodeURIComponent(id)}`, { signal });

export const reviewAccountChange = (
  id: string,
  approve: boolean,
  reason: string,
) =>
  apiRequest<AccountChange>(`${base}/${encodeURIComponent(id)}:review`, {
    method: 'POST',
    body: JSON.stringify({ approve, reason: reason.trim() }),
  });

export function getAccountChangeErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'account-change/phone-unavailable':
        return 'Số mới đã được tài khoản khác sử dụng. Không có thay đổi nào được áp dụng.';
      case 'account-change/not-found':
        return 'Không tìm thấy yêu cầu. Vui lòng tải lại.';
      case 'account-change/access-denied':
        return 'Chỉ Quản trị viên được duyệt yêu cầu này.';
      case ErrorCodes.INVALID_INPUT:
        return 'Lý do chưa hợp lệ (1–2000 ký tự).';
    }
    if (error.status === 0)
      return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
    if (error.status === 403)
      return 'Bạn không có quyền thực hiện thao tác này.';
    if (error.status >= 500)
      return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  }

  return 'Không thể xử lý yêu cầu thay đổi. Vui lòng thử lại.';
}
