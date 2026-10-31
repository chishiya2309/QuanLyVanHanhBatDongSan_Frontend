import { StrictMode } from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { HostAccountsPage } from '../src/components/admin/HostAccountsPage';
import { useHostAccounts } from '../src/hooks/useHostAccounts';
import { getHostAccount, listHostAccounts, lockHostAccount, unlockHostAccount } from '../src/services/hostAccountsApi';
import { hostAccountMessages as m, HOST_ACCOUNTS_PATH as path, type HostAccountDetail } from '../src/types/hostAccounts';
import type { AccountRole } from '../src/types/auth';
import { deferred, failure } from './apiMock';

const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const host: HostAccountDetail = { accountId: id, loginEmail: 'host@example.com', businessName: 'Nhà An Bình', status: 'ACTIVE', createdAt: '2026-10-30T18:00:00Z', officeAddress: null, businessPhone: null, businessEmail: 'business@example.com', logoUrl: null };
const reply = (data: unknown, message: string = m.listSuccess) => new Response(JSON.stringify({ status: 200, message, data }));
function install(role: AccountRole = 'ADMIN') {
  const list = vi.fn(async (): Promise<Response> => reply([host]));
  const detail = vi.fn(async (target: string): Promise<Response> => reply({ ...host, accountId: target }, m.detailSuccess));
  const patch = vi.fn(async (action: string): Promise<Response> => reply(null, action === 'lock' ? m.lockSuccess : m.unlockSuccess));
  const me = vi.fn(async (): Promise<Response> => reply({ accountId: 'admin', loginName: 'admin', role, hostId: null, customerId: null }));
  const csrf = vi.fn(async (): Promise<Response> => reply({ token: 'fresh', headerName: 'X-CSRF-TOKEN' }));
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/auth/me')) return me();
    if (url.endsWith('/auth/csrf')) return csrf();
    if (url.endsWith('/admin/host-accounts')) return list();
    if (init?.method === 'PATCH') return patch(url.endsWith('/unlock') ? 'unlock' : 'lock');
    if (url.includes('/admin/host-accounts/')) return detail(url.slice(url.lastIndexOf('/') + 1));
    throw new Error('Unexpected fixture request');
  });
  vi.stubGlobal('fetch', fetch);
  return { list, detail, patch, me, csrf, fetch };
}
beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(() => window.history.replaceState(null, '', '/'));
const callbacks = () => ({ onNavigate: vi.fn(), onSessionExpired: vi.fn(), onForbidden: vi.fn() });

