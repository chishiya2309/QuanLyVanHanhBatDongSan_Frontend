import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { useAssets } from '../src/hooks/useAssets';
import { AssetSearch } from '../src/components/assets/AssetControls';
import { assetMessages as m, type AssetRoute } from '../src/types/assets';
import { assetUrl, parseAssetRoute } from '../src/utils/assetNavigation';
import { assetFixture, assetId, assetPageReply, assetReply, assetWire, secondAssetId } from './fixtures/assets';
import { deferred, failure, ok } from './apiMock';

function install(role = 'HOST') {
  const me = vi.fn(async (): Promise<Response> => ok({ accountId: 'host-account', loginName: 'Chủ nhà', role, hostId: assetId, customerId: null }));
  const csrf = vi.fn(async (): Promise<Response> => ok({ token: 'fresh', headerName: 'X-CSRF-TOKEN' }));
  const list = vi.fn(async (url: URL): Promise<Response> => assetPageReply({ q: url.searchParams.get('q') || '', page: Number(url.searchParams.get('page')), size: Number(url.searchParams.get('size')) }));
  const detail = vi.fn(async (target: string): Promise<Response> => assetReply(assetWire({ ...assetFixture, assetId: target })));
  const write = vi.fn(async (url: URL, init: RequestInit): Promise<Response> => url.pathname.endsWith('/condition-records') ?
    assetReply({ recordId: secondAssetId, assetId, condition: 'GOOD', recordedAt: assetFixture.updatedAt, recordedByAccountId: secondAssetId, note: 'Kiểm tra' }, m.conditionSuccess, 201) :
    assetReply(assetWire(assetFixture), init.method === 'PUT' ? m.updateSuccess : m.createSuccess, init.method === 'PUT' ? 200 : 201));
  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname.endsWith('/auth/me')) return me();
    if (url.pathname.endsWith('/auth/refresh')) return failure(401, 'expired');
    if (url.pathname.endsWith('/auth/csrf')) return csrf();
    if (url.pathname.endsWith('/assets') && !init.method) return list(url);
    if (url.pathname.includes('/assets')) return init.method === 'POST' || init.method === 'PUT' ? write(url, init) : detail(url.pathname.split('/').at(-1) || '');
    throw new Error('Unexpected test request ' + url.pathname);
  }); vi.stubGlobal('fetch', fetch); return { me, csrf, list, detail, write, fetch };
}
const callbacks = () => ({ onNavigate: vi.fn(), onSessionExpired: vi.fn(), onForbidden: vi.fn() });
const baseRoute: AssetRoute = { assetId: null, screen: 'list', q: '', page: 0, size: 20, create: false };
const goto = (path: string) => { window.history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')); };
const ready = async () => waitFor(() => expect((screen.getByRole('button', { name: 'Thêm tài sản' }) as HTMLButtonElement).disabled).toBe(false));
const inputValue = (element: HTMLElement) => (element as HTMLInputElement).value;
beforeEach(() => window.history.replaceState(null, '', '/assets'));
afterEach(() => vi.useRealTimers());

describe('UC17 authorization and integration', () => {
  it.each(['ADMIN', 'CUSTOMER'])('rejects direct %s entry without calling UC17', async (role) => {
    const api = install(role); render(<App />);
    await screen.findByText(m.forbidden); expect(api.list).not.toHaveBeenCalled(); expect(api.detail).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Tài sản' })).toBeNull();
  });
  it('waits for session before any asset GET or direct-create dialog', async () => {
    window.history.replaceState(null, '', '/assets?create=1'); const api = install(); const gate = deferred<Response>(); api.me.mockReturnValueOnce(gate.promise);
    render(<App />); expect(screen.getByText('Đang kiểm tra phiên đăng nhập')).toBeTruthy(); expect(api.list).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => { gate.resolve(ok({ accountId: 'host-account', loginName: 'Chủ nhà', role: 'HOST', hostId: assetId, customerId: null })); });
    const dialog = await screen.findByRole('dialog'); expect(document.activeElement).toBe(within(dialog).getByLabelText(/Tên tài sản/));
  });
  it('supports direct URLs, canonical queries and private navigation without auth reset', async () => {
    const api = install(); window.history.replaceState(null, '', '/assets?page=-1&size=3&q=+++'); render(<App />); await ready();
    expect(window.location.search).toBe('?page=0&size=20');
    const table = screen.getByRole('table'); fireEvent.click(within(table).getByRole('link', { name: 'Xem chi tiết' }));
    await screen.findByRole('heading', { name: 'Chi tiết tài sản' }); await screen.findByText('Ngày tạo');
    fireEvent.click(screen.getByRole('link', { name: 'Chỉnh sửa' })); await screen.findByDisplayValue(assetFixture.name);
    expect(window.location.pathname).toBe('/assets/' + assetId + '/edit'); expect(api.me).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' })); await screen.findByRole('heading', { name: 'Chi tiết tài sản' });
    expect(api.write).not.toHaveBeenCalled();
    act(() => goto('/assets?q=Máy%25_%21&page=0&size=10')); await ready();
    expect(inputValue(screen.getByRole('searchbox'))).toBe('Máy%_!'); expect(api.list.mock.calls.at(-1)?.[0].searchParams.get('q')).toBe('Máy%_!');
    expect(screen.queryByText(/Dữ liệu đồng bộ/)).toBeNull(); expect(screen.queryByText(/Chào buổi sáng/)).toBeNull();
  });
  it('initial invalid session returns to login with exact notice and no logout', async () => {
    const api = install(); api.me.mockImplementation(async () => failure(401, 'Expired')); render(<App />);
    await screen.findByText(m.sessionInvalid); expect(api.list).not.toHaveBeenCalled(); expect(window.location.pathname).toBe('/');
    expect(api.fetch.mock.calls.some(([url]) => String(url).includes('/logout'))).toBe(false);
  });
});

