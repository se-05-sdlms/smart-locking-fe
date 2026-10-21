import type { LockerRealtimeEvent } from '@/services/locker-realtime-events';

import { useCallback, useMemo, useRef } from 'react';
import { toast } from '@heroui/react';

import { describeLockerAlert } from '@/services/locker-realtime-events';

/** The same alert repeated within this window is shown once (hub retries, reconnects). */
const DUPLICATE_WINDOW_MS = 10_000;

/**
 * Returns an `onEvent` handler for useOperationsRealtime that turns connection
 * changes and device alerts into toasts, using the locker codes the page
 * already loaded so the message names the locker.
 */
export function useLockerAlerts(
  lockers: ReadonlyArray<{ id: string; code: string }>,
) {
  const codeById = useMemo(
    () => new Map(lockers.map((locker) => [locker.id, locker.code])),
    [lockers],
  );
  const lastShown = useRef(new Map<string, number>());

  return useCallback(
    (event: LockerRealtimeEvent) => {
      const alert = describeLockerAlert(
        event,
        event.lockerId ? codeById.get(event.lockerId) : undefined,
      );

      if (!alert) return;

      const key = `${event.type}:${event.lockerId ?? ''}:${event.status}:${event.entityId ?? ''}`;
      const now = Date.now();
      const previous = lastShown.current.get(key);

      if (previous && now - previous < DUPLICATE_WINDOW_MS) return;
      lastShown.current.set(key, now);

      toast[alert.tone](alert.title, { description: alert.description });
    },
    [codeById],
  );
}
