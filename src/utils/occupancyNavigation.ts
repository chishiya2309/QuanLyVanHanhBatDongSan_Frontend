export const occupancyPath = '/reports/occupancy';

export const occupancySorts = ['daysVacant,desc', 'daysVacant,asc', 'defaultRent,desc', 'defaultRent,asc'] as const;

export interface OccupancyQuery {
  areaId?: string;
  buildingId?: string;
  page: number;
  size: number;
  sort: typeof occupancySorts[number];
}

export function parseOccupancyRoute(path: string, search: string): OccupancyQuery | null {
  if (path.replace(/\/+$/, '') !== occupancyPath) return null;
  const params = new URLSearchParams(search);
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  return {
    areaId: params.get('areaId') || undefined,
    buildingId: params.get('buildingId') || undefined,
    page: Number.isSafeInteger(page) && page >= 0 && page <= 2147483647 ? page : 0,
    size: Number.isInteger(size) && size >= 1 && size <= 100 ? size : 20,
    sort: occupancySorts.find(sort => sort === params.get('sort')) ?? occupancySorts[0],
  };
}

export function occupancyParams(query: OccupancyQuery): URLSearchParams {
  const params = new URLSearchParams({ page: String(query.page), size: String(query.size), sort: query.sort });
  if (query.areaId) params.set('areaId', query.areaId);
  if (query.buildingId) params.set('buildingId', query.buildingId);
  return params;
}

export function occupancyUrl(query: OccupancyQuery): string {
  return occupancyPath + '?' + occupancyParams(query);
}
