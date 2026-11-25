import type { DraftContext } from '../components/invoice/DraftEditor';
import type { DraftLine, DraftReview } from '../services/invoiceDraftApi';
import type { IssuanceResult } from './invoiceIssuance';

export type InvoiceSummary = {
  totalReceivable: string | number;
  totalPaid: string | number;
  totalRemaining: string | number;
  overdueCount: number;
  issuedCount: number;
};

export type InvoiceLocationItem = {
  building_id: string;
  building_name: string;
  room_id: string;
  room_code: string;
};

export type InvoiceListItem = DraftContext & Partial<DraftReview> & {
  id: string;
  period_id?: string;
  number: string | null;
  lifecycle: 'DRAFT' | 'ISSUED';
  from_date: string;
  to_date: string;
  due_date: string | null;
  issued_at: string | null;
  issued_by?: string | null;
  payment_reference?: string | null;
  scheduledBillingDate?: string;
  draft_created_at?: string;
  room_id?: string;
  room_code: string;
  building_id?: string;
  building_name: string;
  customer_name: string;
  contract_number?: string | null;
  rental_status?: string | null;
  total: string | null;
  paid_amount: string;
  remaining: string | null;
  payment_status: string | null;
  is_overdue: boolean;
  overdue_days?: number;
  pending_transfer_notice?: string | null;
};

export type InvoicePageResponse = {
  items: InvoiceListItem[];
  page: number;
  hasNext: boolean;
  summary?: InvoiceSummary | null;
  emptyMessage?: string | null;
};

export type InvoicePaymentItem = {
  id: string;
  paid_at: string;
  amount: string;
  method: string;
  status: string;
  receipt_id: string | null;
  note?: string | null;
  cancel_reason?: string | null;
};

export type PendingTransferItem = {
  id: string;
  amount: string;
  occurred_at: string;
  received_at?: string | null;
  status: string;
  content?: string | null;
  source_name?: string | null;
};

export type InvoiceTransferInfo = {
  status: string;
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  reference: string | null;
  amount: string | null;
  png: string | null;
  instructionMessage?: string | null;
};

export type InvoiceDetailResponse = {
  invoice: InvoiceListItem;
  lines: DraftLine[];
  payments: InvoicePaymentItem[];
  transfer: InvoiceTransferInfo;
  missingSnapshot: boolean;
  pendingTransfers?: PendingTransferItem[];
  issuance?: IssuanceResult;
};
