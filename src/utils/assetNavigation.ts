import type { AssetQuery, AssetRoute } from '../types/assets';

export const assetPageSizes = [10, 20, 50, 100] as const;
export const isAssetId = (value: unknown): value is string => typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);

export function parseAssetRoute(pathname: string, search: string): AssetRoute | null {
  const match = /^\/assets(?:\/([^/]+)(?:\/(edit|condition))?)?\/?$/.exec(pathname);
  if (!match) return null;
  const params = new URLSearchParams(search);
  const pageText = params.get('page') || '0';
  const page = /^\d+$/.test(pageText) && Number.isSafeInteger(Number(pageText)) && Number(pageText) <= 2147483647 ? Number(pageText) : 0;
  const sizeText = params.get('size') || '20';
  const size = /^(10|20|50|100)$/.test(sizeText) ? Number(sizeText) : 20;
  return { assetId: match[1] || null, screen: match[2] === 'edit' ? 'edit' : match[2] === 'condition' ? 'condition' : match[1] ? 'detail' : 'list',
    q: (params.get('q') || '').trim(), page, size, create: !match[1] && params.get('create') === '1' };
}

export function assetUrl(query: AssetQuery, assetId: string | null = null, screen: AssetRoute['screen'] = 'detail', create = false): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  params.set('page', String(query.page)); params.set('size', String(query.size));
  if (create && !assetId) params.set('create', '1');
  const suffix = assetId ? '/' + encodeURIComponent(assetId) + (screen === 'edit' || screen === 'condition' ? '/' + screen : '') : '';
  return '/assets' + suffix + '?' + params.toString();
}

export function assetRouteKey(route: AssetRoute): string {
  return assetUrl(route, route.assetId, route.screen, route.create);
}
