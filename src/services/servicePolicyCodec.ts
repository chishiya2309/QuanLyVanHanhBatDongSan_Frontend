import { isLosslessNumber, LosslessNumber, parse, stringify } from 'lossless-json';
import type { BuildingLookupItem, BuildingServicePolicy, ServicePolicy, UpdateServicePolicyInput } from '../types/servicePolicy';
import { isAssetId } from '../utils/assetNavigation';
import { catalogMoney, catalogVersion } from '../utils/serviceCatalogValidation';
import { isRecord } from './assetCodec';
import { decodeCatalogService } from './serviceCatalogCodec';

export const parsePolicyJson = (text: string): unknown => parse(text);

function timestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  const date = value.slice(0, 10);
  const parsed = new Date(date + 'T00:00:00Z');
  return Number(value.slice(11, 13)) < 24 &&
    Number(value.slice(14, 16)) < 60 &&
    Number(value.slice(17, 19)) < 60 &&
    Number.isFinite(Date.parse(value)) &&
    Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === date;
}

function parseMoney(value: unknown): string | null {
  if (value === null) return null;
  if (!isLosslessNumber(value)) return null;
  return catalogMoney(value.toString());
}

export function decodeBuildingServicePolicy(value: unknown): BuildingServicePolicy {
  if (!isRecord(value)) throw new Error('Invalid building service policy record');
  if (!isAssetId(value.configurationId)) throw new Error('Invalid configurationId');
  if (!isAssetId(value.buildingId)) throw new Error('Invalid buildingId');
  if (typeof value.buildingName !== 'string' || !value.buildingName.trim()) throw new Error('Invalid buildingName');
  if (typeof value.defaultForNewRoom !== 'boolean') throw new Error('Invalid defaultForNewRoom');
  if (typeof value.enabled !== 'boolean') throw new Error('Invalid enabled');
  if (!isAssetId(value.currentPriceRevisionId)) throw new Error('Invalid currentPriceRevisionId');
  if (!timestamp(value.effectiveFrom)) throw new Error('Invalid effectiveFrom');

  const unitPrice = value.unitPrice === null ? null : parseMoney(value.unitPrice);
  if (value.unitPrice !== null && unitPrice === null) throw new Error('Invalid unitPrice');
  if (value.prorate !== null && typeof value.prorate !== 'boolean') throw new Error('Invalid prorate');

  return {
    configurationId: value.configurationId,
    buildingId: value.buildingId,
    buildingName: value.buildingName,
    defaultForNewRoom: value.defaultForNewRoom,
    unitPrice,
    prorate: value.prorate as boolean | null,
    enabled: value.enabled,
    currentPriceRevisionId: value.currentPriceRevisionId,
    effectiveFrom: value.effectiveFrom,
  };
}

export function decodeServicePolicy(value: unknown): ServicePolicy {
  if (!isRecord(value)) throw new Error('Invalid service policy');
  const service = decodeCatalogService(value.service);
  if (typeof value.methodChangeAllowed !== 'boolean') throw new Error('Invalid methodChangeAllowed');
  if (value.prorate !== null && typeof value.prorate !== 'boolean') throw new Error('Invalid prorate');
  if (!Array.isArray(value.buildingConfigurations)) throw new Error('Invalid buildingConfigurations');

  const buildingConfigurations = value.buildingConfigurations.map(decodeBuildingServicePolicy);
  const configIds = new Set(buildingConfigurations.map((c) => c.configurationId));
  const buildingIds = new Set(buildingConfigurations.map((c) => c.buildingId));
  if (configIds.size !== buildingConfigurations.length || buildingIds.size !== buildingConfigurations.length) {
    throw new Error('Duplicate building configuration');
  }

  return {
    service,
    prorate: value.prorate as boolean | null,
    methodChangeAllowed: value.methodChangeAllowed,
    buildingConfigurations,
  };
}

export function decodeBuildingLookupList(value: unknown): BuildingLookupItem[] {
  if (!Array.isArray(value)) throw new Error('Invalid building lookup response');
  const result: BuildingLookupItem[] = [];
  const ids = new Set<string>();

  for (const item of value) {
    if (!isRecord(item)) throw new Error('Invalid building item');
    if (!isAssetId(item.id)) throw new Error('Invalid building id');
    if (ids.has(item.id)) throw new Error('Duplicate building in lookup');
    ids.add(item.id);
    if (typeof item.name !== 'string' || !item.name.trim()) throw new Error('Invalid building name');
    const areaName = typeof item.areaName === 'string' ? item.areaName : '';
    const address = typeof item.address === 'string' ? item.address : '';
    const active = typeof item.active === 'boolean' ? item.active : true;

    result.push({
      id: item.id,
      name: item.name,
      areaName,
      address,
      active,
    });
  }

  return result;
}

export function encodeUpdateServicePolicyBody(input: UpdateServicePolicyInput): string {
  const versionNorm = catalogVersion(input.version);
  if (versionNorm === null) throw new Error('Invalid version');

  const body: Record<string, unknown> = {
    version: new LosslessNumber(versionNorm),
  };

  if (input.method !== undefined) {
    body.method = input.method;
  }

  if (input.defaultPrice !== undefined) {
    const priceNorm = catalogMoney(input.defaultPrice);
    if (priceNorm === null) throw new Error('Invalid defaultPrice');
    body.defaultPrice = new LosslessNumber(priceNorm);
  }

  if (input.prorate !== undefined) {
    body.prorate = input.prorate;
  }

  if (input.buildings !== undefined) {
    if (!Array.isArray(input.buildings) || input.buildings.length === 0) {
      throw new Error('Empty buildings list');
    }
    body.buildings = input.buildings.map((b) => {
      if (!isAssetId(b.buildingId)) throw new Error('Invalid buildingId in buildings array');
      const item: Record<string, unknown> = { buildingId: b.buildingId };
      if (b.defaultForNewRoom !== undefined) {
        if (typeof b.defaultForNewRoom !== 'boolean') throw new Error('Invalid defaultForNewRoom');
        item.defaultForNewRoom = b.defaultForNewRoom;
      }
      return item;
    });
  }

  return stringify(body)!;
}
