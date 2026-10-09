import { Button, Card, Typography } from '@heroui/react';
import { useEffect, useState } from 'react';
import { getApiUrl } from '@/config/api';
import { readAuthSession } from '@/auth/auth-storage';
import { operationsService, type OperationsReport } from '@/services/operations-service';

export default function AdminReportsPage() {
  const [report, setReport] = useState<OperationsReport | null>(null); const [error, setError] = useState('');
  useEffect(() => { void operationsService.report().then(setReport).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Không thể tải báo cáo.')); }, []);
  const download = async () => { try { const token = readAuthSession()?.accessToken; const headers = new Headers({ Accept: 'text/csv' }); if (token) headers.set('Authorization', `Bearer ${token}`); const response = await fetch(getApiUrl('/api/reports/summary'), { headers }); if (!response.ok) throw new Error('Không thể xuất báo cáo.'); const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'boxora-report.csv'; link.click(); URL.revokeObjectURL(url); } catch (e) { setError(e instanceof Error ? e.message : 'Không thể xuất báo cáo.'); } };
  const cards = report ? [['Lượt giao', report.deliveries], ['Hàng gửi', report.returns], ['Đã nhận', report.retrievedParcels], ['Sự cố mở', report.openIncidents], ['Bảo trì', report.maintenanceRequests], ['Mở khẩn cấp', report.emergencyUnlocks]] : [];
  return <section className="flex flex-col gap-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><Typography type="h2">Báo cáo hệ thống</Typography><p className="text-muted">Tổng hợp 30 ngày gần nhất từ dữ liệu thật.</p></div><Button onPress={() => void download()}>Xuất CSV</Button></div>{error ? <p className="text-danger">{error}</p> : null}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label, value]) => <Card key={String(label)}><Card.Content className="gap-2 py-6"><span className="text-sm text-muted">{label}</span><strong className="text-4xl">{value}</strong></Card.Content></Card>)}</div></section>;
}
