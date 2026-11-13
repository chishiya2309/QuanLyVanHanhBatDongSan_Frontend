import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { catalogMessages as m, type CatalogService } from '../src/types/serviceCatalog';
import { parseCatalogJson } from '../src/services/serviceCatalogCodec';
import { isRecord } from '../src/services/assetCodec';
import { catalogFixtures, catalogReply, catalogWire, electricityId, internet, internetId, revisionId } from './fixtures/serviceCatalog';
import { deferred, failure, ok } from './apiMock';

function install(role = 'HOST') {
  let rows = catalogFixtures.map((item) => ({ ...item }));
  const me = vi.fn(async (): Promise<Response> => ok({ accountId: 'catalog-host', loginName: 'Chủ nhà UC19', role, hostId: electricityId, customerId: null }));
  const csrf = vi.fn(async () => ok({ headerName: 'X-CSRF-TOKEN', token: 'uc19' }));
  const list = vi.fn(async (): Promise<Response> => catalogReply(rows.map(catalogWire), m.listSuccess));
  const detail = vi.fn(async (id: string): Promise<Response> => { const item = rows.find((row) => row.id === id); return item ? catalogReply(catalogWire(item)) : failure(404, m.notFound); });
  const write = vi.fn(async (url: URL, init: RequestInit): Promise<Response> => {
    const data = parseCatalogJson(String(init.body)); if (!isRecord(data)) throw new Error('Invalid test body');
    const id = url.pathname.split('/')[4]; const old = rows.find((item) => item.id === id) || internet;
    const adding = init.method === 'POST';
    const next: CatalogService = { ...old, id: adding ? '55555555-5555-4555-8555-555555555555' : id,
      systemCode: adding ? null : old.systemCode, name: typeof data.name === 'string' ? data.name : old.name, unit: typeof data.unit === 'string' ? data.unit : old.unit,
      method: adding ? data.method as CatalogService['method'] : old.method,
      defaultPrice: data.defaultPrice !== undefined ? String(data.defaultPrice) : old.defaultPrice,
      active: typeof data.active === 'boolean' ? data.active : old.pricingStatus === 'UNCONFIGURED' || adding ? true : old.active,
      pricingStatus: 'CONFIGURED', currentPriceRevisionId: revisionId, effectiveFrom: internet.effectiveFrom,
      version: String(BigInt(old.version) + 1n) };
    rows = adding ? [...rows, next] : rows.map((item) => item.id === id ? next : item);
    return catalogReply(catalogWire(next), adding ? m.createSuccess : init.method === 'PUT' ? m.updateSuccess : next.active ? m.activateSuccess : m.deactivateSuccess, adding ? 201 : 200);
  });
  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname.endsWith('/auth/me')) return me();
    if (url.pathname.endsWith('/auth/refresh')) return failure(401, 'Expired');
    if (url.pathname.endsWith('/auth/csrf')) return csrf();
    if (url.pathname === '/api/v1/services' && (!init.method || init.method === 'GET')) return list();
    if (url.pathname.startsWith('/api/v1/services')) return ['POST', 'PUT', 'PATCH'].includes(init.method || '') ? write(url, init) : detail(url.pathname.split('/').at(-1)!);
    return failure(404, 'Unexpected test endpoint');
  });
  vi.stubGlobal('fetch', fetch); return { me, csrf, list, detail, write, fetch, setRows: (items: CatalogService[]) => { rows = items; } };
}
const goto = (url: string) => { history.pushState(null, '', url); window.dispatchEvent(new PopStateEvent('popstate')); };
const table = () => within(screen.getByRole('table'));
const dialog = () => screen.getByRole('dialog');
const edit = async (id = internetId) => { act(() => goto('/services?action=edit&serviceId=' + id)); await screen.findByDisplayValue(id === electricityId ? 'Điện' : 'Internet'); };
const fill = (label: RegExp, value: string) => fireEvent.change(within(dialog()).getByLabelText(label), { target: { value } });
const ready = async () => waitFor(() => expect((document.querySelector('.catalog-heading button') as HTMLButtonElement)?.disabled).toBe(false));
beforeEach(() => { history.replaceState(null, '', '/services'); vi.spyOn(window, 'confirm').mockReturnValue(true); });
afterEach(() => vi.restoreAllMocks());

