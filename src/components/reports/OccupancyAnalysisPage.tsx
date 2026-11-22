import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { AuthApiError } from '../../services/authErrors';
import { OccupancyApiError } from '../../services/occupancyApi';
import { getOccupancyAnalysis, type AnalysisBuilding, type AnalysisPoint, type OccupancyAnalysis } from '../../services/occupancyAnalysisApi';
import { getAreas, getBuildings, PropertyApiError } from '../../services/propertiesApi';
import type { Area, Building } from '../../types/properties';
import { isCalendarDate, occupancyAnalysisUrl, validateTrendRange, type OccupancyAnalysisQuery } from '../../utils/occupancyAnalysisNavigation';
import './occupancy-analysis.css';

const invalidFilter = 'Bộ lọc không hợp lệ. Vui lòng kiểm tra và chọn lại.';
const loadError = 'Không thể tải báo cáo tỷ lệ lấp đầy lúc này. Vui lòng thử lại sau.';
const integer = new Intl.NumberFormat('vi-VN');
const decimal = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const timestamp = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' });
const ticks = [100, 75, 50, 25, 0];
const warningLabels: Record<string, string> = {
  EXPIRED_ACTIVE_CONTRACT: 'Hợp đồng đã hết hạn vẫn mang trạng thái hiệu lực',
  UNAVAILABLE_WITH_EFFECTIVE_LEASE: 'Phòng ngoài quỹ khai thác có hợp đồng hiệu lực',
  INVALID_CONTRACT_PERIOD: 'Không xác minh được thời hạn hợp đồng',
  OVERLAPPING_CONTRACTS: 'Hợp đồng thuê chồng lấn',
  ROOM_STATE_CONFLICT: 'Trạng thái phòng và dữ liệu thuê không nhất quán',
};

const percent = (value: number | null) => value === null ? 'N/A' : decimal.format(value) + '%';
const quantity = (value: number | null) => value === null ? 'N/A' : integer.format(value);
const calendar = (value: string) => value.split('-').reverse().join('/');
const monthLabel = (value: string) => value.slice(5) + '/' + value.slice(0, 4);
const roomUrl = (id: string) => '/rooms?' + new URLSearchParams({ view: 'matrix', buildingId: id });

function errorStatus(error: unknown) {
  return error instanceof OccupancyApiError || error instanceof AuthApiError || error instanceof PropertyApiError ? error.status : 0;
}

function follow(event: MouseEvent<HTMLAnchorElement>, href: string, onNavigate: (url: string) => void) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  onNavigate(href);
}

function band(rate: number | null) {
  if (rate === null) return { key: 'unknown', label: 'Chưa xác định' };
  if (rate >= 90) return { key: 'high', label: 'Cao' };
  if (rate >= 70) return { key: 'medium', label: 'Trung bình' };
  return { key: 'low', label: 'Thấp' };
}

