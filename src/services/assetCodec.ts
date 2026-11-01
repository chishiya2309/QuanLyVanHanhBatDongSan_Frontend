import { isLosslessNumber, LosslessNumber, parse, stringify } from 'lossless-json';
import type { Asset, AssetConditionRecord, AssetPage } from '../types/assets';
import { isAssetId } from '../utils/assetNavigation';
import { isAssetState, normalizeMoney } from '../utils/assetValidation';

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export function safeInteger(value: unknown): number | null {
  const text = isLosslessNumber(value) ? value.toString() : typeof value === 'number' ? String(value) : '';
  if (!/^\d+$/.test(text)) return null;
  const result = Number(text);
  return Number.isSafeInteger(result) && result >= 0 ? result : null;
}
function timestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!parts) return false;
  const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3]);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate() &&
    Number(parts[4]) < 24 && Number(parts[5]) < 60 && Number(parts[6]) < 60 &&
    (!parts[7] || (Number(parts[7]) <= 18 && Number(parts[8]) < 60 && (Number(parts[7]) !== 18 || Number(parts[8]) === 0))) && Number.isFinite(Date.parse(value));
}
function note(value: unknown): value is string | null { return value === null || (typeof value === 'string' && value.length <= 2000); }
export function decodeAsset(value: unknown): Asset {
  if (!isRecord(value)) throw new Error('Invalid asset');
  const price = isLosslessNumber(value.purchaseValue) ? normalizeMoney(value.purchaseValue.toString()) : null;
  if (!isAssetId(value.assetId) || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 255 || price === null ||
      !isAssetState(value.condition) || !note(value.note) || !timestamp(value.createdAt) || !timestamp(value.updatedAt)) throw new Error('Invalid asset');
  return { assetId: value.assetId, name: value.name, purchaseValue: price, condition: value.condition, note: value.note, createdAt: value.createdAt, updatedAt: value.updatedAt };
}
export function decodeAssetPage(value: unknown): AssetPage {
  if (!isRecord(value) || !Array.isArray(value.content)) throw new Error('Invalid page');
  const page = safeInteger(value.page), size = safeInteger(value.size), totalElements = safeInteger(value.totalElements), totalPages = safeInteger(value.totalPages);
  if (page === null || page > 2147483647 || size === null || size < 1 || size > 100 || totalElements === null || totalPages === null ||
      totalPages !== Math.ceil(totalElements / size) || typeof value.first !== 'boolean' || typeof value.last !== 'boolean' ||
      value.first !== (page === 0) || value.last !== (page >= totalPages - 1)) throw new Error('Invalid page metadata');
  const content = value.content.map(decodeAsset);
  const expectedLength = Math.max(0, Math.min(size, totalElements - page * size));
  if (content.length !== expectedLength || new Set(content.map((asset) => asset.assetId)).size !== content.length) throw new Error('Invalid page content');
  return { content, page, size, totalElements, totalPages, first: value.first, last: value.last };
}
export function decodeConditionRecord(value: unknown): AssetConditionRecord {
  if (!isRecord(value) || !isAssetId(value.recordId) || !isAssetId(value.assetId) || !isAssetId(value.recordedByAccountId) ||
      !isAssetState(value.condition) || !timestamp(value.recordedAt) || !note(value.note)) throw new Error('Invalid condition record');
  return { recordId: value.recordId, assetId: value.assetId, condition: value.condition, recordedAt: value.recordedAt, recordedByAccountId: value.recordedByAccountId, note: value.note };
}
export function parseAssetJson(text: string): unknown { return parse(text); }
export function encodeAssetBody(value: { name: string; purchaseValue: string; note?: string | null }): string {
  const price = normalizeMoney(value.purchaseValue);
  if (price === null) throw new Error('Invalid money');
  const result = stringify({ name: value.name, purchaseValue: new LosslessNumber(price), ...(value.note !== undefined ? { note: value.note } : {}) });
  if (typeof result !== 'string') throw new Error('Invalid body');
  return result;
}
