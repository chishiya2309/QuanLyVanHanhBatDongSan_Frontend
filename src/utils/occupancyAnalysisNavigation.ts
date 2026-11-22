export const occupancyAnalysisPath = '/reports/occupancy-analysis';

export interface OccupancyAnalysisQuery {
  kind: 'occupancy-analysis';
  areaId?: string;
  buildingId?: string;
  fromDate?: string;
  toDate?: string;
}

export function parseOccupancyAnalysisRoute(path: string, search: string): OccupancyAnalysisQuery | null {
  if (path.replace(/\/+$/, '') !== occupancyAnalysisPath) return null;
  const params = new URLSearchParams(search);
  return {
    kind: 'occupancy-analysis',
    areaId: params.get('areaId') || undefined,
    buildingId: params.get('buildingId') || undefined,
    fromDate: params.get('fromDate') || undefined,
    toDate: params.get('toDate') || undefined,
  };
}

export function occupancyAnalysisParams(query: OccupancyAnalysisQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const field of ['areaId', 'buildingId', 'fromDate', 'toDate'] as const) {
    const value = query[field];
    if (value) params.set(field, value);
  }
  return params;
}

export function occupancyAnalysisUrl(query: OccupancyAnalysisQuery): string {
  const search = occupancyAnalysisParams(query).toString();
  return search ? occupancyAnalysisPath + '?' + search : occupancyAnalysisPath;
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateTrendRange(fromDate?: string, toDate?: string, asOfDate?: string): boolean {
  if (!fromDate && !toDate) return true;
  if (!fromDate || !toDate || !isCalendarDate(fromDate) || !isCalendarDate(toDate) || fromDate > toDate) return false;
  return (!asOfDate || toDate <= asOfDate) && Date.parse(toDate) - Date.parse(fromDate) <= 366 * 86_400_000;
}
