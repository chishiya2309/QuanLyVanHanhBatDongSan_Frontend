import { parse } from 'lossless-json';
import { describe, expect, it } from 'vitest';
import { decodeProfitLossDetails } from '../src/services/financeApi';
import { parseFinanceRoute, returnToFinance } from '../src/utils/financeNavigation';
import { parseProfitLossRoute, profitLossLedgerUrl, profitLossUrl } from '../src/utils/profitLossNavigation';

describe('UC74 report and ledger contracts', () => {
  it('round-trips report, selected building, pagination and drill-down through UC56', () => {
    const route = parseProfitLossRoute('/reports/profit-loss',
      '?fromDate=2026-11-01&toDate=2026-11-30&sort=PROFIT_MARGIN&order=ASC&buildingPage=2&selectedBuilding=a&selectedRoomPage=3&detail=metric%3DUNKNOWN%26page%3D1')!;
    expect(route.detail).toMatchObject({ metric: 'UNKNOWN', page: 1 });
    const report = profitLossUrl(route);
    const ledger = new URL(profitLossLedgerUrl('entry-uuid', route.filter, route), 'https://example.test');
    expect(ledger.searchParams.get('entryId')).toBe('entry-uuid');
    expect(returnToFinance(parseFinanceRoute(ledger.pathname, ledger.search)!)).toBe(report);
  });

  it('decodes signed contributions and null margins without rounding large amounts', () => {
    const details = decodeProfitLossDetails(parse(`{"page":0,"size":20,"totalElements":25,
      "totalContribution":-9007199254740993,"totals":{"revenue":0,"expense":9007199254740993,
      "profit":-9007199254740993,"profitMargin":null},"entries":[{"cashEntryId":"entry",
      "classification":"EXPENSE","origin":"MANUAL","occurredAt":"2026-11-01T00:00:00Z","reportDirection":"OUT",
      "amount":9007199254740993,"contribution":-9007199254740993}]}`));
    expect(details.totals.profitMargin).toBeNull();
    expect(details.totalContribution).toBe(-9007199254740993n);
    expect(details.entries[0].amount).toBe(9007199254740993n);
    expect(details.totalElements).toBe(25);
  });
});
