import { ReportExportButton } from './ReportExportDialog';
import { useEffect, useState } from 'react';
import { getAreas, getBuildings, PropertyApiError } from '../../services/propertiesApi';
import { AuthApiError } from '../../services/authErrors';
import { getOccupancyReport, OccupancyApiError, type OccupancyReport } from '../../services/occupancyApi';
import { occupancySorts, occupancyUrl, type OccupancyQuery } from '../../utils/occupancyNavigation';
import { propertiesUrl, roomsUrl } from '../../utils/propertyNavigation';
import { buildRentalContractUrl } from '../../utils/rentalContractNavigation';
import type { Area, Building } from '../../types/properties';
import './occupancy.css';

const invalidFilter = 'Bộ lọc không hợp lệ. Vui lòng chọn lại khu vực hoặc tòa nhà.';
const loadError = 'Không thể tải dữ liệu báo cáo phòng trống lúc này. Vui lòng thử lại sau.';
const integer = new Intl.NumberFormat('vi-VN');
const dateTime = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
});

function formatDecimal(value: string) {
  const [whole, fraction] = value.split('.');
  const decimals = fraction?.replace(/0+$/, '');
  return integer.format(BigInt(whole)) + (decimals ? ',' + decimals : '');
}

const formatMoney = (value: string) => formatDecimal(value) + ' VNĐ/tháng';

function warningText(code: string, count: number) {
  switch (code) {
    case 'INVALID_DEFAULT_RENT': return 'Có ' + count + ' phòng trống chưa có giá thuê hợp lệ. Tổng giá trị thuê tiềm năng chưa bao gồm các phòng này.';
    case 'UNKNOWN_VACANT_SINCE': return 'Có ' + count + ' phòng trống chưa xác định được số ngày trống.';
    case 'ROOM_STATE_CONFLICT': return 'Có ' + count + ' phòng có trạng thái không nhất quán và được xếp vào nhóm không khả dụng.';
    default: return null;
  }
}

