/**
 * The single HTTP client for the Kwami backend.
 *
 * Before this existed there were 73 raw `fetch()` calls across 15 files, with
 * `API_BASE` copy-pasted 12 times, eleven hand-rolled auth-header helpers and
 * five `parseJson` variants that disagreed about error shapes. Three of the
 * API composables sent no Authorization header at all, and nothing anywhere
 * had a timeout — every request either completed or hung forever.
 *
 * Imports `supabase` directly rather than `useAuthStore`: the auth store will
 * itself use this module, and the client has to work before `app.use(pinia)`.
 */
import { supabase } from '@/lib/supabase';

export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(
  /\/+$/,
  '',
);

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiErrorCode =
  | 'insufficient_credits'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'rate_limited'
  | 'unavailable'
  | 'server'
  | 'timeout'
  | 'aborted'
  | 'network'
  | 'http';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 300;

/** Statuses worth retrying. 500 is excluded: FastAPI wraps handler exceptions
 *  into 500 with `detail=str(e)`, so it is deterministic and retrying only
 *  doubles the load. */
const RETRIABLE_STATUSES = new Set([408, 425, 429, 502, 503, 504]);

function codeForStatus(status: number): ApiErrorCode {
  switch (status) {
    case 401:
      return 'unauthorized';
    case 402:
      return 'insufficient_credits';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 422:
      return 'validation';
    case 429:
      return 'rate_limited';
    case 503:
      return 'unavailable';
    default:
      return status >= 500 ? 'server' : 'http';
  }
}

/**
 * Normalises FastAPI's error bodies. `detail` may be a string, or the
 * array-of-`{msg}` shape that 422 validation errors use — only one of the five
 * original parseJson copies handled the latter, so validation failures
 * elsewhere surfaced as a bare "Request failed: 422".
 */
export function formatApiErrorBody(body: unknown): string {
  if (typeof body === 'string') return body;
  if (!body || typeof body !== 'object') return '';

  const record = body as Record<string, unknown>;
  const detail = record.detail ?? record.message ?? record.error;

  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        item && typeof item === 'object' && 'msg' in item
          ? String((item as { msg: unknown }).msg)
          : String(item),
      )
      .filter(Boolean)
      .join('; ');
  }
  if (detail != null && typeof detail === 'object') return JSON.stringify(detail);
  return '';
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly body: unknown;
  readonly method: HttpMethod;
  readonly url: string;

  constructor(init: {
    message: string;
    status: number;
    code: ApiErrorCode;
    body?: unknown;
    method: HttpMethod;
    url: string;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.body = init.body;
    this.method = init.method;
    this.url = init.url;
  }

  /** The agent connect path checks this instead of string-matching '402'. */
  get isInsufficientCredits(): boolean {
    return this.code === 'insufficient_credits';
  }

  static is(e: unknown): e is ApiError {
    return e instanceof ApiError;
  }
}

/** True for both a caller-cancelled request and our own timeout. */
export function isAbortError(e: unknown): boolean {
  if (ApiError.is(e)) return e.code === 'aborted' || e.code === 'timeout';
  return e instanceof DOMException && e.name === 'AbortError';
}

// ---------------------------------------------------------------------------
// Auth token
// ---------------------------------------------------------------------------

let cachedToken: { token: string; expiresAt: number } | null = null;
let inflightToken: Promise<string | null> | null = null;

/** Refresh a little before real expiry so a request never rides a dead token. */
const TOKEN_SKEW_MS = 60_000;

/**
 * Access token with caching and in-flight de-duplication.
 *
 * Every previous `authHeaders()` awaited `supabase.auth.getSession()`, which
 * also takes a `navigator.locks` lock — one round trip per request, and the
 * memory panel fires three in parallel on open.
 */
