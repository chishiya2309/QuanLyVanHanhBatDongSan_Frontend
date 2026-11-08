import { isLosslessNumber, LosslessNumber, parse, stringify } from 'lossless-json';
import { chargeMethods, type CatalogService } from '../types/serviceCatalog';
import { catalogMoney, catalogVersion } from '../utils/serviceCatalogValidation';
import { isAssetId } from '../utils/assetNavigation';
import { isRecord } from './assetCodec';

export const parseCatalogJson = (text: string): unknown => parse(text);
function integer(value: unknown, normalize: (value: string) => string | null): string | null {
  return isLosslessNumber(value) ? normalize(value.toString()) : null;
}
function timestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  const date = value.slice(0, 10); const parsed = new Date(date + 'T00:00:00Z');
  return Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60 && Number(value.slice(17, 19)) < 60 &&
    Number.isFinite(Date.parse(value)) && Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
}
export function decodeCatalogService(value: unknown): CatalogService {
  if (!isRecord(value)) throw new Error('Invalid catalog service');
  const version = integer(value.version, catalogVersion);
  const price = value.defaultPrice === null ? null : integer(value.defaultPrice, catalogMoney);
  if (!isAssetId(value.id) || ![null, 'ELECTRICITY', 'WATER'].includes(value.systemCode as string | null) ||
      typeof value.name !== 'string' || !value.name.trim() || value.name.length > 255 ||
      typeof value.unit !== 'string' || !value.unit.trim() || value.unit.length > 50 ||
      typeof value.method !== 'string' || !Object.hasOwn(chargeMethods, value.method) || typeof value.active !== 'boolean' || version === null) throw new Error('Invalid catalog fields');
  if (value.pricingStatus === 'UNCONFIGURED') {
    if (!value.systemCode || value.active || value.defaultPrice !== null || value.currentPriceRevisionId !== null || value.effectiveFrom !== null) throw new Error('Invalid unconfigured service');
  } else if (value.pricingStatus !== 'CONFIGURED' || price === null || !isAssetId(value.currentPriceRevisionId) || !timestamp(value.effectiveFrom)) throw new Error('Invalid catalog price');
  return { id: value.id, systemCode: value.systemCode as CatalogService['systemCode'], name: value.name, unit: value.unit,
    method: value.method as CatalogService['method'], active: value.active, pricingStatus: value.pricingStatus,
    defaultPrice: price, currentPriceRevisionId: value.currentPriceRevisionId as string | null, effectiveFrom: value.effectiveFrom as string | null, version };
}
export function decodeCatalogList(value: unknown): CatalogService[] {
  if (!Array.isArray(value)) throw new Error('Invalid catalog list');
  const result = value.map(decodeCatalogService);
  if (new Set(result.map((item) => item.id)).size !== result.length) throw new Error('Duplicate catalog service');
  return result;
}
export function encodeCatalogBody(fields: Record<string, string | boolean>): string {
  const body: Record<string, string | boolean | LosslessNumber> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'defaultPrice' || key === 'version') {
      const normalized = typeof value === 'string' ? (key === 'defaultPrice' ? catalogMoney(value) : catalogVersion(value)) : null;
      if (normalized === null) throw new Error('Invalid catalog number');
      body[key] = new LosslessNumber(normalized);
    } else body[key] = value;
  }
  return stringify(body)!;
}
