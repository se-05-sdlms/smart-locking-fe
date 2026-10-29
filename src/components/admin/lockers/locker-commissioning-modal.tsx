import type {
  CommissioningStep,
  LockerCommissioning,
} from '@/services/locker-commissioning-service';

import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Chip,
  Description,
  Input,
  Label,
  Modal,
  Skeleton,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';

import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  bindDevice,
  configureDevice,
  currentStep,
  getCommissioning,
  getCommissioningErrorMessage,
  handOver,
  historyLabel,
  isSha256,
  isStaleRevision,
  NOTES_MAX,
  STEPS,
  stepStatus,
  translateCommissioningMessage,
  verifyLocker,
} from '@/services/locker-commissioning-service';

const dateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN') : '—';

function Confirm({
  isSelected,
  onChange,
  children,
}: {
  isSelected: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Checkbox isSelected={isSelected} onChange={onChange}>
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
      <Checkbox.Content>{children}</Checkbox.Content>
    </Checkbox>
  );
}

function StepForm({
  state,
  step,
  onSaved,
  onStale,
}: {
  state: LockerCommissioning;
  step: Exclude<CommissioningStep, 'done'>;
  onSaved: (next: LockerCommissioning) => void;
  onStale: () => void;
}) {
  const [deviceId, setDeviceId] = useState('');
  const [sha, setSha] = useState('');
  const [checks, setChecks] = useState({ a: false, b: false });
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);
  const release = state.firmwareRelease;

  const validate = () => {
    if (notes.trim().length > NOTES_MAX)
      return `Ghi chú tối đa ${NOTES_MAX} ký tự.`;
    if (step === 'bind' && deviceId.trim() !== state.deviceIdentifier) {
      return 'Nhập đúng mã thiết bị đọc trên bo mạch, trùng với mã đã khai báo cho tủ.';
    }
    if (step === 'configure') {
      if (!release)
        return 'Máy chủ chưa có bản firmware tương thích; liên hệ quản trị triển khai.';
      if (!isSha256(sha))
        return 'Nhập mã SHA-256 (64 ký tự hex) của tệp firmware đã tải.';
      if (sha.trim().toLowerCase() !== release.sha256.toLowerCase()) {
        return 'SHA-256 không khớp với bản phát hành. Tải lại firmware, không cài tệp này.';
      }
      if (!checks.a) return 'Xác nhận đã cài firmware và cấu hình mạng.';
    }
    if (step === 'verify' && !(checks.a && checks.b))
      return 'Cần xác nhận cả hai mục kiểm tra tại chỗ.';
    if (step === 'handover' && !checks.a)
      return 'Xác nhận nhận bàn giao để đưa tủ vào vận hành.';

    return '';
  };

  const submit = async () => {
    const message = validate();

    setError(message);
    if (message || pending.current) return;
    pending.current = true;
    setIsSaving(true);
    try {
      const next =
        step === 'bind'
          ? await bindDevice(state, deviceId, notes)
          : step === 'configure'
            ? await configureDevice(state, release!, sha, checks.a, notes)
            : step === 'verify'
              ? await verifyLocker(state, checks.a, checks.b, notes)
              : await handOver(state, checks.a, notes);

      toast.success(
        step === 'handover'
          ? 'Tủ đã được bàn giao và đưa vào vận hành'
          : 'Đã ghi nhận bước',
        {
          indicator: <CircleCheck aria-hidden="true" className="size-5" />,
        },
      );
      onSaved(next);
    } catch (submitError) {
      setError(getCommissioningErrorMessage(submitError));
      if (isStaleRevision(submitError)) onStale();
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {step === 'bind' ? (
        <TextField fullWidth value={deviceId} onChange={setDeviceId}>
          <Label>Mã thiết bị trên bo mạch</Label>
          <Input autoComplete="off" variant="secondary" />
          <Description>
            Đọc trực tiếp trên thiết bị để chắc chắn đúng tủ. Mã đã khai báo:{' '}
            {state.deviceIdentifier}
          </Description>
        </TextField>
      ) : null}

      {step === 'configure' ? (
        release ? (
          <>
            <div className="rounded-xl border border-separator p-3 text-sm">
              <p>
                Firmware <strong>{release.version}</strong> cho model{' '}
                <strong>{release.hardwareModel}</strong>
              </p>
              <p className="break-all text-xs text-muted">
                SHA-256: {release.sha256}
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <a
                  className="text-accent underline"
                  href={release.downloadUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Tải bộ cài
                </a>
                <a
                  className="text-accent underline"
                  href={release.installationGuideUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Hướng dẫn cài đặt & cấu hình mạng
                </a>
              </div>
            </div>
            <TextField fullWidth value={sha} onChange={setSha}>
              <Label>SHA-256 của tệp đã tải</Label>
              <Input autoComplete="off" variant="secondary" />
              <Description>
                Tính trên máy đã tải (VD: certutil -hashfile tệp SHA256) để chắc
                tệp không bị lỗi.
              </Description>
            </TextField>
            <Confirm
              isSelected={checks.a}
              onChange={(a) => setChecks({ ...checks, a })}
            >
              Đã cài đúng bản firmware trên và cấu hình mạng; thiết bị đang bật
              và kết nối.
            </Confirm>
          </>
        ) : (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>
                Máy chủ chưa cấu hình bản firmware tương thích. Liên hệ quản trị
                triển khai, sau đó tải lại.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )
      ) : null}

      {step === 'verify' ? (
        <>
          <Confirm
            isSelected={checks.a}
            onChange={(a) => setChecks({ ...checks, a })}
          >
            Đã thử mở/đóng thực tế từng cửa ngăn.
          </Confirm>
          <Confirm
            isSelected={checks.b}
            onChange={(b) => setChecks({ ...checks, b })}
          >
            Đã kiểm tra dây điện và an toàn relay.
          </Confirm>
        </>
      ) : null}

      {step === 'handover' ? (
        <Confirm
          isSelected={checks.a}
          onChange={(a) => setChecks({ ...checks, a })}
        >
          Tôi nhận bàn giao và đồng ý đưa tủ vào vận hành.
        </Confirm>
      ) : null}

      <TextField fullWidth value={notes} onChange={setNotes}>
        <Label>Ghi chú (không bắt buộc)</Label>
        <TextArea maxLength={NOTES_MAX} rows={2} variant="secondary" />
        <Description>
          Không ghi mật khẩu Wi‑Fi, khóa hay bí mật thiết bị.
        </Description>
      </TextField>
      {error ? (
        <Alert role="alert" status="danger">
          <Alert.Indicator>
            <CircleExclamation aria-hidden="true" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      <Button
        isDisabled={step === 'configure' && !release}
        isPending={isSaving}
        variant="primary"
        onPress={() => void submit()}
      >
        {step === 'bind'
          ? 'Liên kết thiết bị'
          : step === 'configure'
            ? 'Ghi nhận cài đặt'
            : step === 'verify'
              ? 'Xác nhận kiểm tra đạt'
              : 'Bàn giao và đưa vào vận hành'}
      </Button>
    </div>
  );
}

export function LockerCommissioningModal({
  lockerId,
  lockerCode,
  onClose,
  onChanged,
}: {
  lockerId: string;
  lockerCode: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { state, setState, reload } = useAsyncResource(
    (signal) => getCommissioning(lockerId, signal),
    getCommissioningErrorMessage,
    [lockerId],
  );
  const [reconfigure, setReconfigure] = useState(false);
  const data = state.data;
  const step = data ? currentStep(data) : 'bind';
  const formStep = reconfigure ? 'configure' : step;

  const saved = (next: LockerCommissioning) => {
    setState({ status: 'success', data: next });
    setReconfigure(false);
    onChanged();
  };

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container scroll="inside" size="lg">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>
                Quy trình bàn giao · Tủ {lockerCode}
              </Modal.Heading>
              <Modal.CloseTrigger aria-label="Đóng quy trình bàn giao" />
            </Modal.Header>
            <Modal.Body className="space-y-4">
              {state.status === 'loading' && !data ? (
                <Skeleton className="h-48 w-full rounded-xl" />
              ) : null}
              {state.status === 'error' && !data ? (
                <Alert role="alert" status="danger">
                  <Alert.Content>
                    <Alert.Description>{state.message}</Alert.Description>
                  </Alert.Content>
                  <Button size="sm" variant="secondary" onPress={reload}>
                    Thử lại
                  </Button>
                </Alert>
              ) : null}
              {data?.isLegacyLocker ? (
                <Alert status="default">
                  <Alert.Content>
                    <Alert.Description>
                      Tủ này có từ trước quy trình bàn giao nên được giữ nguyên,
                      không cần thực hiện các bước dưới.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}
              {data && !data.isLegacyLocker ? (
                <>
                  <ol className="grid gap-2 sm:grid-cols-4">
                    {STEPS.map((item, index) => {
                      const status = stepStatus(data, item.id);

                      return (
                        <li
                          key={item.id}
                          className={`rounded-xl border p-2 text-sm ${status === 'current' ? 'border-accent' : 'border-separator'}`}
                        >
                          <span className="block text-xs text-muted">
                            Bước {index + 1}
                          </span>
                          <span className="font-medium">{item.label}</span>
                          <Chip
                            className="mt-1"
                            color={
                              status === 'done'
                                ? 'success'
                                : status === 'current'
                                  ? 'accent'
                                  : 'default'
                            }
                            size="sm"
                            variant="soft"
                          >
                            {status === 'done'
                              ? 'Xong'
                              : status === 'current'
                                ? 'Đang làm'
                                : 'Chưa tới'}
                          </Chip>
                        </li>
                      );
                    })}
                  </ol>

                  <dl className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-muted">Thiết bị khai báo</dt>
                    <dd>{data.deviceIdentifier}</dd>
                    <dt className="text-muted">Thiết bị đã liên kết</dt>
                    <dd>{data.boundDeviceIdentifier ?? 'Chưa liên kết'}</dd>
                    <dt className="text-muted">Firmware đã cài</dt>
                    <dd>
                      {data.firmwareVersion
                        ? `${data.firmwareVersion} · ${data.firmwareHardwareModel ?? ''} · ${dateTime(data.configuredAt)}`
                        : '—'}
                    </dd>
                    <dt className="text-muted">Kiểm tra tại chỗ</dt>
                    <dd>{dateTime(data.verifiedAt)}</dd>
                    <dt className="text-muted">Bàn giao</dt>
                    <dd>{dateTime(data.handedOverAt)}</dd>
                  </dl>

                  {step === 'done' ? (
                    <Alert status="success">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>
                          Tủ đã được bàn giao và đang vận hành
                        </Alert.Title>
                        <Alert.Description>
                          Có thể tải mã QR cho cư dân ở mục Mã QR của tủ (QR
                          công khai chỉ chứa đường dẫn tới tủ, không chứa thông
                          tin thiết bị).
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : (
                    <Alert status="warning">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>Tủ chưa sẵn sàng phục vụ</Alert.Title>
                        <Alert.Description>
                          Tủ vẫn ngừng phục vụ cho đến khi hoàn tất bàn giao.
                          Tiến độ được lưu, có thể đóng và tiếp tục sau.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                  )}

                  {data.blockers.length && step !== 'done' ? (
                    <Card>
                      <Card.Header>
                        <Card.Title>Còn thiếu</Card.Title>
                      </Card.Header>
                      <Card.Content>
                        <ul className="list-disc space-y-1 pl-4 text-sm">
                          {data.blockers.map((blocker) => (
                            <li key={blocker}>
                              {translateCommissioningMessage(blocker)}
                            </li>
                          ))}
                        </ul>
                        <Button
                          className="mt-2"
                          size="sm"
                          variant="secondary"
                          onPress={reload}
                        >
                          <ArrowRotateRight
                            aria-hidden="true"
                            className="size-4"
                          />
                          Kiểm tra lại
                        </Button>
                      </Card.Content>
                    </Card>
                  ) : null}

                  {formStep !== 'done' ? (
                    <Card>
                      <Card.Header className="flex-row items-center justify-between">
                        <Card.Title>
                          {STEPS.find((item) => item.id === formStep)?.label}
                        </Card.Title>
                        {reconfigure ? (
                          <Button
                            size="sm"
                            variant="tertiary"
                            onPress={() => setReconfigure(false)}
                          >
                            Quay lại bước hiện tại
                          </Button>
                        ) : step === 'verify' || step === 'handover' ? (
                          <Button
                            size="sm"
                            variant="tertiary"
                            onPress={() => setReconfigure(true)}
                          >
                            Cài đặt lại
                          </Button>
                        ) : null}
                      </Card.Header>
                      <Card.Content>
                        <StepForm
                          key={`${formStep}-${data.revision}`}
                          state={data}
                          step={formStep}
                          onSaved={saved}
                          onStale={reload}
                        />
                      </Card.Content>
                    </Card>
                  ) : null}

                  {data.history.length ? (
                    <div>
                      <p className="mb-2 font-medium">Lịch sử</p>
                      <ol className="space-y-1 border-l border-separator pl-4 text-sm">
                        {[...data.history].reverse().map((item) => (
                          <li key={`${item.action}-${item.occurredAt}`}>
                            {historyLabel(item.action)} ·{' '}
                            <span className="text-muted">
                              {dateTime(item.occurredAt)}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </>
              ) : null}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={onClose}>
                Đóng
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
