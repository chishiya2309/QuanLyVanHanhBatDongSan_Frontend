import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import '../../src/index.css';
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
    return envelope({ items: empty ? [] : [item, ...income], page, size: 20, totalElements: empty ? 0 : 22 });
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
if (!parseFinanceRoute(location.pathname, location.search)) history.replaceState(null, '', initial);
createRoot(document.getElementById('root')!).render(<App />);

