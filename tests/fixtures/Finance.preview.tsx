import type { FinancialExportConfig } from '../../src/services/financialExportApi';
import { parseExpenseBreakdownRoute } from '../../src/utils/expenseBreakdownNavigation';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import '../../src/index.css';
import { parseProfitLossRoute } from '../../src/utils/profitLossNavigation';
import { parseFinanceRoute } from '../../src/utils/financeNavigation';
import { fsCash, fsFixture, fsReply } from './fundingSources';

const params = new URLSearchParams(location.search);
const role = params.get('role') === 'CUSTOMER' ? 'CUSTOMER' : 'HOST';
const capture = params.get('capture');
const initial = params.get('route') ?? '/reports/finance';
const realFetch = window.fetch.bind(window);
const auth = fsFixture({ mode: 'full', role });
const calls: string[] = [];
Object.assign(window, { financeCalls: calls });

const areaId = '00000000-0000-4000-8000-000000000091';
const buildingId = '00000000-0000-4000-8000-000000000092';
const roomId = '00000000-0000-4000-8000-000000000093';
const sourceId = '00000000-0000-4000-8000-000000000094';
const property = { active: true, createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z' };
const amounts = (totalIn: number, totalOut: number, transferIn = 0, transferOut = 0) => ({ totalIn, totalOut, cashFlow: totalIn - totalOut, transferIn, transferOut });
const envelope = (data: unknown, status = 200, message = '') => new Response(JSON.stringify({ status, data, message }), {
  status, headers: { 'Content-Type': 'application/json' },
});
let failed = false;

window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
  const q = url.searchParams;
  if (!url.pathname.startsWith('/api/v1/')) return realFetch(input, init);
  if (url.pathname === '/api/v1/areas') return envelope([{ ...property, id: areaId, name: 'Khu vực Bình Thạnh' }]);
  if (url.pathname === '/api/v1/buildings') return envelope([{ ...property, id: buildingId, areaId, name: 'Tòa nhà A' }]);
  if (url.pathname.endsWith('/rooms')) return envelope([{ ...property, id: roomId, buildingId, code: 'A101', name: 'Phòng A101' }]);
  if (url.pathname === '/api/v1/funding-sources') return fsReply([{ ...fsCash, id: sourceId }]);
  if (url.pathname === '/api/v1/reports/finance/export/preview' || url.pathname === '/api/v1/reports/finance/export') {
    calls.push(url.pathname);
    const body = JSON.parse(String(init?.body));
    const config: FinancialExportConfig = body.configuration ?? body;
    const filter = { ...config.filter, transactionCategory: config.filter.transactionCategory ?? [] };
    const changes = [];
    if (config.type !== 'CASH_FLOW' && filter.sourceId) {
      changes.push('Báo cáo sẽ sử dụng toàn bộ nguồn tiền.');
      delete filter.sourceId;
    }
    if (config.type === 'EXPENSE_BREAKDOWN' || config.type === 'COMBINED') filter.periodType ??= 'CUSTOM';
    const scope = { filter, comparisonFrom: filter.periodType ? '2026-10-01' : null,
      comparisonTo: filter.periodType ? '2026-10-24' : null };
    if (url.pathname.endsWith('/preview')) return envelope({ scope, changes, confirmationToken: 'preview-fixture' });
    if (body.confirmationToken !== 'preview-fixture') return envelope(null, 400, 'Cần xác nhận phạm vi.');
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([key, value]) => {
      if (typeof value === 'string') params.set(key, value);
    });
    filter.transactionCategory.forEach(value => params.append('transactionCategory', value));
    async function report(path: string) {
      const response = await window.fetch('/api/v1/reports/' + path + '?' + params);
      return (await response.json()).data;
    }
    const cashFlow = config.type === 'CASH_FLOW' || config.type === 'COMBINED' ? await report('finance') : null;
    if (cashFlow) { cashFlow.totalIn = 123456789; cashFlow.cashFlow = cashFlow.totalIn - cashFlow.totalOut; }
    const profitLoss = config.type === 'PROFIT_LOSS' || config.type === 'COMBINED' ? await report('profit-loss') : null;
    const expenseBreakdown = config.type === 'EXPENSE_BREAKDOWN' || config.type === 'COMBINED' ? await report('expense-breakdown') : null;
    const data = { scope, capturedAt: '2026-11-24T00:00:00Z', dataPolicy: 'LATEST_AT_EXPORT', cashFlow, profitLoss, expenseBreakdown };
    const mime = config.format === 'PDF' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const extension = config.format.toLowerCase();
    return new Response('--uc76\r\nContent-Type: application/json\r\nContent-Disposition: inline; name="snapshot"\r\n\r\n'
      + JSON.stringify(data) + '\r\n--uc76\r\nContent-Type: ' + mime
      + '\r\nContent-Disposition: attachment; name="file"; filename="Bao-cao.' + extension + '"\r\n\r\n'
      + 'fixture bytes\r\n--uc76--\r\n', { headers: { 'Content-Type': 'multipart/mixed; boundary=uc76' } });
  }
  if (url.pathname === '/api/v1/reports/expense-breakdown') {
    calls.push(url.pathname + url.search);
    if (q.get('areaId') === 'foreign') return envelope(null, 404, 'Khu vực ngoài phạm vi quản lý.');
    if (q.get('areaId') === 'retry' && !failed) {
      failed = true;
      return envelope(null, 500);
    }
    if (q.get('areaId') === 'slow') await new Promise(resolve => setTimeout(resolve, 900));
    const currentDates = { fromDate: q.get('fromDate') ?? '2026-11-01', toDate: q.get('toDate') ?? '2026-11-24' };
    const previousDates = { fromDate: '2026-10-01', toDate: '2026-10-24' };
    const empty = q.get('areaId') === 'empty';
    const negative = q.get('areaId') === 'negative';
    const zero = q.get('areaId') === 'zero';
    const scope = Object.fromEntries(['areaId', 'buildingId', 'roomId'].filter(key => q.has(key)).map(key => [key, q.get(key)]));
    const trace = (dates: typeof currentDates, code: string | null, financialImpact = 'OPERATING_EXPENSE') =>
      ({ path: '/api/v1/cash-ledger', ...dates, ...scope, financialImpact,
        financialCategoryCode: code, uncategorized: !code && financialImpact !== 'UNKNOWN' });
    const value = q.get('areaId') === 'slow' ? 88888888 : empty || zero ? 0 : negative ? -1000000 : 12000000;
    const periodAmounts = (value: number, expenseCount: number) =>
      ({ grossExpense: value, expenseDeductions: 0, netExpense: value, expenseCount, deductionCount: 0 });
    const category = (code: string, name: string, now: number, prior: number, ratio: number | null, expenseCount: number) =>
      ({ code, name, current: periodAmounts(now, expenseCount), previous: periodAmounts(prior, 2),
        ratio, expenseDelta: now - prior, growthRate: now < 0 ? null : ((now - prior) / prior) * 100,
        change: empty ? 'NO_LONGER_INCURRED' : now > prior ? 'INCREASED' : 'DECREASED',
        currentDrillDown: trace(currentDates, code), previousDrillDown: trace(previousDates, code) });
    const categories = [category('MAINTENANCE', 'Bảo trì', value, 10000000, value > 0 ? 100 : null, empty ? 0 : 2),
      category('REPAIR', 'Sửa chữa', 0, 1000000, value > 0 ? 0 : null, 0)];
    if (q.get('order') === 'ASC') categories.reverse();
    const period = (dates: typeof currentDates, total: number, count: number) =>
      ({ ...dates, totalGrossExpense: total, totalExpenseDeductions: 0, totalNetExpense: total,
        expenseCount: count, deductionCount: 0, hasExpenseData: count > 0, expenseWithoutProperty: 0,
        expenseWithoutPropertyCount: 0, unknown: { count: 1, totalIn: 0, totalOut: 50000 },
        unknownDrillDown: trace(dates, null, 'UNKNOWN') });
    return envelope({ filter: { ...currentDates, ...scope }, current: period(currentDates, value, empty ? 0 : 2),
      previous: period(previousDates, 11000000, 4), categories, expenseDelta: value - 11000000,
      growthRate: value < 0 ? null : Number(((value - 11000000) / 110000).toFixed(2)),
      largestExpense: null, largestIncrease: null, ratioAvailable: value > 0,
      comparisonProvisional: true, deductionRecognitionSupported: false,
      warnings: ['Kỳ đối chiếu có giao dịch chưa xác định bản chất.'] });
  }
  if (url.pathname.startsWith('/api/v1/reports/profit-loss')) {
    calls.push(url.pathname + url.search);
    if (q.get('areaId') === 'foreign') return envelope(null, 404, 'Khu vực ngoài phạm vi quản lý.');
    if (q.get('areaId') === 'retry' && !failed) {
      failed = true;
      return envelope(null, 500);
    }
    if (q.get('areaId') === 'slow') await new Promise(resolve => setTimeout(resolve, 900));
    const filter = { fromDate: q.get('fromDate') ?? '2025-12-01', toDate: q.get('toDate') ?? '2026-11-24' };
    const days = (Date.parse(filter.toDate) - Date.parse(filter.fromDate)) / 86_400_000 + 1;
    const empty = q.get('areaId') === 'empty';
    const totals = { revenue: empty || q.has('roomId') ? 0 : q.get('areaId') === 'slow' ? 88888888 : 108000000,
      expense: empty ? 0 : 36000000, profit: empty ? 0 : q.has('roomId') ? -36000000 : 72000000,
      profitMargin: empty || q.has('roomId') ? null : 66.67 };
    const pagination = { page: Number(q.get('roomPage')), size: 1, totalElements: q.has('buildingId') ? 2 : 1 };
    if (url.pathname.endsWith('/details')) {
      return envelope({ page: Number(q.get('page')), size: 1, totalElements: 2, totals, totalContribution: 72000000,
        entries: [{ cashEntryId: 'refund', occurredAt: '2026-11-06T02:00:00Z', classification: 'UNKNOWN',
          origin: 'MANUAL', reportDirection: 'OUT', categoryCode: 'REFUND', amount: 75000, contribution: 75000 }] });
    }
    const daily = days <= 31;
    const first = new Date(daily ? filter.fromDate : filter.fromDate.slice(0, 7) + '-01');
    const periods = [];
    const iso = (day: Date) => day.toISOString().slice(0, 10);
    for (const start = new Date(first); iso(start) <= filter.toDate; ) {
      const bucket = iso(start);
      const next = new Date(start);
      if (daily) next.setUTCDate(next.getUTCDate() + 1);
      else next.setUTCMonth(next.getUTCMonth() + 1);
      const last = iso(new Date(next.getTime() - 86_400_000));
      const fromDate = bucket < filter.fromDate ? filter.fromDate : bucket;
      const toDate = last > filter.toDate ? filter.toDate : last;
      periods.push({ bucket, fromDate, toDate, partial: fromDate !== bucket || toDate !== last, totals });
      start.setTime(next.getTime());
    }
    const weights = periods.map((_, index) => 1 + index % 5);
    const weight = weights.reduce((sum, item) => sum + item, 0);
    let revenueLeft = totals.revenue, expenseLeft = totals.expense;
    for (const [index, period] of periods.entries()) {
      const revenue = index === periods.length - 1 ? revenueLeft : Math.floor(totals.revenue * weights[index] / weight);
      const expense = index === periods.length - 1 ? expenseLeft : Math.floor(totals.expense * (weights.at(-1 - index) ?? 0) / weight);
      revenueLeft -= revenue;
      expenseLeft -= expense;
      period.totals = { revenue, expense, profit: revenue - expense, profitMargin: null };
    }
    return envelope({ ...totals, filter, granularity: daily ? 'DAY' : 'MONTH',
      status: empty ? 'NO_DATA' : q.has('roomId') ? 'NEGATIVE' : 'POSITIVE',
      directContribution: q.has('roomId') ? totals.profit : null,
      byPeriod: empty ? [] : periods,
      byBuilding: empty ? [] : [{ id: buildingId, name: 'Tòa nhà A', totals,
        directExpense: 28000000, commonExpense: 8000000 }],
      byRoom: empty ? [] : [{ id: roomId, buildingId, code: pagination.page ? 'A102' : 'A101',
        roomRevenue: 0, directExpense: 28000000, directContribution: -28000000 }],
      byExpenseCategory: empty ? [] : [{ code: 'OPERATING_EXPENSE', name: 'Vận hành', expense: 36000000, share: 100 }],
      buildingPagination: { page: 0, size: 20, totalElements: 1 }, roomPagination: pagination,
      unallocated: { revenue: 0, expense: 0, profit: 0, profitMargin: null },
      unknown: { count: 2, totalIn: 0, totalOut: 150000 }, provisional: !empty,
      dataLimitations: ['Một số khoản hoàn tiền chưa liên kết giao dịch gốc.'],
      notes: ['Chi phí chung cấp tòa nhà được trình bày riêng.'],
      method: 'Báo cáo quản trị theo thực thu, thực chi.',
      emptyMessage: empty ? 'Chưa có dữ liệu doanh thu và chi phí được ghi nhận trong kỳ.' : null,
    });
  }
  if (!['/api/v1/reports/finance', '/api/v1/cash-ledger'].includes(url.pathname)) return auth.fetcher(input, init);
  calls.push(url.pathname + url.search);
  if (q.get('sourceId') === 'foreign') return envelope(null, 404, 'Nguồn tiền ngoài phạm vi quản lý.');
  if (q.get('sourceId') === 'retry' && !failed) {
    failed = true;
    return envelope(null, 500);
  }
  if (q.get('sourceId') === 'slow') await new Promise(resolve => setTimeout(resolve, 1200));
  const filter = {
    fromDate: q.get('fromDate') || '2025-12-01', toDate: q.get('toDate') || '2026-11-30',
    areaId: q.get('areaId'), buildingId: q.get('buildingId'), roomId: q.get('roomId'), sourceId: q.get('sourceId'),
    transactionCategory: q.getAll('transactionCategory'), dimension: q.get('dimension'), groupKey: q.get('groupKey'),
  };
  if (url.pathname.endsWith('cash-ledger')) {
    const page = Number(q.get('page'));
    const item = { id: page ? 'replacement' : 'refund', occurredAt: '2026-11-06T02:00:00Z', category: 'DEPOSIT_REFUND',
      origin: 'DEPOSIT_REFUND', sourceId, areaId, buildingId, roomId, direction: page ? 'IN' : 'OUT',
      amount: page ? 20 : 75, reportAmount: page ? -20 : 75, reportDirection: 'OUT',
      note: page ? 'Điều chỉnh hoàn cọc' : 'Hoàn cọc thực tế', settlementId: 'QTOAN-01',
      adjustsId: page ? 'refund' : null, adjustments: page ? [] : ['replacement'],
      correctionKind: page ? 'REVERSAL' : null, confirmationStatus: 'HOST_CONFIRMED', method: 'CASH' };
    const income = Array.from({ length: page ? 1 : 19 }, (_, index) => ({
      ...item, id: 'rent-' + (page * 19 + index), note: 'Thu tiền thuê', origin: 'MANUAL', direction: 'IN',
      amount: 10, reportAmount: 10, reportDirection: 'IN', category: 'RENT', settlementId: null,
      adjustsId: null, adjustments: [], correctionKind: null,
    }));
    const empty = q.get('sourceId') === 'empty';
    return envelope({ items: empty ? [] : q.has('entryId') ? [item].filter(row => row.id === q.get('entryId')) : [item, ...income], page, size: 20, totalElements: empty ? 0 : 22,
      ...(q.has('financialImpact') ? { totalContribution: q.get('financialImpact') === 'UNKNOWN' ? 50000 : 10000000 } : {}) });
  }
  const days = (Date.parse(filter.toDate) - Date.parse(filter.fromDate)) / 86_400_000 + 1;
  const empty = filter.sourceId === 'empty';
  const points = empty ? [] : [
    { ...amounts(200, 55), at: '2026-11-01', drillDown: { ...filter, fromDate: '2026-11-01', toDate: days <= 31 ? '2026-11-01' : '2026-11-30' } },
    { ...amounts(0, 70, 0, 45), at: '2026-11-02', drillDown: { ...filter, fromDate: '2026-11-02', toDate: '2026-11-02' } },
    { ...amounts(0, 0), at: '2026-11-03', drillDown: { ...filter, fromDate: '2026-11-03', toDate: '2026-11-03' } },
  ];
  const group = (key: string, label: string, dimension: string, totalIn: number, totalOut: number, transferOut = 0) =>
    ({ ...amounts(totalIn, totalOut, 0, transferOut), key, label, drillDown: { ...filter, dimension, groupKey: key } });
  return envelope({
    ...amounts(empty ? 0 : filter.sourceId === 'slow' ? 88888 : 200, empty ? 0 : 125, 0, empty ? 0 : 45), filter,
    granularity: days <= 31 ? 'DAY' : 'MONTH', byDay: points, byMonth: points.slice(0, 1),
    emptyMessage: empty ? 'Chưa có giao dịch thu chi được ghi nhận trong khoảng thời gian đã chọn.' : null,
    byArea: empty ? [] : [group('~', 'Chưa phân bổ', 'area', 70, 0)],
    byBuilding: [], byRoom: [], byCategory: empty ? [] : [group('~', 'Chưa phân loại', 'category', 70, 0)],
    bySource: empty ? [] : [group(sourceId, 'Quỹ tiền mặt', 'source', 200, 125, 45)],
    composition: empty ? [] : [group('DEPOSIT', 'Dòng tiền đặt cọc', 'composition', 0, 55)],
  });
};

if (capture) {
  const deadline = performance.now() + 15000;
  const heartbeat = async () => {
    await realFetch('/tests/fixtures/finance-preview.html?heartbeat', { cache: 'no-store' });
    if (!document.querySelector('.finance-panel table') && performance.now() < deadline) window.setTimeout(() => void heartbeat(), 100);
  };
  void heartbeat();
}
if (!parseFinanceRoute(location.pathname, location.search) && !parseProfitLossRoute(location.pathname, location.search)
    && !parseExpenseBreakdownRoute(location.pathname, location.search)) history.replaceState(null, '', initial);
createRoot(document.getElementById('root')!).render(<App />);