describe('UC07 API boundary', () => {
  it('uses Account UUID, uncached credentialed GET and fresh CSRF for bodyless PATCH', async () => {
    const api = install();
    expect(await listHostAccounts()).toHaveLength(1); await getHostAccount(id);
    await lockHostAccount(id); await unlockHostAccount(id);
    expect(api.csrf).toHaveBeenCalledTimes(2);
    const requests = api.fetch.mock.calls.filter(([url]) => String(url).includes('/admin/'));
    expect(requests.map(([url]) => String(url))).toEqual(['/api/v1' + path, '/api/v1' + path + '/' + id, '/api/v1' + path + '/' + id + '/lock', '/api/v1' + path + '/' + id + '/unlock']);
    for (const [, init] of requests) expect(init).toMatchObject({ cache: 'no-store', credentials: 'include', headers: { Accept: 'application/json' } });
    for (const [, init] of requests.slice(2)) {
      expect(init?.method).toBe('PATCH'); expect(init?.body).toBeUndefined();
      expect(init?.headers).toMatchObject({ 'X-CSRF-TOKEN': 'fresh' });
    }
  });
  it.each([null, {}, { status: 200, message: 'ok' }, { status: 200, message: 'ok', data: [{}] }])('rejects malformed list success %j instead of returning empty', async (body) => {
    const api = install(); api.list.mockResolvedValueOnce(new Response(JSON.stringify(body)));
    await expect(listHostAccounts()).rejects.toMatchObject({ message: m.listFailure });
  });
  it('preserves null profiles and backend order; rejects mismatched detail identity and malformed mutations', async () => {
    const api = install(); api.list.mockResolvedValueOnce(reply([{ ...host, businessName: null }, { ...host, accountId: otherId }]));
    expect((await listHostAccounts()).map((value) => value.accountId)).toEqual([id, otherId]);
    api.detail.mockResolvedValueOnce(reply({ ...host, accountId: otherId }, m.detailSuccess));
    await expect(getHostAccount(id)).rejects.toMatchObject({ message: m.detailFailure });
    api.patch.mockResolvedValueOnce(reply({ status: 'LOCKED' }, m.lockSuccess));
    await expect(lockHostAccount(id)).rejects.toMatchObject({ message: m.lockFailure });
  });
  it('rejects invalid UUID before GET, CSRF or PATCH', async () => {
    const api = install();
    await expect(getHostAccount('not-a-uuid')).rejects.toMatchObject({ message: m.invalidData });
    await expect(lockHostAccount('not-a-uuid')).rejects.toMatchObject({ message: m.invalidData });
    expect(api.fetch).not.toHaveBeenCalled();
  });
  it.each([[401, 'secret', m.sessionInvalid], [403, 'secret', m.forbidden], [403, m.csrfInvalid, m.csrfInvalid], [404, 'secret', m.notFound], [400, m.wrongRole, m.wrongRole], [400, 'stack trace', m.invalidData], [409, m.profileMissing, m.profileMissing], [409, m.alreadyLocked, m.alreadyLocked], [409, m.alreadyActive, m.alreadyActive], [500, 'secret', m.lockFailure]])('maps %s %s to safe message', async (status, message, expected) => {
    const api = install(); api.patch.mockResolvedValueOnce(failure(Number(status), String(message)));
    await expect(lockHostAccount(id)).rejects.toMatchObject({ message: expected });
    expect(api.patch).toHaveBeenCalledTimes(1);
  });
  it('maps failed CSRF without misclassifying Admin permission or sending PATCH', async () => {
    const api = install(); api.csrf.mockResolvedValueOnce(failure(403, 'csrf unavailable'));
    await expect(lockHostAccount(id)).rejects.toMatchObject({ message: m.csrfInvalid }); expect(api.patch).not.toHaveBeenCalled();
  });
});

