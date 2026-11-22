import { ReportExportButton } from './ReportExportDialog';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AuthApiError } from '../../services/authErrors';
import { getAreas, getBuildings, PropertyApiError } from '../../services/propertiesApi';
import { expiryBuckets, getExpiringLeaseReport, getExpiryThreshold, updateExpiryThreshold,
  type ExpiringLease, type ExpiringLeaseReport, type ExpiryThreshold } from '../../services/expiringLeaseApi';
import { expiringLeaseUrl, validExpiryDates, type ExpiringLeaseQuery } from '../../utils/expiringLeaseNavigation';
import { buildRentalContractUrl } from '../../utils/rentalContractNavigation';
import type { Area, Building } from '../../types/properties';
import './occupancy.css';
import './expiring-leases.css';

const labels = {
  OVERDUE: 'Quá hạn chưa xử lý', DAYS_0_TO_7: 'Trong 7 ngày',
  DAYS_8_TO_30: 'Từ 8 đến 30 ngày', OVER_30: 'Trên 30 ngày',
};
const warnings: Record<string, string> = {
  AMBIGUOUS_TENANCY: 'Chưa xác định được lượt ở của hợp đồng.',
  INVALID_CONTRACT_PERIOD: 'Thời hạn hợp đồng có dữ liệu không nhất quán.',
  OVERLAPPING_CONTRACTS: 'Có hợp đồng thuê chồng lấn.',
  VACANT_WITH_ACTIVE_CONTRACT: 'Phòng đã đánh dấu trống trong khi hợp đồng còn hiệu lực.',
};
const dateTime = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
});
const numbers = new Intl.NumberFormat('vi-VN');
const calendar = (date: string) => date.split('-').reverse().join('/');
const money = (value: string | null) => {
  if (value === null) return 'Chưa xác định';
  const [whole, fraction] = value.split('.');
  const decimals = fraction?.replace(/0+$/, '');
  return numbers.format(BigInt(whole)) + (decimals ? ',' + decimals : '') + ' ₫';
};

function statusOf(error: unknown) {
  return error instanceof AuthApiError || error instanceof PropertyApiError ? error.status : 0;
}

function requestMessage(error: unknown, fallback: string) {
  switch (statusOf(error)) {
    case 400: return 'Bộ lọc hoặc giá trị nhập không hợp lệ.';
    case 401: return 'Phiên đăng nhập đã hết hạn.';
    case 403: return 'Bạn không có quyền thực hiện thao tác này.';
    case 404: return 'Không thể truy cập dữ liệu được yêu cầu.';
    default: return fallback;
  }
}

function DateFilter({ query, apply }: { query: ExpiringLeaseQuery; apply: (from?: string, to?: string) => void }) {
  const [from, setFrom] = useState(query.fromDate ?? '');
  const [to, setTo] = useState(query.toDate ?? '');
  const [error, setError] = useState(false);
  return <form className="expiry-date-filter" onSubmit={event => {
    event.preventDefault();
    if (!validExpiryDates(from || undefined, to || undefined)) { setError(true); return; }
    setError(false);
    apply(from || undefined, to || undefined);
  }}>
    <label>Từ ngày<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
    <label>Đến ngày<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
    <button type="submit">Áp dụng ngày</button>
    <button type="button" onClick={() => { setFrom(''); setTo(''); setError(false); apply(); }}>Dùng khoảng mặc định</button>
    {error && <p role="alert">Nhập đủ hai ngày hợp lệ và cách nhau tối đa 366 ngày.</p>}
  </form>;
}

