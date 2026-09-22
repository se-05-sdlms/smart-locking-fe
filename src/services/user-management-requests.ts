import {
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_FORBIDDEN_EVENT,
  readAuthSession,
} from '@/auth/auth-storage';
import { ApiError, apiRequest } from '@/services/api-client';

const READ_TTL_MS = 10_000;
// Current backend does not return Retry-After. Its default refill window is 60s.
const RATE_LIMIT_COOLDOWN_MS = 60_000;

type ReadEntry = {
  promise: Promise<unknown>;
  expiresAt: number;
  pending: boolean;
  controller: AbortController;
  consumers: number;
};
const reads = new Map<string, ReadEntry>();
let sessionGeneration = 0;
let blockedUntil = 0;

type SessionIdentity = {
  user: { id: string; role?: string; status?: string };
} | null;
const identityKey = (session: SessionIdentity) =>
  session
    ? `${session.user.id}:${session.user.role}:${session.user.status}`
    : null;
let sessionIdentity =
  typeof window === 'undefined' ? null : identityKey(readAuthSession());

export function invalidateUserManagementReads(userId?: string) {
  if (!userId) {
    reads.clear();

    return;
  }
  reads.delete(`/api/Users/${encodeURIComponent(userId.trim())}`);
  for (const path of reads.keys()) {
    if (path.startsWith('/api/Users?')) reads.delete(path);
  }
}

function resetSessionReads() {
  sessionGeneration += 1;
  for (const entry of reads.values()) entry.controller.abort();
  invalidateUserManagementReads();
}

// Scope cached data to the user's identity/permissions, never to token values.
// Same-user token refresh must not abort the API read that triggered it.
if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_SESSION_CHANGED_EVENT, (event) => {
    const nextIdentity = identityKey(
      (event as CustomEvent<SessionIdentity>).detail ?? null,
    );

    if (nextIdentity !== sessionIdentity) resetSessionReads();
    sessionIdentity = nextIdentity;
  });
  window.addEventListener(AUTH_FORBIDDEN_EVENT, resetSessionReads);
}

export function userManagementRetryAfterMs() {
  return Math.max(0, blockedUntil - Date.now());
}

export async function userManagementRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (userManagementRetryAfterMs()) throw new ApiError(429, '');

  try {
    return await apiRequest<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) {
      blockedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    }
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    )
      resetSessionReads();

    throw error;
  }
}

export async function readUserManagement<T>(
  path: string,
  signal: AbortSignal,
  fresh = false,
): Promise<T> {
  signal.throwIfAborted();
  const generation = sessionGeneration;
  let entry = reads.get(path);

  if (!entry || (!entry.pending && (fresh || entry.expiresAt <= Date.now()))) {
    // Evict expired values to avoid accumulating user data across many searches/pages.
    for (const [key, value] of reads) {
      if (!value.pending && value.expiresAt <= Date.now()) reads.delete(key);
    }
    entry = {
      promise: Promise.resolve(),
      expiresAt: 0,
      pending: true,
      controller: new AbortController(),
      consumers: 0,
    };
    const current = entry;

    // Each caller owns its own cancellation. One StrictMode cleanup must not cancel
    // another consumer's identical read. api-client still bounds the HTTP request.
    current.promise = userManagementRequest<T>(path, {
      signal: current.controller.signal,
    })
      .then((value) => {
        current.pending = false;
        current.expiresAt = Date.now() + READ_TTL_MS;

        return value;
      })
      .catch((error: unknown) => {
        if (reads.get(path) === current) reads.delete(path);

        throw error;
      });
    reads.set(path, current);
  }
  const current = entry;

  current.consumers += 1;
  try {
    const result = await new Promise<unknown>((resolve, reject) => {
      const abort = () => reject(new ApiError(0, ''));

      signal.addEventListener('abort', abort, { once: true });
      current.promise.then(
        (value) => {
          signal.removeEventListener('abort', abort);
          resolve(value);
        },
        (error: unknown) => {
          signal.removeEventListener('abort', abort);
          reject(error);
        },
      );
      if (signal.aborted) abort();
    });

    signal.throwIfAborted();
    if (generation !== sessionGeneration) throw new ApiError(409, '');

    return result as T;
  } finally {
    current.consumers -= 1;
    if (current.pending && current.consumers === 0) {
      current.controller.abort();
      if (reads.get(path) === current) reads.delete(path);
    }
  }
}