describe('UC07 concurrent controller', () => {
  it('preflights before confirmation; cancellation never patches; current status conflict refreshes', async () => {
    const api = install(); const { result } = renderHook(() => useHostAccounts(null, callbacks()));
    await waitFor(() => expect(result.current.canMutate).toBe(true));
    await act(() => result.current.prepare(id, 'lock', null));
    expect(api.detail).toHaveBeenCalledTimes(1); expect(result.current.confirmation?.account.accountId).toBe(id);
    act(() => result.current.cancel()); expect(api.patch).not.toHaveBeenCalled();
    api.detail.mockResolvedValueOnce(reply({ ...host, status: 'LOCKED' }, m.detailSuccess));
    await act(() => result.current.prepare(id, 'lock', null));
    expect(result.current.confirmation).toBeNull(); expect(result.current.notice?.message).toBe(m.alreadyLocked);
    expect(api.list).toHaveBeenCalledTimes(2);
  });
  it('locks synchronous double confirmation and keeps success when refresh fails, blocking until retry', async () => {
    const api = install(); const gate = deferred<Response>(); api.patch.mockImplementationOnce(() => gate.promise);
    const { result } = renderHook(() => useHostAccounts(id, callbacks()));
    await waitFor(() => expect(result.current.canMutate).toBe(true));
    await act(() => result.current.prepare(id, 'lock', null));
    act(() => { void result.current.confirm(); void result.current.confirm(); result.current.cancel(); });
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1)); expect(result.current.confirmation).not.toBeNull();
    api.list.mockResolvedValueOnce(failure(500, 'offline'));
    await act(async () => { gate.resolve(reply(null, m.lockSuccess)); await gate.promise; });
    await waitFor(() => expect(result.current.isMutating).toBe(false));
    expect(result.current.notice).toEqual({ kind: 'success', message: m.lockSuccess });
    expect(result.current.list.error).toBe(m.listFailure); expect(result.current.canMutate).toBe(false);
    await act(() => result.current.retry()); expect(result.current.canMutate).toBe(true);
  });
  it.each([[401, m.sessionInvalid], [403, m.forbidden]])('purges data on %s and invalidates late results', async (status, message) => {
    const api = install(); const cb = callbacks(); const { result } = renderHook(() => useHostAccounts(null, cb));
    await waitFor(() => expect(result.current.canMutate).toBe(true));
    await act(() => result.current.prepare(id, 'lock', null)); api.patch.mockResolvedValueOnce(failure(Number(status), String(message)));
    await act(() => result.current.confirm());
    expect(result.current.list.data).toBeNull(); expect(result.current.confirmation).toBeNull();
    expect(status === 401 ? cb.onSessionExpired : cb.onForbidden).toHaveBeenCalledOnce();
    await act(() => result.current.refresh()); expect(api.list).toHaveBeenCalledTimes(1);
  });
  it.each([[403, m.csrfInvalid], [409, m.alreadyLocked], [500, m.lockFailure], [0, m.lockFailure]])('closes failed mutation %s, refreshes and requires a new action', async (status, message) => {
    const api = install(); const cb = callbacks(); const { result } = renderHook(() => useHostAccounts(null, cb));
    await waitFor(() => expect(result.current.canMutate).toBe(true)); await act(() => result.current.prepare(id, 'lock', null));
    if (status) api.patch.mockResolvedValueOnce(failure(Number(status), String(message))); else api.patch.mockRejectedValueOnce(new TypeError('offline'));
    await act(() => result.current.confirm());
    expect(result.current.notice?.message).toBe(message); expect(result.current.confirmation).toBeNull();
    expect(api.list).toHaveBeenCalledTimes(2); expect(api.patch).toHaveBeenCalledTimes(1); expect(cb.onForbidden).not.toHaveBeenCalled();
  });
  it.each([[404, m.notFound], [400, m.wrongRole], [409, m.profileMissing]])('stops target operation on %s and returns to refreshed list', async (status, message) => {
    const api = install(); const cb = callbacks(); const { result } = renderHook(() => useHostAccounts(null, cb));
    await waitFor(() => expect(result.current.canMutate).toBe(true)); api.detail.mockResolvedValueOnce(failure(Number(status), String(message)));
    await act(() => result.current.prepare(id, 'lock', null));
    expect(result.current.notice?.message).toBe(message); expect(cb.onNavigate).toHaveBeenCalledWith(null);
    expect(api.patch).not.toHaveBeenCalled(); expect(api.list).toHaveBeenCalledTimes(2);
  });
  it('ignores old detail/preflight results when changing route and after unmount', async () => {
    const api = install(); const gate = deferred<Response>(); api.detail.mockImplementationOnce(() => gate.promise);
    const { result, rerender, unmount } = renderHook(({ target }) => useHostAccounts(target, callbacks()), { initialProps: { target: id } });
    await waitFor(() => expect(api.detail).toHaveBeenCalledTimes(1)); rerender({ target: otherId });
    await waitFor(() => expect(result.current.detail.data?.accountId).toBe(otherId));
    await act(async () => gate.resolve(reply(host, m.detailSuccess))); expect(result.current.detail.data?.accountId).toBe(otherId);
    const preflight = deferred<Response>(); api.detail.mockImplementationOnce(() => preflight.promise);
    act(() => { void result.current.prepare(otherId, 'lock', null); }); unmount();
    await act(async () => preflight.resolve(reply({ ...host, accountId: otherId }, m.detailSuccess))); expect(api.patch).not.toHaveBeenCalled();
  });
});

