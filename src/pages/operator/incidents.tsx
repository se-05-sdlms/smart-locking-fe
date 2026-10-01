import type {
  IncidentDetail,
  IncidentListItem,
  IncidentStatus,
} from '@/types/incident';

import {
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  FieldError,
  Label,
  ListBox,
  Modal,
  SearchField,
  Select,
  Spinner,
  Table,
  TextArea,
  TextField,
  Typography,
  toast,
  useOverlayState,
} from '@heroui/react';
import ArrowLeft from '@gravity-ui/icons/ArrowLeft';
import ArrowsRotateRight from '@gravity-ui/icons/ArrowsRotateRight';
import ChevronDown from '@gravity-ui/icons/ChevronDown';
import ChevronRight from '@gravity-ui/icons/ChevronRight';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import Clock from '@gravity-ui/icons/Clock';
import Comment from '@gravity-ui/icons/Comment';
import Funnel from '@gravity-ui/icons/Funnel';
import Magnifier from '@gravity-ui/icons/Magnifier';
import TriangleExclamation from '@gravity-ui/icons/TriangleExclamation';
import Xmark from '@gravity-ui/icons/Xmark';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '@/services/api-client';
import { incidentService } from '@/services/incident-service';

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const STATUS_LABELS: Record<IncidentStatus, string> = {
  0: 'Mới tiếp nhận',
  1: 'Đang xử lý',
  2: 'Đã giải quyết',
  3: 'Đã chuyển cấp',
};

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403)
      return 'Bạn không được phân công xử lý sự cố này.';
    if (error.status === 404) return 'Không tìm thấy sự cố.';
    if (error.status === 409)
      return error.message || 'Trạng thái sự cố đã thay đổi. Vui lòng tải lại.';

    return error.message || 'Không thể kết nối đến máy chủ.';
  }

  return 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

function StatusChip({ status }: { status: IncidentStatus }) {
  const color =
    status === 2
      ? 'success'
      : status === 1
        ? 'warning'
        : status === 3
          ? 'danger'
          : 'default';

  return (
    <Chip color={color} size="sm" variant="soft">
      {STATUS_LABELS[status]}
    </Chip>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <Card className="min-h-72">
      <Card.Content className="flex flex-1 flex-col items-center justify-center gap-3">
        <Spinner aria-label={label} color="accent" />
        <Typography className="text-muted">{label}</Typography>
      </Card.Content>
    </Card>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Alert status="danger">
      <Alert.Indicator>
        <TriangleExclamation aria-hidden="true" className="size-5" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>Không thể tải dữ liệu</Alert.Title>
        <Alert.Description>{message}</Alert.Description>
        <Button className="mt-4" size="sm" variant="outline" onPress={onRetry}>
          <ArrowsRotateRight aria-hidden="true" className="size-4" />
          Thử lại
        </Button>
      </Alert.Content>
    </Alert>
  );
}

function IncidentListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<IncidentListItem[]>([]);
  const [status, setStatus] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(
        await incidentService.getAll(
          status === 'all' ? undefined : (Number(status) as IncidentStatus),
        ),
      );
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase('vi-VN');

    if (!query) return items;

    return items.filter((item) =>
      [item.title, item.lockerCode, item.parcelCode ?? ''].some((value) =>
        value.toLocaleLowerCase('vi-VN').includes(query),
      ),
    );
  }, [items, keyword]);

  if (loading) return <LoadingState label="Đang tải danh sách sự cố" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Cần tiếp nhận"
          tone="text-accent"
          value={items.filter((item) => item.status === 0).length}
        />
        <SummaryCard
          label="Đang xử lý"
          tone="text-warning"
          value={items.filter((item) => item.status === 1).length}
        />
        <SummaryCard
          label="Đã chuyển cấp"
          tone="text-danger"
          value={items.filter((item) => item.status === 3).length}
        />
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Tìm kiếm và lọc</Card.Title>
          <Card.Description>
            Chỉ hiển thị sự cố thuộc các locker bạn đang phụ trách.
          </Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-3 md:grid-cols-[minmax(18rem,1fr)_15rem_auto]">
          <SearchField
            fullWidth
            aria-label="Tìm sự cố"
            value={keyword}
            variant="secondary"
            onChange={setKeyword}
          >
            <SearchField.Group>
              <SearchField.SearchIcon>
                <Magnifier aria-hidden="true" className="size-4" />
              </SearchField.SearchIcon>
              <SearchField.Input placeholder="Tiêu đề, mã locker hoặc bưu kiện..." />
              <SearchField.ClearButton aria-label="Xóa từ khóa">
                <Xmark aria-hidden="true" className="size-4" />
              </SearchField.ClearButton>
            </SearchField.Group>
          </SearchField>
          <Select
            aria-label="Lọc theo trạng thái"
            value={status}
            variant="secondary"
            onChange={(value) => setStatus(String(value ?? 'all'))}
          >
            <Select.Trigger>
              <Funnel aria-hidden="true" className="size-4 text-accent" />
              <Select.Value />
              <Select.Indicator>
                <ChevronDown aria-hidden="true" className="size-4" />
              </Select.Indicator>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="all" textValue="Tất cả trạng thái">
                  Tất cả trạng thái
                </ListBox.Item>
                {([0, 1, 2, 3] as IncidentStatus[]).map((value) => (
                  <ListBox.Item
                    key={value}
                    id={String(value)}
                    textValue={STATUS_LABELS[value]}
                  >
                    {STATUS_LABELS[value]}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <Button variant="outline" onPress={() => void load()}>
            <ArrowsRotateRight aria-hidden="true" className="size-4" />
            Làm mới
          </Button>
        </Card.Content>
      </Card>

      {filtered.length ? (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Danh sách sự cố">
              <Table.Header>
                <Table.Column isRowHeader id="incident">
                  Sự cố
                </Table.Column>
                <Table.Column id="locker">Locker / Bưu kiện</Table.Column>
                <Table.Column id="updated">Cập nhật</Table.Column>
                <Table.Column id="status">Trạng thái</Table.Column>
                <Table.Column id="action">Thao tác</Table.Column>
              </Table.Header>
              <Table.Body>
                {filtered.map((item) => (
                  <Table.Row key={item.id} id={item.id}>
                    <Table.Cell>
                      <span className="block font-semibold">{item.title}</span>
                      <span className="block text-xs text-muted">
                        Loại: {item.type}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="block font-medium">
                        {item.lockerCode}
                      </span>
                      <span className="block text-xs text-muted">
                        {item.parcelCode
                          ? `Bưu kiện ${item.parcelCode}`
                          : item.lockerAddress}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <time
                        className="text-sm text-muted"
                        dateTime={item.updatedAt}
                      >
                        {dateFormatter.format(new Date(item.updatedAt))}
                      </time>
                    </Table.Cell>
                    <Table.Cell>
                      <StatusChip status={item.status} />
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          navigate(`/operator/incidents/${item.id}`)
                        }
                      >
                        Xem chi tiết
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      ) : (
        <EmptyState className="min-h-72 text-center">
          <CircleCheck
            aria-hidden="true"
            className="mx-auto size-10 text-success"
          />
          <Typography className="mt-4" type="h5">
            Không có sự cố phù hợp
          </Typography>
          <Typography className="mx-auto mt-2 max-w-md text-muted">
            Thử đổi từ khóa hoặc bộ lọc. Sự cố mới từ cư dân sẽ xuất hiện tại
            đây.
          </Typography>
        </EmptyState>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <Card>
      <Card.Content className="flex items-end justify-between gap-4">
        <div>
          <Typography className="text-sm text-muted">{label}</Typography>
          <strong className={`mt-2 block text-3xl ${tone}`}>{value}</strong>
        </div>
        <CircleExclamation aria-hidden="true" className={`size-7 ${tone}`} />
      </Card.Content>
    </Card>
  );
}

type Operation = 'action' | 'investigate' | 'resolve' | 'escalate';

function IncidentDetailPage({ id }: { id: string }) {
  const navigate = useNavigate();
  const modal = useOverlayState();
  const [incident, setIncident] = useState<IncidentDetail>();
  const [operation, setOperation] = useState<Operation>('action');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setIncident(await incidentService.getDetail(id));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  function openOperation(next: Operation) {
    setOperation(next);
    setNotes('');
    modal.open();
  }

  async function submit() {
    const value = notes.trim();

    if (!incident || !value) return;
    setSaving(true);
    try {
      const updated =
        operation === 'action'
          ? await incidentService.addAction(incident.id, value)
          : await incidentService.updateStatus(incident.id, {
              status:
                operation === 'investigate'
                  ? 1
                  : operation === 'resolve'
                    ? 2
                    : 3,
              ...(operation === 'resolve'
                ? { resolutionSummary: value }
                : { notes: value }),
            });

      setIncident(updated);
      modal.close();
      toast.success('Đã cập nhật sự cố', {
        description:
          operation === 'action'
            ? 'Ghi chú xử lý đã được thêm vào timeline.'
            : `Trạng thái mới: ${STATUS_LABELS[updated.status]}.`,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
    } catch (saveError) {
      toast.danger('Không thể cập nhật sự cố', {
        description: errorMessage(saveError),
        indicator: (
          <TriangleExclamation aria-hidden="true" className="size-5" />
        ),
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Đang tải chi tiết sự cố" />;
  if (error || !incident)
    return (
      <ErrorState
        message={error || 'Không tìm thấy sự cố.'}
        onRetry={() => void load()}
      />
    );

  const canInvestigate = incident.status === 0;
  const canResolve = incident.status === 1;
  const canEscalate = incident.status === 0 || incident.status === 1;

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onPress={() => navigate('/operator/incidents')}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Danh sách sự cố
        </Button>
        <StatusChip status={incident.status} />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="border border-accent/40">
            <Card.Header>
              <Card.Title>{incident.title}</Card.Title>
              <Card.Description>
                {incident.type} · Tạo lúc{' '}
                {dateFormatter.format(new Date(incident.createdAt))}
              </Card.Description>
            </Card.Header>
            <Card.Content className="space-y-5">
              <Typography>{incident.description}</Typography>
              <dl className="grid gap-4 border-t border-default pt-4 sm:grid-cols-2">
                <Info
                  label="Locker"
                  value={`${incident.lockerCode} · ${incident.lockerAddress}`}
                />
                <Info
                  label="Ngăn tủ"
                  value={incident.lockerCompartmentCode ?? 'Không xác định'}
                />
                <Info
                  label="Bưu kiện"
                  value={incident.parcelCode ?? 'Không liên kết'}
                />
                <Info
                  label="Operator"
                  value={incident.assignedOperatorName ?? 'Đang chờ định tuyến'}
                />
              </dl>
            </Card.Content>
          </Card>
          <Card>
            <Card.Header>
              <Card.Title>Timeline xử lý</Card.Title>
              <Card.Description>
                Mọi ghi chú và thay đổi trạng thái đều được lưu theo thời gian.
              </Card.Description>
            </Card.Header>
            <Card.Content className="space-y-0">
              <Timeline
                date={incident.createdAt}
                detail="Sự cố đã được tạo và định tuyến theo locker."
                last={!incident.actions.length}
                title="Hệ thống tiếp nhận báo cáo"
              />
              {incident.actions.map((action, index) => (
                <Timeline
                  key={action.id}
                  date={action.createdAt}
                  detail={`${action.notes ?? 'Không có ghi chú'} · ${action.actionByName}`}
                  last={index === incident.actions.length - 1}
                  title={
                    action.toStatus === null
                      ? action.actionType
                      : STATUS_LABELS[action.toStatus]
                  }
                />
              ))}
            </Card.Content>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <Card.Header>
              <Card.Title>Thao tác nghiệp vụ</Card.Title>
              <Card.Description>
                Ghi nhận đúng việc đã thực hiện tại locker.
              </Card.Description>
            </Card.Header>
            <Card.Content className="space-y-3">
              <Button
                fullWidth
                variant="outline"
                onPress={() => openOperation('action')}
              >
                <Comment aria-hidden="true" className="size-4" />
                Thêm ghi chú xử lý
              </Button>
              {canInvestigate ? (
                <Button fullWidth onPress={() => openOperation('investigate')}>
                  <Clock aria-hidden="true" className="size-4" />
                  Bắt đầu xử lý
                </Button>
              ) : null}
              {canResolve ? (
                <Button
                  fullWidth
                  variant="primary"
                  onPress={() => openOperation('resolve')}
                >
                  <CircleCheck aria-hidden="true" className="size-4" />
                  Hoàn tất sự cố
                </Button>
              ) : null}
              {canEscalate ? (
                <Button
                  fullWidth
                  variant="danger"
                  onPress={() => openOperation('escalate')}
                >
                  <TriangleExclamation aria-hidden="true" className="size-4" />
                  Chuyển cấp Admin
                </Button>
              ) : null}
            </Card.Content>
          </Card>
          <Alert status="default">
            <Alert.Indicator>
              <CircleExclamation aria-hidden="true" className="size-5" />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Xử lý tại hiện trường</Alert.Title>
              <Alert.Description>
                Kiểm tra thiết bị, dùng khóa vật lý hoặc reset theo quy trình
                phù hợp. Sau đó ghi lại hành động tại đây. Hệ thống này không tự
                mở ngăn từ màn hình sự cố.
              </Alert.Description>
            </Alert.Content>
          </Alert>
          {incident.resolutionSummary ? (
            <Card variant="secondary">
              <Card.Header>
                <Card.Title>Kết quả xử lý</Card.Title>
              </Card.Header>
              <Card.Content>
                <Typography>{incident.resolutionSummary}</Typography>
              </Card.Content>
            </Card>
          ) : null}
        </div>
      </div>

      <OperationModal
        notes={notes}
        operation={operation}
        saving={saving}
        state={modal}
        onNotesChange={setNotes}
        onSubmit={() => void submit()}
      />
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function Timeline({
  title,
  detail,
  date,
  last,
}: {
  title: string;
  detail: string;
  date: string;
  last: boolean;
}) {
  return (
    <div className="grid grid-cols-[1rem_1fr] gap-3">
      <div className="flex flex-col items-center">
        <span className="mt-1 size-3 rounded-full bg-accent" />
        {last ? null : <span className="min-h-14 w-px flex-1 bg-default" />}
      </div>
      <div className="pb-5">
        <Typography className="font-medium">{title}</Typography>
        <Typography className="text-sm text-muted">{detail}</Typography>
        <time className="mt-1 block text-xs text-muted" dateTime={date}>
          {dateFormatter.format(new Date(date))}
        </time>
      </div>
    </div>
  );
}

function OperationModal({
  operation,
  notes,
  saving,
  state,
  onNotesChange,
  onSubmit,
}: {
  operation: Operation;
  notes: string;
  saving: boolean;
  state: ReturnType<typeof useOverlayState>;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const content = {
    action: {
      title: 'Thêm ghi chú xử lý',
      label: 'Hành động đã thực hiện',
      placeholder: 'Ví dụ: Đã đến locker, kiểm tra nguồn và reset thiết bị...',
    },
    investigate: {
      title: 'Bắt đầu xử lý sự cố',
      label: 'Kế hoạch xử lý',
      placeholder: 'Mô tả bước kiểm tra đầu tiên...',
    },
    resolve: {
      title: 'Hoàn tất sự cố',
      label: 'Kết quả xử lý',
      placeholder: 'Mô tả nguyên nhân và kết quả cuối cùng...',
    },
    escalate: {
      title: 'Chuyển cấp Admin',
      label: 'Lý do chuyển cấp',
      placeholder: 'Nêu rõ lý do và hỗ trợ cần thiết...',
    },
  }[operation];

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label="Đóng">
              <Xmark aria-hidden="true" className="size-5" />
            </Modal.CloseTrigger>
            <Modal.Header>
              <Modal.Icon>
                <Comment aria-hidden="true" className="size-5" />
              </Modal.Icon>
              <Modal.Heading>{content.title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <TextField
                fullWidth
                isRequired
                value={notes}
                onChange={onNotesChange}
              >
                <Label>{content.label}</Label>
                <TextArea
                  maxLength={1000}
                  placeholder={content.placeholder}
                  rows={5}
                />
                <FieldError />
              </TextField>
              <Typography className="mt-2 text-right text-xs text-muted">
                {notes.length}/1000
              </Typography>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="ghost">
                Hủy
              </Button>
              <Button
                isDisabled={!notes.trim() || saving}
                variant={operation === 'escalate' ? 'danger' : 'primary'}
                onPress={onSubmit}
              >
                {saving ? 'Đang lưu...' : 'Xác nhận'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export default function OperatorIncidentsPage() {
  const { incidentId } = useParams();

  return incidentId ? (
    <IncidentDetailPage id={incidentId} />
  ) : (
    <IncidentListPage />
  );
}
