import type { IncidentListItem, IncidentStatusFilter } from '@/types/incident';

import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  ListBox,
  SearchField,
  Select,
  Skeleton,
  Table,
} from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import ChevronDown from '@gravity-ui/icons/ChevronDown';
import ChevronRight from '@gravity-ui/icons/ChevronRight';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import CircleInfo from '@gravity-ui/icons/CircleInfo';
import Funnel from '@gravity-ui/icons/Funnel';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Xmark from '@gravity-ui/icons/Xmark';

import {
  formatIncidentDateTime,
  IncidentDetailDrawer,
  IncidentStatusChip,
} from './incident-detail-drawer';

import {
  INCIDENT_SOURCE_LABELS,
  INCIDENT_STATUS_FILTER_OPTIONS,
} from '@/constants/incident';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { useOperationsRealtime } from '@/hooks/use-operations-realtime';
import {
  formatIncidentType,
  getIncidentLoadErrorMessage,
  listOperatorIncidents,
} from '@/services/incident-service';

function matchesKeyword(incident: IncidentListItem, keyword: string) {
  const needle = keyword.trim().toLocaleLowerCase('vi');

  if (!needle) return true;

  return [incident.title, incident.lockerCode, incident.lockerAddress]
    .filter(Boolean)
    .some((value) => value.toLocaleLowerCase('vi').includes(needle));
}

export default function OperatorIncidentsPage() {
  const [statusFilter, setStatusFilter] = useState<IncidentStatusFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const load = useCallback(
    (signal: AbortSignal) => listOperatorIncidents(statusFilter, signal),
    [statusFilter],
  );
  const { state, reload, refresh } = useAsyncResource(
    load,
    getIncidentLoadErrorMessage,
    [statusFilter],
  );
  const incidents = useMemo(() => state.data ?? [], [state.data]);
  const visibleIncidents = useMemo(
    () => incidents.filter((incident) => matchesKeyword(incident, keyword)),
    [incidents, keyword],
  );

  // Backend publishes operationUpdated for incidents to the locker groups.
  useOperationsRealtime(
    [...new Set(incidents.map((incident) => incident.lockerId))],
    refresh,
  );

  const openIncident = (incident: IncidentListItem) => {
    setSelectedId(incident.id);
    setIsDrawerOpen(true);
  };

  const renderContent = () => {
    if (state.status === 'loading' && !state.data) {
      return (
        <div
          aria-busy="true"
          aria-label="Đang tải danh sách sự cố"
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      );
    }

    if (state.status === 'error' && !state.data) {
      return (
        <Alert role="alert" status="danger">
          <Alert.Indicator>
            <CircleExclamation aria-hidden="true" className="size-5" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Description>{state.message}</Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="secondary" onPress={reload}>
            <ArrowRotateRight aria-hidden="true" className="size-4" />
            Thử lại
          </Button>
        </Alert>
      );
    }

    if (!visibleIncidents.length) {
      return (
        <Alert status="default">
          <Alert.Indicator>
            <CircleInfo aria-hidden="true" className="size-5" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>
              {incidents.length
                ? 'Không tìm thấy sự cố phù hợp'
                : 'Không có sự cố'}
            </Alert.Title>
            <Alert.Description>
              {incidents.length
                ? 'Hãy thử đổi từ khóa tìm kiếm.'
                : 'Chưa có sự cố nào ở trạng thái đã chọn trong các tủ bạn phụ trách.'}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      );
    }

    return (
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Danh sách sự cố">
            <Table.Header>
              <Table.Column isRowHeader id="title">
                Sự cố
              </Table.Column>
              <Table.Column id="type">Loại</Table.Column>
              <Table.Column id="locker">Tủ</Table.Column>
              <Table.Column id="source">Nguồn</Table.Column>
              <Table.Column id="status">Trạng thái</Table.Column>
              <Table.Column id="updated">Cập nhật</Table.Column>
              <Table.Column id="action">Thao tác</Table.Column>
            </Table.Header>
            <Table.Body>
              {visibleIncidents.map((incident) => (
                <Table.Row key={incident.id} id={incident.id}>
                  <Table.Cell>
                    <span className="block max-w-72 text-wrap font-semibold">
                      {incident.title}
                    </span>
                  </Table.Cell>
                  <Table.Cell>{formatIncidentType(incident.type)}</Table.Cell>
                  <Table.Cell>{incident.lockerCode}</Table.Cell>
                  <Table.Cell>
                    {INCIDENT_SOURCE_LABELS[incident.source]}
                  </Table.Cell>
                  <Table.Cell>
                    <IncidentStatusChip status={incident.status} />
                  </Table.Cell>
                  <Table.Cell>
                    {formatIncidentDateTime(incident.updatedAt)}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      aria-label={`Xem sự cố ${incident.title}`}
                      size="sm"
                      variant="ghost"
                      onPress={() => openIncident(incident)}
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
    );
  };

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          fullWidth
          aria-label="Tìm theo tiêu đề hoặc mã tủ"
          className="sm:max-w-md"
          value={keyword}
          variant="secondary"
          onChange={setKeyword}
        >
          <SearchField.Group>
            <SearchField.SearchIcon>
              <Magnifier aria-hidden="true" className="size-4" />
            </SearchField.SearchIcon>
            <SearchField.Input placeholder="Tìm theo tiêu đề hoặc mã tủ..." />
            <SearchField.ClearButton aria-label="Xóa từ khóa">
              <Xmark aria-hidden="true" className="size-4" />
            </SearchField.ClearButton>
          </SearchField.Group>
        </SearchField>

        <Select
          aria-label="Lọc theo trạng thái"
          className="w-full sm:w-56"
          value={statusFilter}
          variant="secondary"
          onChange={(value) => setStatusFilter(value as IncidentStatusFilter)}
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
              {INCIDENT_STATUS_FILTER_OPTIONS.map((option) => (
                <ListBox.Item
                  key={option.value}
                  id={option.value}
                  textValue={option.label}
                >
                  {option.label}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Button
          className="sm:ml-auto"
          isDisabled={state.status === 'loading'}
          variant="secondary"
          onPress={refresh}
        >
          <ArrowRotateRight aria-hidden="true" className="size-4" />
          Làm mới
        </Button>
      </div>

      {renderContent()}

      {selectedId ? (
        <IncidentDetailDrawer
          // A fresh drawer (forms and errors) for every incident.
          key={selectedId}
          incidentId={selectedId}
          isOpen={isDrawerOpen}
          onChanged={refresh}
          onOpenChange={setIsDrawerOpen}
        />
      ) : null}
    </section>
  );
}
