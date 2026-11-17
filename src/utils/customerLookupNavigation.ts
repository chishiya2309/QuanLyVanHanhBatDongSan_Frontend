import type { LookupRoute } from '../types/customerLookup';
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export function lookupUrl(route: Pick<LookupRoute, 'q' | 'roomId' | 'mode' | 'page' | 'size'>): string {
  const p = new URLSearchParams();
  if (route.q) p.set('q', route.q.trim());
  if (route.roomId) p.set('roomId', route.roomId);
  if (route.mode !== 'ALL') p.set('mode', route.mode);
  if (route.page) p.set('page', String(route.page));
  if (route.size !== 20) p.set('size', String(route.size));
  return '/customers/search' + (p.size ? '?' + p : '');
}
export function parseLookupRoute(path: string, search: string): LookupRoute | null {
  const history = /^\/customers\/([^/]+)\/rental-history\/?$/.exec(path);
  if (path !== '/customers/search' && path !== '/customers/search/' && !history) return null;
  const p = new URLSearchParams(search);
  const rawPage = p.get('page') ?? '0', rawSize = p.get('size') ?? '20';
  const page = Number(rawPage), size = Number(rawSize), mode = p.get('mode') ?? 'ALL';
  const q = (p.get('q') ?? '').trim(), roomId = (p.get('roomId') ?? '').toLowerCase();
  const invalid = !/^\d+$/.test(rawPage) || !Number.isSafeInteger(page) || page > 2147483647
    || !/^\d+$/.test(rawSize) || size < 1 || size > 100 || q.length > 200
    || !['ALL', 'CURRENT'].includes(mode) || Boolean(roomId && !uuid.test(roomId))
    || Boolean(history && !uuid.test(history[1]));
  const back = p.get('returnTo') ?? '';
  let returnTo = '/customers/search';
  if (history && /^\/customers\/search(?:\?|$)/.test(back) && !back.includes('#')) {
    const index = back.indexOf('?');
    const parsed = parseLookupRoute(index < 0 ? back : back.slice(0, index), index < 0 ? '' : back.slice(index));
    if (parsed && !parsed.invalid) returnTo = lookupUrl(parsed);
  }
  return { view: history ? 'history' : 'lookup', customerId: history?.[1].toLowerCase() ?? null, q, roomId,
    mode: mode === 'CURRENT' ? 'CURRENT' : 'ALL', page, size, invalid, returnTo };
}
export function rentalHistoryUrl(id: string, route: LookupRoute): string {
  return `/customers/${encodeURIComponent(id)}/rental-history?` + new URLSearchParams({ returnTo: lookupUrl(route) });
}
