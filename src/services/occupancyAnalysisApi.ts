import { authenticatedFetch } from './sessionClient';
import { isRecord } from './assetCodec';
import { OccupancyApiError } from './occupancyApi';
import { isCalendarDate, occupancyAnalysisParams, type OccupancyAnalysisQuery } from '../utils/occupancyAnalysisNavigation';

const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
const dataStatuses = ['COMPLETE', 'INCOMPLETE'] as const;
const pointStatuses = ['COMPLETE', 'MISSING_DATA', 'NO_ACTIVE_ROOM_DAYS'] as const;
const trendStatuses = ['COMPLETE', 'PARTIAL', 'MISSING_DATA', 'ERROR'] as const;

interface Counts {
  totalRooms: number;
  activeRooms: number | null;
  occupiedRooms: number | null;
  roomsWithoutEffectiveLease: number | null;
  unavailableRooms: number | null;
  dataStatus: typeof dataStatuses[number];
}

export interface AnalysisBuilding extends Counts {
  buildingId: string;
  buildingName: string;
  areaName: string;
  rate: number | null;
}

export interface AnalysisPoint {
  month: string;
  occupancyRate: number | null;
  dataStatus: typeof pointStatuses[number];
  partialMonth: boolean;
}

export interface OccupancyAnalysis extends Counts {
  asOfDate: string;
  generatedAt: string;
  fromDate: string;
  toDate: string;
  occupancyRate: number | null;
  byBuilding: AnalysisBuilding[];
  series: AnalysisPoint[];
  trendStatus: typeof trendStatuses[number];
  trendMessage: string | null;
  warnings: { buildingId: string | null; code: string; count: number }[];
}

function invalid(): never {
  throw new Error('Invalid occupancy analysis response');
}

function record(value: unknown) {
  return isRecord(value) ? value : invalid();
}

function string(value: unknown) {
  return typeof value === 'string' ? value : invalid();
}

function count(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : invalid();
}

function nullable<T>(value: unknown, decode: (input: unknown) => T): T | null {
  return value === null ? null : decode(value);
}

function rate(value: unknown) {
  return nullable(value, input => typeof input === 'number' && Number.isFinite(input) && input >= 0 && input <= 100
    ? input : invalid());
}

function date(value: unknown) {
  return typeof value === 'string' && isCalendarDate(value) ? value : invalid();
}

function status<T extends string>(value: unknown, allowed: readonly T[]): T {
  return allowed.find(entry => entry === value) ?? invalid();
}

function list<T>(value: unknown, decode: (input: Record<string, unknown>) => T): T[] {
  return Array.isArray(value) ? value.map(entry => decode(record(entry))) : invalid();
}

function counts(item: Record<string, unknown>): Counts {
  return {
    totalRooms: count(item.totalRooms),
    activeRooms: nullable(item.activeRooms, count),
    occupiedRooms: nullable(item.occupiedRooms, count),
    roomsWithoutEffectiveLease: nullable(item.roomsWithoutEffectiveLease, count),
    unavailableRooms: nullable(item.unavailableRooms, count),
    dataStatus: status(item.dataStatus, dataStatuses),
  };
}

export function decodeOccupancyAnalysis(value: unknown): OccupancyAnalysis {
  const body = record(value);
  if (body.status !== 200) invalid();
  const data = record(record(body.data).occupancyAnalysis);
  const generatedAt = string(data.generatedAt);
  if (!Number.isFinite(Date.parse(generatedAt)) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(generatedAt)) invalid();
  return {
    ...counts(data),
    asOfDate: date(data.asOfDate),
    generatedAt,
    fromDate: date(data.fromDate),
    toDate: date(data.toDate),
    occupancyRate: rate(data.occupancyRate),
    byBuilding: list(data.byBuilding, item => ({
      ...counts(item), buildingId: string(item.buildingId), buildingName: string(item.buildingName),
      areaName: string(item.areaName), rate: rate(item.rate),
    })),
    series: list(data.series, item => {
      const month = string(item.month);
      if (month.length !== 7 || !isCalendarDate(month + '-01') || typeof item.partialMonth !== 'boolean') invalid();
      const dataStatus = status(item.dataStatus, pointStatuses);
      const occupancyRate = rate(item.occupancyRate);
      if ((dataStatus === 'COMPLETE') !== (occupancyRate !== null)) invalid();
      return { month, occupancyRate, dataStatus, partialMonth: item.partialMonth };
    }),
    trendStatus: status(data.trendStatus, trendStatuses),
    trendMessage: nullable(data.trendMessage, string),
    warnings: list(data.warnings, item => ({
      buildingId: nullable(item.buildingId, string), code: string(item.code), count: count(item.count),
    })),
  };
}

export async function getOccupancyAnalysis(query: OccupancyAnalysisQuery, signal?: AbortSignal): Promise<OccupancyAnalysis> {
  const search = occupancyAnalysisParams(query).toString();
  const response = await authenticatedFetch(base + '/reports/occupancy' + (search ? '?' + search : ''), {
    signal, credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const body: unknown = response.status === 400 ? await response.json().catch(() => null) : null;
    throw new OccupancyApiError(response.status, isRecord(body) && typeof body.message === 'string' ? body.message : '');
  }
  return decodeOccupancyAnalysis(await response.json());
}
