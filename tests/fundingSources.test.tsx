import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { FundingSourcesPage } from '../src/components/funding/FundingSourcesPage';
import { fundingMessages as m, type FundingRoute } from '../src/types/fundingSource';
import { parseFundingRoute, fundingUrl } from '../src/utils/fundingNavigation';
import { rememberSession } from '../src/services/sessionClient';
import { deferred } from './apiMock';
import { fsBank, fsCash, fsFixture, fsHost, fsId, fsLocked, fsReply, fsRoute } from './fixtures/fundingSources';
function setup(mode = 'full', route: FundingRoute = fsRoute, role: 'HOST' | 'CUSTOMER' | 'ADMIN' = 'HOST', fetcher?: typeof fetch) {
  const f = fsFixture({ mode, role }), expired = vi.fn(), denied = vi.fn(), back = vi.fn(), guard = vi.fn();
  window.history.replaceState(null, '', fundingUrl(route, route.action, route.sourceId)); rememberSession(f.user); vi.stubGlobal('fetch', fetcher || f.fetcher);
  function Harness() {
    const [context, update] = useState(route);
    return <FundingSourcesPage user={f.user} route={context} onSessionExpired={expired} onForbidden={denied} onBack={back} registerGuard={guard} onNavigate={(url, replace) => {
      window.history[replace ? 'replaceState' : 'pushState'](null, '', url); update(parseFundingRoute(location.pathname, location.search)!);
    }} />;
  }
  return { ...f, expired, denied, back, guard, ...render(<Harness />) };
}
const table = () => screen.findByRole('table');
const writes = (f: ReturnType<typeof setup>) => f.calls.filter(c => ['POST', 'PATCH'].includes(c.method));
const dialog = () => screen.findByRole('dialog');
it('opens Hosted Link for a supported Bank Hub Sandbox account and waits for verified backend status', async () => {
  const fallback = fsFixture();
  const sessionId = fsId(42);
  let opened = false, verified = false;
  const sent: string[] = [];
  setup('full', fsRoute, 'HOST', async (input, init) => {
    const url = new URL(String(input), location.origin);
    if (!url.pathname.includes('/automatic-payment')) return fallback.fetcher(input, init);
    if (url.pathname.endsWith('/sessions')) {
      sent.push(String(init?.body));
      opened = true;
      return fsReply({ mode: 'SANDBOX', hostedLinkUrl: 'https://sandbox.example.test/link', expiresAt: '2030-01-01T00:00:00Z', sessionId }, 201);
    }
    const selected = url.searchParams.get('accountType') === 'individual';
    return fsReply({ sourceId: fsBank.id, mode: 'SANDBOX', state: verified ? 'HEALTHY' : 'NOT_CONFIGURED',
      enabled: verified, eligibility: selected ? 'SUPPORTED' : 'UNKNOWN', sessionId: opened && !verified ? sessionId : null,
      sessionState: opened && !verified ? 'OPEN' : null, actions: verified ? ['CHECK'] : opened ? ['CANCEL_SESSION'] : selected ? ['SETUP'] : [] });
  });
  const bankRow = (await screen.findAllByRole('row')).find(row => row.textContent?.includes(fsBank.name))!;
  await userEvent.click(within(bankRow).getByRole('button', { name: 'Xác nhận thanh toán tự động' }));
  await screen.findByText('Sandbox');
  await userEvent.selectOptions(screen.getByLabelText('Loại tài khoản'), 'individual');
  await userEvent.click(await screen.findByRole('button', { name: 'Thiết lập xác nhận tự động' }));
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận', exact: true }));
  const link = await screen.findByRole('link', { name: 'Mở Bank Hub trong tab mới' });
  expect(link.getAttribute('target')).toBe('_blank');
  expect(JSON.parse(sent[0])).toEqual({ confirmed: true, accountType: 'individual' });
  expect(screen.queryByText('Kết nối đã xác minh')).toBeNull();
  verified = true;
  fireEvent(window, new Event('focus'));
  await screen.findByText('Kết nối đã xác minh');
  expect(screen.queryByRole('link', { name: 'Mở Bank Hub trong tab mới' })).toBeNull();
});
async function input(label: string, value: string) { const el = screen.getByLabelText(new RegExp(label)); await userEvent.clear(el); if (value) await userEvent.type(el, value); }
async function cashDraft() { await userEvent.click(screen.getByRole('button', { name: 'Thêm nguồn tiền mặt', exact: true })); await dialog(); await input('Tên gợi nhớ', 'Quỹ mới'); }
async function edit(id: string) { const row = (await screen.findAllByRole('row')).find(r => r.textContent?.includes(id === fsLocked.id ? fsLocked.name : fsBank.name))!; await userEvent.click(within(row).getByRole('button', { name: 'Chỉnh sửa' })); await dialog(); await waitFor(() => expect((screen.getByLabelText(/Tên gợi nhớ/) as HTMLInputElement).value).not.toBe('')); }
describe('UC40 list, validation and create flows', () => {
  it('renders both statuses and filter URL without fake balance/pagination', async () => {
    const f = setup(); expect(within(await table()).getAllByRole('row')).toHaveLength(4);
    expect(screen.getByText('001234567890')).toBeTruthy(); expect(screen.getByText('Không áp dụng')).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText('Loại nguồn'), 'BANK');
    await userEvent.selectOptions(screen.getByLabelText('Trạng thái hoạt động'), 'false');
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2));
    expect(location.search).toBe('?type=BANK&active=false'); expect(writes(f)).toHaveLength(0);
  });
  it.each([['empty', 'Chưa có nguồn tiền'], ['read-error', 'Chưa thể tải danh sách']])('shows %s distinctly', async (mode, text) => { setup(mode); await screen.findByRole('heading', { name: text }); expect(screen.queryByRole('table')).toBeNull(); });
  it('distinguishes filter empty; bank directory failure keeps list and CASH available', async () => {
    const f = setup('bank-error'); await table(); await screen.findByText(m.bankFailure);
    await cashDraft(); await userEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true })); await screen.findByText(m.createSuccess);
    expect(writes(f)[0].body).toBe('{"name":"Quỹ mới","type":"CASH"}');
    await userEvent.selectOptions(screen.getByLabelText('Loại nguồn'), 'CASH'); await userEvent.selectOptions(screen.getByLabelText('Trạng thái hoạt động'), 'false');
    await screen.findByText('Không có nguồn tiền phù hợp bộ lọc');
  });
  it('creates BANK with leading zeros, no ownership fields; success refreshes and closes', async () => {
    const f = setup(); await table(); await userEvent.click(screen.getByRole('button', { name: 'Thêm tài khoản ngân hàng', exact: true }));
    await input('Tên gợi nhớ', 'VCB mới'); await userEvent.selectOptions(screen.getByLabelText(/Ngân hàng/), 'VCB');
    await input('Số tài khoản', '000123456789'); await input('Tên chủ tài khoản', 'Nguyễn Thị An');
    expect(screen.getByLabelText(/Số tài khoản/).getAttribute('type')).toBe('text');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true })); await screen.findByText(m.createSuccess);
    expect(JSON.parse(writes(f)[0].body!)).toEqual({ name: 'VCB mới', type: 'BANK', bankDetails: { bankCode: 'VCB', accountNumber: '000123456789', accountHolder: 'Nguyễn Thị An' } });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(location.search).toBe('');
    expect([...Array(localStorage.length)].map((_, i) => localStorage.getItem(localStorage.key(i)!)).join()).not.toContain('000123456789');
  });
  it('validates empty name, account and holder, focuses first invalid field without sending', async () => {
    const f = setup(); await table(); await userEvent.click(screen.getByRole('button', { name: 'Thêm tài khoản ngân hàng', exact: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }));
    await waitFor(() => expect(screen.getByLabelText(/Tên gợi nhớ/).getAttribute('aria-invalid')).toBe('true'));
    expect(document.activeElement).toBe(screen.getByLabelText(/Tên gợi nhớ/)); expect(writes(f)).toHaveLength(0);
  });
  it('keeps focus and every character while correcting errors from an empty submit', async () => {
    const f = setup(); await table(); await userEvent.click(screen.getByRole('button', { name: 'Thêm tài khoản ngân hàng', exact: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true })); await waitFor(() => expect(screen.getByLabelText(/Tên gợi nhớ/).getAttribute('aria-invalid')).toBe('true'));
    await input('Tên gợi nhớ', 'VCB cơ sở mới'); expect(document.activeElement).toBe(screen.getByLabelText(/Tên gợi nhớ/));
    await userEvent.selectOptions(screen.getByLabelText(/Ngân hàng/), 'VCB'); await input('Số tài khoản', '000123456789'); await input('Tên chủ tài khoản', 'Nguyễn Thị An');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true })); await screen.findByText(m.createSuccess);
    expect(JSON.parse(writes(f)[0].body!)).toEqual({ name: 'VCB cơ sở mới', type: 'BANK', bankDetails: { bankCode: 'VCB', accountNumber: '000123456789', accountHolder: 'Nguyễn Thị An' } });
  });
  it.each([['duplicate', 'Tên nguồn tiền đã tồn tại'], ['account-duplicate', 'Tài khoản ngân hàng này đã được khai báo']])('preserves draft on %s business error', async (mode, message) => {
    const f = setup(mode); await table(); await cashDraft(); await userEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }));
    await screen.findAllByText(new RegExp(message)); expect((screen.getByLabelText(/Tên gợi nhớ/) as HTMLInputElement).value).toBe('Quỹ mới'); expect(writes(f)).toHaveLength(1);
  });
  it('cancel discards draft without POST and restores opener', async () => {
    const f = setup(); await table(); await cashDraft(); await userEvent.click(screen.getByRole('button', { name: 'Hủy', exact: true }));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(writes(f)).toHaveLength(0); expect(document.activeElement?.textContent).toBe('Thêm nguồn tiền mặt');
  });
});
describe('UC40 edit, status and concurrency', () => {
  it('fresh detail permits editing BANK and uses exact large version', async () => {
    const f = setup(); await table(); await edit(fsBank.id); await input('Số tài khoản', '000000987654'); await userEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }));
    await screen.findByText(m.updateSuccess); expect(writes(f)[0].body).toContain('"version":9007199254740993');
    expect(JSON.parse(writes(f)[0].body!).bankDetails.accountNumber).toBe('000000987654');
  });
  it('history makes bank fields read-only and omits bankDetails entirely', async () => {
    const f = setup(); await table(); await edit(fsLocked.id); expect(screen.getByText(m.bankLocked)).toBeTruthy();
    expect((screen.getByLabelText(/Số tài khoản/) as HTMLInputElement).readOnly).toBe(true);
    await input('Tên gợi nhớ', 'Tên mới'); await userEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true })); await screen.findByText(m.updateSuccess);
    expect(writes(f)[0].body).toBe('{"name":"Tên mới","version":9007199254740993}');
  });
  it.each(['locked', 'stale'])('%s conflict blocks old draft until explicit review, never auto resends', async mode => {
    const f = setup(mode); await table(); await edit(fsBank.id); await input('Tên gợi nhớ', 'Tên bản nháp');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true })); await screen.findByRole('heading', { name: 'Dữ liệu mới nhất từ hệ thống' });
    expect((screen.getByRole('button', { name: 'Lưu', exact: true }) as HTMLButtonElement).disabled).toBe(true); expect(writes(f)).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Đã xem, dùng dữ liệu mới' }));
    expect((screen.getByLabelText(/Tên gợi nhớ/) as HTMLInputElement).value).toBe(mode === 'locked' ? 'Tên bản nháp' : 'Tên mới từ thiết bị khác');
    expect(writes(f)).toHaveLength(1);
  });
  it.each(['no-rooms', 'one-room', 'many-rooms'])('previews %s; cancel sends no PATCH', async mode => {
    const f = setup(mode, { ...fsRoute, action: 'deactivate', sourceId: fsCash.id });
    await screen.findByRole('heading', { name: /Phòng bị ảnh hưởng/ });
    if (mode !== 'no-rooms') expect(screen.getAllByText('Nguồn mặc định: Tiền mặt').length).toBe(mode === 'one-room' ? 1 : 30);
    await userEvent.click(screen.getByRole('button', { name: 'Hủy', exact: true })); expect(writes(f)).toHaveLength(0);
  });
  it('changed impact invalidates token and requires explicit confirmation with the new pair', async () => {
    const f = setup('impact-changed', { ...fsRoute, action: 'deactivate', sourceId: fsBank.id });
    const confirm = await screen.findByRole('button', { name: 'Xác nhận ngừng hoạt động' });
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false)); await userEvent.click(confirm);
    await screen.findByText(m.impactChanged); await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    expect(writes(f)).toHaveLength(1); await userEvent.click(confirm); await screen.findByText(m.deactivateSuccess);
    expect(writes(f)[1].body).toContain('"confirmationToken":"' + 'b'.repeat(64)); expect(writes(f)[1].body).toContain('"version":9007199254740994');
  });
  it('activation needs agreement and sends explicit target without token', async () => {
    const f = setup('full', { ...fsRoute, action: 'activate', sourceId: fsLocked.id });
    const confirm = await screen.findByRole('button', { name: 'Xác nhận kích hoạt' }); await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    expect(writes(f)).toHaveLength(0); await userEvent.click(confirm); await screen.findByText(m.activateSuccess);
    expect(writes(f)[0].body).toBe('{"active":true,"confirmed":true,"version":9007199254740993}');
  });
  it('double click sends one write', async () => {
    const f = setup('slow-write'); await table(); await cashDraft(); const save = screen.getByRole('button', { name: 'Lưu', exact: true });
    fireEvent.click(save); fireEvent.click(save); await screen.findByText(m.createSuccess); expect(writes(f)).toHaveLength(1);
  });
  it.each(['uncertain', 'bad-response'])('%s write never auto retries; GET verifies data before closing', async mode => {
    const f = setup(mode); await table(); await cashDraft(); await userEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }));
    await screen.findByRole('heading', { name: 'Chưa xác định kết quả thao tác' }); expect(writes(f)).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Kiểm tra kết quả', exact: true })); await screen.findByRole('heading', { name: 'Dữ liệu kiểm tra từ hệ thống' });
    expect(writes(f)).toHaveLength(1); expect(screen.queryByRole('button', { name: 'Lưu', exact: true })).toBeNull();
  });
  it.each(['storage', 'csrf'])('%s preserves draft and does not treat CSRF as role denial', async mode => {
    const f = setup(mode); await table(); await cashDraft(); await userEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }));
    await screen.findByText(mode === 'csrf' ? m.csrf : m.saveFailure); expect(f.denied).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/Tên gợi nhớ/) as HTMLInputElement).value).toBe('Quỹ mới');
  });
  it('separates save success from reload failure', async () => {
    setup('reload-error'); await table(); await cashDraft(); await userEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }));
    await screen.findByText('Đã lưu thành công nhưng danh sách chưa cập nhật. Vui lòng tải lại.'); expect(screen.getByText(m.createSuccess)).toBeTruthy();
  });
  it('404 closes context uniformly and refreshes list', async () => { setup('full', { ...fsRoute, action: 'edit', sourceId: fsId(404) }); await screen.findByText(m.notFound); expect(screen.queryByRole('dialog')).toBeNull(); expect(location.search).toBe(''); });
  it('ignores late detail after switching to a different source', async () => {
    const gate = deferred<Response>(), f = fsFixture();
    const page = setup('full', { ...fsRoute, action: 'edit', sourceId: fsBank.id }, 'HOST', (input, init) => String(input).endsWith('/' + fsBank.id) ? gate.promise : f.fetcher(input, init));
    await dialog(); await userEvent.click(screen.getByRole('button', { name: 'Hủy', exact: true })); await table(); await edit(fsLocked.id);
    await act(async () => { gate.resolve(fsReply(fsBank)); }); expect((screen.getByLabelText(/Tên gợi nhớ/) as HTMLInputElement).value).toBe(fsLocked.name); page.unmount();
  });
});
describe('UC40 App security and navigation', () => {
  it.each(['CUSTOMER', 'ADMIN'] as const)('rejects %s before business data requests', async role => {
    const f = setup('full', fsRoute, role); await screen.findByText(m.forbidden); expect(f.calls).toHaveLength(0);
  });
  it('Host direct route/sidebar, Back/Forward and exiting to overview', async () => {
    const f = fsFixture(); vi.stubGlobal('fetch', f.fetcher); rememberSession(fsHost); window.history.replaceState(null, '', '/funding-sources'); render(<App />);
    await table(); expect(screen.getAllByRole('button', { name: m.title }).some(b => b.getAttribute('aria-current') === 'page')).toBe(true);
    await userEvent.selectOptions(screen.getByLabelText('Loại nguồn'), 'BANK'); await table();
    await act(async () => { history.back(); await new Promise(resolve => setTimeout(resolve, 30)); }); await waitFor(() => expect((screen.getByLabelText('Loại nguồn') as HTMLSelectElement).value).toBe(''));
    await act(async () => { history.forward(); await new Promise(resolve => setTimeout(resolve, 30)); }); await waitFor(() => expect((screen.getByLabelText('Loại nguồn') as HTMLSelectElement).value).toBe('BANK'));
    await userEvent.click(screen.getAllByRole('button', { name: 'Tổng quan', exact: true })[0]); expect(screen.queryByRole('heading', { name: m.title })).toBeNull();
  });
  it('session change clears sensitive modal and blocks old pending CSRF write', async () => {
    const gate = deferred<Response>(), f = fsFixture();
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => String(input).endsWith('/auth/csrf') ? gate.promise : f.fetcher(input, init)); rememberSession(fsHost); window.history.replaceState(null, '', '/funding-sources'); render(<App />);
    await table(); await cashDraft(); await userEvent.click(screen.getByRole('button', { name: 'Lưu', exact: true }));
    await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key: 'rentops-session-change', newValue: JSON.stringify({ accountId: null, nonce: 'logout' }) })); }); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await act(async () => gate.resolve(fsReply({ headerName: 'X-CSRF-TOKEN', token: 'late' }))); expect(writes(f as ReturnType<typeof setup>)).toHaveLength(0);
  });
  it('same-account reauthentication clears draft before reloading current context', async () => {
    setup(); await table(); await cashDraft();
    await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key: 'rentops-session-change', newValue: JSON.stringify({ accountId: fsHost.accountId, nonce: 'new-login' }) })); });
    expect((screen.getByLabelText(/Tên gợi nhớ/) as HTMLInputElement).value).toBe('');
  });
  it('unauthenticated direct entry reaches login without fetching financial data', async () => {
    const calls: string[] = []; vi.stubGlobal('fetch', async (input: RequestInfo | URL) => { calls.push(String(input)); return String(input).endsWith('/auth/csrf') ? fsReply({ headerName: 'X-CSRF-TOKEN', token: 'refresh' }) : fsReply(null, 401, 'SESSION_INVALID'); });
    history.replaceState(null, '', '/funding-sources?action=edit&sourceId=' + fsBank.id); render(<App />);
    await screen.findByText(m.session); expect(screen.queryByRole('table')).toBeNull(); expect(calls.some(c => c.includes('/funding-sources'))).toBe(false);
  });
});
