// Decimal arithmetic is kept out of IEEE-754, including scientific notation.
export function meterDecimal(input: string): string | null {
  const match = /^\+?(\d+(?:\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.exec(input.trim());
  if (!match) return null;
  const [whole, fraction] = match[1].split('.');
  return (whole.replace(/^0+(?=\d)/, '') || '0') + (fraction ? '.' + fraction : '') + (match[2] || '');
}
function parts(input: string) {
  const value = meterDecimal(input);
  if (value === null) throw new Error('Invalid nonnegative decimal');
  const [mantissa, exponent = '0'] = value.toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const digits = (whole + fraction).replace(/^0+/, '') || '0';
  return { digits, order: BigInt(digits.length) + BigInt(exponent) - BigInt(fraction.length) };
}
export function compareMeterDecimal(a: string, b: string): number {
  const x = parts(a), y = parts(b);
  if (x.digits === '0' || y.digits === '0') return x.digits === y.digits ? 0 : x.digits === '0' ? -1 : 1;
  if (x.order !== y.order) return x.order < y.order ? -1 : 1;
  const length = Math.max(x.digits.length, y.digits.length);
  const left = x.digits.padEnd(length, '0'), right = y.digits.padEnd(length, '0');
  return left === right ? 0 : left < right ? -1 : 1;
}
export function meterDraftErrors(item: { initialStartAllowed: boolean; startIndex: string | null }, draft: { start: string; end: string; confirmed: boolean }) {
  const fields: Record<string, string> = {};
  const end = meterDecimal(draft.end);
  const start = item.initialStartAllowed ? meterDecimal(draft.start) : item.startIndex;
  if (end === null) fields.endIndex = 'Nhập chỉ số cuối là số không âm, dùng dấu chấm cho phần thập phân.';
  if (item.initialStartAllowed && start === null) fields.startIndex = 'Nhập chỉ số đầu ban đầu là số không âm.';
  if (item.initialStartAllowed && !draft.confirmed) fields.confirmed = 'Xác nhận chỉ số đầu cho đúng phòng, dịch vụ và kỳ.';
  if (!item.initialStartAllowed && start === null) fields.startIndex = 'Chưa có nguồn chỉ số đầu hợp lệ.';
  if (end !== null && start !== null && compareMeterDecimal(end, start) < 0) fields.endIndex = 'Chỉ số cuối phải lớn hơn hoặc bằng chỉ số đầu.';
  return fields;
}
