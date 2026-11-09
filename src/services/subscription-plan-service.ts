import { ErrorCodes } from '@/constants/error-codes';
import { ApiError, apiRequest } from '@/services/api-client';

// smart-locking-be `dev`: SubscriptionPlansController (Administrator only)
//   GET  /api/admin/subscription-plans        – all plans, on sale or not
//   POST /api/admin/subscription-plans        – create (code is permanent)
//   PUT  /api/admin/subscription-plans/{id}   – edit / stop or resume selling
// There is no delete: a plan no longer for sale stays for history (#185).
// Changes apply to new purchases; residents keep what they already bought.

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  maxActiveParcels: number;
  isActive: boolean;
};

export type PlanFormValues = {
  code: string;
  name: string;
  description: string;
  /** Kept as strings while editing. */
  price: string;
  durationDays: string;
  maxActiveParcels: string;
  isActive: boolean;
};

export type PlanFormErrors = Partial<
  Record<
    'code' | 'name' | 'price' | 'durationDays' | 'maxActiveParcels',
    string
  >
>;

export type PlanSaleFilter = 'all' | 'active' | 'inactive';

export const PLAN_LIMITS = {
  code: 50,
  name: 200,
  description: 1000,
  maxPrice: 2_147_483_647,
  maxDurationDays: 36_500,
} as const;

const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export const formatPlanPrice = (price: number) => vnd.format(price);

export function formatPlanDuration(days: number) {
  if (days % 365 === 0) return `${days / 365} năm`;
  if (days % 30 === 0) return `${days / 30} tháng`;

  return `${days} ngày`;
}

export function emptyPlanForm(): PlanFormValues {
  return {
    code: '',
    name: '',
    description: '',
    price: '',
    durationDays: '30',
    maxActiveParcels: '',
    isActive: true,
  };
}

export function toPlanFormValues(plan: SubscriptionPlan): PlanFormValues {
  return {
    code: plan.code,
    name: plan.name,
    description: plan.description ?? '',
    price: String(plan.price),
    durationDays: String(plan.durationDays),
    maxActiveParcels: String(plan.maxActiveParcels),
    isActive: plan.isActive,
  };
}

const wholeNumber = (value: string) =>
  /^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN;

/** Mirrors SubscriptionPlanService.Validate so errors show before saving. */
export function validatePlanForm(
  values: PlanFormValues,
  mode: 'create' | 'edit',
): PlanFormErrors {
  const errors: PlanFormErrors = {};
  const code = values.code.trim();
  const name = values.name.trim();
  const price = wholeNumber(values.price);
  const days = wholeNumber(values.durationDays);
  const capacity = wholeNumber(values.maxActiveParcels);

  if (mode === 'create') {
    if (!code) errors.code = 'Vui lòng nhập mã gói.';
    else if (code.length > PLAN_LIMITS.code) {
      errors.code = `Mã gói tối đa ${PLAN_LIMITS.code} ký tự.`;
    }
  }
  if (!name) errors.name = 'Vui lòng nhập tên gói.';
  else if (name.length > PLAN_LIMITS.name) {
    errors.name = `Tên gói tối đa ${PLAN_LIMITS.name} ký tự.`;
  }
  if (Number.isNaN(price) || price > PLAN_LIMITS.maxPrice) {
    errors.price = 'Giá phải là số nguyên VND, không âm.';
  }
  if (Number.isNaN(days) || days <= 0 || days > PLAN_LIMITS.maxDurationDays) {
    errors.durationDays = `Thời hạn từ 1 đến ${PLAN_LIMITS.maxDurationDays} ngày.`;
  }
  if (Number.isNaN(capacity) || capacity <= 0) {
    errors.maxActiveParcels = 'Hạn mức kiện phải là số nguyên lớn hơn 0.';
  }

  return errors;
}

export function filterPlans(plans: SubscriptionPlan[], filter: PlanSaleFilter) {
  if (filter === 'active') return plans.filter((plan) => plan.isActive);
  if (filter === 'inactive') return plans.filter((plan) => !plan.isActive);

  return plans;
}

export function listPlans(signal?: AbortSignal) {
  return apiRequest<SubscriptionPlan[]>('/api/admin/subscription-plans', {
    signal,
  });
}

export function createPlan(values: PlanFormValues) {
  return apiRequest<SubscriptionPlan>('/api/admin/subscription-plans', {
    method: 'POST',
    body: JSON.stringify({
      code: values.code.trim(),
      name: values.name.trim(),
      description: values.description.trim() || null,
      price: wholeNumber(values.price),
      durationDays: wholeNumber(values.durationDays),
      maxActiveParcels: wholeNumber(values.maxActiveParcels),
    }),
  });
}

export function updatePlan(id: string, values: PlanFormValues) {
  return apiRequest<SubscriptionPlan>(
    `/api/admin/subscription-plans/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        name: values.name.trim(),
        description: values.description.trim() || null,
        price: wholeNumber(values.price),
        durationDays: wholeNumber(values.durationDays),
        maxActiveParcels: wholeNumber(values.maxActiveParcels),
        isActive: values.isActive,
      }),
    },
  );
}

/** Stop or resume selling without changing any other field. */
export function setPlanOnSale(plan: SubscriptionPlan, isActive: boolean) {
  return updatePlan(plan.id, { ...toPlanFormValues(plan), isActive });
}

export function getPlanErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case ErrorCodes.SUBSCRIPTION_ALREADY_EXISTS:
        return 'Mã gói đã tồn tại. Vui lòng dùng mã khác.';
      case ErrorCodes.SUBSCRIPTION_NOT_FOUND:
        return 'Không tìm thấy gói. Vui lòng tải lại.';
      case ErrorCodes.INVALID_INPUT:
        return 'Thông tin gói chưa hợp lệ: kiểm tra mã, tên, giá (số nguyên VND), thời hạn và hạn mức kiện.';
    }
    if (error.status === 0)
      return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
    if (error.status === 403)
      return 'Chỉ Quản trị viên được quản lý gói dịch vụ.';
    if (error.status >= 500)
      return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  }

  return 'Không thể xử lý gói dịch vụ. Vui lòng thử lại.';
}
