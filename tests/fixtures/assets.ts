import { stringify, LosslessNumber } from 'lossless-json';
import { assetMessages as m, type Asset, type AssetQuery } from '../../src/types/assets';

export const assetId = '11111111-1111-4111-8111-111111111111';
export const secondAssetId = '22222222-2222-4222-8222-222222222222';
export const assetFixture: Asset = { assetId, name: 'Máy lạnh Daikin 1.5 HP', purchaseValue: '9007199254740993', condition: 'GOOD', note: 'Tài sản mua lại từ chủ cũ', createdAt: '2026-10-31T17:00:00Z', updatedAt: '2026-11-01T02:35:00Z' };
export function assetWire(asset: Asset) { return { ...asset, purchaseValue: new LosslessNumber(asset.purchaseValue) }; }
export function assetReply(data: unknown, message: string = m.detailSuccess, status = 200) {
  return new Response(stringify({ status, message, data }), { status, headers: { 'Content-Type': 'application/json' } });
}
export function assetPageReply(query: AssetQuery = { q: '', page: 0, size: 20 }, rows: Asset[] = [assetFixture], total = rows.length) {
  return assetReply({ content: rows.map(assetWire), page: query.page, size: query.size, totalElements: total, totalPages: Math.ceil(total / query.size), first: query.page === 0, last: query.page >= Math.ceil(total / query.size) - 1 }, m.listSuccess);
}