describe('UC17 loading and search', () => {
  it('retains the input, focus and raw draft when debounce updates URL state; follows external query changes', async () => {
    vi.useFakeTimers();
    function SearchHarness() {
      const [query, setQuery] = useState({ q: '', page: 0, size: 20 });
      return <><AssetSearch query={query} change={setQuery} /><button onClick={() => setQuery({ ...query, q: 'Tủ lạnh' })}>External query</button></>;
    }
    render(<SearchHarness />); const input = screen.getByRole('searchbox'); input.focus();
    fireEvent.change(input, { target: { value: '  Máy lạnh  ' } }); await act(async () => vi.advanceTimersByTime(300));
    expect(screen.getByRole('searchbox')).toBe(input); expect(document.activeElement).toBe(input); expect(inputValue(input)).toBe('  Máy lạnh  ');
    fireEvent.click(screen.getByRole('button', { name: 'External query' })); expect(inputValue(input)).toBe('Tủ lạnh');
  });
  it('shows skeleton, retryable errors, empty unfiltered and search-empty states', async () => {
    const api = install(); const gate = deferred<Response>(); api.list.mockReturnValueOnce(gate.promise); render(<App />);
    await screen.findByRole('status', { name: 'Đang tải danh sách tài sản' });
    await act(async () => { gate.resolve(failure(500, 'SQL error')); }); await screen.findByText(m.listFailure);
    api.list.mockImplementationOnce(async (url) => assetPageReply({ q: '', page: 0, size: Number(url.searchParams.get('size')) }, []));
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await screen.findByRole('heading', { name: 'Chưa có tài sản' }); expect(screen.queryByText('Trang 1 / 0')).toBeNull();
    api.list.mockImplementationOnce(async () => assetPageReply({ q: 'Không có', page: 0, size: 20 }, []));
    act(() => goto('/assets?q=Không+có')); await screen.findByRole('heading', { name: 'Không tìm thấy tài sản phù hợp' });
    expect(screen.getAllByRole('button', { name: 'Xóa tìm kiếm' })).toHaveLength(2);
  });
  it('debounces 300ms, applies Enter once, trims whitespace and blocks long query', async () => {
    vi.useFakeTimers(); const change = vi.fn(); const query = { q: '', page: 4, size: 20 };
    render(<AssetSearch query={query} change={change} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: ' Máy %_! ' } });
    await act(async () => vi.advanceTimersByTime(299)); expect(change).not.toHaveBeenCalled();
    fireEvent.submit(screen.getByRole('search')); expect(change).toHaveBeenCalledExactlyOnceWith({ q: 'Máy %_!', page: 0, size: 20 }, true);
    await act(async () => vi.advanceTimersByTime(300)); expect(change).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'x'.repeat(201) } });
    fireEvent.submit(screen.getByRole('search')); await act(async () => vi.advanceTimersByTime(300)); expect(change).toHaveBeenCalledTimes(1); expect(screen.getByRole('alert').textContent).toBe(m.queryLong);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '   ' } }); fireEvent.submit(screen.getByRole('search')); expect(change.mock.calls.at(-1)).toEqual([{ ...query, q: '', page: 0 }, true]);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: ' Tìm tự động ' } }); await act(async () => vi.advanceTimersByTime(299)); expect(change).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTime(1)); expect(change).toHaveBeenCalledTimes(3); expect(change).toHaveBeenLastCalledWith({ q: 'Tìm tự động', page: 0, size: 20 }, true); vi.useRealTimers();
  });
  it('rejects malformed response as error and does not render empty', async () => {
    const api = install(); api.list.mockResolvedValueOnce(assetReply(null, m.listSuccess)); render(<App />);
    await screen.findByText(m.listFailure); expect(screen.queryByRole('heading', { name: 'Chưa có tài sản' })).toBeNull();
  });
  it('does not fetch invalid long direct query and resets page on size change', async () => {
    const api = install(); window.history.replaceState(null, '', '/assets?q=' + 'a'.repeat(201)); render(<App />);
    await screen.findAllByText(m.queryLong); expect(api.list).not.toHaveBeenCalled();
    act(() => goto('/assets')); await ready(); fireEvent.change(screen.getByRole('combobox', { name: 'Số tài sản mỗi trang' }), { target: { value: '50' } });
    await waitFor(() => expect(api.list.mock.calls.at(-1)?.[0].searchParams.get('size')).toBe('50')); expect(window.location.search).toContain('page=0');
  });
});

