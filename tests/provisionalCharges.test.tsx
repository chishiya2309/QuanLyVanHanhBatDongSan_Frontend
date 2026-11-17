import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { ProvisionalChargesPage } from '../src/components/provisional/ProvisionalChargesPage';
import { parseProvisionalRoute, provisionalUrl } from '../src/utils/provisionalChargeNavigation';
import { invalidateSession, rememberSession } from '../src/services/sessionClient';
import type { ProvisionalRoute } from '../src/types/provisionalCharge';
import { pcCustomer, pcDetail, pcFixture, pcHeader, pcHeaders, pcHost, pcId, pcNextToken, pcOtherHeader, pcReply, pcRoute, pcToken } from './fixtures/provisionalCharges';

function setup(mode = 'full', route: ProvisionalRoute = pcRoute, role: 'HOST' | 'CUSTOMER' | 'ADMIN' = route.role, fetcher?: typeof fetch) {
  const f = pcFixture({ mode, role }), user = f.user, expired = vi.fn(), back = vi.fn();
  window.history.replaceState(null, '', provisionalUrl(route)); rememberSession(user);
  vi.stubGlobal('fetch', fetcher || f.fetcher);
  function Harness() {
    const [context, setContext] = useState(route);
    return <ProvisionalChargesPage user={user} route={context} onNavigate={url => {
      window.history.pushState(null, '', url); setContext(parseProvisionalRoute(location.pathname, location.search)!);
    }} onSessionExpired={expired} onBack={back} />;
  }
  return { ...f, expired, back, ...render(<Harness />) };
}
const total = () => screen.findByTestId('provisional-total');
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

