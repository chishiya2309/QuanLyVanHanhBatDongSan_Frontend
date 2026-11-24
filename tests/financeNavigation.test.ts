import { describe, expect, it } from 'vitest';
import { drillDownUrl, financeParams, financeUrl, parseFinanceRoute, returnToFinance, validFinanceDates } from '../src/utils/financeNavigation';

describe('finance navigation', () => {
  it('keeps repeated category parameters, the exact scope and the original report URL', () => {
    const report = { areaId: 'area', sourceId: 'bank', transactionCategory: ['RENT', '~'] };
    const filter = { ...report, fromDate: '2026-11-01', toDate: '2026-11-30', dimension: 'room', groupKey: '~' };
    const url = new URL(drillDownUrl(filter, report), 'http://localhost');
    const route = parseFinanceRoute(url.pathname, url.search)!;
    expect(route.filter).toEqual(filter);
    expect(route.page).toBe(0);
    expect(financeParams(route.filter).getAll('transactionCategory')).toEqual(['RENT', '~']);
    expect(returnToFinance(route)).toBe('/reports/finance?' + financeParams(report));
    expect(financeUrl({ ...route, page: 2 })).toContain('page=2');
  });

  it('accepts only calendar dates and ordered complete explicit periods', () => {
    expect(validFinanceDates({ transactionCategory: [] })).toBe(true);
    expect(validFinanceDates({ fromDate: '2026-11-01', transactionCategory: [] })).toBe(false);
    expect(validFinanceDates({ fromDate: '2026-02-29', toDate: '2026-03-01', transactionCategory: [] })).toBe(false);
    expect(validFinanceDates({ fromDate: '2026-11-30', toDate: '2026-11-01', transactionCategory: [] })).toBe(false);
    expect(validFinanceDates({ fromDate: '2024-02-29', toDate: '2024-02-29', transactionCategory: [] })).toBe(true);
  });

  it('never uses an external URL as the report return target', () => {
    const route = parseFinanceRoute('/cash-ledger', '?report=https%3A%2F%2Fexample.com')!;
    expect(returnToFinance(route)).toBe('/reports/finance');
  });
});

