import type { ComponentType, SVGProps } from 'react';

import ArrowRightFromSquare from '@gravity-ui/icons/ArrowRightFromSquare';
import Boxes3 from '@gravity-ui/icons/Boxes3';
import ChartLine from '@gravity-ui/icons/ChartLine';
import ClockArrowRotateLeft from '@gravity-ui/icons/ClockArrowRotateLeft';
import Factory from '@gravity-ui/icons/Factory';
import Gear from '@gravity-ui/icons/Gear';
import House from '@gravity-ui/icons/House';
import Magnifier from '@gravity-ui/icons/Magnifier';
import PersonWorker from '@gravity-ui/icons/PersonWorker';
import Persons from '@gravity-ui/icons/Persons';
import ShieldCheck from '@gravity-ui/icons/ShieldCheck';
import Timeline from '@gravity-ui/icons/Timeline';
import TriangleExclamation from '@gravity-ui/icons/TriangleExclamation';
import Wrench from '@gravity-ui/icons/Wrench';
import Hourglass from '@gravity-ui/icons/Hourglass';

export type AppRole = 'admin' | 'operator';

export type NavigationItem = {
  label: string;
  path: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  role: AppRole;
};

const adminNavigation: NavigationItem[] = [
  { label: 'Dashboard', path: '/admin', icon: House, role: 'admin' },
  { label: 'Users', path: '/admin/users', icon: Persons, role: 'admin' },
  {
    label: 'Roles & Permissions',
    path: '/admin/roles',
    icon: ShieldCheck,
    role: 'admin',
  },
  {
    label: 'Buildings',
    path: '/admin/buildings',
    icon: Factory,
    role: 'admin',
  },
  {
    label: 'Locker Infrastructure',
    path: '/admin/lockers',
    icon: Boxes3,
    role: 'admin',
  },
  {
    label: 'Operator Assignments',
    path: '/admin/operators',
    icon: PersonWorker,
    role: 'admin',
  },
  {
    label: 'System Policies',
    path: '/admin/policies',
    icon: Gear,
    role: 'admin',
  },
  {
    label: 'Reports',
    path: '/admin/reports',
    icon: ChartLine,
    role: 'admin',
  },
  {
    label: 'Audit Logs',
    path: '/admin/audit-logs',
    icon: ClockArrowRotateLeft,
    role: 'admin',
  },
];

const operatorNavigation: NavigationItem[] = [
  { label: 'Tổng quan', path: '/operator', icon: House, role: 'operator' },
  {
    label: 'Tủ của tôi',
    path: '/operator/lockers',
    icon: Boxes3,
    role: 'operator',
  },
  {
    label: 'Tra cứu vận hành',
    path: '/operator/search',
    icon: Magnifier,
    role: 'operator',
  },
  {
    label: 'Sự cố',
    path: '/operator/incidents',
    icon: TriangleExclamation,
    role: 'operator',
  },
  {
    label: 'Bảo trì',
    path: '/operator/maintenance',
    icon: Wrench,
    role: 'operator',
  },
  {
    label: 'Xử lý quá hạn',
    path: '/operator/overdue-clearance',
    icon: Hourglass,
    role: 'operator',
  },
  {
    label: 'Nhật ký vận hành',
    path: '/operator/history',
    icon: Timeline,
    role: 'operator',
  },
];

export const navigationByRole: Record<AppRole, NavigationItem[]> = {
  admin: adminNavigation,
  operator: operatorNavigation,
};

export const logoutIcon = ArrowRightFromSquare;

export function getNavigationItems(role: AppRole) {
  return navigationByRole[role];
}

export function getNavigationItem(pathname: string, role: AppRole) {
  return getNavigationItems(role)
    .filter(
      (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
    )
    .sort((first, second) => second.path.length - first.path.length)[0];
}
