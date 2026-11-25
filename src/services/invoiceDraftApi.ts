import { LosslessNumber } from 'lossless-json';
import { invoiceRequest } from './invoiceApi';

export type CalculationStatus = 'COMPLETE' | 'INCOMPLETE' | 'INVALID';
export type DraftIssue = { code: string; source: string; message: string };
export type DraftLine = { name: string; amount: string | null; quantity: string | null; unitPrice: string | null; basis?: unknown };
export type KeyedLine = { key: string; value: DraftLine };
export type Manual = { id?: string; name: string; kind: 'FEE' | 'DISCOUNT' | 'RENT_DISCOUNT'; amount?: string; quantity?: string; unitPrice?: string; reason?: string };
export type Calculation = {status: CalculationStatus; total: string | null; subtotal: string | null; lines: KeyedLine[]; issues: DraftIssue[]; sourceFingerprint: string; manualLines: Manual[]};
export type DraftReview = {version: number; dueDate: string | null; isStale: boolean; requiresRecalculation: boolean; canIssue: boolean; changedSources: string[]; calculationMessage?: string; calculation?: Calculation | null};
export type Preview = {version: number; calculation: Calculation; totalDelta: string | null; changes: {key: string; before?: KeyedLine; after?: KeyedLine}[]};
export type Period = {
  period_id: string; room_id: string; room_code: string; building_id: string; building_name: string;
  customer_name: string; contract_id: string; cycle_start: string; cycle_end: string; from_date: string; to_date: string;
  invoice_id?: string; lifecycle?: string; status: string; scheduleStatus: string;
  scheduledBillingDate: string; suggestedDueDate: string | null; payment_term_days?: number | null;
  rentWaiver?: {active: boolean; reason: string};
};
export type BatchItem = {periodId: string; invoiceId?: string; status: 'READY' | 'NEEDS_ATTENTION' | 'EXISTS' | 'FAILED'; message?: string};
type Preflight = {periodId: string; invoiceId?: string; dueDate?: string; issues: DraftIssue[]; message?: string};
const host = '/invoices/host';
const draft = (id: string) => host + '/' + encodeURIComponent(id) + '/draft';
const period = (id: string) => host + '/drafts/periods/' + encodeURIComponent(id);
export const listDraftSchedule = (filters: URLSearchParams, signal: AbortSignal) =>
  invoiceRequest<Period[]>(host + '/drafts/schedule?' + filters, signal);
export const getDraftDefaults = (id: string, signal?: AbortSignal) => invoiceRequest<Period>(period(id), signal);
export const createDraft = (id: string, dueDate: string) =>
  invoiceRequest<BatchItem>(host + '/drafts', undefined, {periodId: id, dueDate: dueDate || null});
export const previewDraftBatch = (periodIds: string[]) =>
  invoiceRequest<Preflight[]>(host + '/drafts/batch/preview', undefined, {periodIds});
export const createDraftBatch = (periodIds: string[]) =>
  invoiceRequest<{items: BatchItem[]; counts: Record<string, number>}>(host + '/drafts/batch', undefined, {periodIds});
export const previewRecalculation = (id: string, signal?: AbortSignal) => invoiceRequest<Preview>(draft(id) + '/recalculation', signal);
export const confirmRecalculation = (id: string, preview: Preview) =>
  invoiceRequest(draft(id) + '/recalculation', undefined, {version: preview.version, sourceFingerprint: preview.calculation.sourceFingerprint});
export const deleteDraft = (id: string, version: number) =>
  invoiceRequest(draft(id) + '?version=' + version, undefined, undefined, undefined, 'DELETE');
export const setRentWaiver = (id: string, active: boolean, reason: string) =>
  invoiceRequest(period(id) + '/rent-waiver', undefined, {active, reason}, undefined, 'PUT');
export const setPaymentTerm = (id: string, paymentTermDays: number | null) =>
  invoiceRequest(host + '/contracts/' + encodeURIComponent(id) + '/payment-term', undefined, {paymentTermDays}, undefined, 'PUT');
export function updateDraft(id: string, version: number, dueDate: string, confirmPastDue: boolean,
                            manualLines: Manual[], removeManualLineIds: string[], reason: string) {
  const exact = (value?: string) => value ? new LosslessNumber(value.trim().replace(/^0+(?=\d)/, '')) : null;
  return invoiceRequest(draft(id), undefined, {
    version, dueDate: dueDate || null, confirmPastDue, reason, removeManualLineIds,
    manualLines: manualLines.map(line => ({...line, amount: exact(line.amount), quantity: exact(line.quantity), unitPrice: exact(line.unitPrice)})),
  }, undefined, 'PATCH');
}
