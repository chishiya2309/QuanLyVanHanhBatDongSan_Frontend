import { LosslessNumber, stringify } from 'lossless-json';
import { catalogMessages as m, type CatalogService } from '../../src/types/serviceCatalog';

export const electricityId = '11111111-1111-4111-8111-111111111111';
export const waterId = '22222222-2222-4222-8222-222222222222';
export const internetId = '33333333-3333-4333-8333-333333333333';
export const revisionId = '44444444-4444-4444-8444-444444444444';
export const electricity: CatalogService = { id: electricityId, systemCode: 'ELECTRICITY', name: 'Điện', unit: 'kWh', method: 'METERED', active: false,
  pricingStatus: 'UNCONFIGURED', defaultPrice: null, currentPriceRevisionId: null, effectiveFrom: null, version: '0' };
export const internet: CatalogService = { ...electricity, id: internetId, systemCode: null, name: 'Internet', unit: 'tháng', method: 'FIXED', active: true,
  pricingStatus: 'CONFIGURED', defaultPrice: '100000', currentPriceRevisionId: revisionId, effectiveFrom: '2026-11-01T00:00:00.000001Z', version: '7' };
export const catalogFixtures: CatalogService[] = [electricity, { ...electricity, id: waterId, name: 'Nước', unit: 'm³', systemCode: 'WATER' }, internet];
export function catalogWire(item: CatalogService) { return { ...item, defaultPrice: item.defaultPrice === null ? null : new LosslessNumber(item.defaultPrice), version: new LosslessNumber(item.version) }; }
export function catalogReply(data: unknown, message: string = m.detailSuccess, status = 200) {
  return new Response(stringify({ status, message, data }), { status, headers: { 'Content-Type': 'application/json' } });
}
