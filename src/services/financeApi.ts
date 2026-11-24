import { queryParams, type DetailQuery, type ReportQuery } from '../utils/profitLossNavigation';
import { isLosslessNumber, parse } from 'lossless-json';
import { isRecord, safeInteger } from './assetCodec';
import { authenticatedFetch } from './sessionClient';
import { expenseParams, type ExpenseFilter } from '../utils/expenseBreakdownNavigation';
import { appendFinancialParams, financialImpacts, financeParams, type FinanceFilter, type FinanceRoute } from '../utils/financeNavigation';

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
    ...(page.totalContribution == null ? {} : { totalContribution: decodeFinanceMoney(page.totalContribution) }),
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
export async function requestFinance<T>(path: string, params: URLSearchParams, decode: (value: unknown) => T, signal: AbortSignal) {
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
  return requestFinance('/reports/finance', financeParams(filter), decodeFinanceReport, signal);
}
const percentage = (value: unknown) => {
  if (value === null) return null;
  const number = isLosslessNumber(value) ? value.value : value;
  if (typeof number !== 'string' || !/^-?\d+(\.\d+)?$/.test(number)) return invalid();
  return number;
};
const boolean = (value: unknown) => typeof value === 'boolean' ? value : invalid();
const totals = (value: unknown) => {
  const row = record(value);
  return { revenue: decodeFinanceMoney(row.revenue), expense: decodeFinanceMoney(row.expense),
    profit: decodeFinanceMoney(row.profit), profitMargin: percentage(row.profitMargin) };
};
const window = (value: unknown) => {
  const row = record(value);
  return { page: count(row.page), size: count(row.size), totalElements: count(row.totalElements) };
};
export function decodeProfitLossReport(value: unknown) {
  const row = record(value);
  const scope = record(row.filter);
  const unknown = record(row.unknown);
  if (row.granularity !== 'DAY' && row.granularity !== 'MONTH') return invalid();
  if (row.status !== 'POSITIVE' && row.status !== 'NEGATIVE' && row.status !== 'ZERO' && row.status !== 'NO_DATA') return invalid();
  return { ...totals(row), granularity: row.granularity, status: row.status as 'POSITIVE' | 'NEGATIVE' | 'ZERO' | 'NO_DATA',
    fromDate: text(scope.fromDate), toDate: text(scope.toDate),
    directContribution: row.directContribution == null ? undefined : decodeFinanceMoney(row.directContribution),
    byPeriod: list(row.byPeriod, value => {
      const item = record(value);
      return { bucket: text(item.bucket), fromDate: text(item.fromDate), toDate: text(item.toDate),
        partial: boolean(item.partial), totals: totals(item.totals) };
    }),
    byBuilding: list(row.byBuilding, value => {
      const item = record(value);
      return { id: text(item.id), name: optional(item.name), totals: totals(item.totals),
        directExpense: decodeFinanceMoney(item.directExpense), commonExpense: decodeFinanceMoney(item.commonExpense) };
    }),
    byRoom: list(row.byRoom, value => {
      const item = record(value);
      return { id: text(item.id), buildingId: optional(item.buildingId), code: optional(item.code),
        revenue: decodeFinanceMoney(item.roomRevenue), expense: decodeFinanceMoney(item.directExpense),
        contribution: decodeFinanceMoney(item.directContribution) };
    }),
    byExpenseCategory: list(row.byExpenseCategory, value => {
      const item = record(value);
      return { code: text(item.code), name: text(item.name), expense: decodeFinanceMoney(item.expense),
        share: percentage(item.share) };
    }),
    buildingPagination: window(row.buildingPagination), roomPagination: window(row.roomPagination),
    unknown: { count: count(unknown.count), totalIn: decodeFinanceMoney(unknown.totalIn),
      totalOut: decodeFinanceMoney(unknown.totalOut) },
    unallocated: totals(row.unallocated), method: text(row.method), provisional: boolean(row.provisional),
    dataLimitations: list(row.dataLimitations, text), notes: list(row.notes, text), emptyMessage: optional(row.emptyMessage),
  };
}
export function decodeProfitLossDetails(value: unknown) {
  const row = record(value);
  return { ...window(row), totalContribution: decodeFinanceMoney(row.totalContribution), totals: totals(row.totals),
    entries: list(row.entries, value => {
      const item = record(value);
      return { cashEntryId: optional(item.cashEntryId), occurredAt: text(item.occurredAt),
        categoryCode: optional(item.categoryCode), classification: text(item.classification), origin: text(item.origin),
        direction: text(item.reportDirection), amount: decodeFinanceMoney(item.amount),
        contribution: decodeFinanceMoney(item.contribution), correctionKind: optional(item.correctionKind),
        references: [item.paymentId, item.adjustsId, item.settlementId].flatMap(id => id == null ? [] : [text(id)]) };
    }) };
}
export type ProfitLossReport = ReturnType<typeof decodeProfitLossReport>;
export type ProfitLossDetails = ReturnType<typeof decodeProfitLossDetails>;

