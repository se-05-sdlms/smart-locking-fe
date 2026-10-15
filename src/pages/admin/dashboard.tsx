import type { LoadedDashboard } from '@/services/admin-dashboard-service';
import type { ComponentType, ReactNode, SVGProps } from 'react';

import { Alert, Button, Card, Chip, Skeleton, Table } from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import Box from '@gravity-ui/icons/Box';
import ChevronRight from '@gravity-ui/icons/ChevronRight';
import CircleDollar from '@gravity-ui/icons/CircleDollar';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import LayoutCellsLarge from '@gravity-ui/icons/LayoutCellsLarge';
import Persons from '@gravity-ui/icons/Persons';
import Server from '@gravity-ui/icons/Server';
import TriangleExclamation from '@gravity-ui/icons/TriangleExclamation';
import { Link, useNavigate } from 'react-router-dom';

import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  attentionReasons,
  auditActionLabel,
  connectionLabel,
  getAdminDashboard,
  getAdminDashboardErrorMessage,
  operationalLabel,
  percentage,
} from '@/services/admin-dashboard-service';

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const ATTENTION_LIMIT = 6;
const numberFormat = new Intl.NumberFormat('vi-VN');
const moneyFormat = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});
const dateTimeFormat = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});

type Tone = 'neutral' | 'success' | 'warning' | 'danger';
type ChipColor = 'default' | 'success' | 'warning' | 'danger';

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

const CONNECTION_COLORS: ChipColor[] = ['success', 'danger', 'default'];
const OPERATIONAL_COLORS: ChipColor[] = ['success', 'warning', 'default'];

const format = (value: number) => numberFormat.format(value);

type StatTileProps = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  meta: string;
  route: string;
  tone?: Tone;
};

function StatTile({
  icon: Icon,
  label,
  value,
  meta,
  route,
  tone = 'neutral',
}: StatTileProps) {
  return (
    <Link
      aria-label={`${label}: ${value}. ${meta}. Xem chi tiết`}
      className="group flex min-h-32 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      to={route}
    >
      <span className="flex items-center gap-2 text-sm text-muted">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-foreground">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0 flex-1">{label}</span>
        <ChevronRight
          aria-hidden="true"
          className="size-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </span>
      <strong
        className={`text-2xl font-semibold tabular-nums ${TONE_TEXT[tone]}`}
      >
        {value}
      </strong>
      <span className="text-xs text-muted">{meta}</span>
    </Link>
  );
}

