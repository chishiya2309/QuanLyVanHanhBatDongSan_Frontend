import { isLosslessNumber, LosslessNumber, parse, stringify } from 'lossless-json';
import { isRecord, safeInteger } from './assetCodec';
import { isAssetId } from '../utils/assetNavigation';
import { isMeterDate } from '../utils/meterNavigation';
import { compareMeterDecimal, meterDecimal } from '../utils/meterDecimal';
import { meterKey, type BillingPeriod, type MeterBatch, type MeterCorrect, type MeterCreate, type MeterItem, type MeterPage, type MeterProgress, type MeterResult } from '../types/meterReading';

export const parseMeterJson = (text: string): unknown => parse(text);
const fail = (): never => { throw new Error('Invalid UC37 contract'); };
const text = (v: unknown): string => typeof v === 'string' && v.trim() ? v : fail();
const id = (v: unknown): string => isAssetId(v) ? v : fail();
const nullableId = (v: unknown) => v === null ? null : id(v);
const nullableText = (v: unknown) => v === null ? null : text(v);
const count = (v: unknown): number => safeInteger(v) ?? fail();
const bool = (v: unknown): boolean => typeof v === 'boolean' ? v : fail();
const date = (v: unknown): string => typeof v === 'string' && isMeterDate(v) ? v : fail();
const status = (v: unknown): 'OPEN' | 'SEALED' => v === 'OPEN' || v === 'SEALED' ? v : fail();
export const meterVersion = (v: unknown): string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v) ? v : fail();
function numeric(v: unknown): string | null {
  if (v === null) return null;
  if (!isLosslessNumber(v)) return fail();
  return meterDecimal(v.toString()) ?? fail();
}
function dates(v: Record<string, unknown>) {
  const fromDate = date(v.fromDate), toDate = date(v.toDate), cycleStart = date(v.cycleStart), cycleEnd = date(v.cycleEnd);
  if (fromDate >= toDate || cycleStart > fromDate || toDate > cycleEnd) fail();
  return { fromDate, toDate, cycleStart, cycleEnd };
}
export function decodeBillingPeriod(v: unknown): BillingPeriod {
  if (!isRecord(v)) return fail();
  return { id: id(v.id), tenancyId: id(v.tenancyId), roomId: id(v.roomId), roomCode: text(v.roomCode), buildingId: id(v.buildingId), ...dates(v), status: status(v.status) };
}
export function decodeMeterItem(v: unknown): MeterItem {
  if (!isRecord(v)) return fail();
  const source = v.startSource;
  if (source !== null && source !== 'PREVIOUS_READING' && source !== 'HANDOVER' && source !== 'HOST_CONFIRMED') return fail();
  const item: MeterItem = {
    requirementId: id(v.requirementId), periodId: id(v.periodId), roomServiceId: id(v.roomServiceId), roomId: id(v.roomId),
    roomCode: text(v.roomCode), buildingId: id(v.buildingId), buildingName: text(v.buildingName), serviceName: text(v.serviceName), unit: text(v.unit),
    ...dates(v), periodStatus: status(v.periodStatus), readingId: nullableId(v.readingId), startIndex: numeric(v.startIndex), endIndex: numeric(v.endIndex), consumption: numeric(v.consumption),
    startSource: source, sourceId: nullableId(v.sourceId), initialStartAllowed: bool(v.initialStartAllowed), canCreate: bool(v.canCreate), canUpdate: bool(v.canUpdate),
    blockedReason: nullableText(v.blockedReason), version: meterVersion(v.version),
  };
  if ((item.canCreate && (item.readingId || item.blockedReason)) || (item.canUpdate && (!item.readingId || item.blockedReason))
    || (item.periodStatus === 'SEALED' && (item.canCreate || item.canUpdate)) || (item.initialStartAllowed && item.startIndex !== null)) fail();
  if (!item.readingId && (item.endIndex !== null || item.consumption !== null)) fail();
  if (item.readingId && item.endIndex === null) fail();
  if (item.startIndex !== null && item.endIndex !== null && compareMeterDecimal(item.endIndex, item.startIndex) < 0) fail();
  return item;
}
export function decodeMeterPage<T>(v: unknown, decode: (item: unknown) => T): MeterPage<T> {
  if (!isRecord(v) || !Array.isArray(v.items)) return fail();
  const result = { items: v.items.map(decode), total: count(v.total), page: count(v.page), size: count(v.size) };
  if (result.size < 1 || result.size > 100 || result.items.length > result.size || result.total < result.items.length) fail();
  return result;
}
export function decodeMeterProgress(v: unknown): MeterProgress {
  if (!isRecord(v) || !Array.isArray(v.pendingRoomIds) || !Array.isArray(v.pendingRooms)) return fail();
  const data: MeterProgress = { required: count(v.required), completed: count(v.completed), pending: count(v.pending), pendingRoomIds: v.pendingRoomIds.map(id),
    pendingRooms: v.pendingRooms.map((r) => {
      if (!isRecord(r) || !Array.isArray(r.missingRequirementIds) || !r.missingRequirementIds.length) return fail();
      return { roomId: id(r.roomId), roomCode: text(r.roomCode), buildingId: id(r.buildingId), missingRequirementIds: r.missingRequirementIds.map(id) };
    }) };
  if (data.completed + data.pending !== data.required || data.pendingRoomIds.length !== data.pending || data.pendingRooms.length !== data.pending
    || new Set(data.pendingRoomIds).size !== data.pending || data.pendingRooms.some((r) => !data.pendingRoomIds.includes(r.roomId))
    || new Set(data.pendingRooms.map((r) => r.roomId)).size !== data.pending) fail();
  return data;
}
export function decodeMeterBatch(v: unknown, sent: MeterCreate[]): MeterBatch {
  if (!isRecord(v) || !Array.isArray(v.results) || v.results.length !== sent.length) return fail();
  const outcome = v.outcome;
  if (outcome !== 'ALL_SAVED' && outcome !== 'PARTIALLY_SAVED' && outcome !== 'NONE_SAVED' && outcome !== 'INTERRUPTED') return fail();
  const results = v.results.map((r): MeterResult => {
    if (!isRecord(r)) return fail();
    const index = count(r.index), request = sent[index];
    const state = r.state;
    if (!request || id(r.periodId) !== request.periodId || id(r.roomServiceId) !== request.roomServiceId
      || (state !== 'SAVED' && state !== 'FAILED' && state !== 'UNKNOWN' && state !== 'NOT_PROCESSED')) return fail();
    const saved = r.saved === null ? null : decodeMeterItem(r.saved);
    if ((state === 'SAVED' && (!saved?.readingId || meterKey(saved) !== meterKey(request))) || (state !== 'SAVED' && saved !== null)) fail();
    return { index, periodId: request.periodId, roomServiceId: request.roomServiceId, state, saved,
      status: r.status === null ? null : count(r.status), code: nullableText(r.code), message: nullableText(r.message) };
  });
  const saved = count(v.saved), failed = count(v.failed);
  if (new Set(results.map((r) => r.index)).size !== sent.length || saved !== results.filter((r) => r.state === 'SAVED').length || failed !== results.filter((r) => r.state === 'FAILED').length
    || (outcome === 'ALL_SAVED' && saved !== sent.length) || (outcome === 'NONE_SAVED' && (saved !== 0 || failed !== sent.length))
    || (outcome === 'PARTIALLY_SAVED' && (!saved || !failed || saved + failed !== sent.length))) fail();
  return { outcome, saved, failed, results };
}
function writeValues(value: MeterCorrect) {
  const decimal = meterDecimal(value.endIndex) ?? fail();
  return { endIndex: new LosslessNumber(decimal), version: meterVersion(value.version) };
}
function createValues(value: MeterCreate) {
  const result = { periodId: id(value.periodId), roomServiceId: id(value.roomServiceId), ...writeValues(value) };
  if (value.startIndex === undefined) return result;
  const start = meterDecimal(value.startIndex) ?? fail();
  if (compareMeterDecimal(value.endIndex, start) < 0) fail();
  return { ...result, startIndex: new LosslessNumber(start) };
}
export const encodeMeterCreate = (value: MeterCreate) => stringify(createValues(value))!;
export const encodeMeterCorrect = (value: MeterCorrect) => stringify(writeValues(value))!;
export function encodeMeterBatch(values: MeterCreate[]) {
  if (!values.length) fail();
  return stringify({ items: values.map(createValues) })!;
}
export function decodeMeterChoices(v: unknown, room = false): { id: string; name: string; buildingId?: string }[] {
  if (!Array.isArray(v)) return fail();
  return v.map((value) => {
    if (!isRecord(value)) return fail();
    return { id: id(value.id), name: room ? text(value.code) + ' (' + text(value.buildingName) + ')' : text(value.name), ...(room ? { buildingId: id(value.buildingId) } : {}) };
  });
}
