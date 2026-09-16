import type { ComponentType, SVGProps } from 'react';

import {
  Button,
  Card,
  Chip,
  Link,
  Separator,
  Table,
  Typography,
} from '@heroui/react';
import Box from '@gravity-ui/icons/Box';
import ChevronRight from '@gravity-ui/icons/ChevronRight';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import Gear from '@gravity-ui/icons/Gear';
import LockOpen from '@gravity-ui/icons/LockOpen';
import { useNavigate } from 'react-router-dom';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const OVERDUE_ROWS = [
  {
    id: 'P123459',
    locker: 'LK-04',
    compartment: 'N08',
    expiredAt: '11/09/2026 00:00',
    overdue: '5 ngày 1 giờ',
  },
  {
    id: 'P123457',
    locker: 'LK-01',
    compartment: 'N12',
    expiredAt: '13/09/2026 00:00',
    overdue: '3 ngày 9 giờ',
  },
  {
    id: 'P123456',
    locker: 'LK-01',
    compartment: 'N06',
    expiredAt: '14/09/2026 00:00',
    overdue: '2 ngày 7 giờ',
  },
  {
    id: 'P123458',
    locker: 'LK-02',
    compartment: 'N03',
    expiredAt: '15/09/2026 00:00',
    overdue: '1 ngày 3 giờ',
  },
];

const ATTENTION_LOCKERS = [
  {
    id: 'LK-01',
    name: 'Tủ Nguyễn Huệ',
    meta: '24 ngăn · 2 hàng quá hạn',
    status: 'Cần xử lý',
    tone: 'danger' as const,
  },
  {
    id: 'LK-02',
    name: 'Tủ Lê Lợi',
    meta: '20 ngăn · 1 hàng quá hạn',
    status: 'Cần xử lý',
    tone: 'danger' as const,
  },
  {
    id: 'LK-05',
    name: 'Tủ Phú Mỹ Hưng',
    meta: '24 ngăn · Có lỗi thiết bị',
    status: 'Cần kiểm tra',
    tone: 'warning' as const,
  },
];

const ACTIVITIES: Array<{
  icon: IconComponent;
  title: string;
  detail: string;
  time: string;
  iconClassName: string;
}> = [
  {
    icon: LockOpen,
    title: 'Mở ngăn N06 tại tủ LK-01',
    detail: 'Operator thực hiện',
    time: '14:20',
    iconClassName: 'bg-accent/10 text-accent',
  },
  {
    icon: Box,
    title: 'Xử lý hàng quá hạn P123456',
    detail: 'Đã chuyển đến điểm lưu giữ',
    time: '13:45',
    iconClassName: 'bg-warning/10 text-warning',
  },
  {
    icon: Gear,
    title: 'Cập nhật trạng thái tủ LK-05',
    detail: 'Ghi nhận lỗi thiết bị',
    time: '11:12',
    iconClassName: 'bg-default text-muted',
  },
  {
    icon: LockOpen,
    title: 'Mở ngăn N12 tại tủ LK-02',
    detail: 'Operator thực hiện',
    time: '10:30',
    iconClassName: 'bg-accent/10 text-accent',
  },
  {
    icon: CircleCheck,
    title: 'Đăng nhập hệ thống',
    detail: 'Phiên làm việc bắt đầu',
    time: '08:00',
    iconClassName: 'bg-success/10 text-success',
  },
];

