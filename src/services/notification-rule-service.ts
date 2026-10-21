import { ApiError, apiRequest } from '@/services/api-client';
import { ErrorCodes } from '@/constants/error-codes';

// smart-locking-be `dev`: NotificationRulesController (/api/notification-rules),
// Administrator only. Rules belong to one system policy version; rules of the
// active version are immutable (409 policy/immutable).

/** `NotificationChannel`: 0 InApp, 1 Push, 2 Sms, 3 Email. */
export type NotificationChannel = 0 | 1 | 2 | 3;

export const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = [
  0, 1, 2, 3,
];

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> =
  {
    0: 'Trong ứng dụng',
    1: 'Thông báo đẩy',
    2: 'SMS',
    3: 'Email',
  };

/**
 * Event types the backend raises today. `EventType` is free text on the
 * backend (1–100 characters), so other values are allowed and shown as-is.
 */
export const NOTIFICATION_EVENT_LABELS: Record<string, string> = {
  ParcelStored: 'Bưu kiện đã được gửi vào tủ',
  DeliveryApprovalRequested: 'Yêu cầu cư dân duyệt giao hàng',
  DoorOpenTooLong: 'Cửa ngăn mở quá lâu',
  LockerOffline: 'Tủ mất kết nối',
  OverduePaymentSucceeded: 'Thanh toán phí quá hạn thành công',
  OverduePaymentFailed: 'Thanh toán phí quá hạn thất bại',
};

export const KNOWN_NOTIFICATION_EVENTS = Object.keys(NOTIFICATION_EVENT_LABELS);

export const EVENT_TYPE_MAX_LENGTH = 100;

export function notificationEventLabel(eventType: string) {
  return NOTIFICATION_EVENT_LABELS[eventType] ?? eventType;
}

export type NotificationRule = {
  id: string;
  systemPolicyId: string;
  eventType: string;
  channel: NotificationChannel;
  leadTimeMinutes: number | null;
  isEnabled: boolean;
};

export type NotificationRuleFormValues = {
  eventType: string;
  channel: NotificationChannel;
  /** Kept as a string while editing; empty means "send immediately". */
  leadTimeMinutes: string;
  isEnabled: boolean;
};

export type NotificationRuleFormErrors = Partial<
  Record<keyof NotificationRuleFormValues, string>
>;

export function emptyRuleForm(): NotificationRuleFormValues {
  return {
    eventType: KNOWN_NOTIFICATION_EVENTS[0],
    channel: 0,
    leadTimeMinutes: '',
    isEnabled: true,
  };
}

export function toRuleFormValues(
  rule: NotificationRule,
): NotificationRuleFormValues {
  return {
    eventType: rule.eventType,
    channel: rule.channel,
    leadTimeMinutes:
      rule.leadTimeMinutes === null ? '' : String(rule.leadTimeMinutes),
    isEnabled: rule.isEnabled,
  };
}

function parseLeadTime(value: string): number | null {
  return value.trim() === '' ? null : Number(value.trim());
}

export function validateRuleForm(
  values: NotificationRuleFormValues,
): NotificationRuleFormErrors {
  const errors: NotificationRuleFormErrors = {};
  const eventType = values.eventType.trim();

  if (!eventType) {
    errors.eventType = 'Vui lòng chọn hoặc nhập sự kiện.';
  } else if (eventType.length > EVENT_TYPE_MAX_LENGTH) {
    errors.eventType = `Mã sự kiện tối đa ${EVENT_TYPE_MAX_LENGTH} ký tự.`;
  }

  if (!NOTIFICATION_CHANNELS.includes(values.channel)) {
    errors.channel = 'Kênh thông báo không hợp lệ.';
  }

  const leadTime = parseLeadTime(values.leadTimeMinutes);

  if (leadTime !== null && (!Number.isInteger(leadTime) || leadTime < 0)) {
    errors.leadTimeMinutes = 'Thời gian báo trước phải là số phút nguyên ≥ 0.';
  }

  return errors;
}

export function listNotificationRules(
  systemPolicyId: string,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ systemPolicyId });

  return apiRequest<NotificationRule[]>(`/api/notification-rules?${query}`, {
    signal,
  });
}

export function createNotificationRule(
  systemPolicyId: string,
  values: NotificationRuleFormValues,
) {
  return apiRequest<NotificationRule>('/api/notification-rules', {
    method: 'POST',
    body: JSON.stringify({
      systemPolicyId,
      eventType: values.eventType.trim(),
      channel: values.channel,
      leadTimeMinutes: parseLeadTime(values.leadTimeMinutes),
      isEnabled: values.isEnabled,
    }),
  });
}

/** Only lead time and the enabled flag can change after creation. */
export function updateNotificationRule(
  id: string,
  values: Pick<NotificationRuleFormValues, 'leadTimeMinutes' | 'isEnabled'>,
) {
  return apiRequest<NotificationRule>(`/api/notification-rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      leadTimeMinutes: parseLeadTime(values.leadTimeMinutes),
      isEnabled: values.isEnabled,
    }),
  });
}

const VALIDATION_FIELD_MESSAGES: Record<string, string> = {
  eventType: `Mã sự kiện phải có từ 1 đến ${EVENT_TYPE_MAX_LENGTH} ký tự.`,
  channel: 'Kênh thông báo không hợp lệ.',
  leadTimeMinutes: 'Thời gian báo trước không được âm.',
};

export function getNotificationRuleErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case ErrorCodes.NOTIFICATION_RULE_ALREADY_EXISTS:
        return 'Đã có quy tắc cho sự kiện và kênh này trong phiên bản chính sách.';
      case ErrorCodes.POLICY_IMMUTABLE:
        return 'Phiên bản đang áp dụng không thể sửa quy tắc. Hãy tạo phiên bản mới.';
      case ErrorCodes.NOTIFICATION_NOT_FOUND:
        return 'Không tìm thấy quy tắc. Dữ liệu có thể đã thay đổi, vui lòng tải lại.';
      case ErrorCodes.POLICY_NOT_FOUND:
        return 'Không tìm thấy phiên bản chính sách. Vui lòng tải lại.';
      case ErrorCodes.INVALID_INPUT: {
        const field = Object.keys(error.errors ?? {}).find(
          (key) => key in VALIDATION_FIELD_MESSAGES,
        );

        return field
          ? VALIDATION_FIELD_MESSAGES[field]
          : 'Thông tin quy tắc không hợp lệ.';
      }
    }

    switch (error.status) {
      case 0:
        return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
      case 401:
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      case 403:
        return 'Bạn không có quyền quản lý quy tắc thông báo.';
      case 429:
        return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
      default:
        if (error.status >= 500)
          return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
    }
  }

  return 'Không thể xử lý quy tắc thông báo. Vui lòng thử lại.';
}
