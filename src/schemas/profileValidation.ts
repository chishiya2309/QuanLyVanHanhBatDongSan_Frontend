import { profileMessages, type AdminProfileUpdateRequest, type HostProfileUpdateRequest, type ProfileFormErrors } from '../types/profile';
import { isValidPhoneNumber } from '../utils/phoneNumber';

export const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export function validateLogo(file?: File | null, removeLogo = false): string | undefined {
  if (file && (removeLogo || file.size === 0 || file.size > MAX_LOGO_BYTES || !['image/jpeg', 'image/png'].includes(file.type))) {
    return profileMessages.imageFailure;
  }
}

export function validateAdminProfile(payload: AdminProfileUpdateRequest): ProfileFormErrors {
  const errors: ProfileFormErrors = {};
  if (!payload.fullName.trim()) errors.fullName = profileMessages.nameRequired;
  else if (payload.fullName.trim().length > 255) errors.fullName = profileMessages.fieldProtected;
  if (payload.phoneNumber?.trim() && !isValidPhoneNumber(payload.phoneNumber)) errors.phoneNumber = profileMessages.phoneInvalid;
  return errors;
}

export function validateHostProfile(payload: HostProfileUpdateRequest, file?: File | null): ProfileFormErrors {
  const errors: ProfileFormErrors = {};
  if (!payload.businessName.trim()) errors.businessName = profileMessages.hostNameRequired;
  else if (payload.businessName.trim().length > 255) errors.businessName = profileMessages.fieldProtected;
  if (!payload.phoneNumber.trim()) errors.phoneNumber = profileMessages.phoneRequired;
  else if (!isValidPhoneNumber(payload.phoneNumber)) errors.phoneNumber = profileMessages.phoneInvalid;
  const logoError = validateLogo(file, payload.removeLogo);
  if (logoError) errors.logo = logoError;
  return errors;
}
