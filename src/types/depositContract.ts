export type DepositStatus = 'DRAFT' | 'RESERVED' | 'CONVERTED' | 'CANCELLED';

export interface ContractParties {
  hostName?: string;
  hostAddress?: string;
  customerName?: string;
  identityNo?: string;
  phone?: string;
}

export interface DepositContract {
  id: string;
  contractNumber: string;
  status: DepositStatus;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  roomId: string;
  roomCode: string;
  roomName: string;
  buildingName: string;
  floorLevel: number;
  amountRequired: number;
  reservedFrom: string;
  moveInDate: string;
  note?: string;
  partySnapshot?: ContractParties;
  cancelledAt?: string;
  cancelReason?: string;
  convertedToRentalId?: string;
  convertedToRentalNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CancelDepositContractInput {
  reason: string;
}

export interface AvailableRoomForDeposit {
  id: string;
  code: string;
  name: string;
  buildingId: string;
  buildingName: string;
  floorId: string;
  floorLevel: number;
  area: number;
  defaultRent: number;
  defaultDeposit: number;
  status: string;
}

export interface AvailableCustomerForDeposit {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  identityNo?: string;
}

export interface QuickCreateCustomerInput {
  fullName: string;
  phone?: string;
  email?: string;
  identityNo?: string;
}

export interface CreateDepositContractInput {
  customerId: string;
  roomId: string;
  reservedFrom: string;
  amountRequired: number;
  moveInDate: string;
  note?: string;
}

export interface UpdateDepositContractInput {
  customerId: string;
  roomId: string;
  reservedFrom: string;
  amountRequired: number;
  moveInDate: string;
  note?: string;
}

export interface DepositContractFilter {
  keyword?: string;
  status?: DepositStatus;
  roomId?: string;
  page?: number;
  size?: number;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface DepositContractRoute {
  create?: boolean;
  detailId?: string;
  editId?: string;
  keyword?: string;
  status?: DepositStatus;
  page?: number;
}

