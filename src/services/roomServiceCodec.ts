import { isLosslessNumber, LosslessNumber, parse, stringify } from 'lossless-json';
import { isRecord } from './assetCodec';
import { isAssetId } from '../utils/assetNavigation';
import { catalogMoney } from '../utils/serviceCatalogValidation';
import { chargeMethods } from '../types/serviceCatalog';
import type {
  AvailableRoomServices,
  RoomServiceCandidate,
  RoomServiceItem,
  RoomServices,
  RoomServiceWrite,
} from '../types/roomServices';

export const parseRoomServiceJson = (text: string): unknown => parse(text);
export const isRoomServiceVersion = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function requiredText(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing text');
}
function money(value: unknown): string {
  if (!isLosslessNumber(value)) throw new Error('Money must be a JSON number');
  const normalized = catalogMoney(value.toString().replace(/\.0+$/, ''));
  if (normalized === null) throw new Error('Invalid VND');
  return normalized;
}
const nullableMoney = (value: unknown) => (value === null ? null : money(value));
function timestamp(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  )
    return false;
  const date = new Date(value.slice(0, 10) + 'T00:00:00Z');
  return (
    Number.isFinite(date.valueOf()) &&
    date.toISOString().slice(0, 10) === value.slice(0, 10) &&
    Number.isFinite(Date.parse(value)) &&
    Number(value.slice(11, 13)) < 24 &&
    Number(value.slice(14, 16)) < 60 &&
    Number(value.slice(17, 19)) < 60
  );
}
export function decodeRoomServiceCandidate(value: unknown): RoomServiceCandidate {
  if (!isRecord(value) || !isAssetId(value.serviceId) || !isRoomServiceVersion(value.version))
    throw new Error('Invalid service identity/version');
  requiredText(value.name);
  requiredText(value.unit);
  if (typeof value.method !== 'string' || !Object.hasOwn(chargeMethods, value.method))
    throw new Error('Invalid method');
  if (
    value.priceSource !== 'ROOM' &&
    value.priceSource !== 'BUILDING' &&
    value.priceSource !== 'CATALOG'
  )
    throw new Error('Invalid price source');
  return {
    serviceId: value.serviceId,
    name: value.name,
    unit: value.unit,
    method: value.method as RoomServiceCandidate['method'],
    unitPrice: money(value.unitPrice),
    priceSource: value.priceSource,
    version: value.version,
  };
}
export function decodeRoomServiceItem(value: unknown): RoomServiceItem {
  const candidate = decodeRoomServiceCandidate(value);
  if (
    !isRecord(value) ||
    !isAssetId(value.configurationId) ||
    typeof value.enabled !== 'boolean' ||
    (value.serviceSource !== 'BUILDING_INHERITED' && value.serviceSource !== 'ROOM_PRIVATE') ||
    !timestamp(value.appliedAt) ||
    !timestamp(value.effectiveFrom)
  )
    throw new Error('Invalid configuration');
  const roomPrice = nullableMoney(value.roomPrice),
    buildingPrice = nullableMoney(value.buildingPrice),
    catalogPrice = money(value.catalogPrice),
    inheritedPrice = money(value.inheritedPrice);
  const priceSource = roomPrice !== null ? 'ROOM' : buildingPrice !== null ? 'BUILDING' : 'CATALOG';
  if (
    inheritedPrice !== (buildingPrice ?? catalogPrice) ||
    candidate.unitPrice !== (roomPrice ?? inheritedPrice) ||
    candidate.priceSource !== priceSource
  )
    throw new Error('Inconsistent price provenance');
  return {
    ...candidate,
    configurationId: value.configurationId,
    serviceSource: value.serviceSource,
    enabled: value.enabled,
    roomPrice,
    buildingPrice,
    catalogPrice,
    inheritedPrice,
    appliedAt: value.appliedAt,
    effectiveFrom: value.effectiveFrom,
  };
}
function serviceList<T extends RoomServiceCandidate>(
  value: unknown,
  decode: (v: unknown) => T,
): T[] {
  if (!Array.isArray(value)) throw new Error('Missing services');
  const items = value.map(decode);
  if (new Set(items.map((item) => item.serviceId)).size !== items.length)
    throw new Error('Duplicate service');
  return items;
}
export function decodeRoomServices(value: unknown, roomId: string): RoomServices {
  if (!isRecord(value) || value.roomId !== roomId || !isAssetId(value.buildingId))
    throw new Error('Wrong room');
  requiredText(value.roomCode);
  requiredText(value.roomName);
  requiredText(value.buildingName);
  const services = serviceList(value.services, decodeRoomServiceItem);
  if (new Set(services.map((item) => item.configurationId)).size !== services.length)
    throw new Error('Duplicate configuration');
  return {
    roomId,
    roomCode: value.roomCode,
    roomName: value.roomName,
    buildingId: value.buildingId,
    buildingName: value.buildingName,
    services,
  };
}
export function decodeAvailableRoomServices(value: unknown, roomId: string): AvailableRoomServices {
  if (!isRecord(value) || value.roomId !== roomId) throw new Error('Wrong room');
  const services = serviceList(value.services, decodeRoomServiceCandidate);
  if (services.some((item) => item.priceSource === 'ROOM'))
    throw new Error('Invalid available price source');
  return { roomId, services };
}
export function encodeRoomServiceWrite(action: RoomServiceWrite): string {
  const version = action.kind === 'add' ? action.version : action.item.version;
  if (!isRoomServiceVersion(version)) throw new Error('Invalid version');
  if (action.kind === 'add') {
    if (!isAssetId(action.serviceId)) throw new Error('Invalid service ID');
    return stringify({ serviceId: action.serviceId, version })!;
  }
  if (action.kind === 'status') {
    if (typeof action.enabled !== 'boolean' || action.item.serviceSource !== 'ROOM_PRIVATE')
      throw new Error('Invalid status write');
    return stringify({ enabled: action.enabled, version })!;
  }
  const price = catalogMoney(action.unitPrice);
  if (price === null) throw new Error('Invalid price');
  return stringify({ unitPrice: new LosslessNumber(price), version })!;
}
export function decodeRoomServiceWrite(value: unknown, action: RoomServiceWrite): RoomServiceItem {
  const item = decodeRoomServiceItem(value);
  if (item.serviceId !== (action.kind === 'add' ? action.serviceId : action.item.serviceId))
    throw new Error('Wrong service');
  if (action.kind === 'add') {
    if (item.serviceSource !== 'ROOM_PRIVATE' || !item.enabled || item.roomPrice !== null)
      throw new Error('Invalid add result');
  } else {
    if (
      item.configurationId !== action.item.configurationId ||
      item.serviceSource !== action.item.serviceSource
    )
      throw new Error('Wrong configuration');
    if (
      action.kind === 'status' &&
      (item.enabled !== action.enabled || item.roomPrice !== action.item.roomPrice)
    )
      throw new Error('Invalid status result');
    if (
      action.kind === 'price' &&
      (item.roomPrice !== catalogMoney(action.unitPrice) || item.enabled !== action.item.enabled)
    )
      throw new Error('Invalid price result');
  }
  return item;
}
