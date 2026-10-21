import type { AppRole } from '@/config/navigation';

import { ApiError, apiRequest } from '@/services/api-client';

// smart-locking-be `dev`: NotificationsController (/api/notifications), any
// authenticated user, scoped to the caller. The backend has no realtime push
// for notifications yet, so the inbox polls and refreshes when opened.

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  deliveryRequestId: string | null;
  returnRequestId: string | null;
  parcelId: string | null;
  incidentId: string | null;
  paymentTransactionId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export const NOTIFICATION_LIST_LIMIT = 30;
export const NOTIFICATION_POLL_MS = 60_000;

/** Vietnamese titles for the notification types the backend raises today. */
const TYPE_TITLES: Record<string, string> = {
  DoorOpenTooLong: 'Cửa ngăn mở quá lâu',
  LockerOffline: 'Tủ mất kết nối',
  ParcelStored: 'Bưu kiện đã được gửi vào tủ',
  DeliveryApprovalRequested: 'Yêu cầu duyệt giao hàng',
  OverduePaymentSucceeded: 'Thanh toán phí quá hạn thành công',
  OverduePaymentFailed: 'Thanh toán phí quá hạn thất bại',
};

/** Backend messages are English and embed the locker code ("Locker LK-01: ..."). */
function extractLockerCode(message: string) {
  return /Locker\s+([A-Za-z0-9_-]+)/.exec(message)?.[1];
}

export function notificationTitle(notification: AppNotification) {
  return TYPE_TITLES[notification.type] ?? 'Thông báo hệ thống';
}

/** A Vietnamese one-line description; never shows the raw English message. */
export function notificationDescription(notification: AppNotification) {
  const lockerCode = extractLockerCode(notification.message);

  switch (notification.type) {
    case 'DoorOpenTooLong':
      return lockerCode
        ? `Tủ ${lockerCode} có ngăn chưa đóng cửa quá thời gian cho phép.`
        : 'Một ngăn tủ chưa đóng cửa quá thời gian cho phép.';
    case 'LockerOffline':
      return lockerCode
        ? `Tủ ${lockerCode} không còn gửi tín hiệu về hệ thống.`
        : 'Một tủ không còn gửi tín hiệu về hệ thống.';
    default:
      return lockerCode ? `Liên quan tủ ${lockerCode}.` : 'Mở để xem chi tiết.';
  }
}

/**
 * Where a notification may navigate. Only fixed in-app routes plus an entity
 * id are allowed; nothing from the payload is used as a URL.
 */
export function notificationTarget(
  notification: AppNotification,
  role: AppRole,
): string | null {
  if (role !== 'operator') return null;

  if (notification.incidentId) {
    return `/operator/incidents?incident=${encodeURIComponent(notification.incidentId)}`;
  }

  if (
    notification.type === 'DoorOpenTooLong' ||
    notification.type === 'LockerOffline'
  ) {
    return '/operator/lockers';
  }

  if (notification.parcelId) {
    return `/operator/overdue-clearance/${encodeURIComponent(notification.parcelId)}`;
  }

  return null;
}

export function countUnread(notifications: AppNotification[]) {
  return notifications.filter((notification) => !notification.isRead).length;
}

/** Applies a read change locally so the badge updates without a refetch. */
export function markReadLocally(
  notifications: AppNotification[],
  id: string | 'all',
  readAt = new Date().toISOString(),
) {
  return notifications.map((notification) =>
    (id === 'all' || notification.id === id) && !notification.isRead
      ? { ...notification, isRead: true, readAt }
      : notification,
  );
}

export function listNotifications(signal?: AbortSignal) {
  const query = new URLSearchParams({ limit: String(NOTIFICATION_LIST_LIMIT) });

  return apiRequest<AppNotification[]>(`/api/notifications?${query}`, {
    signal,
  });
}

export function markNotificationRead(id: string) {
  return apiRequest<AppNotification>(
    `/api/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' },
  );
}

export function markAllNotificationsRead() {
  return apiRequest<{ updatedCount: number }>('/api/notifications/read-all', {
    method: 'PATCH',
  });
}

export function getNotificationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 0:
        return 'Không thể kết nối đến máy chủ.';
      case 401:
        return 'Phiên đăng nhập đã hết hạn.';
      case 403:
        return 'Bạn không có quyền xem thông báo.';
      case 404:
        return 'Thông báo không còn tồn tại.';
      case 429:
        return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
      default:
        if (error.status >= 500) return 'Máy chủ đang gặp sự cố.';
    }
  }

  return 'Không thể tải thông báo.';
}
