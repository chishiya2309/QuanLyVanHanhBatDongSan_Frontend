import { invoiceRequest } from './invoiceApi';

export const billingScheduleStatuses = [
  'CHUA_DEN_KY', 'SAP_DEN_KY', 'DEN_KY', 'QUA_HAN', 'DA_CO_BAN_NHAP', 'DA_PHAT_HANH',
] as const;

export type BillingScheduleStatus = typeof billingScheduleStatuses[number];
export type BillingScheduleAction = 'CREATE_INVOICE' | 'OPEN_DRAFT' | 'VIEW_INVOICE' | 'DISABLED';

export interface CycleSegment {
  roomId: string | null;
  roomName: string | null;
  segmentStart: string;
  segmentEnd: string;
  actualDays: number;
}

export interface BillingScheduleItem {
  contractId: string;
  roomId: string | null;
  roomName: string | null;
  propertyId: string | null;
  propertyName: string | null;
  representativeTenantName: string | null;
  billingCycleMonths: number | null;
  anchorDay: number | null;
  cycleStart: string | null;
  cycleEnd: string | null;
  expectedClosingDate: string | null;
  status: BillingScheduleStatus;
  overdueDays: number;
  actionType: BillingScheduleAction;
  existingInvoiceId: string | null;
  hasRoomTransferInCycle: boolean;
  cycleSegments: CycleSegment[];
  dataValid: boolean;
  warningMessage: string | null;
}

export interface BillingScheduleSummary {
  overdueCount: number;
  dueCount: number;
  upcomingCount: number;
  draftCount: number;
  issuedCount: number;
  totalActiveContracts: number;
}

export interface BillingScheduleOverview {
  summary: BillingScheduleSummary;
  items: BillingScheduleItem[];
  emptyStateMessage: string | null;
}

export interface BillingScheduleFilterRequest {
  propertyId?: string | null;
  status?: readonly BillingScheduleStatus[] | null;
  month?: number | null;
  year?: number | null;
}

export function billingScheduleQuery(filter: BillingScheduleFilterRequest): string {
  const params = new URLSearchParams();
  if (filter.propertyId?.trim()) params.set('propertyId', filter.propertyId.trim());
  for (const status of billingScheduleStatuses) {
    if (filter.status?.includes(status)) params.append('status', status);
  }
  if (filter.month != null) params.set('month', String(filter.month));
  if (filter.year != null) params.set('year', String(filter.year));
  return params.toString();
}

export function fetchBillingSchedules(filter: BillingScheduleFilterRequest = {}, signal?: AbortSignal) {
  const query = billingScheduleQuery(filter);
  return invoiceRequest<BillingScheduleOverview>('/billing-schedules' + (query ? '?' + query : ''), signal);
}
