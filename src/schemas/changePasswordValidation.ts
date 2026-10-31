import { changePasswordMessages as m, type ChangePasswordFieldErrors, type ChangePasswordFormData } from '../types/changePassword';

export function validateChangePassword(data: ChangePasswordFormData): ChangePasswordFieldErrors {
  const errors: ChangePasswordFieldErrors = {};
  if (!data.currentPassword.trim()) errors.currentPassword = m.currentRequired;
  if (!data.newPassword.trim()) errors.newPassword = m.newRequired;
  else if (data.newPassword.length < 8) errors.newPassword = m.minLength;
  else if (new TextEncoder().encode(data.newPassword).length > 72) errors.newPassword = m.maxBytes;
  if (!data.confirmPassword.trim()) errors.confirmPassword = m.confirmRequired;
  else if (data.newPassword.trim() && data.confirmPassword !== data.newPassword) errors.confirmPassword = m.mismatch;
  return errors;
}
