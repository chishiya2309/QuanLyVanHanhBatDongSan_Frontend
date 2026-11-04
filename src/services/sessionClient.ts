import type { AuthenticatedUserResponse } from '../types/auth';
import { AuthApiError } from './authErrors';
import { clearCsrfCache, getCsrfToken } from './csrfClient';

const base = import.meta.env.VITE_API_URL || '/api/v1';
const lockName = 'rentops-auth-session';
const storageKey = 'rentops-session-change';
const uncertainKey = 'rentops-refresh-uncertain';
// These IDs identify local notifications/attempts, never authentication tokens.
const localId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
let uncertainRotation: string | null = null;
function markRotationUncertain(value: boolean, expected?: string): string | null {
  if (!value && expected && rotationMarker() !== expected) return uncertainRotation;
  uncertainRotation = value ? expected || localId() : null;
  try { if (uncertainRotation) localStorage.setItem(uncertainKey, uncertainRotation); else localStorage.removeItem(uncertainKey); } catch { /* Storage may be disabled. */ }
  return uncertainRotation;
}
function rotationMarker(): string | null {
  try { return localStorage.getItem(uncertainKey) || uncertainRotation; } catch { return uncertainRotation; }
}
export const sessionRetryMessage = 'Chưa thể làm mới phiên đăng nhập. Thông tin đang nhập được giữ lại. Vui lòng thử lại.';
export class SessionRefreshError extends AuthApiError {
  constructor() { super(503, sessionRetryMessage); this.name = 'SessionRefreshError'; }
}
let epoch = 0;
let accountId: string | null = null;
let refreshFlight: { epoch: number; promise: Promise<void> } | null = null;
let localLock: Promise<unknown> = Promise.resolve();
type SessionEvent = { accountId: string | null };
const listeners = new Set<(event: SessionEvent) => void>();
const abort = () => Object.assign(new Error('The request belongs to an earlier page or session'), { name: 'AbortError' });

