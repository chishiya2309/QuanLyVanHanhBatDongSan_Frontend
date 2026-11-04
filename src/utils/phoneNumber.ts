const VIETNAMESE_MOBILE_PATTERN = /^0[35789][0-9]{8}$/;
const INTERNATIONAL_PATTERN = /^\+[1-9][0-9]{1,14}$/;

export const PHONE_NUMBER_HELP = 'Nhập số di động Việt Nam, ví dụ 0347983243, hoặc số quốc tế +84347983243';

export function normalizePhoneNumber(value: string): string {
  const trimmed = value.trim();
  return VIETNAMESE_MOBILE_PATTERN.test(trimmed) ? `+84${trimmed.slice(1)}` : trimmed;
}

export function isValidPhoneNumber(value: string): boolean {
  return INTERNATIONAL_PATTERN.test(normalizePhoneNumber(value));
}
