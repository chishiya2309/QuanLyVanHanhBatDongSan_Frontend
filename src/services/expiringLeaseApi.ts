import { isLosslessNumber, parse } from 'lossless-json';
import { authenticatedFetch } from './sessionClient';
import { getCsrfToken } from './csrfClient';
import { AuthApiError } from './authErrors';
import { isRecord, safeInteger } from './assetCodec';
import { expiryParams, type ExpiringLeaseQuery } from '../utils/expiringLeaseNavigation';

export const expiryBuckets = ['OVERDUE', 'DAYS_0_TO_7', 'DAYS_8_TO_30', 'OVER_30'] as const;
export type ExpiryBucket = typeof expiryBuckets[number];

function record(value: unknown) {
  if (!isRecord(value)) throw new Error('Invalid expiry report object');
  return value;
}

function string(value: unknown) {
  if (typeof value !== 'string') throw new Error('Invalid expiry report text');
  return value;
}

function integer(value: unknown, min = 0) {
  const result = safeInteger(value);
  if (result === null || result < min) throw new Error('Invalid expiry report number');
  return result;
}

function signedDays(value: unknown) {
  const text = isLosslessNumber(value) ? value.value : typeof value === 'number' ? String(value) : '';
  const days = Number(text);
  if (!/^-?\d+$/.test(text) || !Number.isSafeInteger(days)) throw new Error('Invalid days remaining');
  return days;
}

function money(value: unknown) {
  if (value == null) return null;
  const decimal = isLosslessNumber(value) ? value.value : value;
  if (typeof decimal !== 'string' || !/^\d+(?:\.\d+)?$/.test(decimal)) throw new Error('Invalid expiry deposit amount');
  return decimal;
}

function nullableString(value: unknown) {
  return value == null ? null : string(value);
}

function list<T>(value: unknown, decode: (item: Record<string, unknown>) => T) {
  if (!Array.isArray(value)) throw new Error('Invalid expiry report list');
  return value.map(item => decode(record(item)));
}

function decodeLease(item: Record<string, unknown>) {
  return {
    contractId: string(item.contractId), contractNumber: string(item.contractNumber),
    roomId: string(item.roomId), roomCode: string(item.roomCode), buildingName: string(item.buildingName),
    customerName: nullableString(item.customerName), customerPhone: nullableString(item.customerPhone),
    effectiveEndDate: string(item.effectiveEndDate),
    daysRemaining: signedDays(item.daysRemaining),
    handoverStatus: nullableString(item.handoverStatus),
    depositRequired: money(item.depositRequired), depositHeld: money(item.depositHeld),
  };
}

function decodeReport(value: unknown) {
  const data = record(value);
  const filter = record(data.filter);
  const kpi = record(data.kpi);
  const page = record(data.page);
  const generatedAt = string(data.generatedAt);
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('Invalid expiry report timestamp');
  return {
    generatedAt,
    asOfDate: string(data.asOfDate),
    filter: { fromDate: string(filter.fromDate), toDate: string(filter.toDate) },
    kpi: {
      expiringContracts: integer(kpi.expiringContracts),
      expiringRooms: integer(kpi.expiringRooms),
      overdueContracts: integer(kpi.overdueContracts),
    },
    expiryGroups: list(data.expiryGroups, group => {
      const bucket = expiryBuckets.find(value => value === group.bucket);
      if (!bucket) throw new Error('Invalid expiry group');
      return { bucket, total: integer(group.total), items: list(group.items, decodeLease) };
    }),
    page: {
      page: integer(page.page), size: integer(page.size, 1),
      totalElements: integer(page.totalElements), totalPages: integer(page.totalPages),
    },
    warnings: list(data.warnings, warning => ({
      code: string(warning.code), contractId: string(warning.contractId), roomId: nullableString(warning.roomId),
    })),
  };
}

function decodeThreshold(value: unknown) {
  const data = record(value);
  const days = integer(data.expiryThresholdDays, 1);
  const source = data.source;
  if (days > 365 || (source !== 'BACKEND_DEFAULT' && source !== 'HOST_OVERRIDE')) throw new Error('Invalid expiry threshold');
  return { days, source };
}

export type ExpiringLease = ReturnType<typeof decodeLease>;
export type ExpiringLeaseReport = ReturnType<typeof decodeReport>;
export type ExpiryThreshold = ReturnType<typeof decodeThreshold>;

const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
const thresholdPath = '/host/settings/expiry-threshold';

async function request(path: string, init: RequestInit, trackNavigation = true) {
  const response = await authenticatedFetch(base + path, {
    cache: 'no-store', credentials: 'include', ...init,
  }, { trackNavigation });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new AuthApiError(response.status, isRecord(body) && typeof body.message === 'string' ? body.message : '');
  }
  const body = record(parse(await response.text()));
  if (integer(body.status) !== 200) throw new Error('Invalid expiry response');
  return body.data;
}

export async function getExpiringLeaseReport(query: ExpiringLeaseQuery, signal?: AbortSignal) {
  return decodeReport(await request('/reports/expiring-leases?' + expiryParams(query), { signal }));
}

export async function getExpiryThreshold(signal?: AbortSignal) {
  return decodeThreshold(await request(thresholdPath, { signal }, false));
}

export async function updateExpiryThreshold(days: number, signal?: AbortSignal) {
  const csrf = await getCsrfToken();
  return decodeThreshold(await request(thresholdPath, {
    method: 'PUT', signal, headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
    body: JSON.stringify({ expiryThresholdDays: days }),
  }, false));
}
