import type { ReactNode } from 'react';
import type { StatusFilter } from '@/types/user-management';

import ChevronDown from '@gravity-ui/icons/ChevronDown';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Xmark from '@gravity-ui/icons/Xmark';
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
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="w-full shrink-0 sm:w-80 xl:flex-none">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Nhóm người dùng">
            <Tabs.Tab id="LOCKER_OPERATOR">
              <Tabs.Indicator />
              Nhân viên
            </Tabs.Tab>
            <Tabs.Tab id="RESIDENT">
              <Tabs.Indicator />
              {USER_ROLE_LABELS.RESIDENT}
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center xl:ml-auto xl:flex-1 xl:flex-nowrap xl:justify-end xl:gap-2">
        <SearchField
          fullWidth
          aria-label="Tìm kiếm người dùng"
          className="col-span-2 w-full sm:min-w-[280px] sm:flex-1 xl:min-w-[220px] xl:max-w-80"
          value={search}
          onChange={onSearchChange}
        >
          <SearchField.Group>
            <SearchField.SearchIcon>
              <Magnifier aria-hidden="true" className="size-4" />
            </SearchField.SearchIcon>
            <SearchField.Input placeholder="Tìm theo họ tên, email hoặc số điện thoại" />
            <SearchField.ClearButton aria-label="Xóa từ khóa tìm kiếm">
              <Xmark aria-hidden="true" className="size-4" />
            </SearchField.ClearButton>
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
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator>
              <ChevronDown aria-hidden="true" className="size-4" />
            </Select.Indicator>
          </Select.Trigger>
          <Select.Popover placement="bottom end">
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
