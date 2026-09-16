import type { AppRole } from '@/config/navigation';

import { Breadcrumbs, Button, Surface, Toolbar, Tooltip } from '@heroui/react';
import Bell from '@gravity-ui/icons/Bell';
import CircleQuestion from '@gravity-ui/icons/CircleQuestion';
import { useLocation, useNavigate } from 'react-router-dom';

import { getNavigationItem } from '@/config/navigation';

export function AppHeader({ role }: { role: AppRole }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const currentItem = getNavigationItem(pathname, role);
  const lockerId =
    currentItem?.path === '/operator/lockers'
      ? pathname.slice('/operator/lockers/'.length).split('/')[0]
      : '';

  return (
    <Surface className="flex h-20 shrink-0 items-center justify-between bg-background px-8">
      {currentItem?.path === '/operator/lockers' ? (
        <Breadcrumbs aria-label="Đường dẫn tủ">
          <Breadcrumbs.Item
            className="!text-xl font-semibold tracking-tight"
            onPress={lockerId ? () => navigate('/operator/lockers') : undefined}
          >
            Tủ của tôi
          </Breadcrumbs.Item>
          {lockerId ? (
            <Breadcrumbs.Item className="!text-xl font-semibold tracking-tight">
              {lockerId}
            </Breadcrumbs.Item>
          ) : null}
        </Breadcrumbs>
      ) : (
        <h1 className="text-xl font-semibold tracking-tight text-neutral-950">
          {currentItem?.label ?? 'Tổng quan'}
        </h1>
      )}
      <Toolbar aria-label="Thao tác ứng dụng" className="gap-1">
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
