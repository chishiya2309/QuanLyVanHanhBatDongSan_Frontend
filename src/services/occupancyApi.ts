import { isLosslessNumber, parse } from 'lossless-json';
import { authenticatedFetch } from './sessionClient';
import { isRecord, safeInteger } from './assetCodec';
import { occupancyParams, type OccupancyQuery } from '../utils/occupancyNavigation';

interface RoomItem {
  roomId: string;
  code: string;
  name: string;
  buildingId: string;
  buildingName: string;
  areaId: string;
  areaName: string;
  area: string | null;
  defaultRent: string | null;
  daysVacant: number | null;
}

export interface OccupancyReport {
  generatedAt: string;
  totalRooms: number;
  occupiedRooms: number;
  availableVacantRooms: number;
  unavailableRooms: number;
  vacancyRate: string | null;
  vacantRentPotential: string;
  byBuilding: {
    buildingId: string;
    buildingName: string;
    availableVacantRooms: number;
    vacantRentPotential: string;
  }[];
  availableRooms: { items: RoomItem[]; page: number; size: number; totalElements: number; totalPages: number };
  warnings: { code: string; count: number }[];
}

function record(value: unknown) {
  if (!isRecord(value)) throw new Error('Invalid occupancy record');
  return value;
}

function string(value: unknown) {
  if (typeof value !== 'string') throw new Error('Invalid occupancy text');
  return value;
}

function count(value: unknown) {
  const result = safeInteger(value);
  if (result === null || result < 0) throw new Error('Invalid occupancy count');
  return result;
}

function decimal(value: unknown) {
  const result = isLosslessNumber(value) ? value.value : value;
  if (typeof result !== 'string' || !/^\d+(?:\.\d+)?$/.test(result)) throw new Error('Invalid occupancy decimal');
  return result;
}

function list<T>(value: unknown, decode: (item: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(value)) throw new Error('Invalid occupancy list');
  return value.map(item => decode(record(item)));
}

function decodeReport(value: unknown): OccupancyReport {
  const data = record(value);
  const page = record(data.availableRooms);
  const generatedAt = string(data.generatedAt);
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('Invalid occupancy date');
  return {
    generatedAt,
    totalRooms: count(data.totalRooms),
    occupiedRooms: count(data.occupiedRooms),
    availableVacantRooms: count(data.availableVacantRooms),
    unavailableRooms: count(data.unavailableRooms),
    vacancyRate: data.vacancyRate === null ? null : decimal(data.vacancyRate),
    vacantRentPotential: decimal(data.vacantRentPotential),
    byBuilding: list(data.byBuilding, item => ({
      buildingId: string(item.buildingId),
      buildingName: string(item.buildingName),
      availableVacantRooms: count(item.availableVacantRooms),
      vacantRentPotential: decimal(item.vacantRentPotential),
    })),
    availableRooms: {
      page: count(page.page),
      size: count(page.size),
      totalElements: count(page.totalElements),
      totalPages: count(page.totalPages),
      items: list(page.items, item => ({
        roomId: string(item.roomId),
        code: string(item.code),
        name: string(item.name),
        buildingId: string(item.buildingId),
        buildingName: string(item.buildingName),
        areaId: string(item.areaId),
        areaName: string(item.areaName),
        area: item.area === null ? null : decimal(item.area),
        defaultRent: item.defaultRent === null ? null : decimal(item.defaultRent),
        daysVacant: item.daysVacant === null ? null : count(item.daysVacant),
      })),
    },
    warnings: list(data.warnings, warning => ({ code: string(warning.code), count: count(warning.count) })),
  };
}

const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');

export class OccupancyApiError extends Error {
  readonly status: number;

  constructor(status: number, message = '') {
    super(message);
    this.status = status;
  }
}

export async function getOccupancyReport(query: OccupancyQuery, signal?: AbortSignal): Promise<OccupancyReport> {
  const response = await authenticatedFetch(base + '/reports/occupancy?' + occupancyParams(query), {
    signal, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const body: unknown = response.status === 400 ? await response.json().catch(() => null) : null;
    throw new OccupancyApiError(response.status, isRecord(body) && typeof body.message === 'string' ? body.message : '');
  }
  const body = record(parse(await response.text()));
  if (count(body.status) !== 200) throw new Error('Invalid occupancy response');
  return decodeReport(body.data);
}
