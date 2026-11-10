import { customerAccountMessages as m, type CustomerAccountFieldErrors, type ProvisionCustomerAccountFields } from '../types/customerAccount';

export function validateCustomerAccount(fields: ProvisionCustomerAccountFields): CustomerAccountFieldErrors {
  const errors: CustomerAccountFieldErrors = {};
  const email = fields.email.trim();
  if (!email) errors.email = m.emailRequired;
  else if (email.length > 255 || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) errors.email = m.emailInvalid;
  if (!fields.password) errors.password = m.passwordRequired;
  else if (Array.from(fields.password).length < 8) errors.password = m.passwordShort;
  else if (new TextEncoder().encode(fields.password).length > 72) errors.password = m.passwordLong;
  if (!fields.confirmPassword) errors.confirmPassword = m.confirmationRequired;
  else if (fields.confirmPassword !== fields.password) errors.confirmPassword = m.confirmationMismatch;
  return errors;
}
