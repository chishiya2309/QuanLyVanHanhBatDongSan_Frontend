import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../src/App';
import { BillingSchedulePage } from '../src/components/invoice/BillingSchedulePage';
import { InvoicePage } from '../src/components/invoice/InvoicePage';
import { fetchBillingSchedules, type BillingScheduleItem } from '../src/services/billingScheduleApi';
import { createDraftHandoff } from '../src/utils/billingScheduleNavigation';
import { failure, ok } from './apiMock';

const id = (value: number) => '00000000-0000-4000-8000-' + String(value).padStart(12, '0');
const accountId = id(1);
const propertyId = id(2);
const summary = {
  overdueCount: 1, dueCount: 1, upcomingCount: 1, draftCount: 1, issuedCount: 1, totalActiveContracts: 6,
};

function item(index: number, overrides: Partial<BillingScheduleItem> = {}): BillingScheduleItem {
  return {
    contractId: id(1000 + index), roomId: id(3000 + index), roomName: 'P' + index, propertyId,
    propertyName: 'Tòa A', representativeTenantName: 'Khách ' + index, billingCycleMonths: 1, anchorDay: 1,
    cycleStart: '2026-11-01', cycleEnd: '2026-12-01', expectedClosingDate: '2026-12-01',
    status: 'DEN_KY', overdueDays: 0, actionType: 'CREATE_INVOICE', existingInvoiceId: null,
    dataValid: true, warningMessage: null, cycleSegments: [], hasRoomTransferInCycle: false, ...overrides,
  };
}

function period(cycle: BillingScheduleItem, index: number) {
  return {
    period_id: id(5000 + index), contract_id: cycle.contractId, room_id: cycle.roomId, room_code: cycle.roomName,
    building_id: propertyId, building_name: 'Tòa A', customer_name: cycle.representativeTenantName,
    cycle_start: cycle.cycleStart, cycle_end: cycle.cycleEnd, from_date: cycle.cycleStart, to_date: cycle.cycleEnd,
    scheduledBillingDate: cycle.expectedClosingDate, suggestedDueDate: '2026-12-08', status: 'OPEN',
  };
}

function installApi(
  schedule: (url: URL, init?: RequestInit) => Response | Promise<Response>,
  draft?: (url: URL, init?: RequestInit) => Response,
  role = 'HOST',
) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), window.location.origin);
    switch (url.pathname.replace('/api/v1', '')) {
      case '/auth/me': return ok({ accountId, loginName: 'Host', role, hostId: role === 'HOST' ? id(3) : null });
      case '/auth/csrf': return ok({ token: 'csrf', headerName: 'X-CSRF-TOKEN' });
      case '/billing-schedules': return schedule(url, init);
      case '/buildings': return ok([{ id: propertyId, name: 'Tòa A', active: true }]);
      default:
        if (url.pathname.includes('/drafts') && draft) return draft(url, init);
        throw new Error('Unexpected request: ' + url.pathname);
    }
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const overview = (items: BillingScheduleItem[], emptyStateMessage: string | null = null) =>
  ok({ items, summary, emptyStateMessage });
const row = (room: string) => within(screen.getByText(room, { selector: 'strong' }).closest('tr')!);

