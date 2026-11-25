import { isRecord } from './assetCodec';
import { AuthApiError } from './authErrors';
import { getCsrfToken } from './csrfClient';
import { authenticatedFetch, sessionGuard } from './sessionClient';

export type ReportFormat = 'XLSX' | 'PDF';
export type ReportDateRange = { fromDate: string; toDate: string };
export type ReportExportRequest = {
  format: ReportFormat;
  areaId?: string;
  buildingId?: string;
  expiryRange?: ReportDateRange;
  trendRange?: ReportDateRange;
};

const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
export const reportMime = {
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PDF: 'application/pdf',
};

export function downloadName(header: string | null, format: ReportFormat, fallbackStem = 'bao-cao-bat-dong-san'): string {
  const extension = '.' + format.toLowerCase();
  const fallback = fallbackStem + extension;
  const encoded = header?.match(/(?:^|;)\s*filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = header?.match(/(?:^|;)\s*filename=(?:"([^"]*)"|([^;]+))/i);
  let name = plain?.[1] ?? plain?.[2];
  if (encoded) {
    try { name = decodeURIComponent(encoded.trim()); } catch { /* Try the plain filename. */ }
  }
  name = name?.trim();
  const unsafe = name && ([...name].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    || /[<>:"/\\|?*\u202a-\u202e\u2066-\u2069]/u.test(name));
  return name && !unsafe && !name.startsWith('.') && name.length <= 180
    && name.toLowerCase().endsWith(extension) ? name : fallback;
}

export async function exportReport(request: ReportExportRequest, signal: AbortSignal) {
  const active = sessionGuard(() => !signal.aborted);
  const csrf = await getCsrfToken(signal);
  const response = await authenticatedFetch(base + '/reports/export', {
    method: 'POST', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
    body: JSON.stringify(request),
  }, { shouldSend: active });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new AuthApiError(response.status, isRecord(body) && typeof body.message === 'string' ? body.message : '');
  }
  const contentType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (response.status !== 200 || contentType !== reportMime[request.format]) {
    throw new Error('Phản hồi không chứa tệp báo cáo đúng định dạng.');
  }
  const blob = await response.blob();
  if (!active()) throw new DOMException('Yêu cầu xuất đã hết hiệu lực.', 'AbortError');
  if (!blob.size) throw new Error('Tệp báo cáo nhận được không có dữ liệu.');
  return { blob, filename: downloadName(response.headers.get('Content-Disposition'), request.format) };
}
