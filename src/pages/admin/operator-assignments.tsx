import type {
  AssignmentAction,
  AssignmentFilter,
  LockerAssignmentRow,
} from '@/services/operator-assignment-service';

import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertDialog,
  Button,
  Card,
  FieldError,
  Label,
  ListBox,
  SearchField,
  Select,
  Skeleton,
  Table,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import ChevronDown from '@gravity-ui/icons/ChevronDown';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import CircleInfo from '@gravity-ui/icons/CircleInfo';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Xmark from '@gravity-ui/icons/Xmark';

import { LockerSupportModal } from '@/components/admin/support/locker-support-modal';
import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  ASSIGNMENT_REASON_MAX_LENGTH,
  assignLocker,
  filterAssignmentRows,
  getAssignableOperators,
  getAssignmentActions,
  getAssignmentErrorMessage,
  loadAssignmentBoard,
  replaceAssignment,
  revokeAssignment,
  validateAssignmentReason,
} from '@/services/operator-assignment-service';

const ACTION_TEXT: Record<
  AssignmentAction,
  { button: string; title: string; confirm: string; success: string }
> = {
  assign: {
    button: 'Phân công',
    title: 'Phân công Operator',
    confirm: 'Xác nhận phân công',
    success: 'Đã phân công Operator',
  },
  replace: {
    button: 'Thay thế',
    title: 'Thay Operator phụ trách',
    confirm: 'Xác nhận thay thế',
    success: 'Đã thay Operator phụ trách',
  },
  revoke: {
    button: 'Thu hồi',
    title: 'Thu hồi phân công',
    confirm: 'Xác nhận thu hồi',
    success: 'Đã thu hồi phân công',
  },
};

const FILTER_OPTIONS: ReadonlyArray<{
  value: AssignmentFilter;
  label: string;
}> = [
  { value: 'all', label: 'Tất cả tủ' },
  { value: 'assigned', label: 'Đã phân công' },
  { value: 'unassigned', label: 'Chưa phân công' },
];

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
        <CircleExclamation aria-hidden="true" className="size-5" />
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

