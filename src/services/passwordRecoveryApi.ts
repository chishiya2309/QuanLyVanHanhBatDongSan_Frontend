import { AuthApiError, clearCsrfCache, getCsrfToken } from './authApi';
import { recoveryMessages as m, type ForgotPasswordRequest, type RecoveryField, type RecoveryResponse, type ResetPasswordRequest } from '../types/passwordRecovery';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
const allowedErrors: Record<RecoveryField, readonly string[]> = {
  email: [m.emailRequired, m.emailInvalid],
  newPassword: [m.newRequired, m.minLength, m.maxBytes],
  confirmPassword: [m.confirmRequired, m.mismatch],
};
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function postRecovery(route: string, payload: object, expectedMessage: string, fields: RecoveryField[], invalidMessage?: string): Promise<RecoveryResponse> {
  try {
    const csrf = await getCsrfToken();
    if (!csrf || typeof csrf.token !== 'string' || !csrf.token || typeof csrf.headerName !== 'string' || !csrf.headerName) throw new AuthApiError(0, m.failure);
    const response = await fetch(`${API_BASE_URL}/auth/${route}`, {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', [csrf.headerName]: csrf.token },
      body: JSON.stringify(payload),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const fieldErrors: Record<string, string> = {};
      if (response.status === 400 && isRecord(body) && isRecord(body.fieldErrors)) {
        for (const field of fields) {
          const value = body.fieldErrors[field];
          if (typeof value === 'string' && allowedErrors[field].includes(value)) fieldErrors[field] = value;
        }
      }
      const message = isRecord(body) && typeof body.message === 'string' ? body.message : '';
      const safeMessage = response.status === 403 && message === m.csrfInvalid ? m.csrfInvalid
        : response.status === 400 && invalidMessage && message === invalidMessage ? invalidMessage
        : response.status === 400 && Object.keys(fieldErrors).length ? Object.values(fieldErrors)[0]
        : response.status === 400 && message === m.invalidData ? m.invalidData : m.failure;
      throw new AuthApiError(response.status, safeMessage, fieldErrors);
    }
    if (response.status !== 200 || !isRecord(body) || body.status !== 200 || body.data !== null || body.message !== expectedMessage) throw new AuthApiError(response.status, m.failure);
    return { status: 200, message: expectedMessage, data: null };
  } catch (error) {
    if (error instanceof AuthApiError) {
      if (error.message === m.csrfInvalid) clearCsrfCache();
      if (error.message === m.csrfInvalid || error.status === 400) throw error;
      throw new AuthApiError(error.status, m.failure);
    }
    throw new AuthApiError(0, m.failure);
  }
}

export function requestPasswordReset(request: ForgotPasswordRequest): Promise<RecoveryResponse> {
  return postRecovery('forgot-password', { email: request.email.trim().toLowerCase() }, m.accepted, ['email']);
}
export function validatePasswordResetToken(token: string): Promise<RecoveryResponse> {
  return postRecovery('reset-password/validate', { token }, m.linkValid, [], m.linkInvalid);
}
export async function resetPassword(request: ResetPasswordRequest): Promise<RecoveryResponse> {
  const response = await postRecovery('reset-password', {
    token: request.token, newPassword: request.newPassword, confirmPassword: request.confirmPassword,
  }, m.success, ['newPassword', 'confirmPassword'], m.requestInvalid);
  clearCsrfCache();
  return response;
}
