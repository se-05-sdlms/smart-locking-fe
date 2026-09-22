import {
  Button,
  Card,
  Chip,
  Link,
  Separator,
  Table,
  Typography,
} from '@heroui/react';
import ChartLine from '@gravity-ui/icons/ChartLine';
import ChevronRight from '@gravity-ui/icons/ChevronRight';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import CirclePlus from '@gravity-ui/icons/CirclePlus';
import Gear from '@gravity-ui/icons/Gear';
import Persons from '@gravity-ui/icons/Persons';
import PersonWorker from '@gravity-ui/icons/PersonWorker';
import { useNavigate } from 'react-router-dom';

import { ADMIN_LOCKERS, AUDIT_LOGS } from './admin-data';

const METRICS: Array<{
  label: string;
  value: string;
  meta: string;
  tone: string;
}> = [
  {
    label: 'Tổng số locker',
    value: '24',
    meta: '21 đang hoạt động',
    tone: 'text-success',
  },
  {
    label: 'Tổng số ngăn',
    value: '576',
    meta: '418 trống · 132 đang dùng',
    tone: 'text-accent',
  },
  {
    label: 'Người dùng',
    value: '1.284',
    meta: '1.198 cư dân · 72 operator',
    tone: 'text-success',
  },
  {
    label: 'Bưu kiện đang lưu',
    value: '132',
    meta: '18 mới hôm nay',
    tone: 'text-accent',
  },
  {
    label: 'Hàng quá hạn',
    value: '17',
    meta: 'Cần xử lý',
    tone: 'text-danger',
  },
  {
    label: 'Locker offline',
    value: '3',
    meta: 'Cần kiểm tra',
    tone: 'text-warning',
  },
  {
    label: 'Sự cố mở',
    value: '6',
    meta: '2 mức cao',
    tone: 'text-warning',
  },
  {
    label: 'Phí quá hạn',
    value: '4.250.000đ',
    meta: 'Trong 30 ngày',
    tone: 'text-success',
  },
];

const PARCELS = [18, 25, 28, 20, 32, 24, 18];
const DAYS = ['12/9', '13/9', '14/9', '15/9', '16/9', '17/9', '18/9'];