function ThresholdEditor({ onSessionExpired, onSaved }: { onSessionExpired: () => void; onSaved: () => void }) {
  const [threshold, setThreshold] = useState<ExpiryThreshold | null>(null);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [saveError, setSaveError] = useState('');
  const onSavedRef = useRef(onSaved);
  const saveRequest = useRef<AbortController | null>(null);
  useEffect(() => () => saveRequest.current?.abort(), []);

  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);
  useEffect(() => {
    const controller = new AbortController();
    getExpiryThreshold(controller.signal).then(data => {
      if (!controller.signal.aborted) setThreshold(data);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (statusOf(error) === 401) onSessionExpired();
      setLoadError(requestMessage(error, 'Không thể tải ngưỡng theo dõi.'));
    });
    return () => controller.abort();
  }, [onSessionExpired, revision]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveRequest.current || draft === null) return;
    const days = Number(draft);
    if (!/^\d+$/.test(draft) || !Number.isInteger(days) || days < 1 || days > 365) {
      setSaveError('Nhập số nguyên từ 1 đến 365 ngày.');
      return;
    }
    const controller = new AbortController();
    saveRequest.current = controller;
    setSaving(true);
    setSaveError('');
    setNotice('');
    try {
      const updated = await updateExpiryThreshold(days, controller.signal);
      if (controller.signal.aborted) return;
      setThreshold(updated);
      setDraft(null);
      setNotice('Đã lưu ngưỡng theo dõi.');
      onSavedRef.current();
    } catch (error) {
      if (controller.signal.aborted) return;
      if (statusOf(error) === 401) onSessionExpired();
      setSaveError(requestMessage(error, 'Không thể lưu ngưỡng theo dõi. Vui lòng thử lại.'));
    } finally {
      saveRequest.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  return <div className="expiry-threshold">
    {threshold ? <>
      <span>Ngưỡng mặc định của báo cáo <strong>{threshold.days} ngày</strong> ({threshold.source === 'HOST_OVERRIDE' ? 'Cấu hình riêng' : 'Mặc định hệ thống'})</span>
      {draft === null && <button type="button" onClick={() => { setDraft(String(threshold.days)); setNotice(''); }}>Chỉnh ngưỡng</button>}
      {draft !== null && <form className="expiry-date-filter" onSubmit={save}>
        <label>Ngưỡng theo dõi (ngày)<input inputMode="numeric" value={draft} disabled={saving} onChange={event => setDraft(event.target.value)} /></label>
        <button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu ngưỡng'}</button>
        <button type="button" disabled={saving} onClick={() => { setDraft(null); setSaveError(''); }}>Hủy</button>
      </form>}
    </> : loadError ? <><span role="alert">{loadError}</span><button type="button" onClick={() => {
      setLoadError(''); setRevision(value => value + 1);
    }}>Tải lại ngưỡng</button></> : <span role="status">Đang tải ngưỡng theo dõi…</span>}
    {notice && <span role="status">{notice}</span>}
    {saveError && <span role="alert">{saveError}</span>}
  </div>;
}

function LeaseDetails({ lease }: { lease: ExpiringLease }) {
  return <>
    {lease.customerName && <span>{lease.customerName}</span>}
    {lease.customerPhone && <span>{lease.customerPhone}</span>}
  </>;
}

function LeaseActions({ lease, onContract }: { lease: ExpiringLease; onContract: (url: string) => void }) {
  return <div className="occupancy-actions">
    {([['extend', 'Gia hạn'], ['move-out', 'Bàn giao'], ['terminate', 'Thanh lý']] as const).map(([action, label]) =>
      <button key={action} type="button" aria-label={label + ' ' + lease.contractNumber}
        onClick={() => onContract(buildRentalContractUrl({ create: false, detailId: lease.contractId, action }))}>{label}</button>)}
  </div>;
}

const remaining = (value: number) => value === 0 ? 'Hết hạn hôm nay' : value < 0 ? 'Quá hạn ' + -value + ' ngày' : 'Còn ' + value + ' ngày';

