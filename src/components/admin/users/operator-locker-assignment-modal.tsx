import type {
  Locker,
  LockerAssignmentSnapshot,
  OperatorUserView,
  UserManagementService,
} from '@/types/user-management';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  EmptyState,
  ListBox,
  Modal,
  SearchField,
  Spinner,
  Typography,
} from '@heroui/react';
import ArrowsRotateRight from '@gravity-ui/icons/ArrowsRotateRight';
import Magnifier from '@gravity-ui/icons/Magnifier';
import TriangleExclamation from '@gravity-ui/icons/TriangleExclamation';
import Xmark from '@gravity-ui/icons/Xmark';

type OperatorLockerAssignmentModalProps = {
  operatorId: string | null;
  service: UserManagementService;
  onClose: () => void;
  onSaved: () => void;
  onDataChanged?: () => void;
};

type AssignmentData = {
  operator: OperatorUserView;
  snapshot: LockerAssignmentSnapshot;
};

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
      className="min-h-16 w-full"
      id={locker.id}
      textValue={`${locker.code} ${locker.buildingName} ${locker.locationLabel}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <ListBox.ItemIndicator />
        <div className="min-w-0">
          <Typography className="font-semibold">{locker.code}</Typography>
          <Typography className="truncate text-muted">
            {locker.buildingName} — {locker.locationLabel}
          </Typography>
        </div>
      </div>
    </ListBox.Item>
  );
}

function EmptyListState({ search }: { search: string }) {
  return (
    <EmptyState className="py-8 text-center text-muted">
      {search.trim()
        ? 'Không tìm thấy tủ phù hợp.'
        : 'Hiện không có tủ trong nhóm này.'}
    </EmptyState>
  );
}

export function OperatorLockerAssignmentModal({
  operatorId,
  service,
  onClose,
  onSaved,
  onDataChanged,
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
  const savePendingRef = useRef(false);

  const loadAssignment = (failureMessage?: string) => {
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
        setErrorMessage(failureMessage ?? null);
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
    if (savePendingRef.current || isSaving) return;

    onClose();
  };

  const updateGroupSelection = (
    groupLockerIds: string[],
    keys: Iterable<string | number>,
  ) => {
    if (savePendingRef.current || isLoading) return;
    setSelectedLockerIds((current) => {
      const nextSelection = new Set(current);

      groupLockerIds.forEach((id) => nextSelection.delete(id));
      for (const key of keys) nextSelection.add(String(key));

      return nextSelection;
    });
  };

  const saveAssignment = () => {
    if (!operatorId || savePendingRef.current || isSaving || isLoading || !data)
      return;
    if (!hasChanges) {
      onClose();

      return;
    }

    savePendingRef.current = true;
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
          if (
            result.error.reloadRequired ||
            result.error.code === 'LOCKER_CONFLICT' ||
            result.error.code === 'LOCKER_NOT_FOUND'
          ) {
            onDataChanged?.();
            loadAssignment(result.error.message);
          }

          return;
        }

        onSaved();
      })
      .catch(() => {
        setErrorMessage('Không thể lưu phân công tủ. Vui lòng thử lại.');
      })
      .finally(() => {
        savePendingRef.current = false;
        setIsSaving(false);
      });
  };

  return (
    <Modal
      isOpen={operatorId !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) closeModal();
      }}
    >
      <Modal.Backdrop isDismissable={!isSaving}>
        <Modal.Container scroll="inside" size="lg">
          <Modal.Dialog>
            <Modal.Header>
              <div>
                <Modal.Heading>Phân công tủ</Modal.Heading>
                {data ? (
                  <Typography className="mt-1 text-muted">
                    {data.operator.fullName} · {data.operator.employeeCode}
                  </Typography>
                ) : null}
              </div>
              <Modal.CloseTrigger
                aria-label="Đóng phân công tủ"
                isDisabled={isSaving}
              />
            </Modal.Header>
            <Modal.Body>
              {isLoading ? (
                <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted">
                  <Spinner aria-label="Đang tải danh sách phân công tủ" />
                  Đang tải danh sách tủ...
                </div>
              ) : null}

              {!isLoading && errorMessage && !data ? (
                <Alert status="danger">
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
                      className="mt-4"
                      variant="outline"
                      onPress={() => loadAssignment()}
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
                    <Typography className="font-semibold">
                      Đã chọn {selectedLockerIds.size} tủ
                    </Typography>
                    {selectedLockerIds.size ? (
                      <Button
                        isDisabled={isSaving}
                        size="sm"
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
                    variant="secondary"
                    onChange={setSearch}
                  >
                    <SearchField.Group>
                      <SearchField.SearchIcon>
                        <Magnifier aria-hidden="true" className="size-4" />
                      </SearchField.SearchIcon>
                      <SearchField.Input placeholder="Tìm theo mã tủ, tòa nhà hoặc vị trí" />
                      {search ? (
                        <SearchField.ClearButton aria-label="Xóa tìm kiếm tủ">
                          <Xmark aria-hidden="true" className="size-4" />
                        </SearchField.ClearButton>
                      ) : null}
                    </SearchField.Group>
                  </SearchField>

                  {errorMessage ? (
                    <Alert status="danger">
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
                          <Typography className="mb-2 font-semibold">
                            Đang phân công cho nhân viên này
                          </Typography>
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
                          <Typography className="mb-2 font-semibold">
                            Có thể phân công
                          </Typography>
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
                          <Typography className="mb-2 font-semibold">
                            Đang được nhân viên khác quản lý
                          </Typography>
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
            <Modal.Footer>
              <Button
                isDisabled={isSaving}
                variant="ghost"
                onPress={closeModal}
              >
                Hủy
              </Button>
              <Button
                isDisabled={isLoading || !data || isSaving}
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
