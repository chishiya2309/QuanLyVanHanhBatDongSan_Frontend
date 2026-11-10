import { AuthApiError } from './authErrors';
import { clearCsrfCache, getCsrfToken } from './csrfClient';
import { authenticatedFetch, sessionGuard, SessionRefreshError } from './sessionClient';
import { isRecord, parseCustomerJson, safeInteger } from './customerCodec';
import { CustomerAccountIntegrityError, decodeCustomerAccount, encodeProvisionCustomerAccount } from './customerAccountCodec';
import { customerAccountMessages as m, type CustomerAccountFieldErrors, type CustomerAccountResponse, type ProvisionCustomerAccountInput } from '../types/customerAccount';
import { isUuid } from '../utils/customerNavigation';

export class CustomerAccountApiError extends Error {
  status: number;
  fieldErrors: CustomerAccountFieldErrors;
  phase: 'read' | 'csrf' | 'write' | 'uncertain';
  constructor(status: number, message: string, fieldErrors: CustomerAccountFieldErrors = {},
    phase: 'read' | 'csrf' | 'write' | 'uncertain' = 'read') {
    super(message); this.name = 'CustomerAccountApiError';
    this.status = status; this.fieldErrors = fieldErrors; this.phase = phase;
  }
}

function failure(status: number, body: unknown, fallback: string, write: boolean): CustomerAccountApiError {
  const valid = isRecord(body) && safeInteger(body.status) === status && typeof body.message === 'string';
  const transport = valid ? String(body.message) : '';
  const fields: CustomerAccountFieldErrors = {};
  if (valid && isRecord(body.fieldErrors)) {
    for (const key of ['email', 'password', 'confirmPassword', 'customerVersion'] as const) {
      if (typeof body.fieldErrors[key] === 'string') fields[key] = body.fieldErrors[key];
    }
  }
  let message = fallback;
  if (status === 401) message = m.sessionInvalid;
  else if (status === 403) message = transport === m.csrfInvalid ? m.csrfInvalid : m.forbidden;
  else if (status === 404) message = m.notFound;
  else if (transport === 'Lỗi hệ thống khi xử lý tài khoản') message = m.wrongRole;
  else if (status === 400) message = m.invalidData;
  else if (status === 409) {
    const conflicts: readonly string[] = [m.alreadyHasAccount, m.emailDuplicate, m.noAccount, m.alreadyLocked, m.alreadyActive];
    message = conflicts.includes(transport) ? transport : m.stale;
  }
  if (message === m.csrfInvalid) clearCsrfCache();
  return new CustomerAccountApiError(status, message, fields, write ? 'write' : 'read');
}

async function request(customerId: string, method: 'GET' | 'POST' | 'PATCH', suffix: string, success: string,
  fallback: string, signal?: AbortSignal, shouldSend = () => true, body?: string): Promise<CustomerAccountResponse> {
  if (!isUuid(customerId)) throw new CustomerAccountApiError(404, m.notFound);
  const write = method !== 'GET';
  const current = sessionGuard(shouldSend);
  const check = () => { if (!current() || signal?.aborted) throw Object.assign(new Error('Earlier account request'), { name: 'AbortError' }); };
  const headers: Record<string, string> = { Accept: 'application/json' };
  check();
  if (write) {
    try {
      const csrf = await getCsrfToken();
      check(); headers[csrf.headerName] = csrf.token;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw new CustomerAccountApiError(error instanceof AuthApiError ? error.status : 0,
        error instanceof Error ? error.message : fallback, {}, 'csrf');
    }
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response: Response;
  try {
    check();
    const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
    response = await authenticatedFetch(`${base}/customers/${encodeURIComponent(customerId)}/account${suffix}`,
      { method, body, headers, signal, credentials: 'include', cache: 'no-store' }, { shouldSend: current, trackNavigation: true });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    if (error instanceof AuthApiError) throw new CustomerAccountApiError(error.status,
      error.status === 401 ? m.sessionInvalid : error instanceof SessionRefreshError ? error.message : fallback, {}, write ? 'write' : 'read');
    throw new CustomerAccountApiError(0, write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read');
  }
  let value: unknown;
  try { value = parseCustomerJson(await response.text()); }
  catch { throw response.ok ? new CustomerAccountApiError(response.status, write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read')
    : failure(response.status, null, fallback, write); }
  check();
  if (!response.ok) throw failure(response.status, value, fallback, write);
  try {
    const expected = method === 'POST' ? 201 : 200;
    if (response.status !== expected || !isRecord(value) || safeInteger(value.status) !== expected || value.message !== success) throw new Error('Invalid account envelope');
    const result = decodeCustomerAccount(value.data, customerId);
    if (write && (!result.hasAccount || result.status !== (suffix === '/lock' ? 'LOCKED' : 'ACTIVE'))) throw new Error('Invalid mutation result');
    return result;
  } catch (error) {
    throw new CustomerAccountApiError(response.status, write ? m.uncertain : error instanceof CustomerAccountIntegrityError ? m.wrongRole : fallback,
      {}, write ? 'uncertain' : 'read');
  }
}

export const getCustomerAccount = (id: string, signal?: AbortSignal, current?: () => boolean) =>
  request(id, 'GET', '', m.detailSuccess, m.detailFailure, signal, current);
export const provisionCustomerAccount = (id: string, input: ProvisionCustomerAccountInput, signal?: AbortSignal, current?: () => boolean) =>
  request(id, 'POST', '', m.provisionSuccess, m.provisionFailure, signal, current, encodeProvisionCustomerAccount(input));
export const lockCustomerAccount = (id: string, signal?: AbortSignal, current?: () => boolean) =>
  request(id, 'PATCH', '/lock', m.lockSuccess, m.lockFailure, signal, current);
export const unlockCustomerAccount = (id: string, signal?: AbortSignal, current?: () => boolean) =>
  request(id, 'PATCH', '/unlock', m.unlockSuccess, m.unlockFailure, signal, current);
