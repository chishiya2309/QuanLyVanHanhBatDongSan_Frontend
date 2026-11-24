import { isLosslessNumber, parse } from 'lossless-json';
import { isRecord, safeInteger } from './assetCodec';
import { authenticatedFetch } from './sessionClient';
import { financeParams, type FinanceFilter, type FinanceRoute } from '../utils/financeNavigation';

function invalid(): never { throw new Error('Dữ liệu tài chính trả về không hợp lệ.'); }
const record = (value: unknown) => isRecord(value) ? value : invalid();
const text = (value: unknown) => typeof value === 'string' ? value : invalid();
const optional = (value: unknown) => value == null ? undefined : text(value);
const list = <T,>(value: unknown, decode: (item: unknown) => T): T[] => Array.isArray(value) ? value.map(decode) : invalid();
const count = (value: unknown) => {
  const result = safeInteger(value);
  return result !== null && result >= 0 ? result : invalid();
};

export function decodeFinanceMoney(value: unknown) {
  const raw = isLosslessNumber(value) ? value.value : value;
  return typeof raw === 'string' && /^-?\d+(?:\.0+)?$/.test(raw) ? BigInt(raw.split('.')[0]) : invalid();
}

function filter(value: unknown): FinanceFilter {
  const row = record(value);
  return {
    fromDate: optional(row.fromDate), toDate: optional(row.toDate), areaId: optional(row.areaId),
    buildingId: optional(row.buildingId), roomId: optional(row.roomId), sourceId: optional(row.sourceId),
    transactionCategory: list(row.transactionCategory, text), dimension: optional(row.dimension), groupKey: optional(row.groupKey),
  };
}

function amounts(row: Record<string, unknown>) {
  return {
    totalIn: decodeFinanceMoney(row.totalIn), totalOut: decodeFinanceMoney(row.totalOut),
    cashFlow: decodeFinanceMoney(row.cashFlow), transferIn: decodeFinanceMoney(row.transferIn),
    transferOut: decodeFinanceMoney(row.transferOut),
  };
}

function point(value: unknown) {
  const row = record(value);
  return { ...amounts(row), at: text(row.at), drillDown: filter(row.drillDown) };
}

function group(value: unknown) {
  const row = record(value);
  return { ...amounts(row), key: text(row.key), label: text(row.label), drillDown: filter(row.drillDown) };
}

export function decodeFinanceReport(value: unknown) {
  const row = record(value);
  const granularity = row.granularity;
  if (granularity !== 'DAY' && granularity !== 'MONTH') return invalid();
  return {
    ...amounts(row), granularity, filter: filter(row.filter), byDay: list(row.byDay, point), byMonth: list(row.byMonth, point),
    byArea: list(row.byArea, group), byBuilding: list(row.byBuilding, group), byRoom: list(row.byRoom, group),
    byCategory: list(row.byCategory, group), bySource: list(row.bySource, group), composition: list(row.composition, group),
    emptyMessage: optional(row.emptyMessage),
  };
}
export type FinanceReport = ReturnType<typeof decodeFinanceReport>;
export type FinancePoint = ReturnType<typeof point>;
export type FinanceGroup = ReturnType<typeof group>;

export function decodeCashLedger(value: unknown) {
  const page = record(value);
  return {
    page: count(page.page), size: count(page.size), totalElements: count(page.totalElements),
    items: list(page.items, item => {
      const row = record(item);
      return {
        id: text(row.id), sourceId: text(row.sourceId), amount: decodeFinanceMoney(row.amount),
        direction: text(row.direction), origin: text(row.origin), category: optional(row.category),
        occurredAt: text(row.occurredAt), confirmationStatus: optional(row.confirmationStatus),
        method: optional(row.method), note: optional(row.note), areaId: optional(row.areaId),
        buildingId: optional(row.buildingId), roomId: optional(row.roomId), transferId: optional(row.transferId),
        adjustsId: optional(row.adjustsId), correctionKind: optional(row.correctionKind),
        depositId: optional(row.depositId), settlementId: optional(row.settlementId), paymentId: optional(row.paymentId),
        adjustments: list(row.adjustments, text), reportDirection: text(row.reportDirection),
        reportAmount: decodeFinanceMoney(row.reportAmount),
      };
    }),
  };
}
export type LedgerPage = ReturnType<typeof decodeCashLedger>;

const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
export class FinanceApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
async function request<T>(path: string, params: URLSearchParams, decode: (value: unknown) => T, signal: AbortSignal) {
  const response = await authenticatedFetch(base + path + (params.size ? '?' + params : ''), {
    signal, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new FinanceApiError(response.status, isRecord(body) && typeof body.message === 'string' ? body.message : '');
  }
  const body = record(parse(await response.text()));
  if (count(body.status) !== 200) return invalid();
  return decode(body.data);
}
export function getFinanceReport(filter: FinanceFilter, signal: AbortSignal) {
  return request('/reports/finance', financeParams(filter), decodeFinanceReport, signal);
}
export function getCashLedger(route: FinanceRoute, signal: AbortSignal) {
  const params = financeParams(route.filter);
  params.set('page', String(route.page));
  params.set('size', String(route.size));
  return request('/cash-ledger', params, decodeCashLedger, signal);
}

