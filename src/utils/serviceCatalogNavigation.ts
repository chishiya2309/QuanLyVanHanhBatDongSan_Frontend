import { catalogFilters, type CatalogAction, type CatalogRoute } from '../types/serviceCatalog';
import { isAssetId } from './assetNavigation';

export function parseCatalogRoute(pathname: string, search: string): CatalogRoute | null {
  if (!/^\/services\/?$/.test(pathname)) return null;
  const params = new URLSearchParams(search);
  const state = params.get('state') || 'all';
  const action = params.get('action'); const id = params.get('serviceId');
  const actions: readonly string[] = ['create', 'edit', 'activate', 'deactivate'];
  const hasAction = params.has('action') || params.has('serviceId');
  const valid = hasAction && action !== null && actions.includes(action) &&
    params.getAll('action').length === 1 && params.getAll('serviceId').length <= 1 &&
    (action === 'create' ? !params.has('serviceId') : isAssetId(id));
  const invalid = hasAction && !valid || params.getAll('q').length > 1 || params.getAll('state').length > 1 || !Object.hasOwn(catalogFilters, state);
  return { q: (params.get('q') || '').trim(), state: Object.hasOwn(catalogFilters, state) ? state as CatalogRoute['state'] : 'all',
    action: valid && !invalid ? action as CatalogAction : null, serviceId: valid && !invalid ? id : null, invalid };
}
export function catalogUrl(route: Pick<CatalogRoute, 'q' | 'state'>, action: CatalogAction | null = null, serviceId: string | null = null): string {
  const params = new URLSearchParams();
  if (route.q) params.set('q', route.q);
  if (route.state !== 'all') params.set('state', route.state);
  if (action) params.set('action', action);
  if (action && action !== 'create' && serviceId) params.set('serviceId', serviceId);
  return '/services' + (params.size ? '?' + params.toString() : '');
}
