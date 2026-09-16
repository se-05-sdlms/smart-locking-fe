import type { ReactNode } from 'react';

import { Chip } from '@heroui/react';

export type LockerConnection = 'online' | 'offline';
export type LockerCondition = 'normal' | 'issue';
export type CompartmentStatus = 'active' | 'maintenance';

export type Locker = {
  id: string;
  name: string;
  address: string;
  compartmentCount: number;
  connection: LockerConnection;
  condition: LockerCondition;
};

export type Compartment = {
  id: string;
  status: CompartmentStatus;
  door: 'closed' | 'open';
  parcelId?: string;
  checkedInAt?: string;
};

export const LOCKERS: Locker[] = [
  {
    id: 'LK-01',
    name: 'Tủ Nguyễn Huệ',
    address: '123 Nguyễn Huệ, Quận 1',
    compartmentCount: 24,
    connection: 'online',
    condition: 'normal',
  },
  {
    id: 'LK-02',
    name: 'Tủ Lê Lợi',
    address: '45 Lê Lợi, Quận 1',
    compartmentCount: 20,
    connection: 'online',
    condition: 'normal',
  },
  {
    id: 'LK-03',
    name: 'Tủ Thảo Điền',
    address: '12 Thảo Điền, TP. Thủ Đức',
    compartmentCount: 16,
    connection: 'offline',
    condition: 'normal',
  },
  {
    id: 'LK-04',
    name: 'Tủ Cộng Hòa',
    address: '789 Cộng Hòa, Quận Tân Bình',
    compartmentCount: 30,
    connection: 'online',
    condition: 'normal',
  },
  {
    id: 'LK-05',
    name: 'Tủ Phú Mỹ Hưng',
    address: 'Tầng 1, SC VivoCity, Quận 7',
    compartmentCount: 24,
    connection: 'online',
    condition: 'issue',
  },
  {
    id: 'LK-06',
    name: 'Tủ Vạn Hạnh',
    address: '11 Sư Vạn Hạnh, Quận 10',
    compartmentCount: 18,
    connection: 'online',
    condition: 'normal',
  },
  {
    id: 'LK-07',
    name: 'Tủ Bình Thạnh',
    address: '220 Xô Viết Nghệ Tĩnh, Quận Bình Thạnh',
    compartmentCount: 24,
    connection: 'offline',
    condition: 'issue',
  },
  {
    id: 'LK-08',
    name: 'Tủ Gò Vấp',
    address: '650 Quang Trung, Quận Gò Vấp',
    compartmentCount: 20,
    connection: 'online',
    condition: 'normal',
  },
];

export function createCompartments(count: number): Compartment[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const hasParcel = [2, 6, 12, 17].includes(number);
    const isMaintenance = [3, 10].includes(number);

    return {
      id: `N${String(number).padStart(2, '0')}`,
      status: isMaintenance ? 'maintenance' : 'active',
      door: 'closed',
      parcelId: hasParcel
        ? `P1234${String(number).padStart(2, '0')}`
        : undefined,
      checkedInAt: hasParcel ? '14/03/2026 10:30' : undefined,
    };
  });
}

export function ConnectionChip({ value }: { value: LockerConnection }) {
  return (
    <Chip
      color={value === 'online' ? 'success' : 'danger'}
      size="sm"
      variant="soft"
    >
      {value === 'online' ? 'Trực tuyến' : 'Ngoại tuyến'}
    </Chip>
  );
}

export function CompartmentChip({
  compartment,
}: {
  compartment: Compartment;
}) {
  if (compartment.status === 'maintenance') {
    return (
      <Chip color="warning" size="sm" variant="soft">
        Đang bảo trì
      </Chip>
    );
  }

  if (compartment.parcelId) {
    return (
      <Chip color="accent" size="sm" variant="soft">
        Có bưu kiện
      </Chip>
    );
  }

  return (
    <Chip color="success" size="sm" variant="soft">
      Hoạt động
    </Chip>
  );
}

export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(7rem,0.7fr)_1.3fr] gap-4 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}
