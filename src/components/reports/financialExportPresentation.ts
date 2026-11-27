import type { FinancialFilter, FinancialReportType } from '../../services/financialExportApi';
import type { ExpenseBreakdownReport, ProfitLossReport } from '../../services/financeApi';
import type { ExpenseFilter } from '../../utils/expenseBreakdownNavigation';
import type { ReportQuery } from '../../utils/profitLossNavigation';

function decimalCompare(a: string, b: string) {
  const fraction = (value: string) => value.split('.')[1]?.length ?? 0;
  const scale = Math.max(fraction(a), fraction(b));
  const integer = (value: string) => BigInt(value.replace('.', '') + '0'.repeat(scale - fraction(value)));
  return compare(integer(a), integer(b));
}

function compare<T extends string | number | bigint>(a: T, b: T) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function byMetric<T extends string | number | bigint>(a: T | null, b: T | null, order?: 'ASC' | 'DESC') {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  const result = typeof a === 'string' && typeof b === 'string' ? decimalCompare(a, b) : compare(a, b);
  return order === 'ASC' ? result : -result;
}

export function profitLossSnapshotPage(report: ProfitLossReport, filter: ReportQuery) {
  const metric = (item: ProfitLossReport['byBuilding'][number]) => {
    switch (filter.sort) {
      case 'REVENUE': return item.totals.revenue;
      case 'EXPENSE': return item.totals.expense;
      case 'PROFIT_MARGIN': return item.totals.profitMargin;
      default: return item.totals.profit;
    }
  };
  const buildings = report.byBuilding.filter(item => !filter.buildingId || item.id === filter.buildingId)
    .sort((a, b) => byMetric(metric(a), metric(b), filter.order) || compare(a.id, b.id));
  const rooms = filter.buildingId ? report.byRoom.filter(room => room.buildingId === filter.buildingId) : report.byRoom;
  const size = filter.groupSize ?? 100;
  const buildingPage = filter.buildingPage ?? 0;
  const roomPage = filter.roomPage ?? 0;
  return { ...report, byBuilding: buildings.slice(buildingPage * size, (buildingPage + 1) * size),
    byRoom: rooms.slice(roomPage * size, (roomPage + 1) * size),
    buildingPagination: { page: buildingPage, size, totalElements: buildings.length },
    roomPagination: { page: roomPage, size, totalElements: rooms.length } };
}

export function orderExpenseSnapshot(report: ExpenseBreakdownReport, filter: ExpenseFilter) {
  const metric = (item: ExpenseBreakdownReport['categories'][number]) => {
    switch (filter.sort) {
      case 'GROSS_EXPENSE': return item.current.grossExpense;
      case 'RATIO': return item.ratio;
      case 'EXPENSE_COUNT': return item.current.expenseCount;
      case 'EXPENSE_DELTA': return item.expenseDelta;
      case 'GROWTH_RATE': return item.growthRate;
      default: return item.current.netExpense;
    }
  };
  const categories = [...report.categories].sort((a, b) => byMetric(metric(a), metric(b), filter.order) || (
    a.code == null ? b.code == null ? 0 : 1 : b.code == null ? -1 : compare(a.code, b.code)));
  return { ...report, categories };
}

const scopeKeys = ['fromDate', 'toDate', 'areaId', 'buildingId', 'roomId', 'sourceId'] as const;
export function sameFinancialScope(a: FinancialFilter, b: FinancialFilter, type: Exclude<FinancialReportType, 'COMBINED'>) {
  return scopeKeys.every(key => a[key] === b[key])
    && JSON.stringify([...new Set(a.transactionCategory)].sort()) === JSON.stringify([...new Set(b.transactionCategory)].sort())
    && (type !== 'EXPENSE_BREAKDOWN' || a.periodType === b.periodType);
}
