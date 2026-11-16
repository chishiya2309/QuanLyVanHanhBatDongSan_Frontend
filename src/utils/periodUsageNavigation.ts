import type { PeriodUsageRoute, PeriodUsageTab } from '../types/periodUsage';
import { isAssetId } from './assetNavigation';

export function parsePeriodUsageRoute(path: string, search: string): PeriodUsageRoute | null {
  if (path !== '/period-usages' && path !== '/period-usages/') return null;
  const params = new URLSearchParams(search);
  let invalid = false;

  const buildingId = params.get('buildingId') || '';
  const roomId = params.get('roomId') || '';
  const periodId = params.get('periodId') || '';
  const tabRaw = params.get('tab') || 'quantity';

  if (buildingId && !isAssetId(buildingId)) invalid = true;
  if (roomId && !isAssetId(roomId)) invalid = true;
  if (periodId && !isAssetId(periodId)) invalid = true;

  const validTabs: PeriodUsageTab[] = ['quantity', 'custom', 'fee', 'discount'];
  const tab: PeriodUsageTab = validTabs.includes(tabRaw as PeriodUsageTab) ? (tabRaw as PeriodUsageTab) : 'quantity';
  if (!validTabs.includes(tabRaw as PeriodUsageTab) && params.has('tab')) invalid = true;

  return {
    buildingId,
    roomId,
    periodId,
    tab,
    invalid
  };
}

export function periodUsageUrl(route: Partial<PeriodUsageRoute>): string {
  const params = new URLSearchParams();
  if (route.buildingId) params.set('buildingId', route.buildingId);
  if (route.roomId) params.set('roomId', route.roomId);
  if (route.periodId) params.set('periodId', route.periodId);
  if (route.tab && route.tab !== 'quantity') params.set('tab', route.tab);
  return '/period-usages' + (params.size ? '?' + params.toString() : '');
}

export function formatVnd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return '—';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
