import { useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { getExpenseBreakdown, type ExpenseBreakdownReport, type ExpenseCategory, type ExpenseTrace } from '../../services/financeApi';
import { getAreas, getBuildings, getRoomsByBuilding } from '../../services/propertiesApi';
import { financeUrl, validFinanceDates } from '../../utils/financeNavigation';
import { expenseBreakdownPath, expenseBreakdownUrl, expenseParams,
  type ExpenseBreakdownRoute, type ExpenseFilter, type ExpensePeriod, type ExpenseSort, type ExpenseView } from '../../utils/expenseBreakdownNavigation';
import { FilterSelect } from './FinanceFilters';
import { FinancePending } from './FinancePending';
import { useFinanceRequest } from './useFinanceRequest';
import { dateLabel, money } from './financePresentation';
import './finance.css';
import './expenseBreakdown.css';

const unavailable = 'Không thể tải báo cáo cơ cấu chi phí lúc này. Vui lòng thử lại.';
const periods: { value: ExpensePeriod; label: string }[] = [
  { value: 'MONTH', label: 'Tháng' }, { value: 'QUARTER', label: 'Quý' },
  { value: 'YEAR', label: 'Năm' }, { value: 'CUSTOM', label: 'Khoảng tùy chỉnh' },
];
const views: { value: ExpenseView; label: string }[] = [
  { value: 'composition', label: 'Cơ cấu chi phí' }, { value: 'net', label: 'Chi phí thuần' },
  { value: 'comparison', label: 'So sánh hai kỳ' },
];
const changes: Record<string, string> = {
  NEW: 'Mới phát sinh', NO_LONGER_INCURRED: 'Không còn phát sinh',
  INCREASED: 'Tăng', DECREASED: 'Giảm', UNCHANGED: 'Không đổi',
};
const percent = (value: string | null) => value === null ? 'N/A' : value.replace('.', ',') + '%';
const signedMoney = (value: bigint) => (value > 0n ? '+' : '') + money(value);
const rowKey = (row: ExpenseCategory) => row.code ?? '~';
const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

function follow(event: MouseEvent<HTMLAnchorElement>, onNavigate: (url: string) => void) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  onNavigate(event.currentTarget.getAttribute('href')!);
}

