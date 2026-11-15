import { authenticatedFetch, sessionGuard } from './sessionClient';
import { AuthApiError } from './authErrors';
import { isRecord, safeInteger } from './assetCodec';
import { isAssetId } from '../utils/assetNavigation';
import { decodeProvisionalDetail, decodeProvisionalPeriods, parseProvisionalJson } from './provisionalChargeCodec';
import { provisionalMessages as m, type DetailResult, type ProvisionalPeriods, type ProvisionalRole } from '../types/provisionalCharge';

const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
export class ProvisionalApiError extends Error {
  status: number; code: string; isStale: boolean;
  constructor(status: number, code: string, message: string, isStale = false) {
    super(message); this.name = 'ProvisionalApiError'; this.status = status; this.code = code; this.isStale = isStale;
  }
}
export const isProvisionalAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';
const endpoint = (role: ProvisionalRole) => base + '/provisional-charges/' + role.toLowerCase() + '/periods';
function failure(status: number, body: unknown): ProvisionalApiError {
  const valid = isRecord(body) && safeInteger(body.status) === status;
  return new ProvisionalApiError(status, valid && typeof body.code === 'string' ? body.code : status === 401 ? 'INVALID_SESSION'
    : status === 403 ? 'ACCESS_DENIED' : status === 404 ? 'PERIOD_NOT_FOUND' : 'DATA_ACCESS_ERROR',
    status === 401 ? m.session : valid && typeof body.message === 'string' ? body.message : m.readFailure,
    valid && body.isStale === true);
}
async function read(url: string, signal?: AbortSignal, etag?: string): Promise<{ response: Response; body?: Record<string, unknown> }> {
  const current = sessionGuard(() => !signal?.aborted);
  let response: Response;
  try {
    response = await authenticatedFetch(url, { method: 'GET', credentials: 'include', signal, cache: 'no-store',
      headers: { Accept: 'application/json', ...(etag ? { 'If-None-Match': etag } : {}) } }, { shouldSend: current });
  } catch (e) {
    if (isProvisionalAbort(e)) throw e;
    if (e instanceof AuthApiError) throw new ProvisionalApiError(e.status, e.status === 401 ? 'INVALID_SESSION' : 'DATA_ACCESS_ERROR', e.message);
    throw new ProvisionalApiError(0, 'DATA_ACCESS_ERROR', m.readFailure);
  }
  if (!current()) throw new DOMException('Stale response', 'AbortError');
  if (response.status === 304) return { response };
  let value: unknown;
  try { value = parseProvisionalJson(await response.text()); }
  catch { if (!current()) throw new DOMException('Stale response', 'AbortError'); throw failure(response.status, null); }
  if (!current()) throw new DOMException('Stale response', 'AbortError');
  if (!response.ok) throw failure(response.status, value);
  if (response.status !== 200 || !isRecord(value) || safeInteger(value.status) !== 200 || typeof value.message !== 'string'
      || !Object.hasOwn(value, 'data') || value.code !== undefined && typeof value.code !== 'string')
    throw new ProvisionalApiError(200, 'INVALID_RESPONSE', m.readFailure);
  return { response, body: value };
}
export async function getProvisionalPeriods(role: ProvisionalRole, signal?: AbortSignal): Promise<ProvisionalPeriods> {
  const { body } = await read(endpoint(role), signal);
  try {
    if (!body) throw new Error();
    const periods = decodeProvisionalPeriods(body.data), code = body.code as string | undefined;
    if (code && !['NO_ACTIVE_TENANCY', 'NO_UNCLOSED_PERIODS'].includes(code) || code && periods.length) throw new Error();
    return { periods, code, message: body.message as string };
  } catch { throw new ProvisionalApiError(200, 'INVALID_RESPONSE', m.readFailure); }
}
export async function getProvisionalDetail(role: ProvisionalRole, roomId: string, periodId: string, signal?: AbortSignal, etag?: string): Promise<DetailResult> {
  if (!isAssetId(roomId) || !isAssetId(periodId)) throw new ProvisionalApiError(400, 'MISSING_CONTEXT_FIELDS', m.context);
  const { response, body } = await read(endpoint(role) + '/' + encodeURIComponent(periodId), signal, etag);
  if (response.status === 304) return { kind: 'not-modified', etag: response.headers.get('ETag') };
  if (isRecord(body?.data) && (body.data.roomId !== roomId || body.data.periodId !== periodId))
    throw new ProvisionalApiError(200, 'INVALID_CONTEXT_LINK', m.invalid);
  try {
    const detail = decodeProvisionalDetail(body!.data, { roomId, periodId });
    if (body!.code !== undefined && (body!.code !== 'NO_APPLICABLE_CHARGES' || detail.summary.status !== 'EMPTY')) throw new Error();
    return { kind: 'data', detail, etag: response.headers.get('ETag') || '"' + detail.concurrencyToken + '"' };
  } catch { throw new ProvisionalApiError(200, 'INVALID_RESPONSE', m.readFailure); }
}
