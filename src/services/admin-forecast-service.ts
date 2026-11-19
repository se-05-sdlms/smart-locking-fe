import { apiRequest, ApiError } from '@/services/api-client';

export type AdminForecast = {
  generatedAt: string;
  horizonDays: number;
  currentOccupiedCompartments: number;
  totalOperationalCompartments: number;
  forecastPeakOccupiedCompartments: number;
  forecastPeakOccupancyPercent: number;
  dailyForecast: Array<{
    date: string;
    forecastIncomingParcels: number;
    forecastPickedUpParcels: number;
    forecastOccupiedCompartments: number;
    forecastOccupancyPercent: number;
    isDemandEventDay: boolean;
  }>;
  atRiskLockers: Array<{
    lockerId: string;
    lockerCode: string;
    currentOccupiedCompartments: number;
    totalOperationalCompartments: number;
    forecastOccupiedCompartments: number;
    forecastOccupancyPercent: number;
    riskLevel: 'normal' | 'high' | 'critical';
    reason: string;
  }>;
};

export async function getAdminForecast(signal?: AbortSignal) {
  return apiRequest<AdminForecast>('/api/Admin/forecast?horizonDays=7', {
    signal,
  });
}

export function getAdminForecastErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'Không thể kết nối đến máy chủ.';
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn.';
    if (error.status === 403) return 'Bạn không có quyền xem dự báo vận hành.';
  }

  return 'Không thể tải dự báo vận hành.';
}
