import type { AdminForecast } from '@/services/admin-forecast-service';

import CircleInfo from '@gravity-ui/icons/CircleInfo';
import { Button, Card, Chip, Popover, Skeleton } from '@heroui/react';

type ForecastPanelProps = {
  data?: AdminForecast;
  isLoading: boolean;
  error?: string;
};

const numberFormat = new Intl.NumberFormat('vi-VN');
const riskLabel = {
  normal: 'Bình thường',
  high: 'Nguy cơ cao',
  critical: 'Nguy cơ rất cao',
} as const;

export function ForecastPanel({ data, isLoading, error }: ForecastPanelProps) {
  if (isLoading && !data) return <Skeleton className="h-72 rounded-2xl" />;
  if (error && !data) {
    return (
      <Card>
        <Card.Content>
          <p className="text-sm text-danger">{error}</p>
        </Card.Content>
      </Card>
    );
  }
  if (!data) return null;

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-2">
          <Card.Title>Dự báo vận hành</Card.Title>
          <Popover>
            <Button
              isIconOnly
              aria-label="Cách tính dự báo vận hành"
              size="sm"
              variant="ghost"
            >
              <CircleInfo aria-hidden="true" className="size-4" />
            </Button>
            <Popover.Content className="w-[min(24rem,calc(100vw-2rem))]">
              <Popover.Dialog
                aria-label="Cách tính dự báo vận hành"
                className="space-y-3 p-3 text-sm"
              >
                <Popover.Heading className="font-semibold">
                  Cách tính dự báo
                </Popover.Heading>
                <p>
                  Hệ thống lấy trung bình số kiện giao vào và lấy ra trong các
                  ngày cùng thứ của 90 ngày gần nhất, sau đó cộng dồn với số
                  ngăn đang có hàng.
                </p>
                <p>
                  Ngày sale như 3/3, 5/5 và 11/11 được tăng hệ số nhu cầu. Các
                  ngày sau sale tối đa 3 ngày được đánh dấu vì hàng thường về
                  sau thời điểm khách đặt.
                </p>
                <p className="text-muted">
                  Ví dụ: nếu lịch sử cho thấy trung bình 10 kiện/ngày và ngày
                  5/5 có hệ số 1,15, dự báo ngày đó là khoảng 12 kiện. Tủ đạt từ
                  85% công suất được đưa vào danh sách cần theo dõi.
                </p>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        </div>
        <Card.Description>
          {data.horizonDays} ngày tới · Dựa trên lịch sử giao nhận và thời gian
          lưu kiện
        </Card.Description>
      </Card.Header>
      <Card.Content className="gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <span className="text-xs text-muted">Công suất hiện tại</span>
            <strong className="mt-1 block text-2xl tabular-nums">
              {numberFormat.format(data.currentOccupiedCompartments)} /{' '}
              {numberFormat.format(data.totalOperationalCompartments)}
            </strong>
          </div>
          <div>
            <span className="text-xs text-muted">Đỉnh dự kiến</span>
            <strong className="mt-1 block text-2xl tabular-nums">
              {numberFormat.format(data.forecastPeakOccupancyPercent)}%
            </strong>
          </div>
          <div>
            <span className="text-xs text-muted">Tủ cần theo dõi</span>
            <strong className="mt-1 block text-2xl tabular-nums">
              {numberFormat.format(data.atRiskLockers.length)}
            </strong>
          </div>
        </div>

        {data.dailyForecast.length ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {data.dailyForecast.map((day) => (
              <div
                key={day.date}
                className="min-w-24 rounded-lg bg-surface-secondary p-2 text-center"
              >
                <span className="block text-xs text-muted">
                  {new Date(day.date).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </span>
                <strong className="block text-sm tabular-nums">
                  {day.forecastOccupancyPercent}%
                </strong>
                {day.isDemandEventDay ? (
                  <span className="text-[11px] text-warning">
                    Sau ngày sale
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {data.atRiskLockers.length ? (
          <ul className="divide-y divide-separator">
            {data.atRiskLockers.map((locker) => (
              <li
                key={locker.lockerId}
                className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
              >
                <span>
                  <span className="block text-sm font-medium">
                    {locker.lockerCode}
                  </span>
                  <span className="block text-xs text-muted">
                    {locker.reason}
                  </span>
                </span>
                <Chip
                  color={locker.riskLevel === 'critical' ? 'danger' : 'warning'}
                  size="sm"
                  variant="soft"
                >
                  {riskLabel[locker.riskLevel]}
                </Chip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            Chưa có tủ nào có nguy cơ đầy trong kỳ dự báo.
          </p>
        )}
      </Card.Content>
    </Card>
  );
}
