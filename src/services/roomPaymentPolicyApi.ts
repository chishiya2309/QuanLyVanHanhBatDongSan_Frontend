import { AuthApiError } from './authErrors';
import { authenticatedFetch, sessionGuard } from './sessionClient';
import { clearCsrfCache, getCsrfToken } from './csrfClient';
import { isRecord, safeInteger } from './assetCodec';
import { isAssetId } from '../utils/assetNavigation';
import { paymentMessages as m, type PaymentDraft, type PaymentErrors, type PaymentField, type RoomPaymentPolicy } from '../types/roomPaymentPolicy';
import { decodePaymentApplication, decodePaymentTargets, decodeRoomPaymentPolicy, encodePaymentApplication, encodePaymentSave, parsePaymentJson } from './roomPaymentPolicyCodec';

const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
export class PaymentPolicyApiError extends Error {
  status: number; code: string; fieldErrors: PaymentErrors; phase: 'read' | 'csrf' | 'write' | 'uncertain';
  constructor(status: number, code: string, message: string, fieldErrors: PaymentErrors = {}, phase: PaymentPolicyApiError['phase'] = 'read') {
    super(message); this.name = 'PaymentPolicyApiError'; this.status = status; this.code = code; this.fieldErrors = fieldErrors; this.phase = phase;
  }
}
export const isPaymentAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';
const fieldNames = new Set(['allowCash', 'allowTransfer', 'cashDefaultId', 'bankDefaultId', 'version', 'roomIds', 'sourcePolicyVersion', 'confirmed', 'body', 'sourceRoomId', 'applyToAll']);
function apiError(status: number, v: unknown, write: boolean, fallback: string): PaymentPolicyApiError {
  const value = isRecord(v) && safeInteger(v.status) === status ? v : {};
  let code = typeof value.code === 'string' ? value.code : '', message = fallback;
  const fields: PaymentErrors = {};
  if (status === 400) {
    message = typeof value.message === 'string' && code === 'PAYMENT_POLICY_INVALID_DATA' ? value.message : m.invalid;
    if (isRecord(value.fieldErrors)) for (const [key, error] of Object.entries(value.fieldErrors)) {
      if (fieldNames.has(key) && typeof error === 'string' && error.trim()) fields[key as PaymentField] = error;
    }
  }
  if (status === 401) { code = 'SESSION_INVALID'; message = m.session; }
  if (status === 403) {
    if (code.includes('CSRF') || typeof value.message === 'string' && /CSRF/i.test(value.message)) {
      code = 'CSRF_INVALID'; message = m.csrf; clearCsrfCache();
    } else { code = 'FORBIDDEN'; message = m.forbidden; }
  }
  if (status === 404) { code = 'ROOM_NOT_FOUND'; message = m.notFound; }
  if (status === 409) message = m.stale;
  return new PaymentPolicyApiError(status, code, message, fields, write ? 'write' : 'read');
}
async function request<T>(path: string, decode: (v: unknown) => T, init: RequestInit = {}, shouldSend = () => true, fallback: string = m.read): Promise<T> {
  const write = init.method === 'PUT' || init.method === 'POST', current = sessionGuard(shouldSend);
  let response: Response;
  try {
    response = await authenticatedFetch(base + path, { ...init, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json', ...init.headers } }, { shouldSend: current, trackNavigation: true });
  } catch (error) {
    if (isPaymentAbort(error)) throw error;
    if (error instanceof AuthApiError) throw new PaymentPolicyApiError(error.status, error.status === 401 ? 'SESSION_INVALID' : 'SESSION_REFRESH_PENDING', error.status === 401 ? m.session : error.message, {}, write ? 'write' : 'read');
    throw new PaymentPolicyApiError(0, write ? 'PAYMENT_UNCERTAIN' : 'PAYMENT_READ_FAILURE', write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read');
  }
  let body: unknown;
  try { body = parsePaymentJson(await response.text()); }
  catch {
    if (!current()) throw new DOMException('Stale payment response', 'AbortError');
    if (!response.ok && response.status < 500) throw apiError(response.status, null, write, fallback);
    throw new PaymentPolicyApiError(response.status, 'PAYMENT_INVALID_RESPONSE', write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read');
  }
  if (!current()) throw new DOMException('Stale payment response', 'AbortError');
  if (!response.ok) {
    if (write && response.status >= 500 && (!isRecord(body) || body.code !== 'FUNDING_STORAGE_FAILURE' || safeInteger(body.status) !== response.status))
      throw new PaymentPolicyApiError(response.status, 'PAYMENT_UNCERTAIN', m.uncertain, {}, 'uncertain');
    throw apiError(response.status, body, write, write ? m.storage : fallback);
  }
  try {
    if (response.status !== 200 || !isRecord(body) || safeInteger(body.status) !== 200 || typeof body.message !== 'string' || !Object.hasOwn(body, 'data')) throw new Error('Invalid envelope');
    return decode(body.data);
  } catch { throw new PaymentPolicyApiError(response.status, 'PAYMENT_INVALID_RESPONSE', write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read'); }
}
function pathFor(roomId: string): string {
  if (!isAssetId(roomId)) throw new PaymentPolicyApiError(404, 'ROOM_NOT_FOUND', m.notFound);
  return '/rooms/' + encodeURIComponent(roomId) + '/payment-policy';
}
export function getRoomPaymentPolicy(roomId: string, signal?: AbortSignal) {
  return request(pathFor(roomId), v => decodeRoomPaymentPolicy(v, roomId), { signal });
}
export function getPaymentTargets(source: RoomPaymentPolicy, signal?: AbortSignal) {
  return request(pathFor(source.roomId) + '/applicable-rooms', v => decodePaymentTargets(v, source), { signal }, undefined, m.targetRead);
}
async function mutation<T>(path: string, method: 'PUT' | 'POST', body: string, decode: (v: unknown) => T, shouldSend: () => boolean) {
  const current = sessionGuard(shouldSend);
  let csrf: { headerName: string; token: string };
  try { csrf = await getCsrfToken(); }
  catch {
    if (!current()) throw new DOMException('Stale payment request', 'AbortError');
    clearCsrfCache(); throw new PaymentPolicyApiError(0, 'CSRF_UNAVAILABLE', m.csrf, {}, 'csrf');
  }
  if (!current()) throw new DOMException('Stale payment request', 'AbortError');
  return request(path, decode, { method, body, headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token } }, current);
}
export function saveRoomPaymentPolicy(snapshot: RoomPaymentPolicy, draft: PaymentDraft, shouldSend = () => true) {
  let body: string;
  try { body = encodePaymentSave(draft, snapshot.version); }
  catch { throw new PaymentPolicyApiError(400, 'PAYMENT_POLICY_INVALID_DATA', m.invalid, {}, 'write'); }
  return mutation(pathFor(snapshot.roomId), 'PUT', body, v => {
    const result = decodeRoomPaymentPolicy(v, snapshot.roomId), p = result.policy;
    if (!result.configured || !p || p.allowCash !== draft.allowCash || p.allowTransfer !== draft.allowTransfer
        || p.cashDefault?.id !== (draft.allowCash ? draft.cashDefaultId : undefined)
        || p.bankDefault?.id !== (draft.allowTransfer ? draft.bankDefaultId : undefined)
        || p.cashDefault && !p.cashDefault.active || p.bankDefault && !p.bankDefault.active
        || snapshot.version !== null && BigInt(result.version!) < BigInt(snapshot.version)) throw new Error('Wrong saved configuration');
    return result;
  }, shouldSend);
}
export function applyRoomPaymentPolicy(source: RoomPaymentPolicy, all: boolean, ids: string[], shouldSend = () => true) {
  let body: string;
  try { body = encodePaymentApplication(source, all, ids); }
  catch { throw new PaymentPolicyApiError(400, 'PAYMENT_POLICY_INVALID_DATA', m.invalid, {}, 'write'); }
  const selected = all ? null : [...new Set(ids)];
  return mutation(pathFor(source.roomId) + '/applications', 'POST', body, v => decodePaymentApplication(v, source.roomId, selected), shouldSend);
}
