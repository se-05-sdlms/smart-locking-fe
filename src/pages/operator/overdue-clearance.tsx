import type { ReactNode } from 'react';

import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Chip,
  FieldError,
  Label,
  ListBox,
  Modal,
  SearchField,
  Select,
  Separator,
  Table,
  TextArea,
  TextField,
  Typography,
  toast,
  useOverlayState,
} from '@heroui/react';
import Box from '@gravity-ui/icons/Box';
import ChevronDown from '@gravity-ui/icons/ChevronDown';
import ChevronRight from '@gravity-ui/icons/ChevronRight';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleInfo from '@gravity-ui/icons/CircleInfo';
import Clock from '@gravity-ui/icons/Clock';
import File from '@gravity-ui/icons/File';
import Funnel from '@gravity-ui/icons/Funnel';
import LocationArrow from '@gravity-ui/icons/LocationArrow';
import LockOpen from '@gravity-ui/icons/LockOpen';
import Magnifier from '@gravity-ui/icons/Magnifier';
import Person from '@gravity-ui/icons/Person';
import ShieldCheck from '@gravity-ui/icons/ShieldCheck';
import TriangleExclamation from '@gravity-ui/icons/TriangleExclamation';
import Xmark from '@gravity-ui/icons/Xmark';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

type OverdueLevel = 'under-three-days' | 'three-days-or-more';

type OverdueParcel = {
  id: string;
  lockerId: string;
  lockerName: string;
  compartmentId: string;
  storedAt: string;
  overdueDuration: string;
  level: OverdueLevel;
  residentName: string;
  residentPhone: string;
  storageAddress: string;
};

const OVERDUE_PARCELS: OverdueParcel[] = [
  {
    id: 'P123456',
    lockerId: 'LK-01',
    lockerName: 'Tủ Nguyễn Huệ',
    compartmentId: 'N06',
    storedAt: '06/09/2026 10:30',
    overdueDuration: '2 ngày 7 giờ',
    level: 'under-three-days',
    residentName: 'Nguyễn Minh Anh',
    residentPhone: '090 *** 2456',
    storageAddress: 'Tầng 1, khu lễ tân, cạnh phòng bảo vệ',
  },
  {
    id: 'P123457',
    lockerId: 'LK-01',
    lockerName: 'Tủ Nguyễn Huệ',
    compartmentId: 'N12',
    storedAt: '05/09/2026 08:15',
    overdueDuration: '3 ngày 9 giờ',
    level: 'three-days-or-more',
    residentName: 'Trần Hoàng Long',
    residentPhone: '093 *** 8712',
    storageAddress: 'Tầng 1, khu lễ tân, cạnh phòng bảo vệ',
  },
  {
    id: 'P123458',
    lockerId: 'LK-02',
    lockerName: 'Tủ Lê Lợi',
    compartmentId: 'N03',
    storedAt: '07/09/2026 14:20',
    overdueDuration: '1 ngày 3 giờ',
    level: 'under-three-days',
    residentName: 'Lê Khánh Linh',
    residentPhone: '098 *** 1038',
    storageAddress: 'Quầy hỗ trợ tầng trệt, cạnh sảnh chính',
  },
  {
    id: 'P123459',
    lockerId: 'LK-04',
    lockerName: 'Tủ Cộng Hòa',
    compartmentId: 'N08',
    storedAt: '03/09/2026 16:45',
    overdueDuration: '5 ngày 1 giờ',
    level: 'three-days-or-more',
    residentName: 'Phạm Quốc Bảo',
    residentPhone: '091 *** 6945',
    storageAddress: 'Phòng bảo vệ, cổng chính tòa nhà',
  },
];