export default function OperatorDashboardPage() {
  const navigate = useNavigate();

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="h-28">
          <Card.Header className="pb-0">
            <Card.Title className="text-sm font-normal text-muted">
              Tổng số tủ
            </Card.Title>
          </Card.Header>
          <Card.Footer className="mt-auto items-end justify-between pt-0">
            <span className="text-3xl font-semibold leading-none tracking-tight">
              3
            </span>
            <span className="pb-0.5 text-xs text-muted">
              <span className="text-success">●</span> 3 tủ đang hoạt động
            </span>
          </Card.Footer>
        </Card>
        <Card className="h-28">
          <Card.Header className="pb-0">
            <Card.Title className="text-sm font-normal text-muted">
              Tổng số ngăn
            </Card.Title>
          </Card.Header>
          <Card.Footer className="mt-auto items-end justify-between pt-0">
            <span className="text-3xl font-semibold leading-none tracking-tight">
              72
            </span>
            <span className="pb-0.5 text-right text-xs text-muted">
              <span className="text-success">●</span> 48 trống ·{' '}
              <span className="text-accent">●</span> 24 đang sử dụng
            </span>
          </Card.Footer>
        </Card>
        <Card className="h-28">
          <Card.Header className="pb-0">
            <Card.Title className="text-sm font-normal text-muted">
              Hàng quá hạn
            </Card.Title>
          </Card.Header>
          <Card.Footer className="mt-auto items-end justify-between pt-0">
            <span className="text-3xl font-semibold leading-none tracking-tight">
              7
            </span>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => navigate('/operator/overdue-clearance')}
            >
              Xem chi tiết
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </Card.Footer>
        </Card>
        <Card className="h-28">
          <Card.Header className="pb-0">
            <Card.Title className="text-sm font-normal text-muted">
              Cảnh báo
            </Card.Title>
          </Card.Header>
          <Card.Footer className="mt-auto items-end justify-between pt-0">
            <span className="text-3xl font-semibold leading-none tracking-tight">
              2
            </span>
            <span className="pb-0.5 text-xs text-muted">
              <span className="text-danger">●</span> Cần xử lý
            </span>
          </Card.Footer>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr_1.05fr]">
        <Card>
          <Card.Header>
            <Card.Title>Tình trạng ngăn</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col items-center gap-6 pb-6 sm:flex-row sm:justify-center">
            <div
              aria-label="48 ngăn trống, 22 ngăn đang sử dụng, 2 ngăn quá hạn"
              className="relative flex size-40 shrink-0 items-center justify-center rounded-full"
              role="img"
              style={{
                background:
                  'conic-gradient(var(--color-success) 0 66.7%, var(--color-accent) 66.7% 97.2%, var(--color-danger) 97.2% 100%)',
              }}
            >
              <span className="flex size-24 flex-col items-center justify-center rounded-full bg-background shadow-sm">
                <span className="text-2xl font-semibold">72</span>
                <span className="text-xs text-muted">Tổng ngăn</span>
              </span>
            </div>
            <div className="w-full space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span><span className="text-success">●</span> Trống</span>
                <strong>48 <span className="font-normal text-muted">(66,7%)</span></strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span><span className="text-accent">●</span> Đang sử dụng</span>
                <strong>22 <span className="font-normal text-muted">(30,6%)</span></strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span><span className="text-danger">●</span> Quá hạn</span>
                <strong>2 <span className="font-normal text-muted">(2,8%)</span></strong>
              </div>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Hàng quá hạn theo tủ</Card.Title>
          </Card.Header>
          <Card.Content className="pb-6">
            <div
              aria-label="LK-01 có 3 hàng quá hạn, LK-02 có 2, LK-03 có 2"
              className="flex h-52 items-end justify-around gap-5 border-b border-default px-4"
              role="img"
            >
              {[
                { id: 'LK-01', value: 3, height: 'h-32' },
                { id: 'LK-02', value: 2, height: 'h-24' },
                { id: 'LK-03', value: 2, height: 'h-24' },
              ].map((item) => (
                <span
                  key={item.id}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                >
                  <span className="text-sm font-semibold">{item.value}</span>
                  <span
                    className={`w-full max-w-14 rounded-t-lg bg-accent ${item.height}`}
                  />
                  <span className="pb-2 text-xs text-muted">{item.id}</span>
                </span>
              ))}
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="flex-row items-center justify-between gap-3">
            <Card.Title>Tủ cần chú ý</Card.Title>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => navigate('/operator/lockers')}
            >
              Xem tất cả
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </Card.Header>
          <Card.Content>
            {ATTENTION_LOCKERS.map((locker, index) => (
              <div key={locker.id}>
                {index ? <Separator /> : null}
                <Link
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-4 text-left text-foreground no-underline transition-colors hover:bg-default"
                  href={`/operator/lockers/${locker.id}`}
                >
                  <CircleExclamation
                    aria-hidden="true"
                    className={`size-5 shrink-0 ${locker.tone === 'danger' ? 'text-danger' : 'text-warning'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{locker.id}</span>
                    <span className="block truncate text-xs font-normal text-muted">
                      {locker.name} · {locker.meta}
                    </span>
                  </span>
                  <Chip color={locker.tone} size="sm" variant="soft">
                    {locker.status}
                  </Chip>
                </Link>
              </div>
            ))}
          </Card.Content>
        </Card>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1.45fr_1fr]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Typography type="h5">Hàng quá hạn gần đây</Typography>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => navigate('/operator/overdue-clearance')}
            >
              Xem tất cả
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Hàng quá hạn gần đây">
                <Table.Header>
                  <Table.Column id="parcel" isRowHeader>Mã bưu kiện</Table.Column>
                  <Table.Column id="locker">Tủ</Table.Column>
                  <Table.Column id="compartment">Ngăn</Table.Column>
                  <Table.Column id="expired">Thời điểm hết hạn</Table.Column>
                  <Table.Column id="overdue">Đã quá hạn</Table.Column>
                  <Table.Column id="action">Thao tác</Table.Column>
                </Table.Header>
                <Table.Body>
                  {OVERDUE_ROWS.map((parcel) => (
                    <Table.Row key={parcel.id} id={parcel.id}>
                      <Table.Cell><span className="font-semibold">{parcel.id}</span></Table.Cell>
                      <Table.Cell>{parcel.locker}</Table.Cell>
                      <Table.Cell>{parcel.compartment}</Table.Cell>
                      <Table.Cell>{parcel.expiredAt}</Table.Cell>
                      <Table.Cell><span className="font-medium text-danger">{parcel.overdue}</span></Table.Cell>
                      <Table.Cell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => navigate(`/operator/overdue-clearance/${parcel.id}`)}
                        >
                          Xử lý
                          <ChevronRight aria-hidden="true" className="size-4" />
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
          <Card.Header>
            <Card.Title>Hoạt động trong hôm nay</Card.Title>
          </Card.Header>
          <Card.Content>
            {ACTIVITIES.map((activity, index) => (
              <div key={`${activity.title}-${activity.time}`}>
                {index ? <Separator /> : null}
                <div className="flex items-center gap-3 py-3">
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full ${activity.iconClassName}`}
                  >
                    <activity.icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {activity.title}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {activity.detail}
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-muted">
                    {activity.time}
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
