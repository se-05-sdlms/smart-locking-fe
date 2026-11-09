// Emergency unlock types. `*Dto` mirror smart-locking-be `dev`
// (Application/DTOs/Operations/OperationsDtos.cs, numeric enums).

/** `EmergencyUnlockRequest`. */
export type EmergencyUnlockRequestDto = {
  lockerId: string;
  compartmentId: string;
  incidentId: string | null;
  reason: string;
};

/** `EmergencyUnlockResult`: 0 Pending, 1 Succeeded, 2 Failed. */
export type EmergencyUnlockResultDto = 0 | 1 | 2;

/** `EmergencyUnlockResponse`. */
export type EmergencyUnlockResponseDto = {
  id: string;
  result: EmergencyUnlockResultDto;
  compartmentCode: string;
  requestedAt: string;
};

export type EmergencyUnlockResult = 'Pending' | 'Succeeded' | 'Failed';

export type EmergencyUnlock = {
  id: string;
  result: EmergencyUnlockResult;
  compartmentCode: string;
  requestedAt: string;
};

/** Why the backend would refuse to open the compartment right now. */
export type EmergencyUnlockBlocker =
  | 'locker-not-operational'
  | 'locker-not-online'
  | 'compartment-not-operational';