export async function getAuthToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_SKEW_MS) {
    return cachedToken.token;
  }
  if (inflightToken) return inflightToken;

  inflightToken = supabase.auth
    .getSession()
    .then(({ data }) => {
      const session = data.session;
      if (!session?.access_token) {
        cachedToken = null;
        return null;
      }
      // Supabase reports expires_at in unix SECONDS.
      const expiresAt = session.expires_at ? session.expires_at * 1000 : Date.now() + 5 * 60_000;
      cachedToken = { token: session.access_token, expiresAt };
      return session.access_token;
    })
    .catch((e: unknown) => {
      console.warn('Failed to read auth session:', e);
      cachedToken = null;
      return null;
    })
    .finally(() => {
      inflightToken = null;
    });

  return inflightToken;
}

export function clearAuthTokenCache(): void {
  cachedToken = null;
}

// Keeps the cache honest across sign-out, refresh and user changes without
// polling.
supabase.auth.onAuthStateChange((_event, session) => {
  cachedToken = session?.access_token
    ? {
        token: session.access_token,
        expiresAt: session.expires_at ? session.expires_at * 1000 : Date.now() + 5 * 60_000,
      }
    : null;
});

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export type QueryValue = string | number | boolean | null | undefined;

export interface ApiRequestOptions {
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  /** Attach the bearer token. Default true. */
  auth?: boolean;
  signal?: AbortSignal;
  /** Per-attempt budget. 0 disables. Default 15s. */
  timeoutMs?: number;
  /** Override the retry count. `false` disables retries entirely. */
  retry?: number | false;
  /** Sets Idempotency-Key, which also makes a POST safe to retry. */
  idempotencyKey?: string;
  parse?: 'json' | 'text' | 'none';
}

/** `AbortSignal.any` is not available in every webview this ships to (Tauri
 *  uses WebKitGTK on Linux), so compose manually. */
function anySignal(signals: AbortSignal[]): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const onAbort = (source: AbortSignal) => () => controller.abort(source.reason);
  const handlers = signals.map((s) => {
    const h = onAbort(s);
    if (s.aborted) controller.abort(s.reason);
    else s.addEventListener('abort', h, { once: true });
    return { s, h };
  });
  return {
    signal: controller.signal,
    cleanup: () => handlers.forEach(({ s, h }) => s.removeEventListener('abort', h)),
  };
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const base = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
}

function isRetriable(method: HttpMethod, status: number | null, hasIdempotencyKey: boolean): boolean {
  // DELETE is deliberately excluded even though the endpoints are idempotent
  // server-side: a retry whose first attempt succeeded 404s on the second and
  // surfaces an error where the operation actually worked.
  const methodIsSafe = method === 'GET' || method === 'PUT';
  if (!methodIsSafe && !hasIdempotencyKey) return false;
  if (status === null) return true; // network error or timeout
  return RETRIABLE_STATUSES.has(status);
}

