import type { HubConnection } from '@microsoft/signalr';

import { HubConnectionBuilder } from '@microsoft/signalr';
import { useEffect, useRef } from 'react';

import { readAuthSession } from '@/auth/auth-storage';
import { getApiUrl } from '@/config/api';

export function useOperationsRealtime(
  lockerIds: string[],
  refresh: () => void,
) {
  const refreshRef = useRef(refresh);
  const lockerKey = [...lockerIds].sort().join(',');

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!lockerKey) return;

    let disposed = false;
    let retryTimer: number | undefined;
    let refreshTimer: number | undefined;
    const connection = new HubConnectionBuilder()
      .withUrl(getApiUrl('/hubs/operations'), {
        accessTokenFactory: () => readAuthSession()?.accessToken ?? '',
      })
      .withAutomaticReconnect([0, 2_000, 10_000, 30_000])
      .build();

    const subscribe = async (activeConnection: HubConnection) => {
      await Promise.allSettled(
        lockerKey
          .split(',')
          .map((lockerId) =>
            activeConnection.invoke('SubscribeLocker', lockerId),
          ),
      );
    };
    const queueRefresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => refreshRef.current(), 100);
    };
    const scheduleStart = () => {
      if (disposed) return;
      if (retryTimer) window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => void start(), 5_000);
    };
    const start = async () => {
      try {
        await connection.start();
        await subscribe(connection);
      } catch {
        await connection.stop();
        scheduleStart();
      }
    };

    connection.on('operationUpdated', queueRefresh);
    connection.onreconnected(() => {
      void subscribe(connection)
        .then(queueRefresh)
        .catch(() => undefined);
    });
    connection.onclose(() => {
      scheduleStart();
    });
    void start();

    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (refreshTimer) window.clearTimeout(refreshTimer);
      connection.off('operationUpdated');
      void connection.stop();
    };
  }, [lockerKey]);
}
