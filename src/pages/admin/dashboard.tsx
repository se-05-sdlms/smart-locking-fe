import type { LoadedDashboard } from '@/services/admin-dashboard-service';

import { Alert, Button, Card, Chip, Skeleton, Table } from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import ChevronRight from '@gravity-ui/icons/ChevronRight';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import { useNavigate } from 'react-router-dom';

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

type KpiProps = {
  label: string;
  value: string;
  meta: string;
  route: string;
  tone?: 'danger' | 'warning';
};

function Kpi({ label, value, meta, route, tone }: KpiProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <Card.Content className="gap-2 py-5">
        <span className="text-sm text-muted">{label}</span>
        <strong
          className={`text-3xl font-semibold ${tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : ''}`}
        >
          {value}
        </strong>
        <span className="text-xs text-muted">{meta}</span>
        <Button
          aria-label={`Xem ${label.toLowerCase()}`}
          className="-ml-2 self-start"
          size="sm"
          variant="ghost"
          onPress={() => navigate(route)}
        >
          Xem chi tiết
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </Card.Content>
    </Card>
  );
}

function Distribution({
  title,
  total,
  items,
}: {
  title: string;
  total: number;
  items: Array<{ label: string; value: number; color: string }>;
}) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        <Card.Description>Tổng {numberFormat.format(total)}</Card.Description>
      </Card.Header>
      <Card.Content className="gap-3">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{item.label}</span>
              <span className="font-medium">
                {numberFormat.format(item.value)} ·{' '}
                {percentage(item.value, total)}%
              </span>
            </div>
            <div
              aria-label={`${item.label}: ${percentage(item.value, total)}%`}
              className="h-2 rounded-full bg-default"
              role="img"
            >
              <div
                className={`h-2 rounded-full ${item.color}`}
                style={{ width: `${percentage(item.value, total)}%` }}
              />
            </div>
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}

