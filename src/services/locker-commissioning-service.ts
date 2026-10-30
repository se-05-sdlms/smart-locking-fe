import type { UsersPageDto } from '@/types/user-management-api';

import { ErrorCodes } from '@/constants/error-codes';
import { ApiError, apiRequest } from '@/services/api-client';

// smart-locking-be `dev`: LockerCommissioningController (#183, Administrator)
//   GET  /api/admin/lockers/{id}/commissioning
//   POST .../bind-device | configure | verify | handover   (ExpectedRevision)
// A newly declared locker stays out of service until handover; creating it
// does not make it ready. Every step is resumable: the server keeps progress
// and rejects stale revisions so two tabs cannot overwrite each other.
// Lockers created before this workflow are "legacy" and are left untouched.

export type CommissioningStep =
  | 'bind'
  | 'configure'
  | 'verify'
  | 'handover'
  | 'done';

export type FirmwareRelease = {
  version: string;
  hardwareModel: string;
  downloadUrl: string;
  sha256: string;
  installationGuideUrl: string;
};

export type CommissioningHistory = {
  actorUserId: string | null;
  action: string;
  details: string | null;
  occurredAt: string;
};

export type LockerCommissioning = {
  lockerId: string;
  isLegacyLocker: boolean;
  /** Serialized as a number (enum) by default; strings are accepted too. */
  stage: number | string | null;
  revision: number;
  deviceIdentifier: string;
  boundDeviceIdentifier: string | null;
  firmwareVersion: string | null;
  firmwareHardwareModel: string | null;
  configuredAt: string | null;
  verifiedAt: string | null;
  verifiedByUserId: string | null;
  handedOverAt: string | null;
  handedOverByUserId: string | null;
  firmwareRelease: FirmwareRelease | null;
  blockers: string[];
  history: CommissioningHistory[];
};

export const NOTES_MAX = 500;

export const STEPS: Array<{
  id: Exclude<CommissioningStep, 'done'>;
  label: string;
}> = [
  { id: 'bind', label: 'Liên kết thiết bị' },
  { id: 'configure', label: 'Cài firmware & mạng' },
  { id: 'verify', label: 'Kiểm tra tại chỗ' },
  { id: 'handover', label: 'Bàn giao vận hành' },
];

/** The next step to do, derived from what the server has recorded. */
export function currentStep(state: LockerCommissioning): CommissioningStep {
  if (state.handedOverAt) return 'done';
  if (state.verifiedAt) return 'handover';
  if (state.configuredAt) return 'verify';
  if (state.boundDeviceIdentifier) return 'configure';

  return 'bind';
}

export function stepStatus(
  state: LockerCommissioning,
  step: Exclude<CommissioningStep, 'done'>,
): 'done' | 'current' | 'todo' {
  const order = STEPS.map((item) => item.id);
  const now = currentStep(state);

  if (now === 'done') return 'done';
  const index = order.indexOf(step);
  const current = order.indexOf(now);

  return index < current ? 'done' : index === current ? 'current' : 'todo';
}

export const isHandedOver = (
  state: Pick<LockerCommissioning, 'handedOverAt'>,
) => Boolean(state.handedOverAt);

const historyLabels: Record<string, string> = {
  DeviceBound: 'Liên kết thiết bị',
  Configured: 'Ghi nhận cài đặt & mạng',
  Verified: 'Kiểm tra tại chỗ đạt',
  HandedOver: 'Bàn giao vận hành',
  Declared: 'Khai báo tủ',
};

export const historyLabel = (action: string) => {
  const key = action.replace(/^Locker\.Commissioning\./, '');

  return historyLabels[key] ?? key;
};

