import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { sessionRetryMessage } from '../src/services/sessionClient';
import { hostProfile } from './fixtures/profiles';
import { assetPageReply } from './fixtures/assets';
import { failure, ok } from './apiMock';
import { profileMessages } from '../src/types/profile';

function install(initialAccess = false) {
  let live = initialAccess;
  const user = { accountId: 'restore-host', loginName: 'host@example.com', role: 'HOST', hostId: 'host', customerId: null };
  const me = vi.fn(async (): Promise<Response> => live ? ok(user) : failure(401, 'Access expired'));
  const refresh = vi.fn(async (): Promise<Response> => { live = true; return ok(user); });
  const patch = vi.fn(async (): Promise<Response> => live ? ok({ ...hostProfile, businessName: 'Tên đang nhập' }) : failure(401, 'Access expired'));
  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input), window.location.origin);
    if (url.pathname.endsWith('/auth/me')) return me();
    if (url.pathname.endsWith('/auth/refresh')) return refresh();
    if (url.pathname.endsWith('/auth/csrf')) return ok({ token: 'fresh', headerName: 'X-CSRF-TOKEN' });
    if (url.pathname.endsWith('/profile')) return init.method === 'PATCH' ? patch() : ok(hostProfile);
    if (url.pathname.endsWith('/assets')) return assetPageReply({ q: url.searchParams.get('q') || '', page: 0, size: 20 });
    throw new Error('Unexpected fixture request ' + url.pathname);
  });
  vi.stubGlobal('fetch', fetch);
  return { me, refresh, patch, fetch, expireAccess: () => { live = false; } };
}
beforeEach(() => window.history.replaceState(null, '', '/'));

describe('session recovery in the application', () => {
  it('restores the account and private URL after F5 with expired access', async () => {
    window.history.replaceState(null, '', '/assets?q=Máy&page=0&size=20');
    const originalPath = window.location.pathname + window.location.search;
    const api = install(); render(<App />);
    expect(screen.queryByRole('heading', { name: 'Đăng nhập tài khoản' })).toBeNull();
    await screen.findByRole('table');
    expect(window.location.pathname + window.location.search).toBe(originalPath);
    expect(api.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole('heading', { name: 'Đăng nhập tài khoản' })).toBeNull();
  });
  it('shows a retry screen on bootstrap connection failure, then restores the session', async () => {
    const api = install(); api.me.mockRejectedValueOnce(new TypeError('Offline')); render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    expect(screen.queryByRole('heading', { name: 'Đăng nhập tài khoản' })).toBeNull();
    await screen.findByRole('button', { name: /^Xem hồ sơ cá nhân của/ });
    expect(api.refresh).toHaveBeenCalledOnce();
  });
  it('allows explicit login when a lost rotation cannot be recovered, without automatic logout', async () => {
    const api = install(); api.refresh.mockRejectedValueOnce(new TypeError('Lost response')); render(<App />);
    const manualLogin = await screen.findByRole('button', { name: 'Đăng nhập lại' });
    expect(screen.queryByRole('heading', { name: 'Đăng nhập tài khoản' })).toBeNull();
    fireEvent.click(manualLogin);
    await screen.findByRole('heading', { name: 'Đăng nhập tài khoản' });
    expect(api.refresh).toHaveBeenCalledOnce();
    expect(api.fetch.mock.calls.some(([url]) => String(url).endsWith('/auth/logout'))).toBe(false);
  });
  it('keeps the profile form and draft on a refresh error, then retries without losing input', async () => {
    const api = install(true); render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /^Xem hồ sơ cá nhân của/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
    const name = screen.getByLabelText('Tên đơn vị quản lý *');
    fireEvent.change(name, { target: { value: 'Tên đang nhập' } });
    api.expireAccess(); api.refresh.mockResolvedValueOnce(failure(500, 'Temporarily unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await screen.findByText(sessionRetryMessage);
    expect((name as HTMLInputElement).value).toBe('Tên đang nhập');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(api.patch).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await screen.findByText(profileMessages.success);
    expect(api.refresh).toHaveBeenCalledTimes(2);
    expect(api.patch).toHaveBeenCalledTimes(3); // Two rejected auth checks, one successful write.
  });
  it('returns to login only after refresh confirms expiry, without sending logout', async () => {
    const api = install(true); render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /^Xem hồ sơ cá nhân của/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
    api.expireAccess(); api.refresh.mockResolvedValueOnce(failure(401, 'Refresh expired'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await screen.findByRole('heading', { name: 'Đăng nhập tài khoản' });
    expect(api.refresh).toHaveBeenCalledOnce();
    expect(api.fetch.mock.calls.some(([url]) => String(url).endsWith('/auth/logout'))).toBe(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
