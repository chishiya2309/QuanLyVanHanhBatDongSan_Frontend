import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import App from '../src/App';
import { ExpiringLeaseReportPage } from '../src/components/reports/ExpiringLeaseReportPage';
import { expiringLeasePath, parseExpiringLeaseRoute, validExpiryDates } from '../src/utils/expiringLeaseNavigation';
import { parseRentalContractRoute } from '../src/utils/rentalContractNavigation';
import { deferred, failure, ok } from './apiMock';

const query = parseExpiringLeaseRoute(expiringLeasePath, '')!;
const item = {
  contractId: 'lease-1', contractNumber: 'HD-17', roomId: 'room-a', roomCode: 'A101', buildingName: 'Tòa A',
  effectiveEndDate: '2026-11-20', daysRemaining: -1, handoverStatus: 'Đã bàn giao – Chờ hoàn tất hợp đồng',
  depositRequired: 3500000, depositHeld: null, customerName: 'Khách thuê', customerPhone: null,
};
const report = {
  asOfDate: '2026-11-21', generatedAt: '2026-11-21T00:00:00Z',
  filter: { fromDate: '2026-11-21', toDate: '2027-01-20' },
  kpi: { expiringContracts: 3, expiringRooms: 3, overdueContracts: 5 },
  expiryGroups: [{ bucket: 'OVERDUE', total: 5, items: [item] }, { bucket: 'DAYS_0_TO_7', total: 3, items: [] }],
  page: { page: 0, size: 1, totalElements: 8, totalPages: 8 },
  warnings: [],
};
const callbacks = { onNavigate: vi.fn(), onContract: vi.fn(), onSessionExpired: vi.fn() };

function mockApi(reportResponse: (url: URL) => Response | Promise<Response> = () => ok(report),
  saveResponse: () => Response = () => ok({ expiryThresholdDays: 90, source: 'HOST_OVERRIDE' })) {
  const reportRequest = vi.fn(reportResponse);
  const save = vi.fn(saveResponse);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), window.location.origin);
    switch (url.pathname) {
      case '/api/v1/auth/me': return ok({ accountId: 'host', role: 'HOST', loginName: 'Host', hostId: 'host' });
      case '/api/v1/auth/csrf': return ok({ token: 'csrf-token', headerName: 'X-CSRF-TOKEN' });
      case '/api/v1/areas': return ok([{ id: 'a1', name: 'Khu Bắc' }, { id: 'a2', name: 'Khu Nam' }]);
      case '/api/v1/buildings': return ok([{ id: 'b1', name: 'Tòa A', areaId: 'a1' }]);
      case '/api/v1/reports/expiring-leases': return reportRequest(url);
      case '/api/v1/host/settings/expiry-threshold':
        if (init?.method === 'PUT') {
          expect(new Headers(init.headers).get('X-CSRF-TOKEN')).toBe('csrf-token');
          expect(JSON.parse(String(init.body))).toEqual({ expiryThresholdDays: 90 });
          return save();
        }
        return ok({ expiryThresholdDays: 60, source: 'BACKEND_DEFAULT' });
      default: return failure(404, 'Not found');
    }
  }));
  return { reportRequest, save };
}

beforeEach(() => {
  window.history.replaceState(null, '', expiringLeasePath);
  vi.clearAllMocks();
});

it('validates calendar boundaries including leap days', () => {
  expect(validExpiryDates('2024-02-29', '2025-03-01')).toBe(true);
  expect(validExpiryDates('2024-02-29', '2025-03-02')).toBe(false);
  expect(validExpiryDates('2026-02-29', '2026-03-01')).toBe(false);
  expect(validExpiryDates('2026-11-21', '2026-11-21')).toBe(true);
  expect(validExpiryDates('2026-11-21')).toBe(false);
  expect(validExpiryDates('2026-11-22', '2026-11-21')).toBe(false);
});