function LockerStatus({
  status,
}: {
  status: (typeof ADMIN_LOCKERS)[number]['status'];
}) {
  if (status === 'maintenance')
    return (
      <Chip color="warning" size="sm" variant="soft">
        Bảo trì
      </Chip>
    );
  if (status === 'suspended')
    return (
      <Chip color="danger" size="sm" variant="soft">
        Tạm ngưng
      </Chip>
    );
  return (
    <Chip color="success" size="sm" variant="soft">
      Hoạt động
    </Chip>
  );
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const recentLockers = ADMIN_LOCKERS.slice(0, 5);

  return (
    <section className="flex w-full flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {METRICS.map((metric) => (
          <Card key={metric.label} className="h-28">
            <Card.Header className="pb-0">
              <Card.Title className="text-sm font-normal text-muted">
                {metric.label}
              </Card.Title>
            </Card.Header>
            <Card.Footer className="mt-auto items-end justify-between pt-0">
              <span className="text-3xl font-semibold leading-none tracking-tight">
                {metric.value}
              </span>
              <span className="max-w-44 pb-0.5 text-right text-xs text-muted">
                <span className={metric.tone}>●</span> {metric.meta}
              </span>
            </Card.Footer>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.2fr_1fr]">
        <Card>
          <Card.Header>
            <Card.Title>Tình trạng locker</Card.Title>
          </Card.Header>
          <Card.Content className="flex items-center justify-center gap-7 pb-6">
            <div
              aria-label="21 locker hoạt động, 1 bảo trì, 3 offline"
              className="relative flex size-36 shrink-0 items-center justify-center rounded-full"
              role="img"
              style={{
                background:
                  'conic-gradient(var(--color-success) 0 84%, var(--color-warning) 84% 88%, var(--color-danger) 88% 100%)',
              }}
            >
              <span className="flex size-20 flex-col items-center justify-center rounded-full bg-background shadow-sm">
                <strong className="text-2xl">24</strong>
                <span className="text-xs text-muted">Locker</span>
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-success">●</span> Hoạt động{' '}
                <strong className="ml-2">21</strong>
              </p>
              <p>
                <span className="text-warning">●</span> Bảo trì{' '}
                <strong className="ml-2">1</strong>
              </p>
              <p>
                <span className="text-danger">●</span> Offline{' '}
                <strong className="ml-2">3</strong>
              </p>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Bưu kiện 7 ngày</Card.Title>
          </Card.Header>
          <Card.Content className="pb-6">
            <div
              className="flex h-48 items-end gap-3 border-b border-default px-2"
              role="img"
              aria-label="Biểu đồ số bưu kiện trong 7 ngày"
            >
              {PARCELS.map((value, index) => (
                <span
                  key={DAYS[index]}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                >
                  <span className="text-xs font-medium">{value}</span>
                  <span
                    className="w-full max-w-10 rounded-t-md bg-accent"
                    style={{ height: `${value * 4}px` }}
                  />
                  <span className="pb-2 text-xs text-muted">{DAYS[index]}</span>
                </span>
              ))}
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title>Locker cần chú ý</Card.Title>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => navigate('/admin/lockers')}
            >
              Xem tất cả
              <ChevronRight className="size-4" />
            </Button>
          </Card.Header>
          <Card.Content>
            {ADMIN_LOCKERS.filter(
              (locker) =>
                locker.status !== 'active' || locker.connection === 'offline',
            ).map((locker, index) => (
              <div key={locker.id}>
                {index ? <Separator /> : null}
                <Link
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-foreground no-underline hover:bg-default"
                  href="/admin/lockers"
                >
                  <CircleExclamation
                    className={
                      locker.connection === 'offline'
                        ? 'size-5 text-danger'
                        : 'size-5 text-warning'
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block">{locker.id}</strong>
                    <span className="block truncate text-xs text-muted">
                      {locker.address}
                    </span>
                  </span>
                  <LockerStatus status={locker.status} />
                </Link>
              </div>
            ))}
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Trạng thái ngăn toàn hệ thống</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-4 pb-6">
          <div className="flex h-4 overflow-hidden rounded-full bg-default">
            <span className="bg-accent" style={{ width: '72.6%' }} />
            <span className="bg-success" style={{ width: '22.9%' }} />
            <span className="bg-danger" style={{ width: '2.1%' }} />
            <span className="bg-warning" style={{ width: '1.7%' }} />
            <span className="bg-muted" style={{ width: '0.7%' }} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            {[
              ['text-accent', '418', 'Trống'],
              ['text-success', '132', 'Đang sử dụng'],
              ['text-danger', '12', 'Quá hạn'],
              ['text-warning', '10', 'Bảo trì'],
              ['text-muted', '4', 'Khóa lỗi'],
            ].map(([tone, value, label]) => (
              <span key={label}>
                <span className={tone}>●</span> <strong>{value}</strong>{' '}
                <span className="text-muted">{label}</span>
              </span>
            ))}
          </div>
        </Card.Content>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onPress={() => navigate('/admin/lockers')}>
          <CirclePlus className="size-4" />
          Thêm locker
        </Button>
        <Button variant="outline" onPress={() => navigate('/admin/users')}>
          <Persons className="size-4" />
          Tạo người dùng
        </Button>
        <Button variant="outline" onPress={() => navigate('/admin/operators')}>
          <PersonWorker className="size-4" />
          Phân công Operator
        </Button>
        <Button variant="outline" onPress={() => navigate('/admin/reports')}>
          <ChartLine className="size-4" />
          Xuất báo cáo
        </Button>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1.55fr_0.75fr]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Typography type="h5">Locker cập nhật gần đây</Typography>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => navigate('/admin/lockers')}
            >
              Xem tất cả
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Locker cập nhật gần đây">
                <Table.Header>
                  <Table.Column id="code" isRowHeader>
                    Mã tủ
                  </Table.Column>
                  <Table.Column id="address">Địa chỉ</Table.Column>
                  <Table.Column id="operator">Operator</Table.Column>
                  <Table.Column id="connection">Kết nối</Table.Column>
                  <Table.Column id="status">Vận hành</Table.Column>
                  <Table.Column id="action">Thao tác</Table.Column>
                </Table.Header>
                <Table.Body>
                  {recentLockers.map((locker) => (
                    <Table.Row key={locker.id} id={locker.id}>
                      <Table.Cell>
                        <strong>{locker.id}</strong>
                      </Table.Cell>
                      <Table.Cell>{locker.address}</Table.Cell>
                      <Table.Cell>
                        {locker.operator ?? 'Chưa phân công'}
                      </Table.Cell>
                      <Table.Cell>
                        <Chip
                          color={
                            locker.connection === 'online'
                              ? 'success'
                              : 'danger'
                          }
                          size="sm"
                          variant="soft"
                        >
                          {locker.connection === 'online'
                            ? 'Online'
                            : 'Offline'}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <LockerStatus status={locker.status} />
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => navigate('/admin/lockers')}
                        >
                          Chi tiết
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </section>

        <Card>
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title>Audit log gần đây</Card.Title>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => navigate('/admin/audit-logs')}
            >
              Xem tất cả
              <ChevronRight className="size-4" />
            </Button>
          </Card.Header>
          <Card.Content>
            {AUDIT_LOGS.slice(0, 5).map((log, index) => (
              <div key={log.id}>
                {index ? <Separator /> : null}
                <div className="flex items-center gap-3 py-3">
                  <span
                    className={`flex size-8 items-center justify-center rounded-full ${log.result === 'failed' ? 'bg-danger/10 text-danger' : log.result === 'warning' ? 'bg-warning/10 text-warning' : 'bg-accent/10 text-accent'}`}
                  >
                    {log.module === 'Locker' ? (
                      <Gear className="size-4" />
                    ) : (
                      <ChartLine className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {log.action}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {log.actor} · {log.target}
                    </span>
                  </span>
                  <span className="text-xs text-muted">
                    {log.time.slice(11)}
                  </span>
                </div>
              </div>
            ))}
          </Card.Content>
        </Card>
      </div>
    </section>
  );
}
