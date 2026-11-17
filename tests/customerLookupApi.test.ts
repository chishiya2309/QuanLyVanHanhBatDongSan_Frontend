import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticatedFetch } from '../src/services/sessionClient';
import { decodeLookupPage, decodeRentalHistory, getRentalHistory, LookupApiError, searchCustomers } from '../src/services/customerLookupApi';
import { parseCustomerRoute } from '../src/utils/customerNavigation';
import { lookupUrl, parseLookupRoute } from '../src/utils/customerLookupNavigation';
vi.mock('../src/services/sessionClient', () => ({ authenticatedFetch: vi.fn() }));
const id = '11111111-1111-4111-8111-111111111111';
const route = parseLookupRoute('/customers/search', '?mode=CURRENT&q=An&page=2&size=10')!;
const empty = { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true, requestedPage: 2, pageReset: true };
describe('UC22 API and navigation', () => {
  beforeEach(() => vi.resetAllMocks());
  it('resolves static lookup before customer ID and supports history directly', () => {
    expect(parseCustomerRoute('/customers/search', '')?.view).toBe('lookup');
    expect(parseCustomerRoute(`/customers/${id}/rental-history`, '')?.lookup?.customerId).toBe(id);
    expect(parseCustomerRoute(`/customers/${id}`, '')?.view).toBe('detail');
  });
  it.each(['?page=-1', '?page=no', '?size=101', '?mode=OTHER', '?roomId=invalid', '?q=' + 'a'.repeat(201)])('rejects invalid URL %s without silently dropping criteria', search => {
    expect(parseLookupRoute('/customers/search', search)?.invalid).toBe(true);
  });
  it.each(['https://example.test', '//example.test', '/customers/searching', '/customers/search?page=no'])('rejects unsafe or invalid return context %s', back => {
    expect(parseLookupRoute(`/customers/${id}/rental-history`, '?returnTo=' + encodeURIComponent(back))?.returnTo).toBe('/customers/search');
  });
  it('restores validated list criteria and allows incomplete identity keywords', () => {
    const back = lookupUrl(route);
    expect(parseLookupRoute(`/customers/${id}/rental-history`, '?returnTo=' + encodeURIComponent(back))?.returnTo).toBe(back);
    expect(route.invalid).toBe(false);
  });
  it('normalizes valid UUID casing for direct history and room selections', () => {
    const upper = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
    expect(parseLookupRoute(`/customers/${upper}/rental-history`, '')?.customerId).toBe(upper.toLowerCase());
    expect(parseLookupRoute('/customers/search', '?roomId=' + upper)?.roomId).toBe(upper.toLowerCase());
  });
  it('uses UC22 GET with credentials and no CSRF and accepts reset metadata', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(JSON.stringify({ status: 200, message: 'OK', data: empty })));
    expect((await searchCustomers(route, new AbortController().signal)).pageReset).toBe(true);
    const [url, init] = vi.mocked(authenticatedFetch).mock.calls[0];
    expect(String(url)).toContain('/customers/search?');
    expect(String(url)).toContain('mode=CURRENT');
    expect(init).toMatchObject({ method: 'GET', credentials: 'include', cache: 'no-store' });
    expect(vi.mocked(authenticatedFetch)).toHaveBeenCalledTimes(1);
  });
  it.each([400, 401, 403, 404, 500])('preserves HTTP failure %i instead of inventing empty data', async status => {
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(JSON.stringify({ status, message: 'error', fieldErrors: { q: 'Invalid' }, code: 'RENTAL_DATA_INCONSISTENT' }), { status }));
    await expect(searchCustomers(route, new AbortController().signal)).rejects.toMatchObject({ status, fields: { q: 'Invalid' } });
  });
  it('rejects broken JSON, wrong requested page and mismatched history identity', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(new Response('broken'));
    await expect(searchCustomers(route, new AbortController().signal)).rejects.toBeInstanceOf(LookupApiError);
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(new Response(JSON.stringify({ status: 200, message: 'OK', data: { ...empty, requestedPage: 1 } })));
    await expect(searchCustomers(route, new AbortController().signal)).rejects.toBeInstanceOf(LookupApiError);
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(new Response(JSON.stringify({ status: 200, message: 'OK', data: { customerId: '22222222-2222-4222-8222-222222222222', items: [] } })));
    await expect(getRentalHistory(id, new AbortController().signal)).rejects.toBeInstanceOf(LookupApiError);
  });
  it('distinguishes valid empty history from malformed payload and invalid count', () => {
    expect(decodeRentalHistory({ customerId: id, items: [] }).items).toEqual([]);
    expect(() => decodeRentalHistory({ customerId: id })).toThrow();
    expect(() => decodeLookupPage({ ...empty, totalElements: 5 })).toThrow();
    expect(() => decodeLookupPage({ ...empty, totalElements: '0' })).toThrow();
  });
});
