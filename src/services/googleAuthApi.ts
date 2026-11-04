import { AuthApiError, clearCsrfCache, getCsrfToken } from './authApi';
import { normalizePhoneNumber } from '../utils/phoneNumber';
import type { AuthenticatedUserResponse, GoogleOnboardingContext, GooglePasswordRequest, GoogleRegisterRequest } from '../types/auth';
import { establishSession } from './sessionClient';
const base = `${import.meta.env.VITE_API_URL || '/api/v1'}/auth/google`;
const failure = 'Không thể hoàn tất đăng nhập Google. Vui lòng thử lại';

async function call<T>(path: string, body?: object): Promise<T> {
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const csrf = body ? await getCsrfToken() : null;
      const response = await fetch(`${base}/${path}`, {
        method: body ? 'POST' : 'GET', credentials: 'include', cache: 'no-store',
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json', [csrf!.headerName]: csrf!.token } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 403 && typeof data?.message === 'string' && data.message.startsWith('CSRF token') && attempt === 0) {
        clearCsrfCache(); continue;
      }
      if (!response.ok) throw new AuthApiError(response.status, data?.message || failure, data?.fieldErrors || {});
      if (!data || data.status !== 200 || !('data' in data)) throw new AuthApiError(0, failure);
      return data.data as T;
    }
    throw new AuthApiError(403, failure);
  } catch (error) {
    if (error instanceof AuthApiError) throw error;
    throw new AuthApiError(0, failure);
  } finally { if (body) clearCsrfCache(); }
}
export async function getGoogleOnboarding(): Promise<GoogleOnboardingContext> {
  const result = await call<GoogleOnboardingContext>('onboarding');
  if (!result || typeof result.flowId !== 'string' || typeof result.email !== 'string'
    || !['REGISTER_HOST', 'SET_PASSWORD'].includes(result.purpose) || !Number.isFinite(Date.parse(result.expiresAt))) {
    throw new AuthApiError(0, failure);
  }
  return result;
}
export function registerWithGoogle(input: GoogleRegisterRequest): Promise<AuthenticatedUserResponse> {
  return establishSession(() => call('register', { flowId: input.flowId, fullName: input.fullName.trim(),
    phoneNumber: normalizePhoneNumber(input.phoneNumber), password: input.password, confirmPassword: input.confirmPassword }));
}
export function setGooglePassword(input: GooglePasswordRequest): Promise<AuthenticatedUserResponse> {
  return establishSession(() => call('set-password', { flowId: input.flowId, password: input.password, confirmPassword: input.confirmPassword }));
}
export function cancelGoogleOnboarding(flowId: string): Promise<null> { return call('cancel', { flowId }); }