const messages: Record<string, string> = {
  'Compatible firmware release or observation freshness policy is not configured.':
    'Chưa cấu hình bản firmware tương thích hoặc ngưỡng tín hiệu mới (do quản trị triển khai cấu hình trên máy chủ).',
  'A compatible firmware release and observation freshness policy must be configured by deployment administrators.':
    'Chưa cấu hình bản firmware tương thích hoặc ngưỡng tín hiệu mới (do quản trị triển khai cấu hình trên máy chủ).',
  'Device binding is missing or has changed.':
    'Chưa liên kết thiết bị hoặc thiết bị đã thay đổi.',
  'Installation and network configuration have not been confirmed.':
    'Chưa xác nhận cài đặt và cấu hình mạng.',
  'A fresh online device signal is required.':
    'Cần tín hiệu trực tuyến mới từ thiết bị (bật nguồn, kiểm tra Wi‑Fi rồi tải lại).',
  'The bound device must report a fresh online signal after binding.':
    'Thiết bị phải gửi tín hiệu trực tuyến mới sau khi liên kết (bật nguồn, kiểm tra Wi‑Fi rồi thử lại).',
  'Recorded firmware differs from the configured compatible release; configure again.':
    'Firmware đã ghi khác bản tương thích hiện tại; hãy cài và xác nhận lại.',
  'At least one hardware compartment is required.':
    'Tủ cần ít nhất một ngăn phần cứng.',
  'Hardware mapping or locker configuration changed after verification; configure and verify again.':
    'Cấu hình phần cứng đã thay đổi sau khi kiểm tra; hãy cấu hình và kiểm tra lại.',
  'Close or cancel outstanding maintenance before handover.':
    'Đóng hoặc hủy phiếu bảo trì đang mở trước khi bàn giao.',
  'Resolve outstanding incidents before handover.':
    'Xử lý xong sự cố đang mở trước khi bàn giao.',
  'Device binding is already recorded. Resume the current stage.':
    'Thiết bị đã được liên kết. Tiếp tục bước hiện tại.',
  'Confirm the exact device identifier recorded for this locker.':
    'Mã thiết bị phải trùng đúng mã đã khai báo cho tủ.',
  'Bind the device before recording installation and network configuration.':
    'Liên kết thiết bị trước khi ghi nhận cài đặt.',
  'Confirm the hardware model, downloaded firmware checksum, installation and network setup of the configured release.':
    'Xác nhận đúng model phần cứng, mã SHA-256 của bản firmware đã tải, việc cài đặt và mạng.',
  'Record configuration before verification.':
    'Ghi nhận cài đặt trước khi kiểm tra.',
  'An authorized installer must physically check every door, wiring and relay safety.':
    'Người lắp đặt phải kiểm tra thực tế mọi cửa, dây điện và an toàn relay.',
  'Verify the locker and explicitly accept handover before activation.':
    'Kiểm tra tủ và xác nhận bàn giao trước khi đưa vào hoạt động.',
  'Existing lockers are preserved; this workflow applies to newly declared lockers.':
    'Tủ có từ trước được giữ nguyên; quy trình này chỉ áp dụng cho tủ mới khai báo.',
  'Commissioning has changed. Reload the latest progress before continuing.':
    'Tiến độ đã thay đổi ở nơi khác. Đã tải lại tiến độ mới nhất.',
  'Commissioning requires the locker to remain out of service.':
    'Tủ phải ở trạng thái ngừng phục vụ trong khi bàn giao.',
};

export function translateCommissioningMessage(message: string) {
  if (messages[message]) return messages[message];
  const slot =
    /^Compartment (.+) needs valid hardware mapping, operational status and a fresh closed-door observation after configuration\.$/.exec(
      message,
    );

  if (slot)
    return `Ngăn ${slot[1]} cần ánh xạ phần cứng hợp lệ, đang hoạt động và có tín hiệu đóng cửa mới sau khi cấu hình.`;

  return message;
}

/** Several blockers may be joined into one error message by the server. */
export function splitServerMessage(message: string) {
  const known = [...Object.keys(messages)].filter((item) =>
    message.includes(item),
  );

  if (!known.length) return [translateCommissioningMessage(message)];

  return known.map(translateCommissioningMessage);
}

