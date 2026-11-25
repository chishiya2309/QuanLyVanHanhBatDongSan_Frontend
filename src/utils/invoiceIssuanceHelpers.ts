import { AuthApiError } from '../services/authErrors';
import { paymentPolicyUrl } from './roomPaymentPolicyNavigation';

const vndFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

export function formatVndExact(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  return /^-?\d+$/.test(value) ? vndFormatter.format(BigInt(value)) : value + ' ₫';
}

export function isUncertainSubmissionError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return false;
  if (!(error instanceof AuthApiError)) return true;
  return error.status >= 500 || error.status === 0;
}

export type IssuanceErrorGuidance = {
  message: string;
  needsReloadReview?: boolean;
  fixRoute?: { label: string; href: string };
};

export function mapIssuanceErrorGuidance(
  error: unknown,
  context: { invoiceId: string; roomId?: string },
): IssuanceErrorGuidance {
  if (!(error instanceof AuthApiError)) {
    return {
      message: error instanceof Error ? error.message : 'Chưa xác định được kết quả phát hành do lỗi kết nối.',
    };
  }
  const returnTo = `/invoices/host/${encodeURIComponent(context.invoiceId)}`;
  switch (error.code) {
    case 'INVOICE_CONCURRENCY_CONFLICT':
    case 'INVOICE_STALE_SOURCE':
    case 'INVOICE_RECALCULATION_REQUIRED':
      return {
        message: error.message,
        needsReloadReview: true,
        fixRoute: { label: 'Quay lại rà soát nháp (UC48)', href: returnTo },
      };
    case 'INVOICE_CALCULATION_INCOMPLETE':
    case 'INVOICE_CALCULATION_INVALID':
    case 'INVOICE_NO_LINES':
    case 'INVOICE_INVALID_TOTAL':
    case 'INVOICE_INVALID_DUE_DATE':
      return {
        message: error.message,
        fixRoute: { label: 'Chỉnh sửa hóa đơn nháp (UC48)', href: returnTo },
      };
    case 'INVOICE_NO_PAYMENT_METHOD':
    case 'INVOICE_TRANSFER_UNAVAILABLE_CONFIRM_CASH':
      return {
        message: error.message,
        fixRoute: context.roomId
          ? { label: 'Cấu hình thanh toán phòng (UC42)', href: paymentPolicyUrl(context.roomId, returnTo) }
          : undefined,
      };
    default:
      return { message: error.message };
  }
}

const notificationLabels: Record<string, string> = {
  PENDING: 'Đang chờ gửi thông báo',
  PROCESSING: 'Đang xử lý gửi thông báo',
  SUCCEEDED: 'Đã gửi thông báo thành công',
  PARTIAL_FAILED: 'Gửi được một phần kênh, đang chờ thử lại',
  FAILED: 'Gửi thông báo thất bại (hóa đơn vẫn đã phát hành)',
  NO_CHANNEL: 'Khách thuê chưa có kênh nhận thông báo khả dụng',
  NOT_REQUESTED: 'Không gửi thông báo tự động',
};

export function formatNotificationStatusLabel(status?: string | null): string {
  if (!status) return 'Chưa có trạng thái thông báo';
  return notificationLabels[status] ?? status;
}

const channelLabels: Record<string, string> = {
  IN_APP: 'Cổng khách thuê (Trong ứng dụng)',
  EMAIL: 'Email',
  PUSH: 'Thông báo đẩy',
};

export function formatChannelList(channels: string[]): string {
  if (!channels.length) return 'Không có kênh nhận khả dụng';
  return channels.map(ch => channelLabels[ch] ?? ch).join(', ');
}

const rentalStatusLabels: Record<string, string> = {
  ACTIVE: 'Đang hiệu lực',
  TERMINATED: 'Đã kết thúc / thanh lý',
  EXPIRED: 'Đã hết hạn',
  DRAFT: 'Bản nháp',
};

export function formatRentalStatusLabel(status?: string | null): string {
  if (!status) return '—';
  return rentalStatusLabels[status] ?? status;
}
