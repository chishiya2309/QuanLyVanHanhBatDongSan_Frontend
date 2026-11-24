export const financePath = '/reports/finance';
export const ledgerPath = '/cash-ledger';

const filterKeys = ['fromDate', 'toDate', 'areaId', 'buildingId', 'roomId', 'sourceId', 'dimension', 'groupKey'] as const;
export type FinanceFilter = Partial<Record<typeof filterKeys[number], string>> & { transactionCategory: string[] };
export type FinanceRoute = {
  kind: 'finance' | 'cash-ledger';
  filter: FinanceFilter;
  page: number;
  size: number;
  reportSearch?: string;
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
  const size = Number(params.get('size'));
  const page = Number(params.get('page'));
  return {
    kind, filter,
    page: Number.isInteger(page) && page >= 0 && page <= 21_474_836 ? page : 0,
    size: Number.isInteger(size) && size >= 1 && size <= 100 ? size : 20,
    reportSearch: params.get('report') ?? undefined,
  };
}

export function financeUrl(route: FinanceRoute) {
  const params = financeParams(route.filter);
  if (route.kind === 'cash-ledger') {
    params.set('page', String(route.page));
    params.set('size', String(route.size));
    if (route.reportSearch) params.set('report', route.reportSearch);
  }
  return (route.kind === 'finance' ? financePath : ledgerPath) + (params.size ? '?' + params : '');
}

export function drillDownUrl(filter: FinanceFilter, report: FinanceFilter) {
  return financeUrl({ kind: 'cash-ledger', filter, page: 0, size: 20, reportSearch: String(financeParams(report)) });
}

export function returnToFinance(route: FinanceRoute) {
  return financeUrl(parseFinanceRoute(financePath, route.reportSearch ?? '')!);
}

export function validFinanceDates({ fromDate, toDate }: FinanceFilter) {
  if (!fromDate && !toDate) return true;
  const valid = (date?: string) => !!date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  return valid(fromDate) && valid(toDate) && fromDate! <= toDate!;
}

