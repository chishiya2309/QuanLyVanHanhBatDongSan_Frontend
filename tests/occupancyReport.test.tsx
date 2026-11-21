import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { OccupancyReportPage } from '../src/components/reports/OccupancyReportPage';
import { getOccupancyReport } from '../src/services/occupancyApi';
import { parseOccupancyRoute } from '../src/utils/occupancyNavigation';
import { deferred, failure, ok } from './apiMock';

const path = '/reports/occupancy';
const query = parseOccupancyRoute(path, '')!;
const room = {
  roomId: 'room-1', code: 'A101', name: 'Phòng A101', buildingId: 'b1', buildingName: 'Tòa A',
  areaId: 'a1', areaName: 'Khu Bắc', area: 24.5, defaultRent: null, daysVacant: null,
};
const report = {
  generatedAt: '2026-11-21T00:00:00Z',
  totalRooms: 28, occupiedRooms: 5, availableVacantRooms: 22, unavailableRooms: 1,
  vacancyRate: 81.48, vacantRentPotential: 63000000,
  byBuilding: [{ buildingId: 'b1', buildingName: 'Tòa A', availableVacantRooms: 22, vacantRentPotential: 63000000 }],
  availableRooms: { page: 0, size: 20, totalPages: 2, totalElements: 22, items: [room] },
  warnings: [
    { code: 'INVALID_DEFAULT_RENT', count: 3 },
    { code: 'UNKNOWN_VACANT_SINCE', count: 2 },
    { code: 'ROOM_STATE_CONFLICT', count: 1 },
  ],
};

function install(respond: (url: URL) => Promise<Response> | Response = () => ok(report)) {
  const occupancy = vi.fn(respond);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), window.location.origin);
    switch (url.pathname) {
      case '/api/v1/auth/me': return ok({ accountId: 'host', loginName: 'host', role: 'HOST', hostId: 'host' });
      case '/api/v1/areas': return ok([{ id: 'a1', name: 'Khu Bắc' }, { id: 'a2', name: 'Khu Nam' }]);
      case '/api/v1/buildings': return ok([{ id: 'b1', name: 'Tòa A', areaId: 'a1' }]);
      case '/api/v1/reports/occupancy': return occupancy(url);
      case '/api/v1/rental-contracts': return ok({ content: [], pageNumber: 0, pageSize: 15, totalElements: 0, totalPages: 0, last: true });
      case '/api/v1/rental-contracts/available-customers': return ok([]);
      case '/api/v1/rental-contracts/available-rooms': return ok([{ id: room.roomId, code: room.code, name: room.name, defaultRent: 3000000, status: 'VACANT' }]);
      default: return failure(404, 'Not found');
    }
  }));
  return occupancy;
}

const callbacks = { onNavigate: vi.fn(), onRoom: vi.fn(), onContract: vi.fn(), onProperties: vi.fn(), onSessionExpired: vi.fn() };

beforeEach(() => {
  window.history.replaceState(null, '', path);
  vi.clearAllMocks();
});

