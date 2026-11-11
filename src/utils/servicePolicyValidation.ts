import { chargeMethods, type ChargeMethod } from '../types/serviceCatalog';
import type {
  BuildingLookupItem,
  PolicyFieldErrors,
  ServicePolicy,
  UpdateServicePolicyInput,
} from '../types/servicePolicy';
import { catalogMoney, formatCatalogMoney } from './serviceCatalogValidation';

export interface ServicePolicyDraft {
  method: ChargeMethod;
  defaultPrice: string;
  prorate: boolean | null;
  existingBuildingFlags: Record<string, boolean>;
  newBuildings: Map<string, { building: BuildingLookupItem; defaultForNewRoom: boolean | null }>;
}

export function createPolicyDraft(snapshot: ServicePolicy): ServicePolicyDraft {
  const existingBuildingFlags: Record<string, boolean> = {};
  for (const config of snapshot.buildingConfigurations) {
    existingBuildingFlags[config.buildingId] = config.defaultForNewRoom;
  }

  return {
    method: snapshot.service.method,
    defaultPrice: snapshot.service.defaultPrice ?? '',
    prorate: snapshot.prorate,
    existingBuildingFlags,
    newBuildings: new Map(),
  };
}

export interface PolicyDiffResult {
  hasChanges: boolean;
  payload: UpdateServicePolicyInput | null;
  summary: string[];
  frozenBuildings: Array<{ buildingId: string; defaultForNewRoom?: boolean }>;
}

export function calculatePolicyDiff(
  snapshot: ServicePolicy,
  draft: ServicePolicyDraft,
): PolicyDiffResult {
  const summary: string[] = [];
  let methodChange: ChargeMethod | undefined;
  let priceChange: string | undefined;
  let prorateChange: boolean | undefined;

  // 1. Method change
  if (draft.method !== snapshot.service.method) {
    methodChange = draft.method;
    summary.push(`Đổi phương pháp tính: ${chargeMethods[snapshot.service.method]} → ${chargeMethods[draft.method]}`);
  }

  // 2. Price change
  const draftPriceTrim = draft.defaultPrice.trim();
  const normalizedDraftPrice = draftPriceTrim === '' ? null : catalogMoney(draftPriceTrim);
  const snapshotPrice = snapshot.service.defaultPrice;

  if (normalizedDraftPrice !== null && normalizedDraftPrice !== snapshotPrice) {
    priceChange = normalizedDraftPrice;
    const oldDisplay = snapshotPrice === null ? 'Chưa thiết lập' : formatCatalogMoney(snapshotPrice);
    const newDisplay = formatCatalogMoney(normalizedDraftPrice);
    summary.push(`Đổi đơn giá danh mục: ${oldDisplay} → ${newDisplay}`);
  }

  // 3. Prorate change (only when final method is FIXED)
  const isFinalFixed = draft.method === 'FIXED';
  if (isFinalFixed && draft.prorate !== null && draft.prorate !== snapshot.prorate) {
    prorateChange = draft.prorate;
    const oldProrate = snapshot.prorate === null ? 'Chưa thiết lập' : snapshot.prorate ? 'Có' : 'Không';
    const newProrate = draft.prorate ? 'Có' : 'Không';
    summary.push(`Đổi chính sách ngày lẻ: ${oldProrate} → ${newProrate}`);
  }

  // 4. Building changes
  const frozenBuildings: Array<{ buildingId: string; defaultForNewRoom?: boolean }> = [];

  // 4a. Existing configurations with modified defaultForNewRoom
  for (const config of snapshot.buildingConfigurations) {
    const draftFlag = draft.existingBuildingFlags[config.buildingId];
    if (typeof draftFlag === 'boolean' && draftFlag !== config.defaultForNewRoom) {
      frozenBuildings.push({
        buildingId: config.buildingId,
        defaultForNewRoom: draftFlag,
      });
      summary.push(
        `Cập nhật tự áp dụng cho phòng mới tại "${config.buildingName}": ${config.defaultForNewRoom ? 'Bật' : 'Tắt'} → ${draftFlag ? 'Bật' : 'Tắt'}`,
      );
    }
  }

  // 4b. Newly selected buildings
  for (const [buildingId, item] of draft.newBuildings.entries()) {
    frozenBuildings.push({
      buildingId,
      defaultForNewRoom: item.defaultForNewRoom ?? undefined,
    });
    summary.push(
      `Thêm tòa nhà áp dụng "${item.building.name}" (Tự áp dụng cho phòng mới: ${item.defaultForNewRoom === true ? 'Có' : item.defaultForNewRoom === false ? 'Không' : 'Chưa chọn'})`,
    );
  }

  const hasMethodChange = methodChange !== undefined;
  const hasPriceChange = priceChange !== undefined;
  const hasProrateChange = prorateChange !== undefined;
  const hasBuildingChanges = frozenBuildings.length > 0;

  const hasChanges = hasMethodChange || hasPriceChange || hasProrateChange || hasBuildingChanges;

  if (!hasChanges) {
    return {
      hasChanges: false,
      payload: null,
      summary: [],
      frozenBuildings: [],
    };
  }

  const payload: UpdateServicePolicyInput = {
    version: snapshot.service.version,
    ...(hasMethodChange ? { method: methodChange } : {}),
    ...(hasPriceChange ? { defaultPrice: priceChange } : {}),
    ...(hasProrateChange ? { prorate: prorateChange } : {}),
    ...(hasBuildingChanges ? { buildings: frozenBuildings } : {}),
  };

  return {
    hasChanges: true,
    payload,
    summary,
    frozenBuildings,
  };
}

