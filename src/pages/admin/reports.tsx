import type {
  ReportFilterErrors,
  ReportFilters,
} from '@/services/admin-report-service';

import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  Skeleton,
  TextField,
  Typography,
} from '@heroui/react';
import ArrowDownToLine from '@gravity-ui/icons/ArrowDownToLine';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import Funnel from '@gravity-ui/icons/Funnel';

import { useAsyncResource } from '@/hooks/use-async-resource';
import { listAdminLockers } from '@/services/admin-locker-service';
import {
  DEFAULT_REPORT_DAYS,
  downloadReportCsv,
  emptyReportFilters,
  sameReportFilters,
  getReportErrorMessage,
  getReportSummary,
  REPORT_METRICS,
  validateReportFilters,
} from '@/services/admin-report-service';

const ALL_LOCKERS = '__all__';
const numberFormatter = new Intl.NumberFormat('vi-VN');
const dateFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' });

function ErrorAlert({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert role="alert" status="danger">
      <Alert.Indicator>
        <CircleExclamation aria-hidden="true" />
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

export default function AdminReportsPage() {
  // `draft` is what the admin is editing; `applied` drives the request so the
  // summary and the CSV always describe the same filters.
  const [draft, setDraft] = useState<ReportFilters>(emptyReportFilters);
  const [applied, setApplied] = useState<ReportFilters>(emptyReportFilters);
  const [errors, setErrors] = useState<ReportFilterErrors>({});
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const lockers = useAsyncResource(listAdminLockers, getReportErrorMessage, []);
  // Keep the filters that produced the numbers next to them, so a stale or
  // failed reload can never be shown or exported under another scope.
  const report = useAsyncResource(
    async (signal) => ({
      filters: applied,
      summary: await getReportSummary(applied, signal),
    }),
    getReportErrorMessage,
    [applied],
  );

  const lockerOptions = lockers.state.data ?? [];
  const selectedLocker = lockerOptions.find(
    (locker) => locker.id === applied.lockerId,
  );

  const update = (patch: Partial<ReportFilters>) => {
    const next = { ...draft, ...patch };

    setDraft(next);
    if (Object.keys(errors).length) setErrors(validateReportFilters(next));
  };

  const apply = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateReportFilters(draft);

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setExportError('');
    setApplied({ ...draft });
  };

  const reset = () => {
    setDraft(emptyReportFilters());
    setApplied(emptyReportFilters());
    setErrors({});
    setExportError('');
  };

  const exportCsv = async () => {
    if (isExporting) return;

    setIsExporting(true);
    setExportError('');

    try {
      if (!loadedFilters) return;
      await downloadReportCsv(loadedFilters);
    } catch (error) {
      setExportError(getReportErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  const loaded = report.state.data;
  // Numbers are shown (and exportable) only when they belong to the filters
  // currently applied; while a new request loads or after it fails, they are not.
  const isCurrent = loaded ? sameReportFilters(loaded.filters, applied) : false;
  const summary = isCurrent ? loaded?.summary : undefined;
  const loadedFilters = isCurrent ? loaded?.filters : undefined;
  const canExport =
    Boolean(loadedFilters) && report.state.status === 'success' && !isExporting;
  const scope = selectedLocker
    ? `Tủ ${selectedLocker.code}`
    : 'Toàn bộ hệ thống';
  const period = summary
    ? `${dateFormatter.format(new Date(summary.from))} – ${dateFormatter.format(new Date(summary.to))}`
    : `${DEFAULT_REPORT_DAYS} ngày gần nhất`;
  const isDirty = JSON.stringify(draft) !== JSON.stringify(applied);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Typography type="h2">Báo cáo hệ thống</Typography>
          <p className="text-muted">
            {scope} · {period}. Mặc định là {DEFAULT_REPORT_DAYS} ngày gần nhất.
          </p>
        </div>
        <Button
          isDisabled={!canExport}
          variant="secondary"
          onPress={() => void exportCsv()}
        >
          <ArrowDownToLine aria-hidden="true" className="size-4" />
          {isExporting ? 'Đang xuất...' : 'Xuất CSV'}
        </Button>
      </div>

      <Card>
        <Card.Header className="flex-row items-center gap-3">
          <Funnel aria-hidden="true" className="size-5 text-accent" />
          <Card.Title>Bộ lọc</Card.Title>
        </Card.Header>
        <Card.Content>
          <Form
            className="grid gap-4 md:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto] md:items-start"
            validationBehavior="aria"
            onSubmit={apply}
          >
            <Select
              isDisabled={lockers.state.status === 'loading'}
              value={draft.lockerId || ALL_LOCKERS}
              variant="secondary"
              onChange={(key) =>
                update({
                  lockerId: key === ALL_LOCKERS ? '' : String(key),
                })
              }
            >
              <Label>Tủ</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id={ALL_LOCKERS} textValue="Tất cả tủ">
                    Tất cả tủ
                  </ListBox.Item>
                  {lockerOptions.map((locker) => (
                    <ListBox.Item
                      key={locker.id}
                      id={locker.id}
                      textValue={`${locker.code} ${locker.address}`}
                    >
                      <span className="flex flex-col">
                        <span className="font-medium">{locker.code}</span>
                        <span className="text-xs text-muted">
                          {locker.address}
                        </span>
                      </span>
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <TextField
              fullWidth
              isInvalid={Boolean(errors.from)}
              type="date"
              value={draft.from}
              onChange={(from) => update({ from })}
            >
              <Label>Từ ngày</Label>
              <Input variant="secondary" />
              <FieldError>{errors.from}</FieldError>
            </TextField>
            <TextField
              fullWidth
              isInvalid={Boolean(errors.to)}
              type="date"
              value={draft.to}
              onChange={(to) => update({ to })}
            >
              <Label>Đến ngày</Label>
              <Input variant="secondary" />
              <FieldError>{errors.to}</FieldError>
            </TextField>
            <div className="flex gap-2 md:pt-6">
              <Button type="button" variant="ghost" onPress={reset}>
                Đặt lại
              </Button>
              <Button isDisabled={!isDirty} type="submit" variant="primary">
                Áp dụng
              </Button>
            </div>
          </Form>
          {lockers.state.status === 'error' ? (
            <div className="mt-4">
              <ErrorAlert
                message={`Không tải được danh sách tủ. ${lockers.state.message}`}
                onRetry={lockers.reload}
              />
            </div>
          ) : null}
        </Card.Content>
      </Card>

      {exportError ? <ErrorAlert message={exportError} /> : null}
      {report.state.status === 'error' ? (
        <ErrorAlert message={report.state.message} onRetry={report.reload} />
      ) : null}

      {report.state.status === 'loading' && !summary ? (
        <div
          aria-busy="true"
          aria-label="Đang tải báo cáo"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {REPORT_METRICS.map((metric) => (
            <Skeleton key={metric.key} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {summary ? (
        <div
          aria-busy={report.state.status === 'loading'}
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {REPORT_METRICS.map((metric) => (
            <Card key={metric.key}>
              <Card.Content className="gap-2 py-6">
                <span className="text-sm text-muted">{metric.label}</span>
                <strong className="text-4xl tabular-nums">
                  {numberFormatter.format(summary[metric.key])}
                </strong>
                <span className="text-xs text-muted">{metric.description}</span>
              </Card.Content>
            </Card>
          ))}
        </div>
      ) : null}
    </section>
  );
}
