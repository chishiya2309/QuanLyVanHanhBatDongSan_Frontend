import { assetMessages as m, assetStates, type AssetFieldErrors, type AssetState } from '../types/assets';

export function normalizeMoney(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/^0+(?=\d)/, '');
  return digits.length <= 19 ? digits : null;
}
export function validateAssetFields(name: string, purchaseValue: string, note?: string): AssetFieldErrors {
  const errors: AssetFieldErrors = {};
  if (!name.trim()) errors.name = m.nameRequired;
  else if (name.trim().length > 255) errors.name = m.nameLong;
  if (normalizeMoney(purchaseValue) === null) errors.purchaseValue = m.valueInvalid;
  if (note !== undefined && note.trim().length > 2000) errors.note = m.noteLong;
  return errors;
}
export function isAssetState(value: unknown): value is AssetState {
  return typeof value === 'string' && Object.hasOwn(assetStates, value);
}
export function formatAssetMoney(value: string): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(BigInt(value));
}
export function formatAssetTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}