describe('UC69 occupancy report', () => {
  it('preserves money precision at the API boundary', async () => {
    const occupancy = install(() => new Response(JSON.stringify({ status: 200, data: report })
      .replaceAll('63000000', '9007199254740993.50')));
    const data = await getOccupancyReport(query);
    expect(data.vacantRentPotential).toBe('9007199254740993.50');
    expect(occupancy.mock.calls[0][0].searchParams.toString()).toBe('page=0&size=20&sort=daysVacant%2Cdesc');
  });

  it('loads a deep link, changes filters, sorts, pages and refreshes the entire report', async () => {
    const occupancy = install(url => ok({ ...report, availableRooms: { ...report.availableRooms, page: Number(url.searchParams.get('page')) } }));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Phân tích phòng trống' })).toBeTruthy();
    await screen.findByText('Trang 1/2 (22 phòng)');
    expect(screen.getByText('81,48%')).toBeTruthy();
    expect(screen.getByText('Chưa xác định')).toBeTruthy();
    expect(screen.getByText('Chưa có giá hợp lệ')).toBeTruthy();
    expect(screen.getByText(/Có 1 phòng có trạng thái/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Khu vực'), { target: { value: 'a1' } });
    await waitFor(() => expect(occupancy.mock.lastCall?.[0].searchParams.get('areaId')).toBe('a1'));
    fireEvent.change(screen.getByLabelText('Tòa nhà'), { target: { value: 'b1' } });
    await waitFor(() => expect(occupancy.mock.lastCall?.[0].searchParams.get('buildingId')).toBe('b1'));
    fireEvent.change(screen.getByLabelText('Sắp xếp'), { target: { value: 'defaultRent,asc' } });
    await waitFor(() => expect(occupancy.mock.lastCall?.[0].searchParams.get('sort')).toBe('defaultRent,asc'));
    fireEvent.click(await screen.findByRole('button', { name: 'Trang sau' }));
    await screen.findByText('Trang 2/2 (22 phòng)');
    expect(screen.getByText('81,48%')).toBeTruthy();
    expect(screen.getByText(/Có 3 phòng trống chưa có giá/)).toBeTruthy();
    const calls = occupancy.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới báo cáo' }));
    await waitFor(() => expect(occupancy.mock.calls.length).toBe(calls + 1));
    expect(occupancy.mock.lastCall?.[0].searchParams.get('page')).toBe('1');
    fireEvent.change(screen.getByLabelText('Khu vực'), { target: { value: 'a2' } });
    await waitFor(() => expect(occupancy.mock.lastCall?.[0].searchParams.get('areaId')).toBe('a2'));
    expect(occupancy.mock.lastCall?.[0].searchParams.has('buildingId')).toBe(false);
    expect(occupancy.mock.lastCall?.[0].searchParams.get('page')).toBe('0');
  });

  it('blocks an incompatible pair before requesting the report', async () => {
    const occupancy = install();
    render(<OccupancyReportPage {...callbacks} query={{ ...query, areaId: 'a2', buildingId: 'b1' }} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Bộ lọc không hợp lệ');
    expect(occupancy).not.toHaveBeenCalled();
  });

  it('ignores a stale response after a filter change', async () => {
    const stale = deferred<Response>();
    const occupancy = install(url => url.searchParams.has('areaId') ? ok({ ...report, vacancyRate: 42 }) : stale.promise);
    const view = render(<OccupancyReportPage {...callbacks} query={query} />);
    await waitFor(() => expect(occupancy).toHaveBeenCalledTimes(1));
    view.rerender(<OccupancyReportPage {...callbacks} query={{ ...query, areaId: 'a1' }} />);
    expect(await screen.findByText('42%')).toBeTruthy();
    await act(async () => stale.resolve(ok(report)));
    expect(screen.getByText('42%')).toBeTruthy();
    expect(screen.queryByText('81,48%')).toBeNull();
  });

  it.each([
    [0, 0, 0, null, 'Chưa có dữ liệu phòng để phân tích'],
    [3, 3, 0, 0, 'Tỷ lệ lấp đầy đạt 100% – Không có phòng trống'],
    [3, 0, 3, null, 'Hiện không có phòng trống sẵn sàng cho thuê'],
  ])('renders the correct empty state for %i total rooms', async (totalRooms, occupiedRooms, unavailableRooms, vacancyRate, message) => {
    install(() => ok({ ...report, totalRooms, occupiedRooms, unavailableRooms, vacancyRate, availableVacantRooms: 0, vacantRentPotential: 0, byBuilding: [], warnings: [],
      availableRooms: { ...report.availableRooms, items: [], totalPages: 0, totalElements: 0 } }));
    render(<OccupancyReportPage {...callbacks} query={query} />);
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByText(vacancyRate === null ? 'N/A' : '0%')).toBeTruthy();
    expect(screen.getByText('0 VNĐ/tháng')).toBeTruthy();
  });

  it.each([403, 404])('shows access errors for HTTP %i without showing report figures', async status => {
    install(() => failure(status, 'Denied'));
    render(<OccupancyReportPage {...callbacks} query={query} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Không thể truy cập');
    expect(screen.queryByText('0 VNĐ/tháng')).toBeNull();
  });

  it('retries a failed query and opens the existing room and rental routes', async () => {
    let fail = true;
    install(() => fail ? failure(500, 'Database unavailable') : ok(report));
    render(<OccupancyReportPage {...callbacks} query={query} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Không thể tải dữ liệu báo cáo phòng trống');
    expect(screen.queryByText('0 VNĐ/tháng')).toBeNull();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết phòng A101' }));
    expect(callbacks.onRoom).toHaveBeenCalledWith('/rooms?buildingId=b1&roomId=room-1&action=detail');
    fireEvent.click(screen.getByRole('button', { name: 'Lập hợp đồng phòng A101' }));
    expect(callbacks.onContract).toHaveBeenCalledWith('/rental-contracts?create=true&roomId=room-1');
  });

  it.each([
    ['', '', false],
    ['&roomId=room-1', 'room-1', false],
    ['&roomId=gone', '', true],
  ])('initializes the existing rental form for %s', async (suffix, expected, unavailable) => {
    window.history.replaceState(null, '', '/rental-contracts?create=true' + suffix);
    install();
    render(<App />);
    const option = await screen.findByRole('option', { name: /A101/ });
    const select = option.closest('select');
    expect(select?.value).toBe(expected);
    expect(Boolean(screen.queryByText(/Phòng đã chọn không còn khả dụng/))).toBe(unavailable);
  });
});
