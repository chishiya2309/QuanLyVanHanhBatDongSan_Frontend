import type { FundingAction, FundingRoute } from '../types/fundingSource';
import { isAssetId } from './assetNavigation';
export function parseFundingRoute(pathname: string, search: string): FundingRoute | null {
  if (!/^\/funding-sources\/?$/.test(pathname)) return null;
  const p = new URLSearchParams(search), type = p.get('type') ?? '', active = p.get('active') ?? '';
  const action = p.get('action'), sourceId = p.get('sourceId');
  const validType = ['', 'CASH', 'BANK'].includes(type), validActive = ['', 'true', 'false'].includes(active);
  const validAction = action === null ? sourceId === null : ['create-cash', 'create-bank'].includes(action) ? sourceId === null
    : ['edit', 'activate', 'deactivate'].includes(action) && isAssetId(sourceId);
  const invalid = !validType || !validActive || !validAction || [...p.keys()].some(key => !['type', 'active', 'action', 'sourceId'].includes(key) || p.getAll(key).length > 1);
  return { type: validType ? type as FundingRoute['type'] : '', active: validActive ? active as FundingRoute['active'] : '',
    action: invalid ? null : action as FundingAction | null, sourceId: invalid ? null : sourceId, invalid };
}
export function fundingUrl(route: Pick<FundingRoute, 'type' | 'active'>, action: FundingAction | null = null, sourceId: string | null = null): string {
  const p = new URLSearchParams(); if (route.type) p.set('type', route.type); if (route.active) p.set('active', route.active);
  if (action) p.set('action', action); if (action && !action.startsWith('create-') && sourceId) p.set('sourceId', sourceId);
  return '/funding-sources' + (p.size ? '?' + p : '');
}
