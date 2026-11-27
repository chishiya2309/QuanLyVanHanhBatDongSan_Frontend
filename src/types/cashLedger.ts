export type CashLedgerDirection = 'IN' | 'OUT';

export type CashLedgerOrigin =
  | 'INVOICE_PAYMENT'
  | 'DEPOSIT_RECEIPT'
  | 'DEPOSIT_REFUND'
  | 'MANUAL'
  | 'REVERSAL'
  | 'INTERNAL_TRANSFER';

export type CashLedgerScopeType = 'ALL' | 'COMMON_EXPENSE' | 'AREA' | 'BUILDING' | 'ROOM';

export type CashLedgerEmptyState = 'NO_DATA' | 'NO_MATCH';

export interface CashLedgerFilterState {
  fromDate: string;
  toDate: string;
  direction?: CashLedgerDirection;
  categoryCodes: string[];
  sourceId?: string;
  scopeType?: CashLedgerScopeType;
  areaId?: string;
  buildingId?: string;
  roomId?: string;
  origin?: CashLedgerOrigin;
  affectsProfit?: boolean;
  entryId?: string;
  dimension?: string;
  groupKey?: string;
}

export interface CashLedgerSummary {
  totalIncome: bigint;
  totalExpense: bigint;
  netCashFlow: bigint;
  estimatedProfit: bigint;
}

export interface CashLedgerEntryItem {
  id: string;
  sourceId: string;
  amount: bigint;
  direction: CashLedgerDirection;
  origin: CashLedgerOrigin | string;
  category?: string;
  occurredAt: string;
  recordedAt?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  method?: string;
  areaId?: string;
  buildingId?: string;
  roomId?: string;
  transferId?: string;
  adjustsId?: string;
  correctionKind?: string;
  depositId?: string;
  settlementId?: string;
  paymentId?: string;
  note?: string;
  adjustments: string[];
  reportDirection: CashLedgerDirection | string;
  reportAmount: bigint;
  confirmationStatus?: string;
  voucherCode?: string;
  categoryName?: string;
  sourceName?: string;
  sourceType?: string;
  scopeLabel?: string;
  areaName?: string;
  buildingName?: string;
  roomCode?: string;
  affectsProfit: boolean;
  isReversal: boolean;
  isReversed: boolean;
  hasAttachments: boolean;
  attachmentCount: number;
}

export interface CashLedgerPageData {
  items: CashLedgerEntryItem[];
  page: number;
  size: number;
  totalElements: number;
  totalContribution?: bigint;
  summary: CashLedgerSummary;
  emptyState?: CashLedgerEmptyState;
  emptyMessage?: string;
}

export interface CashLedgerAttachmentItem {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  previewUrl: string;
  downloadUrl: string;
}

export interface CashLedgerDetail {
  id: string;
  voucherCode: string;
  occurredAt: string;
  recordedAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
  direction: CashLedgerDirection;
  amount: bigint;
  method?: string;
  categoryCode?: string;
  categoryName?: string;
  sourceId?: string;
  sourceName?: string;
  sourceType?: string;
  scopeLabel: string;
  areaId?: string;
  areaName?: string;
  buildingId?: string;
  buildingName?: string;
  roomId?: string;
  roomCode?: string;
  affectsProfit: boolean;
  origin: CashLedgerOrigin | string;
  note?: string;
  profitWarning?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  depositId?: string;
  settlementId?: string;
  isReversal: boolean;
  isReversed: boolean;
  reversalReason?: string;
  originalEntryId?: string;
  reversalEntryId?: string;
  transferId?: string;
  fromSourceId?: string;
  fromSourceName?: string;
  toSourceId?: string;
  toSourceName?: string;
  attachments: CashLedgerAttachmentItem[];
}

export type ManualPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'PAYOS' | 'OTHER';

export interface ManualCashCategoryOption {
  code: string;
  name: string;
  direction: CashLedgerDirection;
  affectsProfit: boolean;
}

export interface ManualCashFundingSourceOption {
  id: string;
  name: string;
  type: 'CASH' | 'BANK';
  availableBalance: bigint;
}

export interface ManualCashInitData {
  idempotencyKey: string;
  categories: ManualCashCategoryOption[];
  fundingSources: ManualCashFundingSourceOption[];
}

export interface StagedAttachmentItem {
  tempId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  previewUrl: string;
}

export interface CreateManualCashPayload {
  sourceId: string;
  amount: number;
  method: ManualPaymentMethod;
  occurredAt: string;
  category: string;
  direction: CashLedgerDirection;
  areaId?: string;
  buildingId?: string;
  roomId?: string;
  note?: string;
  attachmentIds: string[];
  confirmOverdraft: boolean;
}

export interface ManualCashConfirmation {
  entryId: string;
  direction: CashLedgerDirection;
  amount: bigint;
  affectsProfit: boolean;
  resultingSourceBalance: bigint;
  attachmentCount: number;
  reversalHint: string;
}
