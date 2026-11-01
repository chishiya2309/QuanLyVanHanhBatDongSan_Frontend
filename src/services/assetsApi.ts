import { AuthApiError, clearCsrfCache, getCsrfToken } from './authApi';
import { decodeAsset, decodeAssetPage, decodeConditionRecord, encodeAssetBody, isRecord, parseAssetJson, safeInteger } from './assetCodec';
import { assetMessages as m, type AssetQuery, type CreateAssetInput, type RecordConditionInput, type UpdateAssetInput, type AssetFieldErrors } from '../types/assets';
import { isAssetId } from '../utils/assetNavigation';

const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
const allowedMessages = new Set<string>(Object.values(m));
export class AssetApiError extends Error {
  status: number;
  fieldErrors: AssetFieldErrors;
  phase: 'read' | 'csrf' | 'write' | 'uncertain';
  constructor(status: number, message: string, fieldErrors: AssetFieldErrors = {}, phase: 'read' | 'csrf' | 'write' | 'uncertain' = 'read') {
    super(message); this.status = status; this.fieldErrors = fieldErrors; this.phase = phase;
  }
}
const abortError = () => new DOMException('Navigation changed', 'AbortError');
export const isAssetAbort = (error: unknown) => error instanceof Error && error.name === 'AbortError';

function apiError(status: number, value: unknown, fallback: string, write: boolean): AssetApiError {
  const fields: AssetFieldErrors = {};
  const valid = isRecord(value) && safeInteger(value.status) === status && typeof value.message === 'string';
  const message = status === 401 ? m.sessionInvalid : status === 403 ? valid && value.message === m.csrfInvalid ? m.csrfInvalid : m.forbidden : status === 404 ? m.notFound :
    status === 400 && valid && allowedMessages.has(String(value.message)) && !String(value.message).endsWith('thành công') ? String(value.message) : status === 400 ? m.invalid : fallback;
  if (valid && isRecord(value.fieldErrors)) {
    for (const field of ['name', 'purchaseValue', 'note', 'condition'] as const) {
      const text = value.fieldErrors[field];
      if (typeof text === 'string' && allowedMessages.has(text)) fields[field] = text;
    }
  }
  if (status === 403 && message === m.csrfInvalid) clearCsrfCache();
  return new AssetApiError(status, message, fields, write ? 'write' : 'read');
}
async function request<T>(path: string, expectedStatus: number, expectedMessage: string, decode: (value: unknown) => T,
  fallback: string, init: RequestInit = {}): Promise<T> {
  const write = init.method === 'POST' || init.method === 'PUT';
  let response: Response;
  try {
    response = await fetch(base + path, { ...init, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json', ...init.headers } });
  } catch (error) {
    if (isAssetAbort(error)) throw error;
    throw new AssetApiError(0, write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read');
  }
  let body: unknown;
  try { body = parseAssetJson(await response.text()); }
  catch {
    if (!response.ok) throw apiError(response.status, null, fallback, write);
    throw new AssetApiError(response.status, write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read');
  }
  if (!response.ok) throw apiError(response.status, body, fallback, write);
  try {
    if (response.status !== expectedStatus || !isRecord(body) || safeInteger(body.status) !== expectedStatus || body.message !== expectedMessage || !Object.hasOwn(body, 'data')) throw new Error('Invalid envelope');
    return decode(body.data);
  } catch { throw new AssetApiError(response.status, write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read'); }
}
async function mutation<T>(path: string, method: 'POST' | 'PUT', body: string, status: number, message: string, decode: (value: unknown) => T, shouldSend: () => boolean): Promise<T> {
  let headerName: string, token: string;
  try {
    const csrf = await getCsrfToken();
    if (!csrf || !/^[!#$%&'*+.^_`|~\da-z-]+$/i.test(csrf.headerName) || !csrf.token?.trim() || /[\r\n]/.test(csrf.token) || ['accept', 'content-type', 'cookie', 'authorization', 'host'].includes(csrf.headerName.toLowerCase())) throw new Error('Invalid CSRF');
    headerName = csrf.headerName; token = csrf.token;
  } catch (error) {
    if (!shouldSend()) throw abortError();
    if (error instanceof AuthApiError && error.status === 401) throw new AssetApiError(401, m.sessionInvalid, {}, 'csrf');
    clearCsrfCache();
    throw new AssetApiError(error instanceof AuthApiError ? error.status : 0, error instanceof AuthApiError && error.status === 403 ? m.csrfInvalid : m.csrfFailure, {}, 'csrf');
  }
  if (!shouldSend()) throw abortError();
  return request(path, status, message, decode, m.saveFailure, { method, headers: { 'Content-Type': 'application/json', [headerName]: token }, body });
}
function checkedAssetId(id: string): string {
  if (!isAssetId(id)) throw new AssetApiError(404, m.notFound);
  return encodeURIComponent(id);
}
export async function listAssets(query: AssetQuery, signal?: AbortSignal) {
  if (!Number.isSafeInteger(query.page) || query.page < 0 || query.page > 2147483647 || !Number.isInteger(query.size) || query.size < 1 || query.size > 100 || query.q.trim().length > 200) throw new AssetApiError(400, m.invalid);
  const params = new URLSearchParams({ page: String(query.page), size: String(query.size) });
  if (query.q.trim()) params.set('q', query.q.trim());
  return request('/assets?' + params.toString(), 200, m.listSuccess, (value) => {
    const page = decodeAssetPage(value);
    if (page.page !== query.page || page.size !== query.size) throw new Error('Wrong query response');
    return page;
  }, m.listFailure, { signal });
}
export async function getAsset(id: string, signal?: AbortSignal) {
  return request('/assets/' + checkedAssetId(id), 200, m.detailSuccess, (value) => {
    const asset = decodeAsset(value); if (asset.assetId !== id) throw new Error('Wrong asset'); return asset;
  }, m.detailFailure, { signal });
}
export async function createAsset(input: CreateAssetInput, shouldSend = () => true) {
  return mutation('/assets', 'POST', encodeAssetBody({ name: input.name, purchaseValue: input.purchaseValue }), 201, m.createSuccess, (value) => {
    const asset = decodeAsset(value); if (asset.condition !== 'GOOD') throw new Error('Invalid initial condition'); return asset;
  }, shouldSend);
}
export async function updateAsset(id: string, input: UpdateAssetInput, shouldSend = () => true) {
  return mutation('/assets/' + checkedAssetId(id), 'PUT', encodeAssetBody({ name: input.name, purchaseValue: input.purchaseValue, note: input.note }), 200, m.updateSuccess, (value) => {
    const asset = decodeAsset(value); if (asset.assetId !== id) throw new Error('Wrong asset'); return asset;
  }, shouldSend);
}
export async function recordAssetCondition(id: string, input: RecordConditionInput, shouldSend = () => true) {
  return mutation('/assets/' + checkedAssetId(id) + '/condition-records', 'POST', JSON.stringify({ condition: input.condition, note: input.note }), 201, m.conditionSuccess, (value) => {
    const record = decodeConditionRecord(value); if (record.assetId !== id || record.condition !== input.condition) throw new Error('Wrong condition record'); return record;
  }, shouldSend);
}
