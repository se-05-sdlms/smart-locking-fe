import type { AppRole } from '@/config/navigation';

import { Button, Surface, Toolbar, Tooltip } from '@heroui/react';
import Bell from '@gravity-ui/icons/Bell';
import CircleQuestion from '@gravity-ui/icons/CircleQuestion';
import { useLocation } from 'react-router-dom';

import { getNavigationItem } from '@/config/navigation';

export function AppHeader({ role }: { role: AppRole }) {
  const { pathname } = useLocation();
  const currentItem = getNavigationItem(pathname, role);

  return (
    <Surface className="flex h-20 shrink-0 items-center justify-between bg-background px-8">
      <h1 className="text-xl font-semibold tracking-tight text-neutral-950">
        {currentItem?.label ?? 'Dashboard'}
      </h1>
      <Toolbar aria-label="Application actions" className="gap-1">
        <Tooltip>
          <Tooltip.Trigger>
            <Button
              isIconOnly
              aria-label="Notifications"
              size="sm"
              variant="ghost"
            >
              <Bell aria-hidden="true" className="size-5" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>Notifications</Tooltip.Content>
        </Tooltip>
        <Tooltip>
          <Tooltip.Trigger>
            <Button isIconOnly aria-label="Help" size="sm" variant="ghost">
              <CircleQuestion aria-hidden="true" className="size-5" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>Help</Tooltip.Content>
        </Tooltip>
      </Toolbar>
    </Surface>
  );
}
