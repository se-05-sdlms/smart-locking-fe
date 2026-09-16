import type {
  Locker,
  LockerAssignmentSnapshot,
  OperatorUserView,
  UserManagementService,
} from '@/types/user-management';
import type { CSSProperties } from 'react';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  ListBox,
  Modal,
  SearchField,
  Spinner,
} from '@heroui/react';
import ArrowsRotateRight from '@gravity-ui/icons/ArrowsRotateRight';
import Magnifier from '@gravity-ui/icons/Magnifier';
import TriangleExclamation from '@gravity-ui/icons/TriangleExclamation';

type OperatorLockerAssignmentModalProps = {
  operatorId: string | null;
  service: UserManagementService;
  onClose: () => void;
  onSaved: () => void;
};

type AssignmentData = {
  operator: OperatorUserView;
  snapshot: LockerAssignmentSnapshot;
};

const neutralButtonStyle = {
  '--button-bg': '#f2f2f7',
  '--button-bg-hover': '#e5e5ea',
  '--button-bg-pressed': '#d9d9df',
  '--button-fg': 'var(--um-ink)',
} as CSSProperties;

const primarySaveButtonStyle = {
  '--button-bg': 'var(--um-primary)',
  '--button-bg-hover': '#005bb5',
  '--button-bg-pressed': '#004a99',
  '--button-fg': 'var(--um-on-primary)',
} as CSSProperties;

const closeTriggerClassName =
  'bg-[#F2F2F7] text-[#1D1D1F] shadow-none hover:bg-[#E5E5EA] focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2';

function filterLockers(lockers: Locker[], search: string) {
  const normalizedSearch = search.trim().toLocaleLowerCase('vi-VN');

  if (!normalizedSearch) return lockers;

  return lockers.filter((locker) =>
    [locker.code, locker.buildingName, locker.locationLabel].some((value) =>
      value.toLocaleLowerCase('vi-VN').includes(normalizedSearch),
    ),
  );
}

