import { isLosslessNumber, LosslessNumber, parse, stringify } from 'lossless-json';
import { isRecord } from './assetCodec';
import { isAssetId } from '../utils/assetNavigation';
import { isMeterDate } from '../utils/meterNavigation';
import type {
  AdjustmentItem,
  CustomServiceItem,
  QuantityServiceItem,
  SavedAdjustmentResponse,
  SavedUsageResponse,
  ServiceUsageItem,
  UsageContext,
  RecordQuantityPayload,
  RecordCustomFeePayload,
  AddFeeAdjustmentPayload,
  AddDiscountAdjustmentPayload
} from '../types/periodUsage';

export const parseUsageJson = (text: string): unknown => parse(text);

const fail = (msg = 'Invalid UC38 contract'): never => { throw new Error(msg); };
const text = (v: unknown): string => typeof v === 'string' && v.trim() ? v : fail();
const id = (v: unknown): string => isAssetId(v) ? v : fail();
const bool = (v: unknown): boolean => typeof v === 'boolean' ? v : fail();
const date = (v: unknown): string => typeof v === 'string' && isMeterDate(v) ? v : fail();
const integerNum = (v: unknown): number => {
  if (typeof v === 'number' && Number.isSafeInteger(v)) return v;
  if (isLosslessNumber(v)) {
    const n = Number(v.toString());
    if (Number.isSafeInteger(n)) return n;
  }
  return fail('Expected safe integer');
};
const nullableInteger = (v: unknown): number | null => v === null ? null : integerNum(v);

function decimalString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (isLosslessNumber(v)) return v.toString();
  return fail('Expected decimal number');
}

export function decodeQuantityServiceItem(v: unknown): QuantityServiceItem {
  if (!isRecord(v)) return fail();
  return {
    roomServiceId: id(v.roomServiceId),
    serviceName: text(v.serviceName),
    unit: text(v.unit),
    defaultQuantity: decimalString(v.defaultQuantity),
    isRecorded: bool(v.isRecorded),
    recordedQuantity: decimalString(v.recordedQuantity)
  };
}

export function decodeCustomServiceItem(v: unknown): CustomServiceItem {
  if (!isRecord(v)) return fail();
  return {
    roomServiceId: id(v.roomServiceId),
    serviceName: text(v.serviceName),
    unit: text(v.unit),
    isRecorded: bool(v.isRecorded),
    recordedAmount: nullableInteger(v.recordedAmount)
  };
}

export function decodeServiceUsageItem(v: unknown): ServiceUsageItem {
  if (!isRecord(v)) return fail();
  return {
    id: id(v.id),
    periodId: id(v.periodId),
    roomServiceId: id(v.roomServiceId),
    serviceName: text(v.serviceName),
    method: text(v.method),
    quantity: decimalString(v.quantity),
    manualAmount: nullableInteger(v.manualAmount),
    recordedAt: text(v.recordedAt)
  };
}

export function decodeAdjustmentItem(v: unknown): AdjustmentItem {
  if (!isRecord(v)) return fail();
  const typeStr = text(v.type);
  if (typeStr !== 'FEE' && typeStr !== 'DISCOUNT') return fail('Invalid adjustment type');
  return {
    id: id(v.id),
    periodId: id(v.periodId),
    type: typeStr as 'FEE' | 'DISCOUNT',
    description: text(v.description),
    amount: integerNum(v.amount),
    recordedAt: text(v.recordedAt)
  };
}

export function decodeUsageContext(v: unknown): UsageContext {
  if (!isRecord(v)) return fail();
  const fromDate = date(v.fromDate), toDate = date(v.toDate);
  const cycleStart = date(v.cycleStart), cycleEnd = date(v.cycleEnd);
  const periodStatus = v.periodStatus === 'OPEN' || v.periodStatus === 'SEALED' ? v.periodStatus : fail();

  const quantityServices = Array.isArray(v.quantityServices)
    ? v.quantityServices.map(decodeQuantityServiceItem)
    : fail();
  const customServices = Array.isArray(v.customServices)
    ? v.customServices.map(decodeCustomServiceItem)
    : fail();
  const rawUsages = v.existingServiceUsages ?? v.existingUsages;
  const existingUsages = Array.isArray(rawUsages)
    ? (rawUsages as unknown[]).map(decodeServiceUsageItem)
    : [];
  const existingAdjustments = Array.isArray(v.existingAdjustments)
    ? v.existingAdjustments.map(decodeAdjustmentItem)
    : [];

  return {
    periodId: id(v.periodId),
    roomId: id(v.roomId),
    roomCode: text(v.roomCode),
    buildingId: id(v.buildingId),
    buildingName: text(v.buildingName),
    fromDate,
    toDate,
    cycleStart,
    cycleEnd,
    periodStatus,
    invoiceStatus: typeof v.invoiceStatus === 'string' ? v.invoiceStatus : 'NONE',
    canRecord: bool(v.canRecord),
    concurrencyVersion: text(v.concurrencyVersion),
    quantityServices,
    customServices,
    existingUsages,
    existingAdjustments
  };
}

export function decodeSavedUsage(v: unknown): SavedUsageResponse {
  if (!isRecord(v)) return fail();
  return {
    id: id(v.id),
    periodId: id(v.periodId),
    roomServiceId: id(v.roomServiceId),
    serviceName: text(v.serviceName),
    quantity: decimalString(v.quantity),
    manualAmount: nullableInteger(v.manualAmount),
    recordedAt: text(v.recordedAt)
  };
}

export function decodeSavedAdjustment(v: unknown): SavedAdjustmentResponse {
  if (!isRecord(v)) return fail();
  const typeStr = text(v.type);
  if (typeStr !== 'FEE' && typeStr !== 'DISCOUNT') return fail();
  return {
    id: id(v.id),
    periodId: id(v.periodId),
    type: typeStr as 'FEE' | 'DISCOUNT',
    description: text(v.description),
    amount: integerNum(v.amount),
    recordedAt: text(v.recordedAt)
  };
}

export function encodeQuantityPayload(payload: RecordQuantityPayload): string {
  return stringify({
    periodId: payload.periodId,
    roomServiceId: payload.roomServiceId,
    quantity: new LosslessNumber(payload.quantity),
    concurrencyVersion: payload.concurrencyVersion || undefined
  }) || '{}';
}

export function encodeCustomFeePayload(payload: RecordCustomFeePayload): string {
  return stringify({
    periodId: payload.periodId,
    roomServiceId: payload.roomServiceId,
    amount: payload.amount,
    concurrencyVersion: payload.concurrencyVersion || undefined
  }) || '{}';
}

export function encodeFeeAdjustmentPayload(payload: AddFeeAdjustmentPayload): string {
  return stringify({
    periodId: payload.periodId,
    description: payload.description.trim(),
    amount: payload.amount,
    concurrencyVersion: payload.concurrencyVersion || undefined
  }) || '{}';
}

export function encodeDiscountAdjustmentPayload(payload: AddDiscountAdjustmentPayload): string {
  return stringify({
    periodId: payload.periodId,
    description: payload.description.trim(),
    amount: payload.amount,
    concurrencyVersion: payload.concurrencyVersion || undefined
  }) || '{}';
}
