import type { AppRole } from '@/config/navigation';
import type { AppNotification } from '@/services/notification-service';

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Popover, Skeleton, toast } from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import Bell from '@gravity-ui/icons/Bell';
import CheckDouble from '@gravity-ui/icons/CheckDouble';

import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  countUnread,
  dropRead,
  formatUnreadBadge,
  listUnreadNotifications,
  unreadAriaLabel,
  getNotificationErrorMessage,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markReadLocally,
  NOTIFICATION_POLL_MS,
  notificationDescription,
  notificationTarget,
  notificationTitle,
} from '@/services/notification-service';

const relativeTime = new Intl.RelativeTimeFormat('vi-VN', { numeric: 'auto' });
const dateTimeFormat = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function formatReceivedAt(iso: string, now = Date.now()) {
  const minutes = Math.round((new Date(iso).getTime() - now) / 60_000);

  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, 'minute');
  if (Math.abs(minutes) < 24 * 60) {
    return relativeTime.format(Math.round(minutes / 60), 'hour');
  }

  return dateTimeFormat.format(new Date(iso));
}

function NotificationItem({
  notification,
  role,
  onOpen,
}: {
  notification: AppNotification;
  role: AppRole;
  onOpen: (notification: AppNotification) => void;
}) {
  const target = notificationTarget(notification, role);

  return (
    <li>
      <button
        className={`flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent ${notification.isRead ? '' : 'bg-accent-soft/40'}`}
        type="button"
        onClick={() => onOpen(notification)}
      >
        <span
          aria-hidden="true"
          className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.isRead ? 'bg-transparent' : 'bg-accent'}`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={`text-sm ${notification.isRead ? '' : 'font-semibold'}`}
            >
              {notificationTitle(notification)}
            </span>
            <time
              className="shrink-0 text-xs text-muted"
              dateTime={notification.createdAt}
            >
              {formatReceivedAt(notification.createdAt)}
            </time>
          </span>
          <span className="block text-xs text-muted">
            {notificationDescription(notification)}
          </span>
          {target ? (
            <span className="mt-1 block text-xs text-accent">Xem chi tiết</span>
          ) : null}
          <span className="sr-only">
            {notification.isRead ? 'Đã đọc' : 'Chưa đọc'}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Header notification inbox: unread badge, list, mark read, safe deep links. */
export function NotificationInbox({ role }: { role: AppRole }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const { state, setState, reload, refresh } = useAsyncResource(
    listNotifications,
    getNotificationErrorMessage,
    [],
  );
  // The badge and "mark all read" use their own unread query: the inbox list
  // only holds the latest items, so counting it would miss older unread ones.
  const unreadResource = useAsyncResource(
    listUnreadNotifications,
    getNotificationErrorMessage,
    [],
  );
  const refreshUnread = unreadResource.refresh;
  const refreshAll = useCallback(() => {
    refresh();
    refreshUnread();
  }, [refresh, refreshUnread]);

  // Poll while the tab is visible; refresh as soon as it becomes visible again.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshAll();
    }, NOTIFICATION_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshAll();
    };

    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshAll]);

  const notifications = state.data ?? [];
  const unread =
    unreadResource.state.data?.length ?? countUnread(notifications);

  const applyRead = (id: string | 'all') => {
    setState((current) =>
      current.data
        ? { ...current, data: markReadLocally(current.data, id) }
        : current,
    );
    unreadResource.setState((current) =>
      current.data ? { ...current, data: dropRead(current.data, id) } : current,
    );
  };

  const openNotification = async (notification: AppNotification) => {
    const target = notificationTarget(notification, role);

    if (!notification.isRead) {
      applyRead(notification.id);
      // Navigation must not wait for, or fail because of, the read receipt.
      void markNotificationRead(notification.id).catch(() => refreshAll());
    }

    if (target) {
      setIsOpen(false);
      navigate(target);
    }
  };

  const markAll = async () => {
    if (isMarkingAll || unread === 0) return;

    setIsMarkingAll(true);

    try {
      await markAllNotificationsRead();
      applyRead('all');
    } catch (error) {
      toast.danger(getNotificationErrorMessage(error));
    } finally {
      setIsMarkingAll(false);
    }
  };

  const label = unreadAriaLabel(unread);

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) refreshAll();
      }}
    >
      <Badge.Anchor>
        <Button isIconOnly aria-label={label} size="sm" variant="ghost">
          <Bell aria-hidden="true" className="size-5" />
        </Button>
        {unread ? (
          <Badge color="danger" placement="top-right" size="sm">
            {formatUnreadBadge(unread)}
          </Badge>
        ) : null}
      </Badge.Anchor>
      <Popover.Content
        className="w-[min(24rem,calc(100vw-2rem))]"
        placement="bottom end"
      >
        <Popover.Dialog
          aria-label="Hộp thông báo"
          className="flex flex-col gap-2 p-2"
        >
          <div className="flex items-center justify-between gap-2 px-2 pt-1">
            <Popover.Heading className="text-base font-semibold">
              Thông báo
            </Popover.Heading>
            <Button
              isDisabled={unread === 0 || isMarkingAll}
              size="sm"
              variant="ghost"
              onPress={() => void markAll()}
            >
              <CheckDouble aria-hidden="true" className="size-4" />
              Đánh dấu đã đọc
            </Button>
          </div>

          {state.status === 'loading' && !state.data ? (
            <div
              aria-busy="true"
              aria-label="Đang tải thông báo"
              className="space-y-2 px-2"
            >
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : null}

          {state.status === 'error' ? (
            <div
              className="flex items-center justify-between gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm"
              role="alert"
            >
              <span>{state.message}</span>
              <Button size="sm" variant="secondary" onPress={reload}>
                <ArrowRotateRight aria-hidden="true" className="size-4" />
                Thử lại
              </Button>
            </div>
          ) : null}

          {state.data && notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">
              Chưa có thông báo nào.
            </p>
          ) : null}

          {notifications.length > 0 ? (
            <ul
              aria-label="Danh sách thông báo"
              className="flex max-h-96 flex-col gap-1 overflow-y-auto"
            >
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  role={role}
                  onOpen={(item) => void openNotification(item)}
                />
              ))}
            </ul>
          ) : null}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
