import { AuthApiError } from './authErrors';
import { isLosslessNumber, parse, stringify } from 'lossless-json';
import { getCsrfToken } from './csrfClient';
import { isRecord } from './assetCodec';
import { authenticatedFetch, sessionGuard } from './sessionClient';

const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');

export type InvoiceRole = 'host' | 'customer';
export const invoicePath = (role: InvoiceRole) => '/invoices/' + role;
export const isInvoicePath = (path: string) => /^\/invoices\/(host|customer)(\/[^/]+)?\/?$/.test(path);
const decimals = new Set(['total', 'paid_amount', 'paidAmount', 'remaining', 'amount', 'quantity', 'unitPrice', 'subtotal', 'totalDelta', 'startIndex', 'endIndex', 'consumption', 'manualAmount', 'prorateFactor', 'start_index', 'end_index']);

export async function invoiceRequest<T>(path: string, signal?: AbortSignal, body?: object, idempotencyKey?: string, method = body ? 'POST' : 'GET'): Promise<T> {
  const current = sessionGuard(() => !signal?.aborted);
  const headers = new Headers({ Accept: 'application/json' });
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
  if (method !== 'GET') {
    const csrf = await getCsrfToken();
    headers.set(csrf.headerName, csrf.token);
    if (body) headers.set('Content-Type', 'application/json');
  }
  const response = await authenticatedFetch(base + path, {
    method, headers, signal, cache: 'no-store',
    body: body ? stringify(body) : undefined,
  }, { shouldSend: current });
  const envelope = await response.text().then(text => parse(text, (key, value) => {
    if (!isLosslessNumber(value)) return value;
    return decimals.has(key) ? value.toString() : Number(value.toString());
  })).catch(() => null);
  if (!current()) throw new DOMException('Yêu cầu đã hủy', 'AbortError');
  if (!response.ok || !isRecord(envelope) || !Object.hasOwn(envelope, 'data')) {
    const reason = isRecord(envelope) && typeof envelope.message === 'string' ? envelope.message : null;
    const code = isRecord(envelope) && typeof envelope.code === 'string' ? envelope.code : undefined;
    throw new AuthApiError(response.status, reason || 'Chưa thể tải dữ liệu hóa đơn.', undefined, code);
  }
  return envelope.data as T;
}
