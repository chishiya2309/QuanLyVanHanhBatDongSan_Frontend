import { LosslessNumber, parse, stringify, isLosslessNumber } from 'lossless-json';
import type { BillingPeriod, MeterItem, MeterProgress, MeterRoute } from '../../src/types/meterReading';
export const meterId = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
export const version = 'a'.repeat(64), nextVersion = 'b'.repeat(64);
export const periodA = meterId(1), periodB = meterId(2), buildingId = meterId(3), roomA = meterId(4), roomB = meterId(5), readingId = meterId(6);
export const initialItem: MeterItem = {
  requirementId: meterId(10), periodId: periodA, roomServiceId: meterId(11), roomId: roomA, roomCode: '101', buildingId, buildingName: 'Tòa A', serviceName: 'Điện', unit: 'kWh',
  fromDate: '2026-10-21', toDate: '2026-11-21', cycleStart: '2026-10-21', cycleEnd: '2026-11-21', periodStatus: 'OPEN',
  readingId: null, startIndex: null, endIndex: null, consumption: null, startSource: 'HOST_CONFIRMED', sourceId: null, initialStartAllowed: true, canCreate: true, canUpdate: false, blockedReason: null, version,
};
export const inheritedItem: MeterItem = { ...initialItem, requirementId: meterId(12), roomServiceId: meterId(13), serviceName: 'Nước', unit: 'm³', startIndex: '100', startSource: 'PREVIOUS_READING', sourceId: meterId(14), initialStartAllowed: false };
export const savedItem: MeterItem = { ...initialItem, requirementId: meterId(15), periodId: periodB, roomServiceId: meterId(16), roomId: roomB, roomCode: '202', fromDate: '2026-11-03', toDate: '2026-11-15', cycleStart: '2026-11-01', cycleEnd: '2026-12-01',
  readingId, startIndex: '0', endIndex: '10.5', consumption: '10.5', startSource: 'HANDOVER', sourceId: meterId(17), initialStartAllowed: false, canCreate: false, canUpdate: true };
