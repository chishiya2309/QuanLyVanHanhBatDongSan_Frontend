import { useEffect, useState } from 'react';
import {
  billingScheduleQuery, billingScheduleStatuses, fetchBillingSchedules,
  type BillingScheduleFilterRequest, type BillingScheduleItem, type BillingScheduleOverview,
  type BillingScheduleStatus, type CycleSegment,
} from '../../services/billingScheduleApi';
import { lookupHostBuildings } from '../../services/servicePolicyApi';
import type { BuildingLookupItem } from '../../types/servicePolicy';
import {
  billingSchedulePath, createDraftHandoff, parseBillingScheduleFilters,
} from '../../utils/billingScheduleNavigation';
import { buildRentalContractUrl } from '../../utils/rentalContractNavigation';
import { invoicePath } from '../../services/invoiceApi';
import { useAutoDraftSettings } from '../../hooks/useAutoDraftBilling';
import { draftDate, draftError } from './invoiceDraftFormat';
import './billingSchedule.css';
import './autoDraftBilling.css';

const statusLabels: Record<BillingScheduleStatus, string> = {
  CHUA_DEN_KY: 'Chưa đến kỳ', SAP_DEN_KY: 'Sắp đến kỳ', DEN_KY: 'Đến kỳ',
  QUA_HAN: 'Quá hạn lập', DA_CO_BAN_NHAP: 'Đã có bản nháp', DA_PHAT_HANH: 'Đã phát hành',
};
const summaryFields = [
  ['overdueCount', 'QUA_HAN'], ['dueCount', 'DEN_KY'], ['upcomingCount', 'SAP_DEN_KY'],
  ['draftCount', 'DA_CO_BAN_NHAP'], ['issuedCount', 'DA_PHAT_HANH'],
] as const;
const columns = [
  'Chọn', 'Tòa nhà / Phòng', 'Khách thuê đại diện', 'Chu kỳ', 'Kỳ tiếp theo',
  'Ngày chốt dự kiến', 'Trạng thái', 'Hành động',
];

function canSelect(item: BillingScheduleItem) {
  return item.dataValid && item.actionType === 'CREATE_INVOICE' && (item.status === 'DEN_KY' || item.status === 'QUA_HAN');
}

export function BillingCycleSegments({ segments }: { segments: CycleSegment[] }) {
  return <details className="billing-cycle-segments">
    <summary>Chuyển phòng giữa kỳ</summary>
    <ul>{segments.map((segment, index) => (
      <li key={index}>{segment.roomName ?? 'Phòng chưa xác định'}, {draftDate(segment.segmentStart)} đến {draftDate(segment.segmentEnd)} ({segment.actualDays} ngày)</li>
    ))}</ul>
  </details>;
}

function ScheduleAction({ item, onCreate }: { item: BillingScheduleItem; onCreate: () => void }) {
  const { actionType, existingInvoiceId } = item;
  if (actionType === 'OPEN_DRAFT' || actionType === 'VIEW_INVOICE') {
    const label = actionType === 'OPEN_DRAFT' ? 'Mở bản nháp' : 'Xem hóa đơn';
    return existingInvoiceId
      ? <a className="billing-action" href={invoicePath('host') + '/' + encodeURIComponent(existingInvoiceId)}>{label}</a>
      : <button className="billing-action" type="button" disabled>{label}</button>;
  }
  return <button className="billing-action" type="button" disabled={!item.dataValid || actionType !== 'CREATE_INVOICE'}
    onClick={onCreate}>Lập hóa đơn</button>;
}

type ScheduleResult = { key: string; data: BillingScheduleOverview } | { key: string; error: string };