export function validatePolicyDraft(
  snapshot: ServicePolicy,
  draft: ServicePolicyDraft,
  diff: PolicyDiffResult,
): { errors: PolicyFieldErrors; firstErrorField: string | null } {
  const errors: PolicyFieldErrors = {};

  // Method locked validation
  if (!snapshot.methodChangeAllowed && draft.method !== snapshot.service.method) {
    errors.method = 'Dịch vụ đã phát sinh sử dụng hoặc hóa đơn nên không được đổi phương pháp';
  }

  // Price validation if modified
  const draftPriceTrim = draft.defaultPrice.trim();
  if (draftPriceTrim !== '') {
    const validMoney = catalogMoney(draftPriceTrim);
    if (validMoney === null) {
      errors.defaultPrice = 'Đơn giá phải là số nguyên VND không âm, tối đa 19 chữ số';
    }
  }

  // Prorate without price on unconfigured service
  const isFinalFixed = draft.method === 'FIXED';
  const effectivePrice = draftPriceTrim !== '' ? catalogMoney(draftPriceTrim) : snapshot.service.defaultPrice;

  if (isFinalFixed && draft.prorate !== null) {
    if (effectivePrice === null) {
      errors.defaultPrice = 'Vui lòng thiết lập đơn giá danh mục trước khi đặt chính sách ngày lẻ';
      if (!errors.prorate) {
        errors.prorate = 'Dịch vụ cần có đơn giá để áp dụng chính sách ngày lẻ';
      }
    }
  }

  // New buildings requirements:
  if (draft.newBuildings.size > 0) {
    if (!snapshot.service.active) {
      errors.buildings = 'Cần bật dịch vụ qua Danh mục dịch vụ trước khi tạo cấu hình áp dụng mới';
    }

    if (snapshot.service.pricingStatus !== 'CONFIGURED' && effectivePrice === null) {
      errors.defaultPrice = 'Vui lòng thiết lập đơn giá danh mục trước khi thêm tòa nhà áp dụng';
    }

    // Check each new building has explicit defaultForNewRoom
    let buildingIndex = 0;
    for (const item of diff.frozenBuildings) {
      const newEntry = draft.newBuildings.get(item.buildingId);
      if (newEntry && newEntry.defaultForNewRoom === null) {
        errors[`buildings[${buildingIndex}].defaultForNewRoom`] = 'Vui lòng chọn mặc định cho phòng mới';
        errors[`newBuilding_${item.buildingId}`] = 'Vui lòng chọn mặc định cho phòng mới';
      }
      buildingIndex++;
    }
  }

  const keys = Object.keys(errors);
  const firstErrorField = keys.length > 0 ? keys[0] : null;

  return { errors, firstErrorField };
}

export function isDraftDirty(snapshot: ServicePolicy | null, draft: ServicePolicyDraft | null): boolean {
  if (!snapshot || !draft) return false;
  return calculatePolicyDiff(snapshot, draft).hasChanges;
}