beforeEach(() => {
  window.history.replaceState(null, '', '/billing-schedules');
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

it('renders six states, all actions, transfer segments and invalid data from the API', async () => {
  const rows = [
    item(1, { status: 'CHUA_DEN_KY' }), item(2, { status: 'SAP_DEN_KY' }), item(3),
    item(4, { status: 'QUA_HAN', overdueDays: 9, hasRoomTransferInCycle: true, cycleSegments: [
      { roomId: id(3006), roomName: 'Phòng cũ', segmentStart: '2026-11-01', segmentEnd: '2026-11-12', actualDays: 12 },
    ] }),
    item(5, { status: 'DA_CO_BAN_NHAP', actionType: 'OPEN_DRAFT', existingInvoiceId: id(5) }),
    item(6, { status: 'DA_PHAT_HANH', actionType: 'VIEW_INVOICE', existingInvoiceId: id(6) }),
    item(7, { dataValid: false, warningMessage: 'Kiểm tra chu kỳ hợp đồng', cycleStart: null }),
    item(8, { actionType: 'DISABLED' }),
    item(9, { status: 'DA_CO_BAN_NHAP', actionType: 'OPEN_DRAFT' }),
  ];
  const fetch = installApi(() => overview(rows));
  render(<BillingSchedulePage accountId={accountId} />);
  await screen.findByRole('table');

  ['Chưa đến kỳ', 'Sắp đến kỳ', 'Đến kỳ', 'Quá hạn lập', 'Đã có bản nháp', 'Đã phát hành'].forEach((label, index) => {
    expect(row(`P${index + 1}`).getByText(label)).toBeTruthy();
  });
  expect(row('P1').getByRole('button', { name: 'Lập hóa đơn' }).hasAttribute('disabled')).toBe(false);
  expect(row('P5').getByRole('link', { name: 'Mở bản nháp' }).getAttribute('href')).toBe('/invoices/host/' + id(5));
  expect(row('P6').getByRole('link', { name: 'Xem hóa đơn' }).getAttribute('href')).toBe('/invoices/host/' + id(6));
  expect(row('P8').getByRole('button', { name: 'Lập hóa đơn' }).hasAttribute('disabled')).toBe(true);
  expect(row('P9').getByRole('button', { name: 'Mở bản nháp' }).hasAttribute('disabled')).toBe(true);
  expect(row('P7').getByRole('button', { name: 'Lập hóa đơn' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByText('Kiểm tra chu kỳ hợp đồng').className).toBe('billing-warning');
  expect(screen.getByText('Trễ 9 ngày')).toBeTruthy();
  fireEvent.click(screen.getByText('Chuyển phòng giữa kỳ'));
  expect(screen.getByText('Phòng cũ, 01/11/2026 đến 12/11/2026 (12 ngày)')).toBeTruthy();

  expect(screen.getAllByRole('checkbox', { name: /^Chọn P/ })).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Chọn tất cả phòng đến kỳ' }));
  expect(screen.getAllByRole('checkbox', { name: /^Chọn P/, checked: true })).toHaveLength(2);
  expect(screen.getByText('Đã chọn 2 kỳ')).toBeTruthy();
  expect(fetch.mock.calls.every(([, init]) => init?.method === 'GET' || !init?.method)).toBe(true);
});

it('serializes every filter, updates the summary with its rows, and ignores an older response', async () => {
  let completeOld!: (response: Response) => void;
  let oldSignal: AbortSignal | null | undefined;
  const schedule = vi.fn((url: URL, init?: RequestInit) => {
    if (url.searchParams.get('month') === '11') {
      oldSignal = init?.signal;
      return new Promise<Response>(resolve => { completeOld = resolve; });
    }
    return ok({ items: [item(url.searchParams.get('month') === '12' ? 12 : 1)],
      summary: { ...summary, dueCount: url.searchParams.get('month') === '12' ? 27 : 1 } });
  });
  installApi(schedule);
  render(<BillingSchedulePage accountId={accountId} />);
  await screen.findByRole('option', { name: 'Tòa A' });
  await screen.findByRole('table');
  fireEvent.click(screen.getByRole('button', { name: 'Chọn tất cả phòng đến kỳ' }));
  fireEvent.change(screen.getByLabelText('Tòa nhà'), { target: { value: propertyId } });
  await screen.findByText('Đã chọn 0 kỳ');
  const filterRegion = screen.getByRole('region', { name: 'Bộ lọc lịch lập hóa đơn' });
  fireEvent.click(within(filterRegion).getByText('Trạng thái'));
  fireEvent.click(screen.getByLabelText('Đến kỳ'));
  fireEvent.click(screen.getByLabelText('Quá hạn lập'));
  fireEvent.change(screen.getByLabelText('Năm'), { target: { value: '2026' } });
  fireEvent.submit(screen.getByLabelText('Năm').closest('form')!);
  fireEvent.change(screen.getByLabelText('Tháng'), { target: { value: '11' } });
  await waitFor(() => expect(completeOld).toBeTypeOf('function'));
  fireEvent.change(screen.getByLabelText('Tháng'), { target: { value: '12' } });
  await screen.findByText('P12');
  expect(screen.getByText('27')).toBeTruthy();
  expect(oldSignal?.aborted).toBe(true);
  const params = schedule.mock.calls.at(-1)?.[0].searchParams;
  expect(params?.get('propertyId')).toBe(propertyId);
  expect(params?.getAll('status')).toEqual(['DEN_KY', 'QUA_HAN']);
  expect(params?.get('month')).toBe('12');
  expect(params?.get('year')).toBe('2026');
  expect(window.location.search).toBe('?' + params);
  await act(async () => completeOld(overview([item(11)])));
  expect(screen.queryByText('P11')).toBeNull();
  expect(screen.getByText('27')).toBeTruthy();
});

it('omits empty query values and renders the no-contract state with a creation link', async () => {
  const message = 'Chưa có hợp đồng thuê đang hoạt động để theo dõi lịch lập hóa đơn';
  const schedule = vi.fn(() => overview([], message));
  const fetch = installApi(schedule);
  await fetchBillingSchedules({ propertyId: ' ', status: [], month: null });
  expect(String(fetch.mock.calls[0][0])).toBe('/api/v1/billing-schedules');
  render(<BillingSchedulePage accountId={accountId} />);
  await screen.findByText(message);
  expect(screen.getByRole('link', { name: 'Tạo hợp đồng thuê' }).getAttribute('href')).toBe('/rental-contracts?create=true');
});

it('distinguishes no matches from no due periods and allows retry', async () => {
  window.history.replaceState(null, '', '/billing-schedules?month=12');
  const message = 'Hiện không có hợp đồng nào đến kỳ cần lập hóa đơn';
  const schedule = vi.fn((url: URL) => url.search ? overview([]) : overview([item(1, { status: 'SAP_DEN_KY' })], message));
  schedule.mockImplementationOnce(() => failure(503, 'Lịch tạm thời không khả dụng'));
  installApi(schedule);
  render(<BillingSchedulePage accountId={accountId} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
  await screen.findByText(/Không có kỳ tính tiền phù hợp/);
  expect(screen.queryByRole('link', { name: 'Tạo hợp đồng thuê' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
  await screen.findByText(message);
  expect(screen.getByRole('table')).toBeTruthy();
});

it.each(['HOST', 'CUSTOMER', 'ADMIN'])('protects direct UC54 entry and who sees its sidebar link for %s', async role => {
  const schedule = vi.fn(() => overview([]));
  installApi(schedule, undefined, role);
  render(<App />);
  if (role === 'HOST') {
    await screen.findByRole('heading', { name: 'Lịch lập hóa đơn' });
    const sidebar = screen.getByRole('complementary', { name: 'Thanh điều hướng chính' });
    expect(within(sidebar).getByRole('link', { name: 'Lịch lập hóa đơn', current: 'page' })).toBeTruthy();
    expect(schedule).toHaveBeenCalled();
  } else {
    await screen.findByText('Bạn không có quyền xem lịch lập hóa đơn.');
    expect(screen.queryByRole('link', { name: 'Lịch lập hóa đơn' })).toBeNull();
    expect(schedule).not.toHaveBeenCalled();
  }
});

function openHandoff(mode: 'single' | 'batch', cycles: BillingScheduleItem[], currentAccount = accountId) {
  const url = createDraftHandoff(accountId, mode, 'month=11', cycles);
  const search = new URL(url, window.location.origin).search;
  return render(<InvoicePage accountId={currentAccount} pathname="/invoices/host" accountRole="HOST" search={search} />);
}

it('opens the existing single confirmation from an exact saved period using only GETs', async () => {
  const cycle = item(1);
  const match = period(cycle, 1);
  const fetch = installApi(() => overview([]), url => url.pathname.endsWith('/schedule')
    ? ok([{ ...period(cycle, 2), cycle_end: '2026-11-30' }, match]) : ok(match));
  openHandoff('single', [cycle]);
  await screen.findByRole('button', { name: 'Xác nhận tạo nháp' });
  expect(fetch.mock.calls.map(([url, init]) => [new URL(String(url), window.location.origin).pathname, init?.method])).toEqual([
    ['/api/v1/invoices/host/drafts/schedule', 'GET'], ['/api/v1/invoices/host/drafts/periods/' + match.period_id, 'GET'],
  ]);
  expect(screen.getByRole('link', { name: 'Quay lại lịch lập hóa đơn' }).getAttribute('href')).toBe('/billing-schedules?month=11');
});

it.each([false, true])('keeps the chosen cycle visible without a create action when matching is missing or ambiguous (%s)', async ambiguous => {
  const cycle = item(1);
  const fetch = installApi(() => overview([]), () => ok(ambiguous ? [period(cycle, 1), period(cycle, 2)] : []));
  openHandoff('single', [cycle]);
  await screen.findByText(ambiguous ? /Có nhiều kỳ tính tiền khớp/ : /Chưa có kỳ tính tiền đã đăng ký khớp/);
  expect(screen.getByText('Hợp đồng ' + cycle.contractId)).toBeTruthy();
  expect(screen.getByText('01/11/2026 đến 01/12/2026')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Xác nhận tạo nháp' })).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('rejects a handoff from another account without requesting draft data', () => {
  const fetch = installApi(() => overview([]));
  openHandoff('single', [item(1)], id(9));
  expect(screen.getByRole('alert').textContent).toMatch(/hết hạn hoặc không còn khả dụng/);
  expect(fetch).not.toHaveBeenCalled();
});

it('splits matched periods into groups of 100 and only creates the confirmed group', async () => {
  const cycles = Array.from({ length: 102 }, (_, index) => item(index + 1));
  const saved = cycles.slice(0, 101).map(period);
  const preview = vi.fn();
  const create = vi.fn();
  const fetch = installApi(() => overview([]), (url, init) => {
    if (url.pathname.endsWith('/schedule')) return ok(saved);
    const { periodIds } = JSON.parse(String(init?.body)) as { periodIds: string[] };
    if (url.pathname.endsWith('/preview')) {
      preview(periodIds);
      return ok(periodIds.map(periodId => ({ periodId, issues: [] })));
    }
    create(periodIds);
    return ok({ items: periodIds.map(periodId => ({ periodId, status: 'READY' })) });
  });
  openHandoff('batch', cycles);
  const first = await screen.findByRole('button', { name: 'Xem trước nhóm 1 (100 kỳ)' });
  expect(screen.getByRole('button', { name: 'Xem trước nhóm 2 (1 kỳ)' })).toBeTruthy();
  expect(screen.getByText('P102')).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(first);
  const confirm = await screen.findByRole('button', { name: 'Xác nhận lập hàng loạt' });
  expect(create).not.toHaveBeenCalled();
  fireEvent.click(confirm);
  await screen.findByRole('button', { name: 'Đã xử lý nhóm 1' });
  expect(create).toHaveBeenCalledWith(saved.slice(0, 100).map(value => value.period_id));
  fireEvent.click(screen.getByRole('button', { name: 'Xem trước nhóm 2 (1 kỳ)' }));
  await screen.findByRole('button', { name: 'Xác nhận lập hàng loạt' });
  expect(preview.mock.calls[1][0]).toEqual([saved[100].period_id]);
  expect(create).toHaveBeenCalledTimes(1);
});
