export const draftError = (error: unknown) => error instanceof Error ? error.message : 'Không thể xử lý yêu cầu.';
const calendar = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Ho_Chi_Minh'});
export const today = () => calendar.format(new Date());
export function draftDate(value?: string | null) {
  if (!value) return '—';
  const normalized = value.includes('T') && Number.isFinite(Date.parse(value)) ? calendar.format(new Date(value)) : value;
  return normalized.slice(0, 10).split('-').reverse().join('/');
}
