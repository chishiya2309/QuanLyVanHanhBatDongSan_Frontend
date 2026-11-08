import { AuthApiError } from './authErrors';
import { clearCsrfCache, getCsrfToken } from './csrfClient';
import { authenticatedFetch } from './sessionClient';
import {
  decodeCustomerPageResponse,
  decodeCustomerResponse,
  decodeCustomerVehiclesResponse,
  decodeVehicleResponse,
  encodeCreateCustomerBody,
  encodeCreateVehicleBody,
  encodeUpdateCustomerBody,
  encodeUpdateVehicleBody,
  isRecord,
  parseCustomerJson,
  safeInteger,
} from './customerCodec';
import {
  customerMessages as m,
  type CreateCustomerInput,
  type CreateVehicleInput,
  type CustomerFieldErrors,
  type CustomerPageResponse,
  type CustomerResponse,
  type CustomerVehiclesResponse,
  type UpdateCustomerInput,
  type UpdateVehicleInput,
  type VehicleFieldErrors,
  type VehicleResponse,
} from '../types/customer';

const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
const allowedMessages = new Set<string>(Object.values(m));

export class CustomerApiError extends Error {
  status: number;
  fieldErrors: CustomerFieldErrors | VehicleFieldErrors;
  phase: 'read' | 'csrf' | 'write' | 'uncertain';

  constructor(
    status: number,
    message: string,
    fieldErrors: CustomerFieldErrors | VehicleFieldErrors = {},
    phase: 'read' | 'csrf' | 'write' | 'uncertain' = 'read'
  ) {
    super(message);
    this.name = 'CustomerApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.phase = phase;
  }
}

export const isCustomerAbort = (error: unknown): boolean => error instanceof Error && error.name === 'AbortError';

function parseApiError(
  status: number,
  value: unknown,
  fallback: string,
  write: boolean,
  isVehicle = false
): CustomerApiError {
  const fields: Record<string, string> = {};
  const valid = isRecord(value) && safeInteger(value.status) === status && typeof value.message === 'string';

  let message: string;
  if (status === 401) {
    message = m.sessionInvalid;
  } else if (status === 403) {
    message = valid && value.message === m.csrfInvalid ? m.csrfInvalid : m.forbidden;
  } else if (status === 404) {
    message = valid && value.message === m.vehicleNotFound ? m.vehicleNotFound : isVehicle ? m.vehicleNotFound : m.notFound;
  } else if ((status === 400 || status === 409) && valid && allowedMessages.has(String(value.message))) {
    message = String(value.message);
  } else if (status === 400) {
    message = m.invalidData;
  } else if (status === 409) {
    message = isVehicle ? m.vehicleStale : m.stale;
  } else {
    message = fallback;
  }

  if (valid && isRecord(value.fieldErrors)) {
    for (const [key, text] of Object.entries(value.fieldErrors)) {
      if (typeof text === 'string') {
        fields[key] = text;
      }
    }
  }

  if (status === 403 && message === m.csrfInvalid) {
    clearCsrfCache();
  }

  return new CustomerApiError(status, message, fields, write ? 'write' : 'read');
}

async function request<T>(
  path: string,
  expectedStatus: number,
  expectedMessage: string | readonly string[],
  decode: (value: unknown) => T,
  fallback: string,
  init: RequestInit = {},
  isVehicle = false,
  shouldSend = () => true
): Promise<T> {
  const write = init.method === 'POST' || init.method === 'PUT';
  let response: Response;

  try {
    response = await authenticatedFetch(
      base + path,
      {
        ...init,
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          ...init.headers,
        },
      },
      { shouldSend, trackNavigation: write }
    );
  } catch (error) {
    if (isCustomerAbort(error)) throw error;
    if (error instanceof AuthApiError) {
      throw new CustomerApiError(
        error.status,
        error.status === 401 ? m.sessionInvalid : error.message,
        {},
        write ? 'write' : 'read'
      );
    }
    throw new CustomerApiError(0, write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read');
  }

  let body: unknown;
  try {
    body = parseCustomerJson(await response.text());
  } catch {
    if (!response.ok) throw parseApiError(response.status, null, fallback, write, isVehicle);
    throw new CustomerApiError(response.status, write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read');
  }

  if (!response.ok) {
    throw parseApiError(response.status, body, fallback, write, isVehicle);
  }

  try {
    if (
      response.status !== expectedStatus ||
      !isRecord(body) ||
      safeInteger(body.status) !== expectedStatus ||
      !(typeof expectedMessage === 'string'
        ? body.message === expectedMessage
        : expectedMessage.includes(body.message as string)) ||
      !Object.hasOwn(body, 'data')
    ) {
      throw new Error('Invalid envelope');
    }
    return decode(body.data);
  } catch {
    throw new CustomerApiError(response.status, write ? m.uncertain : fallback, {}, write ? 'uncertain' : 'read');
  }
}

export async function listCustomers(
  query: { page?: number; size?: number; q?: string },
  signal?: AbortSignal
): Promise<CustomerPageResponse> {
  const params = new URLSearchParams();
  if (query.page !== undefined && query.page > 0) params.set('page', String(query.page));
  if (query.size !== undefined && query.size !== 20) params.set('size', String(query.size));
  if (query.q && query.q.trim()) params.set('q', query.q.trim());
  const qs = params.toString();

  return request(
    `/customers${qs ? '?' + qs : ''}`,
    200,
    m.listSuccess,
    decodeCustomerPageResponse,
    m.listFailure,
    { method: 'GET', signal }
  );
}

export async function getCustomer(customerId: string, signal?: AbortSignal): Promise<CustomerResponse> {
  return request(
    `/customers/${encodeURIComponent(customerId)}`,
    200,
    m.detailSuccess,
    decodeCustomerResponse,
    m.detailFailure,
    { method: 'GET', signal }
  );
}

export async function createCustomer(
  input: CreateCustomerInput,
  signal?: AbortSignal,
  shouldSend = () => true
): Promise<CustomerResponse> {
  let csrf: { token: string; headerName: string };
  try {
    csrf = await getCsrfToken();
  } catch {
    throw new CustomerApiError(403, m.csrfInvalid, {}, 'csrf');
  }

  return request(
    '/customers',
    201,
    m.createSuccess,
    decodeCustomerResponse,
    m.createFailure,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [csrf.headerName]: csrf.token,
      },
      body: encodeCreateCustomerBody(input),
      signal,
    },
    false,
    shouldSend
  );
}

