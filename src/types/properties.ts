// Types and definitions for UC10 - UC15 (Real Estate Module: Areas, Buildings, Floors, Rooms)

export type RoomStatus = 'VACANT' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE';

export interface Area {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAreaInput {
  name: string;
  description?: string | null;
}

export interface UpdateAreaInput {
  name: string;
  description?: string | null;
}

export interface Building {
  id: string;
  areaId: string;
  areaName: string;
  name: string;
  address: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBuildingInput {
  areaId: string;
  name: string;
  address: string;
}

export interface UpdateBuildingInput {
  name: string;
  address: string;
}

export interface ChangeBuildingAreaInput {
  targetAreaId: string;
}

export interface Floor {
  id: string;
  buildingId: string;
  name: string;
  level: number;
  roomCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFloorInput {
  name: string;
  level: number;
}

export interface UpdateFloorInput {
  name: string;
  level: number;
}

export interface Room {
  id: string;
  buildingId: string;
  buildingName?: string;
  floorId: string;
  floorName?: string;
  floorLevel?: number;
  code: string;
  name: string;
  area: number;
  defaultRent: number;
  defaultDeposit: number;
  maintenance: boolean;
  status: RoomStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoomDetail extends Room {
  canEditBasicInfo: boolean;
  hasActiveContractOrReservation: boolean;
  areaId?: string;
  areaName?: string;
}

export interface RoomSearchItem {
  id: string;
  code: string;
  name: string;
  area: number;
  defaultRent: number;
  defaultDeposit: number;
  areaId: string;
  areaName: string;
  buildingId: string;
  buildingName: string;
  floorId: string;
  floorName: string;
  floorLevel: number;
  status: RoomStatus;
  isMaintenance: boolean;
}

export interface RoomOverviewItem {
  id: string;
  code: string;
  name: string;
  status: RoomStatus;
  isMaintenance: boolean;
}

export interface FloorOverview {
  floorId: string;
  floorName: string;
  floorLevel: number;
  rooms: RoomOverviewItem[];
}

export interface BuildingOverview {
  buildingId: string;
  buildingName: string;
  address: string;
  floors: FloorOverview[];
}

export interface CreateRoomInput {
  floorId: string;
  code: string;
  name: string;
  area: number;
  defaultRent: number;
  defaultDeposit: number;
}

export interface UpdateRoomInput {
  code?: string;
  name?: string;
  area?: number;
  defaultRent: number;
  defaultDeposit: number;
}

export interface TenancyHistoryItem {
  tenancyId: string;
  contractNumber: string;
  customerName: string;
  customerPhone: string;
  fromDate: string;
  toDate: string | null;
  isCurrent: boolean;
}

export interface RoomStateHistoryItem {
  id: string;
  fromStatus: RoomStatus;
  toStatus: RoomStatus;
  changedAt: string;
  reason: string;
  actorName: string;
}

export interface RoomHistory {
  roomId: string;
  roomCode: string;
  tenancyHistory: TenancyHistoryItem[];
  stateHistory: RoomStateHistoryItem[];
}

export interface RoomFilterParams {
  keyword?: string;
  areaId?: string;
  buildingId?: string;
  floorId?: string;
  status?: string;
}

// Routes
export interface PropertiesRoute {
  tab: 'areas' | 'buildings';
  create?: boolean;
}

export interface RoomsRoute {
  view: 'matrix' | 'table';
  buildingId?: string | null;
  roomId?: string | null;
  action?: 'create' | 'edit' | 'detail' | 'history' | null;
  floorId?: string | null;
}

