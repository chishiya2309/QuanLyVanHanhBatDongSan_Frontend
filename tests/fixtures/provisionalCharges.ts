import { isLosslessNumber, LosslessNumber, stringify } from 'lossless-json';
import type { AuthenticatedUserResponse } from '../../src/types/auth';
import type { ChargeItem, PeriodHeader, ProvisionalDetail, ProvisionalRole, ProvisionalRoute } from '../../src/types/provisionalCharge';

export const pcId = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
export const pcToken = 'a'.repeat(64), pcNextToken = 'b'.repeat(64);
export const pcHost: AuthenticatedUserResponse = { accountId: pcId(900), loginName: 'Host UC39', role: 'HOST', hostId: pcId(901), customerId: null };
export const pcCustomer: AuthenticatedUserResponse = { accountId: pcId(902), loginName: 'Customer UC39', role: 'CUSTOMER', hostId: pcId(901), customerId: pcId(903) };
export const pcHeader: PeriodHeader = { periodId: pcId(1), roomId: pcId(10), roomCode: '101', buildingName: 'Tòa A', fromDate: '2026-10-21', toDate: '2026-11-21', cycleStart: '2026-10-21', cycleEnd: '2026-11-21', periodStatus: 'OPEN', invoiceStatus: null };
export const pcOldHeader: PeriodHeader = { ...pcHeader, periodId: pcId(2), fromDate: '2026-09-21', toDate: '2026-10-21', cycleStart: '2026-09-21', cycleEnd: '2026-10-21' };
export const pcOtherHeader: PeriodHeader = { ...pcHeader, periodId: pcId(3), roomId: pcId(11), buildingName: 'Tòa B', fromDate: '2026-11-03', toDate: '2026-11-15', cycleStart: '2026-11-01', cycleEnd: '2026-12-01', invoiceStatus: 'DRAFT' };
export const pcHeaders = [pcOtherHeader, pcHeader, pcOldHeader];
export const pcRoute: ProvisionalRoute = { role: 'HOST', roomId: pcHeader.roomId, periodId: pcHeader.periodId, invalid: false };
export const pcMeter: ChargeItem = { itemType: 'SERVICE', itemCode: pcId(100), itemName: 'Điện', unit: 'kWh', serviceId: pcId(101), roomServiceId: pcId(100), adjustmentId: null, chargeMethod: 'METERED', startIndex: '0', endIndex: '120.123456789012345678901', consumption: '120.123456789012345678901', quantity: null, manualAmount: null, unitPrice: '3500', prorateFactor: '1', basisDate: '2026-10-21', pricingSource: 'ROOM', amount: '420432', status: 'CALCULATED', missingReason: null };
export const pcFixed: ChargeItem = { ...pcMeter, itemCode: pcId(110), roomServiceId: pcId(110), serviceId: pcId(111), itemName: 'Internet', unit: 'tháng', chargeMethod: 'FIXED', startIndex: null, endIndex: null, consumption: null, unitPrice: '100000', prorateFactor: '1.00000000', pricingSource: 'BUILDING', amount: '100000' };
export const pcQuantity: ChargeItem = { ...pcFixed, itemCode: pcId(120), roomServiceId: pcId(120), serviceId: pcId(121), itemName: 'Nước đóng bình', unit: 'bình', chargeMethod: 'QUANTITY', quantity: '0.00000000000000000000', unitPrice: '20000', pricingSource: 'CATALOG', amount: '0' };
export const pcCustom: ChargeItem = { ...pcFixed, itemCode: pcId(130), roomServiceId: pcId(130), serviceId: pcId(131), itemName: 'Dọn phòng', unit: 'lần', chargeMethod: 'CUSTOM', unitPrice: null, manualAmount: '50000', prorateFactor: '1', pricingSource: null, basisDate: null, amount: '50000' };
export const pcFee: ChargeItem = { ...pcCustom, itemType: 'FEE', itemCode: pcId(140), itemName: 'Thay khóa', roomServiceId: null, serviceId: null, adjustmentId: pcId(140), manualAmount: null, amount: '30000' };
export const pcDiscount: ChargeItem = { ...pcFee, itemType: 'DISCOUNT', itemCode: pcId(150), adjustmentId: pcId(150), itemName: 'Giảm trừ dịch vụ', amount: '-20000' };
export const pcMissing: ChargeItem = { ...pcMeter, amount: null, endIndex: null, consumption: null, unitPrice: null, pricingSource: null, status: 'MISSING_DATA', missingReason: 'Thiếu chỉ số cuối và đơn giá lịch sử cho kỳ. Cần kiểm tra dữ liệu đã ghi nhận tại thời điểm áp dụng.' };
export function pcDetail(header: PeriodHeader = pcHeader, state = 'full'): ProvisionalDetail {
  let items = [pcMeter, pcFixed, pcQuantity, pcCustom, pcFee, pcDiscount];
  if (state === 'partial') items = [pcMissing, pcQuantity, pcDiscount];
  if (state === 'insufficient') items = [pcMissing];
  if (state === 'empty') items = [];
  if (state === 'long') items = [{ ...pcCustom, manualAmount: '9007199254740993', amount: '9007199254740993' }, pcMeter];
  const count = items.filter(i => i.status === 'CALCULATED').length;
  const status = !items.length ? 'EMPTY' : count === 0 ? 'INSUFFICIENT_DATA' : count === items.length ? 'FULL' : 'PARTIAL';
  const labels = { EMPTY: 'Không có khoản áp dụng', FULL: 'Tổng tạm tính', PARTIAL: 'Tổng một phần', INSUFFICIENT_DATA: 'Chưa đủ dữ liệu để tạm tính' };
  return { ...header, rentalContractId: pcId(30), tenancyId: pcId(31), tenancyFromDate: '2026-01-01', tenancyToDate: null,
    items, summary: { status, displayLabel: labels[status], totalAmount: status === 'INSUFFICIENT_DATA' ? null : items.reduce((sum, i) => sum + BigInt(i.amount ?? '0'), 0n).toString(), calculatedItemsCount: count, missingItemsCount: items.length - count }, concurrencyToken: pcToken, isStale: false };
}
const numeric = new Set(['startIndex', 'endIndex', 'consumption', 'quantity', 'manualAmount', 'unitPrice', 'prorateFactor', 'amount', 'totalAmount']);
export function pcWire(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(pcWire);
  if (!value || typeof value !== 'object' || isLosslessNumber(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, numeric.has(key) && typeof v === 'string' ? new LosslessNumber(v) : pcWire(v)]));
}
export function pcReply(data: unknown, status = 200, code?: string, etag?: string): Response {
  const body = status >= 400 ? { status, message: 'Fixture error', error: 'HTTP label', ...(code ? { code } : {}), ...(code === 'RELOAD_FAILED_KEEPING_STALE' ? { isStale: true } : {}) }
    : { status, message: 'Thành công', data: pcWire(data), ...(code ? { code } : {}) };
  return new Response(status === 304 ? null : stringify(body), { status, headers: { 'Content-Type': 'application/json', ...(etag ? { ETag: etag } : {}) } });
}
export interface PcCall { path: string; method: string; etag: string | null; signal?: AbortSignal | null }
export function pcFixture(options: { mode?: string; role?: ProvisionalRole | 'ADMIN'; onCall?: (call: PcCall) => void; delay?: number } = {}) {
  const calls: PcCall[] = [], mode = options.mode || 'full'; let reads = 0;
  const user = options.role === 'CUSTOMER' ? pcCustomer : options.role === 'ADMIN' ? { ...pcHost, role: 'ADMIN' as const } : pcHost;
  const fetcher = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const path = new URL(String(input), location.origin).pathname;
    const call = { path, method: init.method || 'GET', etag: new Headers(init.headers).get('If-None-Match'), signal: init.signal };
    calls.push(call); options.onCall?.(call);
    if (path.endsWith('/auth/me')) return pcReply(user);
    if (path.endsWith('/profile')) return pcReply(null, 500);
    if (!path.includes('/provisional-charges/')) return pcReply(null, 404);
    if (call.method !== 'GET') throw new Error('UC39 must only read');
    if (options.delay) await new Promise(resolve => setTimeout(resolve, options.delay));
    if (path.endsWith('/periods')) {
      if (mode === 'list-error') return pcReply(null, 500, 'DATA_ACCESS_ERROR');
      return pcReply(mode === 'no-tenancy' || mode === 'no-periods' ? [] : pcHeaders, 200, mode === 'no-tenancy' ? 'NO_ACTIVE_TENANCY' : mode === 'no-periods' ? 'NO_UNCLOSED_PERIODS' : undefined);
    }
    reads++;
    const errors: Record<string, [number, string]> = { moved: [403, 'TENANCY_TERMINATED_OR_MOVED'], denied: [403, 'ACCESS_DENIED'], closed: [409, 'PERIOD_SEALED_OR_INVOICE_ISSUED'], source: [422, 'CALCULATION_OR_SOURCE_DATA_INVALID'], 'read-error': [500, 'DATA_ACCESS_ERROR'] };
    if (errors[mode]) return pcReply(null, ...errors[mode]);
    if (reads > 1 && mode === 'stale') return pcReply(null, 500, 'RELOAD_FAILED_KEEPING_STALE');
    if (reads > 1 && mode === 'concurrent') return pcReply(null, 409, 'CONTEXT_STALE_CONCURRENCY_CONFLICT');
    const header = pcHeaders.find(h => path.endsWith('/' + h.periodId));
    if (!header) return pcReply(null, 404, 'PERIOD_NOT_FOUND');
    if (call.etag === '"' + pcToken + '"') return pcReply(null, 304, undefined, call.etag);
    return pcReply(pcDetail(header, mode), 200, mode === 'empty' ? 'NO_APPLICABLE_CHARGES' : undefined, '"' + pcToken + '"');
  };
  return { calls, fetcher, user };
}