function getExpiryAt(storedAt: string) {
  const [date] = storedAt.split(' ');
  const [day, month, year] = date.split('/').map(Number);
  const recoveryDate = new Date(year, month - 1, day + 8);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${pad(recoveryDate.getDate())}/${pad(recoveryDate.getMonth() + 1)}/${recoveryDate.getFullYear()} 00:00`;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[11rem_1fr] sm:gap-5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

function OverdueChip({ level }: { level: OverdueLevel }) {
  return (
    <Chip
      color={level === 'three-days-or-more' ? 'danger' : 'warning'}
      size="sm"
      variant="soft"
    >
      {level === 'three-days-or-more' ? 'Quá hạn nghiêm trọng' : 'Quá hạn'}
    </Chip>
  );
}

function OverdueListPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [lockerFilter, setLockerFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');

  const parcels = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi');

    return OVERDUE_PARCELS.filter(
      (parcel) =>
        (!normalizedKeyword ||
          parcel.id.toLocaleLowerCase('vi').includes(normalizedKeyword)) &&
        (lockerFilter === 'all' || parcel.lockerId === lockerFilter) &&
        (levelFilter === 'all' || parcel.level === levelFilter),
    );
  }, [keyword, levelFilter, lockerFilter]);

  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      <Alert status="warning">
        <Alert.Indicator>
          <Clock aria-hidden="true" className="size-5" />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>4 bưu kiện đang chờ xử lý</Alert.Title>
          <Alert.Description>
            Kiện quá hạn lâu nhất đã 5 ngày 1 giờ. Hãy kiểm tra và chuyển hàng
            về đúng điểm lưu giữ.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <Card>
        <Card.Header>
          <Card.Title>Tìm kiếm và lọc</Card.Title>
          <Card.Description>
            Tra cứu theo mã bưu kiện, tủ được phân công và mức độ quá hạn.
          </Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_13rem_14rem]">
          <SearchField
            fullWidth
            aria-label="Tìm theo mã bưu kiện"
            value={keyword}
            variant="secondary"
            onChange={setKeyword}
          >
            <SearchField.Group>
              <SearchField.SearchIcon>
                <Magnifier aria-hidden="true" className="size-4" />
              </SearchField.SearchIcon>
              <SearchField.Input placeholder="Nhập mã bưu kiện..." />
              <SearchField.ClearButton aria-label="Xóa từ khóa">
                <Xmark aria-hidden="true" className="size-4" />
              </SearchField.ClearButton>
            </SearchField.Group>
          </SearchField>

          <Select
            aria-label="Lọc theo tủ"
            value={lockerFilter}
            variant="secondary"
            onChange={(value) => setLockerFilter(String(value ?? 'all'))}
          >
            <Select.Trigger>
              <Box aria-hidden="true" className="size-4 text-accent" />
              <Select.Value />
              <Select.Indicator>
                <ChevronDown aria-hidden="true" className="size-4" />
              </Select.Indicator>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="all" textValue="Tất cả tủ">
                  Tất cả tủ
                </ListBox.Item>
                <ListBox.Item id="LK-01" textValue="Tủ LK-01">
                  Tủ LK-01
                </ListBox.Item>
                <ListBox.Item id="LK-02" textValue="Tủ LK-02">
                  Tủ LK-02
                </ListBox.Item>
                <ListBox.Item id="LK-04" textValue="Tủ LK-04">
                  Tủ LK-04
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>

          <Select
            aria-label="Lọc theo mức độ quá hạn"
            value={levelFilter}
            variant="secondary"
            onChange={(value) => setLevelFilter(String(value ?? 'all'))}
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
                <ListBox.Item id="all" textValue="Tất cả mức độ">
                  Tất cả mức độ
                </ListBox.Item>
                <ListBox.Item
                  id="under-three-days"
                  textValue="Dưới 3 ngày"
                >
                  Dưới 3 ngày
                </ListBox.Item>
                <ListBox.Item
                  id="three-days-or-more"
                  textValue="Từ 3 ngày"
                >
                  Từ 3 ngày
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </Card.Content>
      </Card>

      {parcels.length ? (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Danh sách bưu kiện quá hạn">
              <Table.Header>
                <Table.Column id="parcel" isRowHeader>
                  Mã bưu kiện
                </Table.Column>
                <Table.Column id="locker">Tủ / Ngăn</Table.Column>
                <Table.Column id="stored">Gửi vào</Table.Column>
                <Table.Column id="overdue">Thời điểm hết hạn</Table.Column>
                <Table.Column id="duration">Thời gian quá hạn</Table.Column>
                <Table.Column id="status">Trạng thái</Table.Column>
                <Table.Column id="action">Thao tác</Table.Column>
              </Table.Header>
              <Table.Body>
                {parcels.map((parcel) => (
                  <Table.Row key={parcel.id} id={parcel.id}>
                    <Table.Cell>
                      <span className="font-semibold">{parcel.id}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="block font-medium">
                        {parcel.lockerId} · {parcel.compartmentId}
                      </span>
                      <span className="block text-xs text-muted">
                        {parcel.lockerName}
                      </span>
                    </Table.Cell>
                    <Table.Cell>{parcel.storedAt}</Table.Cell>
                    <Table.Cell>{getExpiryAt(parcel.storedAt)}</Table.Cell>
                    <Table.Cell>
                      <span className="font-semibold text-danger">
                        {parcel.overdueDuration}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <OverdueChip level={parcel.level} />
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          navigate(`/operator/overdue-clearance/${parcel.id}`)
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
        <Alert status="default">
          <Alert.Indicator>
            <CircleInfo aria-hidden="true" className="size-5" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Không tìm thấy bưu kiện</Alert.Title>
            <Alert.Description>
              Hãy thử đổi mã bưu kiện hoặc bộ lọc.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
    </section>
  );
}

function OverdueDetailPage({ parcel }: { parcel: OverdueParcel }) {
  const confirmState = useOverlayState();
  const [note, setNote] = useState('');
  const [isProcessed, setIsProcessed] = useState(false);

  const confirmClearance = () => {
    setIsProcessed(true);
    confirmState.close();
    toast.success(`Đã mở ngăn ${parcel.compartmentId}`, {
      description: `${parcel.id} được ghi nhận đã lấy khỏi tủ và chuyển tới nơi lưu hàng quá hạn.`,
      indicator: <CircleCheck aria-hidden="true" className="size-5" />,
    });
  };

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {isProcessed ? (
        <Alert status="success">
          <Alert.Indicator>
            <CircleCheck aria-hidden="true" className="size-5" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Hoàn tất xử lý</Alert.Title>
            <Alert.Description>
              Ngăn {parcel.compartmentId} đã được mở, bưu kiện được ghi nhận đã
              lấy khỏi tủ, chuyển tới nơi lưu hàng quá hạn và cư dân đã nhận
              thông báo.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : (
        <Alert status="danger">
          <Alert.Indicator>
            <TriangleExclamation aria-hidden="true" className="size-5" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>
              Bưu kiện đã quá hạn {parcel.overdueDuration}
            </Alert.Title>
            <Alert.Description>
              Kiểm tra đủ điều kiện trước khi lấy hàng khỏi ngăn.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <Card.Header>
            <Card.Title>Thông tin bưu kiện quá hạn</Card.Title>
            <Card.Description>
              Thông tin vị trí và thời hạn của {parcel.id}.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <dl>
              <DetailRow label="Mã bưu kiện">{parcel.id}</DetailRow>
              <DetailRow label="Tủ">
                {parcel.lockerId} · {parcel.lockerName}
              </DetailRow>
              <DetailRow label="Mã ngăn">{parcel.compartmentId}</DetailRow>
              <DetailRow label="Thời gian gửi vào">
                {parcel.storedAt}
              </DetailRow>
              <DetailRow label="Thời điểm hết hạn">
                {getExpiryAt(parcel.storedAt)}
              </DetailRow>
              <DetailRow label="Thời gian quá hạn">
                <span className="font-semibold text-danger">
                  {parcel.overdueDuration}
                </span>
              </DetailRow>
              <DetailRow label="Trạng thái">
                {isProcessed ? (
                  <Chip color="success" size="sm" variant="soft">
                    Đã xử lý
                  </Chip>
                ) : (
                  <OverdueChip level={parcel.level} />
                )}
              </DetailRow>
            </dl>

            <Separator className="my-4" />

            <Typography className="mb-2" type="h6">
              Thông tin cư dân
            </Typography>
            <dl>
              <DetailRow label="Họ tên">{parcel.residentName}</DetailRow>
              <DetailRow label="Số điện thoại">
                {parcel.residentPhone}
              </DetailRow>
            </dl>
          </Card.Content>
        </Card>

        <div className="flex flex-col gap-4">
          <Card variant="secondary">
            <Card.Header>
              <Card.Title>Điểm lưu hàng quá hạn</Card.Title>
            </Card.Header>
            <Card.Content className="flex gap-3">
              <LocationArrow
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-accent"
              />
              <span className="text-sm font-medium">
                {parcel.storageAddress}
              </span>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Điều kiện xử lý</Card.Title>
            </Card.Header>
            <Card.Content className="space-y-3">
              <span className="flex items-start gap-2 text-sm">
                <CircleCheck
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-success"
                />
                Đã vượt thời hạn nhận tối đa
              </span>
              <span className="flex items-start gap-2 text-sm">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-success"
                />
                Không thuộc trạng thái tranh chấp
              </span>
              <span className="flex items-start gap-2 text-sm">
                <Person
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-success"
                />
                Thuộc phạm vi tủ được phân công
              </span>
            </Card.Content>
            <Card.Footer>
              <Button
                fullWidth
                isDisabled={isProcessed}
                variant="primary"
                onPress={() => {
                  setNote('');
                  confirmState.open();
                }}
              >
                <Box aria-hidden="true" className="size-5" />
                {isProcessed ? 'Đã xử lý' : 'Mở ngăn để xử lý'}
              </Button>
            </Card.Footer>
          </Card>

          {isProcessed ? (
            <Card variant="secondary">
              <Card.Header>
                <Card.Title>Ghi nhận hệ thống</Card.Title>
              </Card.Header>
              <Card.Content className="space-y-3">
                <span className="flex items-start gap-2 text-sm">
                  <LockOpen
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-accent"
                  />
                  Lệnh mở ngăn đã được gửi và xác nhận.
                </span>
                <span className="flex items-start gap-2 text-sm">
                  <File
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-accent"
                  />
                  Lịch sử xử lý đã được cập nhật.
                </span>
                <span className="flex items-start gap-2 text-sm">
                  <CircleCheck
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-success"
                  />
                  Đã gửi thông báo nhận hàng cho cư dân.
                </span>
                {note.trim() ? (
                  <span className="block text-sm text-muted">
                    Ghi chú: {note.trim()}
                  </span>
                ) : null}
              </Card.Content>
            </Card>
          ) : null}
        </div>
      </div>

      <Modal state={confirmState}>
        <Modal.Backdrop>
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label="Đóng xác nhận xử lý">
                <Xmark aria-hidden="true" className="size-5" />
              </Modal.CloseTrigger>
              <Modal.Header>
                <Modal.Icon>
                  <TriangleExclamation
                    aria-hidden="true"
                    className="size-5"
                  />
                </Modal.Icon>
                <Modal.Heading>Mở ngăn để xử lý hàng quá hạn</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4">
                <Alert status="warning">
                  <Alert.Indicator>
                    <CircleInfo aria-hidden="true" className="size-5" />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>
                      Mở ngăn {parcel.compartmentId} của tủ {parcel.lockerId}?
                    </Alert.Title>
                    <Alert.Description>
                      Ngăn sẽ mở để lấy {parcel.id}. Chỉ xác nhận khi bạn đã
                      đứng trước tủ; sau đó chuyển hàng đến{' '}
                      {parcel.storageAddress.toLocaleLowerCase('vi')}.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>

                <dl>
                  <DetailRow label="Mã tủ">{parcel.lockerId}</DetailRow>
                  <DetailRow label="Mã ngăn">
                    {parcel.compartmentId}
                  </DetailRow>
                  <DetailRow label="Thời gian quá hạn">
                    {parcel.overdueDuration}
                  </DetailRow>
                </dl>

                <TextField fullWidth value={note} onChange={setNote}>
                  <Label>Ghi chú xử lý (không bắt buộc)</Label>
                  <TextArea
                    maxLength={500}
                    placeholder="Nhập ghi chú nếu có..."
                    rows={4}
                  />
                  <FieldError />
                </TextField>
                <span className="block text-right text-xs text-muted">
                  {note.length}/500
                </span>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="ghost">
                  Hủy
                </Button>
                <Button variant="danger" onPress={confirmClearance}>
                  <LockOpen aria-hidden="true" className="size-5" />
                  Mở ngăn và ghi nhận đã lấy
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}

export default function OperatorOverdueClearancePage() {
  const { parcelId } = useParams();

  if (!parcelId) return <OverdueListPage />;

  const parcel = OVERDUE_PARCELS.find((item) => item.id === parcelId);

  return parcel ? (
    <OverdueDetailPage parcel={parcel} />
  ) : (
    <Navigate replace to="/operator/overdue-clearance" />
  );
}
