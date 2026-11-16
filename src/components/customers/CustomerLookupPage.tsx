import { useEffect, useState } from 'react';
import type { LookupRoute, RentalStay } from '../../types/customerLookup';
import { lookupUrl, rentalHistoryUrl } from '../../utils/customerLookupNavigation';
import { lookupRequest, LookupApiError } from '../../services/customerLookupApi';
import { isRecord } from '../../services/customerCodec';
import { useCustomerLookup } from '../../hooks/useCustomerLookup';
import './customer-lookup.css';

interface RoomOption { id: string; code: string; buildingName: string }
function rooms(value: unknown): RoomOption[] {
  if (!Array.isArray(value) || value.some(r => !isRecord(r) || typeof r.id !== 'string'
    || !/^[\da-f-]{36}$/i.test(r.id) || typeof r.code !== 'string' || typeof r.buildingName !== 'string'))
    throw new Error('Invalid room list');
  return value.map(r => ({ id: r.id, code: r.code, buildingName: r.buildingName }));
}
function calendarDate(value: string): string { const [y, m, d] = value.split('-'); return `${d}/${m}/${y}`; }
function StayFacts({ stay }: { stay: RentalStay }) {
  return <div className="lookup-stay">
    <strong>{stay.roomCode} / {stay.buildingName}</strong>
    <span>{stay.contractNumber}</span>
    <span className={stay.current ? 'lookup-current' : 'lookup-former'}>{stay.current ? 'Đang thuê' : 'Đã từng thuê'}</span>
  </div>;
}
export function CustomerLookupPage(props: {
  route: LookupRoute; onNavigate: (url: string, replace?: boolean) => void;
  onSessionExpired: (message?: string) => void; onForbidden: () => void;
}) {
  const { route, onNavigate, onSessionExpired, onForbidden } = props;
  const controller = useCustomerLookup(route, props);
  const [roomState, setRoomState] = useState<{ items?: RoomOption[]; error?: string }>({});
  const [roomAttempt, setRoomAttempt] = useState(0);
  useEffect(() => {
    if (route.view !== 'lookup') return;
    const abort = new AbortController(); let active = true;
    void lookupRequest('/rooms/search', rooms, abort.signal).then(items => {
      if (active) setRoomState({ items });
    }).catch((error: unknown) => {
      if (!active) return;
      setRoomState({ error: 'Không thể tải bộ chọn phòng.' });
      if (error instanceof LookupApiError && error.status === 401) onSessionExpired(error.message);
      if (error instanceof LookupApiError && error.status === 403) onForbidden();
    });
    return () => { active = false; abort.abort(); };
  }, [route.view, roomAttempt, onSessionExpired, onForbidden]);
  function navigate(next: LookupRoute) {
    controller.clearNotice();
    if (lookupUrl(next) === lookupUrl(route)) controller.retry();
    onNavigate(lookupUrl(next));
  }
  const title = route.view === 'history' ? 'Lịch sử thuê' : 'Tra cứu Customer và lịch sử thuê';
  const data = controller.data;
  return <section className="lookup-page" aria-labelledby="lookup-title">
    <header className="lookup-heading"><div><h1 id="lookup-title">{title}</h1>
      <p>{route.view === 'history' ? 'Từng phòng, hợp đồng và khoảng lưu trú thực tế.' : 'Tìm hồ sơ và theo dõi các phòng đã hoặc đang thuê.'}</p></div>
      <button className="lookup-button" onClick={() => onNavigate(route.view === 'history' ? route.returnTo : '/customers')}>
        {route.view === 'history' ? 'Quay lại danh sách' : 'Quản lý hồ sơ'}</button></header>
    {controller.notice && <p role="status" className="lookup-notice">{controller.notice}</p>}
    {route.view === 'lookup' && <>
      <div className="lookup-modes" role="group" aria-label="Chế độ tra cứu">
        {(['ALL', 'CURRENT'] as const).map(mode => <button className="lookup-button" key={mode} aria-pressed={route.mode === mode}
          onClick={() => navigate({ ...route, mode, page: 0 })}>{mode === 'ALL' ? 'Tất cả Customer' : 'Đang thuê'}</button>)}
      </div>
      <Filters key={`${route.q}:${route.roomId}`} route={route} roomState={roomState} errors={controller.error?.fields ?? {}}
        onRetryRooms={() => { setRoomState({}); setRoomAttempt(n => n + 1); }} onApply={navigate} />
    </>}
    {route.invalid ? <div className="lookup-state" role="alert"><h2>Đường dẫn không hợp lệ</h2>
      <p>Kiểm tra Customer, tiêu chí và thông tin phân trang.</p><button className="lookup-button" onClick={() => onNavigate('/customers/search')}>Về danh sách tra cứu</button></div>
      : controller.loading ? <div className="lookup-state" role="status" aria-live="polite"><p>Đang tải {route.view === 'history' ? 'lịch sử thuê' : 'kết quả tra cứu'}…</p><div className="lookup-skeleton" aria-hidden="true" /></div>
      : controller.error ? <div className="lookup-state" role="alert"><h2>Không thể tải {route.view === 'history' ? 'lịch sử thuê' : 'kết quả'}</h2>
        <p>{controller.error.message}</p>{![401, 403, 404].includes(controller.error.status) && <button className="lookup-button" onClick={controller.retry}>Thử lại</button>}</div>
      : data?.page ? <>
        <div className="lookup-pagination"><p role="status">{data.page.totalElements} Customer phù hợp</p><label>Số dòng
          <select value={route.size} onChange={e => navigate({ ...route, size: Number(e.target.value), page: 0 })}>
            {[...new Set([10, 20, 50, 100, route.size])].sort((a, b) => a - b).map(size => <option key={size}>{size}</option>)}
          </select></label></div>
        {!data.page.content.length ? <div className="lookup-state"><h2>{route.mode === 'CURRENT' ? 'Không có Customer đang thuê phù hợp' : 'Không có Customer phù hợp'}</h2>
          <p>Điều chỉnh từ khóa hoặc xóa bộ lọc để tra cứu lại.</p></div>
          : <div className="lookup-table-wrap" role="region" aria-label="Kết quả tra cứu Customer" aria-describedby="lookup-table-help" tabIndex={0}><table className="lookup-table"><thead><tr>
            <th scope="col">Customer</th><th scope="col">Liên hệ và giấy tờ</th><th scope="col">Phòng và hợp đồng</th>
          </tr></thead><tbody>{data.page.content.map(c => <tr key={c.id}><th scope="row"><div>{c.fullName}</div><a aria-label={`Xem lịch sử của ${c.fullName}`} href={rentalHistoryUrl(c.id, route)} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) { e.preventDefault(); onNavigate(rentalHistoryUrl(c.id, route)); } }}>Xem lịch sử</a></th>
            <td><div>{c.phone || 'Chưa có số điện thoại'}</div><div>{c.identityNo ? `${c.identityType === 'PASSPORT' ? 'Hộ chiếu' : 'CCCD'}: ${c.identityNo}` : 'Chưa có giấy tờ'}</div></td>
            <td>{c.rentals.length ? c.rentals.map(s => <StayFacts key={s.tenancyId} stay={s} />) : 'Chưa có lưu trú thực tế'}</td>
            
          </tr>)}</tbody></table><p id="lookup-table-help" className="lookup-table-hint">Cuộn ngang để xem đầy đủ thông tin phòng và hợp đồng.</p></div>}
        <nav className="lookup-pagination" aria-label="Phân trang Customer"><button className="lookup-button" disabled={data.page.first} onClick={() => navigate({ ...route, page: data.page!.page - 1 })}>Trang trước</button>
          <span>Trang {data.page.totalPages ? data.page.page + 1 : 0} / {data.page.totalPages}</span>
          <button className="lookup-button" disabled={data.page.last} onClick={() => navigate({ ...route, page: data.page!.page + 1 })}>Trang sau</button></nav>
      </> : data?.history && <>
        <h2>{data.customer?.fullName}</h2><p>{data.customer?.phone || 'Chưa có số điện thoại'}</p>
        {!data.history.items.length ? <div className="lookup-state"><h2>Customer chưa có lịch sử thuê</h2><p>Hồ sơ vẫn có thể được quản lý độc lập.</p></div>
          : <ol className="lookup-history">{data.history.items.map(s => <li key={s.tenancyId}>
            <StayFacts stay={s} /><dl><div><dt>Phòng</dt><dd>{s.roomName}</dd></div>
              <div><dt>Thời hạn hợp đồng</dt><dd>{calendarDate(s.contractStartDate)} / {calendarDate(s.contractEndDate)}</dd></div>
              <div><dt>Lưu trú thực tế</dt><dd>{calendarDate(s.fromDate)} / {s.toDate === null ? 'Chưa kết thúc' : calendarDate(s.toDate)}</dd></div>
              <div><dt>Trạng thái hợp đồng</dt><dd>{s.contractStatus === 'ACTIVE' ? 'Hiệu lực' : 'Đã thanh lý'}</dd></div></dl>
          </li>)}</ol>}
      </>}
  </section>;
}
function Filters({ route, roomState, errors, onRetryRooms, onApply }: {
  route: LookupRoute; roomState: { items?: RoomOption[]; error?: string }; errors: Record<string, string>;
  onRetryRooms: () => void; onApply: (route: LookupRoute) => void;
}) {
  const [q, setQ] = useState(route.q), [roomId, setRoomId] = useState(route.roomId);
  const [localError, setLocalError] = useState('');
  return <form className="lookup-filters" onSubmit={e => { e.preventDefault(); if (q.trim().length > 200) { setLocalError('Từ khóa tối đa 200 ký tự.'); return; } setLocalError(''); onApply({ ...route, q: q.trim(), roomId, page: 0, invalid: false }); }}>
    <label>Tên, điện thoại hoặc số giấy tờ<input type="search" value={q} aria-invalid={Boolean(localError || errors.q)} aria-describedby="lookup-q-error" onChange={e => setQ(e.target.value)} /></label>
    <label>Phòng<select value={roomId} aria-invalid={Boolean(errors.roomId)} disabled={!roomState.items} onChange={e => setRoomId(e.target.value)}>
      <option value="">Tất cả phòng</option>{roomId && !roomState.items?.some(r => r.id === roomId) && <option value={roomId}>Phòng được chọn ({roomId})</option>}
      {roomState.items?.map(r => <option value={r.id} key={r.id}>{r.code} / {r.buildingName}</option>)}</select></label>
    <button className="lookup-button lookup-primary" type="submit">Tra cứu</button>
    <button className="lookup-button" type="button" onClick={() => { setQ(''); setRoomId(''); setLocalError(''); onApply({ ...route, q: '', roomId: '', page: 0, invalid: false }); }}>Xóa bộ lọc</button>
    {(localError || errors.q) && <p id="lookup-q-error" role="alert">{localError || errors.q}</p>}
    {Object.entries(errors).filter(([field]) => field !== 'q').map(([field, error]) => <p role="alert" key={field}>{field}: {error}</p>)}
    {!roomState.items && !roomState.error && <p role="status">Đang tải bộ chọn phòng…</p>}
    {roomState.error && <p role="alert">{roomState.error} <button className="lookup-button" type="button" onClick={onRetryRooms}>Tải lại phòng</button></p>}
  </form>;
}