describe('UC07 screens and routing', () => {
  it.each(['HOST', 'CUSTOMER'] as const)('denies direct access for %s without admin fetch', async (role) => {
    const api = install(role); window.history.replaceState(null, '', path + '/' + id); render(<App />);
    await screen.findByText(m.forbidden); expect(api.list).not.toHaveBeenCalled(); expect(api.detail).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Tài khoản Host' })).toBeNull();
  });
  it('waits for auth, supports direct detail and popstate without refetching auth or clearing session', async () => {
    const api = install(); const gate = deferred<Response>(); api.me.mockImplementationOnce(() => gate.promise);
    window.history.replaceState(null, '', path + '/' + id); render(<App />);
    expect(screen.getByText('Đang kiểm tra phiên đăng nhập')).toBeTruthy(); expect(api.detail).not.toHaveBeenCalled();
    await act(async () => gate.resolve(reply({ accountId: 'admin', loginName: 'admin', role: 'ADMIN' })));
    await screen.findByText('Email kinh doanh'); expect(screen.queryByText('Chào buổi sáng, admin')).toBeNull();
    expect(screen.queryByLabelText('Chọn tòa nhà cơ sở')).toBeNull();
    act(() => { window.history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')); });
    await screen.findByRole('table'); expect(api.me).toHaveBeenCalledTimes(1); expect(api.list).toHaveBeenCalledTimes(1);
  });
  it('shows auth error and manual retry without fetching Admin data before session is determined', async () => {
    const api = install(); api.me.mockRejectedValueOnce(new TypeError('offline')); window.history.replaceState(null, '', path); render(<App />);
    await screen.findByText(m.listFailure); expect(api.list).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByRole('table');
  });
  it('renders empty/error/full separately and preserves nullable rows', async () => {
    const api = install(); api.list.mockResolvedValueOnce(failure(500, 'secret'));
    render(<HostAccountsPage accountId={null} {...callbacks()} />); await screen.findByText(m.listFailure);
    expect(screen.queryByText(m.empty)).toBeNull(); api.list.mockResolvedValueOnce(reply([]));
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await screen.findByText(m.empty);
    api.list.mockResolvedValueOnce(reply([{ ...host, businessName: null }])); fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    const table = await screen.findByRole('table'); expect(within(table).getByText('Chưa xác định hồ sơ')).toBeTruthy();
    expect(table.textContent).toContain(id); expect(table.querySelector('time')?.dateTime).toBe(host.createdAt);
  });
  it('dialog focuses cancel, traps focus, restores opener and cancels without PATCH', async () => {
    const api = install(); render(<StrictMode><HostAccountsPage accountId={id} {...callbacks()} /></StrictMode>);
    const opener = await screen.findByRole('button', { name: 'Khóa tài khoản' }); opener.focus(); fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog'); const cancel = within(dialog).getByRole('button', { name: 'Hủy' });
    expect(document.activeElement).toBe(cancel); fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Xác nhận' }));
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(dialog, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull(); expect(api.patch).not.toHaveBeenCalled(); expect(document.activeElement).toBe(opener);
  });
  it('shows separate emails, optional fallbacks and broken logo initials', async () => {
    const api = install(); api.detail.mockResolvedValueOnce(reply({ ...host, logoUrl: 'https://example.test/logo' }, m.detailSuccess));
    render(<HostAccountsPage accountId={id} {...callbacks()} />); await screen.findByText('Email kinh doanh');
    expect(screen.getByText('business@example.com')).toBeTruthy(); expect(screen.getByText(host.loginEmail)).toBeTruthy(); expect(screen.getAllByText('Chưa cập nhật')).toHaveLength(2);
    fireEvent.error(document.querySelector('.host-detail img')!); expect(document.querySelector('.host-detail img')).toBeNull();
  });
  it('401 returns to login with exact notice and never calls logout', async () => {
    const api = install(); api.list.mockResolvedValueOnce(failure(401, 'guest')); window.history.replaceState(null, '', path); render(<App />);
    await screen.findByText(m.sessionInvalid); expect(window.location.pathname).toBe('/');
    expect(api.fetch.mock.calls.some(([url]) => String(url).includes('/logout'))).toBe(false);
  });
  it('discards cached records and removes entry points when permission is revoked during reload', async () => {
    const api = install(); window.history.replaceState(null, '', path); render(<App />);
    await screen.findByRole('table'); api.list.mockResolvedValueOnce(failure(403, m.forbidden));
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' })); await screen.findByText(m.forbidden);
    expect(screen.queryByRole('table')).toBeNull(); expect(screen.queryByText(host.loginEmail)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tài khoản Host' })).toBeNull();
  });
  it('restores the session when Back/Forward returns from public recovery to a private URL', async () => {
    const api = install(); window.history.replaceState(null, '', '/forgot-password'); render(<App />);
    expect(api.me).not.toHaveBeenCalled();
    act(() => { window.history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')); });
    await screen.findByRole('table'); expect(api.me).toHaveBeenCalledTimes(1);
  });
  it('accepts uppercase Account UUID URLs without hiding valid lowercase detail data', async () => {
    const uppercase = 'ABCDEFAB-ABCD-4ABC-8ABC-ABCDEFABCDEF'; const api = install();
    api.detail.mockResolvedValueOnce(reply({ ...host, accountId: uppercase.toLowerCase() }, m.detailSuccess));
    render(<HostAccountsPage accountId={uppercase} {...callbacks()} />);
    await screen.findByText('Email kinh doanh'); expect(screen.getByText(uppercase.toLowerCase())).toBeTruthy();
  });
});