function LockerItem({ locker }: { locker: Locker }) {
  return (
    <ListBox.Item
      className="min-h-16 w-full rounded-lg border border-[var(--um-border)] bg-[var(--um-surface)] px-3 py-2 text-left text-sm text-[var(--um-ink)] shadow-none transition-colors data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-[var(--um-focus)] data-[focus-visible=true]:ring-offset-2 data-[selected=true]:border-[var(--um-primary)] data-[selected=true]:bg-[var(--um-primary-soft)] data-[disabled=true]:cursor-not-allowed data-[disabled=true]:bg-neutral-100 data-[disabled=true]:text-neutral-500"
      id={locker.id}
      textValue={`${locker.code} ${locker.buildingName} ${locker.locationLabel}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <ListBox.ItemIndicator />
        <div className="min-w-0">
          <p className="font-semibold">{locker.code}</p>
          <p className="truncate text-sm text-neutral-600">
            {locker.buildingName} — {locker.locationLabel}
          </p>
        </div>
      </div>
    </ListBox.Item>
  );
}

function EmptyListState({ search }: { search: string }) {
  return (
    <p className="py-8 text-center text-sm text-neutral-600">
      {search.trim()
        ? 'Không tìm thấy tủ phù hợp.'
        : 'Hiện không có tủ trong nhóm này.'}
    </p>
  );
}

export function OperatorLockerAssignmentModal({
  operatorId,
  service,
  onClose,
  onSaved,
}: OperatorLockerAssignmentModalProps) {
  const [data, setData] = useState<AssignmentData | null>(null);
  const [selectedLockerIds, setSelectedLockerIds] = useState<Set<string>>(
    new Set(),
  );
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadAssignment = () => {
    if (!operatorId) return;

    const requestId = requestIdRef.current + 1;
    let isActive = true;

    requestIdRef.current = requestId;
    setIsLoading(true);
    setErrorMessage(null);
    setData(null);
    setSearch('');

    void Promise.all([
      service.getUserById(operatorId),
      service.getLockerAssignment(operatorId),
    ])
      .then(([userResult, assignmentResult]) => {
        if (!isActive || requestId !== requestIdRef.current) return;
        if (!userResult.success) throw new Error(userResult.error.message);
        if (userResult.data.role !== 'LOCKER_OPERATOR') {
          throw new Error('Không thể phân công tủ cho tài khoản này.');
        }
        if (!assignmentResult.success)
          throw new Error(assignmentResult.error.message);

        setData({
          operator: userResult.data,
          snapshot: assignmentResult.data,
        });
        setSelectedLockerIds(
          new Set(assignmentResult.data.assigned.map((locker) => locker.id)),
        );
      })
      .catch((error: unknown) => {
        if (!isActive || requestId !== requestIdRef.current) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Không thể tải danh sách phân công tủ.',
        );
      })
      .finally(() => {
        if (isActive && requestId === requestIdRef.current) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  };

  useEffect(() => {
    if (!operatorId) {
      setData(null);
      setSelectedLockerIds(new Set());
      setSearch('');
      setErrorMessage(null);
      setIsLoading(false);

      return;
    }

    return loadAssignment();
  }, [operatorId, service]);

  const filteredGroups = useMemo(
    () => ({
      assigned: filterLockers(data?.snapshot.assigned ?? [], search),
      available: filterLockers(data?.snapshot.available ?? [], search),
      assignedToOtherOperators: filterLockers(
        data?.snapshot.assignedToOtherOperators ?? [],
        search,
      ),
    }),
    [data, search],
  );
  const originalLockerIds = useMemo(
    () => new Set(data?.snapshot.assigned.map((locker) => locker.id) ?? []),
    [data],
  );
  const disabledLockerIds = useMemo(
    () =>
      new Set(
        data?.snapshot.assignedToOtherOperators.map((locker) => locker.id) ??
          [],
      ),
    [data],
  );
  const hasChanges =
    selectedLockerIds.size !== originalLockerIds.size ||
    [...selectedLockerIds].some((id) => !originalLockerIds.has(id));
  const isEmpty =
    data !== null &&
    data.snapshot.assigned.length === 0 &&
    data.snapshot.available.length === 0 &&
    data.snapshot.assignedToOtherOperators.length === 0;
  const hasNoSearchResults =
    data !== null &&
    !isEmpty &&
    search.trim().length > 0 &&
    filteredGroups.assigned.length === 0 &&
    filteredGroups.available.length === 0 &&
    filteredGroups.assignedToOtherOperators.length === 0;

  const closeModal = () => {
    if (isSaving) return;

    onClose();
  };

  const updateGroupSelection = (
    groupLockerIds: string[],
    keys: Iterable<string | number>,
  ) => {
    setSelectedLockerIds((current) => {
      const nextSelection = new Set(current);

      groupLockerIds.forEach((id) => nextSelection.delete(id));
      for (const key of keys) nextSelection.add(String(key));

      return nextSelection;
    });
  };

  const saveAssignment = () => {
    if (!operatorId || isSaving || !data) return;
    if (!hasChanges) {
      onClose();

      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    void service
      .updateLockerAssignments({
        operatorId,
        lockerIds: [...selectedLockerIds],
      })
      .then((result) => {
        if (!result.success) {
          setErrorMessage(result.error.message);

          return;
        }

        onSaved();
      })
      .catch(() => {
        setErrorMessage('Không thể lưu phân công tủ. Vui lòng thử lại.');
      })
      .finally(() => setIsSaving(false));
  };

  return (
    <Modal
      isOpen={operatorId !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) closeModal();
      }}
    >
      <Modal.Backdrop isDismissable={!isSaving}>
        <Modal.Container className="p-4" scroll="inside" size="lg">
          <Modal.Dialog className="max-h-[calc(100dvh-32px)] p-0 shadow-none">
            <Modal.Header className="shrink-0 border-b border-[var(--um-border)] bg-[var(--um-surface)] px-5 py-4">
              <div>
                <Modal.Heading>Phân công tủ</Modal.Heading>
                {data ? (
                  <p className="mt-1 text-sm text-neutral-600">
                    {data.operator.fullName} · {data.operator.employeeCode}
                  </p>
                ) : null}
              </div>
              <Modal.CloseTrigger
                aria-label="Đóng phân công tủ"
                className={closeTriggerClassName}
                isDisabled={isSaving}
              />
            </Modal.Header>
            <Modal.Body className="m-0 flex-1 overflow-y-auto px-5 py-5">
              {isLoading ? (
                <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-neutral-600">
                  <Spinner aria-label="Đang tải danh sách phân công tủ" />
                  Đang tải danh sách tủ...
                </div>
              ) : null}

              {!isLoading && errorMessage && !data ? (
                <Alert
                  className="border border-red-200 shadow-none"
                  status="danger"
                >
                  <Alert.Indicator>
                    <TriangleExclamation
                      aria-hidden="true"
                      className="size-5"
                    />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>
                      Không thể tải danh sách phân công tủ
                    </Alert.Title>
                    <Alert.Description>{errorMessage}</Alert.Description>
                    <Button
                      className="mt-4 min-h-11"
                      variant="outline"
                      onPress={loadAssignment}
                    >
                      <ArrowsRotateRight
                        aria-hidden="true"
                        className="size-4"
                      />
                      Thử lại
                    </Button>
                  </Alert.Content>
                </Alert>
              ) : null}

              {!isLoading && data ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--um-ink)]">
                      Đã chọn {selectedLockerIds.size} tủ
                    </p>
                    {selectedLockerIds.size ? (
                      <Button
                        className="min-h-11 px-3 text-[var(--um-primary)] shadow-none"
                        isDisabled={isSaving}
                        variant="tertiary"
                        onPress={() => setSelectedLockerIds(new Set())}
                      >
                        Bỏ chọn tất cả
                      </Button>
                    ) : null}
                  </div>

                  <SearchField
                    aria-label="Tìm kiếm tủ"
                    value={search}
                    onChange={setSearch}
                  >
                    <SearchField.Group className="min-h-11 rounded-lg border border-[var(--um-border)] bg-[var(--um-surface)] shadow-none [--field-background:var(--um-surface)] [--field-border-focus:var(--um-focus)] [--field-border-hover:var(--um-border)] [--field-border:var(--um-border)] [--field-focus:var(--um-surface)] [--field-hover:var(--um-surface)]">
                      <Magnifier
                        aria-hidden="true"
                        className="ml-3 size-5 text-neutral-500"
                      />
                      <SearchField.Input placeholder="Tìm theo mã tủ, tòa nhà hoặc vị trí" />
                      {search ? (
                        <SearchField.ClearButton aria-label="Xóa tìm kiếm tủ" />
                      ) : null}
                    </SearchField.Group>
                  </SearchField>

                  {errorMessage ? (
                    <Alert
                      className="border border-red-200 shadow-none"
                      status="danger"
                    >
                      <Alert.Indicator>
                        <TriangleExclamation
                          aria-hidden="true"
                          className="size-5"
                        />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Description>{errorMessage}</Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : null}

                  {isEmpty ? <EmptyListState search="" /> : null}
                  {hasNoSearchResults ? (
                    <EmptyListState search={search} />
                  ) : null}

                  {!isEmpty && !hasNoSearchResults ? (
                    <div className="max-h-[min(48dvh,34rem)] space-y-5 overflow-y-auto pr-1">
                      {filteredGroups.assigned.length ? (
                        <section>
                          <h3 className="mb-2 text-sm font-semibold text-[var(--um-ink)]">
                            Đang phân công cho nhân viên này
                          </h3>
                          <ListBox
                            aria-label="Tủ đang phân công cho nhân viên này"
                            className="space-y-2"
                            selectedKeys={
                              new Set(
                                filteredGroups.assigned
                                  .filter((locker) =>
                                    selectedLockerIds.has(locker.id),
                                  )
                                  .map((locker) => locker.id),
                              )
                            }
                            selectionBehavior="toggle"
                            selectionMode="multiple"
                            onSelectionChange={(keys) => {
                              if (keys === 'all') return;
                              updateGroupSelection(
                                filteredGroups.assigned.map(
                                  (locker) => locker.id,
                                ),
                                keys,
                              );
                            }}
                          >
                            {filteredGroups.assigned.map((locker) => (
                              <LockerItem key={locker.id} locker={locker} />
                            ))}
                          </ListBox>
                        </section>
                      ) : null}
                      {filteredGroups.available.length ? (
                        <section>
                          <h3 className="mb-2 text-sm font-semibold text-[var(--um-ink)]">
                            Có thể phân công
                          </h3>
                          <ListBox
                            aria-label="Tủ có thể phân công"
                            className="space-y-2"
                            selectedKeys={
                              new Set(
                                filteredGroups.available
                                  .filter((locker) =>
                                    selectedLockerIds.has(locker.id),
                                  )
                                  .map((locker) => locker.id),
                              )
                            }
                            selectionBehavior="toggle"
                            selectionMode="multiple"
                            onSelectionChange={(keys) => {
                              if (keys === 'all') return;
                              updateGroupSelection(
                                filteredGroups.available.map(
                                  (locker) => locker.id,
                                ),
                                keys,
                              );
                            }}
                          >
                            {filteredGroups.available.map((locker) => (
                              <LockerItem key={locker.id} locker={locker} />
                            ))}
                          </ListBox>
                        </section>
                      ) : null}
                      {filteredGroups.assignedToOtherOperators.length ? (
                        <section>
                          <h3 className="mb-2 text-sm font-semibold text-[var(--um-ink)]">
                            Đang được nhân viên khác quản lý
                          </h3>
                          <ListBox
                            aria-label="Tủ đang được nhân viên khác quản lý"
                            className="space-y-2"
                            disabledKeys={disabledLockerIds}
                            selectedKeys={new Set()}
                            selectionMode="multiple"
                          >
                            {filteredGroups.assignedToOtherOperators.map(
                              (locker) => (
                                <LockerItem key={locker.id} locker={locker} />
                              ),
                            )}
                          </ListBox>
                        </section>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Modal.Body>
            <Modal.Footer className="shrink-0 border-t border-[var(--um-border)] bg-[var(--um-surface)] px-5 py-3">
              <Button
                className="min-h-11 rounded-full border-0 px-5 text-[var(--um-ink)] shadow-none focus-visible:ring-2 focus-visible:ring-[var(--um-focus)] focus-visible:ring-offset-2"
                isDisabled={isSaving}
                style={neutralButtonStyle}
                variant="primary"
                onPress={closeModal}
              >
                Hủy
              </Button>
              <Button
                className="min-h-11 rounded-full px-6 font-semibold shadow-none focus-visible:ring-2 focus-visible:ring-[var(--um-focus)] focus-visible:ring-offset-2"
                isDisabled={isLoading || !data || isSaving}
                style={primarySaveButtonStyle}
                variant="primary"
                onPress={saveAssignment}
              >
                {isSaving ? (
                  <Spinner
                    aria-label="Đang lưu phân công tủ"
                    color="current"
                    size="sm"
                  />
                ) : null}
                {isSaving ? 'Đang lưu...' : 'Lưu phân công'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
