import { isLosslessNumber, parse } from 'lossless-json';
import { isRecord, safeInteger } from './assetCodec';
import { isAssetId } from '../utils/assetNavigation';
import { isMeterDate } from '../utils/meterNavigation';
import { meterDecimal } from '../utils/meterDecimal';
import type { ChargeItem, PeriodHeader, PeriodSummary, ProvisionalDetail } from '../types/provisionalCharge';

export const parseProvisionalJson = (text: string): unknown => parse(text);
const fail = (): never => { throw new Error('Invalid UC39 contract'); };
const text = (v: unknown): string => typeof v === 'string' && v.trim() ? v : fail();
const id = (v: unknown): string => isAssetId(v) ? v : fail();
const nullableId = (v: unknown) => v === null ? null : id(v);
const date = (v: unknown): string => typeof v === 'string' && isMeterDate(v) ? v : fail();
const nullableText = (v: unknown) => v === null ? null : text(v);
const count = (v: unknown) => safeInteger(v) ?? fail();
export const provisionalToken = (v: unknown): string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v) ? v : fail();
function money(v: unknown, signed = false): string | null {
  if (v === null) return null;
  if (!isLosslessNumber(v) || !/^-?\d+$/.test(v.toString())) return fail();
  const n = BigInt(v.toString());
  if (n < (signed ? -9223372036854775808n : 0n) || n > 9223372036854775807n) return fail();
  return n.toString();
}
function decimal(v: unknown): string | null {
  if (v === null) return null;
  return isLosslessNumber(v) ? meterDecimal(v.toString()) ?? fail() : fail();
}
export function decodeProvisionalHeader(v: unknown): PeriodHeader {
  if (!isRecord(v)) return fail();
  const fromDate = date(v.fromDate), toDate = date(v.toDate), cycleStart = date(v.cycleStart), cycleEnd = date(v.cycleEnd);
  if (fromDate >= toDate || cycleStart > fromDate || toDate > cycleEnd || v.periodStatus !== 'OPEN'
      || (v.invoiceStatus !== null && v.invoiceStatus !== 'DRAFT')) return fail();
  return { periodId: id(v.periodId), roomId: id(v.roomId), roomCode: text(v.roomCode), buildingName: text(v.buildingName),
    fromDate, toDate, cycleStart, cycleEnd, periodStatus: 'OPEN', invoiceStatus: v.invoiceStatus };
}
export function decodeProvisionalPeriods(v: unknown): PeriodHeader[] {
  if (!Array.isArray(v)) return fail();
  const periods = v.map(decodeProvisionalHeader);
  if (new Set(periods.map(p => p.periodId)).size !== periods.length) return fail();
  return periods;
}
export function decodeChargeItem(v: unknown): ChargeItem {
  if (!isRecord(v)) return fail();
  if (v.itemType !== 'SERVICE' && v.itemType !== 'FEE' && v.itemType !== 'DISCOUNT') return fail();
  if (v.chargeMethod !== 'METERED' && v.chargeMethod !== 'FIXED' && v.chargeMethod !== 'QUANTITY' && v.chargeMethod !== 'CUSTOM') return fail();
  if (v.status !== 'CALCULATED' && v.status !== 'MISSING_DATA') return fail();
  if (v.pricingSource !== null && v.pricingSource !== 'ROOM' && v.pricingSource !== 'BUILDING' && v.pricingSource !== 'CATALOG') return fail();
  const result: ChargeItem = { itemType: v.itemType, itemCode: id(v.itemCode), itemName: text(v.itemName), unit: text(v.unit),
    serviceId: nullableId(v.serviceId), roomServiceId: nullableId(v.roomServiceId), adjustmentId: nullableId(v.adjustmentId),
    chargeMethod: v.chargeMethod, startIndex: decimal(v.startIndex), endIndex: decimal(v.endIndex),
    consumption: decimal(v.consumption), quantity: decimal(v.quantity), manualAmount: money(v.manualAmount),
    unitPrice: money(v.unitPrice), prorateFactor: decimal(v.prorateFactor), basisDate: v.basisDate === null ? null : date(v.basisDate),
    pricingSource: v.pricingSource, amount: money(v.amount, true), status: v.status, missingReason: nullableText(v.missingReason) };
  if (result.itemType === 'SERVICE' ? !result.serviceId || !result.roomServiceId || result.adjustmentId !== null
    : !result.adjustmentId || result.serviceId !== null || result.roomServiceId !== null || result.chargeMethod !== 'CUSTOM') return fail();
  if (result.itemCode !== (result.roomServiceId ?? result.adjustmentId)) return fail();
  if (result.status === 'CALCULATED' ? result.amount === null || result.missingReason !== null
    : result.amount !== null || result.missingReason === null) return fail();
  if (result.amount !== null && (result.itemType === 'DISCOUNT' ? BigInt(result.amount) > 0n : BigInt(result.amount) < 0n)) return fail();
  return result;
}
function summary(v: unknown, items: ChargeItem[]): PeriodSummary {
  if (!isRecord(v) || !['FULL', 'PARTIAL', 'INSUFFICIENT_DATA', 'EMPTY'].includes(String(v.status))) return fail();
  const s: PeriodSummary = { status: v.status as PeriodSummary['status'], displayLabel: text(v.displayLabel), totalAmount: money(v.totalAmount, true),
    calculatedItemsCount: count(v.calculatedItemsCount), missingItemsCount: count(v.missingItemsCount) };
  const calculated = items.filter(i => i.status === 'CALCULATED').length, missing = items.length - calculated;
  if (s.calculatedItemsCount !== calculated || s.missingItemsCount !== missing) return fail();
  const expected = items.length === 0 ? 'EMPTY' : missing === 0 ? 'FULL' : calculated === 0 ? 'INSUFFICIENT_DATA' : 'PARTIAL';
  if (s.status !== expected || (expected === 'INSUFFICIENT_DATA' ? s.totalAmount !== null : s.totalAmount === null)
      || expected === 'EMPTY' && s.totalAmount !== '0') return fail();
  return s;
}
export function decodeProvisionalDetail(v: unknown, expected: { roomId: string; periodId: string }): ProvisionalDetail {
  if (!isRecord(v) || !Array.isArray(v.items) || typeof v.isStale !== 'boolean') return fail();
  const header = decodeProvisionalHeader(v), items = v.items.map(decodeChargeItem);
  const tenancyFromDate = date(v.tenancyFromDate), tenancyToDate = v.tenancyToDate === null ? null : date(v.tenancyToDate);
  if (header.roomId !== expected.roomId || header.periodId !== expected.periodId || header.fromDate < tenancyFromDate
      || tenancyToDate !== null && header.toDate > tenancyToDate || new Set(items.map(i => i.itemType + ':' + i.itemCode)).size !== items.length) return fail();
  return { ...header, rentalContractId: id(v.rentalContractId), tenancyId: id(v.tenancyId), tenancyFromDate, tenancyToDate,
    items, summary: summary(v.summary, items), concurrencyToken: provisionalToken(v.concurrencyToken), isStale: v.isStale };
}
