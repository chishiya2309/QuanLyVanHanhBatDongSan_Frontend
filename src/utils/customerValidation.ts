import type { CustomerFieldErrors, CustomerFields, IdentityType, VehicleFieldErrors, VehicleFields, VehicleType } from '../types/customer';

export const isIdentityType = (value: unknown): value is IdentityType => value === 'CCCD' || value === 'PASSPORT';

export const isVehicleType = (value: unknown): value is VehicleType =>
  value === 'MOTORBIKE' || value === 'CAR' || value === 'BICYCLE' || value === 'OTHER';

export function normalizeIdentityNo(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1900 || year > 2100 || month < 1 || month > 12) return false;
  const maxDays = new Date(year, month, 0).getDate();
  return day >= 1 && day <= maxDays;
}

export function formatDateDisplay(isoDate: string | null | undefined): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return '—';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function validateCustomerForm(fields: CustomerFields): CustomerFieldErrors {
  const errors: CustomerFieldErrors = {};
  const name = fields.fullName.trim();
  const phone = fields.phone.trim();
  const email = fields.email.trim();
  const identityType = fields.identityType;
  const identityNo = fields.identityNo.trim();
  const birthDate = fields.birthDate.trim();

  if (!name) {
    errors.fullName = 'Vui lòng nhập họ tên';
  } else if (name.length > 255) {
    errors.fullName = 'Tối đa 255 ký tự';
  }

  if (phone && phone.length > 255) {
    errors.phone = 'Tối đa 255 ký tự';
  }

  if (email) {
    if (email.length > 255) {
      errors.email = 'Tối đa 255 ký tự';
    } else if (!EMAIL_REGEX.test(email)) {
      errors.email = 'Email không hợp lệ';
    }
  }

  if (identityType && !identityNo) {
    errors.identityNo = 'Vui lòng nhập số giấy tờ';
  } else if (!identityType && identityNo) {
    errors.identityType = 'Vui lòng chọn loại giấy tờ';
  } else if (identityNo && identityNo.length > 255) {
    errors.identityNo = 'Tối đa 255 ký tự';
  }

  if (birthDate) {
    if (!isValidIsoDate(birthDate)) {
      errors.birthDate = 'Ngày sinh không hợp lệ';
    }
  }

  return errors;
}

export function validateVehicleForm(fields: VehicleFields): VehicleFieldErrors {
  const errors: VehicleFieldErrors = {};
  const plateNumber = fields.plateNumber.trim();

  if (!fields.type || !isVehicleType(fields.type)) {
    errors.type = 'Vui lòng chọn loại phương tiện';
  }

  if (!plateNumber) {
    errors.plateNumber = 'Vui lòng nhập biển số';
  } else if (plateNumber.length > 255) {
    errors.plateNumber = 'Tối đa 255 ký tự';
  }

  return errors;
}
