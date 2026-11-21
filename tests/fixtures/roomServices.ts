import { LosslessNumber, stringify } from 'lossless-json';
import type {
  RoomServiceCandidate,
  RoomServiceItem,
  RoomServices,
} from '../../src/types/roomServices';

export const roomId = '22222222-2222-4222-8222-222222222222';
export const buildingId = '33333333-3333-4333-8333-333333333333';
export const otherRoomId = '99999999-9999-4999-8999-999999999999';
export const version = 'a'.repeat(64);
export const inheritedService: RoomServiceItem = {
  serviceId: '11111111-1111-4111-8111-111111111111',
  configurationId: '44444444-4444-4444-8444-444444444444',
  name: 'Điện',
  unit: 'kWh',
  method: 'METERED',
  serviceSource: 'BUILDING_INHERITED',
  enabled: true,
  unitPrice: '3500',
  priceSource: 'BUILDING',
  roomPrice: null,
  buildingPrice: '3500',
  catalogPrice: '4000',
  inheritedPrice: '3500',
  appliedAt: '2026-11-01T00:00:00Z',
  effectiveFrom: '2026-11-01T00:00:00.000001Z',
  version,
};
export const privateService: RoomServiceItem = {
  ...inheritedService,
  serviceId: '55555555-5555-4555-8555-555555555555',
  configurationId: '66666666-6666-4666-8666-666666666666',
  name: 'Internet',
  unit: 'tháng',
  method: 'FIXED',
  serviceSource: 'ROOM_PRIVATE',
  enabled: false,
  unitPrice: '120000',
  priceSource: 'ROOM',
  roomPrice: '120000',
  buildingPrice: null,
  catalogPrice: '100000',
  inheritedPrice: '100000',
};
export const candidate: RoomServiceCandidate = {
  serviceId: '77777777-7777-4777-8777-777777777777',
  name: 'Vệ sinh',
  unit: 'tháng',
  method: 'FIXED',
  unitPrice: '50000',
  priceSource: 'CATALOG',
  version: 'c'.repeat(64),
};
export const roomServicesFixture: RoomServices = {
  roomId,
  roomCode: '101',
  roomName: 'Phòng 101',
  buildingId,
  buildingName: 'Tòa A',
  services: [inheritedService, privateService],
};
export function addedService(): RoomServiceItem {
  return {
    ...privateService,
    ...candidate,
    configurationId: '88888888-8888-4888-8888-888888888888',
    enabled: true,
    roomPrice: null,
    buildingPrice: null,
    catalogPrice: candidate.unitPrice,
    inheritedPrice: candidate.unitPrice,
    version: 'd'.repeat(64),
  };
}
export function roomServiceWire(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(roomServiceWire);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [
      key,
      ['unitPrice', 'roomPrice', 'buildingPrice', 'catalogPrice', 'inheritedPrice'].includes(key) &&
      typeof val === 'string'
        ? new LosslessNumber(val)
        : roomServiceWire(val),
    ]),
  );
}
export function roomServiceReply(
  data: unknown,
  status = 200,
  message = 'OK',
  fieldErrors?: Record<string, string>,
) {
  return new Response(
    stringify({
      status,
      message,
      data: roomServiceWire(data),
      ...(fieldErrors ? { fieldErrors } : {}),
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}
