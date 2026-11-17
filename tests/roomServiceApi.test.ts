import { describe, expect, it, vi } from 'vitest';
import { LosslessNumber, parse, stringify } from 'lossless-json';
import {
  decodeAvailableRoomServices,
  decodeRoomServiceItem,
  decodeRoomServices,
  encodeRoomServiceWrite,
  parseRoomServiceJson,
} from '../src/services/roomServiceCodec';
import {
  getAvailableRoomServices,
  getRoomServices,
  writeRoomService,
} from '../src/services/roomServiceApi';
import { invalidateSession } from '../src/services/sessionClient';
import { catalogMoney, formatCatalogMoney } from '../src/utils/serviceCatalogValidation';
import { parseRoomsRoute, roomsUrl } from '../src/utils/propertyNavigation';
import { parseRoomServicesRoute, roomServicesUrl } from '../src/utils/roomServiceNavigation';
import { roomServiceMessages as m } from '../src/types/roomServices';
import { deferred } from './apiMock';
import {
  candidate,
  inheritedService,
  privateService,
  roomId,
  roomServiceReply,
  roomServicesFixture,
  roomServiceWire,
  version,
} from './fixtures/roomServices';

describe('UC36 lossless contract', () => {
  it('keeps zero, null, disabled state, and both independent sources', () => {
    const wire = roomServiceWire({
      ...inheritedService,
      enabled: false,
      roomPrice: '0',
      unitPrice: '0',
      priceSource: 'ROOM',
    });
    const item = decodeRoomServiceItem(wire);
    expect(item).toMatchObject({
      serviceSource: 'BUILDING_INHERITED',
      priceSource: 'ROOM',
      enabled: false,
      roomPrice: '0',
      unitPrice: '0',
    });
    expect(decodeRoomServiceItem(roomServiceWire(inheritedService)).roomPrice).toBeNull();
  });
  it('roundtrips 19 digits as numeric money and opaque string version', () => {
    const price = '9999999999999999999';
    const body = encodeRoomServiceWrite({ kind: 'price', item: privateService, unitPrice: price });
    expect(body).toContain('"unitPrice":' + price);
    expect(body).toContain('"version":"' + version + '"');
    expect((parse(body) as { unitPrice: LosslessNumber }).unitPrice.toString()).toBe(price);
    const item = decodeRoomServiceItem(
      parseRoomServiceJson(
        stringify(roomServiceWire({ ...privateService, unitPrice: price, roomPrice: price }))!,
      ),
    );
    // The actual response parser must see JSON numeric tokens, not JS numbers or quoted money.
    expect(item.unitPrice).toBe(price);
  });
  it('formats large VND exactly', () =>
    expect(formatCatalogMoney('9999999999999999999')).toContain('9.999.999.999.999.999.999'));
  it.each(['', '-1', '1.5', '1e3', '100,000', '100.000', 'abc', '99999999999999999999'])(
    'rejects invalid input %j without coercion',
    (value) => {
      expect(catalogMoney(value)).toBeNull();
      expect(() =>
        encodeRoomServiceWrite({ kind: 'price', item: privateService, unitPrice: value }),
      ).toThrow();
    },
  );
  it('encodes desired state and catalog service ID, never configuration ID', () => {
    expect(
      JSON.parse(encodeRoomServiceWrite({ kind: 'status', item: privateService, enabled: false })),
    ).toEqual({ enabled: false, version });
    expect(
      JSON.parse(
        encodeRoomServiceWrite({
          kind: 'add',
          serviceId: candidate.serviceId,
          version: candidate.version,
        }),
      ),
    ).toEqual({ serviceId: candidate.serviceId, version: candidate.version });
    expect(() =>
      encodeRoomServiceWrite({ kind: 'status', item: inheritedService, enabled: false }),
    ).toThrow();
  });
  it.each([
    { enabled: undefined },
    { unitPrice: null },
    { unitPrice: 3500 },
    { unitPrice: '3500' },
    { version: 1 },
    { version: '1' },
    { version: 'A'.repeat(64) },
    { serviceSource: 'ROOM' },
    { priceSource: 'ROOM' },
    { effectiveFrom: '2026-02-30T00:00:00Z' },
  ])('rejects malformed item %j', (override) => {
    expect(() =>
      decodeRoomServiceItem({ ...(roomServiceWire(inheritedService) as object), ...override }),
    ).toThrow();
  });
  it('rejects duplicates, missing lists, wrong room, and impossible available price source', () => {
    expect(() =>
      decodeRoomServices(
        roomServiceWire({ ...roomServicesFixture, services: [privateService, privateService] }),
        roomId,
      ),
    ).toThrow();
    expect(() => decodeRoomServices({ ...roomServicesFixture, services: null }, roomId)).toThrow();
    expect(() =>
      decodeRoomServices(
        roomServiceWire({ ...roomServicesFixture, roomId: candidate.serviceId }),
        roomId,
      ),
    ).toThrow();
    expect(() =>
      decodeAvailableRoomServices(
        roomServiceWire({ roomId, services: [{ ...candidate, priceSource: 'ROOM' }] }),
        roomId,
      ),
    ).toThrow();
    expect(
      decodeRoomServices(roomServiceWire({ ...roomServicesFixture, services: [] }), roomId)
        .services,
    ).toEqual([]);
  });
});

