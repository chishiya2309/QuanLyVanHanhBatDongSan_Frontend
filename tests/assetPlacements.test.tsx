import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../src/App';
import { assetMessages as m } from '../src/types/assets';
import { assetFixture, assetId, assetReply, assetPageReply } from './fixtures/assets';
import { historyFixture, installTrackingApi, placementA, placementB, roomB, roomFixtures } from './fixtures/assetTracking';
import { deferred, failure, ok } from './apiMock';

const path = (action: 'assign' | 'transfer') => `/assets/${assetId}?q=Máy&page=0&size=50&placement=${action}`;
const enter = (url: string) => window.history.replaceState(null, '', url);
const go = (url: string) => { window.history.pushState(null, '', url); window.dispatchEvent(new PopStateEvent('popstate')); };
const modalReady = async () => {
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect((within(dialog).getByRole('combobox') as HTMLSelectElement).disabled).toBe(false));
  return dialog;
};
const choose = (dialog: HTMLElement, id = roomB) => fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: id } });
const submit = (dialog: HTMLElement, transfer = false) => fireEvent.click(within(dialog).getByRole('button', { name: transfer ? 'Xác nhận chuyển' : 'Xác nhận gán' }));
beforeEach(() => enter('/assets'));

describe('UC18 authorization and routes', () => {
  it.each(['ADMIN', 'CUSTOMER'])('denies %s direct dialog and history without use-case requests', async (role) => {
    const api = installTrackingApi(false, role); enter(path('assign')); const view = render(<App />);
    await screen.findByText(m.forbidden); expect(api.rooms).not.toHaveBeenCalled(); expect(api.detail).not.toHaveBeenCalled();
    view.unmount(); enter(`/assets/${assetId}/history`); render(<App />); await screen.findByText(m.forbidden);
    expect(api.history).not.toHaveBeenCalled();
  });
  it('waits for authentication before loading the direct modal', async () => {
    const api = installTrackingApi(); const gate = deferred<Response>(); api.me.mockReturnValueOnce(gate.promise); enter(path('assign')); render(<App />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(api.rooms).not.toHaveBeenCalled();
    await act(async () => gate.resolve(ok({ accountId: 'host', loginName: 'Host', role: 'HOST' })));
    await modalReady(); expect(api.rooms).toHaveBeenCalledTimes(1);
  });
  it('opens from the list, retains context, restores focus and reloads confirmation on revisit', async () => {
    const api = installTrackingApi(); enter('/assets?q=Máy%25_%21&page=0&size=50'); render(<App />);
    const table = await screen.findByRole('table'); const trigger = within(table).getByRole('button', { name: 'Gán vào phòng' }); trigger.focus(); fireEvent.click(trigger);
    const dialog = await modalReady(); expect(document.activeElement).toBe(within(dialog).getByRole('combobox'));
    expect(new URLSearchParams(location.search).get('targetAssetId')).toBe(assetId); choose(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' })); expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger);
    expect(new URLSearchParams(location.search).get('q')).toBe('Máy%_!'); expect(api.write).not.toHaveBeenCalled();
    act(() => go('/assets?placement=assign&targetAssetId=' + assetId)); await modalReady();
    expect(api.detail).toHaveBeenCalledTimes(2);
    act(() => go('/assets')); expect(screen.queryByRole('dialog')).toBeNull(); expect(api.me).toHaveBeenCalledTimes(1);
  });
  it.each(['?placement=assign', '?placement=bad&targetAssetId=' + assetId, '?create=1&placement=assign&targetAssetId=' + assetId])('clears invalid modal parameters %s with a notice and no POST', async (query) => {
    const api = installTrackingApi(); enter('/assets' + query); render(<App />); await screen.findByText(m.placementSelectionInvalid);
    expect(location.search).toBe('?page=0&size=20'); expect(screen.queryByRole('dialog')).toBeNull(); expect(api.write).not.toHaveBeenCalled();
  });
});
describe('UC18 placement forms and concurrency', () => {
  it('traps keyboard focus and closes with Escape/backdrop without writing', async () => {
    const api = installTrackingApi(); enter(path('assign')); render(<App />); let dialog = await modalReady();
    const select = within(dialog).getByRole('combobox'); const cancel = within(dialog).getByRole('button', { name: 'Hủy' });
    select.focus(); fireEvent.keyDown(select, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(cancel, { key: 'Tab' }); expect(document.activeElement).toBe(select);
    fireEvent(dialog, new Event('cancel', { cancelable: true })); expect(screen.queryByRole('dialog')).toBeNull();
    act(() => go(path('assign'))); dialog = await modalReady(); fireEvent.click(dialog, { clientX: -20, clientY: -20 });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(location.pathname).toBe('/assets/' + assetId); expect(api.write).not.toHaveBeenCalled();
  });
  it('validates selection, allows RETIRED and occupied/maintenance rooms and submits once', async () => {
    const api = installTrackingApi(); api.setAsset({ ...assetFixture, condition: 'RETIRED' }); enter(path('assign')); render(<App />);
    const dialog = await modalReady(); expect(within(dialog).getByRole('option', { name: /Khu Đông.*Tòa A.*101/ })).toBeTruthy();
    expect(within(dialog).getByRole('option', { name: /Khu Tây.*Tòa B.*202/ })).toBeTruthy();
    submit(dialog); await within(dialog).findByText(m.roomRequired); expect(api.write).not.toHaveBeenCalled();
    choose(dialog); const gate = deferred<Response>(); api.csrf.mockReturnValueOnce(gate.promise);
    fireEvent.submit(dialog.querySelector('form')!); fireEvent.submit(dialog.querySelector('form')!);
    expect((within(dialog).getByRole('button', { name: 'Hủy' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent(dialog, new Event('cancel', { cancelable: true })); expect(screen.getByRole('dialog')).toBe(dialog);
    await act(async () => gate.resolve(ok({ token: 'fresh', headerName: 'X-CSRF-TOKEN' })));
    await screen.findByText(m.assignSuccess); expect(api.write).toHaveBeenCalledTimes(1); expect(api.history).not.toHaveBeenCalled();
    expect(api.write.mock.calls[0][0].pathname).toContain('/placements'); expect(location.search).toBe('?q=M%C3%A1y&page=0&size=50');
  });
  it('uses the fresh source Host saw, excludes its room and sends the source id', async () => {
    const api = installTrackingApi(true); enter(path('transfer')); render(<App />); const dialog = await modalReady();
    expect(within(dialog).queryByRole('option', { name: /101/ })).toBeNull(); expect(within(dialog).getByText(/Phòng hiện tại: 101/)).toBeTruthy();
    choose(dialog); submit(dialog, true); await screen.findByText(m.transferSuccess);
    expect(JSON.parse(String(api.write.mock.calls[0][1].body))).toEqual({ roomId: roomB, sourcePlacementId: placementA.placementId });
    expect(api.write).toHaveBeenCalledTimes(1); expect(api.fetch.mock.calls.some(([url]) => String(url).includes('condition-records'))).toBe(false);
  });
  it.each([false, true])('ends incompatible fresh mode; never reinterprets the action (assigned=%s)', async (assigned) => {
    const api = installTrackingApi(assigned); enter(path(assigned ? 'assign' : 'transfer')); render(<App />);
    await screen.findByText(assigned ? m.alreadyPlaced : m.sourceChanged); expect(screen.queryByRole('dialog')).toBeNull(); expect(api.write).not.toHaveBeenCalled();
  });
  it('keeps selected room after CSRF rejection and supports manual retry', async () => {
    const api = installTrackingApi(); enter(path('assign')); render(<App />); const dialog = await modalReady(); choose(dialog);
    api.write.mockResolvedValueOnce(failure(403, m.csrfInvalid)); submit(dialog); await within(dialog).findByText(m.csrfInvalid);
    expect((within(dialog).getByRole('combobox') as HTMLSelectElement).value).toBe(roomB);
    submit(dialog); await screen.findByText(m.assignSuccess); expect(api.write).toHaveBeenCalledTimes(2);
  });
  it('refreshes unavailable room options, clears selection and keeps the dialog', async () => {
    const api = installTrackingApi(); enter(path('assign')); render(<App />); const dialog = await modalReady(); choose(dialog);
    api.rooms.mockResolvedValueOnce(assetReply([roomFixtures[0]], m.roomListSuccess)); api.write.mockResolvedValueOnce(failure(404, m.roomNotFound)); submit(dialog);
    await within(dialog).findByText(m.roomNotFound); await waitFor(() => expect(api.rooms).toHaveBeenCalledTimes(2));
    expect((within(dialog).getByRole('combobox') as HTMLSelectElement).value).toBe(''); expect(location.pathname).toBe('/assets/' + assetId);
    expect(api.write).toHaveBeenCalledTimes(1);
  });
  it('refreshes the list when a modal discovers that its asset is no longer available', async () => {
    const api = installTrackingApi(); render(<App />);
    const table = await screen.findByRole('table');
    api.detail.mockResolvedValueOnce(failure(404, m.notFound)); api.list.mockResolvedValueOnce(assetPageReply({ q: '', page: 0, size: 20 }, []));
    fireEvent.click(within(table).getByRole('button', { name: 'Gán vào phòng' }));
    await screen.findByText(m.notFound); await screen.findByRole('heading', { name: 'Chưa có tài sản' });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(api.write).not.toHaveBeenCalled(); expect(api.list).toHaveBeenCalledTimes(2);
  });
  it('keeps same-room conflict in the dialog for a new selection', async () => {
    const api = installTrackingApi(true); enter(path('transfer')); render(<App />); const dialog = await modalReady(); choose(dialog);
    api.write.mockResolvedValueOnce(failure(409, m.sameRoom)); submit(dialog, true); await within(dialog).findByText(m.sameRoom);
    expect(document.activeElement).toBe(within(dialog).getByRole('combobox')); expect(api.write).toHaveBeenCalledTimes(1);
  });
  it.each([m.alreadyPlaced, m.sourceChanged, m.placementTimeInvalid])('ends conflict %s and does not replay', async (message) => {
    const api = installTrackingApi(true); enter(path('transfer')); render(<App />); const dialog = await modalReady(); choose(dialog);
    api.write.mockResolvedValueOnce(failure(409, message)); submit(dialog, true); await screen.findByText(message);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(api.write).toHaveBeenCalledTimes(1); expect(location.search).not.toContain('placement=');
  });
  it.each([[400, m.roomRequired], [404, m.notFound], [500, m.assignFailure]])('ends rejected operation %s and handles return route', async (status, message) => {
    const api = installTrackingApi(); enter(path('assign')); render(<App />); const dialog = await modalReady(); choose(dialog);
    api.write.mockResolvedValueOnce(failure(Number(status), String(message))); submit(dialog);
    await screen.findByText(status === 400 ? m.placementSelectionInvalid : String(message)); expect(screen.queryByRole('dialog')).toBeNull();
    expect(location.pathname).toBe(status === 500 ? '/assets/' + assetId : '/assets'); expect(api.write).toHaveBeenCalledTimes(1);
  });
  it('preserves mutation success when the following GET fails and blocks stale mutations', async () => {
    const api = installTrackingApi(); enter(path('assign')); render(<App />); const dialog = await modalReady(); choose(dialog);
    api.detail.mockResolvedValueOnce(failure(500, m.detailFailure)); submit(dialog);
    await screen.findByText(m.assignSuccess); await screen.findByText(m.detailFailure);
    expect((screen.getByRole('button', { name: 'Gán vào phòng' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await screen.findByRole('button', { name: 'Chuyển phòng' });
  });
  it('warns about a lost response without automatically replaying the mutation', async () => {
    const api = installTrackingApi(); enter(path('assign')); render(<App />); const dialog = await modalReady(); choose(dialog);
    api.write.mockRejectedValueOnce(new TypeError('lost response')); submit(dialog); await screen.findByText(m.placementUncertain);
    expect(api.write).toHaveBeenCalledTimes(1); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('cancels safely while loading and ignores stale completion after navigation', async () => {
    const api = installTrackingApi(); const gate = deferred<Response>(); api.rooms.mockReturnValueOnce(gate.promise); enter(path('assign')); render(<App />);
    const dialog = await screen.findByRole('dialog'); fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    await act(async () => gate.resolve(failure(403, m.forbidden))); expect(screen.queryByText(m.forbidden)).toBeNull(); expect(api.write).not.toHaveBeenCalled();
  });
  it('does not POST if navigation invalidates a command while CSRF is pending', async () => {
    const api = installTrackingApi(); enter(path('assign')); render(<App />); const dialog = await modalReady(); choose(dialog);
    const gate = deferred<Response>(); api.csrf.mockReturnValueOnce(gate.promise); submit(dialog); act(() => go('/assets'));
    await act(async () => gate.resolve(ok({ token: 'fresh', headerName: 'X-CSRF-TOKEN' }))); expect(api.write).not.toHaveBeenCalled(); expect(screen.queryByText(m.assignSuccess)).toBeNull();
  });
  it.each(['empty', 'error'])('keeps room %s separate from history access', async (state) => {
    const api = installTrackingApi(); api.rooms.mockResolvedValueOnce(state === 'empty' ? assetReply([], m.roomListEmpty) : failure(500, m.roomListFailure));
    enter(path('assign')); render(<App />); const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText(state === 'empty' ? /Không có phòng đích phù hợp/ : m.roomListFailure);
    expect((within(dialog).getByRole('button', { name: 'Xác nhận gán' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' })); fireEvent.click(await screen.findByRole('link', { name: 'Xem lịch sử' }));
    await screen.findByRole('heading', { name: 'Lịch sử tài sản' }); expect(api.write).not.toHaveBeenCalled();
  });
  it('clears asset data on permission denial or terminal session expiry', async () => {
    const api = installTrackingApi(); enter(path('assign')); const view = render(<App />); let dialog = await modalReady(); choose(dialog);
    api.write.mockResolvedValueOnce(failure(403, m.forbidden)); submit(dialog); await screen.findByText(m.forbidden); expect(screen.queryByText(assetFixture.name)).toBeNull();
    view.unmount(); enter(path('assign')); const expiredApi = installTrackingApi(); render(<App />); dialog = await modalReady(); choose(dialog);
    expiredApi.me.mockImplementation(async () => failure(401, m.sessionInvalid)); expiredApi.write.mockResolvedValueOnce(failure(401, m.sessionInvalid)); submit(dialog);
    await screen.findByText(m.sessionInvalid); expect(location.pathname).toBe('/'); expect(screen.queryByRole('dialog')).toBeNull();
  });
});
describe('UC18 read-only history', () => {
  it('shows every condition record with its own context and immutable placement snapshot', async () => {
    const api = installTrackingApi(true); api.setAsset({ ...assetFixture, condition: 'DAMAGED', currentPlacement: placementB }); enter('/assets/' + assetId + '/history'); render(<App />);
    const table = await screen.findByRole('table', { name: 'Lịch sử tình trạng' });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    const noRoom = within(table).getByText('Không có phòng bố trí tại thời điểm ghi nhận').closest('tr')!;
    expect(noRoom.textContent).not.toContain('202 — Phòng cùng tên'); expect(within(table).getAllByText('101 — Phòng cùng tên')).toHaveLength(2);
    const positions = screen.getByRole('table', { name: 'Lịch sử vị trí' }); expect(within(positions).getByText('Tốt')).toBeTruthy(); expect(within(positions).getByText('Chưa kết thúc')).toBeTruthy();
    expect(api.rooms).not.toHaveBeenCalled(); expect(api.write).not.toHaveBeenCalled();
  });
  it.each(['both', 'locations', 'conditions'])('shows independent empty histories (%s)', async (empty) => {
    const api = installTrackingApi(); api.history.mockResolvedValueOnce(assetReply({ ...historyFixture,
      locationHistory: empty === 'both' || empty === 'locations' ? [] : historyFixture.locationHistory,
      conditionHistory: empty === 'both' ? [] : empty === 'locations' ? [historyFixture.conditionHistory[3]] : [],
    }, m.historySuccess)); enter('/assets/' + assetId + '/history'); render(<App />);
    await screen.findByText(empty === 'conditions' ? 'Chưa có lịch sử tình trạng' : 'Chưa có lịch sử vị trí');
    if (empty === 'locations') expect(screen.getByRole('table', { name: 'Lịch sử tình trạng' })).toBeTruthy();
    if (empty === 'conditions') expect(screen.getByRole('table', { name: 'Lịch sử vị trí' })).toBeTruthy();
  });
  it('does not turn failed or malformed history into an empty state and can retry', async () => {
    const api = installTrackingApi(); api.history.mockResolvedValueOnce(failure(500, m.historyFailure)); enter('/assets/' + assetId + '/history'); render(<App />);
    await screen.findByText(m.historyFailure); expect(screen.queryByText('Chưa có lịch sử vị trí')).toBeNull();
    api.history.mockResolvedValueOnce(assetReply({ assetId }, m.historySuccess)); fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await screen.findByText(m.historyFailure);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await screen.findByRole('table', { name: 'Lịch sử vị trí' });
  });
  it('ignores a historical response after changing assets', async () => {
    const api = installTrackingApi(); const gate = deferred<Response>(); api.history.mockReturnValueOnce(gate.promise); enter('/assets/' + assetId + '/history'); render(<App />);
    await screen.findByText('Đang tải lịch sử tài sản.'); act(() => go('/assets'));
    await act(async () => gate.resolve(assetReply(historyFixture, m.historySuccess))); expect(screen.queryByText('Lịch sử vị trí')).toBeNull();
  });
});
