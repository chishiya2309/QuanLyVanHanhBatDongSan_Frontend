import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { AuthApiError } from '../../services/authErrors';
import { FinanceApiError, getCashLedger, getFinanceReport, type FinanceGroup, type FinanceReport, type LedgerPage } from '../../services/financeApi';
import { listFundingSources } from '../../services/fundingApi';
import { getAreas, getBuildings, getRoomsByBuilding } from '../../services/propertiesApi';
import type { Room } from '../../types/properties';
import { drillDownUrl, financeParams, financeUrl, returnToFinance, validFinanceDates, type FinanceFilter, type FinanceRoute } from '../../utils/financeNavigation';
import { FinanceFilters, type FinanceCatalog } from './FinanceFilters';
import { FinanceTrend } from './FinanceTrend';
import { dateLabel, money, timestampLabel, transactionCategories } from './financePresentation';
import './finance.css';

const emptyCatalog: FinanceCatalog = { areas: [], buildings: [], sources: [] };
const reportError = 'Không thể tải báo cáo thu chi và dòng tiền lúc này. Vui lòng thử lại sau.';
const ledgerError = 'Không thể tải sổ thu chi lúc này. Vui lòng thử lại sau.';
type Payload = { kind: 'finance'; report: FinanceReport } | { kind: 'cash-ledger'; ledger: LedgerPage };
type Result = { payload: Payload } | { error: string };
const statuses: Record<string, string> = {
  HOST_CONFIRMED: 'Host đã xác nhận', PAYMENT_CONFIRMED: 'Thanh toán đã xác nhận', LEGACY_LEDGER: 'Đã ghi sổ',
};
const methods: Record<string, string> = { CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', PAYOS: 'payOS', OTHER: 'Khác' };

function follow(event: MouseEvent<HTMLAnchorElement>, navigate: (url: string) => void) {
  if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(event.currentTarget.getAttribute('href')!);
}

function FinanceLink({ href, navigate, children }: { href: string; navigate: (url: string) => void; children: ReactNode }) {
  return <a href={href} onClick={event => follow(event, navigate)}>{children}</a>;
}

function Breakdown({ title, rows, reportFilter, navigate }: {
  title: string; rows: FinanceGroup[]; reportFilter: FinanceFilter; navigate: (url: string) => void;
}) {
  if (!rows.length) return null;
  const showTransfers = rows.some(row => row.transferIn !== 0n || row.transferOut !== 0n);
  return <section className="finance-panel">
    <h2>{title}</h2>
    <div className="finance-table-scroll">
      <table aria-label={title}>
        <thead><tr><th scope="col">{title}</th><th scope="col">Thực thu</th><th scope="col">Thực chi</th>
          <th scope="col">Dòng tiền ròng</th>{showTransfers && <><th scope="col">Điều chuyển vào</th><th scope="col">Điều chuyển ra</th></>}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.key}>
          <th scope="row"><FinanceLink href={drillDownUrl(row.drillDown, reportFilter)} navigate={navigate}>{row.label}</FinanceLink></th>
          <td>{money(row.totalIn)}</td><td>{money(row.totalOut)}</td><td>{money(row.cashFlow)}</td>
          {showTransfers && <><td>{money(row.transferIn)}</td><td>{money(row.transferOut)}</td></>}
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

function Report({ report, route, navigate }: { report: FinanceReport; route: FinanceRoute; navigate: (url: string) => void }) {
  const monthly = report.granularity === 'MONTH';
  const points = monthly ? report.byMonth : report.byDay;
  const direction = report.cashFlow < 0n ? 'negative' : report.cashFlow > 0n ? 'positive' : 'zero';
  return <>
    {report.filter.fromDate && report.filter.toDate &&
      <p className="finance-period">Từ {dateLabel(report.filter.fromDate)} đến {dateLabel(report.filter.toDate)}</p>}
    <dl className="finance-stats">
      <div><dt>Tổng thực thu</dt><dd>{money(report.totalIn)}</dd></div>
      <div><dt>Tổng thực chi</dt><dd>{money(report.totalOut)}</dd></div>
      <div><dt>Dòng tiền ròng</dt><dd className={'finance-' + direction}>
        {direction === 'positive' && '+'}{money(report.cashFlow)}
      </dd></div>
    </dl>
    <p className="finance-note">Dòng tiền ròng bằng thực thu trừ thực chi trong kỳ. Khoản nhận hoặc hoàn cọc có thể làm thay đổi dòng tiền mà không làm thay đổi lợi nhuận.</p>
    {report.emptyMessage ? <section className="finance-panel finance-empty" role="status"><h2>Xu hướng dòng tiền</h2><p>{report.emptyMessage}</p></section>
      : points.length > 0 && <FinanceTrend points={points} monthly={monthly} link={point => drillDownUrl(point.drillDown, route.filter)} open={navigate} />}
    <div className="finance-results">
      <Breakdown title="Cơ cấu dòng tiền" rows={report.composition} reportFilter={route.filter} navigate={navigate} />
      <Breakdown title="Nguồn tiền" rows={report.bySource} reportFilter={route.filter} navigate={navigate} />
      <Breakdown title="Khu vực" rows={report.byArea} reportFilter={route.filter} navigate={navigate} />
      <Breakdown title="Tòa nhà" rows={report.byBuilding} reportFilter={route.filter} navigate={navigate} />
      <Breakdown title="Phòng" rows={report.byRoom} reportFilter={route.filter} navigate={navigate} />
      <Breakdown title="Danh mục" rows={report.byCategory} reportFilter={route.filter} navigate={navigate} />
    </div>
  </>;
}

function Ledger({ ledger, route, catalog, rooms, navigate }: {
  ledger: LedgerPage; route: FinanceRoute; catalog: FinanceCatalog; rooms: Record<string, Room[]>; navigate: (url: string) => void;
}) {
  const pages = Math.max(1, Math.ceil(ledger.totalElements / ledger.size));
  const property = (entry: LedgerPage['items'][number]) => {
    const room = entry.buildingId && rooms[entry.buildingId]?.find(item => item.id === entry.roomId);
    return [entry.areaId && (catalog.areas.find(item => item.id === entry.areaId)?.name ?? entry.areaId),
      entry.buildingId && (catalog.buildings.find(item => item.id === entry.buildingId)?.name ?? entry.buildingId),
      entry.roomId && (room ? room.code : entry.roomId)].filter(Boolean).join(' / ') || 'Chưa phân bổ';
  };

  return <section className="finance-panel" aria-label="Giao dịch trong sổ thu chi">
    {ledger.totalContribution !== undefined && <p>
      {route.expenseMetric === 'gross' ? 'Chi phí trước giảm trừ' : route.expenseMetric === 'net' ? 'Chi phí thuần' : 'Đóng góp có dấu'}
      {' trên toàn bộ kết quả: '}<strong>{money(ledger.totalContribution)}</strong>
    </p>}
    {ledger.items.length ? <div className="finance-table-scroll">
      <table aria-label="Giao dịch trong sổ thu chi">
        <thead><tr>{['Thời điểm', 'Danh mục', 'Nội dung và tham chiếu', 'Thu', 'Chi', 'Nguồn tiền', 'Bất động sản', 'Xác nhận']
          .map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{ledger.items.map(entry => <tr key={entry.id}>
          <td><time dateTime={entry.occurredAt}>{timestampLabel(entry.occurredAt)}</time></td>
          <td>{entry.transferId ? 'Điều chuyển nội bộ' : transactionCategories[entry.category ?? '~'] ?? entry.category}</td>
          <td>{entry.note || '—'}
            <details className="finance-trace"><summary>Tham chiếu giao dịch</summary>
              <dl>
                <dt>Giao dịch</dt><dd>{entry.id}</dd>
                {entry.adjustsId && <><dt>Giao dịch gốc</dt><dd>{entry.adjustsId}</dd></>}
                {entry.adjustments.length > 0 && <><dt>Các lần điều chỉnh</dt><dd>{entry.adjustments.join(', ')}</dd></>}
                {entry.settlementId && <><dt>Quyết toán</dt><dd>{entry.settlementId}</dd></>}
                {entry.depositId && <><dt>Hợp đồng đặt cọc</dt><dd>{entry.depositId}</dd></>}
                {entry.transferId && <><dt>Mã điều chuyển</dt><dd>{entry.transferId}</dd></>}
                {entry.paymentId && <><dt>Thanh toán</dt><dd>{entry.paymentId}</dd></>}
                {entry.correctionKind && <><dt>Điều chỉnh</dt><dd>{entry.correctionKind === 'REVERSAL' ? 'Đảo bút toán' : 'Bút toán thay thế'}</dd></>}
                <dt>{entry.transferId ? 'Điều chuyển' : 'Đóng góp vào báo cáo'}</dt>
                <dd>{entry.reportDirection === 'IN' ? 'Thu ' : 'Chi '}{money(entry.reportAmount)}</dd>
              </dl>
            </details>
          </td>
          <td>{entry.direction === 'IN' ? money(entry.amount) : '—'}</td><td>{entry.direction === 'OUT' ? money(entry.amount) : '—'}</td>
          <td>{catalog.sources.find(source => source.id === entry.sourceId)?.name ?? entry.sourceId}
            {entry.method && <small>{methods[entry.method] ?? entry.method}</small>}</td>
          <td>{property(entry)}</td><td>{entry.confirmationStatus ? statuses[entry.confirmationStatus] ?? entry.confirmationStatus : '—'}</td>
        </tr>)}</tbody>
      </table>
    </div> : <p role="status">{ledger.totalElements ? 'Trang này không có giao dịch.' : 'Chưa có giao dịch phù hợp với bộ lọc.'}</p>}
    <nav className="finance-toolbar finance-pagination" aria-label="Phân trang sổ thu chi">
      <span>{ledger.totalElements} giao dịch</span>
      <button type="button" disabled={ledger.page === 0} onClick={() => navigate(financeUrl({ ...route, page: Math.max(0, Math.min(ledger.page - 1, pages - 1)) }))}>Trang trước</button>
      <span>Trang {ledger.page + 1}/{pages}</span>
      <button type="button" disabled={ledger.page + 1 >= pages} onClick={() => navigate(financeUrl({ ...route, page: ledger.page + 1 }))}>Trang sau</button>
      <label>Số dòng <select value={ledger.size} onChange={event => navigate(financeUrl({ ...route, page: 0, size: Number(event.target.value) }))}>
        {[...new Set([20, 50, 100, ledger.size])].sort((a, b) => a - b).map(size => <option key={size}>{size}</option>)}
      </select></label>
    </nav>
  </section>;
}

export function FinancePage({ route, onNavigate, onSessionExpired }: {
  route: FinanceRoute; onNavigate: (url: string) => void; onSessionExpired: () => void;
}) {
  const [result, setResult] = useState<{ route: FinanceRoute; revision: number; data: Result }>();
  const [revision, retry] = useState(0);
  const [catalog, setCatalog] = useState(emptyCatalog);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogRevision, retryCatalog] = useState(0);
  const [activeBuilding, setActiveBuilding] = useState<{ route: FinanceRoute; id?: string }>();
  const [rooms, setRooms] = useState<Record<string, Room[]>>({});
  const [roomError, setRoomError] = useState(false);
  const roomRequests = useRef(new Map<string, Promise<Room[]>>());
  const current = result?.route === route && result.revision === revision ? result.data : undefined;
  const data = current && 'payload' in current ? current.payload : undefined;
  const ledger = data?.kind === 'cash-ledger' ? data.ledger : undefined;
  const report = data?.kind === 'finance' ? data.report : undefined;
  const building = activeBuilding?.route === route ? activeBuilding.id : route.filter.buildingId;

  const handleError = useCallback((error: unknown) => {
    if ((error instanceof FinanceApiError || error instanceof AuthApiError) && error.status === 401) onSessionExpired();
  }, [onSessionExpired]);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    void Promise.allSettled([getAreas(), getBuildings(), listFundingSources({ type: '', active: '' }, controller.signal)]).then(([areas, buildings, sources]) => {
      if (!live) return;
      setCatalog({ areas: areas.status === 'fulfilled' ? areas.value : [],
        buildings: buildings.status === 'fulfilled' ? buildings.value : [], sources: sources.status === 'fulfilled' ? sources.value : [] });
      const failed = [areas, buildings, sources].find(item => item.status === 'rejected');
      setCatalogError(Boolean(failed));
      if (failed?.status === 'rejected') handleError(failed.reason);
    });
    return () => { live = false; controller.abort(); };
  }, [catalogRevision, handleError]);

  useEffect(() => {
    const ids = new Set(ledger?.items.flatMap(entry => entry.roomId && entry.buildingId ? [entry.buildingId] : []));
    if (building) ids.add(building);
    let live = true;
    void Promise.allSettled([...ids].map(async id => {
      let request = roomRequests.current.get(id);
      if (!request) {
        request = getRoomsByBuilding(id).catch((error: unknown) => {
          roomRequests.current.delete(id);
          throw error;
        });
        roomRequests.current.set(id, request);
      }
      return [id, await request] as const;
    })).then(results => {
      if (!live) return;
      setRoomError(results.some(item => item.status === 'rejected'));
      setRooms(previous => ({ ...previous, ...Object.fromEntries(results.flatMap(item => item.status === 'fulfilled' ? [item.value] : [])) }));
    });
    return () => { live = false; };
  }, [building, ledger, catalogRevision]);

  useEffect(() => {
    if (!validFinanceDates(route.filter)) return;
    const controller = new AbortController();
    const pending: Promise<Payload> = route.kind === 'finance'
      ? getFinanceReport(route.filter, controller.signal).then(report => ({ kind: 'finance', report }))
      : getCashLedger(route, controller.signal).then(ledger => ({ kind: 'cash-ledger', ledger }));
    void pending.then(payload => {
      if (!controller.signal.aborted) setResult({ route, revision, data: { payload } });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      handleError(error);
      const custom = error instanceof FinanceApiError && [400, 403, 404].includes(error.status)
        ? error.message || 'Bộ lọc không hợp lệ hoặc nằm ngoài phạm vi quản lý.' : null;
      setResult({ route, revision, data: { error: custom ?? (route.kind === 'finance' ? reportError : ledgerError) } });
    });
    return () => controller.abort();
  }, [route, revision, handleError]);

  const isReport = route.kind === 'finance';
  function apply(filter: FinanceFilter) {
    const next = financeUrl({ ...route, filter, page: 0 });
    if (next !== financeUrl(route)) onNavigate(next);
  }

  const error = !validFinanceDates(route.filter) ? 'Khoảng thời gian trong bộ lọc không hợp lệ.'
    : current && 'error' in current ? current.error : undefined;

  return <section className="finance-page" aria-labelledby="finance-title">
    <header className="finance-heading">
      <h1 id="finance-title">{isReport ? 'Phân tích thu chi và dòng tiền' : 'Sổ thu chi'}</h1>
      {!isReport && <FinanceLink href={returnToFinance(route)} navigate={onNavigate}>Quay lại báo cáo</FinanceLink>}
    </header>
    {!route.financial && <FinanceFilters key={route.kind + financeParams(route.filter)} applied={route.filter}
      defaultFrom={report?.filter.fromDate} defaultTo={report?.filter.toDate}
      catalog={catalog} roomsByBuilding={rooms} onApply={apply} onBuilding={id => setActiveBuilding({ route, id })} />}
    {route.financial && <p className="finance-period">
      {route.filter.fromDate && dateLabel(route.filter.fromDate)} – {route.filter.toDate && dateLabel(route.filter.toDate)}
      {route.financial.uncategorized
        ? ' | Chi phí chưa phân loại'
        : route.financial.financialCategoryCode ? ' | ' + (transactionCategories[route.financial.financialCategoryCode] ?? route.financial.financialCategoryCode)
          : route.financial.financialImpact === 'UNKNOWN' ? ' | Giao dịch chưa xác định' : ''}
    </p>}
    {(catalogError || roomError) && <p role="status" className="finance-catalog-alert">Một số danh mục chưa tải được.{' '}
      <button type="button" onClick={() => retryCatalog(count => count + 1)}>Tải lại danh mục</button></p>}
    {!isReport && route.filter.dimension &&
      <div className="finance-toolbar"><span>Đang xem giao dịch từ điểm đã chọn trên báo cáo.</span>
        <button type="button" onClick={() => apply({ ...route.filter, dimension: undefined, groupKey: undefined })}>Bỏ nhóm đã chọn</button></div>}
    {error ? <div className="finance-panel finance-error" role="alert"><p>{error}</p>
      {validFinanceDates(route.filter) && <button type="button" onClick={() => retry(count => count + 1)}>Thử lại</button>}</div>
      : !data && <div className="finance-panel finance-loading" role="status" aria-busy="true">
        <p>{isReport ? 'Đang tải báo cáo…' : 'Đang tải sổ thu chi…'}</p>
        <div aria-hidden="true" className="finance-placeholder" />
      </div>}
    {report && <Report report={report} route={route} navigate={onNavigate} />}
    {ledger && <Ledger ledger={ledger} route={route} catalog={catalog} rooms={rooms} navigate={onNavigate} />}
  </section>;
}