export function BillingSchedulePage({ accountId, onOpenNotifications }: { accountId: string; onOpenNotifications?: () => void }) {
  const autoDraft = useAutoDraftSettings();
  const [search, setSearch] = useState(() => window.location.search);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<ScheduleResult>();
  const [revision, setRevision] = useState(0);
  const [buildings, setBuildings] = useState<BuildingLookupItem[]>([]);
  const [buildingError, setBuildingError] = useState(false);
  const [buildingRevision, setBuildingRevision] = useState(0);
  const [handoffError, setHandoffError] = useState(false);
  const filters = parseBillingScheduleFilters(search);
  const query = billingScheduleQuery(filters);
  const requestKey = revision + ':' + search;
  const current = result?.key === requestKey ? result : undefined;
  const data = current && 'data' in current ? current.data : undefined;
  const eligible = data?.items.filter(canSelect) ?? [];
  const selectedIds = new Set(selected);
  const selectedItems = eligible.filter(item => selectedIds.has(item.contractId));

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Lịch lập hóa đơn | RentOps';
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    const restore = () => {
      setSearch(window.location.search);
      setSelected([]);
      setHandoffError(false);
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchBillingSchedules(parseBillingScheduleFilters(search), controller.signal).then(
      data => { if (!controller.signal.aborted) setResult({ key: requestKey, data }); },
      error => { if (!controller.signal.aborted) setResult({ key: requestKey, error: draftError(error) }); },
    );
    return () => controller.abort();
  }, [search, requestKey]);

  useEffect(() => {
    const controller = new AbortController();
    void lookupHostBuildings(controller.signal).then(
      items => { if (!controller.signal.aborted) setBuildings(items); },
      () => { if (!controller.signal.aborted) setBuildingError(true); },
    );
    return () => controller.abort();
  }, [buildingRevision]);

  function applyFilters(next: BillingScheduleFilterRequest) {
    const nextQuery = billingScheduleQuery(next);
    if (nextQuery === query) return;
    const nextSearch = nextQuery ? '?' + nextQuery : '';
    window.history.pushState(null, '', billingSchedulePath + nextSearch);
    setSearch(nextSearch);
    setSelected([]);
    setHandoffError(false);
  }

  function startDraft(mode: 'single' | 'batch', items: BillingScheduleItem[]) {
    try {
      window.location.assign(createDraftHandoff(accountId, mode, query, items));
    } catch {
      setHandoffError(true);
    }
  }

  return <section className="billing-schedule" aria-labelledby="billing-schedule-title">
    <header><h1 id="billing-schedule-title">Lịch lập hóa đơn</h1></header>
    <section className="uc55-settings-bar" aria-label="Cấu hình tự động lập hóa đơn nháp">
      <div className="uc55-settings-copy">
        <div className="uc55-settings-title-row">
          <strong id="uc55-auto-draft-label">Tự động lập hóa đơn nháp khi đến kỳ</strong>
          <span className={`uc55-badge ${autoDraft.settings?.autoDraftEnabled ? 'uc55-badge--accent' : 'uc55-badge--neutral'}`}>
            {autoDraft.loading ? 'Đang tải' : autoDraft.settings?.autoDraftEnabled ? 'Đang bật' : 'Đang tắt'}
          </span>
        </div>
        <p className="uc55-settings-desc">
          {autoDraft.settings?.autoDraftEnabled
            ? 'Hệ thống tự động quét và tạo hóa đơn nháp lúc 01:00 AM (UTC+7) hằng ngày, hỗ trợ bù kỳ và tách lát cắt chuyển phòng giữa kỳ.'
            : 'Đang tắt tự động: bạn tự theo dõi lịch đến kỳ tại đây và lập hóa đơn nháp thủ công khi cần.'}
        </p>
        {autoDraft.settings?.updatedAt && (
          <p className="uc55-settings-time">
            Cập nhật lần cuối: {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(autoDraft.settings.updatedAt))}
          </p>
        )}
        {autoDraft.error && (
          <p className="uc55-settings-error" role="alert">{autoDraft.error}</p>
        )}
      </div>
      <div className="uc55-settings-actions">
        {onOpenNotifications && (
          <button type="button" className="uc55-btn uc55-btn--ghost" onClick={onOpenNotifications}>
            Hòm thư tổng kết
          </button>
        )}
        <button
          type="button"
          role="switch"
          aria-labelledby="uc55-auto-draft-label"
          aria-checked={Boolean(autoDraft.settings?.autoDraftEnabled)}
          disabled={autoDraft.loading || autoDraft.saving || !autoDraft.settings}
          className={`uc55-switch${autoDraft.settings?.autoDraftEnabled ? ' is-checked' : ''}`}
          onClick={() => void autoDraft.toggle(!autoDraft.settings?.autoDraftEnabled)}
        >
          <span className="uc55-switch-thumb" aria-hidden="true" />
          <span className="uc55-switch-text">
            {autoDraft.saving ? 'Đang lưu...' : autoDraft.settings?.autoDraftEnabled ? 'Tắt tự động' : 'Bật tự động'}
          </span>
        </button>
      </div>
    </section>
    <dl className="billing-stats" aria-label="Tổng hợp lịch lập hóa đơn" aria-busy={!current}>
      {summaryFields.map(([field, status]) => <div key={field} data-status={status}>
        <dt>{statusLabels[status]}</dt><dd>{data?.summary[field] ?? '—'}</dd>
      </div>)}
    </dl>
    <section className="billing-filters" aria-label="Bộ lọc lịch lập hóa đơn">
      <label>Tòa nhà
        <select name="propertyId" value={filters.propertyId ?? ''} onChange={event => applyFilters({ ...filters, propertyId: event.target.value })}>
          <option value="">Tất cả tòa nhà</option>
          {filters.propertyId && !buildings.some(building => building.id === filters.propertyId) &&
            <option value={filters.propertyId}>Tòa nhà đang lọc</option>}
          {buildings.map(building => <option key={building.id} value={building.id}>{building.name}</option>)}
        </select>
      </label>
      <details onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }} onKeyDown={event => {
        if (event.key !== 'Escape' || !event.currentTarget.open) return;
        event.currentTarget.open = false;
        event.currentTarget.querySelector('summary')?.focus();
      }}>
        <summary>Trạng thái{filters.status?.length ? ` (${filters.status.length})` : ''}</summary>
        <fieldset>
          <legend className="visually-hidden">Trạng thái đến kỳ</legend>
          {billingScheduleStatuses.map(status => <label key={status}>
            <input name="status" type="checkbox" checked={filters.status?.includes(status) ?? false}
              onChange={event => applyFilters({
                ...filters,
                status: event.target.checked ? [...(filters.status ?? []), status] : filters.status?.filter(value => value !== status),
              })} />
            {statusLabels[status]}
          </label>)}
        </fieldset>
      </details>
      <label>Tháng
        <select name="month" value={filters.month ?? ''}
          onChange={event => applyFilters({ ...filters, month: Number(event.target.value) || null })}>
          <option value="">Tất cả tháng</option>
          {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Tháng {index + 1}</option>)}
        </select>
      </label>
      <form onSubmit={event => {
        event.preventDefault();
        const year = Number(new FormData(event.currentTarget).get('year'));
        applyFilters({ ...filters, year: year || null });
      }}>
        <label>Năm
          <input key={filters.year} name="year" type="number" min="1" max="9999" step="1" defaultValue={filters.year ?? ''}
            placeholder="Tất cả năm"
            onBlur={event => { if (event.currentTarget.validity.valid) event.currentTarget.form?.requestSubmit(); }} />
        </label>
      </form>
      {query && <button className="billing-action" type="button" onClick={() => applyFilters({})}>Xóa bộ lọc</button>}
    </section>
    {buildingError && <p className="billing-notice" role="status">Chưa tải được danh sách tòa nhà.{' '}
      <button type="button" className="billing-action" onClick={() => {
        setBuildingError(false); setBuildingRevision(value => value + 1);
      }}>Thử lại tải tòa nhà</button></p>}
    {!current && <div className="billing-skeleton" role="status">
      <p>Đang tải lịch lập hóa đơn…</p><span /><span /><span />
    </div>}
    {current && 'error' in current && <div className="billing-notice" role="alert">
      <p>{current.error}</p>
      <button type="button" className="billing-action" onClick={() => setRevision(value => value + 1)}>Thử lại</button>
    </div>}
    {data && data.items.length === 0 && <div className="billing-notice">
      {data.emptyStateMessage || !query ? <>
        <p>{data.emptyStateMessage ?? 'Chưa có hợp đồng thuê đang hoạt động để theo dõi lịch lập hóa đơn'}</p>
        <a className="billing-action" href={buildRentalContractUrl({ create: true })}>Tạo hợp đồng thuê</a>
      </> : <p>Không có kỳ tính tiền phù hợp. Hãy xóa bộ lọc để xem toàn bộ lịch.</p>}
    </div>}
    {data && data.items.length > 0 && <>
      {data.emptyStateMessage && <p className="billing-notice" role="status">{data.emptyStateMessage}</p>}
      <div className="billing-batch">
        <button className="billing-action" type="button" onClick={() => setSelected(eligible.map(item => item.contractId))}
          disabled={!eligible.length || selectedItems.length === eligible.length}>Chọn tất cả phòng đến kỳ</button>
        <span role="status">Đã chọn {selectedItems.length} kỳ</span>
        {selectedItems.length > 0 && <button className="billing-action" type="button" onClick={() => setSelected([])}>Bỏ chọn</button>}
        <button className="billing-action billing-action--primary" type="button" disabled={!selectedItems.length}
          onClick={() => startDraft('batch', selectedItems)}>Lập hóa đơn hàng loạt</button>
      </div>
      {handoffError && <p className="billing-notice" role="alert">Chưa thể chuyển kỳ tính tiền sang màn hình lập nháp. Hãy thử lại.</p>}
      <div className="billing-table" tabIndex={0} role="region" aria-label="Bảng lịch lập hóa đơn">
        <table aria-label="Các kỳ tính tiền">
          <thead><tr>{columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody>{data.items.map(item => <tr key={item.contractId}>
            <td data-label={columns[0]}>
              {canSelect(item) ? <label className="billing-check">
                <input type="checkbox" checked={selectedIds.has(item.contractId)}
                  aria-label={`Chọn ${item.roomName ?? 'phòng'} ${draftDate(item.cycleStart)}`}
                  onChange={event => {
                    const checked = event.target.checked;
                    setSelected(ids => checked ? [...ids, item.contractId] : ids.filter(id => id !== item.contractId));
                  }} />
              </label> : null}
            </td>
            <td data-label={columns[1]}>
              <strong>{item.roomName ?? '—'}</strong>{' '}<span className="billing-secondary">{item.propertyName ?? '—'}</span>
              {item.hasRoomTransferInCycle && <BillingCycleSegments segments={item.cycleSegments} />}
            </td>
            <td data-label={columns[2]}>{item.representativeTenantName ?? '—'}</td>
            <td data-label={columns[3]}>{item.billingCycleMonths && item.billingCycleMonths > 0 ? `${item.billingCycleMonths} tháng` : '—'}</td>
            <td className="billing-date" data-label={columns[4]}>{item.cycleStart && item.cycleEnd
              ? `${draftDate(item.cycleStart)} đến ${draftDate(item.cycleEnd)}` : '—'}</td>
            <td className="billing-date" data-label={columns[5]}><strong>{draftDate(item.expectedClosingDate)}</strong></td>
            <td data-label={columns[6]}>
              <span className="billing-status" data-status={item.status}>{statusLabels[item.status]}</span>
              {item.status === 'QUA_HAN' && <>{' '}<span className="billing-secondary">Trễ {item.overdueDays} ngày</span></>}
              {!item.dataValid && <p className="billing-warning">{item.warningMessage ??
                'Dữ liệu hợp đồng chưa hoàn chỉnh, vui lòng kiểm tra lại cấu hình chu kỳ thanh toán'}</p>}
            </td>
            <td data-label={columns[7]}><ScheduleAction item={item} onCreate={() => startDraft('single', [item])} /></td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </section>;
}