it('shows totals independently from page items and sends contract actions as navigation', async () => {
  const { reportRequest } = mockApi();
  render(<ExpiringLeaseReportPage query={query} {...callbacks} />);
  expect(await screen.findByText('Đang xem 1 / 8 hợp đồng. Trang 1/8')).toBeTruthy();
  expect(screen.getByText('Không có mục trên trang này.')).toBeTruthy();
  expect(screen.getAllByText(/Chưa xác định/)).toHaveLength(2);
  expect(screen.getByText(/07:00/)).toBeTruthy();
  for (const [label, action] of [['Gia hạn', 'extend'], ['Bàn giao', 'move-out'], ['Thanh lý', 'terminate']]) {
    fireEvent.click(screen.getAllByRole('button', { name: label + ' HD-17' })[0]);
    const url = new URL(callbacks.onContract.mock.lastCall![0], 'http://localhost');
    expect(parseRentalContractRoute(url.pathname, url.search)).toMatchObject({ detailId: 'lease-1', action });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  expect(callbacks.onNavigate.mock.lastCall![0]).toContain('page=1');
  expect(reportRequest).toHaveBeenCalledTimes(1);
});

it('does not query invalid dates and ignores an older response after changing filters', async () => {
  const old = deferred<Response>();
  const { reportRequest } = mockApi(url => url.searchParams.has('areaId') ? ok(report) : old.promise);
  const view = render(<ExpiringLeaseReportPage query={{ ...query, fromDate: '2026-11-21' }} {...callbacks} />);
  expect(screen.getByRole('alert').textContent).toContain('Nhập đủ hai ngày');
  expect(reportRequest).not.toHaveBeenCalled();
  view.rerender(<ExpiringLeaseReportPage query={query} {...callbacks} />);
  await waitFor(() => expect(reportRequest).toHaveBeenCalledTimes(1));
  view.rerender(<ExpiringLeaseReportPage query={{ ...query, areaId: 'a1' }} {...callbacks} />);
  await screen.findByText('Đang xem 1 / 8 hợp đồng. Trang 1/8');
  await act(async () => old.resolve(failure(500, 'old request')));
  expect(screen.queryByRole('alert')).toBeNull();
});

it('shows 5xx as retryable and displays an overdue-only report after retry', async () => {
  const { reportRequest } = mockApi();
  reportRequest.mockReturnValueOnce(failure(500, 'offline')).mockReturnValueOnce(ok({
    ...report, kpi: { expiringContracts: 0, expiringRooms: 0, overdueContracts: 5 },
    expiryGroups: report.expiryGroups.slice(0, 1),
  }));
  render(<ExpiringLeaseReportPage query={query} {...callbacks} />);
  expect((await screen.findByRole('alert')).textContent).toContain('Không thể tải báo cáo');
  expect(screen.queryByText('Hợp đồng sắp hết hạn')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Đang xem 1 / 8 hợp đồng. Trang 1/8')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Quá hạn chưa xử lý 5' })).toBeTruthy();
});

it.each([false, true])('persists the threshold and preserves custom dates (%s)', async custom => {
  const { reportRequest, save } = mockApi();
  save.mockReturnValueOnce(failure(500, 'offline'));
  const selected = custom ? { ...query, fromDate: '2026-11-21', toDate: '2026-12-01' } : query;
  render(<ExpiringLeaseReportPage query={selected} {...callbacks} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh ngưỡng' }));
  const field = screen.getByLabelText('Ngưỡng theo dõi (ngày)');
  const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Lưu ngưỡng' }));
  fireEvent.change(field, { target: { value: '366' } });
  submit();
  expect(screen.getByRole('alert').textContent).toContain('1 đến 365');
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(field, { target: { value: '90' } });
  submit();
  expect((await screen.findByRole('alert')).textContent).toContain('Không thể lưu');
  expect(screen.getByText('60 ngày')).toBeTruthy();
  submit();
  expect(await screen.findByText('90 ngày')).toBeTruthy();
  await waitFor(() => expect(reportRequest).toHaveBeenCalledTimes(custom ? 1 : 2));
});

it('restores a Host report from a direct URL and browser history', async () => {
  const { reportRequest } = mockApi();
  window.history.replaceState(null, '', expiringLeasePath + '?areaId=a1&page=2');
  render(<App />);
  await screen.findByRole('heading', { name: 'Phòng sắp trống' });
  await waitFor(() => expect(reportRequest.mock.lastCall?.[0].searchParams.get('page')).toBe('2'));
  await act(async () => {
    window.history.pushState(null, '', expiringLeasePath + '?areaId=a2');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await waitFor(() => expect(reportRequest.mock.lastCall?.[0].searchParams.get('areaId')).toBe('a2'));
});