function Panel({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  action?: { label: string; route: string };
  children: ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();

  return (
    <Card className={className}>
      <Card.Header className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <Card.Title>{title}</Card.Title>
          {description ? (
            <Card.Description>{description}</Card.Description>
          ) : null}
        </div>
        {action ? (
          <Button
            className="-mr-2 -mt-1 shrink-0"
            size="sm"
            variant="ghost"
            onPress={() => navigate(action.route)}
          >
            {action.label}
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        ) : null}
      </Card.Header>
      <Card.Content>{children}</Card.Content>
    </Card>
  );
}

type Segment = { label: string; value: number; color: string };

function Distribution({
  title,
  total,
  unit,
  segments,
}: {
  title: string;
  total: number;
  unit: string;
  segments: Segment[];
}) {
  return (
    <Panel description={`Tổng ${format(total)} ${unit}`} title={title}>
      <div
        aria-label={segments
          .map((item) => `${item.label} ${percentage(item.value, total)}%`)
          .join(', ')}
        className="flex h-3 overflow-hidden rounded-full bg-surface-secondary"
        role="img"
      >
        {segments.map((item) =>
          item.value > 0 ? (
            <span
              key={item.label}
              className={`h-full border-r-2 border-surface last:border-r-0 ${item.color}`}
              style={{ width: `${(item.value / Math.max(total, 1)) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <dl className="mt-4 grid gap-3">
        {segments.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className={`size-2.5 shrink-0 rounded-full ${item.color}`}
            />
            <dt className="min-w-0 flex-1 truncate text-muted">{item.label}</dt>
            <dd className="font-medium tabular-nums">
              {format(item.value)}
              <span className="ml-1 text-xs font-normal text-muted">
                {percentage(item.value, total)}%
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function ParcelTrend({
  days,
}: {
  days: LoadedDashboard['recentParcelsTrend'];
}) {
  const max = Math.max(1, ...days.map((day) => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);

  return (
    <Panel
      className="lg:col-span-2 2xl:col-span-1"
      description={`Tổng ${format(total)} bưu kiện được gửi vào tủ`}
      title={`Bưu kiện ${days.length} ngày gần nhất`}
    >
      <ol
        aria-label="Số bưu kiện theo ngày"
        className="flex h-44 items-end gap-2 border-b border-separator pb-px"
      >
        {days.map((day, index) => {
          const isToday = index === days.length - 1;

          return (
            <li
              key={day.date}
              aria-label={`${day.dayLabel}: ${format(day.count)} bưu kiện`}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="text-xs font-medium tabular-nums">
                {day.count}
              </span>
              <span
                className={`w-full max-w-10 rounded-t-md ${isToday ? 'bg-accent' : 'bg-accent-soft'}`}
                style={{ height: `${Math.max(4, (day.count / max) * 120)}px` }}
              />
            </li>
          );
        })}
      </ol>
      <ol aria-hidden="true" className="mt-2 flex gap-2">
        {days.map((day, index) => (
          <li
            key={day.date}
            className={`flex-1 text-center text-xs ${index === days.length - 1 ? 'font-medium text-foreground' : 'text-muted'}`}
          >
            {day.dayLabel}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function AttentionLockers({
  lockers,
}: {
  lockers: LoadedDashboard['attentionLockers'];
}) {
  const hidden = lockers.length - ATTENTION_LIMIT;

  return (
    <Panel
      action={{ label: 'Quản lý tủ', route: '/admin/lockers' }}
      description={
        lockers.length
          ? `${format(lockers.length)} tủ ngoại tuyến hoặc ngừng vận hành`
          : undefined
      }
      title="Tủ cần chú ý"
    >
      {lockers.length ? (
        <>
          <ul className="divide-y divide-separator">
            {lockers.slice(0, ATTENTION_LIMIT).map((locker) => (
              <li
                key={locker.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3 first:pt-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {locker.code}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {locker.address}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1">
                  {attentionReasons(locker).map((reason) => (
                    <Chip
                      key={reason}
                      color={reason === 'Ngoại tuyến' ? 'danger' : 'warning'}
                      size="sm"
                      variant="soft"
                    >
                      {reason}
                    </Chip>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          {hidden > 0 ? (
            <p className="mt-3 text-xs text-muted">
              Và {format(hidden)} tủ khác.
            </p>
          ) : null}
        </>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted">
          <span aria-hidden="true" className="size-2 rounded-full bg-success" />
          Tất cả tủ đang trực tuyến và vận hành bình thường.
        </p>
      )}
    </Panel>
  );
}

function RecentActivity({
  logs,
}: {
  logs: LoadedDashboard['recentAuditLogs'];
}) {
  return (
    <Panel
      action={{ label: 'Xem audit log', route: '/admin/audit-logs' }}
      title="Hoạt động gần đây"
    >
      {logs.length ? (
        <ol className="space-y-4">
          {logs.map((log) => {
            const succeeded = log.result === 0;

            return (
              <li key={log.id} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${succeeded ? 'bg-success' : 'bg-danger'}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-sm font-medium">
                      {auditActionLabel(log.action)}
                      {succeeded ? null : (
                        <span className="ml-2 text-xs font-normal text-danger">
                          Thất bại
                        </span>
                      )}
                    </span>
                    <time
                      className="text-xs text-muted tabular-nums"
                      dateTime={log.occurredAt}
                    >
                      {dateTimeFormat.format(new Date(log.occurredAt))}
                    </time>
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {log.actorName}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-muted">Chưa có hoạt động nào.</p>
      )}
    </Panel>
  );
}

function RecentLockers({
  lockers,
}: {
  lockers: LoadedDashboard['recentLockers'];
}) {
  return (
    <Panel
      action={{ label: 'Xem tất cả', route: '/admin/lockers' }}
      title="Tủ cập nhật gần đây"
    >
      {lockers.length ? (
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Tủ cập nhật gần đây">
              <Table.Header>
                <Table.Column isRowHeader id="code">
                  Mã tủ
                </Table.Column>
                <Table.Column id="address">Địa chỉ</Table.Column>
                <Table.Column id="operator">Operator</Table.Column>
                <Table.Column id="connection">Kết nối</Table.Column>
                <Table.Column id="status">Vận hành</Table.Column>
                <Table.Column id="updated">Cập nhật</Table.Column>
              </Table.Header>
              <Table.Body>
                {lockers.map((locker) => (
                  <Table.Row key={locker.id} id={locker.id}>
                    <Table.Cell>
                      <span className="font-medium">{locker.code}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="block max-w-72 text-wrap text-muted">
                        {locker.address}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      {locker.operatorName ?? (
                        <span className="text-warning">Chưa phân công</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip
                        color={
                          CONNECTION_COLORS[locker.connectionStatus] ??
                          'default'
                        }
                        size="sm"
                        variant="soft"
                      >
                        {connectionLabel(locker.connectionStatus)}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip
                        color={
                          OPERATIONAL_COLORS[locker.operationalStatus] ??
                          'default'
                        }
                        size="sm"
                        variant="soft"
                      >
                        {operationalLabel(locker.operationalStatus)}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="whitespace-nowrap tabular-nums text-muted">
                        {dateTimeFormat.format(new Date(locker.updatedAt))}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      ) : (
        <p className="text-sm text-muted">Chưa có tủ nào.</p>
      )}
    </Panel>
  );
}

function DashboardContent({ data }: { data: LoadedDashboard }) {
  const stats = data.statistics;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatTile
          icon={Server}
          label="Tủ đang vận hành"
          meta={`Trên ${format(stats.totalLockers)} tủ · ${format(stats.offlineLockersCount)} ngoại tuyến`}
          route="/admin/lockers"
          value={format(stats.activeLockers)}
        />
        <StatTile
          icon={LayoutCellsLarge}
          label="Ngăn còn trống"
          meta={`Trên ${format(stats.totalCompartments)} ngăn · ${format(stats.occupiedCompartments)} đang dùng`}
          route="/admin/lockers"
          value={format(stats.availableCompartments)}
        />
        <StatTile
          icon={Box}
          label="Bưu kiện đang lưu"
          meta={`${format(stats.newParcelsTodayCount)} mới hôm nay · ${format(stats.overdueParcelsCount)} quá hạn`}
          route="/admin/reports"
          tone={stats.overdueParcelsCount ? 'warning' : 'neutral'}
          value={format(stats.storedParcelsCount)}
        />
        <StatTile
          icon={TriangleExclamation}
          label="Sự cố đang mở"
          meta={`${format(stats.highPriorityIncidentsCount)} ưu tiên cao`}
          route="/admin/reports"
          tone={stats.highPriorityIncidentsCount ? 'danger' : 'neutral'}
          value={format(stats.openIncidentsCount)}
        />
        <StatTile
          icon={Persons}
          label="Người dùng"
          meta={`${format(stats.residentCount)} cư dân · ${format(stats.operatorCount)} Operator`}
          route="/admin/users"
          value={format(stats.totalUsers)}
        />
        <StatTile
          icon={CircleDollar}
          label="Phí quá hạn"
          meta="Phát sinh trong 30 ngày gần nhất"
          route="/admin/reports"
          value={moneyFormat.format(stats.totalOverdueFeeAmountLast30Days)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <ParcelTrend days={data.recentParcelsTrend} />
        <Distribution
          segments={[
            {
              label: 'Đang vận hành',
              value: data.lockerStatus.operational,
              color: 'bg-success',
            },
            {
              label: 'Ngừng phục vụ',
              value: data.lockerStatus.maintenance,
              color: 'bg-warning',
            },
            {
              label: 'Đã vô hiệu hóa',
              value: data.lockerStatus.suspended,
              color: 'bg-default-foreground',
            },
          ]}
          title="Trạng thái tủ"
          total={data.lockerStatus.total}
          unit="tủ"
        />
        <Distribution
          segments={[
            {
              label: 'Trống',
              value: data.compartmentStatus.available,
              color: 'bg-success',
            },
            {
              label: 'Đang dùng',
              value: data.compartmentStatus.occupied,
              color: 'bg-accent',
            },
            {
              label: 'Quá hạn',
              value: data.compartmentStatus.overdue,
              color: 'bg-warning',
            },
            {
              label: 'Ngừng phục vụ',
              value: data.compartmentStatus.maintenance,
              color: 'bg-danger',
            },
            {
              label: 'Vô hiệu hóa',
              value: data.compartmentStatus.disabled,
              color: 'bg-default-foreground',
            },
          ]}
          title="Trạng thái ngăn"
          total={data.compartmentStatus.total}
          unit="ngăn"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AttentionLockers lockers={data.attentionLockers} />
        <RecentActivity logs={data.recentAuditLogs} />
      </div>

      <RecentLockers lockers={data.recentLockers} />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải tổng quan"
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { state, reload, refresh } = useAsyncResource(
    getAdminDashboard,
    getAdminDashboardErrorMessage,
    [],
  );

  return (
    <section className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Tổng quan hệ thống</h2>
          <p className="text-sm text-muted">
            {state.data
              ? `Cập nhật lúc ${dateTimeFormat.format(new Date(state.data.loadedAt))} (${TIME_ZONE})`
              : 'Đang tải số liệu hệ thống...'}
          </p>
        </div>
        <Button
          isDisabled={state.status === 'loading'}
          variant="secondary"
          onPress={refresh}
        >
          <ArrowRotateRight aria-hidden="true" className="size-4" />
          Làm mới
        </Button>
      </div>

      {state.status === 'error' ? (
        <Alert role="alert" status="danger">
          <Alert.Indicator>
            <CircleExclamation aria-hidden="true" className="size-5" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Description>
              {state.message}
              {state.data ? ' Đang hiển thị số liệu lần tải trước.' : ''}
            </Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="secondary" onPress={reload}>
            Thử lại
          </Button>
        </Alert>
      ) : null}

      {state.data ? (
        <DashboardContent data={state.data} />
      ) : state.status === 'loading' ? (
        <DashboardSkeleton />
      ) : null}
    </section>
  );
}
