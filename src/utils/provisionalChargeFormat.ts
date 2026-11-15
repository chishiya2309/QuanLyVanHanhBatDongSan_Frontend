export function formatProvisionalVnd(value: string | null): string {
  return value === null ? 'Chưa tính được' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(BigInt(value));
}
export function formatProvisionalDate(value: string): string {
  const [year, month, day] = value.split('-');
  return day + '/' + month + '/' + year;
}
export const formatPeriodRange = (from: string, to: string) => formatProvisionalDate(from) + ' – trước ' + formatProvisionalDate(to);
export const formatProvisionalDecimal = (value: string | null) => value === null ? 'Chưa có' : value.replace('.', ',');
export const methodLabels = { METERED: 'Theo đồng hồ', FIXED: 'Cố định', QUANTITY: 'Theo số lượng', CUSTOM: 'Phí thực tế' };
export const pricingLabels = { ROOM: 'Giá phòng', BUILDING: 'Giá tòa nhà', CATALOG: 'Giá danh mục' };
