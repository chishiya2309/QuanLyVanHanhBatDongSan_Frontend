import { invoicePath, invoiceRequest, type InvoiceRole } from './invoiceApi';
import type {
  InvoiceDetailResponse,
  InvoiceLocationItem,
  InvoicePageResponse,
} from '../types/invoiceQuery';

export async function fetchInvoiceList(
  role: InvoiceRole,
  search: string,
  signal?: AbortSignal,
): Promise<InvoicePageResponse> {
  return invoiceRequest<InvoicePageResponse>(invoicePath(role) + search, signal);
}

export async function fetchInvoiceLocations(
  role: InvoiceRole,
  signal?: AbortSignal,
): Promise<InvoiceLocationItem[]> {
  return invoiceRequest<InvoiceLocationItem[]>(invoicePath(role) + '/locations', signal);
}

export async function fetchInvoiceDetail(
  role: InvoiceRole,
  invoiceId: string,
  signal?: AbortSignal,
): Promise<InvoiceDetailResponse> {
  return invoiceRequest<InvoiceDetailResponse>(
    invoicePath(role) + '/' + encodeURIComponent(invoiceId),
    signal,
  );
}

export function formatRentalStatusLabel(status?: string | null): string | null {
  if (!status) return null;
  switch (status) {
    case 'TERMINATED':
      return 'Hợp đồng đã kết thúc';
    case 'EXPIRED':
      return 'Hợp đồng đã hết hạn';
    case 'ACTIVE':
      return 'Đang hiệu lực';
    default:
      return status;
  }
}

export function formatPendingTransferStatus(status: string): string {
  switch (status) {
    case 'NEEDS_REVIEW':
      return 'Chờ chủ nhà đối soát';
    case 'RECEIVED':
      return 'Đã tiếp nhận, đang xử lý';
    default:
      return status;
  }
}
