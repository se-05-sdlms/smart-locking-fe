import type { AppRole } from '@/config/navigation';

import { Breadcrumbs, Button, Surface, Toolbar, Tooltip } from '@heroui/react';
import Bell from '@gravity-ui/icons/Bell';
import Calendar from '@gravity-ui/icons/Calendar';
import CircleQuestion from '@gravity-ui/icons/CircleQuestion';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { getNavigationItem } from '@/config/navigation';

export function AppHeader({ role }: { role: AppRole }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const currentItem = getNavigationItem(pathname, role);
  const isOperatorDashboard = pathname === '/operator';
  const isOperatorSettings = pathname === '/operator/settings';
  const lockerId =
    currentItem?.path === '/operator/lockers'
      ? pathname.slice('/operator/lockers/'.length).split('/')[0]
      : '';
  const overdueParcelId =
    currentItem?.path === '/operator/overdue-clearance'
      ? pathname.slice('/operator/overdue-clearance/'.length).split('/')[0]
      : '';

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1_000);

    return () => window.clearInterval(interval);
  }, []);

  const date = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now);
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);

  return (
    <Surface className="flex h-20 shrink-0 items-center justify-between bg-background px-8">
      {isOperatorDashboard ? (
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-neutral-950">
            Xin chào, Operator 👋
          </h1>
          <p className="truncate text-sm text-muted">
            Tổng quan tình trạng các tủ bạn đang quản lý hôm nay.
          </p>
        </div>
      ) : isOperatorSettings ? (
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-neutral-950">
            Cài đặt
          </h1>
          <p className="truncate text-sm text-muted">
            Thông tin tài khoản Operator
          </p>
        </div>
      ) : currentItem?.path === '/operator/lockers' ||
      currentItem?.path === '/operator/overdue-clearance' ? (
        <Breadcrumbs aria-label="Đường dẫn trang">
          <Breadcrumbs.Item
            className="!text-xl font-semibold tracking-tight"
            onPress={
              lockerId
                ? () => navigate('/operator/lockers')
                : overdueParcelId
                  ? () => navigate('/operator/overdue-clearance')
                  : undefined
            }
          >
            {currentItem.path === '/operator/lockers'
              ? 'Tủ của tôi'
              : 'Xử lý quá hạn'}
          </Breadcrumbs.Item>
          {lockerId || overdueParcelId ? (
            <Breadcrumbs.Item className="!text-xl font-semibold tracking-tight">
              {lockerId || overdueParcelId}
            </Breadcrumbs.Item>
          ) : null}
        </Breadcrumbs>
      ) : (
        <h1 className="text-xl font-semibold tracking-tight text-neutral-950">
          {currentItem?.label ?? 'Tổng quan'}
        </h1>
      )}
      <Toolbar aria-label="Thao tác ứng dụng" className="gap-1">
        {isOperatorDashboard ? (
          <time
            className="mr-3 hidden items-center gap-3 sm:flex"
            dateTime={now.toISOString()}
          >
            <Calendar aria-hidden="true" className="size-5 text-accent" />
            <span>
              <span className="block text-sm font-medium capitalize">
                {date}
              </span>
              <span className="block text-xs tabular-nums text-muted">
                {time}
              </span>
            </span>
          </time>
        ) : null}
        <Tooltip>
          <Tooltip.Trigger>
            <Button isIconOnly aria-label="Thông báo" size="sm" variant="ghost">
              <Bell aria-hidden="true" className="size-5" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>Thông báo</Tooltip.Content>
        </Tooltip>
        <Tooltip>
          <Tooltip.Trigger>
            <Button isIconOnly aria-label="Trợ giúp" size="sm" variant="ghost">
              <CircleQuestion aria-hidden="true" className="size-5" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>Trợ giúp</Tooltip.Content>
        </Tooltip>
      </Toolbar>
    </Surface>
  );
}
