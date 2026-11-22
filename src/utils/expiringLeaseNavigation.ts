export const expiringLeasePath = '/reports/expiring-leases';
export const expirySorts = ['daysRemaining,asc', 'daysRemaining,desc'] as const;

export interface ExpiringLeaseQuery {
  kind: 'expiring-leases';
  areaId?: string;
  buildingId?: string;
  fromDate?: string;
  toDate?: string;
  page: number;
  size: number;
  sort: typeof expirySorts[number];
}

export function parseExpiringLeaseRoute(path: string, search: string): ExpiringLeaseQuery | null {
  if (path.replace(/\/+$/, '') !== expiringLeasePath) return null;
  const params = new URLSearchParams(search);
  const page = Number(params.get('page') ?? '0');
  const size = Number(params.get('size') ?? '20');
  return {
    kind: 'expiring-leases',
    areaId: params.get('areaId') || undefined,
    buildingId: params.get('buildingId') || undefined,
    fromDate: params.get('fromDate') ?? undefined,
    toDate: params.get('toDate') ?? undefined,
    page: Number.isSafeInteger(page) && page >= 0 && page <= 2147483647 ? page : 0,
    size: Number.isInteger(size) && size >= 1 && size <= 100 ? size : 20,
    sort: expirySorts.find(sort => sort === params.get('sort')) ?? expirySorts[0],
  };
}

export function expiryParams(query: ExpiringLeaseQuery) {
  const params = new URLSearchParams({ page: String(query.page), size: String(query.size), sort: query.sort });
  for (const key of ['areaId', 'buildingId', 'fromDate', 'toDate'] as const) {
    const value = query[key];
    if (value !== undefined) params.set(key, value);
  }
  return params;
}

export function expiringLeaseUrl(query: ExpiringLeaseQuery) {
  return expiringLeasePath + '?' + expiryParams(query);
}

function calendarTime(value: string) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return NaN;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date.getTime() : NaN;
}

export function validExpiryDates(from?: string, to?: string) {
  if (from === undefined && to === undefined) return true;
  if (!from || !to) return false;
  const days = (calendarTime(to) - calendarTime(from)) / 86400000;
  return days >= 0 && days <= 366;
}
