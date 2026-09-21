import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Chip,
  ListBox,
  Pagination,
  SearchField,
  Select,
  Separator,
  Table,
  toast,
} from '@heroui/react';
import ChevronDown from '@gravity-ui/icons/ChevronDown';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import ClockArrowRotateLeft from '@gravity-ui/icons/ClockArrowRotateLeft';
import FileArrowDown from '@gravity-ui/icons/FileArrowDown';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Person from '@gravity-ui/icons/Person';
import ShieldCheck from '@gravity-ui/icons/ShieldCheck';
import Xmark from '@gravity-ui/icons/Xmark';

import type { AuditLog } from './admin-data';
import { AUDIT_LOGS } from './admin-data';

const PAGE_SIZE = 8;

function ResultChip({ result }: { result: AuditLog['result'] }) {
  if (result === 'failed')
    return (
      <Chip color="danger" size="sm" variant="soft">
        Thất bại
      </Chip>
    );
  if (result === 'warning')
    return (
      <Chip color="warning" size="sm" variant="soft">
        Cảnh báo
      </Chip>
    );
  return (
    <Chip color="success" size="sm" variant="soft">
      Thành công
    </Chip>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default function AdminAuditLogsPage() {
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState('all');
  const [module, setModule] = useState('all');
  const [result, setResult] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(AUDIT_LOGS[0].id);

  const filtered = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase('vi');
    return AUDIT_LOGS.filter(
      (log) =>
        (!query ||
          [log.id, log.actor, log.action, log.target, log.ip].some((value) =>
            value.toLocaleLowerCase('vi').includes(query),
          )) &&
        (role === 'all' || log.role === role) &&
        (module === 'all' || log.module === module) &&
        (result === 'all' || log.result === result),
    );
  }, [keyword, module, result, role]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleLogs = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedLog =
    AUDIT_LOGS.find((log) => log.id === selectedId) ??
    visibleLogs[0] ??
    AUDIT_LOGS[0];
  const resetFilters = () => {
    setKeyword('');
    setRole('all');
    setModule('all');
    setResult('all');
    setPage(1);
  };

  return (
    <section className="flex w-full flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Tổng log hôm nay',
            value: '248',
            meta: '12% so với hôm qua',
            icon: ClockArrowRotateLeft,
            tone: 'bg-accent/10 text-accent',
          },
          {
            label: 'Sự kiện bảo mật',
            value: '12',
            meta: '3 sự kiện cần chú ý',
            icon: ShieldCheck,
            tone: 'bg-danger/10 text-danger',
          },
          {
            label: 'Thao tác Admin',
            value: '86',
            meta: '8% so với hôm qua',
            icon: Person,
            tone: 'bg-success/10 text-success',
          },
          {
            label: 'Thất bại / cảnh báo',
            value: '9',
            meta: '2 mới phát sinh',
            icon: CircleExclamation,
            tone: 'bg-warning/10 text-warning',
          },
        ].map((item) => (
          <Card key={item.label}>
            <Card.Content className="flex items-center gap-4 py-5">
              <span
                className={`flex size-12 items-center justify-center rounded-full ${item.tone}`}
              >
                <item.icon className="size-6" />
              </span>
              <span>
                <span className="block text-sm text-muted">{item.label}</span>
                <strong className="block text-2xl">{item.value}</strong>
                <span className="text-xs text-muted">{item.meta}</span>
              </span>
            </Card.Content>
          </Card>
        ))}
      </div>

      <Card>
        <Card.Header className="flex-row items-center justify-between">
          <Card.Title>Bộ lọc</Card.Title>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onPress={resetFilters}>
              Đặt lại
            </Button>
            <Button
              size="sm"
              variant="outline"
              onPress={() => toast.success('Đã xuất audit log')}
            >
              <FileArrowDown className="size-4" />
              Xuất CSV
            </Button>
          </div>
        </Card.Header>
        <Card.Content className="grid gap-3 pb-6 md:grid-cols-2 xl:grid-cols-[minmax(18rem,2fr)_repeat(3,minmax(10rem,1fr))]">
          <SearchField
            fullWidth
            aria-label="Tìm audit log"
            value={keyword}
            variant="secondary"
            onChange={(value) => {
              setKeyword(value);
              setPage(1);
            }}
          >
            <SearchField.Group>
              <SearchField.SearchIcon>
                <Magnifier className="size-4" />
              </SearchField.SearchIcon>
              <SearchField.Input placeholder="Audit ID, người dùng, locker..." />
              <SearchField.ClearButton aria-label="Xóa tìm kiếm">
                <Xmark className="size-4" />
              </SearchField.ClearButton>
            </SearchField.Group>
          </SearchField>
          <Select
            aria-label="Vai trò"
            value={role}
            variant="secondary"
            onChange={(value) => {
              setRole(String(value));
              setPage(1);
            }}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator>
                <ChevronDown className="size-4" />
              </Select.Indicator>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="all">Tất cả vai trò</ListBox.Item>
                <ListBox.Item id="Admin">Admin</ListBox.Item>
                <ListBox.Item id="Operator">Operator</ListBox.Item>
                <ListBox.Item id="System">System</ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
          <Select
            aria-label="Module"
            value={module}
            variant="secondary"
            onChange={(value) => {
              setModule(String(value));
              setPage(1);
            }}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator>
                <ChevronDown className="size-4" />
              </Select.Indicator>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="all">Tất cả module</ListBox.Item>
                {['Locker', 'User', 'Security', 'Policy', 'Payment'].map(
                  (value) => (
                    <ListBox.Item key={value} id={value}>
                      {value}
                    </ListBox.Item>
                  ),
                )}
              </ListBox>
            </Select.Popover>
          </Select>
          <Select
            aria-label="Kết quả"
            value={result}
            variant="secondary"
            onChange={(value) => {
              setResult(String(value));
              setPage(1);
            }}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator>
                <ChevronDown className="size-4" />
              </Select.Indicator>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="all">Tất cả kết quả</ListBox.Item>
                <ListBox.Item id="success">Thành công</ListBox.Item>
                <ListBox.Item id="warning">Cảnh báo</ListBox.Item>
                <ListBox.Item id="failed">Thất bại</ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </Card.Content>
      </Card>

      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_23rem]">
        <Card className="min-w-0">
          <Card.Header className="flex-row items-center justify-between">
            <Card.Title>Danh sách audit log</Card.Title>
            <span className="text-sm text-muted">{filtered.length} log</span>
          </Card.Header>
          <Card.Content className="px-0 pb-0">
            <Table>
              <Table.ScrollContainer>
                <Table.Content
                  aria-label="Danh sách audit log"
                  onRowAction={(key) => setSelectedId(String(key))}
                >
                  <Table.Header>
                    <Table.Column id="time" isRowHeader>
                      Thời gian
                    </Table.Column>
                    <Table.Column id="id">Audit ID</Table.Column>
                    <Table.Column id="actor">Người thực hiện</Table.Column>
                    <Table.Column id="role">Vai trò</Table.Column>
                    <Table.Column id="module">Module</Table.Column>
                    <Table.Column id="action">Hành động</Table.Column>
                    <Table.Column id="target">Đối tượng</Table.Column>
                    <Table.Column id="result">Kết quả</Table.Column>
                    <Table.Column id="details">Chi tiết</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {visibleLogs.map((log) => (
                      <Table.Row key={log.id} id={log.id}>
                        <Table.Cell>{log.time}</Table.Cell>
                        <Table.Cell>
                          <span className="font-mono text-xs text-accent">
                            {log.id}
                          </span>
                        </Table.Cell>
                        <Table.Cell>{log.actor}</Table.Cell>
                        <Table.Cell>{log.role}</Table.Cell>
                        <Table.Cell>{log.module}</Table.Cell>
                        <Table.Cell>
                          <span className="block max-w-52 text-wrap">
                            {log.action}
                          </span>
                        </Table.Cell>
                        <Table.Cell>{log.target}</Table.Cell>
                        <Table.Cell>
                          <ResultChip result={log.result} />
                        </Table.Cell>
                        <Table.Cell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onPress={() => setSelectedId(log.id)}
                          >
                            Xem
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
              <Table.Footer className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted">
                  Hiển thị {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, filtered.length)}
                </span>
                <Pagination size="sm">
                  <Pagination.Content>
                    <Pagination.Item>
                      <Pagination.Previous
                        isDisabled={page === 1}
                        onPress={() => setPage(page - 1)}
                      >
                        <Pagination.PreviousIcon />
                      </Pagination.Previous>
                    </Pagination.Item>
                    <Pagination.Item>
                      <Pagination.Link isActive>
                        {page}/{totalPages}
                      </Pagination.Link>
                    </Pagination.Item>
                    <Pagination.Item>
                      <Pagination.Next
                        isDisabled={page === totalPages}
                        onPress={() => setPage(page + 1)}
                      >
                        <Pagination.NextIcon />
                      </Pagination.Next>
                    </Pagination.Item>
                  </Pagination.Content>
                </Pagination>
              </Table.Footer>
            </Table>
          </Card.Content>
        </Card>

        <div className="space-y-5">
          <Card>
            <Card.Header>
              <Card.Title>Chi tiết log</Card.Title>
            </Card.Header>
            <Card.Content className="pb-6">
              <dl>
                <DetailRow label="Audit ID">{selectedLog.id}</DetailRow>
                <DetailRow label="Thời gian">{selectedLog.time}</DetailRow>
                <DetailRow label="Người thực hiện">
                  {selectedLog.actor}
                </DetailRow>
                <DetailRow label="Vai trò">{selectedLog.role}</DetailRow>
                <DetailRow label="Module">{selectedLog.module}</DetailRow>
                <DetailRow label="Hành động">{selectedLog.action}</DetailRow>
                <DetailRow label="Đối tượng">{selectedLog.target}</DetailRow>
                <DetailRow label="Kết quả">
                  <ResultChip result={selectedLog.result} />
                </DetailRow>
                <DetailRow label="IP">{selectedLog.ip}</DetailRow>
                <DetailRow label="Thiết bị">{selectedLog.device}</DetailRow>
                <DetailRow label="Lý do">{selectedLog.reason}</DetailRow>
              </dl>
              {selectedLog.before || selectedLog.after ? (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-3 text-sm">
                    {selectedLog.before ? (
                      <div className="rounded-lg bg-default p-3">
                        <span className="mb-1 block text-xs text-muted">
                          Trước thay đổi
                        </span>
                        {selectedLog.before}
                      </div>
                    ) : null}
                    {selectedLog.after ? (
                      <div className="rounded-lg bg-accent/10 p-3">
                        <span className="mb-1 block text-xs text-muted">
                          Sau thay đổi
                        </span>
                        {selectedLog.after}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </Card.Content>
          </Card>
          <Card>
            <Card.Header>
              <Card.Title>Phân loại log</Card.Title>
            </Card.Header>
            <Card.Content className="flex items-center justify-center gap-6 pb-6">
              <div
                className="flex size-28 items-center justify-center rounded-full"
                style={{
                  background:
                    'conic-gradient(var(--color-accent) 0 25%, var(--color-success) 25% 44%, var(--color-warning) 44% 60%, var(--color-danger) 60% 68%, var(--color-muted) 68% 100%)',
                }}
              >
                <span className="flex size-16 flex-col items-center justify-center rounded-full bg-background">
                  <strong>248</strong>
                  <span className="text-xs text-muted">Tổng</span>
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-accent">●</span> Locker 62
                </p>
                <p>
                  <span className="text-success">●</span> User 48
                </p>
                <p>
                  <span className="text-warning">●</span> Policy 36
                </p>
                <p>
                  <span className="text-danger">●</span> Security 20
                </p>
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>
    </section>
  );
}
