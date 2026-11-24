import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { FinanceApiError, getProfitLossDetails, getProfitLossReport } from '../../services/financeApi';
import { getAreas, getBuildings, getRoomsByBuilding } from '../../services/propertiesApi';
import type { Room } from '../../types/properties';
import { validFinanceDates } from '../../utils/financeNavigation';
import { profitLossLedgerUrl, profitLossUrl, queryParams,
  type DetailQuery, type Metric, type ProfitLossRoute, type ReportQuery, type Scope } from '../../utils/profitLossNavigation';
import { FinanceFilters, type FinanceCatalog } from './FinanceFilters';
import { dateLabel, money, timestampLabel, transactionCategories } from './financePresentation';
import { ProfitLossTrend } from './ProfitLossTrend';
import './finance.css';
import './profitLoss.css';

const labels = { REVENUE: 'Doanh thu thuần', EXPENSE: 'Chi phí vận hành thuần', PROFIT: 'Kết quả kinh doanh',
  PROFIT_MARGIN: 'Tỷ suất lợi nhuận', UNKNOWN: 'Giao dịch chưa xác định' };
const statuses = { POSITIVE: 'Lời', NEGATIVE: 'Lỗ', ZERO: 'Bằng 0', NO_DATA: 'Chưa có dữ liệu' };
const unavailable = 'Không thể tải báo cáo doanh thu và lời lỗ lúc này. Vui lòng thử lại sau.';
const percent = (value: string | null) => value === null ? 'N/A – Không xác định' : value.replace('.', ',') + '%';
const emptyCatalog: FinanceCatalog = { areas: [], buildings: [], sources: [] };

function propertyScope(value: Scope): Scope {
  return { fromDate: value.fromDate, toDate: value.toDate, areaId: value.areaId,
    buildingId: value.buildingId, roomId: value.roomId };
}

function useRequest<T>(key: string | undefined, load: (signal: AbortSignal) => Promise<T>, expired: () => void) {
  const [attempt, retry] = useState(0);
  const [result, setResult] = useState<{ key: string; attempt: number; data?: T; error?: string }>();
  const request = useEffectEvent(load);
  const onExpired = useEffectEvent(expired);
  useEffect(() => {
    if (key === undefined) return;
    const controller = new AbortController();
    void request(controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ key, attempt, data });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof FinanceApiError && error.status === 401) onExpired();
      const message = error instanceof FinanceApiError && error.status < 500
        ? error.message || 'Bộ lọc không hợp lệ hoặc nằm ngoài phạm vi quản lý.' : unavailable;
      setResult({ key, attempt, error: message });
    });
    return () => controller.abort();
  }, [key, attempt]);
  const current = result?.key === key && result?.attempt === attempt ? result : undefined;
  return { data: current?.data, error: current?.error, retry: () => retry(value => value + 1) };
}

function Pending({ error, retry, label }: { error?: string; retry: () => void; label: string }) {
  return error ? <div className="finance-error" role="alert"><p>{error}</p>
    <button type="button" onClick={retry}>Thử lại</button></div>
    : <div className="finance-loading" role="status" aria-busy="true"><p>{label}</p>
      <div className="finance-placeholder" aria-hidden="true" /></div>;
}

function Pagination({ value, label, change }: {
  value: { page: number; size: number; totalElements: number }; label: string; change: (page: number) => void;
}) {
  const last = Math.max(0, Math.ceil(value.totalElements / value.size) - 1);
  if (!last && !value.page) return null;
  return <nav className="finance-toolbar" aria-label={label}>
    <button type="button" disabled={!value.page} onClick={() => change(Math.min(last, value.page - 1))}>Trang trước</button>
    <span>Trang {value.page + 1} / {last + 1}</span>
    <button type="button" disabled={value.page >= last} onClick={() => change(value.page + 1)}>Trang sau</button>
  </nav>;
}

function DataTable({ label, headers, children }: { label: string; headers: ReactNode[]; children: ReactNode }) {
  return <div className="finance-table-scroll" tabIndex={0} role="region" aria-label={label}>
    <table><thead><tr>{headers.map((header, index) => <th scope="col" key={index}>{header}</th>)}</tr></thead>
      <tbody>{children}</tbody></table>
  </div>;
}
const cash = (value: bigint) => <td className="profit-loss-number">{money(value)}</td>;

