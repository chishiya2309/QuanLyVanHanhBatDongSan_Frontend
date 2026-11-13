import type { ContractParties } from './depositContract';

export type RentalStatus = 'DRAFT' | 'ACTIVE' | 'TERMINATED';

export interface RoomTenancy {
  id: string;
  roomId: string;
  roomCode: string;
  roomName: string;
  fromDate: string;
  toDate?: string;
  rent: number;
}

export interface RentalContract {
  id: string;
  contractNumber: string;
  status: RentalStatus;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  startDate: string;
  endDate: string;
  depositRequired: number;
  cycleMonths: number;
  billingAnchor: number;
  convertedFromDepositId?: string;
  convertedFromDepositNumber?: string;
  partySnapshot?: ContractParties;
  tenancies: RoomTenancy[];
  currentRoomId?: string;
  currentRoomCode?: string;
  currentRoomName?: string;
  currentRent?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConvertDepositToRentalInput {
  startDate: string;
  endDate: string;
  rent: number;
  depositRequired?: number;
  cycleMonths: number;
  billingAnchor: number;
}

export interface CreateRentalContractInput {
  customerId: string;
  roomId: string;
  startDate: string;
  endDate: string;
  rent: number;
  depositRequired: number;
  cycleMonths: number;
  billingAnchor?: number;
}

export interface UpdateActiveRentalContractInput {
  depositRequired?: number;
  cycleMonths?: number;
  billingAnchor?: number;
  note?: string;
}

export interface RentalContractFilterInput {
  keyword?: string;
  status?: RentalStatus;
  areaId?: string;
  buildingId?: string;
  roomId?: string;
  page?: number;
  size?: number;
}

export interface AvailableRoomForRental {
  id: string;
  code: string;
  name: string;
  buildingId?: string;
  buildingName?: string;
  floorId?: string;
  floorLevel?: number;
  area?: number;
  defaultRent?: number;
  defaultDeposit?: number;
  status: string;
}

export interface AvailableCustomerForRental {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  identityNo?: string;
}

export interface RentalContractRoute {
  keyword?: string;
  status?: RentalStatus;
  page?: number;
  create?: boolean;
  editId?: string;
  detailId?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}
