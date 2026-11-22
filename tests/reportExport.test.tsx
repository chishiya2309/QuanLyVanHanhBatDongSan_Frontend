import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OccupancyReportPage } from '../src/components/reports/OccupancyReportPage';
import { ExpiringLeaseReportPage } from '../src/components/reports/ExpiringLeaseReportPage';
import { OccupancyAnalysisPage } from '../src/components/reports/OccupancyAnalysisPage';
import { ReportExportButton } from '../src/components/reports/ReportExportDialog';
import { exportReport } from '../src/services/reportExportApi';
import { invalidateSession } from '../src/services/sessionClient';
import { deferred, failure, ok } from './apiMock';

const areas = [{ id: 'a', name: 'Khu A' }, { id: 'b', name: 'Khu B' }];
const buildings = [{ id: 'b1', name: 'Tòa A', areaId: 'a' }, { id: 'b2', name: 'Tòa B', areaId: 'b' }];
const catalog = { areas, buildings };
const scope = { areaId: 'a', buildingId: 'b1' };
const range = { fromDate: '2025-10-20', toDate: '2026-10-21' };
const callbacks = { onNavigate: vi.fn(), onRoom: vi.fn(), onContract: vi.fn(), onProperties: vi.fn(), onSessionExpired: vi.fn() };
const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const pdf = 'application/pdf';
const getButton = () => screen.getByRole('button', { name: 'Xuất báo cáo tổng hợp' });
const getDialog = () => within(screen.getByRole('dialog'));
const submit = () => fireEvent.click(getDialog().getByRole('button', { name: 'Tải báo cáo' }));
const group = (name: RegExp) => within(getDialog().getByRole('group', { name }));
const expiry = () => group(/^Ngày hết hạn hợp đồng$/);
const trend = () => group(/^Xu hướng tỷ lệ lấp đầy$/);

function binary(mime = xlsx, name?: string) {
  const headers = new Headers({ 'Content-Type': mime });
  if (name) headers.set('Content-Disposition', name);
  return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers });
}

function install(reply: (init: RequestInit) => Response | Promise<Response> = () => binary()) {
  const calls = vi.fn(reply);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), window.location.origin).pathname;
    if (path.endsWith('/auth/csrf')) return ok({ token: 'token', headerName: 'X-CSRF-TOKEN' });
    if (path.endsWith('/auth/refresh') || path.endsWith('/auth/me')) return failure(401, 'Phiên đã hết hạn');
    if (path.endsWith('/areas')) return ok(areas);
    if (path.endsWith('/buildings')) return ok(buildings);
    if (path.endsWith('/expiry-threshold')) return ok({ expiryThresholdDays: 60, source: 'BACKEND_DEFAULT' });
    if (path.endsWith('/reports/export') && init) return calls(init);
    return failure(404, 'Không có dữ liệu kiểm thử');
  }));
  return calls;
}

function button(source: Parameters<typeof ReportExportButton>[0]['source'] = { kind: 'occupancy' }) {
  return render(<ReportExportButton source={source} catalog={catalog} catalogFailed={false}
    onRetryCatalog={vi.fn()} onSessionExpired={callbacks.onSessionExpired} />);
}

