export const expenseBreakdownPath = '/reports/expense-breakdown';
export const expensePeriods = ['MONTH', 'QUARTER', 'YEAR', 'CUSTOM'] as const;
export const expenseSorts = ['GROSS_EXPENSE', 'NET_EXPENSE', 'RATIO', 'EXPENSE_COUNT', 'EXPENSE_DELTA', 'GROWTH_RATE'] as const;
export type ExpensePeriod = typeof expensePeriods[number];
export type ExpenseSort = typeof expenseSorts[number];
export type ExpenseView = 'composition' | 'net' | 'comparison';
const scopeKeys = ['fromDate', 'toDate', 'areaId', 'buildingId', 'roomId'] as const;
export type ExpenseFilter = Partial<Record<typeof scopeKeys[number], string>> & {
  periodType?: ExpensePeriod; sort?: ExpenseSort; order?: 'ASC' | 'DESC';
};
export type ExpenseBreakdownRoute = { kind: 'expense-breakdown'; filter: ExpenseFilter; view: ExpenseView };

export function expenseParams(filter: ExpenseFilter) {
  const params = new URLSearchParams();
  for (const key of [...scopeKeys, 'periodType', 'sort', 'order'] as const) {
    const value = filter[key];
    if (value) params.set(key, value);
  }
  return params;
}

export function parseExpenseBreakdownRoute(path: string, query: string): ExpenseBreakdownRoute | null {
  if (path.replace(/\/+$/, '') !== expenseBreakdownPath) return null;
  const params = new URLSearchParams(query);
  const filter: ExpenseFilter = {};
  for (const key of scopeKeys) {
    const value = params.get(key);
    if (value) filter[key] = value;
  }
  filter.periodType = expensePeriods.find(value => value === params.get('periodType'));
  filter.sort = expenseSorts.find(value => value === params.get('sort'));
  const order = params.get('order');
  if (order === 'ASC' || order === 'DESC') filter.order = order;
  const view = params.get('view');
  return { kind: 'expense-breakdown', filter, view: view === 'net' || view === 'comparison' ? view : 'composition' };
}

export function expenseBreakdownUrl({ filter, view }: ExpenseBreakdownRoute) {
  const params = expenseParams(filter);
  if (view !== 'composition') params.set('view', view);
  return expenseBreakdownPath + (params.size ? '?' + params : '');
}