describe('UC17 concurrent reads and mutations', () => {
  it('ignores late search results, old errors, and detail responses after route changes', async () => {
    const api = install(); const old = deferred<Response>(); const options = callbacks(); api.list.mockReturnValueOnce(old.promise);
    const { result, rerender } = renderHook(({ route }) => useAssets(route, options), { initialProps: { route: baseRoute } });
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(1)); rerender({ route: { ...baseRoute, q: 'Máy' } });
    await waitFor(() => expect(result.current.list.status).toBe('ready'));
    await act(async () => { old.resolve(failure(401, m.sessionInvalid)); }); expect(options.onSessionExpired).not.toHaveBeenCalled();
    const detailGate = deferred<Response>(); api.detail.mockReturnValueOnce(detailGate.promise); rerender({ route: { ...baseRoute, assetId, screen: 'detail' } });
    await waitFor(() => expect(api.detail).toHaveBeenCalledTimes(1)); rerender({ route: { ...baseRoute, assetId: secondAssetId, screen: 'detail' } });
    await waitFor(() => expect(result.current.detail.data?.assetId).toBe(secondAssetId));
    await act(async () => { detailGate.resolve(assetReply(assetWire(assetFixture))); }); expect(result.current.detail.data?.assetId).toBe(secondAssetId);
  });
  it('clamps disappeared page and refetches instead of treating whole catalog as empty', async () => {
    const api = install(); api.list.mockImplementationOnce(async () => assetPageReply({ q: '', page: 5, size: 20 }, [], 1));
    const options = callbacks(); renderHook(() => useAssets({ ...baseRoute, page: 5 }, options));
    await waitFor(() => expect(options.onNavigate).toHaveBeenCalledWith(assetUrl({ ...baseRoute, page: 0 }), true));
  });
  it('locks two submissions before CSRF resolves and preserves success when refresh fails', async () => {
    const api = install(); const gate = deferred<Response>(); api.csrf.mockReturnValueOnce(gate.promise); const options = callbacks();
    const { result } = renderHook(() => useAssets({ ...baseRoute, create: true }, options));
    await waitFor(() => expect(result.current.canMutate).toBe(true));
    act(() => { void result.current.mutate({ kind: 'create', input: { name: 'Máy', purchaseValue: '0' } }); void result.current.mutate({ kind: 'create', input: { name: 'Máy', purchaseValue: '0' } }); });
    expect(api.csrf).toHaveBeenCalledTimes(1); api.list.mockResolvedValueOnce(failure(500, 'SQL'));
    await act(async () => { gate.resolve(ok({ token: 'fresh', headerName: 'X-CSRF-TOKEN' })); });
    await waitFor(() => expect(result.current.list.status).toBe('error')); expect(api.write).toHaveBeenCalledTimes(1);
    expect(result.current.notice?.message).toBe(m.createSuccess); expect(result.current.canMutate).toBe(false); expect(result.current.list.stale).toBe(true);
    act(() => result.current.list.refresh()); await waitFor(() => expect(result.current.canMutate).toBe(true));
  });
  it('unknown write result reloads, warns and never automatically repeats', async () => {
    const api = install(); api.write.mockRejectedValueOnce(new TypeError('lost response')); const options = callbacks();
    const { result } = renderHook(() => useAssets({ ...baseRoute, create: true }, options)); await waitFor(() => expect(result.current.canMutate).toBe(true));
    await act(() => result.current.mutate({ kind: 'create', input: { name: 'Máy', purchaseValue: '0' } }));
    expect(result.current.notice).toMatchObject({ message: m.uncertain, uncertain: true }); expect(api.write).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2)); expect(api.write).toHaveBeenCalledTimes(1);
  });
  it('navigation while CSRF is pending cancels unsent write; late 401 after unmount cannot affect another account', async () => {
    const api = install(); const gate = deferred<Response>(); api.csrf.mockReturnValueOnce(gate.promise); const options = callbacks();
    const { result, rerender, unmount } = renderHook(({ route }) => useAssets(route, options), { initialProps: { route: baseRoute } });
    await waitFor(() => expect(result.current.canMutate).toBe(true)); act(() => { void result.current.mutate({ kind: 'create', input: { name: 'Máy', purchaseValue: '0' } }); });
    rerender({ route: { ...baseRoute, assetId, screen: 'detail' } });
    await act(async () => { gate.resolve(ok({ token: 'fresh', headerName: 'X-CSRF-TOKEN' })); }); expect(api.write).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.canMutate).toBe(true)); const writeGate = deferred<Response>(); api.write.mockReturnValueOnce(writeGate.promise);
    act(() => { void result.current.mutate({ kind: 'edit', id: assetId, input: { ...assetFixture, note: null } }); });
    await waitFor(() => expect(api.write).toHaveBeenCalledTimes(1)); unmount();
    await act(async () => { writeGate.resolve(failure(401, m.sessionInvalid)); }); expect(options.onSessionExpired).not.toHaveBeenCalled();
  });
});

