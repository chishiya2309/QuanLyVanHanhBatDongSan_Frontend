export type HandoverType = 'MOVE_IN' | 'MOVE_OUT';
export type AssetState = 'GOOD' | 'DAMAGED' | 'REPAIRING' | 'RETIRED';
export type CatalogSystemCode = 'ELECTRICITY' | 'WATER' | 'INTERNET' | 'CLEANING' | 'PARKING' | 'OTHER';

export interface AvailableAssetItem {
  assetId: string;
  assetName: string;
  currentCondition: AssetState;
  note?: string;
  initialCondition?: AssetState;
  initialNote?: string;
}

export interface AvailableServiceItem {
  serviceId: string;
  serviceName: string;
  unit: string;
  systemCode?: CatalogSystemCode;
  initialIndex?: number | null;
}

export interface HandoverAssetItem {
  id?: string;
  assetId: string;
  assetName?: string;
  condition: AssetState;
  note?: string;
}

export interface HandoverMeterItem {
  id?: string;
  serviceId: string;
  serviceName?: string;
  unit?: string;
  systemCode?: CatalogSystemCode;
  indexValue: number;
  recordedAt?: string;
}

export interface MeterConsumption {
  serviceId: string;
  serviceName: string;
  unit: string;
  systemCode?: CatalogSystemCode;
  initialIndex?: number | null;
  finalIndex: number;
  consumption?: number | null;
}

export interface HandoverReport {
  id: string;
  contractId: string;
  contractNumber: string;
  tenancyId: string;
  roomId: string;
  roomCode: string;
  roomName: string;
  type: HandoverType;
  confirmed: boolean;
  occurredAt: string;
  roomCondition: string;
  recordedAt: string;
  createdByName?: string;
  assetItems: HandoverAssetItem[];
  meterItems: HandoverMeterItem[];
  damagedAssetsSummary?: string;
  meterConsumptions?: MeterConsumption[];
}

export interface HandoverTemplate {
  contractId: string;
  contractNumber: string;
  roomId: string;
  roomCode: string;
  roomName: string;
  customerName?: string;
  customerPhone?: string;
  startDate: string;
  endDate: string;
  hasConfirmedMoveIn: boolean;
  hasConfirmedMoveOut?: boolean;
  confirmedMoveInReport?: HandoverReport | null;
  draftReport?: HandoverReport | null;
  confirmedReport?: HandoverReport | null;
  availableAssets: AvailableAssetItem[];
  availableServices: AvailableServiceItem[];
}

export interface CreateHandoverReportInput {
  type: HandoverType;
  occurredAt: string;
  roomCondition?: string;
  confirmed: boolean;
  assetItems: {
    assetId: string;
    condition: AssetState;
    note?: string;
  }[];
  meterItems: {
    serviceId: string;
    indexValue: number;
  }[];
}
