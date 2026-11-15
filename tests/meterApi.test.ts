import { describe, expect, it, vi } from 'vitest';
import { parse } from 'lossless-json';
import { createMeterBatch, createMeterReading, correctMeterReading, getAllMeterItems, getBillingPeriods, getMeterItems, getMeterProgress } from '../src/services/meterApi';
import { decodeMeterBatch, decodeMeterItem, encodeMeterBatch, encodeMeterCorrect, encodeMeterCreate, parseMeterJson } from '../src/services/meterCodec';
import { compareMeterDecimal, meterDecimal } from '../src/utils/meterDecimal';
import { meterScope, meterUrl, parseMeterRoute } from '../src/utils/meterNavigation';
import { invalidateSession } from '../src/services/sessionClient';
import { fixtureRoute, initialItem, inheritedItem, meterFixtureFetch, meterId, meterReply, periodA, savedItem, version, wireMeter } from './fixtures/meterReadings';
import { stringify } from 'lossless-json';
const request = { periodId: periodA, roomServiceId: initialItem.roomServiceId, startIndex: '0', endIndex: '120.12345678901234567890123456789', version };
describe('UC37 exact numeric and routing contract', () => {
  it('encodes exact decimals as numeric JSON and keeps the opaque version', () => {
    const encoded = encodeMeterCreate(request);
    expect(encoded).toContain('"endIndex":120.12345678901234567890123456789');
    expect(encoded).toContain('"startIndex":0');
    expect(encoded).toContain('"version":"' + version + '"');
    const item = decodeMeterItem(parseMeterJson(stringify(wireMeter({ ...savedItem, endIndex: request.endIndex, consumption: request.endIndex }))!));
    expect(item.endIndex).toBe(request.endIndex);
  });
  it('PATCH has only endIndex and version; inherited creates omit startIndex', () => {
    expect(Object.keys(parse(encodeMeterCorrect({ endIndex: '0', version })) as object)).toEqual(['endIndex', 'version']);
    const created = { ...request }; delete (created as Partial<typeof created>).startIndex;
    expect(encodeMeterCreate(created)).not.toContain('startIndex');
  });
  it.each(['', '-1', 'NaN', 'Infinity', '1,5', 'abc'])('rejects invalid decimal %j', (v) => {
    expect(meterDecimal(v)).toBeNull(); expect(() => encodeMeterCreate({ ...request, endIndex: v })).toThrow();
  });
  it('compares zero, long decimals and huge exponents without rounding or exponent expansion', () => {
    expect(compareMeterDecimal('0.00', '0e999999')).toBe(0);
    expect(compareMeterDecimal('1.00000000000000000001', '1.00000000000000000000')).toBe(1);
    expect(compareMeterDecimal('1e999999999999999999', '9e999999999999999998')).toBe(1);
    expect(compareMeterDecimal('.5', '0.50')).toBe(0);
    expect(meterDecimal('00012.50')).toBe('12.50');
    expect(() => encodeMeterCreate({ ...request, startIndex: '1', endIndex: '0' })).toThrow();
  });
  it('keeps period selections, view and pagination in URL, rejects invalid scope', () => {
    expect(parseMeterRoute('/meter-readings', new URL(meterUrl({ ...fixtureRoute, view: 'batch', page: 3, periodPage: 1 }), 'http://local').search)).toEqual({ ...fixtureRoute, view: 'batch', page: 3, periodPage: 1 });
    expect(parseMeterRoute('/meter-readings/' + savedItem.readingId, '')?.readingId).toBe(savedItem.readingId);
    expect(parseMeterRoute('/meter-readings', '?periodIds=bad')?.invalid).toBe(true);
    expect(parseMeterRoute('/meter-readings', '?fromDate=2026-02-30')?.invalid).toBe(true);
    expect(parseMeterRoute('/meter-readings', '?page=1&page=2')?.invalid).toBe(true);
    expect(parseMeterRoute('/other', '')).toBeNull();
  });
  it('rejects string numeric response and wrong batch correlation rather than claiming success', () => {
    expect(() => decodeMeterItem(savedItem)).toThrow();
    expect(() => decodeMeterBatch({ outcome: 'ALL_SAVED', saved: 1, failed: 0, results: [{ index: 0, periodId: meterId(99), roomServiceId: request.roomServiceId }] }, [request])).toThrow();
    expect(() => encodeMeterBatch([])).toThrow();
    expect(encodeMeterBatch([request, request])).toContain('items');
  });
});
describe('UC37 HTTP client', () => {
  it('uses credentialed no-store reads and unpaginated full-scope progress', async () => {
    const fixture = meterFixtureFetch(), fetch = vi.fn(fixture.fetcher); vi.stubGlobal('fetch', fetch);
    await getBillingPeriods(fixtureRoute.fromDate, fixtureRoute.toDate, {}, 0);
    await getMeterItems(meterScope(fixtureRoute)); await getMeterProgress(meterScope(fixtureRoute));
    for (const [, init] of fetch.mock.calls) expect(init).toMatchObject({ credentials: 'include', cache: 'no-store' });
    const progress = fetch.mock.calls.find(([url]) => String(url).includes('/progress'))!;
    const url = new URL(String(progress[0]), 'http://local');
    expect(url.searchParams.has('page')).toBe(false); expect(url.searchParams.get('periodIds')).toBe(fixtureRoute.periodIds.join(','));
  });
  it('sends CSRF and the room-service config identity; never converts a missing PATCH to POST', async () => {
    const fixture = meterFixtureFetch(), fetch = vi.fn(fixture.fetcher); vi.stubGlobal('fetch', fetch);
    await createMeterReading(request);
    const write = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(write[1]?.headers).toMatchObject({ 'X-CSRF-TOKEN': 'fixture-uc37' });
    expect(String(write[1]?.body)).toContain(request.endIndex);
    await expect(correctMeterReading(meterId(70), { endIndex: '20', version })).rejects.toThrow();
    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });
  it('handles partial batch outcome on HTTP 200', async () => {
    vi.stubGlobal('fetch', meterFixtureFetch({ mode: 'partial' }).fetcher);
    const result = await createMeterBatch([request, { periodId: inheritedItem.periodId, roomServiceId: inheritedItem.roomServiceId, endIndex: '120', version }]);
    expect(result.outcome).toBe('PARTIALLY_SAVED'); expect(result.results.map((r) => r.state)).toEqual(['SAVED', 'FAILED']);
  });
  it('reconciles across all item pages and rejects a changing page total', async () => {
    const items = Array.from({ length: 101 }, (_, index) => ({ ...inheritedItem, requirementId: meterId(1000 + index), roomServiceId: meterId(2000 + index) }));
    const fetch = vi.fn(async (input) => {
      const url = new URL(String(input), 'http://local'), page = Number(url.searchParams.get('page'));
      return meterReply({ items: items.slice(page * 100, (page + 1) * 100), total: items.length, page, size: 100 });
    });
    vi.stubGlobal('fetch', fetch);
    expect(await getAllMeterItems(meterScope(fixtureRoute))).toHaveLength(101); expect(fetch).toHaveBeenCalledTimes(2);
    fetch.mockImplementation(async (input) => { const url = new URL(String(input), 'http://local'), page = Number(url.searchParams.get('page')); return meterReply({ items: items.slice(page * 100, (page + 1) * 100), total: page ? 102 : 101, page, size: 100 }); });
    await expect(getAllMeterItems(meterScope(fixtureRoute))).rejects.toMatchObject({ status: 409 });
  });
  it('rejects response data belonging to a different scope and missing updates remain 404', async () => {
    vi.stubGlobal('fetch', async (url) => String(url).includes('/csrf') ? meterReply({ headerName: 'X-CSRF-TOKEN', token: 'csrf' }) : String(url).includes('/items') ? meterReply({ items: [wireMeter({ ...inheritedItem, periodId: meterId(77) })], total: 1, page: 0, size: 20 }) : meterReply(null, 404));
    await expect(getMeterItems(meterScope(fixtureRoute))).rejects.toMatchObject({ phase: 'read' });
    await expect(correctMeterReading(meterId(70), { endIndex: '20', version })).rejects.toMatchObject({ status: 404, phase: 'write' });
  });
  it('does not send after session invalidation during CSRF acquisition', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { invalidateSession(); return meterReply({ headerName: 'X-CSRF-TOKEN', token: 'csrf' }); }));
    await expect(createMeterReading(request)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('classifies a lost response or malformed successful body as uncertain, with no automatic write retry', async () => {
    const fetch = vi.fn(meterFixtureFetch({ mode: 'lost-response' }).fetcher); vi.stubGlobal('fetch', fetch);
    await expect(createMeterReading(request)).rejects.toMatchObject({ phase: 'uncertain' });
    expect(fetch.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(1);
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).includes('/csrf') ? meterReply({ headerName: 'X-CSRF-TOKEN', token: 'csrf' }) : new Response('{"status":201,"message":"ok","data":{}}', { status: 201 })));
    await expect(createMeterReading(request)).rejects.toMatchObject({ phase: 'uncertain' });
  });
});
