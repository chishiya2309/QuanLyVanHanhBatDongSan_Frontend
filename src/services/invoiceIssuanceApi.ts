import { invoiceRequest } from './invoiceApi';
import type {
  BatchIssuanceReview,
  BatchIssuanceResult,
  BatchIssueRequestPayload,
  IssuanceResult,
  IssuanceReview,
  IssueRequestPayload,
} from '../types/invoiceIssuance';

const hostBase = '/invoices/host';

export function getIssuanceReview(invoiceId: string, signal?: AbortSignal): Promise<IssuanceReview> {
  return invoiceRequest<IssuanceReview>(`${hostBase}/${encodeURIComponent(invoiceId)}/issue-review`, signal);
}

export function issueInvoice<TResponse>(
  invoiceId: string,
  payload: IssueRequestPayload,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<TResponse> {
  return invoiceRequest<TResponse>(
    `${hostBase}/${encodeURIComponent(invoiceId)}/issue`,
    signal,
    payload,
    idempotencyKey,
    'POST',
  );
}

export function getIssuanceStatus(invoiceId: string, signal?: AbortSignal): Promise<IssuanceResult> {
  return invoiceRequest<IssuanceResult>(`${hostBase}/${encodeURIComponent(invoiceId)}/issue-status`, signal);
}

export function previewBatchIssuance(invoiceIds: string[], signal?: AbortSignal): Promise<BatchIssuanceReview> {
  return invoiceRequest<BatchIssuanceReview>(
    `${hostBase}/issue/batch-preview`,
    signal,
    { invoiceIds },
    undefined,
    'POST',
  );
}

export function issueInvoiceBatch(
  payload: BatchIssueRequestPayload,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<BatchIssuanceResult> {
  return invoiceRequest<BatchIssuanceResult>(
    `${hostBase}/issue/batch`,
    signal,
    payload,
    idempotencyKey,
    'POST',
  );
}
