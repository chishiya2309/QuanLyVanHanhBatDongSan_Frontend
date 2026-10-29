import { AuthApiError, getCsrfToken } from './authApi';
import { profileMessages, type AdminProfileUpdateRequest, type HostProfileUpdateRequest, type PersonalProfileResponse } from '../types/profile';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export class ProfileApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ProfileApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProfile(value: unknown): value is PersonalProfileResponse {
  if (!isRecord(value) || typeof value.email !== 'string') return false;
  const optionalString = (field: string) => value[field] === undefined || value[field] === null || typeof value[field] === 'string';
  if (!optionalString('phoneNumber')) return false;
  if (value.role === 'HOST') return typeof value.businessName === 'string' && typeof value.phoneNumber === 'string' && optionalString('officeAddress') && optionalString('logoUrl');
  if (typeof value.fullName !== 'string') return false;
  return value.role === 'ADMIN' || (value.role === 'CUSTOMER' && ['identityType', 'identityNo', 'birthDate', 'address'].every(optionalString));
}

async function requestProfile(init: RequestInit, expectedRole?: 'ADMIN' | 'HOST'): Promise<PersonalProfileResponse> {
  const fallback = init.method === 'PATCH' ? profileMessages.saveFailure : profileMessages.loadFailure;
  try {
    const response = await fetch(`${API_BASE_URL}/profile`, {
      ...init,
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-store', ...init.headers },
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const defaults: Record<number, string> = {
        401: profileMessages.sessionInvalid, 403: profileMessages.forbidden,
        404: profileMessages.notFound, 409: profileMessages.phoneDuplicate,
      };
      const fields: Record<string, string> = {};
      if (isRecord(body) && isRecord(body.fieldErrors)) {
        for (const [key, value] of Object.entries(body.fieldErrors)) if (typeof value === 'string') fields[key] = value;
      }
      const message = isRecord(body) && typeof body.message === 'string' && body.message ? body.message : defaults[response.status] || fallback;
      throw new ProfileApiError(response.status, message, fields);
    }
    if (!isRecord(body) || body.status !== 200 || !isProfile(body.data) || (expectedRole && body.data.role !== expectedRole)) {
      throw new ProfileApiError(response.status, fallback);
    }
    return body.data;
  } catch (error) {
    if (error instanceof ProfileApiError || (error instanceof Error && error.name === 'AbortError')) throw error;
    throw new ProfileApiError(0, fallback);
  }
}

async function csrfHeaders(): Promise<Record<string, string>> {
  try {
    const csrf = await getCsrfToken();
    if (!csrf || typeof csrf.token !== 'string' || !csrf.token || typeof csrf.headerName !== 'string' || !csrf.headerName) {
      throw new ProfileApiError(0, profileMessages.saveFailure);
    }
    return { [csrf.headerName]: csrf.token };
  } catch (error) {
    if (error instanceof ProfileApiError) throw error;
    throw new ProfileApiError(error instanceof AuthApiError ? error.status : 0,
      error instanceof AuthApiError && error.status === 401 ? profileMessages.sessionInvalid : profileMessages.saveFailure);
  }
}

export function getPersonalProfile(signal?: AbortSignal): Promise<PersonalProfileResponse> {
  return requestProfile({ method: 'GET', signal });
}

export async function updateAdminProfile(payload: AdminProfileUpdateRequest): Promise<PersonalProfileResponse> {
  const headers = await csrfHeaders();
  return requestProfile({ method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({
    fullName: payload.fullName.trim(), phoneNumber: payload.phoneNumber || null,
  }) }, 'ADMIN');
}

export async function updateHostProfile(payload: HostProfileUpdateRequest, logoFile?: File | null): Promise<PersonalProfileResponse> {
  const headers = await csrfHeaders();
  const profile: HostProfileUpdateRequest = {
    businessName: payload.businessName.trim(), phoneNumber: payload.phoneNumber,
    officeAddress: payload.officeAddress?.trim() || null, removeLogo: payload.removeLogo,
  };
  if (logoFile) {
    const body = new FormData();
    body.append('profile', new Blob([JSON.stringify(profile)], { type: 'application/json' }));
    body.append('logo', logoFile);
    return requestProfile({ method: 'PATCH', headers, body }, 'HOST');
  }
  return requestProfile({ method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(profile) }, 'HOST');
}
