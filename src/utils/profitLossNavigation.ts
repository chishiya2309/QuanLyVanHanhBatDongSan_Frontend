import { financeUrl, type FinanceFilter } from './financeNavigation';

export const profitLossPath = '/reports/profit-loss';
export const metrics = ['REVENUE', 'EXPENSE', 'PROFIT', 'PROFIT_MARGIN', 'UNKNOWN'] as const;
export type Metric = typeof metrics[number];
export type Scope = Pick<FinanceFilter, 'fromDate' | 'toDate' | 'areaId' | 'buildingId' | 'roomId'>;
export type ReportQuery = Scope & {
  sort?: Exclude<Metric, 'UNKNOWN'>; order?: 'ASC' | 'DESC';
  buildingPage?: number; roomPage?: number; groupSize?: number;
};
export type DetailQuery = Scope & { metric: Metric; categoryCode?: string; unallocated?: boolean; page?: number; size?: number };
export type ProfitLossRoute = {
  kind: 'profit-loss'; filter: ReportQuery; selectedBuilding?: string; selectedRoomPage?: number; detail?: DetailQuery;
};

const scopeKeys = ['fromDate', 'toDate', 'areaId', 'buildingId', 'roomId'] as const;
const value = (params: URLSearchParams, key: string) => params.get(key) || undefined;
const page = (params: URLSearchParams, key: string) => {
  const raw = value(params, key);
  const number = Number(raw);
  return raw && /^\d+$/.test(raw) && number <= 21_474_836 ? number : undefined;
};
function readScope(params: URLSearchParams): Scope {
  return Object.fromEntries(scopeKeys.flatMap(key => value(params, key) ? [[key, value(params, key)]] : []));
}

export function queryParams(query: object) {
  const params = new URLSearchParams();
  for (const [key, item] of Object.entries(query)) if (item !== undefined && item !== '') params.set(key, String(item));
  return params;
}

export function parseProfitLossRoute(path: string, search: string): ProfitLossRoute | null {
  if (path.replace(/\/+$/, '') !== profitLossPath) return null;
  const params = new URLSearchParams(search);
  const sort = metrics.find(metric => metric !== 'UNKNOWN' && metric === params.get('sort'));
  const order = params.get('order');
  const groupSize = page(params, 'groupSize');
  const details = new URLSearchParams(params.get('detail') ?? '');
  const metric = metrics.find(item => item === details.get('metric'));
  const size = page(details, 'size');
  return {
    kind: 'profit-loss',
    filter: { ...readScope(params), sort: sort === 'UNKNOWN' ? undefined : sort, order: order === 'ASC' || order === 'DESC' ? order : undefined,
      buildingPage: page(params, 'buildingPage'), roomPage: page(params, 'roomPage'),
      groupSize: groupSize && groupSize <= 100 ? groupSize : undefined },
    selectedBuilding: value(params, 'selectedBuilding'),
    selectedRoomPage: page(params, 'selectedRoomPage'),
    detail: metric ? { ...readScope(details), metric, categoryCode: value(details, 'categoryCode'),
      unallocated: details.get('unallocated') === 'true' || undefined, page: page(details, 'page'),
      size: size && size <= 100 ? size : undefined } : undefined,
  };
}

export function profitLossUrl(route: ProfitLossRoute) {
  const params = queryParams({ ...route.filter, selectedBuilding: route.selectedBuilding,
    selectedRoomPage: route.selectedRoomPage, detail: route.detail && String(queryParams(route.detail)) });
  return profitLossPath + (params.size ? '?' + params : '');
}

export function profitLossLedgerUrl(entryId: string, scope: Scope, route: ProfitLossRoute) {
  return financeUrl({ kind: 'cash-ledger', entryId, page: 0, size: 20, filter: { ...scope, transactionCategory: [] },
    profitLossSearch: profitLossUrl(route).slice(profitLossPath.length) });
}
