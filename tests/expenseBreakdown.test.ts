import { parse } from 'lossless-json';
import { describe, expect, it } from 'vitest';
import { decodeCashLedger, decodeExpenseBreakdownReport } from '../src/services/financeApi';
import { expenseBreakdownUrl, parseExpenseBreakdownRoute } from '../src/utils/expenseBreakdownNavigation';
import { financeUrl, parseFinanceRoute, returnToFinance } from '../src/utils/financeNavigation';

describe('expense breakdown', () => {
  it('decodes large signed amounts and preserves unavailable ratios', () => {
    const period = { fromDate: '2026-10-01', toDate: '2026-10-31', totalGrossExpense: '-90071992547409935',
      totalExpenseDeductions: 0, totalNetExpense: '-90071992547409935', expenseCount: 2, deductionCount: 0,
      hasExpenseData: true, unknown: { count: 0, totalIn: 0, totalOut: 0 }, expenseWithoutProperty: 0,
      expenseWithoutPropertyCount: 0, unknownDrillDown: null };
    const report = decodeExpenseBreakdownReport(parse(JSON.stringify({
      current: period, previous: period, expenseDelta: 0, growthRate: null, categories: [], largestExpense: null,
      largestIncrease: null, ratioAvailable: false, comparisonProvisional: false, deductionRecognitionSupported: false, warnings: [],
    })));
    expect(report.current.totalNetExpense).toBe(-90071992547409935n);
    expect(report.current.hasExpenseData).toBe(true);
    expect(report.growthRate).toBeNull();
    expect(decodeCashLedger(parse('{"page":0,"size":20,"totalElements":0,"items":[],"totalContribution":-90071992547409935}'))
      .totalContribution).toBe(-90071992547409935n);
    expect(decodeCashLedger(parse('{"page":0,"size":20,"totalElements":0,"items":[]}'))).not.toHaveProperty('totalContribution');
  });

  it('round-trips the analysis and preserves the original scope through ledger pagination', () => {
    const route = parseExpenseBreakdownRoute('/reports/expense-breakdown',
      '?fromDate=2026-11-01&toDate=2026-11-24&roomId=room&periodType=CUSTOM&sort=RATIO&order=ASC&view=comparison')!;
    const analysis = expenseBreakdownUrl(route);
    const ledgerUrl = new URL(financeUrl({ kind: 'cash-ledger', filter: {
      fromDate: '2026-10-01', toDate: '2026-10-24', roomId: 'room', transactionCategory: [],
    }, financial: { financialImpact: 'OPERATING_EXPENSE', uncategorized: true },
    expenseMetric: 'net', expenseBreakdownSearch: analysis.split('?')[1], page: 0, size: 20 }), 'https://example.test');
    const ledger = parseFinanceRoute(ledgerUrl.pathname, ledgerUrl.search)!;
    const next = new URL(financeUrl({ ...ledger, page: 1 }), ledgerUrl.origin);
    expect(next.searchParams.get('fromDate')).toBe('2026-10-01');
    expect(next.searchParams.get('uncategorized')).toBe('true');
    expect(next.searchParams.get('page')).toBe('1');
    expect(returnToFinance(parseFinanceRoute(next.pathname, next.search)!)).toBe(analysis);
  });
});
