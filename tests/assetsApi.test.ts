import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetApiError, createAsset, getAsset, listAssets, recordAssetCondition, updateAsset } from '../src/services/assetsApi';
import { decodeAsset, decodeAssetPage, parseAssetJson } from '../src/services/assetCodec';
import { assetMessages as m } from '../src/types/assets';
import { assetRouteKey, assetUrl, parseAssetRoute } from '../src/utils/assetNavigation';
import { formatAssetMoney, normalizeMoney, validateAssetFields } from '../src/utils/assetValidation';
import { assetFixture, assetId, assetPageReply, assetReply, assetWire, secondAssetId } from './fixtures/assets';
import { failure, ok } from './apiMock';

function install() {
  const csrf = vi.fn(async (): Promise<Response> => ok({ token: 'fresh-token', headerName: 'X-CSRF-TOKEN' }));
  const read = vi.fn(async (): Promise<Response> => assetReply(assetWire(assetFixture)));
  const write = vi.fn(async (url: string, init: RequestInit): Promise<Response> => {
    if (url.endsWith('/condition-records')) return assetReply({ recordId: secondAssetId, assetId, condition: 'GOOD', recordedAt: assetFixture.updatedAt, recordedByAccountId: secondAssetId, note: 'Kiểm tra' }, m.conditionSuccess, 201);
    return assetReply(assetWire(assetFixture), init.method === 'PUT' ? m.updateSuccess : m.createSuccess, init.method === 'PUT' ? 200 : 201);
  });
  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = String(input);
    if (url.endsWith('/auth/me') || url.endsWith('/auth/refresh')) return failure(401, 'expired');
    if (url.endsWith('/auth/csrf')) return csrf();
    return init.method === 'POST' || init.method === 'PUT' ? write(url, init) : read();
  }); vi.stubGlobal('fetch', fetch); return { csrf, read, write, fetch };
}
beforeEach(() => window.history.replaceState(null, '', '/'));
describe('UC17 exact codec and validation', () => {
  it.each(['0', '9007199254740993', '9999999999999999999'])('preserves numeric token %s across read, display, write', async (money) => {
    const api = install();
    api.read.mockResolvedValueOnce(assetReply(assetWire({ ...assetFixture, purchaseValue: money })));
    const asset = await getAsset(assetId); expect(asset.purchaseValue).toBe(money);
    expect(formatAssetMoney(money).replace(/\D/g, '')).toBe(money);
    await updateAsset(assetId, { name: asset.name, purchaseValue: asset.purchaseValue, note: asset.note });
    const body = String(api.write.mock.calls[0][1].body);
    expect(body).toContain('"purchaseValue":' + money); expect(body).not.toContain('"purchaseValue":"');
  });
  it.each(['', ' ', '-1', '1.5', '1,000', '1e3', '10000000000000000000', 'NaN', '+1', '₫100'])('rejects invalid money %j', (value) => expect(normalizeMoney(value)).toBeNull());
  it('accepts zero and leading zeroes; trims only on validation', () => {
    expect(normalizeMoney(' 000000000000000000000000001 ')).toBe('1');
    expect(validateAssetFields(' ', '0')).toEqual({ name: m.nameRequired });
    expect(validateAssetFields('a'.repeat(256), '0', 'b'.repeat(2001))).toEqual({ name: m.nameLong, note: m.noteLong });
    expect(validateAssetFields('Máy', '0', ' ')).toEqual({});
  });
  it.each([
    { ...assetFixture, purchaseValue: '9007199254740993' }, { ...assetFixture, purchaseValue: -1 },
    { ...assetFixture, purchaseValue: 1.5 }, { ...assetFixture, assetId: 'bad' },
    { ...assetFixture, condition: 'DELETED' }, { ...assetFixture, createdAt: 'not-a-date' },
    { ...assetFixture, createdAt: '2026-02-31T00:00:00Z' }, { ...assetFixture, updatedAt: '2026-11-01T24:00:00Z' },
  ])('validates unknown DTO %j', (value) => expect(() => decodeAsset(parseAssetJson(JSON.stringify(value)))).toThrow());
  it('does not treat incomplete or inconsistent metadata as an empty page', () => {
    expect(() => decodeAssetPage({ content: [] })).toThrow();
    expect(() => decodeAssetPage(parseAssetJson('{"content":[],"page":0,"size":20,"totalElements":1,"totalPages":0,"first":true,"last":true}'))).toThrow();
  });
});
describe('UC17 API boundary', () => {
  it('uses server query, credentials, signal and no-store; keeps backend order', async () => {
    const api = install(); const signal = new AbortController().signal;
    const query = { q: 'Máy %_!', page: 0, size: 10 };
    api.read.mockResolvedValueOnce(assetPageReply(query, [{ ...assetFixture, assetId: secondAssetId }, assetFixture]));
    const data = await listAssets(query, signal); expect(data.content.map((asset) => asset.assetId)).toEqual([secondAssetId, assetId]);
    const [url, init] = api.fetch.mock.calls[0];
    expect(new URL(String(url), 'http://localhost').searchParams.get('q')).toBe(query.q);
    expect(init).toMatchObject({ credentials: 'include', cache: 'no-store', signal, headers: { Accept: 'application/json' } });
    expect(api.csrf).not.toHaveBeenCalled();
  });
  it('fresh CSRF, exactly allowed fields and endpoint for each write', async () => {
    const api = install();
    await createAsset({ name: 'Máy', purchaseValue: '0' });
    await updateAsset(assetId, { name: 'Máy', purchaseValue: '9007199254740993', note: null });
    await recordAssetCondition(assetId, { condition: 'GOOD', note: 'Kiểm tra' });
    expect(api.csrf).toHaveBeenCalledTimes(3); expect(api.write.mock.calls.map(([url]) => url)).toEqual(['/api/v1/assets', '/api/v1/assets/' + assetId, '/api/v1/assets/' + assetId + '/condition-records']);
    expect(api.write.mock.calls.map(([, init]) => init.method)).toEqual(['POST', 'PUT', 'POST']);
    expect(api.write.mock.calls.map(([, init]) => Object.keys(JSON.parse(String(init.body))))).toEqual([['name', 'purchaseValue'], ['name', 'purchaseValue', 'note'], ['condition', 'note']]);
    for (const [, init] of api.fetch.mock.calls.filter(([url]) => !String(url).endsWith('/auth/csrf'))) expect(init).toMatchObject({ credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'fresh-token' } });
  });
  it.each([null, {}, { status: 200, message: m.listSuccess }, { status: 200, message: m.listSuccess, data: {} }])('rejects malformed response %j', async (body) => {
    const api = install(); api.read.mockResolvedValueOnce(new Response(JSON.stringify(body)));
    await expect(listAssets({ q: '', page: 0, size: 20 })).rejects.toMatchObject({ message: m.listFailure });
  });
  it('rejects response for a different UUID and queries before sending invalid request', async () => {
    const api = install(); api.read.mockResolvedValueOnce(assetReply(assetWire({ ...assetFixture, assetId: secondAssetId })));
    await expect(getAsset(assetId)).rejects.toBeInstanceOf(AssetApiError);
    api.fetch.mockClear(); await expect(getAsset('bad')).rejects.toMatchObject({ status: 404 });
    await expect(listAssets({ q: 'a'.repeat(201), page: 0, size: 20 })).rejects.toMatchObject({ status: 400 }); expect(api.fetch).not.toHaveBeenCalled();
  });
  it.each([[401, 'SQL stack', m.sessionInvalid], [403, 'SQL', m.forbidden], [403, m.csrfInvalid, m.csrfInvalid], [404, 'foreign', m.notFound], [400, m.nameRequired, m.nameRequired], [500, 'SQL', m.saveFailure]])('maps safe errors %s %s', async (status, message, expected) => {
    const api = install(); api.write.mockResolvedValueOnce(failure(Number(status), String(message), { name: m.nameRequired, owner: 'secret', note: 'SQL stack' }));
    await expect(createAsset({ name: 'Máy', purchaseValue: '0' })).rejects.toMatchObject({ message: expected, fieldErrors: status === 401 ? {} : { name: m.nameRequired } });
    expect(api.write).toHaveBeenCalledTimes(1);
  });
  it('distinguishes CSRF failure before sending from uncertain network outcome', async () => {
    const api = install(); api.csrf.mockRejectedValueOnce(new TypeError('Offline'));
    await expect(createAsset({ name: 'Máy', purchaseValue: '0' })).rejects.toMatchObject({ phase: 'csrf', message: m.csrfFailure }); expect(api.write).not.toHaveBeenCalled();
    api.write.mockRejectedValueOnce(new TypeError('Lost response'));
    await expect(createAsset({ name: 'Máy', purchaseValue: '0' })).rejects.toMatchObject({ phase: 'uncertain', message: m.uncertain }); expect(api.write).toHaveBeenCalledTimes(1);
  });
  it('prevents writes after navigation during CSRF; rejects invalid headers', async () => {
    const api = install(); await expect(createAsset({ name: 'Máy', purchaseValue: '0' }, () => false)).rejects.toMatchObject({ name: 'AbortError' });
    api.csrf.mockResolvedValueOnce(ok({ token: 'secret', headerName: 'Content-Type' }));
    await expect(createAsset({ name: 'Máy', purchaseValue: '0' })).rejects.toMatchObject({ phase: 'csrf' }); expect(api.write).not.toHaveBeenCalled();
  });
  it('treats malformed mutation success as unknown and never automatically retries', async () => {
    const api = install(); api.write.mockResolvedValueOnce(new Response('{"status":201,"message":"Thêm tài sản thành công"}', { status: 201 }));
    await expect(createAsset({ name: 'Máy', purchaseValue: '0' })).rejects.toMatchObject({ phase: 'uncertain', message: m.uncertain }); expect(api.write).toHaveBeenCalledTimes(1);
  });
  it.each([200, 202])('does not announce success for unexpected create status %s', async (status) => {
    const api = install(); api.write.mockResolvedValueOnce(assetReply(assetWire(assetFixture), m.createSuccess, status));
    await expect(createAsset({ name: 'Máy', purchaseValue: '0' })).rejects.toMatchObject({ phase: 'uncertain' }); expect(api.write).toHaveBeenCalledTimes(1);
  });
});
describe('UC17 URL state', () => {
  it.each(['?page=-1&size=17', '?page=x&size=abc', '?page=1e3&size=050', '?page=999999999999999999999&size=0'])('normalizes %s', (search) => {
    const route = parseAssetRoute('/assets', search); expect(route).toMatchObject({ page: 0, size: 20 });
    expect(route && assetRouteKey(route)).toBe('/assets?page=0&size=20');
  });
  it('preserves unicode and literal search context through all pages', () => {
    const query = { q: 'Máy %_!', page: 3, size: 50 };
    for (const screen of ['detail', 'edit', 'condition'] as const) expect(parseAssetRoute('/assets/' + assetId + (screen === 'detail' ? '' : '/' + screen), new URL(assetUrl(query, assetId, screen), 'http://local').search)).toMatchObject({ ...query, assetId, screen });
    expect(parseAssetRoute('/assets', '?q=+++&create=1')).toMatchObject({ q: '', create: true });
  });
});
