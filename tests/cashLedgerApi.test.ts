import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CashLedgerApiError,
  createManualCashEntry,
  decodeCashLedgerDetail,
  decodeCashLedgerPage,
  discardStagedAttachments,
  fetchAttachmentBlob,
  fetchCashLedger,
  fetchCashLedgerDetail,
  fetchManualCashInit,
  stageManualAttachments,
} from '../src/services/cashLedgerApi';
import { authenticatedFetch } from '../src/services/sessionClient';

vi.mock('../src/services/sessionClient', () => ({
  authenticatedFetch: vi.fn(),
}));

describe('cashLedgerApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('decodes lossless bigint summary and entry items', () => {
    const decoded = decodeCashLedgerPage({
      page: 0,
      size: 20,
      totalElements: 1,
      summary: {
        totalIncome: '9007199254740995',
        totalExpense: '1000000',
        netCashFlow: '9007199253740995',
        estimatedProfit: '9007199253740995',
      },
      items: [
        {
          id: 'entry-1',
          sourceId: 'src-1',
          amount: '9007199254740995',
          direction: 'IN',
          origin: 'INVOICE_PAYMENT',
          occurredAt: '2026-11-15T10:00:00Z',
          adjustments: [],
          reportDirection: 'IN',
          reportAmount: '9007199254740995',
          affectsProfit: true,
          isReversal: false,
          isReversed: false,
          hasAttachments: true,
          attachmentCount: 2,
        },
      ],
    });

    expect(decoded.summary.totalIncome).toBe(9007199254740995n);
    expect(decoded.items[0].amount).toBe(9007199254740995n);
    expect(decoded.items[0].hasAttachments).toBe(true);
    expect(decoded.items[0].attachmentCount).toBe(2);
  });

  it('throws 403 CashLedgerApiError with E1a message when forbidden', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(JSON.stringify({ message: 'Bạn không có quyền truy cập vào sổ thu chi này' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      fetchCashLedger({ fromDate: '2026-11-01', toDate: '2026-11-30', categoryCodes: [] }, 0, 20),
    ).rejects.toEqual(new CashLedgerApiError(403, 'Bạn không có quyền truy cập vào sổ thu chi này'));
  });

  it('fetches and decodes entry detail and attachment blob', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 200,
          data: {
            id: 'entry-2',
            voucherCode: 'PT-COC-1234',
            occurredAt: '2026-11-15T10:00:00Z',
            recordedAt: '2026-11-15T10:01:00Z',
            direction: 'IN',
            amount: '2000000',
            scopeLabel: 'Phòng P101',
            affectsProfit: false,
            origin: 'DEPOSIT_RECEIPT',
            profitWarning: 'Dòng tiền ký quỹ - Không tính vào lợi nhuận kinh doanh',
            depositId: 'dep-1',
            isReversal: false,
            isReversed: false,
            attachments: [
              {
                id: 'att-1',
                fileName: 'bien-lai.png',
                contentType: 'image/png',
                fileSize: 1234,
                previewUrl: '/api/v1/cash-ledger/entry-2/attachments/att-1/download?inline=true',
                downloadUrl: '/api/v1/cash-ledger/entry-2/attachments/att-1/download?inline=false',
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const detail = await fetchCashLedgerDetail('entry-2');
    expect(detail.voucherCode).toBe('PT-COC-1234');
    expect(detail.profitWarning).toBe('Dòng tiền ký quỹ - Không tính vào lợi nhuận kinh doanh');
    expect(detail.attachments).toHaveLength(1);

    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(
      new Response(new Blob(['ok'], { type: 'image/png' }), { status: 200 }),
    );
    const { objectUrl } = await fetchAttachmentBlob('entry-2', 'att-1', true);
    expect(objectUrl).toBe('blob:mock-url');
    createObjectUrlSpy.mockRestore();
  });

  it('decodes detail directly', () => {
    const detail = decodeCashLedgerDetail({
      id: 'e1',
      voucherCode: 'CK-NB-0001',
      occurredAt: '2026-11-15T10:00:00Z',
      recordedAt: '2026-11-15T10:00:00Z',
      direction: 'OUT',
      amount: '500000',
      scopeLabel: 'Chi phí chung',
      affectsProfit: false,
      origin: 'INTERNAL_TRANSFER',
      isReversal: false,
      isReversed: false,
      fromSourceName: 'Tiền mặt',
      toSourceName: 'Vietcombank',
      attachments: [],
    });
    expect(detail.fromSourceName).toBe('Tiền mặt');
    expect(detail.toSourceName).toBe('Vietcombank');
  });

  it('fetches manual init, stages/discards attachments, and handles 409 overdraft', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 200,
          data: {
            idempotencyKey: 'idem-1',
            categories: [{ code: 'REPAIR', name: 'Sửa chữa', direction: 'OUT', affectsProfit: true }],
            fundingSources: [{ id: 'src-1', name: 'Quỹ tiền mặt', type: 'CASH', availableBalance: 1000000 }],
          },
        }),
        { status: 200 },
      ),
    );
    const init = await fetchManualCashInit();
    expect(init.idempotencyKey).toBe('idem-1');
    expect(init.fundingSources[0].availableBalance).toBe(1000000n);

    vi.mocked(authenticatedFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 200,
          data: [
            {
              tempId: 'tmp-1',
              fileName: 'hoa-don.jpg',
              contentType: 'image/jpeg',
              fileSize: 2048,
              previewUrl: '/api/v1/cash-ledger/manual/attachments/tmp-1/preview',
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const staged = await stageManualAttachments([new File(['abc'], 'hoa-don.jpg', { type: 'image/jpeg' })]);
    expect(staged[0].tempId).toBe('tmp-1');

    vi.mocked(authenticatedFetch).mockResolvedValueOnce(new Response(JSON.stringify({ status: 200 }), { status: 200 }));
    await discardStagedAttachments(['tmp-1']);

    vi.mocked(authenticatedFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 409,
          code: 'OVERDRAFT_CONFIRMATION_REQUIRED',
          message: 'Số tiền chi vượt quá số dư hiện có của nguồn tiền.',
        }),
        { status: 409 },
      ),
    );

    try {
      await createManualCashEntry('idem-1', {
        sourceId: 'src-1',
        amount: 2000000,
        method: 'CASH',
        occurredAt: '2026-11-27T10:00:00.000Z',
        category: 'REPAIR',
        direction: 'OUT',
        attachmentIds: [],
        confirmOverdraft: false,
      });
      expect.fail('Expected 409 error');
    } catch (err) {
      expect(err).toBeInstanceOf(CashLedgerApiError);
      const apiErr = err as CashLedgerApiError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.code).toBe('OVERDRAFT_CONFIRMATION_REQUIRED');
    }
  });
});