export async function updateCustomer(
  customerId: string,
  input: UpdateCustomerInput,
  signal?: AbortSignal,
  shouldSend = () => true
): Promise<CustomerResponse> {
  let csrf: { token: string; headerName: string };
  try {
    csrf = await getCsrfToken();
  } catch {
    throw new CustomerApiError(403, m.csrfInvalid, {}, 'csrf');
  }

  return request(
    `/customers/${encodeURIComponent(customerId)}`,
    200,
    m.updateSuccess,
    decodeCustomerResponse,
    m.updateFailure,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        [csrf.headerName]: csrf.token,
      },
      body: encodeUpdateCustomerBody(input),
      signal,
    },
    false,
    shouldSend
  );
}

export async function listCustomerVehicles(
  customerId: string,
  signal?: AbortSignal
): Promise<CustomerVehiclesResponse> {
  return request(
    `/customers/${encodeURIComponent(customerId)}/vehicles`,
    200,
    m.vehiclesSuccess,
    decodeCustomerVehiclesResponse,
    m.vehiclesFailure,
    { method: 'GET', signal },
    true
  );
}

export async function getCustomerVehicle(
  customerId: string,
  vehicleId: string,
  signal?: AbortSignal
): Promise<VehicleResponse> {
  return request(
    `/customers/${encodeURIComponent(customerId)}/vehicles/${encodeURIComponent(vehicleId)}`,
    200,
    m.vehicleSuccess,
    decodeVehicleResponse,
    m.vehicleFailure,
    { method: 'GET', signal },
    true
  );
}

export async function createCustomerVehicle(
  customerId: string,
  input: CreateVehicleInput,
  signal?: AbortSignal,
  shouldSend = () => true
): Promise<VehicleResponse> {
  let csrf: { token: string; headerName: string };
  try {
    csrf = await getCsrfToken();
  } catch {
    throw new CustomerApiError(403, m.csrfInvalid, {}, 'csrf');
  }

  return request(
    `/customers/${encodeURIComponent(customerId)}/vehicles`,
    201,
    m.vehicleCreateSuccess,
    decodeVehicleResponse,
    m.vehicleCreateFailure,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [csrf.headerName]: csrf.token,
      },
      body: encodeCreateVehicleBody(input),
      signal,
    },
    true,
    shouldSend
  );
}

export async function updateCustomerVehicle(
  customerId: string,
  vehicleId: string,
  input: UpdateVehicleInput,
  signal?: AbortSignal,
  shouldSend = () => true
): Promise<VehicleResponse> {
  let csrf: { token: string; headerName: string };
  try {
    csrf = await getCsrfToken();
  } catch {
    throw new CustomerApiError(403, m.csrfInvalid, {}, 'csrf');
  }

  return request(
    `/customers/${encodeURIComponent(customerId)}/vehicles/${encodeURIComponent(vehicleId)}`,
    200,
    m.vehicleUpdateSuccess,
    decodeVehicleResponse,
    m.vehicleUpdateFailure,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        [csrf.headerName]: csrf.token,
      },
      body: encodeUpdateVehicleBody(input),
      signal,
    },
    true,
    shouldSend
  );
}
