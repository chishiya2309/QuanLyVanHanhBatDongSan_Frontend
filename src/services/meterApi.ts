import { isRecord, safeInteger } from './assetCodec';
import { AuthApiError } from './authErrors';
import { clearCsrfCache, getCsrfToken } from './csrfClient';
import { authenticatedFetch, sessionGuard } from './sessionClient';
import { decodeBillingPeriod, decodeMeterBatch, decodeMeterChoices, decodeMeterItem, decodeMeterPage, decodeMeterProgress, encodeMeterBatch, encodeMeterCorrect, encodeMeterCreate, parseMeterJson } from './meterCodec';
import { isAssetId } from '../utils/assetNavigation';
import { isMeterDate } from '../utils/meterNavigation';
import { meterKey, meterMessages as m, type MeterCorrect, type MeterCreate, type MeterItem, type MeterScope } from '../types/meterReading';

const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
export class MeterApiError extends Error {
  status: number; fieldErrors: Record<string, string>; phase: 'read' | 'csrf' | 'write' | 'uncertain';
  constructor(status: number, message: string, phase: MeterApiError['phase'] = 'read', fields: Record<string, string> = {}) {
    super(message); this.name = 'MeterApiError'; this.status = status; this.phase = phase; this.fieldErrors = fields;
  }
}
export const isMeterAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';
export const isMeterCsrf = (e: unknown) => e instanceof MeterApiError && (e.phase === 'csrf' || (e.status === 403 && e.message.includes('CSRF')));
function errorResponse(status: number, body: unknown, write: boolean) {
  const valid = isRecord(body) && safeInteger(body.status) === status;
  const fields: Record<string, string> = {};
  if (valid && isRecord(body.fieldErrors)) for (const [key, value] of Object.entries(body.fieldErrors)) if (typeof value === 'string') fields[key] = value;
  let message = valid && typeof body.message === 'string' ? body.message : write ? 'Không thể lưu chỉ số. Vui lòng kiểm tra và thử lại.' : m.readFailure;
  if (status === 401) message = m.sessionInvalid;
  if (status === 404) message = m.notFound;
  if (status === 403 && !message.includes('CSRF')) message = m.forbidden;
  if (status === 403 && message.includes('CSRF')) clearCsrfCache();
  return new MeterApiError(status, message, write && status >= 500 ? 'uncertain' : write ? 'write' : 'read', fields);
}
async function request<T>(path: string, decode: (v: unknown) => T, init: RequestInit = {}, expected = 200, shouldSend = () => true): Promise<T> {
  const current = sessionGuard(shouldSend), write = Boolean(init.method && init.method !== 'GET');
  let response: Response;
  try {
    response = await authenticatedFetch(base + path, { ...init, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json', ...init.headers } }, { shouldSend: current, trackNavigation: true });
  } catch (e) {
    if (isMeterAbort(e)) throw e;
    if (e instanceof AuthApiError) throw new MeterApiError(e.status, e.status === 401 ? m.sessionInvalid : e.message, write ? 'write' : 'read');
    throw new MeterApiError(0, write ? m.uncertain : m.readFailure, write ? 'uncertain' : 'read');
  }
  let value: unknown;
  try { value = parseMeterJson(await response.text()); }
  catch { if (!current()) throw new DOMException('Stale response', 'AbortError'); if (!response.ok) throw errorResponse(response.status, null, write); throw new MeterApiError(response.status, write ? m.uncertain : m.readFailure, write ? 'uncertain' : 'read'); }
  if (!current()) throw new DOMException('Stale response', 'AbortError');
  if (!response.ok) throw errorResponse(response.status, value, write);
  try {
    if (response.status !== expected || !isRecord(value) || safeInteger(value.status) !== expected || typeof value.message !== 'string' || !Object.hasOwn(value, 'data')) throw new Error('Invalid envelope');
    return decode(value.data);
  } catch { throw new MeterApiError(response.status, write ? m.uncertain : m.readFailure, write ? 'uncertain' : 'read'); }
}
function scopeQuery(scope: MeterScope) {
  if (!scope.periodIds.length || scope.periodIds.some((id) => !isAssetId(id)) || (scope.buildingId && !isAssetId(scope.buildingId)) || scope.roomIds?.some((id) => !isAssetId(id))) throw new MeterApiError(400, 'Chọn kỳ và phạm vi hợp lệ.');
  const params = new URLSearchParams({ periodIds: scope.periodIds.join(',') });
  if (scope.buildingId) params.set('buildingId', scope.buildingId);
  if (scope.roomIds?.length) params.set('roomIds', scope.roomIds.join(','));
  return params;
}
function inScope(item: MeterItem, scope: MeterScope) {
  if (!scope.periodIds.includes(item.periodId) || (scope.buildingId && scope.buildingId !== item.buildingId) || (scope.roomIds?.length && !scope.roomIds.includes(item.roomId))) throw new Error('Wrong UC37 scope');
  return item;
}
export function getBillingPeriods(fromDate: string, toDate: string, filters: { buildingId?: string; roomIds?: string[] }, page = 0, signal?: AbortSignal) {
  if (!isMeterDate(fromDate) || !isMeterDate(toDate) || fromDate >= toDate) throw new MeterApiError(400, 'Chọn khoảng ngày hợp lệ, ngày kết thúc phải sau ngày bắt đầu.');
  const params = new URLSearchParams({ fromDate, toDate, page: String(page), size: '20' });
  if (filters.buildingId) params.set('buildingId', filters.buildingId);
  if (filters.roomIds?.length) params.set('roomIds', filters.roomIds.join(','));
  return request('/billing-periods?' + params, (v) => {
    const data = decodeMeterPage(v, decodeBillingPeriod);
    if (data.page !== page || data.size !== 20 || data.items.some((p) => p.fromDate >= toDate || p.toDate <= fromDate || (filters.buildingId && p.buildingId !== filters.buildingId) || (filters.roomIds?.length && !filters.roomIds.includes(p.roomId)))) throw new Error('Wrong period scope');
    return data;
  }, { signal });
}
export function getMeterItems(scope: MeterScope, page = 0, signal?: AbortSignal, size = 20) {
  const params = scopeQuery(scope); params.set('page', String(page)); params.set('size', String(size));
  return request('/meter-readings/items?' + params, (v) => {
    const data = decodeMeterPage(v, (item) => inScope(decodeMeterItem(item), scope));
    if (data.page !== page || data.size !== size || new Set(data.items.map(meterKey)).size !== data.items.length) throw new Error('Wrong item page');
    return data;
  }, { signal });
}
export async function getAllMeterItems(scope: MeterScope, signal?: AbortSignal) {
  const first = await getMeterItems(scope, 0, signal, 100), items = [...first.items];
  for (let page = 1; page * 100 < first.total; page++) {
    const next = await getMeterItems(scope, page, signal, 100);
    if (next.total !== first.total) throw new MeterApiError(409, m.stale);
    items.push(...next.items);
  }
  if (items.length !== first.total || new Set(items.map(meterKey)).size !== items.length) throw new MeterApiError(409, m.stale);
  return items;
}
export function getMeterProgress(scope: MeterScope, signal?: AbortSignal) {
  return request('/meter-readings/progress?' + scopeQuery(scope), (v) => {
    const data = decodeMeterProgress(v);
    if (data.pendingRooms.some((r) => (scope.buildingId && r.buildingId !== scope.buildingId) || (scope.roomIds?.length && !scope.roomIds.includes(r.roomId)))) throw new Error('Wrong progress scope');
    return data;
  }, { signal });
}
export function getMeterReading(id: string, signal?: AbortSignal) {
  if (!isAssetId(id)) throw new MeterApiError(404, m.notFound);
  return request('/meter-readings/' + id, (v) => { const item = decodeMeterItem(v); if (item.readingId !== id) throw new Error('Wrong reading'); return item; }, { signal });
}
async function mutate<T>(path: string, method: 'POST' | 'PATCH', body: () => string, decode: (v: unknown) => T, expected: number, shouldSend = () => true) {
  let encoded: string;
  try { encoded = body(); } catch { throw new MeterApiError(400, 'Dữ liệu chỉ số không hợp lệ.', 'write'); }
  const current = sessionGuard(shouldSend);
  let csrf: { headerName: string; token: string };
  try {
    csrf = await getCsrfToken();
    if (!/^[!#$%&'*+.^_`|~\da-z-]+$/i.test(csrf.headerName) || !csrf.token?.trim() || /[\r\n]/.test(csrf.token)
      || ['accept', 'content-type', 'cookie', 'authorization', 'host'].includes(csrf.headerName.toLowerCase())) throw new Error('Invalid CSRF');
  } catch (e) {
    if (e instanceof AuthApiError && e.status === 401) throw new MeterApiError(401, m.sessionInvalid, 'csrf');
    if (!current()) throw new DOMException('Stale request', 'AbortError');
    clearCsrfCache(); throw new MeterApiError(e instanceof AuthApiError ? e.status : 0, 'Không thể xác thực CSRF. Vui lòng thử lại.', 'csrf');
  }
  if (!current()) throw new DOMException('Stale request', 'AbortError');
  return request(path, decode, { method, body: encoded, headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token } }, expected, current);
}
export function createMeterReading(value: MeterCreate, shouldSend?: () => boolean) {
  return mutate('/meter-readings', 'POST', () => encodeMeterCreate(value), (v) => { const item = decodeMeterItem(v); if (!item.readingId || meterKey(item) !== meterKey(value)) throw new Error('Wrong saved item'); return item; }, 201, shouldSend);
}
export function correctMeterReading(id: string, value: MeterCorrect, shouldSend?: () => boolean) {
  if (!isAssetId(id)) throw new MeterApiError(404, m.notFound);
  return mutate('/meter-readings/' + id, 'PATCH', () => encodeMeterCorrect(value), (v) => { const item = decodeMeterItem(v); if (item.readingId !== id) throw new Error('Wrong saved item'); return item; }, 200, shouldSend);
}
export function createMeterBatch(items: MeterCreate[], shouldSend?: () => boolean) {
  const sent = items.map((item) => ({ ...item }));
  return mutate('/meter-readings/batch', 'POST', () => encodeMeterBatch(sent), (v) => decodeMeterBatch(v, sent), 200, shouldSend);
}
export const getMeterBuildings = (signal?: AbortSignal) => request('/buildings', (v) => decodeMeterChoices(v), { signal });
export const getMeterRooms = (buildingId: string, signal?: AbortSignal) => request('/rooms/search' + (buildingId ? '?buildingId=' + encodeURIComponent(buildingId) : ''), (v) => decodeMeterChoices(v, true), { signal });