function BuildingComparison({ buildings, onNavigate }: {
  buildings: AnalysisBuilding[];
  onNavigate: (url: string) => void;
}) {
  const ranked = buildings.filter(building => building.rate !== null);
  return (
    <section aria-labelledby="oa-comparison">
      <h2 id="oa-comparison">So sánh theo tòa nhà</h2>
      {buildings.length === 0 ? <p>Chưa có tòa nhà trong phạm vi đã chọn.</p> : (
        <figure className="oa-comparison">
          <figcaption>Tỷ lệ lấp đầy theo tòa nhà</figcaption>
          <div className="oa-scroll" tabIndex={0} role="region" aria-label="Biểu đồ so sánh tòa nhà">
            <div className="oa-bar-chart">
              <div className="oa-axis" aria-hidden="true">{ticks.map(value => <span key={value}>{value}%</span>)}</div>
              <ul className="oa-bars">
                {buildings.map(building => {
                  const level = band(building.rate);
                  const href = roomUrl(building.buildingId);
                  return <li key={building.buildingId} data-band={level.key}>
                    <a href={href} onClick={event => follow(event, href, onNavigate)}>
                      <div className="oa-bar-plot">
                        {building.rate !== null && <span className="oa-bar" style={{ blockSize: building.rate + '%' }} aria-hidden="true" />}
                      </div>
                      <span className="oa-bar-name">{building.buildingName}</span>
                      <small className="oa-band"><strong>{percent(building.rate)}</strong> {level.label}</small>
                    </a>
                  </li>;
                })}
              </ul>
            </div>
          </div>
        </figure>
      )}
      <h3>Bảng xếp hạng</h3>
      {ranked.length === 0 ? <p>Chưa có tòa nhà đủ số liệu để xếp hạng.</p> : (
        <div className="oa-scroll oa-ranking" tabIndex={0} role="region" aria-label="Bảng xếp hạng tòa nhà">
          <table>
            <thead><tr><th scope="col">Hạng</th><th scope="col">Tòa nhà</th><th scope="col">Khu vực</th>
              <th scope="col">Phòng hoạt động</th><th scope="col">Đang thuê</th>
              <th scope="col">Chưa có hợp đồng thuê hiệu lực</th><th scope="col">Tỷ lệ</th></tr></thead>
            <tbody>{ranked.map((building, index) => {
              const href = roomUrl(building.buildingId);
              return <tr key={building.buildingId}>
                <td>{integer.format(index + 1)}</td>
                <th scope="row"><a href={href} onClick={event => follow(event, href, onNavigate)}>{building.buildingName}</a></th>
                <td>{building.areaName}</td><td>{quantity(building.activeRooms)}</td>
                <td>{quantity(building.occupiedRooms)}</td><td>{quantity(building.roomsWithoutEffectiveLease)}</td>
                <td>{percent(building.rate)}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TrendChart({ series }: { series: AnalysisPoint[] }) {
  const plotWidth = Math.max(480, series.length * 66);
  const x = (index: number) => 44 + plotWidth * (index + 0.5) / series.length;
  const y = (value: number) => 14 + (100 - value) * 1.4;
  return (
    <figure className="oa-trend">
      <div className="oa-scroll" tabIndex={0} role="region" aria-label="Biểu đồ xu hướng theo tháng">
        <svg className="oa-trend-chart" width={plotWidth + 48} height="186" viewBox={'0 0 ' + (plotWidth + 48) + ' 186'} aria-hidden="true">
          {ticks.map(value => <g key={value}><line className="oa-grid-line" x1={44} x2={plotWidth + 44} y1={y(value)} y2={y(value)} />
            <text x={36} y={y(value) + 4} textAnchor="end">{value}%</text></g>)}
          {series.map((point, index) => {
            const previous = series[index - 1]?.occupancyRate;
            const rate = point.occupancyRate;
            return <g key={point.month}>
              {rate !== null && previous !== undefined && previous !== null &&
                <line className="oa-series-line" data-series-segment="" x1={x(index - 1)} y1={y(previous)} x2={x(index)} y2={y(rate)} />}
              {rate !== null && <circle className={point.partialMonth ? 'oa-point oa-point-partial' : 'oa-point'} cx={x(index)} cy={y(rate)} r={4} />}
              <text x={x(index)} y={175} textAnchor="middle">{monthLabel(point.month)}{point.partialMonth ? '*' : ''}</text>
            </g>;
          })}
        </svg>
      </div>
      {series.some(point => point.partialMonth) && <figcaption>* Tháng hiện tại chưa hoàn chỉnh.</figcaption>}
      <details>
        <summary>Xem số liệu theo tháng</summary>
        <div className="oa-scroll" tabIndex={0} role="region" aria-label="Số liệu xu hướng theo tháng">
          <table>
            <thead><tr><th scope="col">Tháng</th><th scope="col">Tỷ lệ</th><th scope="col">Ghi chú</th></tr></thead>
            <tbody>{series.map(point => <tr key={point.month}>
              <th scope="row">{monthLabel(point.month)}</th><td>{percent(point.occupancyRate)}</td>
              <td>{[
                point.dataStatus === 'MISSING_DATA' ? 'Thiếu dữ liệu lịch sử' : null,
                point.dataStatus === 'NO_ACTIVE_ROOM_DAYS' ? 'Không có ngày-phòng hoạt động' : null,
                point.partialMonth ? 'Tháng hiện tại chưa hoàn chỉnh' : null,
              ].filter(Boolean).join('. ') || 'Đủ dữ liệu'}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function TrendFilter({ from, to, asOfDate, onApply }: {
  from?: string; to?: string; asOfDate?: string;
  onApply: (from?: string, to?: string) => void;
}) {
  const [fromDate, setFrom] = useState(from && isCalendarDate(from) ? from : '');
  const [toDate, setTo] = useState(to && isCalendarDate(to) ? to : '');
  const [invalid, setInvalid] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valid = validateTrendRange(fromDate, toDate, asOfDate);
    setInvalid(!valid);
    if (valid) onApply(fromDate || undefined, toDate || undefined);
  }
  return <form className="oa-filter" onSubmit={submit} noValidate>
    <label>Từ ngày<input type="date" value={fromDate} max={asOfDate} aria-invalid={invalid} onChange={e => setFrom(e.target.value)} /></label>
    <label>Đến ngày<input type="date" value={toDate} max={asOfDate} aria-invalid={invalid} onChange={e => setTo(e.target.value)} /></label>
    <button type="submit" className="oa-primary">Áp dụng</button>
    {invalid && <p className="oa-filter-error" role="alert">{invalidFilter}</p>}
  </form>;
}

type Catalog = { areas: Area[]; buildings: Building[] };
type ReportResult = { query: OccupancyAnalysisQuery; revision: number }
  & ({ data: OccupancyAnalysis } | { error: string; retry: boolean });

export function OccupancyAnalysisPage({ query, onNavigate, onSessionExpired }: {
  query: OccupancyAnalysisQuery;
  onNavigate: (url: string) => void;
  onSessionExpired: () => void;
}) {
  const [catalog, setCatalog] = useState<Catalog>();
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<ReportResult>();
  const { areaId, buildingId, fromDate, toDate } = query;
  const asOfDate = result && 'data' in result ? result.data.asOfDate : undefined;
  const knownBuilding = catalog?.buildings.find(building => building.id === buildingId);
  const invalid = Boolean(areaId && knownBuilding && knownBuilding.areaId !== areaId)
    || !validateTrendRange(fromDate, toDate, asOfDate);
  const waitingForPair = Boolean(areaId && buildingId && !catalog && !catalogFailed);

  useEffect(() => {
    let active = true;
    Promise.all([getAreas(), getBuildings()]).then(([areas, buildings]) => {
      if (active) setCatalog({ areas, buildings });
    }).catch((error: unknown) => {
      if (!active) return;
      if (errorStatus(error) === 401) onSessionExpired();
      else setCatalogFailed(true);
    });
    return () => { active = false; };
  }, [catalogRevision, onSessionExpired]);

  useEffect(() => {
    if (invalid || waitingForPair) return;
    const controller = new AbortController();
    getOccupancyAnalysis(query, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ query, revision, data });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const status = errorStatus(error);
      if (status === 401) {
        onSessionExpired();
        return;
      }
      const message = status === 400 ? error instanceof Error && error.message ? error.message : invalidFilter
        : status === 403 || status === 404 ? 'Không thể truy cập dữ liệu được yêu cầu.' : loadError;
      setResult({ query, revision, error: message, retry: ![400, 403, 404].includes(status) });
    });
    return () => controller.abort();
  }, [invalid, onSessionExpired, query, revision, waitingForPair]);

  const current = result?.query === query && result.revision === revision ? result : undefined;
  const data = !invalid && current && 'data' in current ? current.data : undefined;
  const failed = current && 'error' in current ? current : undefined;
  const availableBuildings = catalog?.buildings.filter(building => !areaId || building.areaId === areaId) ?? [];
  const reload = () => setRevision(value => value + 1);
  const navigate = (next: OccupancyAnalysisQuery) => {
    if (occupancyAnalysisUrl(next) !== occupancyAnalysisUrl(query)) onNavigate(occupancyAnalysisUrl(next));
  };
  const error = invalid ? invalidFilter : failed?.error;
  return (
    <section className="occupancy-analysis" aria-labelledby="oa-title">
      <header className="oa-header">
        <div><h1 id="oa-title">Tỷ lệ lấp đầy</h1>
          {data && <p>Ngày chốt {calendar(data.asOfDate)}. Cập nhật lúc {timestamp.format(new Date(data.generatedAt))}.</p>}
        </div>
        <button type="button" onClick={reload} disabled={invalid || waitingForPair || (!data && !failed)}>Làm mới báo cáo</button>
      </header>
      <div className="oa-filter" role="group" aria-label="Phạm vi báo cáo">
        <label>Khu vực<select value={areaId ?? ''} onChange={event => {
          const nextArea = event.target.value || undefined;
          navigate({ ...query, areaId: nextArea, buildingId: nextArea && knownBuilding && knownBuilding.areaId !== nextArea ? undefined : buildingId });
        }}>
          <option value="">Tất cả khu vực</option>
          {areaId && !catalog?.areas.some(area => area.id === areaId) && <option value={areaId}>Khu vực đã chọn</option>}
          {catalog?.areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
        </select></label>
        <label>Tòa nhà<select value={buildingId ?? ''} onChange={event => navigate({ ...query, buildingId: event.target.value || undefined })}>
          <option value="">Tất cả tòa nhà</option>
          {buildingId && !availableBuildings.some(building => building.id === buildingId) && <option value={buildingId}>{knownBuilding?.name ?? 'Tòa nhà đã chọn'}</option>}
          {availableBuildings.map(building => <option key={building.id} value={building.id}>{building.name}</option>)}
        </select></label>
        {catalogFailed && !catalog && <p role="status">Không thể tải danh mục khu vực và tòa nhà. <button type="button" onClick={() => setCatalogRevision(value => value + 1)}>Tải lại danh mục</button></p>}
      </div>
      {error ? <div className="oa-notice" role="alert"><p>{error}</p>
        {!invalid && failed?.retry && <button type="button" onClick={reload}>Thử lại</button>}
      </div> : !data && <div className="oa-loading" role="status">
        <p>Đang tải báo cáo tỷ lệ lấp đầy…</p>
        <div className="oa-kpis" aria-hidden="true">{['rate', 'active', 'leased', 'without'].map(key => <span key={key} />)}</div>
      </div>}
      {data && <>
        <dl className="oa-kpis">
          <div className="oa-primary-kpi"><dt>Tỷ lệ lấp đầy hiện tại</dt><dd>{percent(data.occupancyRate)}</dd></div>
          <div><dt>Phòng hoạt động</dt><dd>{quantity(data.activeRooms)}</dd></div>
          <div><dt>Phòng đang thuê</dt><dd>{quantity(data.occupiedRooms)}</dd></div>
          <div><dt>Chưa có hợp đồng thuê hiệu lực</dt><dd>{quantity(data.roomsWithoutEffectiveLease)}</dd></div>
        </dl>
        {data.activeRooms === 0 && <p>Chưa có dữ liệu phòng hoạt động trong phạm vi lọc đã chọn.</p>}
        {data.activeRooms !== null && data.activeRooms > 0 && data.occupiedRooms === 0 &&
          <p>Hiện chưa có phòng nào có hợp đồng thuê hiệu lực trong phạm vi lọc.</p>}
        {(data.dataStatus === 'INCOMPLETE' || data.warnings.length > 0) && <aside className="oa-notice" aria-label="Cảnh báo dữ liệu">
          <h2>Cảnh báo dữ liệu</h2>
          {data.dataStatus === 'INCOMPLETE' && <p>Một số chỉ số chưa thể xác minh.</p>}
          {data.warnings.length > 0 && <ul>{data.warnings.map(warning => <li key={warning.buildingId + ':' + warning.code}>
            {data.byBuilding.find(building => building.buildingId === warning.buildingId)?.buildingName ?? 'Phạm vi báo cáo'}
            {': '}{warningLabels[warning.code] ?? 'Dữ liệu cần kiểm tra'} ({quantity(warning.count)} phòng)
          </li>)}</ul>}
        </aside>}
        <BuildingComparison buildings={data.byBuilding} onNavigate={onNavigate} />
      </>}
      <section aria-labelledby="oa-trend">
        <h2 id="oa-trend">Xu hướng tỷ lệ lấp đầy</h2>
        <TrendFilter key={JSON.stringify([fromDate, toDate])} from={fromDate} to={toDate} asOfDate={asOfDate}
          onApply={(from, to) => navigate({ ...query, fromDate: from, toDate: to })} />
        {data && <>
          <p>Khoảng phân tích {calendar(data.fromDate)} đến {calendar(data.toDate)}.</p>
          {data.trendStatus === 'ERROR' && <div className="oa-notice" role="status">
            <p>{data.trendMessage || 'Không thể tải xu hướng tỷ lệ lấp đầy lúc này.'}</p>
            <button type="button" onClick={reload}>Thử lại xu hướng</button>
          </div>}
          {data.trendStatus === 'MISSING_DATA' &&
            <p role="status">{data.trendMessage || 'Chưa có đủ dữ liệu lịch sử để phân tích xu hướng tỷ lệ lấp đầy'}</p>}
          {data.trendStatus === 'PARTIAL' && <p role="status">Một số tháng thiếu dữ liệu lịch sử.</p>}
          {data.trendStatus !== 'ERROR' && data.series.length > 0 && <TrendChart series={data.series} />}
        </>}
      </section>
    </section>
  );
}
