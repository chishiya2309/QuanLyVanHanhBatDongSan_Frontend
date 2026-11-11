import { catalogFilters, type CatalogFilter } from '../types/serviceCatalog';
import type { ServicePolicyRoute } from '../types/servicePolicy';
import { isAssetId } from './assetNavigation';

export function parseServicePolicyRoute(pathname: string, search: string): ServicePolicyRoute | null {
  const selectMatch = /^\/services\/policy\/?$/.exec(pathname);
  const detailMatch = /^\/services\/([^/]+)\/policy\/?$/.exec(pathname);

  if (!selectMatch && !detailMatch) return null;

  const params = new URLSearchParams(search);
  const rawState = params.get('state') || 'all';
  const state = Object.hasOwn(catalogFilters, rawState) ? rawState : 'all';
  const q = (params.get('q') || '').trim();

  const invalidQuery = params.getAll('q').length > 1 || params.getAll('state').length > 1;

  if (selectMatch) {
    return {
      serviceId: null,
      q,
      state: state as CatalogFilter,
      invalid: invalidQuery,
    };
  }

  const rawId = detailMatch![1];
  const validId = isAssetId(rawId);

  return {
    serviceId: validId ? rawId : null,
    q,
    state: state as CatalogFilter,
    invalid: !validId || invalidQuery,
  };
}

export function servicePolicyUrl(route: {
  serviceId?: string | null;
  q?: string;
  state?: string;
}): string {
  const pathname = route.serviceId ? `/services/${encodeURIComponent(route.serviceId)}/policy` : '/services/policy';
  const params = new URLSearchParams();

  if (route.q && route.q.trim()) {
    params.set('q', route.q.trim());
  }

  if (route.state && route.state !== 'all' && Object.hasOwn(catalogFilters, route.state)) {
    params.set('state', route.state);
  }

  const qs = params.toString();
  return pathname + (qs ? '?' + qs : '');
}