export function getProfitLossReport(filter: ReportQuery, signal: AbortSignal) {
  return requestFinance('/reports/profit-loss', queryParams(filter), decodeProfitLossReport, signal);
}
export function getProfitLossDetails(query: DetailQuery, signal: AbortSignal) {
  return requestFinance('/reports/profit-loss/details', queryParams(query), decodeProfitLossDetails, signal);
}

export function getCashLedger(route: FinanceRoute, signal: AbortSignal) {
  const params = financeParams(route.filter);
  appendFinancialParams(params, route.financial);
  if (route.entryId) params.set('entryId', route.entryId);
  params.set('page', String(route.page));
  params.set('size', String(route.size));
  return requestFinance('/cash-ledger', params, decodeCashLedger, signal);
}


function expenseTrace(value: unknown) {
  const row = record(value);
  const financialImpact = financialImpacts.find(impact => impact === row.financialImpact);
  if (row.path !== '/api/v1/cash-ledger' || !financialImpact) return invalid();
  return {
    fromDate: text(row.fromDate), toDate: text(row.toDate), areaId: optional(row.areaId),
    buildingId: optional(row.buildingId), roomId: optional(row.roomId), financialImpact,
    financialCategoryCode: optional(row.financialCategoryCode), uncategorized: boolean(row.uncategorized),
  };
}
function expensePeriod(value: unknown) {
  const row = record(value);
  const unknown = record(row.unknown);
  return {
    fromDate: text(row.fromDate), toDate: text(row.toDate), totalGrossExpense: decodeFinanceMoney(row.totalGrossExpense),
    totalExpenseDeductions: decodeFinanceMoney(row.totalExpenseDeductions), totalNetExpense: decodeFinanceMoney(row.totalNetExpense),
    expenseCount: count(row.expenseCount), deductionCount: count(row.deductionCount), hasExpenseData: boolean(row.hasExpenseData),
    unknown: { count: count(unknown.count), totalIn: decodeFinanceMoney(unknown.totalIn), totalOut: decodeFinanceMoney(unknown.totalOut) },
    expenseWithoutProperty: decodeFinanceMoney(row.expenseWithoutProperty), expenseWithoutPropertyCount: count(row.expenseWithoutPropertyCount),
    unknownDrillDown: row.unknownDrillDown == null ? undefined : expenseTrace(row.unknownDrillDown),
  };
}
function expenseAmounts(value: unknown) {
  const row = record(value);
  return {
    grossExpense: decodeFinanceMoney(row.grossExpense), expenseDeductions: decodeFinanceMoney(row.expenseDeductions),
    netExpense: decodeFinanceMoney(row.netExpense), expenseCount: count(row.expenseCount),
  };
}
function expenseCategory(value: unknown) {
  const row = record(value);
  const change = ['NEW', 'NO_LONGER_INCURRED', 'INCREASED', 'DECREASED', 'UNCHANGED']
    .find(status => status === row.change) ?? invalid();
  return {
    code: optional(row.code), name: text(row.name), current: expenseAmounts(row.current), previous: expenseAmounts(row.previous),
    ratio: percentage(row.ratio), expenseDelta: decodeFinanceMoney(row.expenseDelta), growthRate: percentage(row.growthRate), change,
    currentDrillDown: expenseTrace(row.currentDrillDown), previousDrillDown: expenseTrace(row.previousDrillDown),
  };
}
export function decodeExpenseBreakdownReport(value: unknown) {
  const row = record(value);
  return {
    current: expensePeriod(row.current), previous: expensePeriod(row.previous),
    expenseDelta: decodeFinanceMoney(row.expenseDelta), growthRate: percentage(row.growthRate),
    categories: list(row.categories, expenseCategory),
    largestExpense: row.largestExpense == null ? undefined : expenseCategory(row.largestExpense),
    largestIncrease: row.largestIncrease == null ? undefined : expenseCategory(row.largestIncrease),
    ratioAvailable: boolean(row.ratioAvailable), comparisonProvisional: boolean(row.comparisonProvisional),
    deductionRecognitionSupported: boolean(row.deductionRecognitionSupported), warnings: list(row.warnings, text),
  };
}
export type ExpenseBreakdownReport = ReturnType<typeof decodeExpenseBreakdownReport>;
export type ExpenseCategory = ReturnType<typeof expenseCategory>;
export type ExpenseTrace = ReturnType<typeof expenseTrace>;

export function getExpenseBreakdown(filter: ExpenseFilter, signal: AbortSignal) {
  return requestFinance('/reports/expense-breakdown', expenseParams(filter), decodeExpenseBreakdownReport, signal);
}