function ExpenseFilters({ filter, apply, reset, expired }: {
  filter: ExpenseFilter; apply: (filter: ExpenseFilter) => void; reset: () => void; expired: () => void;
}) {
  const [draft, setDraft] = useState(filter);
  const [invalid, setInvalid] = useState(false);
  const periodType = draft.periodType ?? (draft.fromDate || draft.toDate ? 'CUSTOM' : 'MONTH');
  const today = calendar.format(new Date());
  const catalog = useFinanceRequest('expense-property-options', async () => {
    const [areas, buildings] = await Promise.all([getAreas(), getBuildings()]);
    return { areas, buildings };
  }, expired, 'Không thể tải danh mục bất động sản.');
  const buildingId = draft.buildingId;
  const rooms = useFinanceRequest(buildingId, () => getRoomsByBuilding(buildingId!), expired, 'Không thể tải danh sách phòng.');
  const buildings = catalog.data?.buildings ?? [];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = { ...draft };
    if (periodType === 'CUSTOM') {
      next.periodType = 'CUSTOM';
    } else if (draft.fromDate && draft.fromDate <= today && validFinanceDates({ fromDate: draft.fromDate,
      toDate: draft.fromDate, transactionCategory: [] })) {
      const months = periodType === 'YEAR' ? 12 : periodType === 'QUARTER' ? 3 : 1;
      const start = new Date(draft.fromDate + 'T00:00:00Z');
      start.setUTCDate(1);
      start.setUTCMonth(Math.floor(start.getUTCMonth() / months) * months);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + months, 0);
      next.fromDate = start.toISOString().slice(0, 10);
      next.toDate = end.toISOString().slice(0, 10);
      if (next.toDate > today) next.toDate = today;
    }
    const valid = validFinanceDates({ ...next, transactionCategory: [] })
      && (periodType !== 'CUSTOM' || Boolean(next.fromDate && next.toDate))
      && (!next.toDate || next.toDate <= today);
    setInvalid(!valid);
    if (valid) apply(next);
  }

  return <form className="finance-filters" aria-label="Bộ lọc cơ cấu chi phí" onSubmit={submit}>
    <div className="finance-filter-grid">
      <label className="finance-field">Loại kỳ
        <select value={periodType} onChange={event => {
          setInvalid(false);
          setDraft({ ...draft, periodType: event.target.value as ExpensePeriod, fromDate: undefined, toDate: undefined });
        }}>
          {periods.map(period => <option key={period.value} value={period.value}>{period.label}</option>)}
        </select>
      </label>
      <label className="finance-field">{periodType === 'CUSTOM' ? 'Từ ngày' : 'Ngày trong kỳ'}
        <input type="date" max={today} value={draft.fromDate ?? ''} aria-invalid={invalid}
          aria-describedby={invalid ? 'expense-date-error' : undefined} onChange={event => setDraft({
            ...draft, periodType, fromDate: event.target.value || undefined,
            toDate: periodType === 'CUSTOM' ? draft.toDate : undefined,
          })} />
      </label>
      {periodType === 'CUSTOM' && <label className="finance-field">Đến ngày
        <input type="date" max={today} value={draft.toDate ?? ''} aria-invalid={invalid}
          aria-describedby={invalid ? 'expense-date-error' : undefined}
          onChange={event => setDraft({ ...draft, toDate: event.target.value || undefined })} />
      </label>}
      <FilterSelect label="Khu vực" value={draft.areaId} options={catalog.data?.areas ?? []} onChange={areaId => {
        const compatible = !areaId || buildings.find(building => building.id === draft.buildingId)?.areaId === areaId;
        setDraft({ ...draft, areaId, buildingId: compatible ? draft.buildingId : undefined,
          roomId: compatible ? draft.roomId : undefined });
      }} />
      <FilterSelect label="Tòa nhà" value={draft.buildingId}
        options={buildings.filter(building => !draft.areaId || draft.areaId === building.areaId)}
        onChange={buildingId => setDraft({ ...draft, buildingId, roomId: undefined })} />
      <FilterSelect label="Phòng" value={draft.roomId} disabled={!draft.buildingId && !draft.roomId}
        options={(rooms.data ?? []).map(room => ({ id: room.id, name: room.code }))}
        onChange={roomId => setDraft({ ...draft, roomId })} />
    </div>
    {periodType !== 'CUSTOM' && <p className="finance-period">Để trống ngày để xem kỳ hiện tại.</p>}
    <div className="finance-toolbar">
      <button type="submit" className="finance-primary">Áp dụng</button>
      <button type="button" onClick={() => { setDraft({}); setInvalid(false); reset(); }}>Khôi phục mặc định</button>
    </div>
    {invalid && <p id="expense-date-error" role="alert">Chọn khoảng ngày hợp lệ, không vượt quá hôm nay.</p>}
    {(catalog.error || rooms.error) && <div role="alert">
      <p>{catalog.error ?? rooms.error}</p>
      <button type="button" onClick={() => { if (catalog.error) catalog.retry(); if (rooms.error) rooms.retry(); }}>Tải lại danh mục</button>
    </div>}
  </form>;
}

type TraceLink = (trace: ExpenseTrace, label: ReactNode, metric?: 'gross' | 'net', accessibleName?: string) => ReactNode;

