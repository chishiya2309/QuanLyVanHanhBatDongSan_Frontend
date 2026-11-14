import { useCallback, useRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MeterReadingsPage } from '../src/components/meter/MeterReadingsPage';
import { meterUrl, parseMeterRoute } from '../src/utils/meterNavigation';
import { meterMessages as m, type MeterRoute } from '../src/types/meterReading';
import { fixtureItems, fixtureRoute, inheritedItem, initialItem, meterFixtureFetch, meterId, meterReply, savedFrom, savedItem, version } from './fixtures/meterReadings';

function mount(mode = 'full', initial: MeterRoute = fixtureRoute, override?: typeof window.fetch) {
  const calls: { path: string; method: string; body?: string }[] = [], expired = vi.fn();
  const fixture = meterFixtureFetch({ mode, onCall: (path, method, body) => calls.push({ path, method, body }) });
  vi.stubGlobal('fetch', override || fixture.fetcher);
  window.history.replaceState(null, '', meterUrl(initial));
  function Harness() {
    const [route, setRoute] = useState(initial), guard = useRef<(() => boolean) | null>(null);
    const registerGuard = useCallback((next: (() => boolean) | null) => { guard.current = next; }, []);
    return <MeterReadingsPage route={route} registerGuard={registerGuard} onSessionExpired={expired} onNavigate={(url) => {
      if (guard.current?.() === false) return;
      window.history.pushState(null, '', url); setRoute(parseMeterRoute(window.location.pathname, window.location.search)!);
    }} />;
  }
  render(<Harness />);
  return { calls, expired, items: fixture.items, writes: () => calls.filter((c) => c.method === 'POST' || c.method === 'PATCH') };
}
const input = (item: typeof initialItem, field = 'end') => document.getElementById('mr-' + item.requirementId + '-' + field) as HTMLInputElement;
const ready = () => screen.findByRole('heading', { name: 'Chỉ số theo phòng và dịch vụ' });
const batchReady = () => screen.findByRole('heading', { name: 'Bảng ghi hàng loạt' });
const type = async (target: HTMLInputElement, text: string) => { await userEvent.clear(target); await userEvent.type(target, text); };
const confirmInitial = () => userEvent.click(screen.getByRole('checkbox', { name: /Tôi xác nhận chỉ số đầu/ }));
async function fillBatch() {
  await batchReady(); await waitFor(() => expect(input(initialItem)?.disabled).toBe(false));
  await type(input(initialItem, 'start'), '0'); await confirmInitial(); await type(input(initialItem), '0'); await type(input(inheritedItem), '120.5');
}
describe('UC37 frontend flows', () => {
  it('opens without auto-choosing periods and searches only existing periods', async () => {
    const { writes } = mount('full', { ...fixtureRoute, fromDate: '', toDate: '', periodIds: [] });
    await screen.findByRole('button', { name: 'Tìm kỳ đã có' });
    await userEvent.click(screen.getByRole('button', { name: 'Tìm kỳ đã có' }));
    expect(await screen.findByText('Chọn ngày bắt đầu hợp lệ.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Từ ngày (bắt buộc)'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Đến trước ngày (bắt buộc)'), { target: { value: '2026-12-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Tìm kỳ đã có' }));
    await screen.findByRole('heading', { name: 'Chọn kỳ cần làm việc' });
    expect(writes()).toHaveLength(0);
    expect(screen.queryByRole('table')).toBeNull();
    await userEvent.click(screen.getByRole('checkbox', { name: /Phòng 101/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Dùng 1 kỳ đã chọn' }));
    await ready();
    expect(new URLSearchParams(window.location.search).get('periodIds')).toBe(initialItem.periodId);
  });
  it('saves an exact first reading with zero baseline, never counts drafts as completed', async () => {
    const { writes } = mount(); await ready();
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Ghi chỉ số' })[0].hasAttribute('disabled')).toBe(false));
    await userEvent.click(screen.getAllByRole('button', { name: 'Ghi chỉ số' })[0]);
    await type(input(initialItem, 'start'), '0');
    await type(input(initialItem), '1.123456789012345678901');
    expect(writes()).toHaveLength(0);
    expect(document.querySelectorAll('.mr-stats dd')[1].textContent).toBe('0');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu chỉ số' }));
    expect(await screen.findByText('Xác nhận chỉ số đầu cho đúng phòng, dịch vụ và kỳ.')).toBeTruthy();
    expect(writes()).toHaveLength(0);
    await confirmInitial(); await userEvent.click(screen.getByRole('button', { name: 'Lưu chỉ số' }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].body).toContain('"endIndex":1.123456789012345678901');
    expect(writes()[0].body).toContain('"startIndex":0');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Lưu chỉ số' })).toBeNull());
    expect(document.querySelectorAll('.mr-stats dd')[1].textContent).toBe('0');
  });
  it('accepts zero consumption and rejects negative or end below inherited start', async () => {
    const { writes } = mount(); await ready();
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Ghi chỉ số' })[1].hasAttribute('disabled')).toBe(false));
    await userEvent.click(screen.getAllByRole('button', { name: 'Ghi chỉ số' })[1]);
    expect(document.querySelector('input[name=startIndex]')).toBeNull();
    await type(input(inheritedItem), '99'); await userEvent.click(screen.getByRole('button', { name: 'Lưu chỉ số' }));
    expect(await screen.findByText('Chỉ số cuối phải lớn hơn hoặc bằng chỉ số đầu.')).toBeTruthy();
    expect(writes()).toHaveLength(0);
    await type(input(inheritedItem), '100'); await userEvent.click(screen.getByRole('button', { name: 'Lưu chỉ số' }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].body).not.toContain('startIndex');
  });
  it('batch preserves successful rows and retries only explicitly selected failed rows', async () => {
    const { writes } = mount('partial', { ...fixtureRoute, view: 'batch' }); await fillBatch();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu các mục đã chọn' }));
    await screen.findByText(/Đã lưu 1 mục; 1 mục chưa được lưu/);
    await waitFor(() => expect(input(inheritedItem).disabled).toBe(false));
    expect(input(inheritedItem).value).toBe('120.5'); expect(input(initialItem)).toBeNull();
    await userEvent.click(screen.getByRole('checkbox', { name: /Chọn lưu phòng 101, Nước/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu các mục đã chọn' }));
    await waitFor(() => expect(writes()).toHaveLength(2));
    const second = JSON.parse(writes()[1].body!);
    expect(second.items).toHaveLength(1); expect(second.items[0].roomServiceId).toBe(inheritedItem.roomServiceId);
  });
  it('does not send blank batches or describe NONE_SAVED as success', async () => {
    const { writes } = mount('none', { ...fixtureRoute, view: 'batch' }); await batchReady();
    await waitFor(() => expect(input(initialItem)?.disabled).toBe(false));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu các mục đã chọn' }));
    expect(await screen.findByText('Nhập hoặc chọn ít nhất một mục cần lưu.')).toBeTruthy(); expect(writes()).toHaveLength(0);
    await fillBatch(); await userEvent.click(screen.getByRole('button', { name: 'Lưu các mục đã chọn' }));
    await screen.findByText('Không có mục nào được lưu. Xem nguyên nhân tại từng mục.');
    expect(document.querySelector('.mr-notice--success')).toBeNull();
    expect(input(initialItem).value).toBe('0');
  });
  it('opens an existing DRAFT reading directly and PATCHes only the final index', async () => {
    const { writes } = mount('full', { ...fixtureRoute, readingId: savedItem.readingId });
    await screen.findByRole('heading', { name: 'Bản ghi đã lưu' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cập nhật chỉ số' }).hasAttribute('disabled')).toBe(false));
    await userEvent.click(screen.getByRole('button', { name: 'Cập nhật chỉ số' }));
    await type(input(savedItem), '12.5'); await userEvent.click(screen.getByRole('button', { name: 'Lưu cập nhật' }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].method).toBe('PATCH'); expect(JSON.parse(writes()[0].body!)).toEqual({ endIndex: 12.5, version });
  });
  it.each(['locked', 'issued'])('keeps %s reading visible but prevents editing', async (mode) => {
    const { writes } = mount(mode, { ...fixtureRoute, readingId: savedItem.readingId });
    await screen.findByRole('heading', { name: 'Bản ghi đã lưu' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cập nhật chỉ số' }).hasAttribute('disabled')).toBe(true));
    expect(writes()).toHaveLength(0); expect(document.querySelector('input[name=endIndex]')).toBeNull();
  });
  it('preserves saved confirmation when follow-up GET fails and never displays fabricated zero progress', async () => {
    const { writes } = mount('reload-error'); await ready();
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Ghi chỉ số' })[1].hasAttribute('disabled')).toBe(false));
    await userEvent.click(screen.getAllByRole('button', { name: 'Ghi chỉ số' })[1]);
    await type(input(inheritedItem), '120'); await userEvent.click(screen.getByRole('button', { name: 'Lưu chỉ số' }));
    await waitFor(() => expect(document.querySelector('.mr-notice--success')?.textContent).toBe('Đã lưu chỉ số.'));
    await waitFor(() => expect(screen.getAllByText(/Kết quả lưu đã được xác nhận/).length).toBeGreaterThan(0));
    expect(document.querySelector('.mr-stats--stale')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại tiến độ' }));
    expect(writes()).toHaveLength(1);
  });
  it('reconciles a lost batch response using GET and never replays committed rows', async () => {
    const { writes } = mount('lost-response', { ...fixtureRoute, view: 'batch' }); await fillBatch();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu các mục đã chọn' }));
    await screen.findByRole('button', { name: 'Đối chiếu kết quả thực tế' });
    expect(screen.getByRole('button', { name: 'Lưu các mục đã chọn' }).hasAttribute('disabled')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu kết quả thực tế' }));
    await screen.findByText('Đã đối chiếu dữ liệu thực tế. Kiểm tra kết quả từng mục trước khi thao tác tiếp.');
    expect(writes()).toHaveLength(1); expect(input(initialItem)).toBeNull(); expect(input(inheritedItem)).toBeNull();
  });
  it('distinguishes INTERRUPTED known saved and unknown rows, then requires review of confirmed-unsaved input', async () => {
    const { writes } = mount('interrupted', { ...fixtureRoute, view: 'batch' }); await fillBatch();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu các mục đã chọn' }));
    await screen.findByText(/Quá trình bị gián đoạn. Đã xác nhận lưu 1 mục/);
    await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu kết quả thực tế' }));
    await screen.findByText('Đã đối chiếu dữ liệu thực tế. Kiểm tra kết quả từng mục trước khi thao tác tiếp.');
    expect(input(inheritedItem).disabled).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Dùng dữ liệu mới và kiểm tra lại' }));
    expect(input(inheritedItem).disabled).toBe(false);
    expect(screen.getByRole('checkbox', { name: /Chọn lưu phòng 101, Nước/ }).getAttribute('checked')).toBeNull();
    expect(writes()).toHaveLength(1);
  });
  it.each(['stale', 'continuity'])('retains input after %s conflict and does not retry automatically', async (mode) => {
    const { writes } = mount(mode, { ...fixtureRoute, readingId: savedItem.readingId });
    await screen.findByRole('heading', { name: 'Bản ghi đã lưu' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cập nhật chỉ số' }).hasAttribute('disabled')).toBe(false));
    await userEvent.click(screen.getByRole('button', { name: 'Cập nhật chỉ số' }));
    await type(input(savedItem), '12'); await userEvent.click(screen.getByRole('button', { name: 'Lưu cập nhật' }));
    await screen.findByRole('button', { name: 'Dùng dữ liệu mới và kiểm tra lại' });
    expect(input(savedItem).value).toBe('12'); expect(writes()).toHaveLength(1);
  });
  it('uses backend progress, supports progress-first entry and navigates missing rooms without changing scope', async () => {
    const { writes } = mount('full', { ...fixtureRoute, view: 'progress' });
    await screen.findByRole('heading', { name: 'Phòng còn thiếu chỉ số' });
    expect(document.querySelectorAll('.mr-stats dd')[0].textContent).toBe('2');
    await userEvent.click(screen.getByRole('button', { name: 'Ghi đơn lẻ phòng 202' }));
    await ready(); expect(new URLSearchParams(window.location.search).get('periodIds')).toBe(fixtureRoute.periodIds.join(','));
    expect(writes()).toHaveLength(0);
  });
  it('renders genuine empty scope as zero but read failure as error without zero metrics', async () => {
    const { unmount } = render(<div />); unmount();
    const first = meterFixtureFetch({ mode: 'empty' });
    const r = mount('empty', fixtureRoute, first.fetcher);
    await screen.findAllByText(m.empty); expect(document.querySelectorAll('.mr-stats dd')[0].textContent).toBe('0');
    expect(r.writes()).toHaveLength(0);
  });
  it('does not expose progress as zero on read errors or protected content on forbidden', async () => {
    mount('read-error'); await screen.findAllByText('Không thể tải dữ liệu');
    expect(document.querySelector('.mr-stats')).toBeNull();
  });
  it('discards unsaved input on cancel, and guards navigation with dirty drafts', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { writes } = mount(); await ready();
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Ghi chỉ số' })[1].hasAttribute('disabled')).toBe(false));
    await userEvent.click(screen.getAllByRole('button', { name: 'Ghi chỉ số' })[1]); await type(input(inheritedItem), '120');
    await userEvent.click(screen.getByRole('link', { name: 'Xem tiến độ' })); expect(confirm).toHaveBeenCalled(); expect(input(inheritedItem).value).toBe('120');
    await userEvent.click(screen.getByRole('button', { name: 'Hủy nhập' })); expect(input(inheritedItem)).toBeNull(); expect(writes()).toHaveLength(0);
  });
  it('rejects late responses after changing selected scope', async () => {
    let resolve!: (response: Response) => void;
    const deferred = new Promise<Response>((done) => { resolve = done; });
    const fixture = meterFixtureFetch();
    mount('full', fixtureRoute, async (url, init) => String(url).includes('/items') ? deferred : fixture.fetcher(url, init));
    await screen.findByRole('heading', { name: 'Tiến độ toàn phạm vi' });
    await userEvent.click(screen.getByRole('link', { name: 'Xem tiến độ' }));
    await act(async () => { resolve(meterReply({ items: fixtureItems, total: 4, page: 0, size: 20 })); await deferred; });
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('shows no protected ledger for a rejected scope', async () => {
    mount('forbidden'); await screen.findByText(m.forbidden);
    expect(screen.queryByRole('table')).toBeNull(); expect(document.querySelector('.mr-stats')).toBeNull();
  });
  it('keeps completed scope navigable to an eligible existing correction', async () => {
    const fixture = meterFixtureFetch();
    mount('full', { ...fixtureRoute, periodIds: [savedItem.periodId], view: 'progress' }, async (input, init) => {
      if (String(input).includes('/progress')) return meterReply({ required: 1, completed: 1, pending: 0, pendingRoomIds: [], pendingRooms: [] });
      if (String(input).includes('/items')) return meterReply({ items: [savedItem], total: 1, page: 0, size: 20 });
      return fixture.fetcher(input, init);
    });
    await screen.findByText('Tất cả phòng đã ghi đủ chỉ số. Bạn vẫn có thể xem hoặc cập nhật bản ghi đủ điều kiện.');
    await userEvent.click(screen.getByRole('link', { name: 'Ghi đơn lẻ' }));
    await screen.findByRole('link', { name: 'Xem / cập nhật' });
    await userEvent.click(screen.getByRole('link', { name: 'Xem / cập nhật' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cập nhật chỉ số' }).hasAttribute('disabled')).toBe(false));
  });
  it('keeps full-scope progress independent of item pagination', async () => {
    const items = Array.from({ length: 21 }, (_, index) => ({ ...inheritedItem, requirementId: meterId(1000 + index), roomServiceId: meterId(2000 + index), roomId: meterId(3000 + index), roomCode: String(100 + index) }));
    const fixture = meterFixtureFetch();
    mount('full', fixtureRoute, async (input, init) => {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname.endsWith('/items')) { const page = Number(url.searchParams.get('page')); return meterReply({ items: items.slice(page * 20, (page + 1) * 20), total: 21, page, size: 20 }); }
      if (url.pathname.endsWith('/progress')) return meterReply({ required: 21, completed: 0, pending: 21, pendingRoomIds: items.map((i) => i.roomId), pendingRooms: items.map((i) => ({ roomId: i.roomId, roomCode: i.roomCode, buildingId: i.buildingId, missingRequirementIds: [i.requirementId] })) });
      return fixture.fetcher(input, init);
    });
    await waitFor(() => expect(document.querySelectorAll('.mr-table tbody th')).toHaveLength(20));
    expect(document.querySelectorAll('.mr-stats dd')[0].textContent).toBe('21');
    await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(document.querySelectorAll('.mr-table tbody th')).toHaveLength(1));
    expect(document.querySelectorAll('.mr-stats dd')[0].textContent).toBe('21');
  });
  it('keeps session-revoked batch successes known, clears protected data and requests login', async () => {
    const fixture = meterFixtureFetch();
    const { expired } = mount('full', { ...fixtureRoute, view: 'batch' }, async (input, init) => {
      if (String(input).endsWith('/batch')) return meterReply({ outcome: 'INTERRUPTED', saved: 1, failed: 1, results: [
        { index: 0, periodId: initialItem.periodId, roomServiceId: initialItem.roomServiceId, state: 'SAVED', saved: savedFrom(initialItem, '0', '0'), status: 201, code: null, message: 'Đã lưu chỉ số' },
        { index: 1, periodId: inheritedItem.periodId, roomServiceId: inheritedItem.roomServiceId, state: 'FAILED', saved: null, status: 401, code: 'SESSION_INVALID', message: m.sessionInvalid },
      ] });
      return fixture.fetcher(input, init);
    });
    await fillBatch(); await userEvent.click(screen.getByRole('button', { name: 'Lưu các mục đã chọn' }));
    await waitFor(() => expect(expired).toHaveBeenCalledTimes(1));
    expect(expired.mock.calls[0][0]).toContain('Đã xác nhận lưu 1 mục');
    expect(screen.queryByRole('table')).toBeNull(); expect(document.querySelector('.mr-stats')).toBeNull();
  });
  it('requires a fresh GET and explicit review after stale source rejection', async () => {
    const fixture = meterFixtureFetch(); let reject = true;
    mount('full', { ...fixtureRoute, readingId: savedItem.readingId }, async (input, init) => {
      if (init?.method === 'PATCH' && reject) { reject = false; return meterReply(null, 409, 'Nguồn chỉ số đã thay đổi'); }
      return fixture.fetcher(input, init);
    });
    await screen.findByRole('heading', { name: 'Bản ghi đã lưu' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cập nhật chỉ số' }).hasAttribute('disabled')).toBe(false));
    await userEvent.click(screen.getByRole('button', { name: 'Cập nhật chỉ số' })); await type(input(savedItem), '12'); await userEvent.click(screen.getByRole('button', { name: 'Lưu cập nhật' }));
    const review = await screen.findByRole('button', { name: 'Dùng dữ liệu mới và kiểm tra lại' }); expect(review.hasAttribute('disabled')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }));
    await waitFor(() => expect(review.hasAttribute('disabled')).toBe(false));
    await userEvent.click(review); expect(input(savedItem).value).toBe('12'); expect(input(savedItem).disabled).toBe(false);
  });
});
