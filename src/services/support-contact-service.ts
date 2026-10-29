import { ErrorCodes } from '@/constants/error-codes';
import { ApiError, apiRequest } from '@/services/api-client';

// smart-locking-be `dev`: OperatorSupportController (#187)
//   GET /api/lockers/{id}/support            – contact residents see now
//   GET/PUT /api/operators/{id}/support-contact (Administrator)
//   GET/PUT /api/lockers/{id}/support-settings  (Administrator, fallback)
// The public contact always follows the operator currently assigned to the
// locker; outside that operator's hours (or with none) the fallback is shown.
// GET of a contact/settings that was never saved returns 204.

export type LockerSupport = {
  lockerCode: string;
  isAvailable: boolean;
  isFallback: boolean;
  contactName: string | null;
  phoneNumber: string | null;
  supportHours: string | null;
  instructions: string;
  refreshedAt: string;
};

export type OperatorSupportContact = {
  operatorUserId: string;
  displayName: string;
  workPhoneNumber: string;
  isPublic: boolean;
  utcOffsetMinutes: number;
  weekdaysMask: number;
  startsAtMinute: number;
  endsAtMinute: number;
  instructions: string;
  updatedAt: string;
};

export type LockerSupportSettings = {
  fallbackName: string | null;
  fallbackPhoneNumber: string | null;
  fallbackInstructions: string;
  fallbackHours: string | null;
};

export type ContactFormValues = {
  displayName: string;
  workPhoneNumber: string;
  isPublic: boolean;
  /** 0 = Sunday … 6 = Saturday, matching the backend bit order. */
  weekdays: number[];
  /** HH:mm */
  startsAt: string;
  endsAt: string;
  instructions: string;
};

export type SettingsFormValues = {
  fallbackName: string;
  fallbackPhoneNumber: string;
  fallbackInstructions: string;
  fallbackHours: string;
};

export type FormErrors<T> = Partial<Record<keyof T, string>>;

/** Vietnam time; the backend stores the offset with each contact. */
export const VIETNAM_UTC_OFFSET = 420;
export const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

export const toMask = (days: number[]) =>
  days.reduce((mask, day) => mask | (1 << day), 0);

export const fromMask = (mask: number) =>
  WEEKDAY_LABELS.map((_, day) => day).filter(
    (day) => (mask & (1 << day)) !== 0,
  );

const pad = (value: number) => String(value).padStart(2, '0');