export default function AdminOperatorAssignmentsPage() {
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<AssignmentFilter>('all');
  const [dialog, setDialog] = useState<{
    action: AssignmentAction;
    row: LockerAssignmentRow;
  } | null>(null);
  const [operatorId, setOperatorId] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [supportRow, setSupportRow] = useState<LockerAssignmentRow | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);
  const { state, reload, refresh } = useAsyncResource(
    loadAssignmentBoard,
    getAssignmentErrorMessage,
    [],
  );

  const board = state.data;
  const rows = useMemo(
    () => filterAssignmentRows(board?.rows ?? [], keyword, filter),
    [board, filter, keyword],
  );
  const assignable =
    dialog && board ? getAssignableOperators(board.operators, dialog.row) : [];
  const reasonError = validateAssignmentReason(reason);
  const operatorError =
    dialog?.action !== 'revoke' && !operatorId
      ? 'Vui lòng chọn Operator.'
      : undefined;

  const openDialog = (action: AssignmentAction, row: LockerAssignmentRow) => {
    setDialog({ action, row });
    setOperatorId('');
    setReason('');
    setSubmitted(false);
    setDialogError('');
  };

  const closeDialog = () => {
    if (!isSaving) setDialog(null);
  };

  const confirm = async () => {
    setSubmitted(true);
    if (!dialog || reasonError || operatorError || pending.current) return;

    const { action, row } = dialog;

    pending.current = true;
    setIsSaving(true);
    setDialogError('');

    try {
      if (action === 'assign')
        await assignLocker(operatorId, row.lockerId, reason);
      if (action === 'replace')
        await replaceAssignment(row, operatorId, reason);
      if (action === 'revoke' && row.operator && row.assignmentId) {
        await revokeAssignment(row.operator.id, row.assignmentId, reason);
      }

      toast.success(ACTION_TEXT[action].success, {
        description: `Tủ ${row.lockerCode}`,
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
      setDialog(null);
    } catch (error) {
      setDialogError(getAssignmentErrorMessage(error));
    } finally {
      pending.current = false;
      setIsSaving(false);
      // Server state is the source of truth, also after partial failures.
      refresh();
    }
  };

  const renderTable = () => {
    if (state.status === 'loading' && !board) {
      return (
        <div
          aria-busy="true"
          aria-label="Đang tải phân công"
          className="space-y-2 p-4"
        >
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      );
    }

    if (state.status === 'error' && !board) {
      return (
        <div className="p-4">
          <ErrorAlert message={state.message} onRetry={reload} />
        </div>
      );
    }

    if (!rows.length) {
      return (
        <div className="p-4">
          <Alert status="default">
            <Alert.Indicator>
              <CircleInfo aria-hidden="true" className="size-5" />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Không có tủ phù hợp</Alert.Title>
              <Alert.Description>
                Hãy thử đổi từ khóa hoặc bộ lọc.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        </div>
      );
    }

    return (
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Phân công Operator theo tủ">
            <Table.Header>
              <Table.Column isRowHeader id="locker">
                Mã tủ
              </Table.Column>
              <Table.Column id="address">Địa chỉ</Table.Column>
              <Table.Column id="operator">Operator phụ trách</Table.Column>
              <Table.Column id="since">Phân công từ</Table.Column>
              <Table.Column id="action">Thao tác</Table.Column>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row key={row.lockerId} id={row.lockerId}>
                  <Table.Cell>
                    <strong>{row.lockerCode}</strong>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="block max-w-80 text-wrap">
                      {row.lockerAddress}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {row.operator ? (
                      <span>
                        <span className="block font-medium">
                          {row.operator.fullName}
                        </span>
                        <span className="block text-xs text-muted">
                          {row.operator.email ?? ''}
                          {row.operator.isActive ? '' : ' · Tài khoản đã khóa'}
                        </span>
                      </span>
                    ) : (
                      <span className="text-warning">Chưa phân công</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {row.assignedAt
                      ? dateFormatter.format(new Date(row.assignedAt))
                      : '—'}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-1">
                      {getAssignmentActions(row).map((action) => (
                        <Button
                          key={action}
                          aria-label={`${ACTION_TEXT[action].button} tủ ${row.lockerCode}`}
                          size="sm"
                          variant={
                            action === 'revoke' ? 'danger-soft' : 'secondary'
                          }
                          onPress={() => openDialog(action, row)}
                        >
                          {ACTION_TEXT[action].button}
                        </Button>
                      ))}
                      <Button
                        aria-label={`Đầu mối hỗ trợ tủ ${row.lockerCode}`}
                        size="sm"
                        variant="tertiary"
                        onPress={() => setSupportRow(row)}
                      >
                        Hỗ trợ
                      </Button>
                    </div>
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
    <section className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchField
          fullWidth
          aria-label="Tìm theo mã tủ, địa chỉ hoặc Operator"
          className="lg:max-w-md"
          value={keyword}
          variant="secondary"
          onChange={setKeyword}
        >
          <SearchField.Group>
            <SearchField.SearchIcon>
              <Magnifier aria-hidden="true" className="size-4" />
            </SearchField.SearchIcon>
            <SearchField.Input placeholder="Mã tủ, địa chỉ hoặc tên Operator" />
            <SearchField.ClearButton aria-label="Xóa từ khóa">
              <Xmark aria-hidden="true" className="size-4" />
            </SearchField.ClearButton>
          </SearchField.Group>
        </SearchField>
        <Select
          aria-label="Lọc theo tình trạng phân công"
          className="w-full lg:w-56"
          value={filter}
          variant="secondary"
          onChange={(value) => setFilter(value as AssignmentFilter)}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator>
              <ChevronDown aria-hidden="true" className="size-4" />
            </Select.Indicator>
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {FILTER_OPTIONS.map((option) => (
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
          className="lg:ml-auto"
          isDisabled={state.status === 'loading'}
          variant="secondary"
          onPress={refresh}
        >
          <ArrowRotateRight aria-hidden="true" className="size-4" />
          Làm mới
        </Button>
      </div>

      {state.status === 'error' && board ? (
        <ErrorAlert message={state.message} />
      ) : null}

      <Card>
        <Card.Header className="flex-row items-center justify-between">
          <Card.Title>Phân công theo tủ</Card.Title>
          <span className="text-sm text-muted">
            Mỗi tủ chỉ có một Operator đang phụ trách.
          </span>
        </Card.Header>
        <Card.Content className="px-0 pb-0">{renderTable()}</Card.Content>
      </Card>

      <AlertDialog>
        <AlertDialog.Backdrop
          isDismissable={!isSaving}
          isOpen={dialog !== null}
          onOpenChange={(open) => !open && closeDialog()}
        >
          <AlertDialog.Container size="md">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon
                  status={dialog?.action === 'revoke' ? 'danger' : 'warning'}
                >
                  <CircleExclamation aria-hidden="true" className="size-6" />
                </AlertDialog.Icon>
                <AlertDialog.Heading>
                  {dialog
                    ? `${ACTION_TEXT[dialog.action].title} · ${dialog.row.lockerCode}`
                    : ''}
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="space-y-4">
                {dialog?.row.operator ? (
                  <p className="text-sm">
                    Đang phụ trách:{' '}
                    <strong>{dialog.row.operator.fullName}</strong>
                  </p>
                ) : null}
                {dialog?.action === 'replace' ? (
                  <p className="text-sm text-muted">
                    Hệ thống thu hồi Operator hiện tại rồi phân công Operator
                    mới.
                  </p>
                ) : null}

                {dialog && dialog.action !== 'revoke' ? (
                  <Select
                    isRequired
                    isDisabled={isSaving}
                    isInvalid={submitted && Boolean(operatorError)}
                    value={operatorId || null}
                    variant="secondary"
                    onChange={(value) => setOperatorId(String(value ?? ''))}
                  >
                    <Label>Operator</Label>
                    <Select.Trigger>
                      <Select.Value>
                        {({ defaultChildren, isPlaceholder }) =>
                          isPlaceholder
                            ? 'Chọn Operator đang hoạt động'
                            : defaultChildren
                        }
                      </Select.Value>
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {assignable.map((operator) => (
                          <ListBox.Item
                            key={operator.id}
                            id={operator.id}
                            textValue={operator.fullName}
                          >
                            {operator.fullName}
                            {operator.email ? ` · ${operator.email}` : ''}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                    <FieldError>{operatorError}</FieldError>
                  </Select>
                ) : null}

                <TextField
                  fullWidth
                  isRequired
                  isDisabled={isSaving}
                  isInvalid={submitted && Boolean(reasonError)}
                  maxLength={ASSIGNMENT_REASON_MAX_LENGTH}
                  value={reason}
                  onChange={setReason}
                >
                  <Label>Lý do</Label>
                  <TextArea rows={3} variant="secondary" />
                  <FieldError>{reasonError}</FieldError>
                </TextField>

                {dialogError ? <ErrorAlert message={dialogError} /> : null}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  isDisabled={isSaving}
                  variant="ghost"
                  onPress={closeDialog}
                >
                  Hủy
                </Button>
                <Button
                  isDisabled={isSaving}
                  variant={dialog?.action === 'revoke' ? 'danger' : 'primary'}
                  onPress={() => void confirm()}
                >
                  {isSaving
                    ? 'Đang xử lý...'
                    : dialog
                      ? ACTION_TEXT[dialog.action].confirm
                      : ''}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
      {supportRow ? (
        <LockerSupportModal
          key={supportRow.lockerId}
          lockerCode={supportRow.lockerCode}
          lockerId={supportRow.lockerId}
          operator={supportRow.operator}
          onClose={() => setSupportRow(null)}
        />
      ) : null}
    </section>
  );
}