function ExpenseCharts({ view, report, link }: { view: ExpenseView; report: ExpenseBreakdownReport; link: TraceLink }) {
  if (view === 'composition') {
    if (!report.ratioAvailable || report.current.totalGrossExpense <= 0n) return <p role="status">Không đủ điều kiện hiển thị tỷ trọng. Xem số tiền trong bảng phân tích.</p>;
    const total = report.current.totalGrossExpense;
    const groups = report.categories.filter(row => row.current.grossExpense > 0n);
    const segments = [];
    let cumulative = 0n;
    for (const [index, row] of groups.entries()) {
      const start = cumulative;
      cumulative += row.current.grossExpense;
      segments.push({ row, index, start: Number(start * 100_000n / total), end: Number(cumulative * 100_000n / total) });
    }
    return <div className="expense-composition">
      <svg viewBox="0 0 180 180" role="group" aria-label="Tỷ trọng theo chi phí trước giảm trừ">
        {segments.map(({ row, index, start, end }) => <g key={rowKey(row)} className="expense-slice" data-series={index % 5}>
          {link(row.currentDrillDown, <circle cx="90" cy="90" r="67" pathLength="100000"
            strokeDasharray={String(end - start) + ' ' + String(100_000 - end + start)}
            strokeDashoffset={-start} transform="rotate(-90 90 90)">
            <title>{row.name}, {money(row.current.grossExpense)}, {percent(row.ratio)}</title>
          </circle>, 'gross', 'Xem giao dịch ' + row.name + ', tỷ trọng ' + percent(row.ratio))}
        </g>)}
      </svg>
      <div>
        <p className="finance-period">Tỷ trọng theo chi phí trước giảm trừ</p>
        <ul className="expense-legend">{groups.map((row, index) => <li key={rowKey(row)} data-series={index % 5}>
          {link(row.currentDrillDown, row.name, 'gross')}
          <span>{money(row.current.grossExpense)}</span><strong>{percent(row.ratio)}</strong>
        </li>)}</ul>
      </div>
    </div>;
  }
  if (!report.categories.length) return <p role="status">Chưa có chi phí theo danh mục trong hai kỳ.</p>;

  const compare = view === 'comparison';
  let min = 0n;
  let max = 0n;
  for (const row of report.categories) {
    for (const value of compare ? [row.current.netExpense, row.previous.netExpense] : [row.current.netExpense]) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  const x = (value: bigint) => min === max ? 0 : Number((value - min) * 5000n / (max - min)) / 10;
  const zero = x(0n);
  function bar(name: string, label: string, value: bigint, trace: ExpenseTrace, prior = false) {
    return <div className="expense-bar-row" data-prior={prior}>
      {link(trace, <>{label}<strong>{money(value)}</strong></>, 'net', 'Xem giao dịch ' + name + ', ' + label + ', ' + money(value))}
      <svg viewBox="0 0 500 16" preserveAspectRatio="none" role="group" aria-label={label}>
        <line x1={zero} x2={zero} y1="0" y2="16" />
        {link(trace, <rect x={Math.min(zero, x(value))} y="3" width={Math.abs(x(value) - zero)} height="10" />,
          'net', 'Xem giao dịch ' + name + ', ' + label)}
      </svg>
    </div>;
  }
  return <div className="expense-bars">
    <p className="finance-period">Chi phí vận hành thuần (VNĐ), đường dọc tại 0</p>
    {report.categories.map(row => <div key={rowKey(row)} className="expense-bar-category">
      <h3>{row.name}</h3>
      {bar(row.name, compare ? 'Kỳ phân tích' : 'Chi phí thuần', row.current.netExpense, row.currentDrillDown)}
      {compare && bar(row.name, 'Kỳ đối chiếu', row.previous.netExpense, row.previousDrillDown, true)}
    </div>)}
  </div>;
}

const columns: { label: string; sort?: ExpenseSort }[] = [
  { label: 'Danh mục' }, { label: 'Số giao dịch', sort: 'EXPENSE_COUNT' },
  { label: 'Trước giảm trừ', sort: 'GROSS_EXPENSE' }, { label: 'Giảm trừ' },
  { label: 'Chi phí thuần', sort: 'NET_EXPENSE' }, { label: 'Tỷ trọng', sort: 'RATIO' },
  { label: 'Chi phí thuần kỳ đối chiếu' }, { label: 'Chênh lệch', sort: 'EXPENSE_DELTA' },
  { label: 'Tỷ lệ biến động', sort: 'GROWTH_RATE' },
];

export function ExpenseBreakdownPage({ route, onNavigate, onSessionExpired }: {
  route: ExpenseBreakdownRoute; onNavigate: (url: string) => void; onSessionExpired: () => void;
}) {
  const { filter, view } = route;
  const query = String(expenseParams(filter));
  const valid = validFinanceDates({ ...filter, transactionCategory: [] })
    && (filter.periodType !== 'CUSTOM' || Boolean(filter.fromDate && filter.toDate));
  const load = useFinanceRequest(valid ? query : undefined, signal => getExpenseBreakdown(filter, signal), onSessionExpired, unavailable);
  const report = load.data;
  const sort = filter.sort ?? 'NET_EXPENSE';
  const order = filter.order ?? 'DESC';
  const navigate = (next: Partial<ExpenseBreakdownRoute>) => onNavigate(expenseBreakdownUrl({ ...route, ...next }));
  const link: TraceLink = ({ financialImpact, financialCategoryCode, uncategorized, ...scope }, label, metric, accessibleName) => {
    const href = financeUrl({ kind: 'cash-ledger', filter: { ...scope, transactionCategory: [] }, page: 0, size: 20,
      financial: { financialImpact, financialCategoryCode, uncategorized }, expenseMetric: metric,
      expenseBreakdownSearch: expenseBreakdownUrl(route).slice(expenseBreakdownPath.length) });
    return <a href={href} aria-label={accessibleName} onClick={event => follow(event, onNavigate)}>{label}</a>;
  };

  return <section className="finance-page expense-breakdown-page" aria-labelledby="expense-title">
    <header className="finance-heading"><h1 id="expense-title">Cơ cấu chi phí</h1></header>
    <ExpenseFilters key={String(expenseParams({ ...filter, sort: undefined, order: undefined }))} filter={filter} expired={onSessionExpired}
      apply={next => navigate({ filter: { ...next, sort, order } })} reset={() => navigate({ filter: {}, view: 'composition' })} />
    {!valid ? <p role="alert">Chọn đủ hai ngày và kiểm tra thứ tự khoảng thời gian.</p>
      : !report && <div className="finance-panel"><FinancePending label="Đang tải báo cáo…" error={load.error} retry={load.retry} /></div>}
    {report && <>
      <dl className="expense-periods">
        {([['Kỳ phân tích', report.current], ['Kỳ đối chiếu', report.previous]] as const).map(([label, period]) =>
          <div key={label}><dt>{label}</dt><dd>{dateLabel(period.fromDate)} đến {dateLabel(period.toDate)}</dd></div>)}
      </dl>
      <dl className="finance-stats expense-stats">
        <div><dt>Chi phí vận hành thuần</dt><dd>{money(report.current.totalNetExpense)}</dd>
          <dd className="expense-stat-note">{signedMoney(report.expenseDelta)} ({percent(report.growthRate)}) so với kỳ đối chiếu
            {report.comparisonProvisional && <small>Biến động tạm tính</small>}</dd></div>
        <div><dt>Chi phí trước giảm trừ</dt><dd>{money(report.current.totalGrossExpense)}</dd>
          <dd className="expense-stat-note">{report.current.expenseCount} giao dịch chi phí</dd></div>
        <div><dt>Giảm trừ chi phí</dt><dd>{money(report.current.totalExpenseDeductions)}</dd>
          <dd className="expense-stat-note">{report.deductionRecognitionSupported
            ? report.current.deductionCount + ' giao dịch giảm trừ'
            : 'Chưa hỗ trợ nhận diện hoàn trả từ nhà cung cấp.'}</dd></div>
        {(report.largestExpense || report.largestIncrease) && <div><dt>Nhóm cần xem</dt>
          {report.largestExpense && <dd className="expense-stat-note">Chi phí thuần lớn nhất{' '}
            {link(report.largestExpense.currentDrillDown, report.largestExpense.name, 'net')} ({money(report.largestExpense.current.netExpense)})</dd>}
          {report.largestIncrease && <dd className="expense-stat-note">Tăng nhiều nhất{' '}
            {link(report.largestIncrease.currentDrillDown, report.largestIncrease.name, 'net')} ({signedMoney(report.largestIncrease.expenseDelta)}, {percent(report.largestIncrease.growthRate)})</dd>}
        </div>}
      </dl>
      {(report.warnings.length > 0 || report.current.unknown.count > 0 || report.previous.unknown.count > 0) && <section className="finance-panel expense-warnings" aria-label="Giới hạn dữ liệu">
        <h2>Giới hạn dữ liệu</h2>
        <ul>{report.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
        {([['Kỳ phân tích', report.current], ['Kỳ đối chiếu', report.previous]] as const).map(([label, period]) => Boolean(period.unknown.count) &&
          <p key={label}><strong>{label}</strong> có {period.unknown.count} giao dịch chưa xác định. Tiền vào {money(period.unknown.totalIn)},
            tiền ra {money(period.unknown.totalOut)}. {period.unknownDrillDown && link(period.unknownDrillDown, 'Xem giao dịch chưa xác định',
              undefined, 'Xem giao dịch chưa xác định, ' + label)}</p>)}
      </section>}
      {(report.current.expenseWithoutPropertyCount > 0 || report.previous.expenseWithoutPropertyCount > 0) &&
        <section className="finance-panel" aria-label="Chi phí chưa gắn bất động sản">
          <h2>Chi phí chưa gắn bất động sản</h2>
          {([['Kỳ phân tích', report.current], ['Kỳ đối chiếu', report.previous]] as const).map(([label, period]) =>
            <p key={label}>{label}: {money(period.expenseWithoutProperty)} ({period.expenseWithoutPropertyCount} giao dịch)</p>)}
        </section>}
      {!report.current.hasExpenseData && <p role="status">Kỳ phân tích chưa có giao dịch chi phí được nhận diện.</p>}
      <section className="finance-panel expense-chart" aria-labelledby="expense-chart-title">
        <h2 id="expense-chart-title">Biểu đồ chi phí</h2>
        <div className="finance-toolbar" role="group" aria-label="Chế độ biểu đồ">
          {views.map(item => <button type="button" key={item.value} aria-pressed={view === item.value}
            onClick={() => navigate({ view: item.value })}>{item.label}</button>)}
        </div>
        <ExpenseCharts view={view} report={report} link={link} />
      </section>
      <section className="finance-panel" aria-labelledby="expense-table-title">
        <h2 id="expense-table-title">Phân tích theo danh mục</h2>
        {report.categories.length > 0 ? <div className="finance-table-scroll" tabIndex={0} role="region" aria-label="Bảng cơ cấu chi phí">
          <table><thead><tr>{columns.map(column => <th key={column.label} scope="col"
            aria-sort={column.sort === sort ? (order === 'ASC' ? 'ascending' : 'descending') : undefined}>
            {column.sort ? <button type="button" aria-label={'Sắp xếp theo ' + column.label} onClick={() => navigate({
              filter: { ...filter, sort: column.sort, order: sort === column.sort && order === 'DESC' ? 'ASC' : 'DESC' },
            })}>{column.label}{column.sort === sort ? (order === 'ASC' ? ' (tăng)' : ' (giảm)') : ''}</button> : column.label}
          </th>)}</tr></thead>
            <tbody>{report.categories.map(row => <tr key={rowKey(row)}>
              <th scope="row">{row.name}<small className="expense-change">{changes[row.change]}</small>
                <div className="expense-table-links">
                  {link(row.currentDrillDown, 'Kỳ phân tích', 'net', 'Xem chi tiết ' + row.name + ' kỳ phân tích')}
                  {link(row.previousDrillDown, 'Kỳ đối chiếu', 'net', 'Xem chi tiết ' + row.name + ' kỳ đối chiếu')}
                </div></th>
              <td>{row.current.expenseCount}</td><td>{money(row.current.grossExpense)}</td>
              <td>{money(row.current.expenseDeductions)}</td><td>{money(row.current.netExpense)}</td>
              <td>{percent(row.ratio)}</td><td>{money(row.previous.netExpense)}</td>
              <td>{signedMoney(row.expenseDelta)}</td><td>{percent(row.growthRate)}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p role="status">Chưa có danh mục chi phí để đối chiếu.</p>}
      </section>
    </>}
  </section>;
}
