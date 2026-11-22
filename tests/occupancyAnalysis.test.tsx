import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { OccupancyAnalysisPage } from '../src/components/reports/OccupancyAnalysisPage';
import { decodeOccupancyAnalysis, getOccupancyAnalysis } from '../src/services/occupancyAnalysisApi';
import {
  occupancyAnalysisPath as path, occupancyAnalysisUrl, parseOccupancyAnalysisRoute, validateTrendRange,
} from '../src/utils/occupancyAnalysisNavigation';
import { deferred, failure, ok } from './apiMock';
import fixture from './fixtures/occupancy-analysis.json';

const query = parseOccupancyAnalysisRoute(path, '')!;
const areas = [{ id: 'north', name: 'Khu Bắc' }, { id: 'south', name: 'Khu Nam' }];
const buildings = fixture.byBuilding.map(item => ({ id: item.buildingId, name: item.buildingName, areaId: 'north' }));

function install(respond: (url: URL, init?: RequestInit) => Response | Promise<Response> = () => ok({ occupancyAnalysis: fixture }), role = 'HOST', expired = false) {
  const occupancy = vi.fn(respond);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), window.location.origin);
    switch (url.pathname) {
      case '/api/v1/auth/me': return expired ? failure(401, 'Expired') : ok({ accountId: 'acct', loginName: 'account', role, hostId: role === 'HOST' ? 'host' : null });
      case '/api/v1/auth/csrf': return ok({ token: 'csrf-test', headerName: 'X-CSRF-TOKEN' });
      case '/api/v1/auth/refresh': return failure(401, 'Phiên hết hạn');
      case '/api/v1/areas': return ok(areas);
      case '/api/v1/buildings': return ok(buildings);
      case '/api/v1/reports/occupancy': return occupancy(url, init);
      default: return failure(404, 'Not found');
    }
  }));
  return occupancy;
}

function mount(next = query) {
  const onNavigate = vi.fn();
  const onSessionExpired = vi.fn();
  const view = render(<OccupancyAnalysisPage query={next} onNavigate={onNavigate} onSessionExpired={onSessionExpired} />);
  return { ...view, onNavigate, onSessionExpired };
}