export function invalidateSession(): void { epoch++; accountId = null; clearCsrfCache(); }
export function sessionGuard(shouldSend = () => true): () => boolean {
  const version = epoch;
  const page = window.location.href;
  return () => version === epoch && page === window.location.href && shouldSend();
}
export async function establishSession(action: () => Promise<AuthenticatedUserResponse>): Promise<AuthenticatedUserResponse> {
  invalidateSession();
  const version = epoch;
  return withSessionLock(async () => {
    if (version !== epoch) throw abort();
    const user = await action();
    if (version !== epoch) throw abort();
    invalidateSession();
    rememberSession(user);
    announceSession(user);
    return user;
  });
}
export function rememberSession(user: AuthenticatedUserResponse): void { accountId = user.accountId; }
export function announceSession(user: AuthenticatedUserResponse | null): void {
  accountId = user?.accountId ?? null;
  markRotationUncertain(false);
  try { localStorage.setItem(storageKey, JSON.stringify({ accountId, nonce: localId() })); } catch { /* Storage may be disabled. */ }
}
export function onSessionChange(listener: (event: SessionEvent) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
window.addEventListener('storage', (event) => {
  if (event.key !== storageKey || !event.newValue) return;
  try {
    const data: unknown = JSON.parse(event.newValue);
    if (!data || typeof data !== 'object' || !('accountId' in data) || (data.accountId !== null && typeof data.accountId !== 'string')) return;
    const previous = accountId;
    invalidateSession();
    markRotationUncertain(false);
    // Re-authentication to the same account still invalidates old requests.
    accountId = data.accountId;
    if (previous !== accountId || accountId === null) listeners.forEach((listener) => listener({ accountId }));
  } catch { /* Ignore unrelated or malformed storage messages. */ }
});

// Login/logout and refresh share the lock: logout must clear cookies after any
// already-running refresh response, and login must not race an old rotation.
export function withSessionLock<T>(action: () => Promise<T>): Promise<T> {
  const run = () => typeof navigator.locks?.request === 'function'
    ? navigator.locks.request(lockName, action) : action();
  const result = localLock.then(run, run);
  localLock = result.catch(() => undefined);
  return result;
}

export function isAuthenticatedUser(value: unknown): value is AuthenticatedUserResponse {
  if (!value || typeof value !== 'object') return false;
  const user = value as Partial<AuthenticatedUserResponse>;
  return typeof user.accountId === 'string' && !!user.accountId && typeof user.loginName === 'string'
    && ['ADMIN', 'HOST', 'CUSTOMER'].includes(user.role ?? '');
}
async function readUser(response: Response): Promise<AuthenticatedUserResponse> {
  const body = await response.json().catch(() => null);
  if (!response.ok || !isAuthenticatedUser(body?.data)) throw new SessionRefreshError();
  return body.data;
}
async function probe(): Promise<Response> {
  return fetch(`${base}/auth/me`, { method: 'GET', credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } });
}
function acceptUser(user: AuthenticatedUserResponse, expectedAccount: string | null): void {
  if (expectedAccount && expectedAccount !== user.accountId) {
    invalidateSession();
    listeners.forEach((listener) => listener({ accountId: user.accountId }));
    throw abort();
  }
  rememberSession(user);
}
function expired(): never {
  // Domain hooks handle this 401 once; other requests stop at their epoch guard.
  invalidateSession();
  announceSession(null);
  throw new AuthApiError(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
}

async function renew(version: number, expectedAccount: string | null): Promise<void> {
  const check = () => { if (version !== epoch) throw abort(); };
  const acceptResponse = async (response: Response) => {
    const user = await readUser(response);
    check();
    acceptUser(user, expectedAccount);
    markRotationUncertain(false);
  };
  try {
    // Also handles a late 401 for an access cookie already replaced by another tab.
    const current = await probe();
    check();
    if (current.ok) { await acceptResponse(current); return; }
    if (current.status !== 401) throw new SessionRefreshError();
    // A previous POST may have committed without delivering its cookies. Probing
    // is safe; replaying that refresh token could revoke the rotated session.
    if (rotationMarker()) throw new SessionRefreshError();
    const csrf = await getCsrfToken().catch(() => { throw new SessionRefreshError(); });
    check();
    let response: Response;
    const rotation = markRotationUncertain(true)!;
    try {
      response = await fetch(`${base}/auth/refresh`, {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { Accept: 'application/json', [csrf.headerName]: csrf.token },
      });
    } catch {
      check();
      markRotationUncertain(true, rotation);
      // The server may have committed rotation even when its response was lost.
      const recovered = await probe();
      check();
      if (recovered.ok) { await acceptResponse(recovered); return; }
      throw new SessionRefreshError();
    }
    check();
    markRotationUncertain(false);
    clearCsrfCache();
    if (response.ok) {
      try { await acceptResponse(response); return; }
      catch (error) { if (!(error instanceof SessionRefreshError)) throw error; }
    }
    if (response.status === 401) expired();
    if (response.status === 403) {
      const body = await response.json().catch(() => null);
      // Only a known account rejection is terminal; CSRF/unknown 403 is retryable.
      if (body?.message === 'Tài khoản đã bị khóa' || body?.message === 'Tài khoản chưa được cấu hình hồ sơ truy cập') expired();
    }
    const recovered = await probe();
    check();
    if (recovered.ok) { await acceptResponse(recovered); return; }
    throw new SessionRefreshError();
  } catch (error) {
    if (error instanceof AuthApiError || (error instanceof Error && error.name === 'AbortError')) {
      if (error instanceof AuthApiError && !(error instanceof SessionRefreshError) && error.status !== 401) throw new SessionRefreshError();
      throw error;
    }
    throw new SessionRefreshError();
  }
}

interface AuthRequestOptions { shouldSend?: () => boolean; trackNavigation?: boolean; }
export async function authenticatedFetch(url: string, init: RequestInit = {}, options: AuthRequestOptions = {}): Promise<Response> {
  const version = epoch;
  const expectedAccount = accountId;
  const startedUncertain = rotationMarker();
  const page = window.location.href;
  const check = () => {
    if (version !== epoch || init.signal?.aborted || options.shouldSend?.() === false || (options.trackNavigation !== false && page !== window.location.href)) throw abort();
  };
  check();
  const response = await fetch(url, { ...init, credentials: 'include' });
  check();
  if (response.status !== 401) {
    // Only requests started after the uncertain rotation may confirm recovery;
    // an old delayed 200 must not clear the marker for a newer rotation.
    if (response.ok && startedUncertain) markRotationUncertain(false, startedUncertain);
    return response;
  }
  if (!refreshFlight || refreshFlight.epoch !== version) {
    const promise = withSessionLock(() => { if (version !== epoch) throw abort(); return renew(version, expectedAccount); });
    refreshFlight = { epoch: version, promise };
    void promise.finally(() => { if (refreshFlight?.promise === promise) refreshFlight = null; }).catch(() => undefined);
  }
  await refreshFlight.promise;
  check();
  // CSRF can change during rotation. Preserve the body (including FormData)
  // while obtaining a fresh header for the single authenticated replay.
  const headers = new Headers(init.headers);
  if (!['GET', 'HEAD', 'OPTIONS'].includes((init.method || 'GET').toUpperCase())) {
    const csrf = await getCsrfToken().catch(() => { throw new SessionRefreshError(); });
    check();
    headers.set(csrf.headerName, csrf.token);
  }
  const retried = await fetch(url, { ...init, headers, credentials: 'include' });
  check();
  if (retried.status === 401) {
    // Never loop or infer refresh expiry from an individual API's 401.
    const current = await probe().catch(() => { throw new SessionRefreshError(); });
    check();
    if (current.ok) {
      const user = await readUser(current);
      check();
      acceptUser(user, expectedAccount);
    }
    throw new SessionRefreshError();
  }
  return retried;
}
