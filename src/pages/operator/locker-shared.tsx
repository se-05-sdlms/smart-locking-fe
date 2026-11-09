import type { ReactNode } from 'react';
import type { StatusDisplay } from '@/constants/operator-locker';
import type {
  ConnectionStatus,
  DoorStatus,
  OperationalStatus,
} from '@/types/operator-locker';

import { Alert, Button, Chip } from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';

import {
  COMPARTMENT_OPERATIONAL_STATUS_DISPLAY,
  CONNECTION_STATUS_DISPLAY,
  DOOR_STATUS_DISPLAY,
  LOCKER_OPERATIONAL_STATUS_DISPLAY,
} from '@/constants/operator-locker';

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatLockerDateTime(
  value: string | null | undefined,
  emptyLabel = 'Chưa có dữ liệu',
) {
  if (!value) return emptyLabel;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? emptyLabel
    : dateTimeFormatter.format(date);
}

function StatusChip({ display }: { display: StatusDisplay }) {
  return (
    <Chip color={display.color} size="sm" variant="soft">
      {display.label}
    </Chip>
  );
}

export function ConnectionChip({ value }: { value: ConnectionStatus }) {
  return <StatusChip display={CONNECTION_STATUS_DISPLAY[value]} />;
}

export function LockerStatusChip({ value }: { value: OperationalStatus }) {
  return <StatusChip display={LOCKER_OPERATIONAL_STATUS_DISPLAY[value]} />;
}

export function CompartmentStatusChip({ value }: { value: OperationalStatus }) {
  return <StatusChip display={COMPARTMENT_OPERATIONAL_STATUS_DISPLAY[value]} />;
}

export function DoorChip({ value }: { value: DoorStatus }) {
  return <StatusChip display={DOOR_STATUS_DISPLAY[value]} />;
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
      <dd className="min-w-0 break-words text-sm font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

export function LoadErrorAlert({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert status="danger">
      <Alert.Indicator>
        <CircleExclamation aria-hidden="true" className="size-5" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
      {onRetry ? (
        <Button size="sm" variant="secondary" onPress={onRetry}>
          <ArrowRotateRight aria-hidden="true" className="size-4" />
          Thử lại
        </Button>
      ) : null}
    </Alert>
  );
}
