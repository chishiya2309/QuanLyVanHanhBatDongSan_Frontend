import { isLosslessNumber, LosslessNumber, parse, stringify } from 'lossless-json';
import type { AuthenticatedUserResponse } from '../../src/types/auth';
import type { FundingRoute, FundingSource, DeactivationImpact } from '../../src/types/fundingSource';
export const fsId = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
export const fsHost: AuthenticatedUserResponse = { accountId: fsId(900), loginName: 'Host UC40', role: 'HOST', hostId: fsId(901), customerId: null };
export const fsRoute: FundingRoute = { type: '', active: '', action: null, sourceId: null, invalid: false };
export const fsBanks = [{ bankCode: 'VCB', name: 'Vietcombank' }, { bankCode: 'MB', name: 'Ngân hàng Quân đội' }];
export const fsBank: FundingSource = { id: fsId(1), name: 'VCB nhận tiền phòng', type: 'BANK', bankDetails: { bankCode: 'VCB', accountNumber: '001234567890', accountHolder: 'Nguyễn Văn An' }, active: true, hasTransactions: false, version: '9007199254740993', canEditBankDetails: true };
export const fsCash: FundingSource = { id: fsId(2), name: 'Quỹ tiền mặt', type: 'CASH', bankDetails: null, active: true, hasTransactions: false, version: '0', canEditBankDetails: false };
export const fsLocked: FundingSource = { ...fsBank, id: fsId(3), name: 'MB tiền thuê nhà', bankDetails: { bankCode: 'MB', accountNumber: '000099990000', accountHolder: 'Trần Thị Bình' }, hasTransactions: true, canEditBankDetails: false, active: false };
export function fsImpact(source = fsBank, count = 2, token = 'a'.repeat(64)): DeactivationImpact {
  return { sourceId: source.id, active: source.active, version: source.version, affectedRooms: Array.from({ length: count }, (_, i) => ({ roomId: fsId(100 + i), roomCode: 'P' + (101 + i), roomName: 'Phòng ' + (101 + i), buildingName: 'Tòa An Phú', defaultRole: source.type })), totalRooms: count, warning: count ? 'Nguồn tiền này đang được sử dụng làm nguồn mặc định của phòng. Vui lòng kiểm tra trước khi ngừng hoạt động.' : 'Bạn có chắc muốn ngừng hoạt động nguồn tiền này?', confirmationToken: token };
}
export function fsWire(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(fsWire);
  if (!value || typeof value !== 'object' || isLosslessNumber(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, key === 'version' && typeof v === 'string' ? new LosslessNumber(v) : fsWire(v)]));
}
export function fsReply(data: unknown, status = 200, code = '', fieldErrors?: Record<string, string>): Response {
  return new Response(stringify(status >= 400 ? { status, code, message: 'Fixture message', error: 'Conflict', fieldErrors } : { status, message: 'Thành công', data: fsWire(data) }), { status, headers: { 'Content-Type': 'application/json' } });
}
export interface FsCall { path: string; query: string; method: string; body: string | null; csrf: string | null }
// Fixtures live only in tests; the production application uses its real API client.
export function fsFixture(options: { mode?: string; role?: 'HOST' | 'CUSTOMER' | 'ADMIN'; onCall?: (c: FsCall) => void } = {}) {
  const mode = options.mode || 'full', calls: FsCall[] = [];
  const user = { ...fsHost, role: options.role || 'HOST' };
  let rows = mode === 'empty' ? [] : [structuredClone(fsBank), structuredClone(fsCash), structuredClone(fsLocked)];
  if (mode === 'long') rows[0].name = 'Nguồn tiền nhận tiền thuê nhà và chi phí dịch vụ khu căn hộ An Phú — tài khoản chính';
  let writes = 0, reads = 0, conflicts = 0;
  const fetcher = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input), location.origin), path = url.pathname;
    const call = { path, query: url.search, method: init.method || 'GET', body: typeof init.body === 'string' ? init.body : null, csrf: new Headers(init.headers).get('X-CSRF-TOKEN') };
    calls.push(call); options.onCall?.(call);
    if (path.endsWith('/auth/me')) return fsReply(user);
    if (path.endsWith('/profile')) return fsReply(null, 500);
    if (path.endsWith('/auth/csrf')) return fsReply({ headerName: 'X-CSRF-TOKEN', token: 'fs-test-token' });
    if (path.endsWith('/banks')) return mode === 'bank-error' ? fsReply(null, 500) : fsReply(fsBanks);
    if (!path.includes('/funding-sources')) return fsReply(null, 404);
    if (mode === 'denied') return fsReply(null, 403, 'FORBIDDEN');
    if (mode === 'read-error' && call.method === 'GET') return fsReply(null, 500);
    if (mode === 'loading' && call.method === 'GET') await new Promise(resolve => setTimeout(resolve, 1500));
    const parts = path.split('/'), id = parts[4], source = rows.find(s => s.id === id);
    if (call.method === 'GET') {
      if (path.endsWith('/funding-sources')) {
        reads++;
        if (mode === 'reload-error' && writes && reads > 1) return fsReply(null, 500);
        return fsReply(rows.filter(s => (!url.searchParams.has('type') || s.type === url.searchParams.get('type')) && (!url.searchParams.has('active') || String(s.active) === url.searchParams.get('active'))));
      }
      if (!source) return fsReply(null, 404, 'FUNDING_NOT_FOUND');
      if (path.endsWith('/deactivation-impact')) return fsReply(fsImpact(source, mode === 'no-rooms' ? 0 : mode === 'one-room' ? 1 : mode === 'many-rooms' ? 30 : 2, conflicts ? 'b'.repeat(64) : 'a'.repeat(64)));
      return fsReply(source);
    }
    writes++;
    if (mode === 'slow-write') await new Promise(resolve => setTimeout(resolve, 150));
    if (mode === 'duplicate') return fsReply(null, 409, 'FUNDING_NAME_DUPLICATE');
    if (mode === 'account-duplicate') return fsReply(null, 409, 'FUNDING_BANK_ACCOUNT_DUPLICATE');
    if (mode === 'storage') return fsReply(null, 500, 'FUNDING_STORAGE_FAILURE');
    if (mode === 'csrf') return fsReply(null, 403, 'CSRF_INVALID');
    if (mode === 'fields') return fsReply(null, 400, 'FUNDING_INVALID_DATA', { 'bankDetails.accountHolder': 'Chủ tài khoản không hợp lệ' });
    if (mode === 'locked' && !conflicts++ && source) { source.hasTransactions = true; source.canEditBankDetails = false; source.version = '9007199254740994'; return fsReply(null, 409, 'FUNDING_BANK_DETAILS_LOCKED'); }
    if (mode === 'stale' && !conflicts++ && source) { source.name = 'Tên mới từ thiết bị khác'; source.version = '9007199254740994'; return fsReply(null, 409, 'FUNDING_VERSION_STALE'); }
    if (mode === 'impact-changed' && !conflicts++ && source) { source.version = '9007199254740994'; return fsReply(null, 409, 'FUNDING_IMPACT_CHANGED'); }
    const body = parse(call.body || '{}') as Record<string, unknown>;
    if (call.method === 'POST') {
      const created = { ...structuredClone(body.type === 'BANK' ? fsBank : fsCash), id: fsId(10 + writes), name: String(body.name), version: '0', ...(body.bankDetails ? { bankDetails: body.bankDetails as FundingSource['bankDetails'] } : {}) };
      rows = [...rows, created];
      if (mode === 'uncertain') throw new TypeError('Lost after commit');
      if (mode === 'bad-response') return new Response('{', { status: 201 });
      return fsReply(created, 201);
    }
    if (!source) return fsReply(null, 404, 'FUNDING_NOT_FOUND');
    if (path.endsWith('/status')) source.active = body.active as boolean;
    else { source.name = body.name as string; if (body.bankDetails) source.bankDetails = body.bankDetails as FundingSource['bankDetails']; }
    source.version = (BigInt(source.version) + 1n).toString();
    if (mode === 'uncertain') throw new TypeError('Lost after commit');
    return fsReply(source);
  };
  return { fetcher, calls, user };
}
