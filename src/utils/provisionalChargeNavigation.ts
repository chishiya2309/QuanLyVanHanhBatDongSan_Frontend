import { isAssetId } from './assetNavigation';
import type { PeriodHeader, ProvisionalRole, ProvisionalRoute } from '../types/provisionalCharge';
export const provisionalPath = (role: ProvisionalRole) => role === 'HOST' ? '/provisional-charges' : '/portal/provisional-charges';
export function parseProvisionalRoute(path: string, search: string): ProvisionalRoute | null {
  const clean = path.replace(/\/$/, '');
  const role = clean === '/provisional-charges' ? 'HOST' : clean === '/portal/provisional-charges' ? 'CUSTOMER' : null;
  if (!role) return null;
  const params = new URLSearchParams(search);
  const roomId = (params.get('roomId') || '').toLowerCase(), periodId = (params.get('periodId') || '').toLowerCase();
  const invalid = (roomId !== '' && !isAssetId(roomId)) || (periodId !== '' && !isAssetId(periodId))
    || (!roomId && !!periodId) || params.getAll('roomId').length > 1 || params.getAll('periodId').length > 1;
  return { role, roomId, periodId, invalid };
}
export function provisionalUrl(route: Pick<ProvisionalRoute, 'role'> & Partial<Pick<ProvisionalRoute, 'roomId' | 'periodId'>>): string {
  const params = new URLSearchParams();
  if (route.roomId) params.set('roomId', route.roomId);
  if (route.periodId) params.set('periodId', route.periodId);
  return provisionalPath(route.role) + (params.size ? '?' + params : '');
}
export function sortProvisionalPeriods(periods: PeriodHeader[]): PeriodHeader[] {
  return [...periods].sort((a, b) => a.fromDate.localeCompare(b.fromDate) || a.toDate.localeCompare(b.toDate) || a.periodId.localeCompare(b.periodId));
}
