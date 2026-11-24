// Cash category codes seeded by the backend migrations V25 and V27.
export const transactionCategories = {
  BUSINESS_REVENUE: 'Doanh thu kinh doanh', RENT: 'Tiền thuê', SERVICE: 'Phí dịch vụ',
  DEPOSIT_RECEIPT: 'Nhận cọc', DEPOSIT_REFUND: 'Hoàn cọc', OPERATING_EXPENSE: 'Chi vận hành',
  MAINTENANCE: 'Chi bảo trì', REPAIR: 'Chi sửa chữa', REFUND: 'Hoàn tiền',
  OTHER_IN: 'Thu khác', OTHER_OUT: 'Chi khác', '~': 'Chưa phân loại',
} as Record<string, string>;

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
export const money = (value: bigint) => vnd.format(value);
const calendar = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
const timestamp = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
export const dateLabel = (value: string) => calendar.format(new Date(value));
export const timestampLabel = (value: string) => timestamp.format(new Date(value));
export const periodLabel = (value: string, monthly: boolean) => monthly ? value.slice(5, 7) + '/' + value.slice(0, 4) : dateLabel(value);

