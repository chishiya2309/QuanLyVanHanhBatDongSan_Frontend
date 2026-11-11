import { LosslessNumber, stringify } from 'lossless-json';
import { catalogWire, electricity, internet } from './serviceCatalog';
import type {
  BuildingLookupItem,
  BuildingServicePolicy,
  ServicePolicy,
} from '../../src/types/servicePolicy';
import { servicePolicyMessages as m } from '../../src/types/servicePolicy';

export const building1Id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const building2Id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const building3Id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

export const config1Id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
export const config2Id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
export const revision1Id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

export const building1: BuildingLookupItem = {
  id: building1Id,
  name: 'Tòa nhà Landmark',
  areaName: 'Khu đô thị Trung tâm',
  address: 'Số 10 Mai Chí Thọ, TP Thủ Đức',
  active: true,
};

export const building2: BuildingLookupItem = {
  id: building2Id,
  name: 'Tòa nhà Sunrise',
  areaName: 'Khu đô thị Sala',
  address: 'Số 12 Nguyễn Cơ Thạch, TP Thủ Đức',
  active: true,
};

export const building3: BuildingLookupItem = {
  id: building3Id,
  name: 'Chung cư Blue Sky',
  areaName: 'Bình Thạnh',
  address: 'Số 45 Điện Biên Phủ, Bình Thạnh',
  active: false,
};

export const fixtureBuildings: BuildingLookupItem[] = [building1, building2, building3];

export const buildingConfig1: BuildingServicePolicy = {
  configurationId: config1Id,
  buildingId: building1Id,
  buildingName: 'Tòa nhà Landmark',
  defaultForNewRoom: true,
  unitPrice: null,
  prorate: null,
  enabled: true,
  currentPriceRevisionId: revision1Id,
  effectiveFrom: '2026-11-06T07:00:00Z',
};

export const buildingConfig2: BuildingServicePolicy = {
  configurationId: config2Id,
  buildingId: building2Id,
  buildingName: 'Tòa nhà Sunrise',
  defaultForNewRoom: false,
  unitPrice: '120000',
  prorate: true,
  enabled: true,
  currentPriceRevisionId: revision1Id,
  effectiveFrom: '2026-11-06T07:00:00Z',
};

export const internetPolicy: ServicePolicy = {
  service: internet,
  prorate: true,
  methodChangeAllowed: true,
  buildingConfigurations: [buildingConfig1, buildingConfig2],
};

export const electricityPolicy: ServicePolicy = {
  service: electricity,
  prorate: null,
  methodChangeAllowed: true,
  buildingConfigurations: [],
};

export const lockedMethodPolicy: ServicePolicy = {
  ...internetPolicy,
  methodChangeAllowed: false,
};

export function buildingPolicyWire(config: BuildingServicePolicy) {
  return {
    ...config,
    unitPrice: config.unitPrice === null ? null : new LosslessNumber(config.unitPrice),
  };
}

export function policyWire(policy: ServicePolicy) {
  return {
    service: catalogWire(policy.service),
    prorate: policy.prorate,
    methodChangeAllowed: policy.methodChangeAllowed,
    buildingConfigurations: policy.buildingConfigurations.map(buildingPolicyWire),
  };
}

export function policyReply(data: unknown, message: string = m.getSuccess, status = 200) {
  return new Response(stringify({ status, message, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
