import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticatedFetch, invalidateSession, rememberSession, sessionRetryMessage } from '../src/services/sessionClient';
import { getCurrentUser, login, logout } from '../src/services/authApi';
import { updateHostProfile } from '../src/services/profileApi';
import { createAsset } from '../src/services/assetsApi';
import { hostProfile } from './fixtures/profiles';
import { deferred, failure, ok } from './apiMock';
import type { AuthenticatedUserResponse } from '../src/types/auth';

const user: AuthenticatedUserResponse = { accountId: 'same-account', loginName: 'host@example.com', role: 'HOST', hostId: 'host', customerId: null };
function server() {
  let accessValid = false;
  const me = vi.fn(async (): Promise<Response> => accessValid ? ok(user) : failure(401, 'Access expired'));
  const refresh = vi.fn(async (): Promise<Response> => { accessValid = true; return ok(user); });
  const business = vi.fn(async (_url: string, _init: RequestInit): Promise<Response> => {
    void _url; void _init;
    return accessValid ? ok('completed') : failure(401, 'Access expired');
  });
  const csrf = vi.fn(async (): Promise<Response> => ok({ token: 'fresh-csrf', headerName: 'X-CSRF-TOKEN' }));
  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = String(input);
    if (url.endsWith('/auth/me')) return me();
    if (url.endsWith('/auth/csrf')) return csrf();
    if (url.endsWith('/auth/refresh')) return refresh();
    if (url.endsWith('/auth/logout')) { accessValid = false; return ok(null); }
    if (url.endsWith('/auth/login')) { accessValid = true; return ok(user); }
    return business(url, init);
  });
  vi.stubGlobal('fetch', fetch);
  rememberSession(user);
  return { fetch, business, me, refresh, csrf, setAccess: (value: boolean) => { accessValid = value; } };
}
beforeEach(() => window.history.replaceState(null, '', '/assets'));