function BuildingChart({ buildings, money }: { buildings: OccupancyReport['byBuilding']; money: boolean }) {
  const values = buildings.map(building => money ? Number(building.vacantRentPotential) : building.availableVacantRooms);
  const max = Math.max(1, ...values);
  return (
    <figure className="occupancy-chart">
      <figcaption>{money ? 'Giá thuê tiềm năng (VNĐ/tháng)' : 'Phòng trống có thể khai thác'}</figcaption>
      <ul>
        {buildings.map((building, index) => (
          <li key={building.buildingId}>
            <span>{building.buildingName}</span>
            <strong>{money ? formatDecimal(building.vacantRentPotential) : integer.format(building.availableVacantRooms)}</strong>
            <div className="occupancy-bar-track" aria-hidden="true">
              <div className="occupancy-bar" style={{ inlineSize: (values[index] / max * 100) + '%' }} />
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}

interface Props {
  query: OccupancyQuery;
  onNavigate: (url: string) => void;
  onRoom: (url: string) => void;
  onContract: (url: string) => void;
  onProperties: (url: string) => void;
  onSessionExpired: () => void;
}

type Catalog = { areas: Area[]; buildings: Building[] };
type ReportResult = { query: OccupancyQuery; revision: number } & ({ data: OccupancyReport } | { error: string; retry: boolean });

function errorStatus(error: unknown) {
  return error instanceof OccupancyApiError || error instanceof AuthApiError || error instanceof PropertyApiError ? error.status : 0;
}

export function OccupancyReportPage({ query, onNavigate, onRoom, onContract, onProperties, onSessionExpired }: Props) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<ReportResult | null>(null);
  const { areaId, buildingId } = query;
  const invalid = Boolean(areaId && buildingId && catalog?.buildings.some(
    building => building.id === buildingId && building.areaId !== areaId,
  ));
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
    getOccupancyReport(query, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ query, revision, data });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const status = errorStatus(error);
      if (status === 401) {
        onSessionExpired();
        return;
      }
      const retry = status !== 400 && status !== 403 && status !== 404;
      let message = loadError;
      if (status === 400) message = error instanceof Error && error.message ? error.message : invalidFilter;
      if (status === 403 || status === 404) message = 'Không thể truy cập dữ liệu được yêu cầu.';
      setResult({ query, revision, error: message, retry });
    });
    return () => controller.abort();
  }, [invalid, onSessionExpired, query, revision, waitingForPair]);

  const current = result?.query === query && result.revision === revision ? result : null;
  const data = !invalid && current && 'data' in current ? current.data : null;
  const error = invalid ? invalidFilter : current && 'error' in current ? current.error : null;
  const reload = () => setRevision(value => value + 1);
  const buildings = catalog?.buildings.filter(building => !areaId || building.areaId === areaId) ?? [];
  const page = data?.availableRooms;

  return (
    <section className="occupancy" aria-labelledby="occupancy-title">
      <header>
        <h1 id="occupancy-title">Phân tích phòng trống</h1>
        <p>Giá thuê tiềm năng là ước tính theo giá niêm yết. Doanh thu thực tế và doanh thu đã mất không nằm trong báo cáo này.</p>
        <div className="occupancy-toolbar" aria-label="Bộ lọc báo cáo">
          <label>Khu vực
            <select value={areaId ?? ''} disabled={!catalog} onChange={event => {
              const nextArea = event.target.value || undefined;
              const keepBuilding = !nextArea || catalog?.buildings.some(building => building.id === buildingId && building.areaId === nextArea);
              onNavigate(occupancyUrl({ ...query, areaId: nextArea, buildingId: keepBuilding ? buildingId : undefined, page: 0 }));
            }}>
              <option value="">Tất cả khu vực</option>
              {areaId && !catalog?.areas.some(area => area.id === areaId) && <option value={areaId}>Khu vực đã chọn</option>}
              {catalog?.areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
          </label>
          <label>Tòa nhà
            <select value={buildingId ?? ''} disabled={!catalog} onChange={event =>
              onNavigate(occupancyUrl({ ...query, buildingId: event.target.value || undefined, page: 0 }))}>
              <option value="">Tất cả tòa nhà</option>
              {buildingId && !buildings.some(building => building.id === buildingId) && <option value={buildingId}>Tòa nhà đã chọn</option>}
              {buildings.map(building => <option key={building.id} value={building.id}>{building.name}</option>)}
            </select>
          </label>
          <label>Sắp xếp
            <select value={query.sort} onChange={event => {
              const sort = occupancySorts.find(value => value === event.target.value);
              if (sort) onNavigate(occupancyUrl({ ...query, sort, page: 0 }));
            }}>
              <option value="daysVacant,desc">Số ngày trống giảm dần</option>
              <option value="daysVacant,asc">Số ngày trống tăng dần</option>
              <option value="defaultRent,desc">Giá thuê giảm dần</option>
              <option value="defaultRent,asc">Giá thuê tăng dần</option>
            </select>
          </label>
          <button type="button" className="occupancy-primary" disabled={invalid || waitingForPair} onClick={reload}>Làm mới báo cáo</button>
          <ReportExportButton source={{ kind: 'occupancy', areaId, buildingId }} catalog={catalog}
            catalogFailed={catalogFailed} onRetryCatalog={() => { setCatalogFailed(false); setCatalogRevision(value => value + 1); }}
            onSessionExpired={onSessionExpired} />
        </div>
        {catalogFailed && <div className="occupancy-state">
          <p role="status">Không thể tải danh mục khu vực và tòa nhà.</p>
          <button type="button" onClick={() => {
            setCatalogFailed(false);
            setCatalogRevision(value => value + 1);
          }}>Tải lại danh mục</button>
        </div>}
      </header>

      {error && <div className="occupancy-state" role="alert">
        <p>{error}</p>
        {!invalid && current && 'retry' in current && current.retry && <button type="button" onClick={reload}>Thử lại</button>}
      </div>}
      {!error && !data && <div className="occupancy-state" role="status">Đang tải báo cáo phòng trống…</div>}

      {data && page && <>
        <dl className="occupancy-kpis">
          <div><dt>Phòng trống có thể khai thác</dt><dd>{integer.format(data.availableVacantRooms)}</dd></div>
          <div><dt>Tỷ lệ phòng trống</dt><dd>{data.vacancyRate === null ? 'N/A' : formatDecimal(data.vacancyRate) + '%'}</dd></div>
          <div><dt>Giá thuê tiềm năng</dt><dd>{formatMoney(data.vacantRentPotential)}</dd></div>
        </dl>
        <div className="occupancy-meta">
          <span>Phòng không khả dụng: {integer.format(data.unavailableRooms)}</span>
          <span>Cập nhật lúc <time dateTime={data.generatedAt}>{dateTime.format(new Date(data.generatedAt))}</time></span>
        </div>
        {data.warnings.map(({ code, count }) => {
          const message = warningText(code, count);
          return message && <p key={code} className="occupancy-warning" role="status">{message}</p>;
        })}
        {data.totalRooms === 0 ? <div className="occupancy-state">
          <p>Chưa có dữ liệu phòng để phân tích</p>
          <button type="button" onClick={() => onProperties(propertiesUrl('buildings'))}>Quản lý tòa nhà</button>
          <button type="button" onClick={() => onRoom('/rooms')}>Quản lý phòng</button>
        </div> : <>
          <section aria-labelledby="occupancy-buildings">
            <h2 id="occupancy-buildings">Phân bổ theo tòa nhà</h2>
            {data.byBuilding.length ? <div className="occupancy-charts">
              <BuildingChart buildings={data.byBuilding} money={false} />
              <BuildingChart buildings={data.byBuilding} money />
            </div> : <p>Chưa có số liệu phòng trống theo tòa nhà.</p>}
          </section>

          <section aria-labelledby="occupancy-rooms">
            <h2 id="occupancy-rooms">Danh sách phòng trống</h2>
            {data.availableVacantRooms === 0 ? <p className="occupancy-state">
              {data.occupiedRooms === data.totalRooms && data.unavailableRooms === 0
                ? 'Tỷ lệ lấp đầy đạt 100% – Không có phòng trống'
                : 'Hiện không có phòng trống sẵn sàng cho thuê'}
            </p> : <div className="occupancy-table-block">
              <div className="occupancy-table-scroll" role="region" aria-label="Bảng phòng trống có thể cuộn ngang" tabIndex={0}>
                <table aria-labelledby="occupancy-rooms">
                  <thead><tr>
                    {['Mã phòng', 'Tên phòng', 'Tòa nhà', 'Khu vực', 'Diện tích', 'Giá thuê mặc định', 'Số ngày trống', 'Hành động'].map(heading =>
                      <th key={heading} scope="col">{heading}</th>)}
                  </tr></thead>
                  <tbody>
                    {page.items.map(room => <tr key={room.roomId}>
                      <th scope="row">{room.code}</th><td>{room.name}</td><td>{room.buildingName}</td><td>{room.areaName}</td>
                      <td>{room.area === null ? 'Chưa có' : formatDecimal(room.area) + ' m²'}</td>
                      <td>{room.defaultRent === null || Number(room.defaultRent) <= 0 ? 'Chưa có giá hợp lệ' : formatMoney(room.defaultRent)}</td>
                      <td>{room.daysVacant ?? 'Chưa xác định'}</td>
                      <td><div className="occupancy-actions">
                        <button type="button" aria-label={'Xem chi tiết phòng ' + room.code} onClick={() => onRoom(roomsUrl({ buildingId: room.buildingId, roomId: room.roomId, action: 'detail' }))}>Xem chi tiết</button>
                        <button type="button" aria-label={'Lập hợp đồng phòng ' + room.code} onClick={() => onContract(buildRentalContractUrl({ create: true, roomId: room.roomId }))}>Lập hợp đồng</button>
                      </div></td>
                    </tr>)}
                    {!page.items.length && <tr><td colSpan={8}>Trang này không có phòng. Chọn trang đầu để xem danh sách hiện tại.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="occupancy-pagination" aria-label="Phân trang phòng trống">
                <span>{page.items.length ? 'Trang ' + (page.page + 1) + '/' + page.totalPages : 'Trang không còn khả dụng'} ({page.totalElements} phòng)</span>
                {page.page >= page.totalPages && <button type="button" onClick={() => onNavigate(occupancyUrl({ ...query, page: 0 }))}>Trang đầu</button>}
                <button type="button" disabled={page.page === 0} onClick={() => onNavigate(occupancyUrl({ ...query, page: page.page - 1 }))}>Trang trước</button>
                <button type="button" disabled={page.page + 1 >= page.totalPages} onClick={() => onNavigate(occupancyUrl({ ...query, page: page.page + 1 }))}>Trang sau</button>
              </div>
            </div>}
          </section>
        </>}
      </>}
    </section>
  );
}