function install(response: () => Response | Promise<Response>) {
  const fetch = vi.fn(async (url: RequestInfo | URL) =>
    String(url).endsWith('/auth/csrf')
      ? roomServiceReply({ token: 'csrf-uc36', headerName: 'X-CSRF-TOKEN' })
      : response(),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
describe('UC36 API phases and guards', () => {
  it('uses cookies/no-store, room-scoped GETs and CSRF for writes', async () => {
    const api = install(() => roomServiceReply(roomServicesFixture));
    await getRoomServices(roomId);
    expect(api.mock.calls[0][0]).toBe('/api/v1/rooms/' + roomId + '/services');
    expect((api.mock.calls as unknown[][])[0][1]).toMatchObject({
      credentials: 'include',
      cache: 'no-store',
    });
    api.mockImplementation(async (url) =>
      String(url).endsWith('/auth/csrf')
        ? roomServiceReply({ token: 'csrf-uc36', headerName: 'X-CSRF-TOKEN' })
        : roomServiceReply({ ...privateService, enabled: true }),
    );
    await writeRoomService(roomId, { kind: 'status', item: privateService, enabled: true });
    expect((api.mock.calls as unknown[][]).at(-1)?.[1]).toMatchObject({
      method: 'PATCH',
      credentials: 'include',
      headers: { 'X-CSRF-TOKEN': 'csrf-uc36' },
      body: JSON.stringify({ enabled: true, version }),
    });
  });
  it('uses /available and rejects wrong context', async () => {
    const api = install(() => roomServiceReply({ roomId, services: [candidate] }));
    expect((await getAvailableRoomServices(roomId)).services[0].version).toBe(candidate.version);
    expect(api.mock.calls[0][0]).toContain('/services/available');
  });
  it('classifies a valid error as a confirmed failure and preserves field errors', async () => {
    install(() => roomServiceReply(null, 400, m.invalid, { unitPrice: m.priceInvalid }));
    await expect(
      writeRoomService(roomId, { kind: 'price', item: privateService, unitPrice: '0' }),
    ).rejects.toMatchObject({
      status: 400,
      phase: 'write',
      fieldErrors: { unitPrice: m.priceInvalid },
    });
  });
  it.each(['network', 'invalid-json', 'wrong-item', 'wrong-status'])(
    'treats %s after dispatch as uncertain and never replays',
    async (mode) => {
      const api = install(() => {
        if (mode === 'network') throw new TypeError('offline');
        if (mode === 'invalid-json') return new Response('not-json', { status: 200 });
        if (mode === 'wrong-status') return roomServiceReply(privateService, 201);
        return roomServiceReply(inheritedService);
      });
      await expect(
        writeRoomService(roomId, { kind: 'price', item: privateService, unitPrice: '0' }),
      ).rejects.toMatchObject({ phase: 'uncertain', message: m.uncertain });
      expect(api.mock.calls.filter(([url]) => !String(url).endsWith('/auth/csrf'))).toHaveLength(1);
    },
  );
  it('keeps CSRF 403 distinct from forbidden 403', async () => {
    install(() => roomServiceReply(null, 403, m.csrfInvalid));
    await expect(
      writeRoomService(roomId, { kind: 'price', item: privateService, unitPrice: '0' }),
    ).rejects.toMatchObject({ message: m.csrfInvalid, phase: 'write' });
  });
  it('drops read response whose body finishes after session invalidation', async () => {
    const gate = deferred<string>();
    install(() => ({ ok: true, status: 200, text: () => gate.promise }) as Response);
    const pending = getRoomServices(roomId);
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    invalidateSession();
    gate.resolve(await roomServiceReply(roomServicesFixture).text());
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('does not dispatch a write when context changes during CSRF lookup', async () => {
    const gate = deferred<Response>();
    const api = vi.fn(() => gate.promise);
    vi.stubGlobal('fetch', api);
    const pending = writeRoomService(roomId, {
      kind: 'price',
      item: privateService,
      unitPrice: '0',
    });
    invalidateSession();
    gate.resolve(roomServiceReply({ token: 'old', headerName: 'X-CSRF-TOKEN' }));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(api).toHaveBeenCalledOnce();
  });
});

describe('UC36 navigation', () => {
  it('roundtrips the selected room, view, building and all filters', () => {
    const back = roomsUrl({
      view: 'table',
      roomId,
      action: 'detail',
      buildingId: candidate.serviceId,
      floorId: privateService.serviceId,
      keyword: 'Phòng 1',
      areaId: inheritedService.serviceId,
      status: 'VACANT',
    });
    const url = new URL(roomServicesUrl(roomId, back), 'https://rentops.local');
    expect(parseRoomServicesRoute(url.pathname, url.search)).toEqual({ roomId, returnTo: back });
    expect(parseRoomsRoute(url.pathname, url.search)?.services).toBe(true);
    const restored = new URL(back, url);
    expect(parseRoomsRoute(restored.pathname, restored.search)).toMatchObject({
      view: 'table',
      roomId,
      keyword: 'Phòng 1',
      status: 'VACANT',
    });
  });
  it.each([
    'https://evil.example/rooms',
    '//evil.example/rooms',
    '/services',
    '/rooms/../services',
    '/rooms\\evil.example',
  ])('rejects unsafe return target %s', (target) => {
    expect(
      parseRoomServicesRoute(
        '/rooms/' + roomId + '/services',
        '?returnTo=' + encodeURIComponent(target),
      )?.returnTo,
    ).toBe('/rooms');
  });
});
