import { describe, expect, it, vi } from 'vitest';
import { stringify } from 'lossless-json';
import { decodeChargeItem, decodeProvisionalDetail, decodeProvisionalHeader, parseProvisionalJson } from '../src/services/provisionalChargeCodec';
import { getProvisionalDetail, getProvisionalPeriods } from '../src/services/provisionalChargeApi';
import { formatPeriodRange, formatProvisionalVnd } from '../src/utils/provisionalChargeFormat';
import { parseProvisionalRoute, provisionalUrl, sortProvisionalPeriods } from '../src/utils/provisionalChargeNavigation';
import { invalidateSession } from '../src/services/sessionClient';
import { pcDetail, pcFixture, pcHeader, pcHeaders, pcMeter, pcReply, pcRoute, pcToken, pcWire } from './fixtures/provisionalCharges';

const decoded = (value: unknown) => parseProvisionalJson(stringify(pcWire(value))!);
describe('UC39 lossless contract and navigation', () => {
  it('preserves Long values and fractional indices without rounding', () => {
    const detail = decodeProvisionalDetail(decoded(pcDetail(pcHeader, 'long')), pcRoute);
    expect(detail.items[0].amount).toBe('9007199254740993');
    expect(detail.items[1].endIndex).toBe('120.123456789012345678901');
    expect(formatProvisionalVnd(detail.items[0].amount)).toContain('9.007.199.254.740.993');
    expect(formatProvisionalVnd(null)).toBe('Chưa tính được');
    expect(formatProvisionalVnd('0')).toContain('0');
    expect(formatProvisionalVnd('-20000')).toContain('-20.000');
  });
  it.each(['full', 'partial', 'insufficient', 'empty'])('accepts coherent %s states and nullable inputs', state => {
    const expected = pcDetail(pcHeader, state), actual = decodeProvisionalDetail(decoded(expected), pcRoute);
    expect(actual).toEqual(expected);
  });
  it.each([
    { status: 'UNKNOWN' }, { status: 'CALCULATED', amount: null }, { status: 'MISSING_DATA' },
    { missingReason: 'unexpected' }, { amount: '-1' }, { amount: '9223372036854775808' },
    { unitPrice: '-1' }, { quantity: '-0.1' }, { basisDate: '2026-02-30' },
    { serviceId: 'bad' }, { chargeMethod: 'HISTORICAL' }, { pricingSource: 'DEFAULT' },
  ])('rejects invalid item contract %j', patch => {
    expect(() => decodeChargeItem(decoded({ ...pcMeter, ...patch }))).toThrow();
  });
  it('rejects nonnumeric JSON money, contradictory summary, duplicate items and mismatched context', () => {
    expect(() => decodeChargeItem(pcMeter)).toThrow();
    const detail = pcDetail();
    expect(() => decodeProvisionalDetail(decoded({ ...detail, summary: { ...detail.summary, calculatedItemsCount: 0 } }), pcRoute)).toThrow();
    expect(() => decodeProvisionalDetail(decoded({ ...detail, items: [pcMeter, pcMeter] }), pcRoute)).toThrow();
    expect(() => decodeProvisionalDetail(decoded(detail), { ...pcRoute, roomId: pcHeaders[0].roomId })).toThrow();
    expect(() => decodeProvisionalHeader({ ...pcHeader, invoiceStatus: 'ISSUED' })).toThrow();
  });
  it('sorts a copy ascending and keeps local dates independent of timezone', () => {
    const old = [...pcHeaders]; expect(sortProvisionalPeriods(pcHeaders).map(h => h.fromDate)).toEqual(['2026-09-21', '2026-10-21', '2026-11-03']);
    expect(pcHeaders).toEqual(old); expect(formatPeriodRange('2026-11-01', '2026-12-01')).toBe('01/11/2026 – trước 01/12/2026');
  });
  it('parses role-specific deep links without guessing missing context', () => {
    expect(parseProvisionalRoute('/provisional-charges', new URL(provisionalUrl(pcRoute), location.origin).search)).toEqual(pcRoute);
    expect(parseProvisionalRoute('/portal/provisional-charges', '')?.role).toBe('CUSTOMER');
    for (const q of ['?roomId=bad', '?periodId=' + pcRoute.periodId, '?roomId=a&roomId=b', '?periodId=nope']) expect(parseProvisionalRoute('/provisional-charges', q)?.invalid).toBe(true);
    expect(parseProvisionalRoute('/provisional-charges', '')?.roomId).toBe('');
    expect(parseProvisionalRoute('/other', '')).toBeNull();
  });
});
describe('UC39 read-only HTTP / conditional GET', () => {
  it.each(['HOST', 'CUSTOMER'] as const)('uses only credentialed GETs for %s and no client scope query', async role => {
    const f = pcFixture(); vi.stubGlobal('fetch', f.fetcher);
    await getProvisionalPeriods(role); const result = await getProvisionalDetail(role, pcRoute.roomId, pcRoute.periodId);
    expect(result.kind).toBe('data'); expect(f.calls.every(c => c.method === 'GET' && c.path.includes('/' + role.toLowerCase() + '/periods'))).toBe(true);
    expect(f.calls).toHaveLength(2);
  });
  it('reads ETag exactly and returns 304 before parsing an absent body', async () => {
    const f = pcFixture(); const fetch = vi.fn(f.fetcher); vi.stubGlobal('fetch', fetch);
    await getProvisionalDetail('HOST', pcRoute.roomId, pcRoute.periodId);
    const response = await getProvisionalDetail('HOST', pcRoute.roomId, pcRoute.periodId, undefined, '"' + pcToken + '"');
    expect(response).toEqual({ kind: 'not-modified', etag: '"' + pcToken + '"' });
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } });
    expect(f.calls[1].etag).toBe('"' + pcToken + '"');
  });
  it('quotes body token fallback and prefers an opaque header ETag', async () => {
    vi.stubGlobal('fetch', async () => pcReply(pcDetail()));
    expect(await getProvisionalDetail('HOST', pcRoute.roomId, pcRoute.periodId)).toMatchObject({ etag: '"' + pcToken + '"' });
    vi.stubGlobal('fetch', async () => pcReply(pcDetail(), 200, undefined, 'W/"opaque"'));
    expect(await getProvisionalDetail('HOST', pcRoute.roomId, pcRoute.periodId)).toMatchObject({ etag: 'W/"opaque"' });
  });
  it.each([[403, 'ACCESS_DENIED'], [403, 'TENANCY_TERMINATED_OR_MOVED'], [404, 'PERIOD_NOT_FOUND'], [409, 'PERIOD_SEALED_OR_INVOICE_ISSUED'], [409, 'CONTEXT_STALE_CONCURRENCY_CONFLICT'], [422, 'CALCULATION_OR_SOURCE_DATA_INVALID'], [500, 'RELOAD_FAILED_KEEPING_STALE']] as const)('uses body.code for %s %s rather than the HTTP error label', async (status, code) => {
    vi.stubGlobal('fetch', async () => pcReply(null, status, code));
    await expect(getProvisionalDetail('HOST', pcRoute.roomId, pcRoute.periodId)).rejects.toMatchObject({ status, code });
  });
  it('distinguishes malformed response from a valid response linked to a different room', async () => {
    vi.stubGlobal('fetch', async () => new Response('broken', { status: 200 }));
    await expect(getProvisionalPeriods('HOST')).rejects.toMatchObject({ status: 200 });
    vi.stubGlobal('fetch', async () => pcReply(pcDetail(pcHeaders[0])));
    await expect(getProvisionalDetail('HOST', pcRoute.roomId, pcRoute.periodId)).rejects.toMatchObject({ code: 'INVALID_CONTEXT_LINK' });
  });
  it('ignores late bodies when the shared session epoch changes', async () => {
    vi.stubGlobal('fetch', async () => { invalidateSession(); return pcReply(pcDetail()); });
    await expect(getProvisionalDetail('HOST', pcRoute.roomId, pcRoute.periodId)).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('rejects missing/invalid service context before issuing any request', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(getProvisionalDetail('HOST', '', pcRoute.periodId)).rejects.toMatchObject({ status: 400, code: 'MISSING_CONTEXT_FIELDS' });
    await expect(getProvisionalDetail('HOST', pcRoute.roomId, 'bad')).rejects.toMatchObject({ status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('canonicalizes valid uppercase UUID route values', () => {
    const roomId = 'ABCDEFAB-1234-4ABC-8ABC-ABCDEFABCDEF';
    expect(parseProvisionalRoute('/provisional-charges', '?roomId=' + roomId)?.roomId).toBe(roomId.toLowerCase());
  });
  it('keeps the minimum signed Long total and refuses source identity mismatches', () => {
    const detail = pcDetail(pcHeader, 'partial'); detail.summary.totalAmount = '-9223372036854775808';
    expect(decodeProvisionalDetail(decoded(detail), pcRoute).summary.totalAmount).toBe('-9223372036854775808');
    expect(() => decodeChargeItem(decoded({ ...pcMeter, itemCode: pcHeader.periodId }))).toThrow();
  });
});
