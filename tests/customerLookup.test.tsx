import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerLookupPage } from '../src/components/customers/CustomerLookupPage';
import { getCustomer } from '../src/services/customerApi';
import { getRentalHistory, lookupRequest, LookupApiError, searchCustomers } from '../src/services/customerLookupApi';
import { parseLookupRoute } from '../src/utils/customerLookupNavigation';
import type { LookupPage } from '../src/types/customerLookup';
vi.mock('../src/services/customerApi', () => ({ getCustomer: vi.fn() }));
vi.mock('../src/services/customerLookupApi', async original => ({ ...await original<typeof import('../src/services/customerLookupApi')>(), searchCustomers: vi.fn(), getRentalHistory: vi.fn(), lookupRequest: vi.fn() }));
const id = '11111111-1111-4111-8111-111111111111';
const stay = { tenancyId: id, roomId: id, roomCode: 'A101', roomName: 'Phòng A', buildingId: id, buildingName: 'Tòa A', contractId: id, contractNumber: 'HD01', contractStartDate: '2026-01-01', contractEndDate: '2026-12-31', fromDate: '2026-01-01', toDate: null, contractStatus: 'ACTIVE' as const, current: true };
const customer = { id, fullName: 'Nguyễn An', phone: null, identityType: null, identityNo: null, rentals: [stay, { ...stay, tenancyId: '22222222-2222-4222-8222-222222222222', roomCode: 'B202' }] };
const page: LookupPage = { content: [customer], page: 0, size: 20, totalElements: 1, totalPages: 1, first: true, last: true, requestedPage: 0, pageReset: false };
const route = parseLookupRoute('/customers/search', '?mode=CURRENT')!;
function props() { return { route, onNavigate: vi.fn(), onSessionExpired: vi.fn(), onForbidden: vi.fn() }; }
describe('UC22 screens and async state', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(searchCustomers).mockResolvedValue(page);
    vi.mocked(lookupRequest).mockResolvedValue([{ id, code: 'A101', buildingName: 'Tòa A' }]);
    vi.mocked(getRentalHistory).mockResolvedValue({ customerId: id, items: [stay] });
    vi.mocked(getCustomer).mockResolvedValue({ id, fullName: 'Nguyễn An', phone: null } as Awaited<ReturnType<typeof getCustomer>>);
  });
  afterEach(cleanup);
  it('renders one Customer with every related room; editing is not applied until submit', async () => {
    const p = props(); render(<CustomerLookupPage {...p} />);
    await screen.findByText('Nguyễn An');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText(/B202/)).toBeDefined();
    fireEvent.change(screen.getByLabelText('Tên, điện thoại hoặc số giấy tờ'), { target: { value: '  New  ' } });
    expect(searchCustomers).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    expect(p.onNavigate).toHaveBeenCalledWith('/customers/search?q=New&mode=CURRENT');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    expect(p.onNavigate).toHaveBeenLastCalledWith('/customers/search?mode=CURRENT');
  });
  it('changing mode keeps applied criteria and resets page without applying an unsent draft', async () => {
    const p = { ...props(), route: { ...route, q: 'Applied', page: 2 } };
    render(<CustomerLookupPage {...p} />); await screen.findByText('Nguyễn An');
    fireEvent.change(screen.getByLabelText('Tên, điện thoại hoặc số giấy tờ'), { target: { value: 'Draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả Customer' }));
    expect(p.onNavigate).toHaveBeenCalledWith('/customers/search?q=Applied');
  });
  it('opens history with context and supports a direct URL and unfinished intervals', async () => {
    const p = props(); const rendered = render(<CustomerLookupPage {...p} />);
    await screen.findByText('Nguyễn An');
    const link = screen.getByRole('link', { name: 'Xem lịch sử của Nguyễn An' });
    expect(link.getAttribute('href')).toContain('returnTo=');
    rendered.rerender(<CustomerLookupPage {...p} route={parseLookupRoute(`/customers/${id}/rental-history`, '')!} />);
    await screen.findByText(/Chưa kết thúc/);
    expect(screen.getByText('01/01/2026 / 31/12/2026')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại danh sách' }));
    expect(p.onNavigate).toHaveBeenCalledWith('/customers/search');
  });
  it('applies backend page reset with replace, retaining mode and filters', async () => {
    vi.mocked(searchCustomers).mockResolvedValue({ ...page, pageReset: true, requestedPage: 2 });
    const p = { ...props(), route: { ...route, q: 'An', page: 2 } }; render(<CustomerLookupPage {...p} />);
    await waitFor(() => expect(p.onNavigate).toHaveBeenCalledWith('/customers/search?q=An&mode=CURRENT', true));
    expect(screen.getByText('Danh sách đã thay đổi. Đã chuyển về trang đầu.')).toBeDefined();
  });
  it.each([400, 401, 403, 404, 500])('handles %i and never displays zero results as a load failure', async status => {
    vi.mocked(searchCustomers).mockRejectedValue(new LookupApiError(status, 'Lỗi tải', { q: 'Kiểm tra từ khóa' }));
    const p = props(); render(<CustomerLookupPage {...p} />);
    await screen.findByText('Lỗi tải');
    expect(screen.queryByText('0 Customer phù hợp')).toBeNull();
    if (status === 401) expect(p.onSessionExpired).toHaveBeenCalled();
    if (status === 403) expect(p.onForbidden).toHaveBeenCalled();
  });
  it('distinguishes CURRENT empty and history empty from inconsistency errors', async () => {
    vi.mocked(searchCustomers).mockResolvedValue({ ...page, content: [], totalElements: 0, totalPages: 0 });
    const p = props(); const rendered = render(<CustomerLookupPage {...p} />);
    await screen.findByText('Không có Customer đang thuê phù hợp');
    vi.mocked(getRentalHistory).mockResolvedValue({ customerId: id, items: [] });
    rendered.rerender(<CustomerLookupPage {...p} route={parseLookupRoute(`/customers/${id}/rental-history`, '')!} />);
    await screen.findByText('Customer chưa có lịch sử thuê');
    vi.mocked(getRentalHistory).mockRejectedValue(new LookupApiError(500, 'Dữ liệu lưu trú chưa nhất quán', {}, 'RENTAL_DATA_INCONSISTENT'));
    rendered.rerender(<CustomerLookupPage {...p} route={route} />);
    await screen.findByText('Không có Customer đang thuê phù hợp');
    rendered.rerender(<CustomerLookupPage {...p} route={parseLookupRoute(`/customers/${id}/rental-history`, '')!} />);
    await screen.findByText('Dữ liệu lưu trú chưa nhất quán');
    expect(screen.queryByText('Customer chưa có lịch sử thuê')).toBeNull();
  });
  it('ignores stale responses after route changes and reloads on retry', async () => {
    let resolve!: (value: LookupPage) => void;
    vi.mocked(searchCustomers).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const p = props(); const rendered = render(<CustomerLookupPage {...p} />);
    await waitFor(() => expect(searchCustomers).toHaveBeenCalledTimes(1));
    vi.mocked(searchCustomers).mockRejectedValueOnce(new LookupApiError(500, 'Lỗi mới'));
    rendered.rerender(<CustomerLookupPage {...p} route={{ ...route, q: 'new' }} />);
    await screen.findByText('Lỗi mới');
    await act(async () => resolve(page));
    expect(screen.queryByText('Nguyễn An')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByText('Nguyễn An');
  });
});