beforeEach(() => {
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:uc72');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('UC72 report export', () => {
  it.each(['occupancy', 'expiring-leases', 'occupancy-analysis'] as const)(
    'opens from %s, inherits only the matching range, and submits the same defaults', async kind => {
      const calls = install();
      if (kind === 'occupancy') render(<OccupancyReportPage query={{ ...scope, page: 0, size: 20, sort: 'daysVacant,desc' }} {...callbacks} />);
      if (kind === 'expiring-leases') render(<ExpiringLeaseReportPage query={{ kind, ...scope, ...range, page: 0, size: 20, sort: 'daysRemaining,asc' }} {...callbacks} />);
      if (kind === 'occupancy-analysis') render(<OccupancyAnalysisPage query={{ kind, ...scope, ...range }} {...callbacks} />);
      fireEvent.click(getButton());
      await waitFor(() => expect((getDialog().getByLabelText('Tòa nhà') as HTMLSelectElement).disabled).toBe(false));
      expect((getDialog().getByLabelText('Khu vực') as HTMLSelectElement).value).toBe('a');
      expect((getDialog().getByLabelText('Tòa nhà') as HTMLSelectElement).value).toBe('b1');
      expect((expiry().getByLabelText('Chế độ') as HTMLSelectElement).value).toBe(kind === 'expiring-leases' ? 'custom' : 'default');
      expect((trend().getByLabelText('Chế độ') as HTMLSelectElement).value).toBe(kind === 'occupancy-analysis' ? 'custom' : 'default');
      if (kind !== 'occupancy') {
        const dates = kind === 'expiring-leases' ? expiry() : trend();
        expect((dates.getByLabelText('Từ ngày') as HTMLInputElement).value).toBe(range.fromDate);
        fireEvent.change(dates.getByLabelText('Chế độ'), { target: { value: 'default' } });
      }
      submit();
      await getDialog().findByText(/Tệp đã sẵn sàng/);
      const init = calls.mock.lastCall![0];
      expect(JSON.parse(String(init.body))).toEqual({ format: 'XLSX', ...scope });
      expect(init.credentials).toBe('include');
      expect(new Headers(init.headers).get('X-CSRF-TOKEN')).toBe('token');
      fireEvent.click(getDialog().getByRole('button', { name: 'Đóng' }));
      expect(document.activeElement).toBe(getButton());
    },
  );

  it('keeps scopes and custom ranges independent, including Vietnam midnight and the 366-day boundary', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T17:00:00Z'));
    const calls = install();
    button({ kind: 'occupancy-analysis', ...scope, ...range });
    fireEvent.click(getButton());
    fireEvent.change(getDialog().getByLabelText('Khu vực'), { target: { value: 'b' } });
    expect((getDialog().getByLabelText('Tòa nhà') as HTMLSelectElement).value).toBe('');
    fireEvent.change(expiry().getByLabelText('Chế độ'), { target: { value: 'custom' } });
    fireEvent.change(expiry().getByLabelText('Từ ngày'), { target: { value: '2025-10-19' } });
    submit();
    expect(calls).not.toHaveBeenCalled();
    fireEvent.change(expiry().getByLabelText('Đến ngày'), { target: { value: range.toDate } });
    submit();
    expect(calls).not.toHaveBeenCalled();
    fireEvent.change(expiry().getByLabelText('Từ ngày'), { target: { value: range.fromDate } });
    fireEvent.change(trend().getByLabelText('Đến ngày'), { target: { value: '2026-10-22' } });
    submit();
    expect(calls).not.toHaveBeenCalled();
    fireEvent.change(trend().getByLabelText('Đến ngày'), { target: { value: range.toDate } });
    submit();
    await getDialog().findByText(/Tệp đã sẵn sàng/);
    expect(JSON.parse(String(calls.mock.lastCall![0].body))).toEqual({
      format: 'XLSX', areaId: 'b', expiryRange: range, trendRange: range,
    });
  });

  it('revalidates a dialog left open across the Vietnam business-date boundary', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T16:59:59Z'));
    const calls = install();
    button();
    fireEvent.click(getButton());
    fireEvent.change(trend().getByLabelText('Chế độ'), { target: { value: 'custom' } });
    fireEvent.change(trend().getByLabelText('Từ ngày'), { target: { value: '2026-10-20' } });
    fireEvent.change(trend().getByLabelText('Đến ngày'), { target: { value: '2026-10-21' } });
    submit();
    expect(calls).not.toHaveBeenCalled();
    vi.setSystemTime(new Date('2026-10-20T17:00:00Z'));
    submit();
    await getDialog().findByText(/Tệp đã sẵn sàng/);
    expect(calls).toHaveBeenCalledOnce();
  });

  it('keeps the draft after 422, suppresses duplicate submissions and offers a manual PDF download', async () => {
    const response = deferred<Response>();
    const calls = install(() => response.promise);
    button({ kind: 'expiring-leases', ...scope, fromDate: '2027-01-02', toDate: '2027-01-01' });
    fireEvent.click(getButton());
    expect((expiry().getByLabelText('Chế độ') as HTMLSelectElement).value).toBe('default');
    fireEvent.change(getDialog().getByLabelText('Định dạng'), { target: { value: 'PDF' } });
    submit();
    fireEvent.submit(getDialog().getByRole('button', { name: 'Tải báo cáo' }).closest('form')!);
    response.resolve(failure(422, 'Vượt số trang. Vui lòng chọn Excel.'));
    await getDialog().findByRole('alert');
    expect(getDialog().getByText('Vượt số trang. Vui lòng chọn Excel.')).toBeTruthy();
    expect((getDialog().getByLabelText('Định dạng') as HTMLSelectElement).value).toBe('PDF');
    expect(calls).toHaveBeenCalledTimes(1);
    calls.mockImplementation(() => binary(pdf));
    submit();
    const manual = await getDialog().findByRole('link', { name: 'Tải thủ công' });
    expect(manual.getAttribute('download')).toBe('bao-cao-bat-dong-san.pdf');
    manual.addEventListener('click', event => event.preventDefault(), { once: true });
    fireEvent.click(manual);
    expect(calls).toHaveBeenCalledTimes(2);
    act(() => invalidateSession());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:uc72');
  });

  it('keeps the inherited scope while catalog verification fails and resumes after retry', async () => {
    const calls = install();
    const retry = vi.fn();
    const source = { kind: 'occupancy', ...scope } as const;
    const view = render(<ReportExportButton source={source} catalogFailed onRetryCatalog={retry}
      onSessionExpired={callbacks.onSessionExpired} />);
    fireEvent.click(getButton());
    expect((getDialog().getByLabelText('Tòa nhà') as HTMLSelectElement).value).toBe(scope.buildingId);
    expect((getDialog().getByRole('button', { name: 'Tải báo cáo' }) as HTMLButtonElement).disabled).toBe(true);
    submit();
    expect(calls).not.toHaveBeenCalled();
    fireEvent.click(getDialog().getByRole('button', { name: 'Tải lại danh mục' }));
    expect(retry).toHaveBeenCalledOnce();
    view.rerender(<ReportExportButton source={source} catalog={catalog} catalogFailed={false} onRetryCatalog={retry}
      onSessionExpired={callbacks.onSessionExpired} />);
    submit();
    await getDialog().findByText(/Tệp đã sẵn sàng/);
    expect(JSON.parse(String(calls.mock.lastCall![0].body))).toEqual({ format: 'XLSX', ...scope });
  });

  it('aborts on close and discards late results', async () => {
    const pending = deferred<Response>();
    const calls = install(() => pending.promise);
    button();
    fireEvent.click(getButton());
    submit();
    await waitFor(() => expect(calls).toHaveBeenCalledOnce());
    fireEvent.click(getDialog().getByRole('button', { name: 'Đóng' }));
    expect(calls.mock.lastCall![0].signal?.aborted).toBe(true);
    await act(async () => pending.resolve(binary()));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('uses attachment filenames and rejects HTML, empty files and a terminal 401', async () => {
    const calls = install(() => binary(xlsx, 'attachment; filename="bao-cao.xlsx"'));
    const signal = new AbortController().signal;
    await expect(exportReport({ format: 'XLSX' }, signal)).resolves.toMatchObject({ filename: 'bao-cao.xlsx' });
    calls.mockImplementation(() => binary(xlsx, 'attachment; filename="../ bao-cao.xlsx"'));
    await expect(exportReport({ format: 'XLSX' }, signal)).resolves.toMatchObject({ filename: 'bao-cao-bat-dong-san.xlsx' });
    calls.mockImplementation(() => new Response('<html>error</html>', { headers: { 'Content-Type': 'text/html' } }));
    await expect(exportReport({ format: 'XLSX' }, signal)).rejects.toThrow(/đúng định dạng/);
    calls.mockImplementation(() => new Response('', { headers: { 'Content-Type': xlsx } }));
    await expect(exportReport({ format: 'XLSX' }, signal)).rejects.toThrow(/không có dữ liệu/);
    calls.mockImplementation(() => failure(401, 'Hết phiên'));
    button();
    fireEvent.click(getButton());
    submit();
    await waitFor(() => expect(callbacks.onSessionExpired).toHaveBeenCalledOnce());
  });
});
