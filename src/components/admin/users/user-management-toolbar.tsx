import type { ReactNode } from 'react';
import type { StatusFilter } from '@/types/user-management';

import ChevronDown from '@gravity-ui/icons/ChevronDown';
import Magnifier from '@gravity-ui/icons/Magnifier';
import { ListBox, SearchField, Select, Tabs } from '@heroui/react';

import {
  ACCOUNT_STATUS_FILTER_OPTIONS,
  USER_ROLE_LABELS,
} from '@/constants/user-management';

type UserManagementToolbarProps = {
  search: string;
  status: StatusFilter;
  actions?: ReactNode;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StatusFilter) => void;
};

export function UserManagementToolbar({
  search,
  status,
  actions,
  onSearchChange,
  onStatusChange,
}: UserManagementToolbarProps) {
  const statusTriggerClassName =
    status === 'ALL'
      ? '[--field-background:var(--um-surface)] [--field-border-focus:var(--um-focus)] [--field-border-hover:var(--um-border)] [--field-border:var(--um-border)] [--field-focus:var(--um-surface)] [--field-hover:var(--um-surface)]'
      : 'text-[var(--um-primary-strong)] [--field-background:var(--um-primary-soft)] [--field-border-focus:var(--um-focus)] [--field-border-hover:var(--um-primary)] [--field-border:var(--um-primary-border)] [--field-focus:var(--um-primary-soft)] [--field-hover:var(--um-primary-soft)]';

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="w-full shrink-0 sm:w-80 xl:flex-none">
        <Tabs.List
          aria-label="Nhóm người dùng"
          className="grid w-full min-w-0 grid-cols-2 rounded-xl bg-neutral-200/70 p-1"
        >
          <Tabs.Tab
            className="min-h-9 w-full min-w-0 whitespace-nowrap rounded-lg px-2 text-center text-xs font-medium text-neutral-600 outline-none transition-colors sm:px-3.5 sm:text-sm data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-[var(--um-focus)] data-[focus-visible=true]:ring-offset-2 data-[selected=true]:font-semibold data-[selected=true]:text-[var(--um-on-primary)]"
            id="LOCKER_OPERATOR"
          >
            <Tabs.Indicator className="bg-[var(--um-primary)] shadow-none" />
            {USER_ROLE_LABELS.LOCKER_OPERATOR}
          </Tabs.Tab>
          <Tabs.Tab
            className="min-h-9 w-full min-w-0 whitespace-nowrap rounded-lg px-2 text-center text-xs font-medium text-neutral-600 outline-none transition-colors sm:px-3.5 sm:text-sm data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-[var(--um-focus)] data-[focus-visible=true]:ring-offset-2 data-[selected=true]:font-semibold data-[selected=true]:text-[var(--um-on-primary)]"
            id="RESIDENT"
          >
            <Tabs.Indicator className="bg-[var(--um-primary)] shadow-none" />
            {USER_ROLE_LABELS.RESIDENT}
          </Tabs.Tab>
        </Tabs.List>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center xl:ml-auto xl:flex-1 xl:flex-nowrap xl:justify-end xl:gap-2">
        <SearchField
          fullWidth
          aria-label="Tìm kiếm người dùng"
          className="col-span-2 w-full sm:min-w-[280px] sm:flex-1 xl:min-w-[220px] xl:max-w-80"
          value={search}
          onChange={onSearchChange}
        >
          <SearchField.Group className="min-h-11 rounded-lg border border-[var(--um-border)] bg-[var(--um-surface)] shadow-none [--field-background:var(--um-surface)] [--field-border-focus:var(--um-focus)] [--field-border-hover:var(--um-border)] [--field-border:var(--um-border)] [--field-focus:var(--um-surface)] [--field-hover:var(--um-surface)] focus-within:border-[var(--um-focus)]">
            <Magnifier
              aria-hidden="true"
              className="ml-3 size-5 shrink-0 text-neutral-500"
            />
            <SearchField.Input placeholder="Tìm theo họ tên, email hoặc số điện thoại" />
          </SearchField.Group>
        </SearchField>

        <Select
          aria-label="Lọc theo trạng thái tài khoản"
          className="w-full sm:w-32 sm:flex-none"
          selectedKey={status}
          onSelectionChange={(key) => {
            if (key === 'ALL' || key === 'ACTIVE' || key === 'LOCKED') {
              onStatusChange(key);
            }
          }}
        >
          <Select.Trigger
            className={`min-h-11 w-full rounded-lg border shadow-none data-[focus-visible=true]:ring-[var(--um-focus)] ${statusTriggerClassName}`}
          >
            <Select.Value />
            <Select.Indicator>
              <ChevronDown aria-hidden="true" className="size-4" />
            </Select.Indicator>
          </Select.Trigger>
          <Select.Popover
            className="border border-[var(--um-border)] shadow-none"
            placement="bottom end"
          >
            <ListBox aria-label="Trạng thái tài khoản">
              {ACCOUNT_STATUS_FILTER_OPTIONS.map((option) => (
                <ListBox.Item key={option.value} id={option.value}>
                  {option.label}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        {actions ? (
          <div className="col-span-2 sm:w-auto sm:flex-none">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
