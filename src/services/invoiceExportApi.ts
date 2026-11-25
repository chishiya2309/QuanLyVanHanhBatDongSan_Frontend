import { AuthApiError } from './authErrors';
import { invoicePath, invoiceRequest, type InvoiceRole } from './invoiceApi';
import { authenticatedFetch, sessionGuard } from './sessionClient';

export type InvoiceExportFormat = 'PDF' | 'DOCX';

export interface InvoiceExportFile {
  fileName: string;
  downloadUrl: string;
}

interface InvoiceExportResult extends InvoiceExportFile {
  reusedFromCache: boolean;
}

export interface InvoiceBatchResult extends InvoiceExportFile {
  successCount: number;
  failedCount: number;
  failures: { invoiceId: string; invoiceNumber: string | null; reason: string }[];
}

interface InvoicePreview {
  previewUrl: string;
  expiresAt: string;
}

export function exportInvoice(role: InvoiceRole, id: string, signal: AbortSignal, options?: {
  format: InvoiceExportFormat;
  templateVersionId?: string;
}) {
  return invoiceRequest<InvoiceExportResult>(
    invoicePath(role) + '/' + encodeURIComponent(id) + '/export', signal, options, undefined, 'POST',
  );
}

export function exportInvoiceBatch(invoiceIds: string[], signal: AbortSignal) {
  return invoiceRequest<InvoiceBatchResult>(invoicePath('host') + '/export/batch', signal, { invoiceIds });
}

export function previewInvoice(id: string, signal: AbortSignal) {
  return invoiceRequest<InvoicePreview>(
    invoicePath('host') + '/' + encodeURIComponent(id) + '/preview', signal, undefined, undefined, 'POST',
  );
}

export async function fetchInvoiceExportFile(path: string, signal: AbortSignal) {
  const base = new URL((import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '') + '/', window.location.origin);
  const provided = new URL(path, base);
  if (provided.origin !== base.origin || !provided.pathname.startsWith('/api/v1/invoices/')) {
    throw new Error('Đường dẫn tệp hóa đơn không hợp lệ.');
  }
  const url = new URL(provided.pathname.slice('/api/v1/'.length) + provided.search, base);
  const current = sessionGuard(() => !signal.aborted);
  const response = await authenticatedFetch(url.href, { signal, cache: 'no-store' }, { shouldSend: current });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new AuthApiError(response.status, error?.message || 'Chưa thể tải tệp hóa đơn.');
  }
  const blob = await response.blob();
  if (!current()) throw new DOMException('Yêu cầu đã hủy', 'AbortError');
  return blob;
}

export async function downloadInvoiceExport(file: InvoiceExportFile, signal: AbortSignal) {
  const blob = await fetchInvoiceExportFile(file.downloadUrl, signal);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.fileName;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
