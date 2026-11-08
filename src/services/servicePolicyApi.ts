import { servicePolicyMessages as m, type BuildingLookupItem, type PolicyFieldErrors, type ServicePolicy, type UpdateServicePolicyInput } from '../types/servicePolicy';
import { isAssetId } from '../utils/assetNavigation';
import { isRecord, safeInteger } from './assetCodec';
import { AuthApiError } from './authErrors';
import { clearCsrfCache, getCsrfToken } from './csrfClient';
import { authenticatedFetch, sessionGuard } from './sessionClient';
import { decodeBuildingLookupList, decodeServicePolicy, encodeUpdateServicePolicyBody, parsePolicyJson } from './servicePolicyCodec';

const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');

const knownConflicts = new Set<string>([
  m.stale,
  m.methodLocked,
  m.prorateNotFixed,
  m.inactive,
  m.priceRequired,
  m.timeConflict,
]);

export class ServicePolicyApiError extends Error {
  status: number;
  fieldErrors: PolicyFieldErrors;
  phase: 'read' | 'csrf' | 'write' | 'uncertain';

  constructor(
    status: number,
    message: string,
    fieldErrors: PolicyFieldErrors = {},
    phase: 'read' | 'csrf' | 'write' | 'uncertain' = 'read',
  ) {
    super(message);
    this.name = 'ServicePolicyApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.phase = phase;
  }
}

export const isPolicyAbort = (error: unknown): boolean => error instanceof Error && error.name === 'AbortError';

function errorResponse(status: number, value: unknown, fallback: string, write: boolean): ServicePolicyApiError {
  const valid = isRecord(value) && safeInteger(value.status) === status;
  let message = fallback;

  if (status === 401) {
    message = m.sessionInvalid;
  } else if (status === 403) {
    message = valid && value.message === m.csrfInvalid ? m.csrfInvalid : m.forbidden;
  } else if (status === 404) {
    message = valid && value.message === m.buildingNotFound ? m.buildingNotFound : m.notFound;
  } else if (status === 400) {
    message = m.invalid;
  } else if (status === 409) {
    message = valid && typeof value.message === 'string' && knownConflicts.has(value.message) ? value.message : m.stale;
  } else if (valid && typeof value.message === 'string' && value.message.trim()) {
    message = value.message;
  }

  const fields: PolicyFieldErrors = {};
  if (valid && isRecord(value.fieldErrors)) {
    for (const [k, v] of Object.entries(value.fieldErrors)) {
      if (typeof v === 'string') {
        fields[k] = v;
      }
    }
  }

  if (message === m.csrfInvalid) {
    clearCsrfCache();
  }

  return new ServicePolicyApiError(status, message, fields, write ? 'write' : 'read');
}

async function request<T>(
  path: string,
  expected: number,
  decode: (value: unknown) => T,
  fallback: string,
  init: RequestInit = {},
  shouldSend = () => true,
): Promise<T> {
  const write = ['POST', 'PUT', 'PATCH'].includes(init.method || '');
  let response: Response;

  try {
    response = await authenticatedFetch(
      base + path,
      {
        ...init,
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json', ...init.headers },
      },
      { shouldSend, trackNavigation: write },
    );
  } catch (error) {
    if (isPolicyAbort(error)) throw error;
    if (error instanceof AuthApiError) {
      throw new ServicePolicyApiError(
        error.status,
        error.status === 401 ? m.sessionInvalid : error.message,
        {},
        write ? 'write' : 'read',
      );
    }
    throw new ServicePolicyApiError(0, write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read');
  }

  let body: unknown;
  try {
    body = parsePolicyJson(await response.text());
  } catch {
    if (!response.ok) throw errorResponse(response.status, null, fallback, write);
    throw new ServicePolicyApiError(response.status, write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read');
  }

  if (!response.ok) throw errorResponse(response.status, body, fallback, write);

  try {
    if (response.status !== expected || !isRecord(body) || safeInteger(body.status) !== expected || !Object.hasOwn(body, 'data')) {
      throw new Error('Invalid envelope');
    }
    return decode(body.data);
  } catch {
    throw new ServicePolicyApiError(response.status, write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read');
  }
}

function policyPath(serviceId: string): string {
  if (!isAssetId(serviceId)) throw new ServicePolicyApiError(404, m.notFound);
  return '/services/' + encodeURIComponent(serviceId) + '/policy';
}

export function getServicePolicy(serviceId: string, signal?: AbortSignal): Promise<ServicePolicy> {
  return request(
    policyPath(serviceId),
    200,
    decodeServicePolicy,
    m.getFailure,
    { signal },
  );
}

export async function updateServicePolicy(
  serviceId: string,
  input: UpdateServicePolicyInput,
  shouldSend = () => true,
): Promise<ServicePolicy> {
  const path = policyPath(serviceId);
  let body: string;
  try {
    body = encodeUpdateServicePolicyBody(input);
  } catch {
    throw new ServicePolicyApiError(400, m.invalid);
  }

  const guard = sessionGuard(shouldSend);
  let csrf: { headerName: string; token: string };

  try {
    csrf = await getCsrfToken();
    if (
      !csrf ||
      !/^[!#$%&'*+.^_`|~\da-z-]+$/i.test(csrf.headerName) ||
      !csrf.token?.trim() ||
      /[\r\n]/.test(csrf.token) ||
      ['accept', 'content-type', 'cookie', 'authorization', 'host'].includes(csrf.headerName.toLowerCase())
    ) {
      throw new Error('Invalid CSRF');
    }
  } catch (error) {
    if (!guard()) throw new DOMException('Stale request', 'AbortError');
    clearCsrfCache();
    throw new ServicePolicyApiError(
      error instanceof AuthApiError ? (error.status === 401 ? 503 : error.status) : 0,
      error instanceof AuthApiError && error.status === 403 ? m.csrfInvalid : m.csrfFailure,
      {},
      'csrf',
    );
  }

  if (!guard()) throw new DOMException('Stale request', 'AbortError');

  return request(
    path,
    200,
    decodeServicePolicy,
    m.saveFailure,
    {
      method: 'PATCH',
      body,
      headers: {
        'Content-Type': 'application/json',
        [csrf.headerName]: csrf.token,
      },
    },
    guard,
  );
}

export function lookupHostBuildings(signal?: AbortSignal): Promise<BuildingLookupItem[]> {
  return request(
    '/buildings',
    200,
    decodeBuildingLookupList,
    m.buildingsFailure,
    { signal },
  );
}
