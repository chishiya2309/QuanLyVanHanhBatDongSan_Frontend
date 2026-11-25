import { parse } from 'lossless-json';
import { isRecord } from './assetCodec';
import { AuthApiError } from './authErrors';
import { getCsrfToken } from './csrfClient';
import { authenticatedFetch, sessionGuard } from './sessionClient';
import { decodeExpenseBreakdownReport, decodeFinanceReport, decodeProfitLossReport } from './financeApi';
import { downloadName, reportMime, type ReportFormat } from './reportExportApi';
import { expensePeriods, type ExpensePeriod } from '../utils/expenseBreakdownNavigation';

export type FinancialReportType = 'CASH_FLOW' | 'PROFIT_LOSS' | 'EXPENSE_BREAKDOWN' | 'COMBINED';
export type FinancialFilter = {
  fromDate: string; toDate: string; areaId?: string; buildingId?: string; roomId?: string;
  sourceId?: string; transactionCategory?: string[]; periodType?: ExpensePeriod;
};
export type FinancialExportConfig = { type: FinancialReportType; format: ReportFormat; includeTransactions: boolean; filter: FinancialFilter };

const endpoint = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '') + '/reports/finance/export';
const invalid = () => new Error('Phản hồi xuất báo cáo tài chính không hợp lệ. Vui lòng thử lại.');
const record = (value: unknown) => { if (!isRecord(value)) throw invalid(); return value; };
const str = (value: unknown) => { if (typeof value !== 'string' || !value) throw invalid(); return value; };
const optional = (value: unknown) => value == null ? undefined : str(value);

function decodeScope(value: unknown) {
  const scope = record(value);
  const raw = record(scope.filter);
  const periodType = expensePeriods.find(period => period === raw.periodType);
  if (raw.periodType != null && !periodType) throw invalid();
  if (!Array.isArray(raw.transactionCategory)) throw invalid();
  const filter: FinancialFilter = {
    fromDate: str(raw.fromDate), toDate: str(raw.toDate),
    areaId: optional(raw.areaId), buildingId: optional(raw.buildingId), roomId: optional(raw.roomId),
    sourceId: optional(raw.sourceId), transactionCategory: raw.transactionCategory.map(str), periodType,
  };
  const comparisonFrom = optional(scope.comparisonFrom);
  const comparisonTo = optional(scope.comparisonTo);
  if (Boolean(comparisonFrom) !== Boolean(comparisonTo)) throw invalid();
  return { filter, comparisonFrom, comparisonTo };
}

function decodeSnapshot(value: unknown, type: FinancialReportType) {
  const snapshot = record(value);
  if (snapshot.dataPolicy !== 'LATEST_AT_EXPORT') throw invalid();
  if ((snapshot.cashFlow != null) !== (type === 'CASH_FLOW' || type === 'COMBINED')
    || (snapshot.profitLoss != null) !== (type === 'PROFIT_LOSS' || type === 'COMBINED')
    || (snapshot.expenseBreakdown != null) !== (type === 'EXPENSE_BREAKDOWN' || type === 'COMBINED')) throw invalid();
  return { scope: decodeScope(snapshot.scope), capturedAt: str(snapshot.capturedAt),
    cashFlow: snapshot.cashFlow == null ? undefined : decodeFinanceReport(snapshot.cashFlow),
    profitLoss: snapshot.profitLoss == null ? undefined : decodeProfitLossReport(snapshot.profitLoss),
    expenseBreakdown: snapshot.expenseBreakdown == null ? undefined : decodeExpenseBreakdownReport(snapshot.expenseBreakdown) };
}

export type FinancialSnapshot = ReturnType<typeof decodeSnapshot>;
export type FinancialPreview = Awaited<ReturnType<typeof previewFinancialExport>>;

async function request(path: string, body: unknown, signal: AbortSignal, active: () => boolean) {
  const csrf = await getCsrfToken(signal);
  const response = await authenticatedFetch(endpoint + path, {
    method: 'POST', signal, cache: 'no-store',
    headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
    body: JSON.stringify(body),
  }, { shouldSend: active });
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null);
    throw new AuthApiError(response.status, isRecord(error) && typeof error.message === 'string' ? error.message : '');
  }
  return response;
}

function assertActive(active: () => boolean) {
  if (!active()) throw new DOMException('Yêu cầu xuất đã hết hiệu lực.', 'AbortError');
}

