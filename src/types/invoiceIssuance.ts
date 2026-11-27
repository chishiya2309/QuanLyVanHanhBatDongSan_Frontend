import type { DraftIssue, KeyedLine } from '../services/invoiceDraftApi';

export type ConfirmedPaymentMode = 'POLICY_DEFAULT' | 'CASH_ONLY_OVERRIDE';
export type BatchCategory = 'ELIGIBLE' | 'NEEDS_CONFIRMATION' | 'INELIGIBLE' | 'ALREADY_ISSUED';
export type BatchItemOutcome = 'ISSUED' | 'ALREADY_ISSUED' | 'SKIPPED' | 'FAILED';
export type InvoicePaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export type HostSummary = {
  hostId: string;
  businessName: string;
  businessEmail: string | null;
  businessPhone: string | null;
};

export type CustomerSummary = {
  customerId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
};

export type BuildingSummary = {
  buildingId: string;
  name: string;
  address: string | null;
};

export type RoomSummary = {
  roomId: string;
  code: string;
  name: string;
};

export type ContractSummary = {
  contractId: string;
  contractNumber: string;
  rentalStatus: string;
  startDate: string;
  endDate: string | null;
  paymentTermDays: number | null;
};

export type PeriodSummary = {
  periodId: string;
  tenancyId: string;
  fromDate: string;
  toDate: string;
  cycleStart: string;
  cycleEnd: string;
  status: string;
};

export type CashRecipient = {
  fundingSourceId: string;
  name: string;
};

export type BankRecipient = {
  fundingSourceId: string;
  name: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

export type PaymentInstructions = {
  roomId: string;
  policyVersion: number;
  allowCash: boolean;
  allowTransfer: boolean;
  cashRecipient: CashRecipient | null;
  bankRecipient: BankRecipient | null;
};

export type IssuanceWarning = {
  code: string;
  message: string;
  confirmationRequired: boolean;
};

export type IssuanceReview = {
  invoiceId: string;
  lifecycle: string;
  projectedNumber: string;
  version: number;
  sourceFingerprint: string | null;
  canIssue: boolean;
  requiresConfirmation: boolean;
  blockingMessage: string | null;
  host: HostSummary;
  building: BuildingSummary;
  room: RoomSummary;
  contract: ContractSummary;
  customer: CustomerSummary;
  period: PeriodSummary;
  lines: KeyedLine[];
  blockingIssues: DraftIssue[];
  subtotalBeforeDiscounts: string | null;
  surchargeTotal: string;
  discountTotal: string;
  rentWaived: boolean;
  total: string | null;
  paidAmount: string;
  expectedRemaining: string | null;
  dueDate: string | null;
  pastDue: boolean;
  pastDueConfirmed: boolean;
  paymentInstructions: PaymentInstructions | null;
  transferUnavailable: boolean;
  canConfirmCashOnly: boolean;
  warnings: IssuanceWarning[];
  defaultSendNotification: boolean;
  availableNotificationChannels: string[];
  immutabilityNotice: string;
};

export type IssueRequestPayload = {
  dueDate?: string | null;
  confirmPastDue?: boolean;
  version?: number | null;
  sourceFingerprint?: string | null;
  pastDueReason?: string | null;
  sendNotification?: boolean | null;
  confirmedPaymentMode?: ConfirmedPaymentMode | null;
};

export type IssuanceResult = {
  invoiceId: string;
  periodId: string;
  invoiceNumber: string;
  paymentReference: string;
  lifecycle: string;
  version: number;
  issuedAt: string;
  issuedBy: string;
  dueDate: string;
  total: string;
  paidAmount: string;
  remaining: string;
  paymentStatus: InvoicePaymentStatus;
  pastDueConfirmed: boolean;
  pastDueReason: string | null;
  confirmedPaymentMode: ConfirmedPaymentMode;
  alreadyIssued: boolean;
  replayed: boolean;
  notificationRequested: boolean;
  notificationStatus: string;
  notificationOutboxId: string | null;
  message: string;
};

export type BatchIssuancePreviewItem = {
  invoiceId: string;
  periodId: string | null;
  invoiceNumber: string | null;
  roomCode: string | null;
  buildingName: string | null;
  customerName: string | null;
  fromDate: string | null;
  toDate: string | null;
  dueDate: string | null;
  total: string | null;
  paidAmount: string;
  expectedRemaining: string | null;
  category: BatchCategory;
  pastDue: boolean;
  transferUnavailable: boolean;
  canConfirmCashOnly: boolean;
  version: number | null;
  sourceFingerprint: string | null;
  message: string;
  warnings: IssuanceWarning[];
  blockingIssues: DraftIssue[];
};

export type BatchIssuanceReview = {
  totalSelected: number;
  counts: Record<BatchCategory, number>;
  totalEligibleAmount: string;
  totalExpectedRemaining: string;
  defaultSendNotification: boolean;
  items: BatchIssuancePreviewItem[];
};

export type BatchIssueItemPayload = {
  invoiceId: string;
  dueDate?: string | null;
  confirmPastDue?: boolean | null;
  version?: number | null;
  sourceFingerprint?: string | null;
  pastDueReason?: string | null;
  confirmedPaymentMode?: ConfirmedPaymentMode | null;
};

export type BatchIssueRequestPayload = {
  invoiceIds: string[];
  confirmPastDue?: boolean;
  pastDueReason?: string | null;
  sendNotification?: boolean | null;
  confirmedPaymentMode?: ConfirmedPaymentMode | null;
  items?: BatchIssueItemPayload[];
};

export type BatchIssuanceItemResult = {
  invoiceId: string;
  periodId: string | null;
  invoiceNumber: string | null;
  paymentReference: string | null;
  outcome: BatchItemOutcome;
  total: string | null;
  remaining: string | null;
  paymentStatus: InvoicePaymentStatus | null;
  notificationStatus: string | null;
  reasonCode: string | null;
  message: string;
};

export type BatchIssuanceResult = {
  totalRequested: number;
  counts: Record<BatchItemOutcome, number>;
  totalIssuedAmount: string;
  items: BatchIssuanceItemResult[];
};
