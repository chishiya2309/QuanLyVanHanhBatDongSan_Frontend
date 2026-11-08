import { chargeMethods, type CatalogFields, type CatalogFieldErrors, type CatalogService, type CatalogFilter } from '../types/serviceCatalog';

export function decimalInteger(value: string, maximum: string): string | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const digits = value.trim().replace(/^0+(?=\d)/, '');
  return digits.length < maximum.length || digits.length === maximum.length && digits <= maximum ? digits : null;
}
export const catalogMoney = (value: string) => decimalInteger(value, '9999999999999999999');
export const catalogVersion = (value: string) => decimalInteger(value, '9223372036854775807');
export const formatCatalogMoney = (value: string) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(BigInt(value));
export const catalogState = (item: CatalogService): Exclude<CatalogFilter, 'all'> => item.pricingStatus === 'UNCONFIGURED' ? 'unconfigured' : item.active ? 'active' : 'inactive';
export function catalogFields(item?: CatalogService): CatalogFields {
  return { name: item?.name ?? '', unit: item?.unit ?? '', method: item?.method ?? '', defaultPrice: item?.defaultPrice ?? '' };
}
export function validateCatalogFields(fields: CatalogFields): CatalogFieldErrors {
  const errors: CatalogFieldErrors = {};
  if (!fields.name.trim()) errors.name = 'Vui lòng nhập tên dịch vụ';
  else if (fields.name.trim().length > 255) errors.name = 'Tên dịch vụ tối đa 255 ký tự';
  if (!fields.unit.trim()) errors.unit = 'Vui lòng nhập đơn vị';
  else if (fields.unit.trim().length > 50) errors.unit = 'Đơn vị tối đa 50 ký tự';
  if (!Object.hasOwn(chargeMethods, fields.method)) errors.method = 'Vui lòng chọn phương pháp tính';
  if (catalogMoney(fields.defaultPrice) === null) errors.defaultPrice = 'Nhập số nguyên VND từ 0 đến 9999999999999999999';
  return errors;
}
export const catalogSearchText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi-VN');
