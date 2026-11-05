import { vi } from 'vitest';
import { assetMessages as m, type Asset, type AssetHistory, type AssetPlacement, type AssetPlacementRoom } from '../../src/types/assets';
import { assetFixture, assetId, secondAssetId, assetPageReply, assetReply, assetWire } from './assets';
import { failure, ok } from '../apiMock';

export const roomA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const roomB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const placementA: AssetPlacement = { placementId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', assetId, roomId: roomA,
  roomCode: '101', roomName: 'Phòng cùng tên', fromAt: '2026-11-01T03:00:00.000001Z', toAt: null, conditionAtStart: 'GOOD' };
export const placementB: AssetPlacement = { ...placementA, placementId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', roomId: roomB, roomCode: '202', fromAt: '2026-11-02T03:00:00.000002Z', conditionAtStart: 'REPAIRING' };
export const roomFixtures: AssetPlacementRoom[] = [
  { id: roomA, code: '101', name: 'Phòng cùng tên', areaName: 'Khu Đông', buildingName: 'Tòa A', floorName: 'Tầng 1' },
  { id: roomB, code: '202', name: 'Phòng cùng tên', areaName: 'Khu Tây', buildingName: 'Tòa B', floorName: 'Tầng 2' },
];
const record = { assetId, condition: 'REPAIRING' as const, recordedByAccountId: secondAssetId, note: 'Kiểm tra tại phòng cũ' };
export const historyFixture: AssetHistory = { assetId,
  locationHistory: [placementB, { ...placementA, toAt: placementB.fromAt }],
  conditionHistory: [
    { ...record, recordId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', recordedAt: '2026-11-02T04:00:00Z', placementId: placementB.placementId, roomId: roomB, roomCode: '202', roomName: 'Phòng cùng tên' },
    { ...record, recordId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', recordedAt: '2026-11-01T05:00:00Z', placementId: placementA.placementId, roomId: roomA, roomCode: '101', roomName: 'Phòng cùng tên' },
    { ...record, recordId: '99999999-9999-4999-8999-999999999999', recordedAt: '2026-11-01T04:00:00Z', placementId: placementA.placementId, roomId: roomA, roomCode: '101', roomName: 'Phòng cùng tên' },
    { ...record, recordId: '88888888-8888-4888-8888-888888888888', recordedAt: assetFixture.createdAt, note: null, placementId: null, roomId: null, roomCode: null, roomName: null },
  ],
};

export function installTrackingApi(assigned = false, role = 'HOST') {
  let asset: Asset = { ...assetFixture, currentPlacement: assigned ? placementA : null };
  const me = vi.fn(async (): Promise<Response> => ok({ accountId: secondAssetId, loginName: 'Host UC18', role, hostId: assetId, customerId: null }));
  const csrf = vi.fn(async (): Promise<Response> => ok({ token: 'csrf-uc18', headerName: 'X-CSRF-TOKEN' }));
  const rooms = vi.fn(async (): Promise<Response> => assetReply(roomFixtures.map((room, i) => ({ ...room, status: i ? 'MAINTENANCE' : 'OCCUPIED', isMaintenance: !!i })), m.roomListSuccess));
  const detail = vi.fn(async (): Promise<Response> => assetReply(assetWire(asset)));
  const history = vi.fn(async (): Promise<Response> => assetReply(historyFixture, m.historySuccess));
  const list = vi.fn(async (url: URL): Promise<Response> => assetPageReply({ q: url.searchParams.get('q') || '', page: 0, size: Number(url.searchParams.get('size') || '20') }, [asset]));
  const write = vi.fn(async (url: URL, init: RequestInit): Promise<Response> => {
    const input: { roomId: string } = JSON.parse(String(init.body));
    const transfer = url.pathname.endsWith('/transfers');
    const room = roomFixtures.find((item) => item.id === input.roomId)!;
    const placement = { ...(transfer ? placementB : placementA), roomId: room.id, roomCode: room.code, roomName: room.name };
    asset = { ...asset, currentPlacement: placement };
    return assetReply(placement, transfer ? m.transferSuccess : m.assignSuccess, transfer ? 200 : 201);
  });
  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname.endsWith('/auth/me')) return me();
    if (url.pathname.endsWith('/auth/csrf')) return csrf();
    if (url.pathname.endsWith('/auth/refresh')) return failure(401, m.sessionInvalid);
    if (url.pathname.endsWith('/rooms/search')) return rooms();
    if (url.pathname.endsWith('/history')) return history();
    if (url.pathname.endsWith('/assets')) return list(url);
    if (url.pathname.startsWith('/api/v1/assets/')) return init.method === 'POST' ? write(url, init) : detail();
    return failure(404, 'Unexpected test endpoint');
  });
  vi.stubGlobal('fetch', fetch);
  return { me, csrf, rooms, detail, history, list, write, fetch, setAsset: (next: Asset) => { asset = next; } };
}
