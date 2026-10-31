import { recoveryMessages as m, type RecoveryFieldErrors, type ResetPasswordFormData } from '../types/passwordRecovery';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function validateRecoveryEmail(email: string): RecoveryFieldErrors {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { email: m.emailRequired };
  return normalized.length > 254 || !EMAIL_REGEX.test(normalized) ? { email: m.emailInvalid } : {};
}

export function validateResetPassword(data: ResetPasswordFormData): RecoveryFieldErrors {
  const errors: RecoveryFieldErrors = {};
  if (!data.newPassword.trim()) errors.newPassword = m.newRequired;
  else if (data.newPassword.length < 8) errors.newPassword = m.minLength;
  else if (new TextEncoder().encode(data.newPassword).length > 72) errors.newPassword = m.maxBytes;
  if (!data.confirmPassword.trim()) errors.confirmPassword = m.confirmRequired;
  else if (data.newPassword.trim() && data.confirmPassword !== data.newPassword) errors.confirmPassword = m.mismatch;
  return errors;
}
