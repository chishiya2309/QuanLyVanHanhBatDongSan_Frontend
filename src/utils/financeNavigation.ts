import { expenseBreakdownPath, expenseBreakdownUrl, parseExpenseBreakdownRoute } from './expenseBreakdownNavigation';

export const financialImpacts = ['OPERATING_EXPENSE', 'UNKNOWN', 'REVENUE'] as const;
export type FinancialLedgerFilter = {
  financialImpact: typeof financialImpacts[number]; financialCategoryCode?: string; uncategorized?: boolean;
};

export const financePath = '/reports/finance';
export const ledgerPath = '/cash-ledger';

const filterKeys = ['fromDate', 'toDate', 'areaId', 'buildingId', 'roomId', 'sourceId', 'dimension', 'groupKey', 'direction', 'origin', 'scopeType', 'affectsProfit'] as const;
export type FinanceFilter = Partial<Record<typeof filterKeys[number], string>> & { transactionCategory: string[] };
export type FinanceRoute = {
  kind: 'finance' | 'cash-ledger';
  filter: FinanceFilter;
  page: number;
  size: number;
  reportSearch?: string;
  entryId?: string;
  profitLossSearch?: string;
  expenseBreakdownSearch?: string;
  financial?: FinancialLedgerFilter;
  expenseMetric?: 'gross' | 'net';
};

export function financeParams(filter: FinanceFilter) {
  const params = new URLSearchParams();
  for (const key of filterKeys) if (filter[key]) params.set(key, filter[key]);
  for (const category of filter.transactionCategory) params.append('transactionCategory', category);
  return params;
}

export function parseFinanceRoute(path: string, search: string): FinanceRoute | null {
  const normalized = path.replace(/\/+$/, '');
  if (normalized !== financePath && normalized !== ledgerPath) return null;
  const params = new URLSearchParams(search);
  const kind = normalized === financePath ? 'finance' : 'cash-ledger';
  const filter: FinanceFilter = { transactionCategory: params.getAll('transactionCategory') };
  for (const key of filterKeys) {
    if (kind === 'finance' && (key === 'dimension' || key === 'groupKey')) continue;
    const value = params.get(key);
    if (value) filter[key] = value;
  }
  const impact = financialImpacts.find(value => value === params.get('financialImpact'));
  const metric = params.get('expenseMetric');
  const size = Number(params.get('size'));
  const page = Number(params.get('page'));
  return {
    kind, filter,
    page: Number.isInteger(page) && page >= 0 && page <= 21_474_836 ? page : 0,
    size: Number.isInteger(size) && size >= 1 && size <= 100 ? size : 20,
    reportSearch: params.get('report') ?? undefined,
    ...(kind === 'cash-ledger' && impact ? { financial: { financialImpact: impact,
      financialCategoryCode: params.get('financialCategoryCode') ?? undefined,
      uncategorized: params.get('uncategorized') === 'true' } } : {}),
    ...(kind === 'cash-ledger' && (metric === 'gross' || metric === 'net') ? { expenseMetric: metric } : {}),
    ...(kind === 'cash-ledger' && params.has('expenseBreakdown') ? { expenseBreakdownSearch: params.get('expenseBreakdown')! } : {}),
    ...(kind === 'cash-ledger' && params.has('entryId') ? { entryId: params.get('entryId')! } : {}),
    ...(kind === 'cash-ledger' && params.has('profitLoss') ? { profitLossSearch: params.get('profitLoss')! } : {}),
  };
}

export function appendFinancialParams(params: URLSearchParams, financial?: FinancialLedgerFilter) {
  if (!financial) return;
  params.set('financialImpact', financial.financialImpact);
  if (financial.financialCategoryCode) params.set('financialCategoryCode', financial.financialCategoryCode);
  if (financial.uncategorized) params.set('uncategorized', 'true');
}

export function financeUrl(route: FinanceRoute) {
  const params = financeParams(route.filter);
  if (route.kind === 'cash-ledger') {
    appendFinancialParams(params, route.financial);
    if (route.expenseBreakdownSearch !== undefined) params.set('expenseBreakdown', route.expenseBreakdownSearch);
    if (route.expenseMetric) params.set('expenseMetric', route.expenseMetric);
    params.set('page', String(route.page));
    params.set('size', String(route.size));
    if (route.entryId) params.set('entryId', route.entryId);
    if (route.profitLossSearch !== undefined) params.set('profitLoss', route.profitLossSearch);
    if (route.reportSearch) params.set('report', route.reportSearch);
  }
  return (route.kind === 'finance' ? financePath : ledgerPath) + (params.size ? '?' + params : '');
}

export function drillDownUrl(filter: FinanceFilter, report: FinanceFilter) {
  return financeUrl({ kind: 'cash-ledger', filter, page: 0, size: 20, reportSearch: String(financeParams(report)) });
}

export function returnToFinance(route: FinanceRoute) {
  if (route.expenseBreakdownSearch !== undefined) {
    return expenseBreakdownUrl(parseExpenseBreakdownRoute(expenseBreakdownPath, route.expenseBreakdownSearch)!);
  }
  if (route.profitLossSearch !== undefined) {
    const search = new URLSearchParams(route.profitLossSearch);
    return '/reports/profit-loss' + (search.size ? '?' + search : '');
  }
  return financeUrl(parseFinanceRoute(financePath, route.reportSearch ?? '')!);
}

export function validFinanceDates({ fromDate, toDate }: FinanceFilter) {
  if (!fromDate && !toDate) return true;
  const valid = (date?: string) => !!date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  return valid(fromDate) && valid(toDate) && fromDate! <= toDate!;
}