describe('UC39 main flow, summary states and independent Customer scope', () => {
  it('Host selects room then ascending period; no automatic selection or money', async () => {
    const f = setup('full', { ...pcRoute, roomId: '', periodId: '' });
    await screen.findByText('Chọn phòng và kỳ để xem tạm tính');
    expect(screen.queryByTestId('provisional-total')).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Phòng'), pcRoute.roomId);
    await waitFor(() => expect((screen.getByLabelText('Kỳ / phần kỳ') as HTMLSelectElement).disabled).toBe(false));
    const options = within(screen.getByLabelText('Kỳ / phần kỳ')).getAllByRole('option');
    expect(options.map(o => o.getAttribute('value'))).toEqual(['', pcId(2), pcId(1)]);
    await userEvent.selectOptions(screen.getByLabelText('Kỳ / phần kỳ'), pcRoute.periodId);
    expect((await total()).textContent).toContain('580.432');
    expect(f.calls.every(c => c.method === 'GET')).toBe(true);
    expect(screen.queryByText('Lưu')).toBeNull();
  });
  it('Customer uses customer endpoints and sees old open periods plus simultaneous rooms with duplicate codes', async () => {
    const f = setup('full', { ...pcRoute, role: 'CUSTOMER', roomId: '', periodId: '' });
    await screen.findByText('Chọn phòng và kỳ để xem tạm tính');
    const rooms = within(screen.getByLabelText('Phòng')).getAllByRole('option');
    expect(rooms.map(o => o.textContent)).toEqual(['Chọn phòng', '101, Tòa A', '101, Tòa B']);
    await userEvent.selectOptions(screen.getByLabelText('Phòng'), pcRoute.roomId);
    await waitFor(() => expect((screen.getByLabelText('Kỳ / phần kỳ') as HTMLSelectElement).disabled).toBe(false));
    await userEvent.selectOptions(screen.getByLabelText('Kỳ / phần kỳ'), pcId(2)); await total();
    expect(f.calls.every(c => c.path.includes('/provisional-charges/customer/'))).toBe(true);
  });
  it.each(['HOST', 'CUSTOMER', 'ADMIN'] as const)('wrong-role route rejects %s before any business fetch', async role => {
    const f = setup('full', { ...pcRoute, role: role === 'CUSTOMER' ? 'HOST' : 'CUSTOMER' }, role);
    await screen.findByText('Không có quyền truy cập'); expect(f.calls).toHaveLength(0);
  });
  it('shows zero calculated separately from missing data, negative total and complete reasons', async () => {
    setup('partial'); expect((await total()).textContent).toContain('-20.000');
    const rows = screen.getAllByRole('row');
    const zero = rows.find(r => r.textContent?.includes('Nước đóng bình'))!;
    expect(zero.textContent).toContain('0'); expect(zero.textContent).toContain('Đã tính');
    const missing = rows.find(r => r.textContent?.includes('Điện'))!;
    expect(missing.textContent).toContain('Chưa tính được'); expect(missing.textContent).toContain('Thiếu chỉ số cuối và đơn giá lịch sử');
    expect(screen.getByRole('heading', { name: 'Tổng một phần' })).toBeTruthy();
    expect(screen.getByText('Tổng một phần, chưa bao gồm các khoản chưa tính được.')).toBeTruthy();
  });
  it('INSUFFICIENT_DATA keeps a null total instead of a fake zero', async () => {
    setup('insufficient'); expect((await total()).textContent).toBe('Chưa đủ dữ liệu để tạm tính');
    expect(screen.getByText('Thiếu dữ liệu')).toBeTruthy();
  });
  it('EMPTY differs from missing items and shows its valid zero total', async () => {
    setup('empty'); expect((await total()).textContent).toContain('0');
    expect(screen.getByText('Không có khoản dịch vụ/phí trong kỳ đã chọn')).toBeTruthy();
    expect(screen.queryByText('Thiếu dữ liệu')).toBeNull(); expect(screen.queryByRole('table')).toBeNull();
  });
  it.each([['no-tenancy', 'Không có lượt thuê đang diễn ra để xem tạm tính'], ['no-periods', 'Không có kỳ tạm tính phù hợp']])('distinguishes %s list result', async (mode, label) => {
    setup(mode, { ...pcRoute, roomId: '', periodId: '' }); await screen.findByText(label);
    expect(screen.queryByTestId('provisional-total')).toBeNull();
  });
  it('renders exact large VND and decimal values, with keyboard-accessible basis disclosure', async () => {
    setup('long'); await total();
    expect(screen.getAllByText(/9\.007\.199\.254\.740\.993/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('120,123456789012345678901').length).toBeGreaterThan(0);
    const summary = screen.getAllByText('Xem căn cứ tính', { exact: false, selector: 'summary' })[0];
    fireEvent.click(summary); expect(summary.parentElement?.hasAttribute('open')).toBe(true);
  });
  it('switching room removes period, token and all old totals before loading', async () => {
    const f = setup(); await total();
    await userEvent.selectOptions(screen.getByLabelText('Phòng'), pcOtherHeader.roomId);
    expect(screen.queryByTestId('provisional-total')).toBeNull();
    await screen.findByText('Chọn phòng và kỳ để xem tạm tính');
    expect(new URLSearchParams(location.search).has('periodId')).toBe(false);
    expect((screen.getByLabelText('Kỳ / phần kỳ') as HTMLSelectElement).value).toBe('');
    expect(f.calls.filter(c => !c.path.endsWith('/periods'))).toHaveLength(1);
  });
  it('invalid UUID sends no detail request and focuses selection; complete absent-list deep link reaches server', async () => {
    const f = setup('full', { ...pcRoute, roomId: 'bad', invalid: true });
    await screen.findByText('Vui lòng chọn đầy đủ phòng và kỳ cần xem tạm tính.');
    expect(document.activeElement).toBe(screen.getByLabelText('Phòng'));
    expect(f.calls.every(c => c.path.endsWith('/periods'))).toBe(true);
    f.unmount();
    const absent = setup('no-periods', { ...pcRoute, periodId: pcId(499) });
    await screen.findByText('Không tìm thấy dữ liệu trong phạm vi được phép của bạn.');
    expect(absent.calls.some(c => c.path.endsWith('/' + pcId(499)))).toBe(true);
    expect(screen.queryByText('Không có kỳ tạm tính phù hợp')).toBeNull();
  });
});

describe('UC39 conditional reload, revocation, races and stale recovery', () => {
  it('304 keeps same data, no body parse; 200 replaces old token and all data atomically', async () => {
    let changed = false;
    const f = pcFixture();
    setup('full', pcRoute, 'HOST', async (url, init) => {
      if (String(url).endsWith('/' + pcRoute.periodId) && changed) {
        const d = pcDetail(pcHeader, 'partial'); return pcReply({ ...d, concurrencyToken: pcNextToken }, 200, undefined, '"' + pcNextToken + '"');
      }
      return f.fetcher(url, init);
    });
    const original = (await total()).textContent;
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại', exact: true }));
    await waitFor(() => expect(screen.queryByText('Chưa cập nhật')).toBeNull());
    expect((await total()).textContent).toBe(original); expect(f.calls.at(-1)?.etag).toBe('"' + pcToken + '"');
    changed = true; await userEvent.click(screen.getByRole('button', { name: 'Tải lại', exact: true }));
    await screen.findByRole('heading', { name: 'Tổng một phần' }); expect((await total()).textContent).toContain('-20.000');
  });
  it('304 without a snapshot recovers exactly once without a token', async () => {
    let details = 0; const tags: (string | null)[] = [];
    setup('full', pcRoute, 'HOST', async (url, init) => {
      if (String(url).endsWith('/periods')) return pcReply(pcHeaders);
      details++; tags.push(new Headers(init?.headers).get('If-None-Match'));
      return details === 1 ? pcReply(null, 304) : pcReply(pcDetail());
    });
    await total(); expect(details).toBe(2); expect(tags).toEqual([null, null]);
  });
  it('repeated 304 without data terminates recovery and displays initial error', async () => {
    let reads = 0; setup('full', pcRoute, 'HOST', async url => {
      if (String(url).endsWith('/periods')) return pcReply(pcHeaders);
      reads++; return pcReply(null, 304);
    });
    await screen.findByText('Không thể tải dữ liệu tạm tính. Vui lòng thử lại sau.');
    expect(reads).toBe(2); expect(screen.queryByTestId('provisional-total')).toBeNull();
  });
  it.each(['stale', 'concurrent'])('keeps only the same-key snapshot marked stale on %s', async mode => {
    setup(mode); const original = (await total()).textContent;
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại', exact: true }));
    await screen.findByRole('button', { name: 'Thử tải lại' });
    expect((await total()).textContent).toBe(original); expect(screen.getAllByText('Chưa cập nhật').length).toBeGreaterThan(0);
    await userEvent.selectOptions(screen.getByLabelText('Phòng'), pcOtherHeader.roomId);
    expect(screen.queryByTestId('provisional-total')).toBeNull(); expect(screen.queryByText('Chưa cập nhật')).toBeNull();
  });
  it('malformed same-context reload can keep stale, but mismatched response must redact it', async () => {
    let mode = 'ok'; const f = pcFixture();
    setup('full', pcRoute, 'HOST', async (url, init) => {
      if (String(url).endsWith('/periods')) return f.fetcher(url, init);
      return mode === 'broken' ? new Response('broken', { status: 200 }) : mode === 'wrong' ? pcReply(pcDetail(pcOtherHeader)) : f.fetcher(url, init);
    });
    await total(); mode = 'broken'; await userEvent.click(screen.getByRole('button', { name: 'Tải lại', exact: true }));
    await screen.findByText('Chưa thể tải lại dữ liệu mới nhất. Kết quả hiển thị có thể chưa được cập nhật.'); expect(await total()).toBeTruthy();
    mode = 'wrong'; await userEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }));
    await screen.findByText('Không thể xem ngữ cảnh được yêu cầu. Vui lòng tải lại danh sách và chọn đúng phòng, kỳ.');
    expect(screen.queryByTestId('provisional-total')).toBeNull();
  });
  it.each([[403, 'TENANCY_TERMINATED_OR_MOVED', 'Lượt thuê trước đó đã kết thúc'], [403, 'ACCESS_DENIED', 'Không tìm thấy dữ liệu'], [404, 'PERIOD_NOT_FOUND', 'Không tìm thấy dữ liệu'], [409, 'PERIOD_SEALED_OR_INVOICE_ISSUED', 'Kỳ này đã chốt'], [422, 'CALCULATION_OR_SOURCE_DATA_INVALID', 'Dữ liệu nguồn ghi nhận không hợp lệ']] as const)('redacts prior data for %s %s', async (status, code, text) => {
    let revoke = false; const f = pcFixture();
    setup('full', pcRoute, 'HOST', async (url, init) => String(url).endsWith('/' + pcRoute.periodId) && revoke ? pcReply(null, status, code) : f.fetcher(url, init));
    await total(); revoke = true; await userEvent.click(screen.getByRole('button', { name: 'Tải lại', exact: true }));
    await screen.findByText(new RegExp(text)); expect(screen.queryByTestId('provisional-total')).toBeNull();
    expect(screen.queryByText('6 khoản đã tính.')).toBeNull();
  });
  it('scope removal discards snapshot before a failing detail reload', async () => {
    let revoke = false; const f = pcFixture();
    setup('full', pcRoute, 'HOST', async (url, init) => revoke ? String(url).endsWith('/periods') ? pcReply([], 200, 'NO_ACTIVE_TENANCY') : pcReply(null, 500, 'RELOAD_FAILED_KEEPING_STALE') : f.fetcher(url, init));
    await total(); revoke = true; await userEvent.click(screen.getByRole('button', { name: 'Tải lại', exact: true }));
    await screen.findByText('Không thể tải dữ liệu tạm tính. Vui lòng thử lại sau.'); expect(screen.queryByTestId('provisional-total')).toBeNull();
  });
  it('initial failures are errors, never successful empty or missing-data rows', async () => {
    setup('read-error'); await screen.findByText('Không thể tải dữ liệu tạm tính. Vui lòng thử lại sau.');
    expect(screen.queryByTestId('provisional-total')).toBeNull(); expect(screen.queryByText('Không có kỳ tạm tính phù hợp')).toBeNull();
  });
  it('ignores response A after B and aborts its signal without an error notification', async () => {
    const f = pcFixture(); let resolveA: ((r: Response) => void) | undefined; let signalA: AbortSignal | null | undefined;
    setup('full', pcRoute, 'HOST', async (url, init) => {
      if (String(url).endsWith('/' + pcRoute.periodId)) { signalA = init?.signal; return new Promise<Response>(resolve => { resolveA = resolve; }); }
      return f.fetcher(url, init);
    });
    await waitFor(() => expect(resolveA).toBeTruthy());
    await userEvent.selectOptions(screen.getByLabelText('Kỳ / phần kỳ'), pcId(2)); await total();
    expect(signalA?.aborted).toBe(true);
    await act(async () => { resolveA!(pcReply(pcDetail(pcHeader, 'partial'))); });
    expect((await total()).textContent).toContain('580.432'); expect(screen.queryByRole('alert')).toBeNull();
  });
  it('foreground revalidates list and detail once; no uncontrolled polling', async () => {
    const f = setup(); await total();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    fireEvent(document, new Event('visibilitychange')); fireEvent(document, new Event('visibilitychange'));
    await waitFor(() => expect(f.calls).toHaveLength(4)); await flush(); expect(f.calls).toHaveLength(4);
    expect(f.calls.at(-1)?.etag).toBe('"' + pcToken + '"');
  });
  it('account changes/unmount and epoch invalidation stop late data and discard old tokens', async () => {
    const f = pcFixture(); let finish: ((r: Response) => void) | undefined;
    const mounted = setup('full', pcRoute, 'HOST', async url => String(url).endsWith('/periods') ? pcReply(pcHeaders) : new Promise<Response>(resolve => { finish = resolve; }));
    await waitFor(() => expect(finish).toBeTruthy()); mounted.unmount(); invalidateSession();
    await act(async () => { finish!(pcReply(pcDetail())); });
    setup('full', { ...pcRoute, role: 'CUSTOMER' }, 'CUSTOMER', f.fetcher); await total();
    expect(f.calls.at(-1)?.etag).toBeNull();
    expect(localStorage.getItem('uc39-snapshot')).toBeNull(); expect(sessionStorage.length).toBe(0);
  });
  it('same-account reauthentication in another tab drops the idle snapshot and ETag before revalidation', async () => {
    const f = pcFixture(); let hold = false, finish: ((r: Response) => void) | undefined;
    setup('full', pcRoute, 'HOST', async (url, init) => hold && String(url).endsWith('/periods')
      ? new Promise<Response>(resolve => { finish = resolve; }) : f.fetcher(url, init));
    await total(); hold = true;
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'rentops-session-change', newValue: JSON.stringify({ accountId: pcHost.accountId, nonce: 'new-login' }) })));
    expect(screen.queryByTestId('provisional-total')).toBeNull();
    await waitFor(() => expect(finish).toBeTruthy());
    await act(async () => { finish!(pcReply(pcHeaders)); }); await total();
    expect(f.calls.at(-1)?.etag).toBeNull();
  });
  it('an old request error/finally cannot erase the successful next period', async () => {
    const f = pcFixture(); let rejectA: ((e: Error) => void) | undefined;
    setup('full', pcRoute, 'HOST', async (url, init) => String(url).endsWith('/' + pcRoute.periodId)
      ? new Promise<Response>((_, reject) => { rejectA = reject; }) : f.fetcher(url, init));
    await waitFor(() => expect(rejectA).toBeTruthy());
    await userEvent.selectOptions(screen.getByLabelText('Kỳ / phần kỳ'), pcId(2)); await total();
    await act(async () => { rejectA!(new Error('Late connection failure')); });
    expect(screen.queryByRole('alert')).toBeNull(); expect((await total()).textContent).toContain('580.432');
  });
});

