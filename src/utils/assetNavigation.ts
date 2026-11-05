import type { AssetQuery, AssetRoute } from '../types/assets';

export const assetPageSizes = [10, 20, 50, 100] as const;
export const isAssetId = (value: unknown): value is string => typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);

export function parseAssetRoute(pathname: string, search: string): AssetRoute | null {
  const match = /^\/assets(?:\/([^/]+)(?:\/(edit|condition|history))?)?\/?$/.exec(pathname);
  if (!match) return null;
  const params = new URLSearchParams(search);
  const pageText = params.get('page') || '0';
  const page = /^\d+$/.test(pageText) && Number.isSafeInteger(Number(pageText)) && Number(pageText) <= 2147483647 ? Number(pageText) : 0;
  const sizeText = params.get('size') || '20';
  const size = /^(10|20|50|100)$/.test(sizeText) ? Number(sizeText) : 20;
  const screen = match[2] === 'edit' || match[2] === 'condition' || match[2] === 'history' ? match[2] : match[1] ? 'detail' : 'list';
  const action = params.get('placement');
  const target = match[1] || params.get('targetAssetId');
  const hasPlacement = params.has('placement') || params.has('targetAssetId');
  const validPlacement = hasPlacement && (action === 'assign' || action === 'transfer') && isAssetId(target) &&
    (screen === 'list' || screen === 'detail') && !params.has('create') &&
    (!match[1] || !params.has('targetAssetId')) && params.getAll('placement').length === 1 && params.getAll('targetAssetId').length <= 1;
  return { assetId: match[1] || null, screen, q: (params.get('q') || '').trim(), page, size,
    create: !hasPlacement && !match[1] && params.get('create') === '1',
    placement: validPlacement ? { action, assetId: target } : null, invalidPlacement: hasPlacement && !validPlacement };
}

export function assetUrl(query: AssetQuery, assetId: string | null = null, screen: AssetRoute['screen'] = 'detail', create = false): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  params.set('page', String(query.page)); params.set('size', String(query.size));
  if (create && !assetId) params.set('create', '1');
  const suffix = assetId ? '/' + encodeURIComponent(assetId) + (screen !== 'detail' && screen !== 'list' ? '/' + screen : '') : '';
  return '/assets' + suffix + '?' + params.toString();
}

export function assetRouteKey(route: AssetRoute): string {
  const url = assetUrl(route, route.assetId, route.screen, route.create);
  if (!route.placement) return url;
  const target = new URL(url, window.location.origin);
  target.searchParams.set('placement', route.placement.action);
  if (route.screen === 'list') target.searchParams.set('targetAssetId', route.placement.assetId);
  return target.pathname + target.search;
}

export function assetPlacementUrl(route: AssetRoute, asset: { assetId: string; currentPlacement: unknown }): string {
  return assetRouteKey({ ...route, create: false, invalidPlacement: false,
    placement: { action: asset.currentPlacement ? 'transfer' : 'assign', assetId: asset.assetId } });
}
