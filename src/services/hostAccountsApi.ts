import { AuthApiError, clearCsrfCache, getCsrfToken } from './authApi';
import { hostAccountMessages as m, type HostAccountAction, type HostAccountDetail, type HostAccountResponse, type HostAccountSummary } from '../types/hostAccounts';

const BASE = `${import.meta.env.VITE_API_URL || '/api/v1'}/admin/host-accounts`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function nullableString(value: unknown): value is string | null { return value === null || typeof value === 'string'; }
function isSummary(value: unknown): value is HostAccountSummary {
  return record(value) && typeof value.accountId === 'string' && UUID.test(value.accountId)
    && typeof value.loginEmail === 'string' && nullableString(value.businessName)
    && (value.status === 'ACTIVE' || value.status === 'LOCKED')
    && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt));
}
function isDetail(value: unknown): value is HostAccountDetail {
  return isSummary(value) && record(value) && ['officeAddress', 'businessPhone', 'businessEmail', 'logoUrl'].every((key) => nullableString(value[key]));
}
function safeError(status: number, message: unknown, fallback: string): string {
  if (status === 401) return m.sessionInvalid;
  if (status === 403) return message === m.csrfInvalid ? m.csrfInvalid : m.forbidden;
  if (status === 404) return m.notFound;
  if (status === 400) return message === m.wrongRole ? m.wrongRole : m.invalidData;
  if (status === 409 && [m.profileMissing, m.alreadyLocked, m.alreadyActive].some((value) => value === message)) return String(message);
  return fallback;
}

async function request<T>(path: string, fallback: string, check: (data: unknown) => data is T, init: RequestInit = {}, expectedMessage?: string): Promise<HostAccountResponse<T>> {
  try {
    const response = await fetch(BASE + path, { ...init, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json', ...init.headers } });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new AuthApiError(response.status, safeError(response.status, record(body) ? body.message : null, fallback));
    if (response.status !== 200 || !record(body) || body.status !== 200 || typeof body.message !== 'string'
      || !check(body.data) || (expectedMessage && body.message !== expectedMessage)) throw new AuthApiError(response.status, fallback);
    return { status: 200, message: body.message, data: body.data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    if (error instanceof AuthApiError) {
      if (error.message === m.csrfInvalid) clearCsrfCache();
      throw error;
    }
    throw new AuthApiError(0, fallback);
  }
}

export async function listHostAccounts(signal?: AbortSignal): Promise<HostAccountSummary[]> {
  return (await request('', m.listFailure, (value): value is HostAccountSummary[] => Array.isArray(value) && value.every(isSummary), { signal })).data;
}
export async function getHostAccount(accountId: string, signal?: AbortSignal): Promise<HostAccountDetail> {
  if (!UUID.test(accountId)) throw new AuthApiError(400, m.invalidData);
  return (await request('/' + encodeURIComponent(accountId), m.detailFailure,
    (value): value is HostAccountDetail => isDetail(value) && value.accountId.toLowerCase() === accountId.toLowerCase(), { signal }, m.detailSuccess)).data;
}
async function changeHostAccount(accountId: string, action: HostAccountAction): Promise<HostAccountResponse<null>> {
  if (!UUID.test(accountId)) throw new AuthApiError(400, m.invalidData);
  const fallback = action === 'lock' ? m.lockFailure : m.unlockFailure;
  let csrf;
  try {
    csrf = await getCsrfToken();
    if (!csrf || typeof csrf.token !== 'string' || !csrf.token || typeof csrf.headerName !== 'string' || !csrf.headerName) throw new AuthApiError(0, fallback);
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 403) { clearCsrfCache(); throw new AuthApiError(403, m.csrfInvalid); }
    throw new AuthApiError(error instanceof AuthApiError ? error.status : 0,
      error instanceof AuthApiError && error.status === 401 ? m.sessionInvalid : fallback);
  }
  return request('/' + encodeURIComponent(accountId) + '/' + action, fallback, (data): data is null => data === null,
    { method: 'PATCH', headers: { [csrf.headerName]: csrf.token } }, action === 'lock' ? m.lockSuccess : m.unlockSuccess);
}
export function lockHostAccount(accountId: string): Promise<HostAccountResponse<null>> { return changeHostAccount(accountId, 'lock'); }
export function unlockHostAccount(accountId: string): Promise<HostAccountResponse<null>> { return changeHostAccount(accountId, 'unlock'); }
