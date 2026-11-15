import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { deferred, failure, installApi, ok } from './apiMock';
import { hostProfile } from './fixtures/profiles';

const user = { accountId: 'splash-host', loginName: 'host', role: 'HOST', hostId: 'host', customerId: null };
const splash = () => screen.queryByText('Đang kiểm tra phiên đăng nhập');
const login = () => screen.queryByRole('heading', { name: 'Đăng nhập tài khoản' });
const dashboard = () => screen.queryByRole('button', { name: /^Xem hồ sơ cá nhân của/ });

async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); });

describe('session bootstrap splash', () => {
  it('starts authentication immediately and keeps a fast success behind the logo for 800ms', async () => {
    const api = installApi(hostProfile);
    render(<App />);
    expect(api.me).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toBe('Đang kiểm tra phiên đăng nhập');
    expect(screen.getByRole('main', { name: 'RentOps' })).toBeTruthy();
    expect(login()).toBeNull();

    await advance(799);
    expect(splash()).toBeTruthy();
    expect(dashboard()).toBeNull();
    expect(api.getProfile).not.toHaveBeenCalled();
    await advance(1);
    expect(splash()).toBeNull();
    expect(dashboard()).toBeTruthy();
    expect(login()).toBeNull();
  });

  it('continues immediately when the session request takes longer than 800ms', async () => {
    const api = installApi(hostProfile);
    const response = deferred<Response>();
    api.me.mockReturnValueOnce(response.promise);
    render(<App />);
    await advance(1200);
    expect(splash()).toBeTruthy();
    await act(async () => response.resolve(ok(user)));
    expect(splash()).toBeNull();
    expect(dashboard()).toBeTruthy();
  });

  it('counts the minimum from appearance rather than adding 800ms to the response', async () => {
    const api = installApi(hostProfile);
    const response = deferred<Response>();
    api.me.mockReturnValueOnce(response.promise);
    render(<App />);
    await advance(500);
    await act(async () => response.resolve(ok(user)));
    await advance(299);
    expect(splash()).toBeTruthy();
    await advance(1);
    expect(dashboard()).toBeTruthy();
  });

  it.each(['/', '/assets?q=Máy&page=0&size=20'])('waits before showing login for an expired session at %s', async (path) => {
    window.history.replaceState(null, '', path);
    const originalUrl = window.location.pathname + window.location.search;
    const api = installApi(hostProfile);
    api.me.mockImplementation(async () => failure(401, 'Expired'));
    render(<App />);
    await advance(799);
    expect(splash()).toBeTruthy();
    expect(login()).toBeNull();
    expect(window.location.pathname + window.location.search).toBe(originalUrl);
    await advance(1);
    expect(splash()).toBeNull();
    expect(login()).toBeTruthy();
    expect(window.location.pathname).toBe('/');
  });

  it('shows connection errors immediately and starts a fresh 800ms minimum on retry', async () => {
    const api = installApi(hostProfile);
    api.me.mockRejectedValueOnce(new TypeError('Offline'));
    render(<App />);
    await advance(0);
    expect(splash()).toBeNull();
    expect(screen.getByRole('button', { name: 'Đăng nhập lại' })).toBeTruthy();
    await advance(300);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(splash()).toBeTruthy();
    await advance(799);
    expect(dashboard()).toBeNull();
    await advance(1);
    expect(dashboard()).toBeTruthy();
    expect(login()).toBeNull();
  });

  it('cancels the pending transition when history opens password recovery', async () => {
    installApi(hostProfile);
    render(<App />);
    await advance(300);
    act(() => {
      window.history.pushState(null, '', '/forgot-password');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await advance(1000);
    expect(splash()).toBeNull();
    expect(dashboard()).toBeNull();
    expect(screen.getByRole('heading', { name: 'Quên mật khẩu' })).toBeTruthy();
    expect(window.location.pathname).toBe('/forgot-password');
  });

  it('cleans up StrictMode timers and requests on unmount', async () => {
    const api = installApi(hostProfile);
    const mounted = render(<StrictMode><App /></StrictMode>);
    await advance(300);
    expect(splash()).toBeTruthy();
    mounted.unmount();
    expect(vi.getTimerCount()).toBe(0);
    const authRequests = api.fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/me'));
    expect(authRequests.length).toBeGreaterThan(0);
    expect(authRequests.every(([, init]) => init?.signal?.aborted)).toBe(true);
    await advance(1000);
    expect(api.getProfile).not.toHaveBeenCalled();
  });

  it('completes the splash once in StrictMode without flashing login', async () => {
    const api = installApi(hostProfile);
    render(<StrictMode><App /></StrictMode>);
    await advance(799);
    expect(splash()).toBeTruthy();
    expect(login()).toBeNull();
    await advance(1);
    expect(dashboard()).toBeTruthy();
    expect(api.getProfile).toHaveBeenCalledOnce();
  });

  it('cancels the old timer when another tab changes accounts during the splash', async () => {
    const api = installApi(hostProfile);
    render(<App />);
    await advance(300);
    const response = deferred<Response>();
    api.me.mockReturnValueOnce(response.promise);
    act(() => window.dispatchEvent(new StorageEvent('storage', {
      key: 'rentops-session-change', newValue: JSON.stringify({ accountId: 'another-host', nonce: 'changed' }),
    })));
    await advance(550);
    expect(splash()).toBeTruthy();
    expect(api.getProfile).not.toHaveBeenCalled();
    await act(async () => response.resolve(ok({ ...user, accountId: 'another-host' })));
    await advance(249);
    expect(splash()).toBeTruthy();
    await advance(1);
    expect(dashboard()).toBeTruthy();
  });

  it('does not delay the separate Google callback and password recovery flows', async () => {
    const api = installApi(hostProfile);
    window.history.replaceState(null, '', '/auth/callback?status=error');
    const mounted = render(<App />);
    expect(splash()).toBeNull();
    expect(login()).toBeTruthy();
    expect(api.me).not.toHaveBeenCalled();
    mounted.unmount();

    window.history.replaceState(null, '', '/forgot-password');
    render(<App />);
    expect(splash()).toBeNull();
    expect(api.me).not.toHaveBeenCalled();
  });
});
