import type { AppRole, NavigationItem } from '@/config/navigation';

import { Avatar, Button, Surface, Tooltip } from '@heroui/react';
import ArrowRightFromSquare from '@gravity-ui/icons/ArrowRightFromSquare';
import ChevronsCollapseHorizontal from '@gravity-ui/icons/ChevronsCollapseHorizontal';
import ChevronsExpandHorizontal from '@gravity-ui/icons/ChevronsExpandHorizontal';
import { NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';

import boxoraLogo from '@/assets/boxora-logo.svg';
import { getNavigationItems } from '@/config/navigation';
import { useAuth } from '@/auth/auth-context';

type AppSidebarProps = {
  role: AppRole;
  isCollapsed: boolean;
  onCollapsedChange: (isCollapsed: boolean) => void;
};

const roleDetails: Record<AppRole, { identity: string; title: string }> = {
  admin: { identity: 'admin', title: 'Administrator' },
  operator: { identity: 'operator', title: 'Nhân viên vận hành' },
};

function SidebarNavigationItem({
  item,
  isCollapsed,
}: {
  item: NavigationItem;
  isCollapsed: boolean;
}) {
  const link = (
    <NavLink
      className={({ isActive }) =>
        clsx(
          'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
          isCollapsed && 'justify-center px-0',
          isActive
            ? 'bg-default text-foreground'
            : 'text-muted hover:bg-surface-secondary hover:text-foreground',
        )
      }
      end={item.path === `/${item.role}`}
      to={item.path}
    >
      <item.icon aria-hidden="true" className="size-5 shrink-0" />
      <span className={clsx(isCollapsed && 'sr-only')}>{item.label}</span>
    </NavLink>
  );

  if (!isCollapsed) return link;

  return (
    <Tooltip>
      <Tooltip.Trigger className="w-full">{link}</Tooltip.Trigger>
      <Tooltip.Content>{item.label}</Tooltip.Content>
    </Tooltip>
  );
}

export function AppSidebar({
  role,
  isCollapsed,
  onCollapsedChange,
}: AppSidebarProps) {
  const navigate = useNavigate();
  const { isLoggingOut, logout, user } = useAuth();
  const roleDetail = roleDetails[role];
  const navigationItems = getNavigationItems(role);
  const identity = user?.email ?? user?.phoneNumber ?? roleDetail.identity;
  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <Surface
      className={clsx(
        'flex h-screen shrink-0 flex-col bg-background transition-[width] duration-200 ease-out',
        isCollapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      <div className="flex h-20 items-center px-4">
        {isCollapsed ? (
          <div className="group relative flex size-10 items-center justify-center rounded-xl">
            <img
              alt="Boxora"
              className="size-9 transition-opacity duration-150 group-hover:opacity-0 group-focus-within:opacity-0"
              src={boxoraLogo}
            />
            <Button
              isIconOnly
              aria-label="Mở rộng thanh điều hướng"
              className="absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
              size="sm"
              variant="ghost"
              onPress={() => onCollapsedChange(false)}
            >
              <ChevronsExpandHorizontal aria-hidden="true" className="size-5" />
            </Button>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <img alt="Boxora" className="size-10 shrink-0" src={boxoraLogo} />
            <span className="truncate text-lg font-semibold tracking-tight text-neutral-950">
              Boxora
            </span>
            <Button
              isIconOnly
              aria-label="Thu gọn thanh điều hướng"
              className="ml-auto shrink-0"
              size="sm"
              variant="ghost"
              onPress={() => onCollapsedChange(true)}
            >
              <ChevronsCollapseHorizontal
                aria-hidden="true"
                className="size-5"
              />
            </Button>
          </div>
        )}
      </div>

      <nav
        aria-label={`${roleDetail.title} navigation`}
        className={clsx(
          'flex-1 space-y-1 overflow-y-auto px-3',
          isCollapsed && 'px-2',
        )}
      >
        {navigationItems.map((item) => (
          <SidebarNavigationItem
            key={item.path}
            isCollapsed={isCollapsed}
            item={item}
          />
        ))}
      </nav>

      <div className={clsx('mt-auto px-3 pb-4', isCollapsed && 'px-2')}>
        <div
          className={clsx(
            'flex items-center gap-3 rounded-xl px-2 py-2',
            isCollapsed && 'justify-center px-0',
          )}
        >
          <Avatar className="shrink-0" size="sm">
            <Avatar.Fallback>
              {identity.slice(0, 2).toUpperCase()}
            </Avatar.Fallback>
          </Avatar>
          <div className={clsx('min-w-0', isCollapsed && 'sr-only')}>
            <p className="truncate text-sm font-semibold text-neutral-900">
              {identity}
            </p>
            <p className="truncate text-xs text-neutral-500">
              {roleDetail.title}
            </p>
          </div>
        </div>
        {isCollapsed ? (
          <Tooltip>
            <Tooltip.Trigger className="mt-2 w-full">
              <Button
                isIconOnly
                aria-label="Đăng xuất"
                className="w-full"
                isDisabled={isLoggingOut}
                size="sm"
                variant="ghost"
                onPress={() => void handleLogout()}
              >
                <ArrowRightFromSquare aria-hidden="true" className="size-5" />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>Đăng xuất</Tooltip.Content>
          </Tooltip>
        ) : (
          <Button
            className="mt-2 w-full justify-start text-neutral-600 hover:text-accent"
            isDisabled={isLoggingOut}
            size="sm"
            variant="ghost"
            onPress={() => void handleLogout()}
          >
            <ArrowRightFromSquare aria-hidden="true" className="size-5" />
            {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </Button>
        )}
      </div>
    </Surface>
  );
}