function retryDelay(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 20_000);
  }
  const ceiling = RETRY_BASE_DELAY_MS * 2 ** attempt;
  return Math.random() * ceiling; // full jitter
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readBody(res: Response, parse: ApiRequestOptions['parse']): Promise<unknown> {
  if (parse === 'none' || res.status === 204) return undefined;
  const text = await res.text().catch(() => '');
  if (!text) return undefined;
  if (parse === 'text') return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    query,
    headers: extraHeaders,
    auth = true,
    signal: callerSignal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retry,
    idempotencyKey,
    parse = 'json',
  } = options;

  const url = buildUrl(path, query);
  const maxAttempts = retry === false ? 1 : (typeof retry === 'number' ? retry : MAX_RETRIES) + 1;

  let didRetryAuth = false;

  for (let attempt = 0; ; attempt++) {
    const timeoutController = new AbortController();
    const timer =
      timeoutMs > 0
        ? setTimeout(() => timeoutController.abort(new DOMException('Timeout', 'TimeoutError')), timeoutMs)
        : null;

    const signals = [timeoutController.signal];
    if (callerSignal) signals.push(callerSignal);
    const { signal, cleanup } = anySignal(signals);

    const headers: Record<string, string> = { ...extraHeaders };
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body !== undefined && !isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    if (auth) {
      const token = await getAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body:
          body === undefined ? undefined : isFormData || typeof body === 'string' ? (body as BodyInit) : JSON.stringify(body),
        signal,
      });
    } catch (e: unknown) {
      cleanup();
      if (timer) clearTimeout(timer);

      // Distinguish our timeout from a caller cancellation: only the latter
      // should be silently ignored by stale-response guards.
      const timedOut = timeoutController.signal.aborted;
      const cancelled = callerSignal?.aborted ?? false;
      if (cancelled) {
        throw new ApiError({ message: 'Request aborted', status: 0, code: 'aborted', method, url });
      }
      if (timedOut) {
        if (attempt + 1 < maxAttempts && isRetriable(method, null, !!idempotencyKey)) {
          await sleep(retryDelay(attempt, null));
          continue;
        }
        throw new ApiError({
          message: `Request timed out after ${timeoutMs}ms`,
          status: 0,
          code: 'timeout',
          method,
          url,
        });
      }
      if (attempt + 1 < maxAttempts && isRetriable(method, null, !!idempotencyKey)) {
        await sleep(retryDelay(attempt, null));
        continue;
      }
      throw new ApiError({
        message: e instanceof Error ? e.message : 'Network request failed',
        status: 0,
        code: 'network',
        body: e,
        method,
        url,
      });
    }

    cleanup();
    if (timer) clearTimeout(timer);

    if (res.ok) return (await readBody(res, parse)) as T;

    // A 401 means the request was rejected before any side effect, so a single
    // replay with a fresh token is safe even for POST.
    if (res.status === 401 && auth && !didRetryAuth) {
      didRetryAuth = true;
      clearAuthTokenCache();
      continue;
    }

    if (attempt + 1 < maxAttempts && isRetriable(method, res.status, !!idempotencyKey)) {
      await sleep(retryDelay(attempt, res.headers.get('Retry-After')));
      continue;
    }

    const errorBody = await readBody(res, 'json');
    throw new ApiError({
      message: formatApiErrorBody(errorBody) || `${method} ${path} failed (${res.status})`,
      status: res.status,
      code: codeForStatus(res.status),
      body: errorBody,
      method,
      url,
    });
  }
}

export const api = {
  request,
  get: <T>(path: string, options?: ApiRequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>('POST', path, body, options),
  put: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>('PUT', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>('PATCH', path, body, options),
  del: <T>(path: string, options?: ApiRequestOptions) =>
    request<T>('DELETE', path, undefined, options),
};

// ---------------------------------------------------------------------------
// Stale-response guarding
// ---------------------------------------------------------------------------

export interface RequestAttempt {
  signal: AbortSignal;
  /** False once a newer attempt for the same key has started. */
  isCurrent: () => boolean;
}

export interface RequestGuard {
  begin(key?: string): RequestAttempt;
  cancel(key?: string): void;
  cancelAll(): void;
}

/**
 * Guards against a stale response overwriting fresher state — switching kwami
 * mid-load, or search-as-you-type.
 *
 * Aborts the previous attempt rather than just ignoring it (frees the socket
 * and stops backend work) but still exposes `isCurrent`, because an abort can
 * land after the body has already resolved.
 */
export function createRequestGuard(): RequestGuard {
  const controllers = new Map<string, AbortController>();
  const counters = new Map<string, number>();

  return {
    begin(key = 'default'): RequestAttempt {
      controllers.get(key)?.abort();
      const controller = new AbortController();
      controllers.set(key, controller);
      const nonce = (counters.get(key) ?? 0) + 1;
      counters.set(key, nonce);
      return {
        signal: controller.signal,
        isCurrent: () => counters.get(key) === nonce,
      };
    },
    cancel(key = 'default') {
      controllers.get(key)?.abort();
      controllers.delete(key);
      counters.set(key, (counters.get(key) ?? 0) + 1);
    },
    cancelAll() {
      controllers.forEach((c) => c.abort());
      controllers.clear();
      counters.forEach((v, k) => counters.set(k, v + 1));
    },
  };
}