function DashboardContent({ data }: { data: LoadedDashboard }) {
  const navigate = useNavigate();
  const stats = data.statistics;
  const maxTrend = Math.max(
    1,
    ...data.recentParcelsTrend.map((day) => day.count),
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi
          label="Tủ đang vận hành"
          meta={`${numberFormat.format(stats.totalLockers)} tủ · ${numberFormat.format(stats.offlineLockersCount)} ngoại tuyến`}
          route="/admin/lockers"
          value={numberFormat.format(stats.activeLockers)}
        />
        <Kpi
          label="Ngăn còn trống"
          meta={`${numberFormat.format(stats.totalCompartments)} ngăn · ${numberFormat.format(stats.occupiedCompartments)} đang dùng`}
          route="/admin/lockers"
          value={numberFormat.format(stats.availableCompartments)}
        />
        <Kpi
          label="Người dùng"
          meta={`${numberFormat.format(stats.residentCount)} cư dân · ${numberFormat.format(stats.operatorCount)} Operator`}
          route="/admin/users"
          value={numberFormat.format(stats.totalUsers)}
        />
        <Kpi
          label="Bưu kiện đang lưu"
          meta={`${numberFormat.format(stats.newParcelsTodayCount)} mới hôm nay · ${numberFormat.format(stats.overdueParcelsCount)} quá hạn`}
          route="/admin/reports"
          tone={stats.overdueParcelsCount ? 'warning' : undefined}
          value={numberFormat.format(stats.storedParcelsCount)}
        />
        <Kpi
          label="Sự cố đang mở"
          meta={`${numberFormat.format(stats.highPriorityIncidentsCount)} ưu tiên cao`}
          route="/admin/reports"
          tone={stats.highPriorityIncidentsCount ? 'danger' : undefined}
          value={numberFormat.format(stats.openIncidentsCount)}
        />
        <Kpi
          label="Phí quá hạn 30 ngày"
          meta="Tổng phí phát sinh"
          route="/admin/reports"
          value={moneyFormat.format(stats.totalOverdueFeeAmountLast30Days)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Distribution
          items={[
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
            {
              label: 'Ngoại tuyến',
              value: data.lockerStatus.offline,
              color: 'bg-danger',
            },
          ]}
          title="Trạng thái tủ"
          total={data.lockerStatus.total}
        />
        <Distribution
          items={[
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
        />
        <Card>
          <Card.Header>
            <Card.Title>Bưu kiện 7 ngày gần nhất</Card.Title>
            <Card.Description>
              Tổng{' '}
              {numberFormat.format(
                data.recentParcelsTrend.reduce(
                  (sum, day) => sum + day.count,
                  0,
                ),
              )}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <ol
              aria-label="Số bưu kiện theo ngày"
              className="flex h-36 items-end gap-2"
            >
              {data.recentParcelsTrend.map((day) => (
                <li
                  key={day.date}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <span className="text-xs font-medium">{day.count}</span>
                  <div
                    className="w-full rounded-t-md bg-accent"
                    style={{
                      height: `${Math.max(4, (day.count / maxTrend) * 96)}px`,
                    }}
                  />
                  <span className="text-xs text-muted">{day.dayLabel}</span>
                </li>
              ))}
            </ol>
          </Card.Content>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title>
              Tủ cần chú ý ({data.attentionLockers.length})
            </Card.Title>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => navigate('/admin/lockers')}
            >
              Quản lý tủ
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </Card.Header>
          <Card.Content>
            {data.attentionLockers.length ? (
              <ul className="divide-y divide-border">
                {data.attentionLockers.slice(0, 8).map((locker) => (
                  <li
                    key={locker.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span className="min-w-0 text-sm">
                      <strong>{locker.code}</strong>
                      <span className="block truncate text-xs text-muted">
                        {locker.address}
                      </span>
                    </span>
                    <span className="flex gap-1">
                      {attentionReasons(locker).map((reason) => (
                        <Chip
                          key={reason}
                          color="warning"
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
            ) : (
              <p className="text-sm text-muted">
                Tất cả tủ đang trực tuyến và vận hành bình thường.
              </p>
            )}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title>Hoạt động gần đây</Card.Title>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => navigate('/admin/audit-logs')}
            >
              Xem audit log
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </Card.Header>
          <Card.Content>
            {data.recentAuditLogs.length ? (
              <ul className="divide-y divide-border">
                {data.recentAuditLogs.map((log) => (
                  <li
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span className="text-sm">
                      <strong>{auditActionLabel(log.action)}</strong>
                      <span className="block text-xs text-muted">
                        {log.actorName} ·{' '}
                        {dateTimeFormat.format(new Date(log.occurredAt))}
                      </span>
                    </span>
                    <Chip
                      color={log.result === 0 ? 'success' : 'danger'}
                      size="sm"
                      variant="soft"
                    >
                      {log.result === 0 ? 'Thành công' : 'Thất bại'}
                    </Chip>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Chưa có hoạt động nào.</p>
            )}
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Tủ cập nhật gần đây</Card.Title>
        </Card.Header>
        <Card.Content className="px-0 pb-0">
          <Table>
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
                  {data.recentLockers.map((locker) => (
                    <Table.Row key={locker.id} id={locker.id}>
                      <Table.Cell>
                        <strong>{locker.code}</strong>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="block max-w-72 text-wrap">
                          {locker.address}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        {locker.operatorName ?? (
                          <span className="text-warning">Chưa phân công</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        {connectionLabel(locker.connectionStatus)}
                      </Table.Cell>
                      <Table.Cell>
                        {operationalLabel(locker.operationalStatus)}
                      </Table.Cell>
                      <Table.Cell>
                        {dateTimeFormat.format(new Date(locker.updatedAt))}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card.Content>
      </Card>
    </>
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
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted">
          {state.data
            ? `Cập nhật lúc ${dateTimeFormat.format(new Date(state.data.loadedAt))} (${TIME_ZONE})`
            : 'Đang tải số liệu hệ thống...'}
        </p>
        <Button
          className="ml-auto"
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
        <div
          aria-busy="true"
          aria-label="Đang tải tổng quan"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : null}
    </section>
  );
}
