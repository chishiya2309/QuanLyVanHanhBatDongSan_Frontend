import { catalogMessages as m, type CatalogFieldErrors, type CatalogFields, type CatalogService } from '../types/serviceCatalog';
import { isAssetId } from '../utils/assetNavigation';
import { validateCatalogFields } from '../utils/serviceCatalogValidation';
import { isRecord, safeInteger } from './assetCodec';
import { AuthApiError } from './authErrors';
import { clearCsrfCache, getCsrfToken } from './csrfClient';
import { authenticatedFetch, sessionGuard } from './sessionClient';
import { decodeCatalogList, decodeCatalogService, encodeCatalogBody, parseCatalogJson } from './serviceCatalogCodec';

const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
const conflicts = new Set<string>([m.stale, m.statusConflict, m.priceRequired, m.priceConflict]);
export class CatalogApiError extends Error {
  status: number; fieldErrors: CatalogFieldErrors; phase: 'read' | 'csrf' | 'write' | 'uncertain'; currentActive?: boolean;
  constructor(status: number, message: string, fieldErrors: CatalogFieldErrors = {},
    phase: 'read' | 'csrf' | 'write' | 'uncertain' = 'read', currentActive?: boolean) {
    super(message); this.name = 'CatalogApiError'; this.status = status; this.fieldErrors = fieldErrors; this.phase = phase; this.currentActive = currentActive;
  }
}
export const isCatalogAbort = (error: unknown) => error instanceof Error && error.name === 'AbortError';
function errorResponse(status: number, value: unknown, fallback: string, write: boolean): CatalogApiError {
  const valid = isRecord(value) && safeInteger(value.status) === status;
  const message = status === 401 ? m.sessionInvalid : status === 403 ? valid && value.message === m.csrfInvalid ? m.csrfInvalid : m.forbidden :
    status === 404 ? m.notFound : status === 400 ? m.invalid : status === 409 && valid && typeof value.message === 'string' && conflicts.has(value.message) ? value.message : status === 409 ? m.stale : fallback;
  const fields: CatalogFieldErrors = {};
  const fieldFallbacks = { name: 'Vui lòng kiểm tra tên dịch vụ', unit: 'Vui lòng kiểm tra đơn vị', method: 'Vui lòng chọn phương pháp tính được hỗ trợ', defaultPrice: 'Vui lòng kiểm tra đơn giá danh mục', version: m.stale };
  let currentActive: boolean | undefined;
  if (valid && isRecord(value.fieldErrors)) {
    for (const key of Object.keys(fieldFallbacks) as (keyof CatalogFieldErrors)[]) if (Object.hasOwn(value.fieldErrors, key)) fields[key] = fieldFallbacks[key];
    if (value.fieldErrors.active === 'true' || value.fieldErrors.active === 'false') currentActive = value.fieldErrors.active === 'true';
  }
  if (message === m.csrfInvalid) clearCsrfCache();
  return new CatalogApiError(status, message, fields, write ? 'write' : 'read', currentActive);
}
async function request<T>(path: string, expected: number, message: string, decode: (value: unknown) => T, fallback: string, init: RequestInit = {}, shouldSend = () => true): Promise<T> {
  const write = ['POST', 'PUT', 'PATCH'].includes(init.method || '');
  let response: Response;
  try {
    response = await authenticatedFetch(base + path, { ...init, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json', ...init.headers } }, { shouldSend, trackNavigation: write });
  } catch (error) {
    if (isCatalogAbort(error)) throw error;
    if (error instanceof AuthApiError) throw new CatalogApiError(error.status, error.status === 401 ? m.sessionInvalid : error.message, {}, write ? 'write' : 'read');
    throw new CatalogApiError(0, write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read');
  }
  let body: unknown;
  try { body = parseCatalogJson(await response.text()); }
  catch { if (!response.ok) throw errorResponse(response.status, null, fallback, write); throw new CatalogApiError(response.status, write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read'); }
  if (!response.ok) throw errorResponse(response.status, body, fallback, write);
  try {
    if (response.status !== expected || !isRecord(body) || safeInteger(body.status) !== expected || body.message !== message || !Object.hasOwn(body, 'data')) throw new Error('Invalid envelope');
    return decode(body.data);
  } catch { throw new CatalogApiError(response.status, write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read'); }
}
async function mutation(path: string, method: 'POST' | 'PUT' | 'PATCH', fields: Record<string, string | boolean>, status: number, message: string, fallback: string, check: (item: CatalogService) => boolean, shouldSend: () => boolean) {
  let body: string;
  try { body = encodeCatalogBody(fields); }
  catch { throw new CatalogApiError(400, m.invalid); }
  const guard = sessionGuard(shouldSend);
  let csrf: { headerName: string; token: string };
  try {
    csrf = await getCsrfToken();
    if (!csrf || !/^[!#$%&'*+.^_`|~\da-z-]+$/i.test(csrf.headerName) || !csrf.token?.trim() || /[\r\n]/.test(csrf.token) || ['accept', 'content-type', 'cookie', 'authorization', 'host'].includes(csrf.headerName.toLowerCase())) throw new Error('Invalid CSRF');
  } catch (error) {
    if (!guard()) throw new DOMException('Stale request', 'AbortError');
    clearCsrfCache();
    throw new CatalogApiError(error instanceof AuthApiError ? error.status === 401 ? 503 : error.status : 0, error instanceof AuthApiError && error.status === 403 ? m.csrfInvalid : m.csrfFailure, {}, 'csrf');
  }
  if (!guard()) throw new DOMException('Stale request', 'AbortError');
  return request(path, status, message, (value) => { const item = decodeCatalogService(value); if (!check(item)) throw new Error('Wrong mutation result'); return item; }, fallback,
    { method, body, headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token } }, guard);
}
function idPath(id: string) { if (!isAssetId(id)) throw new CatalogApiError(404, m.notFound); return '/services/' + encodeURIComponent(id); }
export const listCatalogServices = (signal?: AbortSignal) => request('/services', 200, m.listSuccess, decodeCatalogList, m.listFailure, { signal });
export const getCatalogService = (id: string, signal?: AbortSignal) => request(idPath(id), 200, m.detailSuccess, (value) => { const item = decodeCatalogService(value); if (item.id !== id) throw new Error('Wrong service'); return item; }, m.detailFailure, { signal });
function checkedFields(fields: CatalogFields) {
  const errors = validateCatalogFields(fields);
  if (Object.keys(errors).length) throw new CatalogApiError(400, m.invalid, errors);
  return { name: fields.name.trim(), unit: fields.unit.trim(), defaultPrice: fields.defaultPrice.trim() };
}
export function createCatalogService(fields: CatalogFields, shouldSend = () => true) {
  return mutation('/services', 'POST', { ...checkedFields(fields), method: fields.method }, 201, m.createSuccess, m.createFailure,
    (item) => item.pricingStatus === 'CONFIGURED' && item.active, shouldSend);
}
export function updateCatalogService(id: string, fields: CatalogFields, version: string, shouldSend = () => true) {
  return mutation(idPath(id), 'PUT', { ...checkedFields(fields), version }, 200, m.updateSuccess, m.updateFailure,
    (item) => item.id === id && item.pricingStatus === 'CONFIGURED', shouldSend);
}
export function changeCatalogServiceStatus(id: string, active: boolean, version: string, shouldSend = () => true) {
  return mutation(idPath(id) + '/status', 'PATCH', { active, version }, 200, active ? m.activateSuccess : m.deactivateSuccess, m.statusFailure,
    (item) => item.id === id && item.active === active, shouldSend);
}
