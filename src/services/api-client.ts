import type { AuthSession, AuthTokenResponse } from '@/types/auth';

import { getApiUrl } from '@/config/api';
import {
  clearAuthSession,
  emitForbidden,
  isExpired,
  readAuthSession,
  saveAuthSession,
} from '@/auth/auth-storage';

const ACCESS_TOKEN_REFRESH_LEEWAY_MS = 30_000;
const API_REQUEST_TIMEOUT_MS = 10_000;

type ApiRequestOptions = RequestInit & {
  auth?: boolean;
  retryOnUnauthorized?: boolean;
};

type ErrorPayload = {
  message?: string;
  title?: string;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let refreshPromise: Promise<AuthSession> | null = null;
let refreshSourceToken: string | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorPayload(value: unknown): ErrorPayload {
  if (!isRecord(value)) return {};

  return {
    message: typeof value.message === 'string' ? value.message : undefined,
    title: typeof value.title === 'string' ? value.title : undefined,
  };
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const responseText = await response.text();

  if (!responseText) return undefined;

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return undefined;
  }
}

async function performRequest<T>(
  path: string,
  init: RequestInit,
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  const requestController = new AbortController();
  const sourceSignal = init.signal;
  let didTimeout = false;
  const abortFromSource = () => requestController.abort();
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    requestController.abort();
  }, API_REQUEST_TIMEOUT_MS);

  if (sourceSignal?.aborted) requestController.abort();
  else sourceSignal?.addEventListener('abort', abortFromSource, { once: true });

  headers.set('Accept', 'application/json');

  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  try {
    const response = await fetch(getApiUrl(path), {
      ...init,
      headers,
      signal: requestController.signal,
    });
    const payload = await parseResponseBody(response);

    if (!response.ok) {
      const errorPayload = getErrorPayload(payload);

      throw new ApiError(
        response.status,
        errorPayload.message || errorPayload.title || response.statusText,
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (didTimeout) {
      throw new ApiError(408, 'Yêu cầu đến máy chủ đã hết thời gian chờ.');
    }

    throw new ApiError(0, 'Không thể kết nối đến máy chủ.');
  } finally {
    window.clearTimeout(timeoutId);
    sourceSignal?.removeEventListener('abort', abortFromSource);
  }
}

export async function refreshAuthSession(): Promise<AuthSession> {
  const currentSession = readAuthSession();

  if (!currentSession || isExpired(currentSession.refreshTokenExpiresAt)) {
    clearAuthSession();
    throw new ApiError(401, 'Phiên đăng nhập đã hết hạn.');
  }

  if (refreshPromise && refreshSourceToken === currentSession.refreshToken) {
    return refreshPromise;
  }

  const operation = performRequest<AuthTokenResponse>(
    '/api/auth/refresh-token',
    {
      method: 'POST',
      body: JSON.stringify({ refreshToken: currentSession.refreshToken }),
    },
  )
    .then((response) => {
      if (readAuthSession()?.refreshToken !== currentSession.refreshToken) {
        throw new ApiError(409, 'Phiên đăng nhập đã thay đổi.');
      }

      saveAuthSession(response);

      return response;
    })
    .catch((error: unknown) => {
      const isRejectedRefresh =
        error instanceof ApiError &&
        (error.status === 401 ||
          (error.status === 400 && error.message === 'Invalid refresh token.'));

      if (
        isRejectedRefresh &&
        readAuthSession()?.refreshToken === currentSession.refreshToken
      ) {
        clearAuthSession();
      }

      throw error;
    });

  refreshPromise = operation;
  refreshSourceToken = currentSession.refreshToken;

  try {
    return await operation;
  } finally {
    if (refreshPromise === operation) {
      refreshPromise = null;
      refreshSourceToken = null;
    }
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { auth = true, retryOnUnauthorized = true, ...requestInit } = options;

  if (!auth) return performRequest<T>(path, requestInit);

  let session = readAuthSession();

  if (!session) {
    throw new ApiError(401, 'Bạn chưa đăng nhập.');
  }

  if (isExpired(session.accessTokenExpiresAt, ACCESS_TOKEN_REFRESH_LEEWAY_MS)) {
    session = await refreshAuthSession();
  }

  try {
    return await performRequest<T>(path, requestInit, session.accessToken);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      retryOnUnauthorized
    ) {
      const latestSession = readAuthSession();

      if (!latestSession || latestSession.user.id !== session.user.id) {
        throw error;
      }

      // Another request may already have rotated the tokens while this one
      // was waiting for its 401 response. Reuse that result instead of rotating twice.
      const refreshedSession =
        latestSession.accessToken !== session.accessToken &&
        !isExpired(latestSession.accessTokenExpiresAt)
          ? latestSession
          : await refreshAuthSession();

      try {
        return await performRequest<T>(
          path,
          requestInit,
          refreshedSession.accessToken,
        );
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 403) {
          emitForbidden();
        }

        throw retryError;
      }
    }

    if (error instanceof ApiError && error.status === 403) {
      emitForbidden();
    }

    throw error;
  }
}