describe('authenticated session transport', () => {
  it('renews expired access with cookies and CSRF, then replays the request once', async () => {
    const api = server();
    const result = await authenticatedFetch('/api/v1/assets');
    expect(result.status).toBe(200);
    expect(api.refresh).toHaveBeenCalledOnce();
    expect(api.business).toHaveBeenCalledTimes(2);
    expect(api.fetch).toHaveBeenCalledWith('/api/v1/auth/refresh', expect.objectContaining({
      method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'X-CSRF-TOKEN': 'fresh-csrf' },
    }));
  });
  it('shares one refresh across simultaneous requests in a tab', async () => {
    const api = server(); const gate = deferred<Response>();
    api.refresh.mockImplementationOnce(() => gate.promise);
    const requests = [authenticatedFetch('/a'), authenticatedFetch('/b'), authenticatedFetch('/c')];
    await vi.waitFor(() => expect(api.refresh).toHaveBeenCalledOnce());
    api.setAccess(true); gate.resolve(ok(user));
    expect((await Promise.all(requests)).map((response) => response.status)).toEqual([200, 200, 200]);
    expect(api.refresh).toHaveBeenCalledOnce();
  });
  it('coordinates separate tab clients with Web Locks and probes inside the lock', async () => {
    const api = server();
    let queue: Promise<unknown> = Promise.resolve();
    const request = vi.fn((_name: string, callback: () => Promise<unknown>) => {
      const result = queue.then(callback); queue = result.catch(() => undefined); return result;
    });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
    vi.resetModules();
    const otherTab = await import('../src/services/sessionClient');
    otherTab.rememberSession(user);
    try {
      const responses = await Promise.all([authenticatedFetch('/tab-one'), otherTab.authenticatedFetch('/tab-two')]);
      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(api.refresh).toHaveBeenCalledOnce();
      expect(request.mock.calls.map(([name]) => name)).toEqual(['rentops-auth-session', 'rentops-auth-session']);
      expect(api.me).toHaveBeenCalledTimes(2);
    } finally { Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }); }
  });
  it('a late stale 401 probes the new cookie instead of rotating again', async () => {
    const api = server(); const late = deferred<Response>();
    api.business.mockImplementationOnce(() => late.promise);
    const waiting = authenticatedFetch('/late');
    await authenticatedFetch('/fast');
    late.resolve(failure(401, 'Old access'));
    expect((await waiting).status).toBe(200);
    expect(api.refresh).toHaveBeenCalledOnce();
  });
  it.each([401, 403])('only confirmed refresh rejection (%s) ends authentication', async (status) => {
    const api = server(); api.refresh.mockImplementation(async () => failure(status, status === 403 ? 'Tài khoản đã bị khóa' : 'Refresh expired'));
    await expect(authenticatedFetch('/protected')).rejects.toMatchObject({ status: 401 });
    expect(api.business).toHaveBeenCalledOnce();
  });
  it.each(['network', 'server', 'csrf', 'csrf-fetch'] as const)('keeps the session retryable on refresh %s failure', async (kind) => {
    const api = server();
    if (kind === 'network') api.refresh.mockRejectedValueOnce(new TypeError('Offline'));
    if (kind === 'server') api.refresh.mockResolvedValueOnce(failure(500, 'Unavailable'));
    if (kind === 'csrf') api.refresh.mockResolvedValueOnce(failure(403, 'CSRF token bị thiếu hoặc không hợp lệ. Vui lòng lấy token mới và thử lại'));
    if (kind === 'csrf-fetch') api.csrf.mockResolvedValueOnce(failure(401, 'Proxy error'));
    await expect(authenticatedFetch('/protected')).rejects.toMatchObject({ status: 503, message: sessionRetryMessage });
    expect(api.business).toHaveBeenCalledOnce();
    expect(api.fetch.mock.calls.some(([url]) => String(url).endsWith('/auth/logout'))).toBe(false);
  });
  it('recovers a lost refresh response by checking me without a second POST', async () => {
    const api = server();
    api.refresh.mockImplementationOnce(async () => { api.setAccess(true); throw new TypeError('Response lost'); });
    expect((await authenticatedFetch('/protected')).status).toBe(200);
    expect(api.me).toHaveBeenCalledTimes(2); expect(api.refresh).toHaveBeenCalledOnce();
  });
  it('does not blindly replay an uncertain rotation even on a later retry', async () => {
    const api = server(); api.refresh.mockRejectedValueOnce(new TypeError('Response lost before cookies arrived'));
    await expect(authenticatedFetch('/first')).rejects.toMatchObject({ status: 503 });
    await expect(authenticatedFetch('/retry')).rejects.toMatchObject({ status: 503 });
    expect(api.refresh).toHaveBeenCalledOnce();
    api.setAccess(true);
    expect((await authenticatedFetch('/retry')).status).toBe(200);
    api.setAccess(false);
    expect((await authenticatedFetch('/next-expiry')).status).toBe(200);
    expect(api.refresh).toHaveBeenCalledTimes(2);
  });
  it('preserves the JSON body and refreshes CSRF for an authenticated write replay', async () => {
    const api = server(); const body = '{"name":"Máy","purchaseValue":9007199254740993}';
    await authenticatedFetch('/write', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'old' }, body });
    expect(api.business.mock.calls.map(([, init]) => init.body)).toEqual([body, body]);
    const replay = api.business.mock.calls[1][1];
    expect(new Headers(replay.headers).get('X-CSRF-TOKEN')).toBe('fresh-csrf');
    expect(api.refresh).toHaveBeenCalledOnce();
  });
  it('preserves the multipart upload and never sets its Content-Type boundary manually', async () => {
    const api = server(); const file = new File(['image bytes'], 'logo.png', { type: 'image/png' });
    api.business.mockImplementation(async () => api.me.mock.calls.length ? ok(hostProfile) : failure(401, 'expired'));
    await updateHostProfile({ ...hostProfile, removeLogo: false }, file);
    const first = api.business.mock.calls[0][1].body as FormData;
    const replay = api.business.mock.calls[1][1];
    expect(replay.body).toBe(first); expect(first.get('logo')).toBe(file);
    expect(new Headers(replay.headers).has('Content-Type')).toBe(false);
  });
  it('never retries a write with an ambiguous network outcome', async () => {
    const api = server(); api.business.mockRejectedValueOnce(new TypeError('Response lost'));
    await expect(authenticatedFetch('/write', { method: 'POST', body: '{}' })).rejects.toThrow('Response lost');
    expect(api.business).toHaveBeenCalledOnce(); expect(api.refresh).not.toHaveBeenCalled();
  });
  it('a temporary refresh failure is a known unexecuted asset write, not an uncertain business result', async () => {
    const api = server(); api.refresh.mockResolvedValueOnce(failure(500, 'Unavailable'));
    await expect(createAsset({ name: 'Keep draft', purchaseValue: '0' })).rejects.toMatchObject({ status: 503, phase: 'write', message: sessionRetryMessage });
    expect(api.business).toHaveBeenCalledOnce();
  });
  it('never loops if the replay still returns 401', async () => {
    const api = server(); api.business.mockImplementation(async () => failure(401, 'Still unauthorized'));
    await expect(authenticatedFetch('/protected')).rejects.toMatchObject({ status: 503 });
    expect(api.refresh).toHaveBeenCalledOnce(); expect(api.business).toHaveBeenCalledTimes(2);
  });
  it.each(['abort', 'navigation', 'session', 'guard'] as const)('does not replay after %s changes during refresh', async (kind) => {
    const api = server(); const gate = deferred<Response>(); const controller = new AbortController(); let active = true;
    api.refresh.mockImplementationOnce(() => gate.promise);
    const result = authenticatedFetch('/write', { method: 'POST', body: '{}', signal: controller.signal }, { shouldSend: () => active });
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(api.refresh).toHaveBeenCalledOnce());
    if (kind === 'abort') controller.abort();
    if (kind === 'navigation') window.history.pushState(null, '', '/other');
    if (kind === 'session') invalidateSession();
    if (kind === 'guard') active = false;
    api.setAccess(true); gate.resolve(ok(user)); await rejected;
    expect(api.business).toHaveBeenCalledOnce();
  });
  it('logout waits for a running refresh response and clears cookies last', async () => {
    const api = server(); const gate = deferred<Response>(); api.refresh.mockImplementationOnce(() => gate.promise);
    const request = authenticatedFetch('/protected'); const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(api.refresh).toHaveBeenCalledOnce());
    const ending = logout();
    expect(api.fetch.mock.calls.some(([url]) => String(url).endsWith('/logout'))).toBe(false);
    gate.resolve(ok(user)); await Promise.all([rejected, ending]);
    expect(String(api.fetch.mock.calls.at(-1)?.[0])).toBe('/api/v1/auth/logout');
    expect(api.business).toHaveBeenCalledOnce();
  });
  it('does not replay a write using another account found in the shared cookie', async () => {
    const api = server(); api.me.mockImplementation(async () => ok({ ...user, accountId: 'another-account' }));
    await expect(authenticatedFetch('/write', { method: 'POST', body: '{}' })).rejects.toMatchObject({ name: 'AbortError' });
    expect(api.refresh).not.toHaveBeenCalled(); expect(api.business).toHaveBeenCalledOnce();
  });
  it('restores me after access expiry while keeping login outside automatic refresh', async () => {
    const api = server(); expect(await getCurrentUser()).toEqual(user); expect(api.refresh).toHaveBeenCalledOnce();
    api.refresh.mockClear(); await login({ loginName: user.loginName, password: 'secret password' });
    expect(api.refresh).not.toHaveBeenCalled();
  });
});
