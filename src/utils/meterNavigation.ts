import type { MeterRoute, MeterScope } from '../types/meterReading';
import { isAssetId } from './assetNavigation';
export function isMeterDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export function parseMeterRoute(path: string, search: string): MeterRoute | null {
  const match = /^\/meter-readings(?:\/([^/]+))?\/?$/.exec(path);
  if (!match) return null;
  const params = new URLSearchParams(search);
  let invalid = [...params.keys()].some((key) => params.getAll(key).length > 1);
  const ids = (key: string) => {
    const values = params.get(key)?.split(',') || [];
    if (values.some((id) => !isAssetId(id)) || new Set(values).size !== values.length) invalid = true;
    return values;
  };
  const page = (key: string) => {
    const raw = params.get(key) || '0', value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value)) invalid = true;
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  };
  const fromDate = params.get('fromDate') || '', toDate = params.get('toDate') || '';
  const buildingId = params.get('buildingId') || '', view = params.get('view') || 'single';
  if ((fromDate && !isMeterDate(fromDate)) || (toDate && !isMeterDate(toDate)) || (fromDate && toDate && fromDate >= toDate)
    || (buildingId && !isAssetId(buildingId)) || !['single', 'batch', 'progress'].includes(view) || (match[1] && !isAssetId(match[1]))) invalid = true;
  return { view: view === 'batch' || view === 'progress' ? view : 'single', fromDate, toDate, buildingId,
    roomIds: ids('roomIds'), periodIds: ids('periodIds'), page: page('page'), periodPage: page('periodPage'), readingId: match[1] || null, invalid };
}
export function meterUrl(route: MeterRoute): string {
  const params = new URLSearchParams();
  for (const key of ['fromDate', 'toDate', 'buildingId'] as const) if (route[key]) params.set(key, route[key]);
  if (route.view !== 'single') params.set('view', route.view);
  for (const key of ['periodIds', 'roomIds'] as const) if (route[key].length) params.set(key, route[key].join(','));
  for (const key of ['page', 'periodPage'] as const) if (route[key]) params.set(key, String(route[key]));
  return '/meter-readings' + (route.readingId ? '/' + route.readingId : '') + (params.size ? '?' + params : '');
}
export const meterScope = (route: MeterRoute): MeterScope => ({ periodIds: route.periodIds, buildingId: route.buildingId || undefined, roomIds: route.roomIds.length ? route.roomIds : undefined });
export const meterContextKey = (route: MeterRoute) => JSON.stringify([route.fromDate, route.toDate, route.buildingId, [...route.roomIds].sort(), [...route.periodIds].sort(), route.readingId]);
