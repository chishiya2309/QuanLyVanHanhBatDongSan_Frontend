import { authenticatedFetch } from './sessionClient';
import { isRecord, parseCustomerJson, safeInteger } from './customerCodec';
import type { LookupCustomer, LookupPage, LookupRoute, RentalHistory, RentalStay } from '../types/customerLookup';
const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const fail = (): never => { throw new Error('Invalid UC22 response'); };
const text = (v: unknown): string => typeof v === 'string' ? v : fail();
const id = (v: unknown): string => typeof v === 'string' && uuid.test(v) ? v : fail();
const nullable = (v: unknown): string | null => v === null ? null : text(v);
const integer = (v: unknown): number => { const n = safeInteger(v); return n !== null && n !== undefined && n >= 0 ? n : fail(); };
const bool = (v: unknown): boolean => typeof v === 'boolean' ? v : fail();
function date(v: unknown): string {
  const s = text(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) !== s) fail();
  return s;
}
function stay(value: unknown): RentalStay {
  if (!isRecord(value)) return fail();
  if (!['ACTIVE', 'TERMINATED'].includes(String(value.contractStatus))) return fail();
  return { tenancyId: id(value.tenancyId), roomId: id(value.roomId), roomCode: text(value.roomCode), roomName: text(value.roomName),
    buildingId: id(value.buildingId), buildingName: text(value.buildingName), contractId: id(value.contractId), contractNumber: text(value.contractNumber),
    contractStartDate: date(value.contractStartDate), contractEndDate: date(value.contractEndDate), fromDate: date(value.fromDate),
    toDate: value.toDate === null ? null : date(value.toDate), contractStatus: value.contractStatus as RentalStay['contractStatus'], current: bool(value.current) };
}
function customer(value: unknown): LookupCustomer {
  if (!isRecord(value) || !Array.isArray(value.rentals)
    || (value.identityType !== null && !['CCCD', 'PASSPORT'].includes(String(value.identityType)))) return fail();
  return { id: id(value.id), fullName: text(value.fullName), phone: nullable(value.phone), identityNo: nullable(value.identityNo),
    identityType: value.identityType as LookupCustomer['identityType'], rentals: value.rentals.map(stay) };
}
export function decodeLookupPage(value: unknown): LookupPage {
  if (!isRecord(value) || !Array.isArray(value.content)) return fail();
  const result = { content: value.content.map(customer), page: integer(value.page), size: integer(value.size),
    totalElements: integer(value.totalElements), totalPages: integer(value.totalPages), first: bool(value.first), last: bool(value.last),
    requestedPage: integer(value.requestedPage), pageReset: bool(value.pageReset) };
  if (result.size < 1 || result.size > 100 || result.content.length > result.size
    || new Set(result.content.map(c => c.id)).size !== result.content.length
    || result.totalPages !== Math.ceil(result.totalElements / result.size)
    || result.first !== (result.page === 0) || result.last !== (result.page + 1 >= result.totalPages)
    || result.page >= Math.max(1, result.totalPages) || result.content.length > result.totalElements
    || (result.pageReset ? result.page !== 0 || result.requestedPage === 0 : result.requestedPage !== result.page)) fail();
  return result;
}
export function decodeRentalHistory(value: unknown): RentalHistory {
  if (!isRecord(value) || !Array.isArray(value.items)) return fail();
  const items = value.items.map(stay);
  if (new Set(items.map(s => s.tenancyId)).size !== items.length) fail();
  return { customerId: id(value.customerId), items };
}
export class LookupApiError extends Error {
  status: number;
  fields: Record<string, string>;
  code?: string;
  constructor(status: number, message: string, fields: Record<string, string> = {}, code?: string) {
    super(message); this.status = status; this.fields = fields; this.code = code;
  }
}
export async function lookupRequest<T>(path: string, decode: (value: unknown) => T, signal: AbortSignal): Promise<T> {
  let response: Response;
  try { response = await authenticatedFetch(base + path, { method: 'GET', credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' }, signal }); }
  catch (error) {
    if (signal.aborted) throw error;
    const status = isRecord(error) && typeof error.status === 'number' ? error.status : 0;
    throw new LookupApiError(status, status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : 'Không thể tải dữ liệu. Vui lòng thử lại.');
  }
  let body: unknown;
  try { body = parseCustomerJson(await response.text()); } catch { body = null; }
  if (!response.ok) {
    const fields: Record<string, string> = {};
    if (isRecord(body) && isRecord(body.fieldErrors)) for (const [k, v] of Object.entries(body.fieldErrors)) if (typeof v === 'string') fields[k] = v;
    const code = isRecord(body) && typeof body.code === 'string' ? body.code : undefined;
    const message = response.status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
      : response.status === 403 ? 'Bạn không có quyền thực hiện chức năng này.'
      : response.status === 404 ? 'Không thể truy cập Customer hoặc phòng được yêu cầu.'
      : response.status === 400 ? 'Tiêu chí hoặc thông tin phân trang không hợp lệ.'
      : code === 'RENTAL_DATA_INCONSISTENT' ? 'Không thể tải đầy đủ thông tin thuê do dữ liệu lưu trú chưa nhất quán.'
      : 'Không thể tải dữ liệu. Vui lòng thử lại.';
    throw new LookupApiError(response.status, message, fields, code);
  }
  try {
    if (response.status !== 200 || !isRecord(body) || safeInteger(body.status) !== 200 || typeof body.message !== 'string') return fail();
    return decode(body.data);
  } catch { throw new LookupApiError(500, 'Dữ liệu phản hồi không hợp lệ. Vui lòng thử lại.'); }
}
export function searchCustomers(route: LookupRoute, signal: AbortSignal) {
  const p = new URLSearchParams({ mode: route.mode, page: String(route.page), size: String(route.size) });
  if (route.q) p.set('q', route.q);
  if (route.roomId) p.set('roomId', route.roomId);
  return lookupRequest('/customers/search?' + p, decodeLookupPage, signal).then(page => {
    if (page.requestedPage !== route.page || page.size !== route.size) throw new LookupApiError(500, 'Phản hồi không khớp yêu cầu tra cứu.');
    return page;
  });
}
export function getRentalHistory(customerId: string, signal: AbortSignal) {
  return lookupRequest(`/customers/${encodeURIComponent(customerId)}/rental-history`, decodeRentalHistory, signal).then(history => {
    if (history.customerId.toLowerCase() !== customerId.toLowerCase()) throw new LookupApiError(500, 'Phản hồi lịch sử không khớp Customer.');
    return history;
  });
}
