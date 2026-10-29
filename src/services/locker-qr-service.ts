import QRCode from 'qrcode';

import { ApiError, apiRequest } from '@/services/api-client';

// smart-locking-be `dev`: GET /api/lockers/{id}/qr-context (Administrator, or
// LockerOperator within the current scope incl. temporary coverage, #184).
// The backend returns only public data: the Shipper web URL for this
// environment with `?locker=<code>`. The browser renders and downloads the PNG.

export type LockerQrContext = {
  lockerId: string;
  lockerCode: string;
  shipperUrl: string;
  operationalStatus: 0 | 1 | 2;
};

/** Rendered size in px; large enough to stay sharp when printed on a sticker. */
export const QR_IMAGE_SIZE = 1024;

export class LockerQrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockerQrError';
  }
}

/**
 * Guards against producing a wrong image: the URL must be absolute https (or
 * http on loopback for local dev), point at this locker code and carry no
 * credentials, fragments or extra query values.
 */
export function validateQrContext(context: LockerQrContext): string {
  let url: URL;

  try {
    url = new URL(context.shipperUrl);
  } catch {
    throw new LockerQrError('Địa chỉ web Shipper trả về không hợp lệ.');
  }

  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);

  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) {
    throw new LockerQrError('Địa chỉ web Shipper phải dùng HTTPS.');
  }
  if (url.username || url.password || url.hash) {
    throw new LockerQrError(
      'Địa chỉ web Shipper chứa thông tin không được phép.',
    );
  }

  const params = [...url.searchParams.keys()];

  if (!context.lockerCode.trim()) {
    throw new LockerQrError('Tủ chưa có mã nên không thể tạo QR.');
  }
  if (
    params.length !== 1 ||
    url.searchParams.get('locker') !== context.lockerCode
  ) {
    throw new LockerQrError('Địa chỉ QR không khớp mã tủ. Vui lòng tải lại.');
  }

  return url.toString();
}

export function getLockerQrContext(lockerId: string, signal?: AbortSignal) {
  return apiRequest<LockerQrContext>(
    `/api/lockers/${encodeURIComponent(lockerId)}/qr-context`,
    { signal },
  );
}

/** PNG data URL of the QR for a validated context. */
export async function renderLockerQr(context: LockerQrContext) {
  const url = validateQrContext(context);

  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: QR_IMAGE_SIZE,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

/** File name that identifies the locker, safe on every OS. */
export function qrFileName(lockerCode: string) {
  const safe = lockerCode
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `qr-tu-${safe || 'khong-ma'}.png`;
}

export function getLockerQrErrorMessage(error: unknown) {
  if (error instanceof LockerQrError) return error.message;
  if (error instanceof ApiError) {
    if (error.code === 'LOCKER_QR_NOT_CONFIGURED' || error.status === 409) {
      return 'Môi trường này chưa cấu hình địa chỉ web Shipper nên chưa thể tạo QR. Liên hệ quản trị hệ thống.';
    }
    if (error.status === 403)
      return 'Tủ này không thuộc phạm vi bạn đang phụ trách.';
    if (error.status === 404) return 'Không tìm thấy tủ. Vui lòng tải lại.';
    if (error.status === 0)
      return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
    if (error.status >= 500)
      return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  }

  return 'Không thể tạo mã QR. Vui lòng thử lại.';
}
