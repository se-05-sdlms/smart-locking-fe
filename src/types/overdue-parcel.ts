// Overdue parcel clearance types. `*Dto` mirror smart-locking-be `dev`
// (Application/DTOs/Parcels/ParcelResponses.cs). Parcel statuses are
// serialized as strings on these endpoints (JsonStringEnumConverter).

export type ParcelListItemDto = {
  id: string;
  parcelCode: string;
  status: string;
  lockerId: string;
  lockerCode: string;
  lockerAddress: string;
  compartmentId: string;
  compartmentCode: string;
  storedAt: string;
  pickupDueAt: string;
  maxStorageUntil: string;
  retrievedAt: string | null;
  removedAt: string | null;
  overdueAmount: number | null;
  currency: string | null;
  overdueChargeStatus: string | null;
};

export type ParcelDetailDto = ParcelListItemDto & {
  lockerRecoveryAddress: string;
  parcelImageUrl: string | null;
  shipperName: string | null;
  shipperPhone: string | null;
};

export type OverdueTransferResponseDto = {
  parcelId: string;
  parcelCode: string;
  collectionAddress: string;
  status: string;
};

export type ParcelStatus =
  | 'Stored'
  | 'Overdue'
  | 'Retrieved'
  | 'Removed'
  | 'Unknown';

export type OverdueChargeStatus = 'Outstanding' | 'Paid' | 'Unknown';

export type OverdueParcel = {
  id: string;
  parcelCode: string;
  status: ParcelStatus;
  lockerId: string;
  lockerCode: string;
  lockerAddress: string;
  compartmentCode: string;
  storedAt: string;
  pickupDueAt: string;
  maxStorageUntil: string;
  overdueAmount: number | null;
  currency: string | null;
  overdueChargeStatus: OverdueChargeStatus | null;
};

export type OverdueParcelDetail = OverdueParcel & {
  recoveryAddress: string;
  parcelImageUrl: string | null;
  shipperName: string | null;
  shipperPhone: string | null;
  removedAt: string | null;
};

export type OverdueTransfer = {
  parcelId: string;
  parcelCode: string;
  collectionAddress: string;
  status: ParcelStatus;
};
