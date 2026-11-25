import { afterEach, expect, it, vi } from 'vitest';
import {
  getIssuanceReview,
  getIssuanceStatus,
  issueInvoice,
  issueInvoiceBatch,
  previewBatchIssuance,
} from '../src/services/invoiceIssuanceApi';
import { AuthApiError } from '../src/services/authErrors';

afterEach(() => vi.unstubAllGlobals());

it('preserves exact lossless monetary integers in issuance review and batch preview', async () => {
  const fetcher = vi.fn(async (input: string) => {
    if (input.endsWith('/auth/csrf')) {
      return Response.json({ data: { token: 'csrf-tok', headerName: 'X-CSRF-TOKEN' } });
    }
    if (input.endsWith('/issue-review')) {
      return new Response(
        '{"status":200,"data":{"invoiceId":"inv-1","subtotalBeforeDiscounts":9007199254740993,"surchargeTotal":0,"discountTotal":0,"total":9007199254740993,"paidAmount":1,"expectedRemaining":9007199254740992}}',
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(
      '{"status":200,"data":{"totalSelected":1,"totalEligibleAmount":9007199254740993,"totalExpectedRemaining":9007199254740992,"items":[]}}',
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', fetcher);

  const review = await getIssuanceReview('inv-1');
  expect(review.total).toBe('9007199254740993');
  expect(review.subtotalBeforeDiscounts).toBe('9007199254740993');
  expect(review.expectedRemaining).toBe('9007199254740992');

  const batchPreview = await previewBatchIssuance(['inv-1']);
  expect(batchPreview.totalEligibleAmount).toBe('9007199254740993');
  expect(batchPreview.totalExpectedRemaining).toBe('9007199254740992');
});

it('sends Idempotency-Key and CSRF headers on single and batch issue and maps AuthApiError code', async () => {
  const fetcher = vi.fn(async (input: string) => {
    if (input.endsWith('/auth/csrf')) {
      return Response.json({ data: { token: 'csrf-tok', headerName: 'X-CSRF-TOKEN' } });
    }
    if (input.endsWith('/issue-status')) {
      return Response.json({ data: { invoiceId: 'inv-1', lifecycle: 'ISSUED', invoiceNumber: 'HD1' } });
    }
    if (input.endsWith('/issue/batch')) {
      return Response.json({
        status: 409,
        message: 'Xung đột dữ liệu',
        code: 'INVOICE_CONCURRENCY_CONFLICT',
        data: null,
      }, { status: 409 });
    }
    return Response.json({ data: { issuance: { invoiceId: 'inv-1', lifecycle: 'ISSUED' } } });
  });
  vi.stubGlobal('fetch', fetcher);

  await issueInvoice('inv-1', { version: 2, sendNotification: true }, 'idem-single-1');
  const singleCall = fetcher.mock.calls.find(([url]) => url.endsWith('/inv-1/issue')) as unknown as [string, RequestInit];
  expect(new Headers(singleCall[1].headers).get('Idempotency-Key')).toBe('idem-single-1');
  expect(new Headers(singleCall[1].headers).get('X-CSRF-TOKEN')).toBe('csrf-tok');

  const statusRes = await getIssuanceStatus('inv-1');
  expect(statusRes.invoiceNumber).toBe('HD1');

  await expect(
    issueInvoiceBatch({ invoiceIds: ['inv-1'] }, 'idem-batch-1'),
  ).rejects.toMatchObject({
    name: 'AuthApiError',
    status: 409,
    code: 'INVOICE_CONCURRENCY_CONFLICT',
  } satisfies Partial<AuthApiError>);
});