describe('UC19 Host authorization, navigation and read states', () => {
  it.each(['ADMIN', 'CUSTOMER'])('rejects %s without catalog requests', async (role) => {
    const api = install(role); render(<App />); await screen.findByText(m.forbidden); expect(api.list).not.toHaveBeenCalled(); expect(api.detail).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Danh mục dịch vụ' })).toBeNull();
  });
  it('waits for role/session before fetching or rendering the modal', async () => {
    history.replaceState(null, '', '/services?action=create'); const api = install(); const gate = deferred<Response>(); api.me.mockReturnValueOnce(gate.promise); render(<App />);
    expect(screen.getByText('Đang kiểm tra phiên đăng nhập')).toBeTruthy(); expect(api.list).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => gate.resolve(ok({ accountId: 'host', loginName: 'Host', role: 'HOST', hostId: electricityId, customerId: null })));
    await screen.findByRole('dialog'); expect(api.list).toHaveBeenCalled();
  });
  it('ends invalid initial session with UC19 message', async () => {
    const api = install(); api.me.mockImplementation(async () => failure(401, 'expired')); render(<App />);
    await screen.findByText(m.sessionInvalid); expect(api.list).not.toHaveBeenCalled(); expect(location.pathname).toBe('/');
  });
  it('shows distinct unconfigured, free and inactive states, preserving backend order', async () => {
    const api = install(); api.setRows([catalogFixtures[0], { ...internet, defaultPrice: '0', active: false }]); render(<App />); await ready();
    expect(table().getByText('Chưa thiết lập')).toBeTruthy(); expect(table().getByText(/0\s*₫/)).toBeTruthy(); expect(table().getByText('Đã tắt')).toBeTruthy();
    expect(screen.queryByText(/Dữ liệu đồng bộ/)).toBeNull(); expect(screen.queryByLabelText('Chọn tòa nhà cơ sở')).toBeNull();
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Trạng thái dịch vụ'), { target: { value: 'inactive' } });
    expect(table().queryByText('Điện')).toBeNull(); expect(table().getByText('Internet')).toBeTruthy(); expect(api.list).toHaveBeenCalledTimes(1);
  });
  it('searches Vietnamese without accents locally and retains filters across modal navigation', async () => {
    const api = install(); render(<App />); await ready(); fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'dien' } }); fireEvent.submit(screen.getByRole('search'));
    expect(table().getByText('Điện')).toBeTruthy(); expect(table().queryByText('Internet')).toBeNull(); expect(api.list).toHaveBeenCalledTimes(1);
    fireEvent.click(table().getByRole('button', { name: 'Thiết lập giá' })); await screen.findByDisplayValue('Điện'); fireEvent.click(within(dialog()).getByRole('button', { name: 'Hủy' }));
    expect(new URLSearchParams(location.search).get('q')).toBe('dien'); expect(screen.queryByRole('dialog')).toBeNull(); expect(api.me).toHaveBeenCalledTimes(1);
  });
  it('preserves search input/focus on submit and announces result changes', async () => {
    install(); render(<App />); await ready(); const input = screen.getByRole('searchbox'); input.focus();
    fireEvent.change(input, { target: { value: '  dien  ' } }); fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByRole('searchbox')).toBe(input); expect(document.activeElement).toBe(input);
    expect((input as HTMLInputElement).value).toBe('  dien  '); expect(screen.getByText('1 kết quả').getAttribute('aria-live')).toBe('polite');
    act(() => goto('/services?q=Internet')); expect((input as HTMLInputElement).value).toBe('Internet');
  });
  it('distinguishes read error, retry, real empty and no matching results', async () => {
    const api = install(); api.list.mockImplementationOnce(async () => failure(500, 'SQL secret')); render(<App />); await screen.findByText(m.listFailure);
    expect(screen.queryByText('Danh mục chưa có dữ liệu')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await ready();
    act(() => goto('/services?q=khongco')); await screen.findByText('Không tìm thấy dịch vụ phù hợp'); expect(api.list).toHaveBeenCalledTimes(2);
    api.setRows([]); fireEvent.click(screen.getByRole('button', { name: 'Tải lại' })); await screen.findByText('Danh mục chưa có dữ liệu');
  });
  it('normalizes bad action URLs and never writes', async () => {
    history.replaceState(null, '', '/services?q=dien&action=edit&serviceId=bad'); const api = install(); render(<App />);
    await screen.findByText(m.invalidRoute); expect(location.search).toBe('?q=dien'); expect(api.write).not.toHaveBeenCalled(); expect(api.detail).not.toHaveBeenCalled();
  });
  it('drops cached rows and drafts when permission is revoked', async () => {
    const api = install(); render(<App />); await ready(); await edit(); api.write.mockImplementationOnce(async () => failure(403, m.forbidden));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Lưu thay đổi' })); await screen.findByText(m.forbidden);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.queryByText('Internet')).toBeNull();
  });
  it('ignores late detail responses after the modal target changes', async () => {
    const api = install(); render(<App />); await ready(); const gate = deferred<Response>(); api.detail.mockReturnValueOnce(gate.promise);
    act(() => goto('/services?action=edit&serviceId=' + internetId));
    await waitFor(() => expect(api.detail).toHaveBeenCalledTimes(1));
    act(() => goto('/services?action=edit&serviceId=' + electricityId)); await screen.findByDisplayValue('Điện');
    await act(async () => gate.resolve(catalogReply(catalogWire(internet)))); expect(screen.queryByDisplayValue('Internet')).toBeNull(); expect(screen.getByDisplayValue('Điện')).toBeTruthy();
  });
  it('clears old data and drafts on a cross-tab account change before an old GET resolves', async () => {
    const api = install(); render(<App />); await ready(); await edit(); fill(/Tên dịch vụ/, 'Thông tin riêng');
    const auth = deferred<Response>(); api.me.mockReturnValueOnce(auth.promise);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'rentops-session-change', newValue: JSON.stringify({ accountId: 'new-account', nonce: 'different' }) })));
    await screen.findByText('Đang kiểm tra phiên đăng nhập'); expect(screen.queryByDisplayValue('Thông tin riêng')).toBeNull(); expect(screen.queryByText('Internet')).toBeNull();
    await act(async () => auth.resolve(ok({ accountId: 'new-account', loginName: 'Customer', role: 'CUSTOMER', hostId: null, customerId: internetId })));
    expect(api.list).toHaveBeenCalledTimes(1); expect(window.confirm).not.toHaveBeenCalled();
  });
});
describe('UC19 forms, first price and mutation outcomes', () => {
  it.each(['METERED', 'FIXED', 'QUANTITY', 'CUSTOM'])('creates %s with explicit zero and no extra fields', async (method) => {
    const api = install(); render(<App />); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Thêm dịch vụ' }));
    fill(/Tên dịch vụ/, 'Giặt ủi'); fill(/^Đơn vị/, 'lần'); fireEvent.change(within(dialog()).getByLabelText(/Phương pháp tính/), { target: { value: method } }); fill(/Đơn giá danh mục/, '0');
    fireEvent.submit(within(dialog()).getByRole('button', { name: 'Thêm dịch vụ' }).closest('form')!); await screen.findByText(m.createSuccess);
    expect(api.write).toHaveBeenCalledTimes(1); expect(String(api.write.mock.calls[0][1].body)).toContain('"defaultPrice":0'); expect(String(api.write.mock.calls[0][1].body)).not.toMatch(/hostId|version|active/);
  });
  it('keeps empty prices invalid and focuses the first missing field', async () => {
    const api = install(); history.replaceState(null, '', '/services?action=create'); render(<App />); await screen.findByRole('dialog'); await ready();
    fireEvent.submit(within(dialog()).getByRole('button', { name: 'Thêm dịch vụ' }).closest('form')!);
    await screen.findByText('Vui lòng nhập tên dịch vụ'); expect(document.activeElement?.id).toBe('catalog-name'); expect(api.write).not.toHaveBeenCalled();
  });
  it('initializes a provisioned zero price with one PUT that auto activates', async () => {
    const api = install(); render(<App />); await ready(); await edit(electricityId);
    expect((within(dialog()).getByLabelText(/Đơn giá danh mục/) as HTMLInputElement).value).toBe(''); fill(/Đơn giá danh mục/, '0');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Lưu và bật dịch vụ' })); await screen.findByText(m.updateSuccess);
    expect(api.write).toHaveBeenCalledTimes(1); expect(api.write.mock.calls[0][1].method).toBe('PUT');
    expect(table().getByText(/0\s*₫/)).toBeTruthy(); expect(table().getAllByText('Đang bật').length).toBeGreaterThan(0);
  });
  it('keeps method readonly and prices/versions lossless while editing an inactive service', async () => {
    const api = install(); api.setRows([{ ...internet, active: false, version: '9007199254740993' }]); render(<App />); await ready(); await edit();
    expect((within(dialog()).getByLabelText('Phương pháp tính') as HTMLInputElement).readOnly).toBe(true);
    fill(/Đơn giá danh mục/, '9999999999999999999'); expect(within(dialog()).getByText(/Giá của kỳ được xác định/)).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Lưu thay đổi' })); await screen.findByText(m.updateSuccess);
    const body = String(api.write.mock.calls[0][1].body); expect(body).toContain('"defaultPrice":9999999999999999999'); expect(body).toContain('"version":9007199254740993'); expect(body).not.toContain('method');
    await waitFor(() => expect(table().getByText('Đã tắt')).toBeTruthy());
  });
  it('preserves drafts on 400 and sanitizes backend field errors', async () => {
    const api = install(); render(<App />); await ready(); await edit(); fill(/Tên dịch vụ/, 'Bản nháp'); api.write.mockImplementationOnce(async () => failure(400, 'SQL private', { name: 'SQL private', other: 'private' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Lưu thay đổi' })); await screen.findByText('Vui lòng kiểm tra tên dịch vụ');
    expect(screen.getByDisplayValue('Bản nháp')).toBeTruthy(); expect(screen.queryByText('SQL private')).toBeNull();
  });
  it('requires explicit conflict review, preserves the old draft and sends the new version only on a new confirmation', async () => {
    const api = install(); render(<App />); await ready(); await edit(); fill(/Tên dịch vụ/, 'Tên tôi muốn');
    api.write.mockImplementationOnce(async () => { api.setRows([{ ...internet, name: 'Tên mới trên server', version: '8' }]); return failure(409, m.stale); });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Lưu thay đổi' })); await screen.findByText('Thông tin hiện có');
    expect((within(dialog()).getByRole('button', { name: 'Lưu thay đổi' }) as HTMLButtonElement).disabled).toBe(true); expect(api.write).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa theo dữ liệu mới' })); expect(screen.getByDisplayValue('Tên mới trên server')).toBeTruthy();
    expect(screen.getByText('Xem bản nháp trước xung đột')).toBeTruthy(); fill(/Tên dịch vụ/, 'Tên đã xem lại');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Lưu thay đổi' })); await screen.findByText(m.updateSuccess); expect(String(api.write.mock.calls[1][1].body)).toContain('"version":8');
  });
  it('retries a failed conflict GET without discarding the draft or replaying PUT', async () => {
    const api = install(); render(<App />); await ready(); await edit(); fill(/Tên dịch vụ/, 'Giữ bản nháp');
    api.write.mockImplementationOnce(async () => failure(409, m.stale)); api.detail.mockImplementationOnce(async () => failure(500, m.detailFailure));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Lưu thay đổi' })); await screen.findByRole('button', { name: 'Tải lại dữ liệu mới' });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Tải lại dữ liệu mới' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu mới' })); await screen.findByText('Thông tin hiện có');
    expect(screen.getByDisplayValue('Giữ bản nháp')).toBeTruthy(); expect(api.write).toHaveBeenCalledTimes(1);
  });
  it('routes an unconfigured activation to setup without sending PATCH', async () => {
    const api = install(); history.replaceState(null, '', '/services?action=activate&serviceId=' + electricityId); render(<App />);
    await screen.findByText(m.priceRequired); fireEvent.click(within(dialog()).getByRole('button', { name: 'Thiết lập giá' }));
    await screen.findByDisplayValue('Điện'); expect(screen.getByRole('button', { name: 'Lưu và bật dịch vụ' })).toBeTruthy(); expect(api.write).not.toHaveBeenCalled();
  });
  it('keeps a recoverable CSRF error in the form and closes inaccessible services', async () => {
    const api = install(); render(<App />); await ready(); await edit(); api.write.mockImplementationOnce(async () => failure(403, m.csrfInvalid));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Lưu thay đổi' })); await screen.findByText(m.csrfInvalid); expect(screen.getByDisplayValue('Internet')).toBeTruthy();
    api.write.mockImplementationOnce(async () => failure(404, m.notFound)); fireEvent.click(within(dialog()).getByRole('button', { name: 'Lưu thay đổi' }));
    await screen.findByText(m.notFound); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('blocks a price-history conflict without manufacturing a replacement', async () => {
    const api = install(); render(<App />); await ready(); await edit(); api.write.mockImplementationOnce(async () => failure(409, m.priceConflict));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Lưu thay đổi' })); await screen.findByText(m.priceConflict);
    expect((within(dialog()).getByRole('button', { name: 'Lưu thay đổi' }) as HTMLButtonElement).disabled).toBe(true); expect(api.write).toHaveBeenCalledTimes(1);
  });
  it('does not reverse a status intent if the latest detail already has that state', async () => {
    const api = install(); render(<App />); await ready(); api.setRows([{ ...internet, active: false }]); fireEvent.click(table().getByRole('button', { name: 'Tắt dịch vụ' }));
    await screen.findByText(m.statusConflict); expect(screen.queryByRole('dialog')).toBeNull(); expect(api.write).not.toHaveBeenCalled();
  });
  it('preserves success when refresh fails and locks stale row actions', async () => {
    const api = install(); render(<App />); await ready(); await edit(); api.list.mockImplementationOnce(async () => failure(500, m.listFailure));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Lưu thay đổi' })); await screen.findByText(m.updateSuccess); await screen.findByText(/Đang hiển thị dữ liệu cũ/);
    expect((table().getByRole('button', { name: 'Chỉnh sửa' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await ready(); expect(screen.getByText(m.updateSuccess)).toBeTruthy();
  });
  it('ends an uncertain write without retry', async () => {
    const api = install(); render(<App />); await ready(); await edit(); api.write.mockImplementationOnce(async () => { throw new TypeError('lost'); });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Lưu thay đổi' })); await screen.findByText(m.uncertain); expect(api.write).toHaveBeenCalledTimes(1); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('protects dirty internal navigation and suppresses double submit from CSRF onwards', async () => {
    const api = install(); render(<App />); await ready(); await edit(); fill(/Tên dịch vụ/, 'Bản nháp'); vi.mocked(window.confirm).mockReturnValue(false);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Hủy' })); expect(screen.getByRole('dialog')).toBeTruthy();
    const draftUrl = window.location.pathname + window.location.search;
    fireEvent.click(screen.getByRole('button', { name: 'Hợp đồng đặt cọc' }));
    expect(window.location.pathname + window.location.search).toBe(draftUrl);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Hợp đồng đặt cọc' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Hợp đồng thuê' }));
    expect(window.location.pathname + window.location.search).toBe(draftUrl);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Hợp đồng thuê' })).toBeNull();
    const gate = deferred<Response>(); api.csrf.mockReturnValueOnce(gate.promise); const save = within(dialog()).getByRole('button', { name: 'Lưu thay đổi' });
    fireEvent.click(save); fireEvent.click(save); expect(api.csrf).toHaveBeenCalledTimes(1); expect((within(dialog()).getByRole('button', { name: 'Hủy' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => gate.resolve(ok({ headerName: 'X-CSRF-TOKEN', token: 'late' }))); await screen.findByText(m.updateSuccess); expect(api.write).toHaveBeenCalledTimes(1);
  });
});