describe('UC39 application routing and existing authentication integration', () => {
  it('restores Customer deep link, Back/Forward and menu without Host API or overview fixtures', async () => {
    const f = pcFixture({ role: 'CUSTOMER' }); vi.stubGlobal('fetch', f.fetcher);
    window.history.replaceState(null, '', provisionalUrl({ ...pcRoute, role: 'CUSTOMER' })); render(<App />); await total();
    expect(screen.queryByText('Đang quản lý:')).toBeNull();
    expect(document.querySelector('.dash-sidebar [aria-current=page]')?.textContent).toContain('Tạm tính dịch vụ');
    expect(document.querySelector('.system-status-box')).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Phòng'), pcOtherHeader.roomId);
    await screen.findByText('Chọn phòng và kỳ để xem tạm tính');
    act(() => { window.history.replaceState(null, '', provisionalUrl({ ...pcRoute, role: 'CUSTOMER' })); window.dispatchEvent(new PopStateEvent('popstate')); });
    await total();
    expect(f.calls.filter(c => c.path.includes('/provisional-charges/')).every(c => c.path.includes('/customer/'))).toBe(true);
  });
  it('ends invalid sessions through the existing refresh client, then clears the ledger', async () => {
    let failed = false;
    const f = pcFixture();
    vi.stubGlobal('fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/auth/csrf')) return pcReply({ token: 'fixture', headerName: 'X-CSRF-TOKEN' });
      if (failed && String(url).includes('/auth/')) return pcReply(null, 401, 'INVALID_SESSION');
      return failed ? pcReply(null, 401, 'INVALID_SESSION') : f.fetcher(url, init);
    });
    window.history.replaceState(null, '', provisionalUrl(pcRoute)); render(<App />); await total();
    failed = true; await userEvent.click(screen.getByRole('button', { name: 'Tải lại', exact: true }));
    await screen.findByText('Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
    expect(screen.queryByTestId('provisional-total')).toBeNull();
  });
  it('account replacement clears the first account before the new list is ready', async () => {
    const f = pcFixture(); vi.stubGlobal('fetch', f.fetcher); window.history.replaceState(null, '', provisionalUrl(pcRoute));
    const { rerender } = render(<ProvisionalChargesPage user={pcHost} route={pcRoute} onNavigate={vi.fn()} onBack={vi.fn()} onSessionExpired={vi.fn()} />);
    await total();
    rerender(<ProvisionalChargesPage user={{ ...pcCustomer, accountId: pcId(999) }} route={{ ...pcRoute, role: 'CUSTOMER' }} onNavigate={vi.fn()} onBack={vi.fn()} onSessionExpired={vi.fn()} />);
    expect(screen.queryByTestId('provisional-total')).toBeNull(); await total();
    expect(f.calls.at(-1)?.etag).toBeNull();
  });
});
