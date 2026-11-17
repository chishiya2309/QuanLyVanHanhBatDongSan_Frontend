import { isRecord, safeInteger } from './assetCodec';
import { AuthApiError } from './authErrors';
import { authenticatedFetch, sessionGuard } from './sessionClient';
import { clearCsrfCache, getCsrfToken } from './csrfClient';
import { decodeBanks, decodeFundingList, decodeFundingSource, decodeImpact, encodeFundingBody, parseFundingJson } from './fundingCodec';
import { isAssetId } from '../utils/assetNavigation';
import { fundingBank, validateFundingFields } from '../utils/fundingValidation';
import { fundingMessages as m, type FundingErrors, type FundingFields, type FundingRoute, type FundingSource, type SupportedBank, type DeactivationImpact } from '../types/fundingSource';
const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
export class FundingApiError extends Error {
  status: number; code: string; fieldErrors: FundingErrors; phase: 'read' | 'csrf' | 'write' | 'uncertain';
  constructor(status: number, code: string, message: string, fieldErrors: FundingErrors = {}, phase: 'read' | 'csrf' | 'write' | 'uncertain' = 'read') {
    super(message); this.name = 'FundingApiError'; this.status = status; this.code = code; this.fieldErrors = fieldErrors; this.phase = phase;
  }
}
export const isFundingAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';
const messages: Record<string, string> = {
  FUNDING_INVALID_DATA: m.invalid, FUNDING_NAME_DUPLICATE: m.duplicateName, FUNDING_BANK_ACCOUNT_DUPLICATE: m.duplicateAccount,
  FUNDING_BANK_DETAILS_LOCKED: m.bankLocked, FUNDING_VERSION_STALE: m.stale, FUNDING_IMPACT_CHANGED: m.impactChanged,
  FUNDING_NOT_FOUND: m.notFound, FUNDING_STORAGE_FAILURE: m.saveFailure,
};
function apiError(status: number, v: unknown, write: boolean, fallback: string) {
  const value = isRecord(v) && safeInteger(v.status) === status ? v : {};
  let code = typeof value.code === 'string' ? value.code : '', message = messages[code] || fallback;
  if (status === 401) { code = 'SESSION_INVALID'; message = m.session; }
  if (status === 403) {
    if (code.includes('CSRF') || typeof value.message === 'string' && value.message.includes('CSRF')) { code = 'CSRF_INVALID'; message = m.csrf; clearCsrfCache(); }
    else { code = 'FORBIDDEN'; message = m.forbidden; }
  }
  if (status === 404) { code = 'FUNDING_NOT_FOUND'; message = m.notFound; }
  const fieldErrors: FundingErrors = {};
  if (isRecord(value.fieldErrors)) for (const [field, error] of Object.entries(value.fieldErrors)) {
    const key = field.replace(/^bankDetails\./, '');
    if (['name', 'bankCode', 'accountNumber', 'accountHolder', 'version', 'confirmationToken'].includes(key) && typeof error === 'string' && error.trim()) fieldErrors[key as keyof FundingErrors] = error;
  }
  if (code === 'FUNDING_NAME_DUPLICATE') fieldErrors.name = message;
  if (code === 'FUNDING_BANK_ACCOUNT_DUPLICATE') fieldErrors.accountNumber = message;
  return new FundingApiError(status, code, message, fieldErrors, write ? 'write' : 'read');
}
async function request<T>(path: string, decode: (v: unknown) => T, fallback: string, init: RequestInit = {}, current = () => true): Promise<T> {
  const write = init.method === 'POST' || init.method === 'PATCH';
  let response: Response;
  try { response = await authenticatedFetch(base + path, { ...init, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json', ...init.headers } }, { shouldSend: current, trackNavigation: write }); }
  catch (e) {
    if (isFundingAbort(e)) throw e;
    if (e instanceof AuthApiError) throw new FundingApiError(e.status, e.status === 401 ? 'SESSION_INVALID' : 'SESSION_REFRESH_PENDING', e.message, {}, write ? 'write' : 'read');
    throw new FundingApiError(0, write ? 'FUNDING_UNCERTAIN' : 'FUNDING_READ_FAILURE', write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read');
  }
  let body: unknown;
  try { body = parseFundingJson(await response.text()); }
  catch { if (!response.ok && response.status < 500) throw apiError(response.status, null, write, fallback); throw new FundingApiError(response.status, 'FUNDING_INVALID_RESPONSE', write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read'); }
  if (init.signal?.aborted || !current()) throw new DOMException('Stale funding request', 'AbortError');
  if (!response.ok) {
    // Only a recognized storage failure confirms rollback; an intermediary's 5xx is ambiguous.
    if (write && response.status >= 500 && (!isRecord(body) || body.code !== 'FUNDING_STORAGE_FAILURE'))
      throw new FundingApiError(response.status, 'FUNDING_UNCERTAIN', m.uncertain, {}, 'uncertain');
    throw apiError(response.status, body, write, fallback);
  }
  try {
    const expected = init.method === 'POST' ? 201 : 200;
    if (response.status !== expected || !isRecord(body) || safeInteger(body.status) !== expected || typeof body.message !== 'string' || !Object.hasOwn(body, 'data')) throw new Error('Invalid envelope');
    return decode(body.data);
  } catch { throw new FundingApiError(response.status, 'FUNDING_INVALID_RESPONSE', write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read'); }
}
function sourcePath(id: string) { if (!isAssetId(id)) throw new FundingApiError(404, 'FUNDING_NOT_FOUND', m.notFound); return '/funding-sources/' + encodeURIComponent(id); }
export function listFundingSources(filters: Pick<FundingRoute, 'type' | 'active'>, signal?: AbortSignal) {
  const q = new URLSearchParams(); if (filters.type) q.set('type', filters.type); if (filters.active) q.set('active', filters.active);
  return request('/funding-sources' + (q.size ? '?' + q : ''), decodeFundingList, m.listFailure, { signal });
}
export const listBanks = (signal?: AbortSignal) => request('/banks', decodeBanks, m.bankFailure, { signal });
export const getFundingSource = (id: string, signal?: AbortSignal) => request(sourcePath(id), v => { const s = decodeFundingSource(v); if (s.id !== id) throw new Error('Wrong source'); return s; }, m.detailFailure, { signal });
export const getDeactivationImpact = (id: string, signal?: AbortSignal) => request(sourcePath(id) + '/deactivation-impact', v => { const s = decodeImpact(v); if (s.sourceId !== id) throw new Error('Wrong source'); return s; }, m.impactFailure, { signal });
async function mutation(path: string, method: 'POST' | 'PATCH', fields: Record<string, unknown>, check: (s: FundingSource) => boolean, current: () => boolean) {
  const body = encodeFundingBody(fields), guard = sessionGuard(current);
  let csrf: { headerName: string; token: string };
  try {
    csrf = await getCsrfToken();
    if (!csrf || !/^[!#$%&'*+.^_`|~\da-z-]+$/i.test(csrf.headerName) || !csrf.token?.trim() || /[\r\n]/.test(csrf.token) || ['accept', 'content-type', 'cookie', 'authorization', 'host'].includes(csrf.headerName.toLowerCase())) throw new Error('Invalid CSRF');
  } catch {
    if (!guard()) throw new DOMException('Stale funding request', 'AbortError');
    clearCsrfCache(); throw new FundingApiError(0, 'CSRF_UNAVAILABLE', m.csrf, {}, 'csrf');
  }
  if (!guard()) throw new DOMException('Stale funding request', 'AbortError');
  return request(path, v => { const s = decodeFundingSource(v); if (!check(s)) throw new Error('Wrong mutation result'); return s; }, m.saveFailure,
    { method, body, headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token } }, guard);
}
export function createFundingSource(type: FundingSource['type'], fields: FundingFields, banks: SupportedBank[], current = () => true) {
  const errors = validateFundingFields(fields, type === 'BANK', banks);
  if (Object.keys(errors).length) throw new FundingApiError(400, 'FUNDING_INVALID_DATA', m.invalid, errors);
  return mutation('/funding-sources', 'POST', { name: fields.name.trim(), type, ...(type === 'BANK' ? { bankDetails: fundingBank(fields) } : {}) }, s => s.type === type && s.active && !s.hasTransactions, current);
}
export function updateFundingSource(snapshot: FundingSource, fields: FundingFields, banks: SupportedBank[], current = () => true) {
  const changed = snapshot.canEditBankDetails && JSON.stringify(fundingBank(fields)) !== JSON.stringify(snapshot.bankDetails);
  const errors = validateFundingFields(fields, changed, banks);
  if (Object.keys(errors).length) throw new FundingApiError(400, 'FUNDING_INVALID_DATA', m.invalid, errors);
  return mutation(sourcePath(snapshot.id), 'PATCH', { name: fields.name.trim(), version: snapshot.version, ...(changed ? { bankDetails: fundingBank(fields) } : {}) }, s => s.id === snapshot.id && s.type === snapshot.type, current);
}
export function changeFundingSourceStatus(id: string, active: boolean, version: string, impact: DeactivationImpact | null, current = () => true) {
  if (!active && (!impact || impact.sourceId !== id || impact.version !== version)) throw new FundingApiError(400, 'FUNDING_INVALID_DATA', m.impactFailure);
  return mutation(sourcePath(id) + '/status', 'PATCH', { active, confirmed: true, version, ...(!active ? { confirmationToken: impact!.confirmationToken } : {}) }, s => s.id === id && s.active === active, current);
}