function LeaseGroups({ data, onContract }: { data: ExpiringLeaseReport; onContract: (url: string) => void }) {
  return expiryBuckets.map(bucket => {
    const group = data.expiryGroups.find(item => item.bucket === bucket);
    const items = group?.items ?? [];
    return <section key={bucket} className="expiry-group" data-bucket={bucket} aria-labelledby={'expiry-' + bucket}>
      <h2 id={'expiry-' + bucket}>{labels[bucket]} <span>{numbers.format(group?.total ?? 0)}</span></h2>
      {items.length ? <>
        <div className="expiry-table occupancy-table-scroll" role="region" aria-label={labels[bucket]} tabIndex={0}>
          <table>
            <thead><tr>{['Phòng / Tòa nhà', 'Hợp đồng / Khách thuê', 'Thời hạn', 'Bàn giao', 'Tiền cọc', 'Hành động'].map(label =>
              <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{items.map(lease => <tr key={lease.contractId}>
              <th scope="row"><span>{lease.roomCode}</span><small>{lease.buildingName}</small></th>
              <td><strong>{lease.contractNumber}</strong><LeaseDetails lease={lease} /></td>
              <td><strong>{remaining(lease.daysRemaining)}</strong><time dateTime={lease.effectiveEndDate}>{calendar(lease.effectiveEndDate)}</time></td>
              <td>{lease.handoverStatus ?? 'Chưa xác định'}</td>
              <td><span>Tiền cọc theo hợp đồng: {money(lease.depositRequired)}</span><span>Tiền cọc thực giữ: {money(lease.depositHeld)}</span></td>
              <td><LeaseActions lease={lease} onContract={onContract} /></td>
            </tr>)}</tbody>
          </table>
        </div>
        <ul className="expiry-cards">{items.map(lease => <li key={lease.contractId}>
          <div className="expiry-card-title"><strong>{lease.roomCode}</strong><span>{remaining(lease.daysRemaining)}</span></div>
          <p>{lease.buildingName}</p>
          <dl>
            <dt>Hợp đồng</dt><dd>{lease.contractNumber}<LeaseDetails lease={lease} /></dd>
            <dt>Ngày hết hạn</dt><dd><time dateTime={lease.effectiveEndDate}>{calendar(lease.effectiveEndDate)}</time></dd>
            <dt>Bàn giao</dt><dd>{lease.handoverStatus ?? 'Chưa xác định'}</dd>
            <dt>Tiền cọc theo hợp đồng</dt><dd>{money(lease.depositRequired)}</dd>
            <dt>Tiền cọc thực giữ</dt><dd>{money(lease.depositHeld)}</dd>
          </dl>
          <LeaseActions lease={lease} onContract={onContract} />
        </li>)}</ul>
      </> : Boolean(group?.total) && <p>Không có mục trên trang này.</p>}
    </section>;
  });
}

type ReportResult = { query: ExpiringLeaseQuery; revision: number } & ({ data: ExpiringLeaseReport } | { error: string; retry: boolean });
interface Props {
  query: ExpiringLeaseQuery;
  onNavigate: (url: string) => void;
  onContract: (url: string) => void;
  onSessionExpired: () => void;
}

export function ExpiringLeaseReportPage({ query, onNavigate, onContract, onSessionExpired }: Props) {
  const [catalog, setCatalog] = useState<{ areas: Area[]; buildings: Building[] } | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<ReportResult | null>(null);
  const { areaId, buildingId, fromDate, toDate } = query;
  const defaultRange = fromDate === undefined && toDate === undefined;
  const badDates = !validExpiryDates(fromDate, toDate);
  const badPair = Boolean(areaId && buildingId && catalog?.buildings.some(item => item.id === buildingId && item.areaId !== areaId));
  const waitForPair = Boolean(areaId && buildingId && !catalog && !catalogError);
  const invalid = badDates || badPair;

  useEffect(() => {
    let active = true;
    Promise.all([getAreas(), getBuildings()]).then(([areas, buildings]) => {
      if (active) setCatalog({ areas, buildings });
    }).catch((error: unknown) => {
      if (!active) return;
      if (statusOf(error) === 401) onSessionExpired();
      setCatalogError(requestMessage(error, 'Không thể tải danh mục khu vực và tòa nhà.'));
    });
    return () => { active = false; };
  }, [catalogRevision, onSessionExpired]);

  useEffect(() => {
    if (invalid || waitForPair) return;
    const controller = new AbortController();
    getExpiringLeaseReport(query, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ query, revision, data });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const status = statusOf(error);
      if (status === 401) onSessionExpired();
      setResult({ query, revision, error: requestMessage(error, 'Không thể tải báo cáo phòng sắp trống.'),
        retry: status === 0 || status >= 500 });
    });
    return () => controller.abort();
  }, [invalid, waitForPair, onSessionExpired, query, revision]);

  const navigate = (patch: Partial<ExpiringLeaseQuery>) => onNavigate(expiringLeaseUrl({ ...query, page: 0, ...patch }));
  const reload = () => setRevision(value => value + 1);
  const current = result?.query === query && result.revision === revision ? result : null;
  const data = !invalid && !waitForPair && current && 'data' in current ? current.data : null;
  const failure = current && 'error' in current ? current : null;
  const buildings = catalog?.buildings.filter(item => !areaId || item.areaId === areaId) ?? [];
  const count = data?.expiryGroups.reduce((sum, group) => sum + group.items.length, 0) ?? 0;

  return <section className="occupancy expiry-report" aria-labelledby="expiry-title">
    <header className="expiry-header">
      <div className="expiry-heading">
        <h1 id="expiry-title">Phòng sắp trống</h1>
        <button className="occupancy-primary" type="button" disabled={invalid || waitForPair} onClick={reload}>Làm mới báo cáo</button>
      </div>
      <ThresholdEditor onSessionExpired={onSessionExpired} onSaved={() => {
        if (defaultRange) { if (query.page) navigate({ page: 0 }); else reload(); }
      }} />
      {!defaultRange && <p>Ngưỡng theo dõi áp dụng khi dùng khoảng mặc định.</p>}
      <div className="occupancy-toolbar">
        <label>Khu vực<select value={areaId ?? ''} disabled={!catalog} onChange={event => {
          const nextArea = event.target.value || undefined;
          const compatible = !nextArea || catalog?.buildings.some(item => item.id === buildingId && item.areaId === nextArea);
          navigate({ areaId: nextArea, buildingId: compatible ? buildingId : undefined });
        }}>
          <option value="">Tất cả khu vực</option>
          {areaId && !catalog?.areas.some(item => item.id === areaId) && <option value={areaId}>Khu vực đã chọn</option>}
          {catalog?.areas.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select></label>
        <label>Tòa nhà<select value={buildingId ?? ''} disabled={!catalog}
          onChange={event => navigate({ buildingId: event.target.value || undefined })}>
          <option value="">Tất cả tòa nhà</option>
          {buildingId && !buildings.some(item => item.id === buildingId) && <option value={buildingId}>Tòa nhà đã chọn</option>}
          {buildings.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select></label>
        <label>Sắp xếp<select value={query.sort} onChange={event => navigate({ sort: event.target.value === 'daysRemaining,desc'
          ? 'daysRemaining,desc' : 'daysRemaining,asc' })}>
          <option value="daysRemaining,asc">Số ngày còn lại tăng dần</option>
          <option value="daysRemaining,desc">Số ngày còn lại giảm dần</option>
        </select></label>
        <ReportExportButton source={{ kind: 'expiring-leases', areaId, buildingId, fromDate, toDate }} catalog={catalog}
          catalogFailed={Boolean(catalogError)} onRetryCatalog={() => { setCatalogError(''); setCatalogRevision(value => value + 1); }}
          onSessionExpired={onSessionExpired} />
      </div>
      <DateFilter key={JSON.stringify([fromDate, toDate])} query={query}
        apply={(from, to) => navigate({ fromDate: from, toDate: to })} />
      {catalogError && <div className="occupancy-state"><p role="alert">{catalogError}</p>
        <button type="button" onClick={() => { setCatalogError(''); setCatalogRevision(value => value + 1); }}>Tải lại danh mục</button></div>}
    </header>
    {invalid ? <p role="alert" className="occupancy-state">{badDates
      ? 'Nhập đủ hai ngày hợp lệ và cách nhau tối đa 366 ngày.' : 'Tòa nhà không thuộc khu vực đã chọn.'}</p>
      : failure ? <div className="occupancy-state"><p role="alert">{failure.error}</p>
        {failure.retry && <button type="button" onClick={reload}>Thử lại</button>}</div>
      : !data ? <div className="occupancy-state expiry-loading" role="status"><p>Đang tải báo cáo phòng sắp trống…</p>
        <div aria-hidden="true" /><div aria-hidden="true" /></div> : <>
        <dl className="occupancy-kpis">
          <div><dt>Hợp đồng sắp hết hạn</dt><dd>{numbers.format(data.kpi.expiringContracts)}</dd></div>
          <div><dt>Phòng có hợp đồng sắp hết hạn</dt><dd>{numbers.format(data.kpi.expiringRooms)}</dd></div>
          <div><dt>Hợp đồng quá hạn chưa xử lý</dt><dd>{numbers.format(data.kpi.overdueContracts)}</dd></div>
        </dl>
        <div className="occupancy-meta">
          <span>Phạm vi hết hạn: {calendar(data.filter.fromDate)} – {calendar(data.filter.toDate)}</span>
          <span>Cập nhật lúc <time dateTime={data.generatedAt}>{dateTime.format(new Date(data.generatedAt))}</time></span>
        </div>
        {data.warnings.length > 0 && <details className="occupancy-warning">
          <summary>Cảnh báo dữ liệu ({numbers.format(data.warnings.length)})</summary>
          <ul>{data.warnings.map((warning, index) =>
            <li key={warning.code + warning.contractId + index}>{warnings[warning.code] ?? 'Dữ liệu hợp đồng cần kiểm tra.'} Hợp đồng {warning.contractId}</li>)}</ul>
        </details>}
        {data.page.totalElements === 0 && <p className="occupancy-state">Không có hợp đồng phù hợp với bộ lọc hiện tại.</p>}
        <LeaseGroups data={data} onContract={onContract} />
        {data.page.totalElements > 0 && <nav className="occupancy-pagination" aria-label="Phân trang báo cáo">
          <span>Đang xem {numbers.format(count)} / {numbers.format(data.page.totalElements)} hợp đồng.
            {' '}{data.page.page < data.page.totalPages ? 'Trang ' + (data.page.page + 1) + '/' + data.page.totalPages : 'Trang không còn khả dụng.'}</span>
          {data.page.page >= data.page.totalPages && <button type="button" onClick={() => navigate({ page: 0 })}>Trang đầu</button>}
          <button type="button" disabled={!data.page.page} onClick={() => navigate({ page: data.page.page - 1 })}>Trang trước</button>
          <button type="button" disabled={data.page.page + 1 >= data.page.totalPages} onClick={() => navigate({ page: data.page.page + 1 })}>Trang sau</button>
        </nav>}
      </>}
  </section>;
}
