export type LookupMode = 'ALL' | 'CURRENT';
export interface LookupRoute {
  view: 'lookup' | 'history'; customerId: string | null; q: string; roomId: string;
  mode: LookupMode; page: number; size: number; invalid: boolean; returnTo: string;
}
export interface RentalStay {
  tenancyId: string; roomId: string; roomCode: string; roomName: string;
  buildingId: string; buildingName: string; contractId: string; contractNumber: string;
  contractStartDate: string; contractEndDate: string; fromDate: string; toDate: string | null;
  contractStatus: 'ACTIVE' | 'TERMINATED'; current: boolean;
}
export interface LookupCustomer {
  id: string; fullName: string; phone: string | null; identityType: 'CCCD' | 'PASSPORT' | null;
  identityNo: string | null; rentals: RentalStay[];
}
export interface LookupPage {
  content: LookupCustomer[]; page: number; size: number; totalElements: number; totalPages: number;
  first: boolean; last: boolean; requestedPage: number; pageReset: boolean;
}
export interface RentalHistory { customerId: string; items: RentalStay[] }
