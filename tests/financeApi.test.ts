import { parse } from 'lossless-json';
import { describe, expect, it, vi } from 'vitest';
import { decodeCashLedger, decodeFinanceMoney, getFinanceReport } from '../src/services/financeApi';
import { authenticatedFetch } from '../src/services/sessionClient';

vi.mock('../src/services/sessionClient', () => ({ authenticatedFetch: vi.fn() }));

describe('finance API', () => {
  it('preserves positive and negative integers past the safe JavaScript number range', () => {
    expect(decodeFinanceMoney(parse('9223372036854775807'))).toBe(9223372036854775807n);
    expect(decodeFinanceMoney(parse('-9223372036854775808.00'))).toBe(-9223372036854775808n);
    expect(() => decodeFinanceMoney(parse('2.01'))).toThrow();
  });

  it('keeps recorded movement distinct from a correction contribution', () => {
    const data = decodeCashLedger(parse(`{"items":[{"id":"refund-reversed","sourceId":"bank","amount":9007199254740993,
      "direction":"IN","origin":"DEPOSIT_REFUND","category":"DEPOSIT_REFUND","occurredAt":"2026-11-01T00:00:00Z",
      "adjustsId":"refund","adjustments":[],"settlementId":"settlement","correctionKind":"REVERSAL",
      "reportDirection":"OUT","reportAmount":-9007199254740993}],"page":0,"size":20,"totalElements":1}`));
    expect(data.items[0]).toMatchObject({ amount: 9007199254740993n, direction: 'IN',
      reportAmount: -9007199254740993n, reportDirection: 'OUT', settlementId: 'settlement', adjustsId: 'refund' });
  });

  it('passes cancellation and repeated filters to the authenticated client', async () => {
    const signal = new AbortController().signal;
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(new Response('{"message":"Ngoài phạm vi"}', { status: 404 }));
    await expect(getFinanceReport({ sourceId: 'bank', transactionCategory: ['RENT', 'SERVICE'] }, signal))
      .rejects.toMatchObject({ status: 404, message: 'Ngoài phạm vi' });
    expect(authenticatedFetch).toHaveBeenCalledWith(expect.stringContaining('sourceId=bank&transactionCategory=RENT&transactionCategory=SERVICE'),
      expect.objectContaining({ signal, credentials: 'include' }));
  });
});

