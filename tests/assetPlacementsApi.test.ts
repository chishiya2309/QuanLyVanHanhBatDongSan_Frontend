import { beforeEach, describe, expect, it } from 'vitest';
import { assignAssetPlacement, transferAsset, getAssetHistory, listAssetPlacementRooms, getAsset } from '../src/services/assetsApi';
import { decodeAssetHistory, decodeAssetPlacement, parseAssetJson } from '../src/services/assetCodec';
import { assetPlacementUrl, assetRouteKey, parseAssetRoute } from '../src/utils/assetNavigation';
import { assetMessages as m } from '../src/types/assets';
import { formatAssetTime } from '../src/utils/assetValidation';
import { assetFixture, assetId, assetReply, assetWire, secondAssetId } from './fixtures/assets';
import { historyFixture, installTrackingApi, placementA, placementB, roomA, roomB } from './fixtures/assetTracking';
import { failure } from './apiMock';

beforeEach(() => window.history.replaceState(null, '', '/assets'));
describe('UC18 codecs and contracts', () => {
  it('requires currentPlacement, preserves nested identity and exact money', async () => {
    const api = installTrackingApi(true);
    expect(await getAsset(assetId)).toMatchObject({ purchaseValue: '9007199254740993', currentPlacement: placementA });
    api.detail.mockResolvedValueOnce(assetReply(assetWire({ ...assetFixture, currentPlacement: undefined } as unknown as typeof assetFixture)));
    await expect(getAsset(assetId)).rejects.toMatchObject({ message: m.detailFailure });
    api.detail.mockResolvedValueOnce(assetReply(assetWire({ ...assetFixture, currentPlacement: { ...placementA, assetId: secondAssetId } })));
    await expect(getAsset(assetId)).rejects.toMatchObject({ message: m.detailFailure });
  });
  it('validates microsecond intervals without rounding and leaves server order intact', () => {
    expect(decodeAssetPlacement({ ...placementA, toAt: '2026-11-01T03:00:00.000002Z' }).fromAt).toBe(placementA.fromAt);
    expect(() => decodeAssetPlacement({ ...placementA, toAt: placementA.fromAt })).toThrow();
    expect(() => decodeAssetPlacement({ ...placementA, toAt: '2026-11-01T03:00:00Z' })).toThrow();
    expect(formatAssetTime(placementA.fromAt, true)).toContain('10:00:00.000001');
    expect(decodeAssetHistory(historyFixture)).toEqual(historyFixture);
    expect(() => decodeAssetHistory({ ...historyFixture, conditionHistory: [{ ...historyFixture.conditionHistory[3], roomId: roomB }] })).toThrow();
    expect(() => decodeAssetHistory({ ...historyFixture, locationHistory: [{ ...placementA, assetId: secondAssetId }] })).toThrow();
  });
  it('GETs history and all Host rooms without CSRF, pagination or occupancy filters', async () => {
    const api = installTrackingApi(); const signal = new AbortController().signal;
    expect(await getAssetHistory(assetId, signal)).toEqual(historyFixture);
    expect(await listAssetPlacementRooms(signal)).toHaveLength(2);
    expect(api.csrf).not.toHaveBeenCalled();
    for (const [, init] of api.fetch.mock.calls) expect(init).toMatchObject({ signal, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } });
    expect(String(api.fetch.mock.calls.at(-1)?.[0])).toBe('/api/v1/rooms/search');
    api.rooms.mockResolvedValueOnce(assetReply([], m.roomListEmpty)); expect(await listAssetPlacementRooms()).toEqual([]);
    api.rooms.mockResolvedValueOnce(assetReply(null, m.roomListSuccess)); await expect(listAssetPlacementRooms()).rejects.toMatchObject({ message: m.roomListFailure });
    api.history.mockResolvedValueOnce(assetReply({ ...historyFixture, assetId: secondAssetId }, m.historySuccess)); await expect(getAssetHistory(assetId)).rejects.toMatchObject({ message: m.historyFailure });
  });
  it('writes only the allowed fields with CSRF and expected 201/200 statuses', async () => {
    const api = installTrackingApi();
    await assignAssetPlacement(assetId, { roomId: roomA });
    await transferAsset(assetId, { roomId: roomB, sourcePlacementId: placementA.placementId });
    expect(api.csrf).toHaveBeenCalledTimes(2);
    expect(api.write.mock.calls.map(([url]) => url.pathname)).toEqual([`/api/v1/assets/${assetId}/placements`, `/api/v1/assets/${assetId}/transfers`]);
    expect(api.write.mock.calls.map(([, init]) => JSON.parse(String(init.body)))).toEqual([{ roomId: roomA }, { roomId: roomB, sourcePlacementId: placementA.placementId }]);
    for (const [, init] of api.fetch.mock.calls.filter(([, init]) => init.method === 'POST')) expect(init).toMatchObject({ credentials: 'include', cache: 'no-store', headers: { 'X-CSRF-TOKEN': 'csrf-uc18', 'Content-Type': 'application/json' } });
  });
  it.each([m.sameRoom, m.alreadyPlaced, m.sourceChanged, m.placementTimeInvalid])('preserves conflict %s without retry', async (message) => {
    const api = installTrackingApi(); api.write.mockResolvedValueOnce(failure(409, message));
    await expect(assignAssetPlacement(assetId, { roomId: roomA })).rejects.toMatchObject({ status: 409, message }); expect(api.write).toHaveBeenCalledTimes(1);
  });
  it.each([[404, m.roomNotFound], [404, m.notFound], [500, m.assignFailure], [403, m.csrfInvalid], [400, m.roomRequired]])('preserves safe error %s %s', async (status, message) => {
    const api = installTrackingApi(); api.write.mockResolvedValueOnce(failure(Number(status), String(message), { roomId: m.roomRequired, sourcePlacementId: m.sourceRequired, hostId: 'SQL' }));
    await expect(assignAssetPlacement(assetId, { roomId: roomA })).rejects.toMatchObject({ status, message, fieldErrors: { roomId: m.roomRequired, sourcePlacementId: m.sourceRequired } });
  });
  it('rejects wrong target, wrong status and malformed success as uncertain', async () => {
    const api = installTrackingApi();
    for (const response of [assetReply(placementB, m.assignSuccess, 201), assetReply(placementA, m.assignSuccess, 200), assetReply({}, m.assignSuccess, 201)]) {
      api.write.mockResolvedValueOnce(response);
      await expect(assignAssetPlacement(assetId, { roomId: roomA })).rejects.toMatchObject({ phase: 'uncertain' });
    }
    expect(api.write).toHaveBeenCalledTimes(3);
    expect(parseAssetJson('{"roomId":"' + roomA + '"}')).toEqual({ roomId: roomA });
  });
  it('does not send malformed identifiers or commands invalidated before CSRF finishes', async () => {
    const api = installTrackingApi();
    await expect(assignAssetPlacement(assetId, { roomId: 'bad' })).rejects.toMatchObject({ status: 400 });
    await expect(transferAsset(assetId, { roomId: roomB, sourcePlacementId: 'bad' })).rejects.toMatchObject({ status: 400 });
    await expect(assignAssetPlacement(assetId, { roomId: roomA }, () => false)).rejects.toMatchObject({ name: 'AbortError' });
    expect(api.write).not.toHaveBeenCalled();
  });
});
describe('UC18 route state', () => {
  it('round-trips list/detail dialogs and history with query context', () => {
    for (const base of ['/assets', '/assets/' + assetId]) {
      const route = parseAssetRoute(base, '?q=Máy%25_%21&page=2&size=50')!;
      const url = new URL(assetPlacementUrl(route, { ...assetFixture, currentPlacement: placementA }), location.origin);
      expect(parseAssetRoute(url.pathname, url.search)).toMatchObject({ q: 'Máy%_!', page: 2, size: 50, placement: { action: 'transfer', assetId } });
    }
    expect(parseAssetRoute('/assets/' + assetId + '/history', '')?.screen).toBe('history');
  });
  it.each(['?placement=assign', '?placement=bad&targetAssetId=' + assetId, '?placement=assign&targetAssetId=bad', '?create=1&placement=assign&targetAssetId=' + assetId, '?placement=assign&placement=transfer&targetAssetId=' + assetId])('normalizes unsafe modal URL %s', (query) => {
    const route = parseAssetRoute('/assets', query)!;
    expect(route).toMatchObject({ invalidPlacement: true, create: false, placement: null });
    expect(assetRouteKey(route)).toBe('/assets?page=0&size=20');
  });
});