/**
 * Administrators who may appear as verifier / handover approver.
 * GET /api/Users?Role=0 (Administrator); a failed lookup only loses names.
 */
export async function listAdministratorNames(signal?: AbortSignal) {
  const page = await apiRequest<UsersPageDto>(
    '/api/Users?Role=0&PageNumber=1&PageSize=100',
    { signal },
  );

  return new Map(
    page.items.map((user) => [user.id, user.fullName || user.email || '']),
  );
}

/** Who confirmed a step; recognizable even when the name is unknown. */
export function actorLabel(
  userId: string | null,
  names: Map<string, string>,
  currentUserId?: string,
) {
  if (!userId) return 'Hệ thống';
  const name = names.get(userId);

  if (userId === currentUserId) return name ? `${name} (bạn)` : 'Bạn';

  return name || `Quản trị viên #${userId.slice(0, 8)}`;
}

export const isSha256 = (value: string) =>
  /^[a-fA-F0-9]{64}$/.test(value.trim());

const path = (lockerId: string) =>
  `/api/admin/lockers/${encodeURIComponent(lockerId)}/commissioning`;

export const getCommissioning = (lockerId: string, signal?: AbortSignal) =>
  apiRequest<LockerCommissioning>(path(lockerId), { signal });

const post = (lockerId: string, action: string, body: object) =>
  apiRequest<LockerCommissioning>(`${path(lockerId)}/${action}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

const notes = (value: string) => value.trim() || null;

export const bindDevice = (
  state: LockerCommissioning,
  deviceIdentifier: string,
  note: string,
) =>
  post(state.lockerId, 'bind-device', {
    expectedRevision: state.revision,
    deviceIdentifier: deviceIdentifier.trim(),
    notes: notes(note),
  });

export const configureDevice = (
  state: LockerCommissioning,
  release: FirmwareRelease,
  firmwareSha256: string,
  confirmed: boolean,
  note: string,
) =>
  post(state.lockerId, 'configure', {
    expectedRevision: state.revision,
    firmwareVersion: release.version,
    hardwareModel: release.hardwareModel,
    firmwareSha256: firmwareSha256.trim().toLowerCase(),
    installationAndNetworkConfirmed: confirmed,
    notes: notes(note),
  });

export const verifyLocker = (
  state: LockerCommissioning,
  doorsTested: boolean,
  wiringSafe: boolean,
  note: string,
) =>
  post(state.lockerId, 'verify', {
    expectedRevision: state.revision,
    everyDoorPhysicallyTested: doorsTested,
    wiringAndRelaySafetyConfirmed: wiringSafe,
    notes: notes(note),
  });

export const handOver = (
  state: LockerCommissioning,
  accepted: boolean,
  note: string,
) =>
  post(state.lockerId, 'handover', {
    expectedRevision: state.revision,
    acceptedForOperation: accepted,
    notes: notes(note),
  });

export const isStaleRevision = (error: unknown) =>
  error instanceof ApiError &&
  error.message.includes('Reload the latest progress');

export function getCommissioningErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === ErrorCodes.LOCKER_NOT_OPERATIONAL && error.message) {
      return splitServerMessage(error.message).join(' ');
    }
    switch (error.code) {
      case ErrorCodes.LOCKER_DEVICE_ALREADY_EXISTS:
        return 'Thiết bị đang liên kết với tủ khác.';
      case ErrorCodes.LOCKER_NOT_FOUND:
        return 'Không tìm thấy tủ.';
      case ErrorCodes.INVALID_INPUT:
        return 'Ghi chú tối đa 500 ký tự và không được chứa bí mật thiết bị.';
    }
    if (error.status === 0)
      return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
    if (error.status === 403)
      return 'Chỉ Quản trị viên được thực hiện quy trình bàn giao tủ.';
    if (error.status >= 500)
      return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  }

  return 'Không thể xử lý quy trình bàn giao tủ. Vui lòng thử lại.';
}
