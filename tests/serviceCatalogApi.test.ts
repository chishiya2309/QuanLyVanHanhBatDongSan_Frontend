import { describe, expect, it, vi } from 'vitest';
import { catalogMessages as m } from '../src/types/serviceCatalog';
import { createCatalogService, getCatalogService, listCatalogServices, updateCatalogService, changeCatalogServiceStatus } from '../src/services/serviceCatalogApi';
import { decodeCatalogService, encodeCatalogBody, parseCatalogJson } from '../src/services/serviceCatalogCodec';
import { catalogMoney, catalogVersion } from '../src/utils/serviceCatalogValidation';
import { parseCatalogRoute } from '../src/utils/serviceCatalogNavigation';
import { catalogReply, catalogWire, electricity, electricityId, internet, internetId } from './fixtures/serviceCatalog';
import { deferred, failure, ok } from './apiMock';

const fields = { name: ' Internet ', unit: ' tháng ', method: 'FIXED' as const, defaultPrice: '9007199254740993' };
function install(reply: () => Promise<Response>) {
  const csrf = vi.fn(async () => ok({ headerName: 'X-CSRF-TOKEN', token: 'uc19-token' }));
  const api = vi.fn(reply);
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => { void init; return String(input).endsWith('/auth/csrf') ? csrf() : api(); });
  vi.stubGlobal('fetch', fetch); return { csrf, api, fetch };
}
describe('UC19 lossless wire contract', () => {
  it.each(['0', '9007199254740993', '9999999999999999999'])('round trips price %s without rounding or quoting numbers', (price) => {
    const wire = `{"id":"${internetId}","systemCode":null,"name":"Internet","unit":"tháng","method":"FIXED","active":false,"pricingStatus":"CONFIGURED","defaultPrice":${price},"currentPriceRevisionId":"44444444-4444-4444-8444-444444444444","effectiveFrom":"2026-11-01T00:00:00Z","version":9007199254740993}`;
    const value = decodeCatalogService(parseCatalogJson(wire)); expect(value.defaultPrice).toBe(price); expect(value.version).toBe('9007199254740993');
    expect(encodeCatalogBody({ defaultPrice: price, version: value.version, active: false })).toBe(`{"defaultPrice":${price},"version":9007199254740993,"active":false}`);
  });
  it.each(['', '-1', '1.5', '1e3', '10000000000000000000'])('rejects input price %j', (price) => expect(catalogMoney(price)).toBeNull());
  it('validates Long versions independently of JS safe integer', () => {
    expect(catalogVersion('9223372036854775807')).toBe('9223372036854775807'); expect(catalogVersion('9223372036854775808')).toBeNull();
    expect(catalogVersion('0')).toBe('0'); expect(catalogVersion('0.0')).toBeNull();
  });
  it('keeps unconfigured values null and refuses missing/corrupted price history', () => {
    expect(decodeCatalogService(parseCatalogJson(JSON.stringify({ ...electricity, version: 0 })))).toEqual(electricity);
    for (const change of [{ active: true }, { systemCode: null }, { defaultPrice: 0 }, { effectiveFrom: undefined }, { method: 'OTHER' }, { active: 'false' }, { version: null }]) {
      expect(() => decodeCatalogService(parseCatalogJson(JSON.stringify({ ...electricity, version: 0, ...change })))).toThrow();
    }
    for (const change of [{ defaultPrice: null }, { currentPriceRevisionId: null }, { effectiveFrom: '2026-02-30T00:00:00Z' }, { effectiveFrom: '2026-11-01T24:00:00Z' }]) {
      expect(() => decodeCatalogService(parseCatalogJson(JSON.stringify({ ...internet, defaultPrice: 1, version: 0, ...change })))).toThrow();
    }
  });
  it('uses only allowed POST/PUT/PATCH fields and preserves no-op version', async () => {
    const api = install(async () => catalogReply(catalogWire({ ...internet, defaultPrice: fields.defaultPrice }), m.createSuccess, 201));
    await createCatalogService(fields);
    expect(api.fetch.mock.calls.at(-1)?.[1]?.body).toBe('{"name":"Internet","unit":"tháng","defaultPrice":9007199254740993,"method":"FIXED"}');
    expect(api.fetch.mock.calls.at(-1)?.[1]?.headers).toMatchObject({ 'X-CSRF-TOKEN': 'uc19-token' });
    api.api.mockImplementation(async () => catalogReply(catalogWire(internet), m.updateSuccess));
    expect((await updateCatalogService(internetId, fields, '9007199254740993')).version).toBe('7');
    const body = String(api.fetch.mock.calls.at(-1)?.[1]?.body); expect(body).toContain('"version":9007199254740993'); expect(body).not.toContain('method');
    api.api.mockImplementation(async () => catalogReply(catalogWire({ ...internet, active: false }), m.deactivateSuccess));
    await changeCatalogServiceStatus(internetId, false, '7'); expect(api.fetch.mock.calls.at(-1)?.[1]?.body).toBe('{"active":false,"version":7}');
  });
  it('lists without parameters/CSRF and rejects the wrong service or malformed list', async () => {
    const api = install(async () => catalogReply([catalogWire(electricity)], m.listSuccess));
    expect(await listCatalogServices()).toHaveLength(1); expect(api.csrf).not.toHaveBeenCalled(); expect(String(api.fetch.mock.calls[0][0])).toBe('/api/v1/services');
    api.api.mockImplementation(async () => catalogReply(catalogWire(electricity))); await expect(getCatalogService(internetId)).rejects.toMatchObject({ message: m.detailFailure });
    api.api.mockImplementation(async () => catalogReply(null, m.listSuccess)); await expect(listCatalogServices()).rejects.toMatchObject({ message: m.listFailure });
  });
  it.each([m.stale, m.statusConflict, m.priceRequired, m.priceConflict])('preserves distinct conflict %s without retry', async (message) => {
    const api = install(async () => failure(409, message, { active: 'false', version: 'internal SQL', unknown: 'secret' }));
    await expect(changeCatalogServiceStatus(internetId, false, '7')).rejects.toMatchObject({ message, currentActive: false, fieldErrors: { version: m.stale } }); expect(api.api).toHaveBeenCalledTimes(1);
  });
  it('does not send a mutation when navigation changes during CSRF', async () => {
    window.history.replaceState(null, '', '/services?action=create'); const gate = deferred<Response>(); const api = install(async () => catalogReply(catalogWire(internet), m.createSuccess, 201));
    api.csrf.mockReturnValueOnce(gate.promise); const pending = createCatalogService(fields); const result = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    window.history.replaceState(null, '', '/'); gate.resolve(ok({ headerName: 'X-CSRF-TOKEN', token: 'late' })); await result; expect(api.api).not.toHaveBeenCalled();
  });
  it('marks lost/malformed successful mutation results uncertain and does not retry', async () => {
    const api = install(async () => { throw new TypeError('network lost'); });
    await expect(createCatalogService(fields)).rejects.toMatchObject({ phase: 'uncertain', message: m.uncertain }); expect(api.api).toHaveBeenCalledTimes(1);
    api.api.mockImplementation(async () => catalogReply({}, m.createSuccess, 201)); await expect(createCatalogService(fields)).rejects.toMatchObject({ phase: 'uncertain' });
  });
});
describe('UC19 route parser', () => {
  it.each(['action=edit', 'action=edit&serviceId=bad', 'action=delete', 'action=create&serviceId=' + electricityId, 'action=create&action=edit', 'state=other', 'q=a&q=b'])('rejects malformed query %s', (query) => {
    const route = parseCatalogRoute('/services', '?' + query); expect(route?.invalid).toBe(true); expect(route?.action).toBeNull();
  });
  it('recognizes valid targets and default filters', () => expect(parseCatalogRoute('/services', '?action=edit&serviceId=' + electricityId)).toMatchObject({ action: 'edit', serviceId: electricityId, state: 'all', invalid: false }));
});