export function ProfitLossPage({ route, onNavigate, onSessionExpired }: {
  route: ProfitLossRoute; onNavigate: (url: string) => void; onSessionExpired: () => void;
}) {
  const { filter, selectedBuilding, selectedRoomPage, detail } = route;
  const scope = propertyScope(filter);
  const filterKey = String(queryParams(scope));
  const valid = validFinanceDates({ ...scope, transactionCategory: [] });
  const reportLoad = useRequest(valid ? String(queryParams(filter)) : undefined,
    signal => getProfitLossReport(filter, signal), onSessionExpired);
  const report = reportLoad.data;
  const selectedFilter = { ...scope, fromDate: report?.fromDate, toDate: report?.toDate,
    buildingId: selectedBuilding, roomPage: selectedRoomPage, groupSize: filter.groupSize };
  const roomsLoad = useRequest(selectedBuilding && report ? String(queryParams(selectedFilter)) : undefined,
    signal => getProfitLossReport(selectedFilter, signal), onSessionExpired);
  const detailLoad = useRequest(detail ? String(queryParams(detail)) : undefined,
    signal => getProfitLossDetails(detail!, signal), onSessionExpired);
  const catalogLoad = useRequest('properties', async () => {
    const [areas, buildings] = await Promise.all([getAreas(), getBuildings()]);
    return { areas, buildings, sources: [] };
  }, onSessionExpired);
  const [roomDraft, setRoomDraft] = useState<{ filterKey: string; id?: string }>();
  const draftBuilding = roomDraft?.filterKey === filterKey ? roomDraft.id : filter.buildingId;
  const roomOptions = useRequest(draftBuilding, () => getRoomsByBuilding(draftBuilding!), onSessionExpired);
  const roomsByBuilding: Record<string, Room[]> = draftBuilding && roomOptions.data ? { [draftBuilding]: roomOptions.data } : {};
  const currentRooms = selectedBuilding ? roomsLoad.data : report;
  const detailScope = { ...scope, fromDate: report?.fromDate, toDate: report?.toDate };
  const detailRegion = useRef<HTMLElement>(null);
  const detailSelection = detail && String(queryParams({ ...detail, page: undefined }));
  useEffect(() => {
    if (detailSelection) detailRegion.current?.focus();
  }, [detailSelection]);

  function navigate(next: Partial<ProfitLossRoute>) { onNavigate(profitLossUrl({ ...route, ...next })); }
  function open(metric: Metric, overrides: Partial<DetailQuery> = {}) {
    navigate({ detail: { ...detailScope, metric, ...overrides } });
  }
  function sort(field: ReportQuery['sort']) {
    const current = filter.sort ?? 'PROFIT';
    const order = current === field && (filter.order ?? 'DESC') === 'DESC' ? 'ASC' : 'DESC';
    navigate({ filter: { ...filter, sort: field, order, buildingPage: undefined } });
  }
  function apply(next: Scope) {
    setRoomDraft(undefined);
    navigate({ filter: { ...propertyScope(next), sort: filter.sort, order: filter.order, groupSize: filter.groupSize },
      selectedBuilding: undefined, selectedRoomPage: undefined, detail: undefined });
  }

  return <section className="finance-page profit-loss-page" aria-labelledby="profit-loss-title">
    <header className="finance-heading"><h1 id="profit-loss-title">Doanh thu &amp; Lời lỗ</h1>
      {report && <p className="finance-period">{dateLabel(report.fromDate)} – {dateLabel(report.toDate)}</p>}
    </header>
    <FinanceFilters key={filterKey} propertyOnly applied={{ ...scope, transactionCategory: [] }}
      defaultFrom={report?.fromDate} defaultTo={report?.toDate} catalog={catalogLoad.data ?? emptyCatalog}
      roomsByBuilding={roomsByBuilding} onApply={apply} onBuilding={id => setRoomDraft({ filterKey, id })} />
    {(catalogLoad.error || roomOptions.error) && <div className="finance-toolbar" role="alert">
      <p>Không thể tải đầy đủ danh mục bất động sản.</p>
      <button type="button" onClick={() => { if (catalogLoad.error) catalogLoad.retry(); if (roomOptions.error) roomOptions.retry(); }}>Thử lại</button>
    </div>}
    {!valid ? <p className="finance-panel" role="alert">Chọn đủ hai ngày và kiểm tra thứ tự khoảng thời gian.</p>
      : !report && <div className="finance-panel"><Pending error={reportLoad.error} retry={reportLoad.retry} label="Đang tải báo cáo…" /></div>}
    {report && <>
      {report.provisional && <section className="finance-panel profit-loss-warning" role="status">
        <h2>Kết quả kinh doanh tạm tính</h2>
        <p>{report.unknown.count} giao dịch chưa xác định. Tiền vào {money(report.unknown.totalIn)}, tiền ra {money(report.unknown.totalOut)}.</p>
        <div><button type="button" onClick={() => open('UNKNOWN')}>Xem giao dịch chưa xác định</button></div>
      </section>}
      <dl className="finance-stats profit-loss-stats">
        <div><dt>{labels.REVENUE}</dt><dd><button type="button" onClick={() => open('REVENUE')}>{money(report.revenue)}</button></dd></div>
        <div><dt>{labels.EXPENSE}</dt><dd><button type="button" onClick={() => open('EXPENSE')}>{money(report.expense)}</button></dd></div>
        <div><dt>{filter.roomId ? 'Chênh lệch thu chi trực tiếp' : labels.PROFIT}</dt>
          <dd><button type="button" onClick={() => open('PROFIT')}>{money(report.directContribution ?? report.profit)}</button></dd>
          <small data-status={report.status}>{statuses[report.status]}</small></div>
        <div><dt>{labels.PROFIT_MARGIN}</dt><dd><button type="button" onClick={() => open('PROFIT_MARGIN')}>{percent(report.profitMargin)}</button></dd></div>
      </dl>
      {report.status === 'NO_DATA' ? <p className="finance-panel" role="status">{report.emptyMessage ?? 'Chưa có dữ liệu trong kỳ.'}</p>
        : <ProfitLossTrend points={report.byPeriod} monthly={report.granularity === 'MONTH'}
          open={point => open('PROFIT', { fromDate: point.fromDate, toDate: point.toDate })} />}
      <section className="finance-panel">
        <h2>So sánh tòa nhà</h2>
        <DataTable label="So sánh tòa nhà" headers={[
          'Tòa nhà', ...(['REVENUE', 'EXPENSE', 'PROFIT', 'PROFIT_MARGIN'] as const).map(field =>
            <button type="button" key={field} onClick={() => sort(field)} aria-label={'Sắp xếp theo ' + labels[field]}>
              {labels[field]}{(filter.sort ?? 'PROFIT') === field ? ((filter.order ?? 'DESC') === 'ASC' ? ' (tăng)' : ' (giảm)') : ''}
            </button>), 'Chi phí trực tiếp', 'Chi phí chung',
        ]}>
          {report.byBuilding.map(row => <tr key={row.id}>
            <th scope="row"><button type="button" aria-pressed={selectedBuilding === row.id}
              onClick={() => navigate({ selectedBuilding: row.id === selectedBuilding ? undefined : row.id, selectedRoomPage: undefined })}>
              {row.name ?? 'Tòa nhà ' + row.id}</button>
              <button className="profit-loss-row-action" type="button" onClick={() => open('PROFIT', { buildingId: row.id })}>Đối chiếu</button></th>
            {cash(row.totals.revenue)}{cash(row.totals.expense)}{cash(row.totals.profit)}
            <td className="profit-loss-number">{percent(row.totals.profitMargin)}</td>
            {cash(row.directExpense)}{cash(row.commonExpense)}
          </tr>)}
        </DataTable>
        {!report.byBuilding.length && <p>Trang này chưa có dữ liệu tòa nhà.</p>}
        <Pagination value={report.buildingPagination} label="Trang tòa nhà" change={buildingPage => navigate({ filter: { ...filter, buildingPage } })} />
      </section>
      <div className="profit-loss-columns">
        <section className="finance-panel">
          <h2>Thu chi trực tiếp theo phòng</h2>
          {selectedBuilding && <div className="finance-toolbar">
            <button type="button" onClick={() => navigate({ selectedBuilding: undefined, selectedRoomPage: undefined })}>Bỏ chọn tòa nhà</button>
            {currentRooms?.byBuilding[0] && <p>{currentRooms.byBuilding[0].name ?? 'Tòa nhà đã chọn'}. Chi phí chung {money(currentRooms.byBuilding[0].commonExpense)}.</p>}
          </div>}
          <p className="finance-note">Chênh lệch cấp phòng chỉ gồm thu chi trực tiếp, chưa bao gồm chi phí chung và khoản chưa phân bổ.</p>
          {!currentRooms ? <Pending error={roomsLoad.error} retry={roomsLoad.retry} label="Đang tải phòng…" />
            : <>
              <DataTable label="Thu chi trực tiếp theo phòng" headers={['Phòng', 'Doanh thu', 'Chi phí trực tiếp', 'Chênh lệch']}>
                {currentRooms.byRoom.map(row => <tr key={row.id + (row.buildingId ?? '')}>
                  <th scope="row">{row.code ?? 'Phòng ' + row.id}
                    <button className="profit-loss-row-action" type="button" onClick={() => open('PROFIT', {
                      roomId: row.id, buildingId: row.buildingId ?? selectedBuilding ?? filter.buildingId,
                    })}>Đối chiếu</button></th>
                  {cash(row.revenue)}{cash(row.expense)}{cash(row.contribution)}
                </tr>)}
              </DataTable>
              {!currentRooms.byRoom.length && <p>Trang này chưa có dữ liệu phòng.</p>}
              <Pagination value={currentRooms.roomPagination} label="Trang phòng" change={roomPage => selectedBuilding
                ? navigate({ selectedRoomPage: roomPage }) : navigate({ filter: { ...filter, roomPage } })} />
            </>}
        </section>
        <section className="finance-panel">
          <h2>Cơ cấu chi phí</h2>
          <DataTable label="Cơ cấu chi phí" headers={['Danh mục', 'Chi phí thuần', 'Tỷ trọng']}>
            {report.byExpenseCategory.map(row => <tr key={row.code}>
              <th scope="row"><button type="button" onClick={() => open('EXPENSE', { categoryCode: row.code })}>{row.name}</button></th>
              {cash(row.expense)}<td className="profit-loss-number">{percent(row.share)}</td>
            </tr>)}
          </DataTable>
          {!report.byExpenseCategory.length && <p>Chưa có chi phí theo danh mục.</p>}
          <p>Chưa phân bổ cho tòa nhà. Thu {money(report.unallocated.revenue)}, chi {money(report.unallocated.expense)}.</p>
          <div><button type="button" onClick={() => open('PROFIT', { unallocated: true })}>Đối chiếu khoản chưa phân bổ</button></div>
        </section>
      </div>
      <section className="finance-panel">
        <details><summary>Phương pháp tính và giới hạn dữ liệu</summary>
          <div className="profit-loss-method"><p>{report.method}</p>
            {[...report.notes, ...report.dataLimitations].map((note, index) => <p key={index}>{note}</p>)}</div>
        </details>
      </section>
    </>}
    {detail && <section className="finance-panel profit-loss-details" aria-labelledby="profit-loss-detail"
      ref={detailRegion} tabIndex={-1}>
      <div className="finance-heading"><h2 id="profit-loss-detail">Đối chiếu {labels[detail.metric].toLocaleLowerCase('vi')}</h2>
        <button type="button" onClick={() => navigate({ detail: undefined })}>Đóng chi tiết</button></div>
      {!detailLoad.data ? <Pending error={detailLoad.error} retry={detailLoad.retry} label="Đang tải giao dịch…" /> : <>
        <p>Tổng đóng góp {money(detailLoad.data.totalContribution)} trên {detailLoad.data.totalElements} giao dịch.</p>
        {detail.metric === 'PROFIT_MARGIN' && <p>Doanh thu {money(detailLoad.data.totals.revenue)}, kết quả {money(detailLoad.data.totals.profit)}, tỷ suất {percent(detailLoad.data.totals.profitMargin)}.</p>}
        <DataTable label="Giao dịch đối chiếu" headers={['Thời điểm', 'Danh mục', 'Số tiền', 'Đóng góp', 'Nghiệp vụ gốc']}>
          {detailLoad.data.entries.map((row, index) => <tr key={row.cashEntryId ?? index}>
            <td>{timestampLabel(row.occurredAt)}</td>
            <td>{transactionCategories[row.categoryCode ?? '~'] ?? row.categoryCode}{row.correctionKind && <small> ({row.correctionKind === 'REVERSAL' ? 'Đảo bút toán' : 'Điều chỉnh'})</small>}</td>
            {cash(row.amount)}{cash(row.contribution)}
            <td>{row.cashEntryId && <button type="button" onClick={() => onNavigate(profitLossLedgerUrl(row.cashEntryId!, propertyScope(detail), route))}>Mở sổ thu chi</button>}
              {row.references.map(id => <small key={id}> {id}</small>)}</td>
          </tr>)}
        </DataTable>
        {!detailLoad.data.entries.length && <p>Trang này chưa có giao dịch đối chiếu.</p>}
        <Pagination value={detailLoad.data} label="Trang giao dịch đối chiếu" change={page => navigate({ detail: { ...detail, page } })} />
      </>}
    </section>}
  </section>;
}
