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

