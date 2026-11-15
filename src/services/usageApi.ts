import { isRecord, safeInteger } from './assetCodec';
import { AuthApiError } from './authErrors';
import { clearCsrfCache, getCsrfToken } from './csrfClient';
import { authenticatedFetch, sessionGuard } from './sessionClient';
import {
  decodeSavedAdjustment,
  decodeSavedUsage,
  decodeUsageContext,
  encodeCustomFeePayload,
  encodeDiscountAdjustmentPayload,
  encodeFeeAdjustmentPayload,
  encodeQuantityPayload,
  parseUsageJson
} from './usageCodec';
import {
  periodUsageMessages as m,
  type AddDiscountAdjustmentPayload,
  type AddFeeAdjustmentPayload,
  type RecordCustomFeePayload,
  type RecordQuantityPayload,
  type SavedAdjustmentResponse,
  type SavedUsageResponse,
  type UsageContext
} from '../types/periodUsage';

const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');

export class UsageApiError extends Error {
  status: number;
  code?: string;
  fieldErrors: Record<string, string>;
  phase: 'read' | 'csrf' | 'write' | 'uncertain';

  constructor(status: number, message: string, phase: UsageApiError['phase'] = 'read', fields: Record<string, string> = {}, code?: string) {
    super(message);
    this.name = 'UsageApiError';
    this.status = status;
    this.phase = phase;
    this.fieldErrors = fields;
    this.code = code;
  }
}

export const isUsageAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';
export const isUsageCsrf = (e: unknown) =>
  e instanceof UsageApiError && (e.phase === 'csrf' || (e.status === 403 && e.message.includes('CSRF')));

function errorResponse(status: number, body: unknown, write: boolean): UsageApiError {
  const valid = isRecord(body) && safeInteger(body.status) === status;
  const fields: Record<string, string> = {};
  if (valid && isRecord(body.fieldErrors)) {
    for (const [key, value] of Object.entries(body.fieldErrors)) {
      if (typeof value === 'string') fields[key] = value;
    }
  }

  let code: string | undefined = undefined;
  if (valid && typeof body.error === 'string') code = body.error;

  let message = valid && typeof body.message === 'string'
    ? body.message
    : write ? 'Không thể lưu dữ liệu. Vui lòng kiểm tra và thử lại.' : m.readFailure;

  if (status === 401) message = m.sessionInvalid;
  if (status === 404) message = m.notFound;
  if (status === 403 && !message.includes('CSRF')) message = m.forbidden;
  if (status === 403 && message.includes('CSRF')) clearCsrfCache();

  return new UsageApiError(status, message, write && status >= 500 ? 'uncertain' : write ? 'write' : 'read', fields, code);
}

async function request<T>(
  path: string,
  decode: (v: unknown) => T,
  init: RequestInit = {},
  expected = 200,
  shouldSend = () => true
): Promise<T> {
  const current = sessionGuard(shouldSend);
  const write = Boolean(init.method && init.method !== 'GET');
  let response: Response;

  try {
    response = await authenticatedFetch(base + path, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...init.headers
      }
    }, { shouldSend: current, trackNavigation: true });
  } catch (e) {
    if (isUsageAbort(e)) throw e;
    if (e instanceof AuthApiError) {
      throw new UsageApiError(e.status, e.status === 401 ? m.sessionInvalid : e.message, write ? 'write' : 'read');
    }
    throw new UsageApiError(0, write ? m.uncertain : m.readFailure, write ? 'uncertain' : 'read');
  }

  let value: unknown;
  try {
    value = parseUsageJson(await response.text());
  } catch {
    if (!current()) throw new DOMException('Stale response', 'AbortError');
    if (!response.ok) throw errorResponse(response.status, null, write);
    throw new UsageApiError(response.status, write ? m.uncertain : m.readFailure, write ? 'uncertain' : 'read');
  }

  if (!current()) throw new DOMException('Stale response', 'AbortError');
  if (!response.ok) throw errorResponse(response.status, value, write);

  try {
    if (response.status !== expected || !isRecord(value) || safeInteger(value.status) !== expected || typeof value.message !== 'string' || !Object.hasOwn(value, 'data')) {
      throw new Error('Invalid envelope');
    }
    return decode(value.data);
  } catch {
    throw new UsageApiError(response.status, write ? m.uncertain : m.readFailure, write ? 'uncertain' : 'read');
  }
}

async function mutate<T>(
  path: string,
  bodyText: string,
  decode: (v: unknown) => T,
  signal?: AbortSignal
): Promise<T> {
  let csrf: { token: string; headerName: string };
  try {
    csrf = await getCsrfToken();
  } catch {
    throw new UsageApiError(403, 'Không thể lấy CSRF token', 'csrf');
  }

  return request(path, decode, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      [csrf.headerName]: csrf.token
    },
    body: bodyText
  }, 201);
}

export function getUsageContext(periodId: string, signal?: AbortSignal): Promise<UsageContext> {
  return request(`/billing-periods/${encodeURIComponent(periodId)}/usage-context`, decodeUsageContext, { signal }, 200);
}

export function recordQuantity(payload: RecordQuantityPayload, signal?: AbortSignal): Promise<SavedUsageResponse> {
  return mutate('/service-usages/quantity', encodeQuantityPayload(payload), decodeSavedUsage, signal);
}

export function recordCustomFee(payload: RecordCustomFeePayload, signal?: AbortSignal): Promise<SavedUsageResponse> {
  return mutate('/service-usages/custom-fee', encodeCustomFeePayload(payload), decodeSavedUsage, signal);
}

export function addFeeAdjustment(payload: AddFeeAdjustmentPayload, signal?: AbortSignal): Promise<SavedAdjustmentResponse> {
  return mutate('/period-adjustments/fee', encodeFeeAdjustmentPayload(payload), decodeSavedAdjustment, signal);
}

export function addDiscountAdjustment(payload: AddDiscountAdjustmentPayload, signal?: AbortSignal): Promise<SavedAdjustmentResponse> {
  return mutate('/period-adjustments/discount', encodeDiscountAdjustmentPayload(payload), decodeSavedAdjustment, signal);
}