export const minuteToTime = (minute: number) =>
  minute >= 1440
    ? '24:00'
    : `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;

export function timeToMinute(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());

  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours === 24 && minutes === 0) return 1440;
  if (hours > 23 || minutes > 59) return Number.NaN;

  return hours * 60 + minutes;
}

export function emptyContactForm(fullName = ''): ContactFormValues {
  return {
    displayName: fullName,
    workPhoneNumber: '',
    isPublic: true,
    weekdays: [1, 2, 3, 4, 5],
    startsAt: '08:00',
    endsAt: '17:00',
    instructions: '',
  };
}

export const toContactForm = (
  contact: OperatorSupportContact,
): ContactFormValues => ({
  displayName: contact.displayName,
  workPhoneNumber: contact.workPhoneNumber,
  isPublic: contact.isPublic,
  weekdays: fromMask(contact.weekdaysMask),
  startsAt: minuteToTime(contact.startsAtMinute),
  endsAt: minuteToTime(contact.endsAtMinute),
  instructions: contact.instructions,
});

export const toSettingsForm = (
  settings: LockerSupportSettings | null,
): SettingsFormValues => ({
  fallbackName: settings?.fallbackName ?? '',
  fallbackPhoneNumber: settings?.fallbackPhoneNumber ?? '',
  fallbackInstructions: settings?.fallbackInstructions ?? '',
  fallbackHours: settings?.fallbackHours ?? '',
});

const required = (value: string, max: number, label: string) => {
  const text = value.trim();

  if (!text) return `Vui lòng nhập ${label}.`;
  if (text.length > max)
    return `${label[0].toUpperCase()}${label.slice(1)} tối đa ${max} ký tự.`;

  return '';
};

const phoneError = (value: string) =>
  PHONE_PATTERN.test(value.trim())
    ? ''
    : 'Số điện thoại công việc gồm 7–15 chữ số, có thể bắt đầu bằng +.';

/** Mirrors OperatorSupportService.SaveContactAsync. */
export function validateContactForm(values: ContactFormValues) {
  const errors: FormErrors<ContactFormValues> = {};
  const start = timeToMinute(values.startsAt);
  const end = timeToMinute(values.endsAt);
  const name = required(values.displayName, 200, 'tên hiển thị');
  const instructions = required(values.instructions, 1000, 'hướng dẫn liên hệ');
  const phone = phoneError(values.workPhoneNumber);

  if (name) errors.displayName = name;
  if (phone) errors.workPhoneNumber = phone;
  if (instructions) errors.instructions = instructions;
  if (!values.weekdays.length)
    errors.weekdays = 'Chọn ít nhất một ngày hỗ trợ.';
  if (Number.isNaN(start) || start >= 1440)
    errors.startsAt = 'Giờ bắt đầu không hợp lệ.';
  if (Number.isNaN(end)) errors.endsAt = 'Giờ kết thúc không hợp lệ.';
  else if (start === end) errors.endsAt = 'Giờ kết thúc phải khác giờ bắt đầu.';

  return errors;
}

/** Mirrors OperatorSupportService.SaveSettingsAsync. */
export function validateSettingsForm(values: SettingsFormValues) {
  const errors: FormErrors<SettingsFormValues> = {};
  const instructions = required(
    values.fallbackInstructions,
    1000,
    'hướng dẫn dự phòng',
  );

  if (instructions) errors.fallbackInstructions = instructions;
  if (
    values.fallbackPhoneNumber.trim() &&
    phoneError(values.fallbackPhoneNumber)
  ) {
    errors.fallbackPhoneNumber = phoneError(values.fallbackPhoneNumber);
  }
  if (values.fallbackName.trim().length > 200)
    errors.fallbackName = 'Tên tối đa 200 ký tự.';
  if (values.fallbackHours.trim().length > 200)
    errors.fallbackHours = 'Giờ hỗ trợ tối đa 200 ký tự.';

  return errors;
}

/** Problems an admin should fix so residents always reach someone. */
export function supportWarnings(input: {
  hasOperator: boolean;
  contact: OperatorSupportContact | null;
  settings: LockerSupportSettings | null;
}) {
  const warnings: string[] = [];

  if (!input.hasOperator)
    warnings.push(
      'Tủ chưa có Operator phụ trách, cư dân chỉ thấy đầu mối dự phòng.',
    );
  else if (!input.contact)
    warnings.push('Operator phụ trách chưa có thông tin liên hệ công việc.');
  else if (!input.contact.isPublic)
    warnings.push(
      'Liên hệ của Operator đang ẩn, cư dân chỉ thấy đầu mối dự phòng.',
    );
  if (!input.settings)
    warnings.push(
      'Tủ chưa cấu hình đầu mối dự phòng; cư dân sẽ thấy hướng dẫn mặc định.',
    );
  else if (!input.settings.fallbackPhoneNumber) {
    warnings.push(
      'Đầu mối dự phòng chưa có số điện thoại; ngoài giờ cư dân không gọi được ai.',
    );
  }

  return warnings;
}

export const getLockerSupport = (lockerId: string, signal?: AbortSignal) =>
  apiRequest<LockerSupport>(
    `/api/lockers/${encodeURIComponent(lockerId)}/support`,
    { signal },
  );

export const getOperatorContact = async (
  operatorId: string,
  signal?: AbortSignal,
) =>
  (await apiRequest<OperatorSupportContact | undefined>(
    `/api/operators/${encodeURIComponent(operatorId)}/support-contact`,
    { signal },
  )) ?? null;

export const saveOperatorContact = (
  operatorId: string,
  values: ContactFormValues,
) =>
  apiRequest<OperatorSupportContact>(
    `/api/operators/${encodeURIComponent(operatorId)}/support-contact`,
    {
      method: 'PUT',
      body: JSON.stringify({
        displayName: values.displayName.trim(),
        workPhoneNumber: values.workPhoneNumber.trim(),
        isPublic: values.isPublic,
        utcOffsetMinutes: VIETNAM_UTC_OFFSET,
        weekdaysMask: toMask(values.weekdays),
        startsAtMinute: timeToMinute(values.startsAt),
        endsAtMinute: timeToMinute(values.endsAt),
        instructions: values.instructions.trim(),
      }),
    },
  );

export const getLockerSupportSettings = async (
  lockerId: string,
  signal?: AbortSignal,
) =>
  (await apiRequest<LockerSupportSettings | undefined>(
    `/api/lockers/${encodeURIComponent(lockerId)}/support-settings`,
    { signal },
  )) ?? null;

export const saveLockerSupportSettings = (
  lockerId: string,
  values: SettingsFormValues,
) =>
  apiRequest<LockerSupportSettings>(
    `/api/lockers/${encodeURIComponent(lockerId)}/support-settings`,
    {
      method: 'PUT',
      body: JSON.stringify({
        fallbackName: values.fallbackName.trim() || null,
        fallbackPhoneNumber: values.fallbackPhoneNumber.trim() || null,
        fallbackInstructions: values.fallbackInstructions.trim(),
        fallbackHours: values.fallbackHours.trim() || null,
      }),
    },
  );

export function getSupportErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case ErrorCodes.INVALID_INPUT:
        return 'Thông tin liên hệ chưa hợp lệ: kiểm tra tên, số điện thoại, giờ hỗ trợ và hướng dẫn.';
      case ErrorCodes.LOCKER_NOT_FOUND:
        return 'Không tìm thấy tủ. Vui lòng tải lại.';
      case ErrorCodes.USER_NOT_FOUND:
        return 'Không tìm thấy Operator. Vui lòng tải lại.';
    }
    if (error.status === 0)
      return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
    if (error.status === 403)
      return 'Chỉ Quản trị viên được cấu hình đầu mối hỗ trợ.';
    if (error.status >= 500)
      return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  }

  return 'Không thể xử lý thông tin hỗ trợ. Vui lòng thử lại.';
}