describe('UC71 occupancy analysis', () => {
  it('validates date-only ranges and keeps the URL contract separate from UC69', () => {
    expect(parseOccupancyAnalysisRoute('/reports/occupancy', '')).toBeNull();
    expect(validateTrendRange()).toBe(true);
    expect(validateTrendRange('2025-10-20', '2026-10-21')).toBe(true);
    expect(validateTrendRange('2025-10-19', '2026-10-21')).toBe(false);
    expect(validateTrendRange('2026-02-30', '2026-03-01')).toBe(false);
    expect(validateTrendRange('2026-10-20', '2026-10-22', '2026-10-21')).toBe(false);
    expect(validateTrendRange('2026-10-21')).toBe(false);
    expect(occupancyAnalysisUrl({ ...query, buildingId: 'a/b' })).toBe(path + '?buildingId=a%2Fb');
  });

  it('requests only UC71 filters and rejects malformed responses', async () => {
    const request = install();
    const data = await getOccupancyAnalysis({ ...query, areaId: 'north', fromDate: '2026-10-01', toDate: '2026-10-21' });
    expect(data.occupancyRate).toBeNull();
    expect(request.mock.calls[0][0].search).toBe('?areaId=north&fromDate=2026-10-01&toDate=2026-10-21');
    expect(() => decodeOccupancyAnalysis({ status: 200, data: { occupancyAnalysis: { ...fixture, occupancyRate: '90' } } })).toThrow();
  });

  it('keeps server ranking, colours exact boundaries and exposes links, warnings and missing months', async () => {
    install();
    const { container, onNavigate } = mount();
    const comparison = await screen.findByRole('region', { name: 'Biểu đồ so sánh tòa nhà' });
    const chartLinks = within(comparison).getAllByRole('link');
    expect(chartLinks.map(link => link.closest('li')?.dataset.band)).toEqual(['high', 'high', 'medium', 'low', 'unknown']);
    expect(chartLinks[3].textContent).toContain('0,0%');
    expect(chartLinks[4].textContent).toContain('N/A');
    const ranking = screen.getByRole('region', { name: 'Bảng xếp hạng tòa nhà' });
    expect(within(ranking).getAllByRole('link').map(link => link.textContent)).toEqual(['Tòa B', 'Tòa A', 'Tòa C', 'Tòa D']);
    fireEvent.click(chartLinks[4]);
    fireEvent.click(within(ranking).getByRole('link', { name: 'Tòa B' }));
    expect(onNavigate.mock.calls).toEqual([['/rooms?view=matrix&buildingId=b5'], ['/rooms?view=matrix&buildingId=b2']]);
    expect(screen.getByText(/Tòa E: Hợp đồng thuê chồng lấn/)).toBeTruthy();
    expect(container.querySelectorAll('.oa-point')).toHaveLength(3);
    expect(container.querySelectorAll('[data-series-segment]')).toHaveLength(1);
    expect(screen.getByText('Không có ngày-phòng hoạt động')).toBeTruthy();
    expect(screen.getByText('* Tháng hiện tại chưa hoàn chỉnh.')).toBeTruthy();
  });

  it('validates drafts, drops incompatible buildings and ignores superseded responses', async () => {
    const old = deferred<Response>();
    const request = install(url => url.searchParams.get('areaId') === 'north'
      ? old.promise : ok({ occupancyAnalysis: { ...fixture, activeRooms: 5 } }));
    const north = { ...query, areaId: 'north', buildingId: 'b1' };
    const view = mount(north);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Khu vực'), { target: { value: 'south' } });
    expect(view.onNavigate).toHaveBeenLastCalledWith(path + '?areaId=south');
    view.rerender(<OccupancyAnalysisPage query={{ ...query, areaId: 'south' }} onNavigate={view.onNavigate} onSessionExpired={view.onSessionExpired} />);
    await screen.findByText('Ngày chốt 21/10/2026.', { exact: false });
    expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await act(async () => old.resolve(ok({ occupancyAnalysis: { ...fixture, activeRooms: 999 } })));
    expect(screen.queryByText('999')).toBeNull();
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(screen.getByRole('alert').textContent).toContain('Bộ lọc không hợp lệ');
    expect(request).toHaveBeenCalledTimes(2);
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-10-21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(view.onNavigate).toHaveBeenLastCalledWith(path + '?areaId=south&fromDate=2026-10-01&toDate=2026-10-21');
  });

  it('rejects incompatible deep links before fetching and sends unknown IDs to the API', async () => {
    const request = install(() => failure(404, 'Not found'));
    const view = mount({ ...query, areaId: 'south', buildingId: 'b1' });
    expect((await screen.findByRole('alert')).textContent).toContain('Bộ lọc không hợp lệ');
    expect(request).not.toHaveBeenCalled();
    view.rerender(<OccupancyAnalysisPage query={{ ...query, areaId: 'south', buildingId: 'unknown' }} onNavigate={view.onNavigate} onSessionExpired={view.onSessionExpired} />);
    await screen.findByText('Không thể truy cập dữ liệu được yêu cầu.');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('retries with the same filters and isolates a trend error from current KPIs', async () => {
    let attempt = 0;
    const request = install(() => ++attempt === 1 ? failure(500, 'Error')
      : ok({ occupancyAnalysis: { ...fixture, trendStatus: 'ERROR', series: [], trendMessage: 'Xu hướng tạm thời lỗi' } }));
    mount({ ...query, fromDate: '2026-10-01', toDate: '2026-10-21' });
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại', exact: true }));
    await screen.findByText('Xu hướng tạm thời lỗi');
    expect(screen.getByText('Tỷ lệ lấp đầy hiện tại')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới báo cáo' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    expect(request.mock.calls.map(([url]) => url.search)).toEqual(Array(3).fill('?fromDate=2026-10-01&toDate=2026-10-21'));
  });

  it('uses the session-expiry callback on a report 401', async () => {
    install(() => failure(401, 'Expired'), 'HOST', true);
    const view = mount();
    await waitFor(() => expect(view.onSessionExpired).toHaveBeenCalled());
  });

  it('keeps the report and navigation hidden from customers opening a deep link', async () => {
    window.history.replaceState(null, '', path);
    const request = install(undefined, 'CUSTOMER');
    const view = render(<App />);
    await screen.findByText(/không có quyền/i);
    expect(screen.queryByRole('heading', { name: 'Tỷ lệ lấp đầy' })).toBeNull();
    expect(request).not.toHaveBeenCalled();
    view.unmount();
    window.history.replaceState(null, '', '/');
  });
});
