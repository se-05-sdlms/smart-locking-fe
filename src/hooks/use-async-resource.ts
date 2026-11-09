import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncResource<T> =
  | { status: 'loading'; data?: T }
  | { status: 'error'; message: string; data?: T }
  | { status: 'success'; data: T };

/**
 * Loads data with cancellation, retry and silent refresh.
 * - `reload()` shows the loading state (used by "Thử lại").
 * - `refresh()` keeps the current data on screen while refetching
 *   (used by realtime events and after mutations).
 */
export function useAsyncResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  toErrorMessage: (error: unknown) => string,
  deps: readonly unknown[],
) {
  const [state, setState] = useState<AsyncResource<T>>({ status: 'loading' });
  const [request, setRequest] = useState({ id: 0, silent: false });
  const loadRef = useRef(load);
  const errorRef = useRef(toErrorMessage);

  loadRef.current = load;
  errorRef.current = toErrorMessage;

  useEffect(() => {
    const controller = new AbortController();

    if (!request.silent) {
      setState((current) => ({ status: 'loading', data: current.data }));
    }

    loadRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState((current) => ({
          status: 'error',
          message: errorRef.current(error),
          data: current.data,
        }));
      });

    return () => controller.abort();
  }, [request, ...deps]);

  const reload = useCallback(
    () => setRequest((current) => ({ id: current.id + 1, silent: false })),
    [],
  );
  const refresh = useCallback(
    () => setRequest((current) => ({ id: current.id + 1, silent: true })),
    [],
  );

  return { state, setState, reload, refresh };
}
