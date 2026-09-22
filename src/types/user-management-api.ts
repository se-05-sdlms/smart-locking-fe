// UsersController DTOs use numeric domain enums, unlike the auth DTOs.
export type ApiUserRole = 0 | 1 | 2;
export type ApiUserStatus = 0 | 1 | 2;

export type UserListItemDto = {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  email: string | null;
  role: ApiUserRole;
  status: ApiUserStatus;
  activeAssignmentsCount: number;
  createdAt: string;
  lastLoginAt: string | null;
};

export type OperatorAssignmentDto = {
  id: string;
  lockerId: string;
  lockerCode: string | null;
  assignedAt: string;
  revokedAt: string | null;
  reason: string | null;
};

// Only fields consumed by this feature; the backend returns additional profile fields.
export type UserDetailDto = Omit<UserListItemDto, 'activeAssignmentsCount'> & {
  avatarUrl: string | null;
  mustChangePassword: boolean;
  updatedAt: string;
  assignments: OperatorAssignmentDto[];
};

export type UsersPageDto = {
  items: UserListItemDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
};

export type UpdateUserStatusDto = {
  status: 0 | 2;
  reason: string;
};

export type CreateOperatorDto = {
  fullName: string;
  email: string;
  phoneNumber: string;
  role: 2;
  password: null;
  lockerId: string | null;
  assignmentReason: string | null;
};

// Read only the identifier; never retain or expose the returned temporary password.
export type CreatedUserDto = { id: string };

export type AssignOperatorDto = { lockerId: string; reason: string };

// Projection of LockerSummaryResponse. No building or assignment owner is returned.
export type LockerSummaryDto = {
  id: string;
  code: string;
  address: string;
};
