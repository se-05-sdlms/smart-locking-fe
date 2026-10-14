import { Button, Card, Chip, Typography } from '@heroui/react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useOperationsRealtime } from '@/hooks/use-operations-realtime';
import {
  operationsService,
  type OperationalLocker,
} from '@/services/operations-service';

export default function OperatorDashboardPage() {
  const navigate = useNavigate();
  const [lockers, setLockers] = useState<OperationalLocker[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setLockers(await operationsService.lockers());
      setError('');
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Không thể tải dữ liệu vận hành.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useOperationsRealtime(
    lockers.map((locker) => locker.id),
    () => void load(),
  );

  const available = lockers.reduce(
    (sum, locker) => sum + locker.availableCompartments,
    0,
  );
  const parcels = lockers.reduce(
    (sum, locker) => sum + locker.storedParcels,
    0,
  );
  const incidents = lockers.reduce(
    (sum, locker) => sum + locker.openIncidents,
    0,
  );

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Typography type="h2">Vận hành locker</Typography>
        <p className="text-muted">
          Trạng thái trực tiếp trong phạm vi được phân công.
        </p>
      </div>
      {error ? <p className="text-danger">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Tủ được giao', lockers.length],
          ['Ngăn đang trống', available],
          ['Sự cố cần xử lý', incidents],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <Card.Content className="gap-2 py-6">
              <span className="text-sm text-muted">{label}</span>
              <strong className="text-4xl">{value}</strong>
            </Card.Content>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {lockers.map((locker) => (
          <Card key={locker.id}>
            <Card.Header className="flex-row items-start justify-between">
              <div>
                <Card.Title>{locker.code}</Card.Title>
                <Card.Description>{locker.address}</Card.Description>
              </div>
              <Chip
                color={locker.connection === 'Online' ? 'success' : 'warning'}
                variant="soft"
              >
                {locker.connection}
              </Chip>
            </Card.Header>
            <Card.Content className="grid grid-cols-3 gap-3 pb-6 text-center">
              <div>
                <strong className="block text-2xl">
                  {locker.availableCompartments}
                </strong>
                <span className="text-xs text-muted">Ngăn trống</span>
              </div>
              <div>
                <strong className="block text-2xl">
                  {locker.storedParcels}
                </strong>
                <span className="text-xs text-muted">Kiện đang lưu</span>
              </div>
              <div>
                <strong className="block text-2xl">
                  {locker.openIncidents}
                </strong>
                <span className="text-xs text-muted">Sự cố mở</span>
              </div>
            </Card.Content>
          </Card>
        ))}
      </div>
      <div className="flex gap-3">
        <Button onPress={() => navigate('/operator/maintenance')}>
          Quản lý bảo trì
        </Button>
        <Button
          variant="secondary"
          onPress={() => navigate('/operator/overdue-clearance')}
        >
          Xử lý hàng quá hạn ({parcels})
        </Button>
      </div>
    </section>
  );
}