export const missingItem: MeterItem = { ...savedItem, requirementId: meterId(18), roomServiceId: meterId(19), serviceName: 'Nước', unit: 'm³', readingId: null, startIndex: null, endIndex: null, consumption: null, startSource: null, sourceId: null, canUpdate: false, blockedReason: 'PREVIOUS_READING_MISSING' };
export const fixtureItems = [initialItem, inheritedItem, savedItem, missingItem];
export const fixturePeriods: BillingPeriod[] = [initialItem, savedItem].map((i, index) => ({ id: i.periodId, tenancyId: meterId(30 + index), roomId: i.roomId, roomCode: i.roomCode, buildingId: i.buildingId, fromDate: i.fromDate, toDate: i.toDate, cycleStart: i.cycleStart, cycleEnd: i.cycleEnd, status: i.periodStatus }));
export const fixtureRoute: MeterRoute = { fromDate: '2026-10-01', toDate: '2026-12-01', buildingId: '', roomIds: [], periodIds: [periodA, periodB], view: 'single', page: 0, periodPage: 0, readingId: null, invalid: false };
export function wireMeter(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(wireMeter);
  if (!value || typeof value !== 'object' || isLosslessNumber(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, ['startIndex', 'endIndex', 'consumption'].includes(key) && typeof v === 'string' ? new LosslessNumber(v) : wireMeter(v)]));
}
export function meterReply(data: unknown, status = 200, message = 'Lấy dữ liệu thành công'): Response {
  const body = status >= 400 ? { status, message, error: 'Error', fieldErrors: {}, path: '/api/v1/meter-readings', timestamp: '2026-11-14T00:00:00Z' } : { status, message, data: wireMeter(data) };
  return new Response(stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function subtract(end: string, start: string) {
  const [ei, ef = ''] = end.split('.'), [si, sf = ''] = start.split('.'), scale = Math.max(ef.length, sf.length);
  const delta = BigInt(ei + ef.padEnd(scale, '0')) - BigInt(si + sf.padEnd(scale, '0'));
  const digits = delta.toString().padStart(scale + 1, '0');
  return scale ? digits.slice(0, -scale) + '.' + digits.slice(-scale) : digits;
}
export function savedFrom(item: MeterItem, endIndex: string, startIndex = item.startIndex ?? '0'): MeterItem {
  return { ...item, readingId: item.readingId || meterId(100 + fixtureItems.findIndex((i) => i.requirementId === item.requirementId)), startIndex, endIndex, consumption: subtract(endIndex, startIndex), initialStartAllowed: false, canCreate: false, canUpdate: true, version: nextVersion };
}
export function progressFor(items: MeterItem[]): MeterProgress {
  const rooms = [...new Set(items.map((i) => i.roomId))];
  const pendingRooms = rooms.flatMap((roomId) => {
    const group = items.filter((i) => i.roomId === roomId), missing = group.filter((i) => !i.readingId);
    return missing.length ? [{ roomId, roomCode: group[0].roomCode, buildingId: group[0].buildingId, missingRequirementIds: missing.map((i) => i.requirementId) }] : [];
  });
  return { required: rooms.length, completed: rooms.length - pendingRooms.length, pending: pendingRooms.length, pendingRoomIds: pendingRooms.map((r) => r.roomId), pendingRooms };
}
export interface MeterFixtureOptions { mode?: string; onCall?: (path: string, method: string, body?: string) => void; delay?: number }
export function meterFixtureFetch(options: MeterFixtureOptions = {}) {
  const items = structuredClone(fixtureItems), mode = options.mode || 'full';
  let wrote = false;
  if (mode === 'locked') { items[2].canUpdate = false; items[2].periodStatus = 'SEALED'; items[2].blockedReason = 'PERIOD_LOCKED'; }
  if (mode === 'issued') { items[2].canUpdate = false; items[2].blockedReason = 'INVOICE_ISSUED'; }
  const page = <T,>(rows: T[], url: URL) => { const page = Number(url.searchParams.get('page') || 0), size = Number(url.searchParams.get('size') || 20); return { items: rows.slice(page * size, (page + 1) * size), total: rows.length, page, size }; };
  const fetcher = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input), window.location.origin), path = url.pathname, method = init.method || 'GET';
    options.onCall?.(path, method, typeof init.body === 'string' ? init.body : undefined);
    if (options.delay) await new Promise((resolve) => setTimeout(resolve, options.delay));
    if (path.endsWith('/auth/me')) return meterReply({ accountId: meterId(999), loginName: 'Host UC37', role: mode === 'admin' ? 'ADMIN' : 'HOST', hostId: meterId(998), customerId: null });
    if (path.endsWith('/auth/csrf')) return meterReply({ headerName: 'X-CSRF-TOKEN', token: 'fixture-uc37' });
    if (path.endsWith('/profile')) return meterReply(null, 500);
    if (mode === 'forbidden') return meterReply(null, 403, 'Không có quyền');
    if (path.endsWith('/buildings')) return meterReply([{ id: buildingId, name: 'Tòa A' }]);
    if (path.endsWith('/rooms/search')) return meterReply([{ id: roomA, code: '101', name: 'Phòng 101', buildingId, buildingName: 'Tòa A' }, { id: roomB, code: '202', name: 'Phòng 202', buildingId, buildingName: 'Tòa A' }]);
    if (path.endsWith('/billing-periods')) return meterReply(page(mode === 'no-periods' ? [] : fixturePeriods, url));
    const selected = () => items.filter((i) => (url.searchParams.get('periodIds') || '').split(',').includes(i.periodId) && (!url.searchParams.has('roomIds') || url.searchParams.get('roomIds')!.split(',').includes(i.roomId)));
    if (method === 'GET') {
      if (mode === 'read-error' || mode === 'reload-error' && wrote) return meterReply(null, 500, 'Không thể tải dữ liệu');
      if (path.endsWith('/items')) return meterReply(page(mode === 'empty' ? [] : selected(), url));
      if (path.endsWith('/progress')) return meterReply(progressFor(mode === 'empty' ? [] : selected()));
      const item = items.find((i) => path.endsWith('/' + i.readingId));
      return item ? meterReply(item) : meterReply(null, 404);
    }
    const body = parse(String(init.body)) as Record<string, unknown>;
    if (mode === 'stale') return meterReply(null, 409, 'Dữ liệu đã thay đổi. Vui lòng tải lại trước khi lưu');
    if (mode === 'continuity') return meterReply(null, 409, 'Chỉ số mới làm mất tính liên tục kỳ sau');
    const save = (request: Record<string, unknown>) => {
      const item = method === 'PATCH' ? items.find((i) => path.endsWith('/' + i.readingId)) : items.find((i) => i.periodId === request.periodId && i.roomServiceId === request.roomServiceId);
      if (!item) throw new Error('Invalid fixture request');
      Object.assign(item, savedFrom(item, String(request.endIndex), request.startIndex !== undefined ? String(request.startIndex) : item.startIndex ?? '0'));
      wrote = true; return item;
    };
    if (path.endsWith('/batch')) {
      const requests = body.items as Record<string, unknown>[];
      const results = requests.map((request, index) => {
        if (mode === 'none' || mode === 'partial' && index > 0) return { index, periodId: request.periodId, roomServiceId: request.roomServiceId, state: 'FAILED', saved: null, status: mode === 'partial' ? 400 : 409, code: mode === 'partial' ? 'INVALID_DATA' : 'PERIOD_LOCKED', message: mode === 'partial' ? 'Kiểm tra chỉ số cuối' : 'Kỳ đã khóa, chỉ được xem' };
        if (mode === 'interrupted' && index > 0) return { index, periodId: request.periodId, roomServiceId: request.roomServiceId, state: 'UNKNOWN', saved: null, status: 500, code: 'COMMIT_UNKNOWN', message: 'Chưa xác định kết quả commit' };
        return { index, periodId: request.periodId, roomServiceId: request.roomServiceId, state: 'SAVED', saved: save(request), status: 201, code: null, message: 'Đã lưu chỉ số' };
      });
      const saved = results.filter((r) => r.state === 'SAVED').length, failed = results.filter((r) => r.state === 'FAILED').length;
      if (mode === 'lost-response') throw new TypeError('Connection interrupted after commit');
      return meterReply({ outcome: mode === 'interrupted' ? 'INTERRUPTED' : saved === requests.length ? 'ALL_SAVED' : saved === 0 ? 'NONE_SAVED' : 'PARTIALLY_SAVED', saved, failed, results });
    }
    const result = save(body);
    if (mode === 'lost-response') throw new TypeError('Connection interrupted after commit');
    return meterReply(result, method === 'PATCH' ? 200 : 201, 'Đã lưu chỉ số');
  };
  return { fetcher, items };
}