export async function previewFinancialExport(configuration: FinancialExportConfig, signal: AbortSignal) {
  const active = sessionGuard(() => !signal.aborted);
  const response = await request('/preview', configuration, signal, active);
  const data = record(record(await response.json()).data);
  assertActive(active);
  if (!Array.isArray(data.changes)) throw invalid();
  return { scope: decodeScope(data.scope), changes: data.changes.map(str), confirmationToken: str(data.confirmationToken) };
}

export async function exportFinancialReport(configuration: FinancialExportConfig, confirmationToken: string, signal: AbortSignal) {
  const active = sessionGuard(() => !signal.aborted);
  const response = await request('', { configuration, confirmationToken }, signal, active);
  const body = await response.arrayBuffer();
  assertActive(active);
  return decodeFinancialExport(response.headers.get('Content-Type'), body, configuration);
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
function at(body: Uint8Array, marker: Uint8Array, position: number) {
  return position + marker.length <= body.length && marker.every((byte, i) => body[position + i] === byte);
}

function find(body: Uint8Array, marker: Uint8Array, from: number, end = body.length) {
  for (let i = body.indexOf(marker[0], from); i >= 0 && i + marker.length <= end; i = body.indexOf(marker[0], i + 1)) {
    if (at(body, marker, i)) return i;
  }
  return -1;
}

export function decodeFinancialExport(contentType: string | null, buffer: ArrayBuffer, configuration: FinancialExportConfig) {
  if (contentType?.split(';')[0].trim().toLowerCase() !== 'multipart/mixed') throw invalid();
  const parameter = /;\s*boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  const boundary = parameter?.[1] ?? parameter?.[2];
  if (!boundary || !/^[\x20-\x7e]{1,70}$/.test(boundary)) throw invalid();
  const bytes = new Uint8Array(buffer);
  const start = encoder.encode('--' + boundary + '\r\n');
  const delimiter = encoder.encode('\r\n--' + boundary);
  const lineBreak = encoder.encode('\r\n');
  const closing = encoder.encode('--');
  const headerEnd = encoder.encode('\r\n\r\n');
  const parts = new Map<string, { headers: Map<string, string>; from: number; to: number }>();
  if (!at(bytes, start, 0)) throw invalid();
  let position = start.length;
  for (;;) {
    const end = find(bytes, headerEnd, position, position + 8192);
    if (end < 0 || parts.size >= 2) throw invalid();
    const headers = new Map<string, string>();
    for (const line of decoder.decode(bytes.subarray(position, end)).split('\r\n')) {
      const colon = line.indexOf(':');
      const key = line.slice(0, colon).toLowerCase();
      if (colon < 1 || headers.has(key)) throw invalid();
      headers.set(key, line.slice(colon + 1).trim());
    }
    const name = /(?:^|;)\s*name="(snapshot|file)"(?:;|$)/i.exec(headers.get('content-disposition') ?? '')?.[1];
    if (!name || parts.has(name)) throw invalid();
    const from = end + headerEnd.length;
    let to = find(bytes, delimiter, from);
    while (to >= 0 && !at(bytes, lineBreak, to + delimiter.length)
      && !(at(bytes, closing, to + delimiter.length)
        && (to + delimiter.length + closing.length === bytes.length
          || at(bytes, lineBreak, to + delimiter.length + closing.length)))) {
      to = find(bytes, delimiter, to + 1);
    }
    if (to <= from) throw invalid();
    parts.set(name, { headers, from, to });
    position = to + delimiter.length;
    if (at(bytes, closing, position)) break;
    position += lineBreak.length;
  }
  const snapshot = parts.get('snapshot');
  const file = parts.get('file');
  const mime = reportMime[configuration.format];
  const mediaType = (part: typeof file) => part?.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!snapshot || !file || mediaType(snapshot) !== 'application/json' || mediaType(file) !== mime) throw invalid();
  return {
    snapshot: decodeSnapshot(parse(decoder.decode(bytes.subarray(snapshot.from, snapshot.to))), configuration.type),
    blob: new Blob([bytes.subarray(file.from, file.to)], { type: mime }),
    filename: downloadName(file.headers.get('content-disposition') ?? null, configuration.format, 'bao-cao-tai-chinh'),
  };
}