describe('UC17 forms, focus and errors', () => {
  it('direct-create read failure can be retried from the dialog without losing draft', async () => {
    const api = install(); window.history.replaceState(null, '', '/assets?create=1'); api.list.mockResolvedValueOnce(failure(500, 'SQL')); render(<App />);
    const dialog = await screen.findByRole('dialog'); await within(dialog).findByText(m.listFailure);
    fireEvent.change(within(dialog).getByLabelText(/Tên tài sản/), { target: { value: 'Bản nháp giữ lại' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect((within(dialog).getByRole('button', { name: 'Lưu' }) as HTMLButtonElement).disabled).toBe(false));
    expect(inputValue(within(dialog).getByLabelText(/Tên tài sản/))).toBe('Bản nháp giữ lại'); expect(api.write).not.toHaveBeenCalled();
  });
  it('opens/closes create via URL, focuses input, cancels without POST, drops draft, restores focus', async () => {
    const api = install(); render(<App />); await ready(); const trigger = screen.getByRole('button', { name: 'Thêm tài sản' }); trigger.focus(); fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog'); expect(window.location.search).toContain('create=1');
    const input = within(dialog).getByLabelText(/Tên tài sản/); expect(document.activeElement).toBe(input); fireEvent.change(input, { target: { value: 'Bản nháp' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' })); expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger); expect(api.write).not.toHaveBeenCalled();
    fireEvent.click(trigger); expect(inputValue(await screen.findByLabelText(/Tên tài sản/))).toBe('');
    act(() => goto('/assets')); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('validates name/amount without dropping input, keeps CSRF errors, creates GOOD with returned detail link', async () => {
    const api = install(); render(<App />); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Thêm tài sản' }));
    const dialog = await screen.findByRole('dialog'); fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' })); await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByLabelText(/Tên tài sản/))); expect(api.write).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/Tên tài sản/), { target: { value: ' Máy ' } }); fireEvent.change(within(dialog).getByLabelText(/Giá trị tài sản/), { target: { value: '9999999999999999999' } });
    api.write.mockResolvedValueOnce(failure(403, m.csrfInvalid)); fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' })); await screen.findByText(m.csrfInvalid);
    expect(inputValue(within(dialog).getByLabelText(/Giá trị tài sản/))).toBe('9999999999999999999'); expect(inputValue(within(dialog).getByLabelText(/Tên tài sản/))).toBe(' Máy ');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' })); await screen.findByText(m.createSuccess); expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('link', { name: 'Xem tài sản' }).getAttribute('href')).toBe(assetUrl(baseRoute, assetId));
    expect(api.write.mock.calls[1][1].body).toBe('{"name":"Máy","purchaseValue":9999999999999999999}');
  });
  it('prefills a fresh GET for edit, retains general note, clears it with null and never records condition', async () => {
    const api = install(); window.history.replaceState(null, '', '/assets/' + assetId + '/edit'); render(<App />);
    await screen.findByDisplayValue(assetFixture.name); expect(inputValue(screen.getByLabelText('Ghi chú chung'))).toBe(assetFixture.note);
    fireEvent.change(screen.getByLabelText(/Tên tài sản/), { target: { value: 'Tên mới' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu' })); await screen.findByText(m.updateSuccess);
    expect(api.write.mock.calls[0][1].body).toContain('"note":"' + assetFixture.note + '"'); expect(api.write.mock.calls[0][0].pathname).not.toContain('condition-records');
    await screen.findByText('Ngày tạo'); fireEvent.click(screen.getByRole('link', { name: 'Chỉnh sửa' })); await screen.findByDisplayValue(assetFixture.name);
    fireEvent.change(screen.getByLabelText('Ghi chú chung'), { target: { value: '  ' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu' })); await waitFor(() => expect(api.write).toHaveBeenCalledTimes(2)); expect(api.write.mock.calls[1][1].body).toContain('"note":null');
  });
  it('requires explicit condition; same condition sends one record with independent note', async () => {
    const api = install(); window.history.replaceState(null, '', '/assets/' + assetId + '/condition'); render(<App />);
    const select = await screen.findByRole('combobox', { name: /Tình trạng ghi nhận/ }); expect(inputValue(select)).toBe(''); expect(inputValue(screen.getByLabelText(/Ghi chú kiểm tra/))).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ghi nhận' })); await screen.findByText(m.conditionInvalid); expect(api.write).not.toHaveBeenCalled();
    fireEvent.change(select, { target: { value: 'GOOD' } }); fireEvent.change(screen.getByLabelText(/Ghi chú kiểm tra/), { target: { value: 'Kiểm tra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ghi nhận' })); await screen.findByText(m.conditionSuccess); expect(api.write).toHaveBeenCalledTimes(1); expect(api.write.mock.calls[0][1].body).toBe('{"condition":"GOOD","note":"Kiểm tra"}');
    await waitFor(() => expect(api.detail).toHaveBeenCalledTimes(2));
  });
  it.each([[401, m.sessionInvalid], [403, m.forbidden], [404, m.notFound], [500, m.detailFailure]])('handles read %s', async (status, message) => {
    const api = install(); window.history.replaceState(null, '', '/assets/' + assetId); api.detail.mockResolvedValueOnce(failure(Number(status), 'SQL stack'));
    if (status === 401) api.me.mockResolvedValueOnce(ok({ accountId: 'host-account', loginName: 'Chủ nhà', role: 'HOST', hostId: assetId, customerId: null })).mockImplementation(async () => failure(401, 'expired'));
    render(<App />);
    await screen.findByText(String(message)); expect(screen.queryByText('SQL stack')).toBeNull();
    if (status === 404) { expect(window.location.pathname).toBe('/assets'); await ready(); }
    if (status === 401) { expect(window.location.pathname).toBe('/'); expect(api.fetch.mock.calls.some(([url]) => String(url).endsWith('/logout'))).toBe(false); }
    if (status === 403) expect(screen.queryByText(assetFixture.name)).toBeNull();
  });
  it('maps allowed server field errors and keeps draft on 400/500', async () => {
    const api = install(); window.history.replaceState(null, '', '/assets/' + assetId + '/edit'); render(<App />); await screen.findByDisplayValue(assetFixture.name);
    api.write.mockResolvedValueOnce(failure(400, m.invalid, { name: m.nameRequired, host: 'SQL' })); fireEvent.click(screen.getByRole('button', { name: 'Lưu' })); await screen.findByText(m.nameRequired); await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/Tên tài sản/)));
    api.write.mockResolvedValueOnce(failure(500, 'SQL')); fireEvent.click(screen.getByRole('button', { name: 'Lưu' })); await screen.findByText(m.saveFailure); expect(inputValue(screen.getByLabelText(/Tên tài sản/))).toBe(assetFixture.name);
    expect(api.write).toHaveBeenCalledTimes(2); expect(screen.queryByText('SQL')).toBeNull();
  });
  it('has explicit labels and keeps RETIRED editable', async () => {
    const api = install(); api.detail.mockResolvedValueOnce(assetReply(assetWire({ ...assetFixture, condition: 'RETIRED' }))); window.history.replaceState(null, '', '/assets/' + assetId); render(<App />);
    await screen.findByText('Ngừng sử dụng'); expect(screen.getByRole('link', { name: 'Chỉnh sửa' }).hasAttribute('aria-disabled')).toBe(false);
    expect(parseAssetRoute(window.location.pathname, window.location.search)).toMatchObject({ assetId, screen: 'detail' });
  });
});
