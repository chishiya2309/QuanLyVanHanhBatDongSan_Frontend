import { Fragment, useEffect, useRef, useState } from 'react';
import type { NavigationGuardRegistration } from '../../hooks/useServiceCatalog';
import { useMeterReadings } from '../../hooks/useMeterReadings';
import { getAllMeterItems, getBillingPeriods, getMeterBuildings, getMeterRooms, isMeterAbort, MeterApiError } from '../../services/meterApi';
import { meterBlockLabels, meterKey, meterMessages as m, meterSourceLabels, type BillingPeriod, type MeterDraft, type MeterItem, type MeterPage, type MeterRoute, type MeterView } from '../../types/meterReading';
import { isMeterDate, meterContextKey, meterScope, meterUrl } from '../../utils/meterNavigation';
import './meterReadings.css';

type Controller = ReturnType<typeof useMeterReadings>;
const day = (value: string) => { const [y, m, d] = value.split('-'); return `${d}/${m}/${y}`; };
const range = (item: { fromDate: string; toDate: string }) => `${day(item.fromDate)} đến trước ${day(item.toDate)}`;
const value = (input: string | null) => input === null ? 'Chưa có' : input;
const block = (item: MeterItem) => item.blockedReason ? meterBlockLabels[item.blockedReason] || 'Mục này chưa đủ điều kiện ghi. Tải lại để kiểm tra.' : null;
const resultLabels = { SAVED: 'Đã lưu', FAILED: 'Lỗi lưu', UNKNOWN: 'Chưa rõ kết quả', NOT_PROCESSED: 'Chưa xử lý', EXISTS: 'Đã có dữ liệu', NOT_SAVED: 'Chưa lưu, đã đối chiếu' };

export function MeterForbidden({ onBack }: { onBack: () => void }) {
  return <section className="mr-page"><h1>Ghi và kiểm tra chỉ số</h1><p role="alert" className="mr-notice mr-notice--error">{m.forbidden}</p><button type="button" className="mr-button" onClick={onBack}>Về tổng quan</button></section>;
}
export function MeterReadingsPage(props: { route: MeterRoute; onNavigate: (url: string) => void; registerGuard: NavigationGuardRegistration; onSessionExpired: (message?: string) => void }) {
  return <MeterWorkbench key={meterContextKey(props.route)} {...props} />;
}
function ScopePicker({ route, navigate, c }: { route: MeterRoute; navigate: (patch: Partial<MeterRoute>) => void; c: Controller }) {
  const [from, setFrom] = useState(route.fromDate), [to, setTo] = useState(route.toDate), [building, setBuilding] = useState(route.buildingId), [rooms, setRooms] = useState(route.roomIds);
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([]), [roomOptions, setRoomOptions] = useState<{ id: string; name: string }[]>([]);
  const [choicesLoading, setChoicesLoading] = useState(true), [choicesError, setChoicesError] = useState<string | null>(null), [choicesAttempt, setChoicesAttempt] = useState(0);
  const [periods, setPeriods] = useState<MeterPage<BillingPeriod> | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string[]>(route.periodIds), [fields, setFields] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);
  const { makeGuard, handleFatal, saving, recovering } = c;
  const busy = saving || recovering;
  useEffect(() => {
    const controller = new AbortController(), current = makeGuard(), href = window.location.href;
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setChoicesLoading(true); setChoicesError(null);
      try {
        const result = await Promise.all([getMeterBuildings(controller.signal), getMeterRooms(building, controller.signal)]);
        if (current() && !controller.signal.aborted) { setBuildings(result[0]); setRoomOptions(result[1]); }
      } catch (e) {
        if (href === window.location.href && !controller.signal.aborted && e instanceof MeterApiError && e.status === 401) { handleFatal(e); return; }
        if (current() && !controller.signal.aborted && !isMeterAbort(e) && !handleFatal(e)) setChoicesError('Chưa tải được danh sách tòa nhà/phòng. Vui lòng thử lại.');
      } finally { if (current() && !controller.signal.aborted) setChoicesLoading(false); }
    });
    return () => controller.abort();
  }, [building, choicesAttempt, route.view, route.page, route.periodPage, makeGuard, handleFatal]);
  useEffect(() => {
    if (!route.fromDate || !route.toDate || route.invalid) return;
    const controller = new AbortController(), current = makeGuard(), href = window.location.href;
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setLoading(true); setError(null);
      try {
        const result = await getBillingPeriods(route.fromDate, route.toDate, meterScope(route), route.periodPage, controller.signal);
        if (current() && !controller.signal.aborted) setPeriods(result);
      } catch (e) {
        if (href === window.location.href && !controller.signal.aborted && e instanceof MeterApiError && e.status === 401) { handleFatal(e); return; }
        if (current() && !controller.signal.aborted && !isMeterAbort(e) && !handleFatal(e)) setError(e instanceof Error ? e.message : m.readFailure);
      } finally { if (current() && !controller.signal.aborted) setLoading(false); }
    });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meterUrl(route), attempt, makeGuard, handleFatal]);
  useEffect(() => { if (Object.keys(fields).length) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [fields]);
  return <details className="mr-scope" open={route.periodIds.length === 0 ? true : undefined}>
    <summary>Phạm vi phòng và kỳ{route.periodIds.length ? ` (${route.periodIds.length} kỳ đã chọn)` : ''}</summary>
    <form ref={form} noValidate onSubmit={(event) => {
      event.preventDefault();
      const errors: Record<string, string> = {};
      if (!isMeterDate(from)) errors.fromDate = 'Chọn ngày bắt đầu hợp lệ.';
      if (!isMeterDate(to) || from >= to) errors.toDate = 'Chọn ngày kết thúc sau ngày bắt đầu.';
      setFields(errors);
      if (!Object.keys(errors).length) navigate({ fromDate: from, toDate: to, buildingId: building, roomIds: rooms, periodIds: [], page: 0, periodPage: 0, readingId: null });
    }}>
      <div className="mr-filter-grid">
        <label>Từ ngày (bắt buộc)<input name="fromDate" aria-label="Từ ngày (bắt buộc)" type="date" value={from} disabled={busy} aria-required="true" aria-invalid={!!fields.fromDate} aria-describedby="mr-from-help" onChange={(e) => setFrom(e.target.value)} /><span id="mr-from-help" className="mr-field-help">{fields.fromDate || 'Tìm các kỳ giao với khoảng ngày.'}</span></label>
        <label>Đến trước ngày (bắt buộc)<input name="toDate" aria-label="Đến trước ngày (bắt buộc)" type="date" value={to} disabled={busy} aria-required="true" aria-invalid={!!fields.toDate} aria-describedby="mr-to-help" onChange={(e) => setTo(e.target.value)} /><span id="mr-to-help" className="mr-field-help">{fields.toDate || 'Không bao gồm ngày kết thúc này.'}</span></label>
        <label>Tòa nhà<select name="buildingId" value={building} disabled={busy || choicesLoading} onChange={(e) => { setBuilding(e.target.value); setRooms([]); }}><option value="">Tất cả tòa nhà</option>{building && !buildings.some((b) => b.id === building) && <option value={building}>Tòa nhà đang chọn</option>}{buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select><span className="mr-field-help">Giới hạn trong phạm vi quản lý.</span></label>
        <label>Phòng<select name="roomIds" multiple size={3} value={rooms} disabled={busy || choicesLoading} onChange={(e) => setRooms([...e.target.selectedOptions].map((o) => o.value))}>{roomOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}{rooms.filter((id) => !roomOptions.some((r) => r.id === id)).map((id) => <option key={id} value={id}>Phòng đang chọn ({id.slice(0, 8)})</option>)}</select><span className="mr-field-help">Không chọn phòng để xem tất cả. Có thể chọn nhiều phòng.</span></label>
      </div>
      {choicesLoading && <p role="status">Đang tải tòa nhà và phòng…</p>}
      {choicesError && <p role="alert">{choicesError} <button type="button" className="mr-button" onClick={() => setChoicesAttempt((n) => n + 1)}>Tải lại phòng và tòa nhà</button></p>}
      <div className="mr-actions"><button type="submit" className="mr-button" disabled={busy}>Tìm kỳ đã có</button>{rooms.length > 0 && <button type="button" className="mr-button" disabled={busy} onClick={() => setRooms([])}>Bỏ chọn phòng</button>}</div>
    </form>
    {loading ? <Skeleton label="Đang tìm kỳ…" /> : error ? <div className="mr-notice mr-notice--error" role="alert">{error} <button type="button" className="mr-button" onClick={() => setAttempt((n) => n + 1)}>Tải lại các kỳ</button></div> : periods ? <>
      <div className="mr-section-heading"><h2>Chọn kỳ cần làm việc</h2><span>{periods.total} kỳ trong khoảng tìm kiếm</span></div>
      {!periods.total ? <p className="mr-empty">Chưa có kỳ trong khoảng ngày đã chọn. Hãy kiểm tra lại phạm vi hoặc chọn khoảng ngày khác.</p> : <>
        <div className="mr-period-list" aria-label="Các kỳ đã tồn tại">{periods.items.map((p) => <label key={p.id} className="mr-period-option"><input type="checkbox" checked={selected.includes(p.id)} disabled={busy} onChange={(e) => setSelected((old) => e.target.checked ? [...old, p.id] : old.filter((id) => id !== p.id))} /><span><strong>Phòng {p.roomCode}</strong><span>{range(p)}</span><small>Chu kỳ gốc: {day(p.cycleStart)} đến trước {day(p.cycleEnd)}. {p.status === 'SEALED' ? 'Kỳ đã khóa' : 'Kỳ đang mở'}</small></span></label>)}</div>
        <Pagination page={route.periodPage} total={periods.total} busy={busy} label="kỳ" onPage={(page) => navigate({ periodPage: page })} />
      </>}
      <div className="mr-actions"><button type="button" className="mr-button" disabled={busy} onClick={() => {
        if (!selected.length) { setFields({ scope: 'Chọn ít nhất một kỳ để ghi hoặc xem tiến độ.' }); return; }
        navigate({ periodIds: selected, page: 0, readingId: null });
      }}>Dùng {selected.length} kỳ đã chọn</button><button type="button" className="mr-button" disabled={busy} onClick={() => setSelected([])}>Bỏ chọn kỳ</button></div>
      {fields.scope && <p role="alert" className="mr-field-error">{fields.scope}</p>}
    </> : <p className="mr-empty">Chọn khoảng ngày để tra cứu kỳ đã có. Mỗi phòng có thể có kỳ hoặc phần kỳ khác nhau.</p>}
  </details>;
}
function Skeleton({ label }: { label: string }) {
  return <div className="mr-loading" role="status" aria-label={label}><span>{label}</span><div className="mr-skeleton-line" /><div className="mr-skeleton-line" /><div className="mr-skeleton-line" /></div>;
}
function Pagination({ page, total, busy, label, onPage }: { page: number; total: number; busy: boolean; label: string; onPage: (page: number) => void }) {
  if (total <= 20 && page === 0) return null;
  return <nav className="mr-pagination" aria-label={'Phân trang ' + label}><button type="button" className="mr-button" disabled={busy || page === 0} onClick={() => onPage(page - 1)}>Trang trước</button><span>Trang {page + 1} / {Math.max(1, Math.ceil(total / 20))}</span><button type="button" className="mr-button" disabled={busy || (page + 1) * 20 >= total} onClick={() => onPage(page + 1)}>Trang sau</button></nav>;
}
function Fields({ item, draft, c, batch }: { item: MeterItem; draft?: MeterDraft; c: Controller; batch: boolean }) {
  const key = meterKey(item), id = 'mr-' + item.requirementId, fields = draft?.fields || {};
  const disabled = c.saving || c.recovering || c.needsReconcile || !c.listFresh || !!draft?.reviewRequired || !(item.readingId ? item.canUpdate : item.canCreate);
  return <div className={'mr-editor' + (batch ? ' mr-editor--batch' : '')}>
    {item.initialStartAllowed && <>
      <label htmlFor={id + '-start'}>Chỉ số đầu ban đầu (bắt buộc)<input id={id + '-start'} name="startIndex" type="text" inputMode="decimal" autoComplete="off" value={draft?.start ?? ''} disabled={disabled} aria-required="true" aria-invalid={!!fields.startIndex} aria-describedby={id + '-start-help'} onBlur={() => c.checkField(item, 'startIndex')} onChange={(e) => c.change(item, { start: e.target.value })} /><span id={id + '-start-help'} className="mr-field-help">{fields.startIndex || 'Chỉ xác nhận khi chưa có nguồn phù hợp.'}</span></label>
      <label className="mr-check-label"><input type="checkbox" name="confirmStart" checked={draft?.confirmed ?? false} disabled={disabled} aria-invalid={!!fields.confirmed} aria-describedby={id + '-confirm-help'} onChange={(e) => c.change(item, { confirmed: e.target.checked })} /><span>Tôi xác nhận chỉ số đầu cho phòng {item.roomCode}, dịch vụ {item.serviceName}, kỳ đang hiển thị.<span id={id + '-confirm-help'} className="mr-field-help">{fields.confirmed || 'Chỉ hoàn tất sau khi lưu chỉ số cuối thành công.'}</span></span></label>
    </>}
    <label htmlFor={id + '-end'}>Chỉ số cuối (bắt buộc)<input id={id + '-end'} name="endIndex" type="text" inputMode="decimal" autoComplete="off" value={draft?.end ?? item.endIndex ?? ''} disabled={disabled} aria-required="true" aria-invalid={!!fields.endIndex} aria-describedby={id + '-end-help'} onBlur={() => c.checkField(item, 'endIndex')} onChange={(e) => c.change(item, { end: e.target.value })} /><span id={id + '-end-help'} className="mr-field-help">{fields.endIndex || `Đơn vị ${item.unit}. Dùng dấu chấm thập phân; 0 là giá trị hợp lệ.`}</span></label>
    {draft?.reviewRequired && <div className="mr-review" role="alert"><p>Bối cảnh cần được kiểm tra lại. Dữ liệu đang nhập vẫn được giữ.</p><button type="button" className="mr-button" disabled={!c.listFresh || c.needsReconcile || c.saving || c.recovering} onClick={() => c.review(item)}>Dùng dữ liệu mới và kiểm tra lại</button></div>}
    {Object.entries(fields).filter(([name]) => !['endIndex', 'startIndex', 'confirmed'].includes(name)).map(([name, message]) => <p key={name} className="mr-field-error" role="alert">{message}</p>)}
    {!batch && <div className="mr-actions"><button type="button" className="mr-button mr-button--primary" disabled={c.saving || c.recovering || c.needsReconcile || !c.listFresh || !!draft?.reviewRequired} aria-busy={c.saving} onClick={() => void c.save(false, key)}>{c.saving ? 'Đang lưu…' : item.readingId ? 'Lưu cập nhật' : 'Lưu chỉ số'}</button><button type="button" className="mr-button" disabled={c.saving || c.recovering} onClick={() => c.discard(key)}>Hủy nhập</button></div>}
  </div>;
}
function MeterWorkbench({ route, onNavigate, registerGuard, onSessionExpired }: { route: MeterRoute; onNavigate: (url: string) => void; registerGuard: NavigationGuardRegistration; onSessionExpired: (message?: string) => void }) {
  const c = useMeterReadings({ route, registerGuard, onSessionExpired });
  const root = useRef<HTMLElement>(null), opener = useRef<HTMLElement | null>(null), previousEditor = useRef<string | null>(null);
  const [locating, setLocating] = useState(false);
  const navigate = (patch: Partial<MeterRoute>) => onNavigate(meterUrl({ ...route, ...patch }));
  useEffect(() => { const old = document.title; document.title = 'Ghi và kiểm tra chỉ số | RentOps'; return () => { document.title = old; }; }, []);
  useEffect(() => {
    if (c.activeKey && previousEditor.current !== c.activeKey) root.current?.querySelector<HTMLElement>('.mr-editor input:not(:disabled)')?.focus();
    if (!c.activeKey && previousEditor.current && opener.current?.isConnected) opener.current.focus();
    previousEditor.current = c.activeKey;
  }, [c.activeKey]);
  useEffect(() => { if (c.notice?.kind === 'error') root.current?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)')?.focus(); }, [c.notice, c.drafts]);
  const busy = c.saving || c.recovering || locating;
  const selectedCount = Object.values(c.drafts).filter((d) => d.selected && !d.item.readingId).length;
  async function goToPending(roomId: string, view: MeterView) {
    if (busy) return;
    const current = c.makeGuard(); setLocating(true);
    try {
      const all = await getAllMeterItems(meterScope(route));
      if (!current()) return;
      const missing = c.progress?.pendingRooms.find((r) => r.roomId === roomId)?.missingRequirementIds || [];
      const index = all.findIndex((i) => i.roomId === roomId && missing.includes(i.requirementId));
      if (index < 0) { c.setNotice({ kind: 'info', message: 'Dữ liệu đã thay đổi. Tải lại tiến độ để kiểm tra phòng còn thiếu.' }); return; }
      navigate({ view, page: Math.floor(index / 20), readingId: null });
    } catch (e) { if (e instanceof MeterApiError && e.status === 401) c.handleFatal(e); else if (current() && !isMeterAbort(e) && !c.handleFatal(e)) c.setNotice({ kind: 'error', message: m.readFailure }); }
    finally { setLocating(false); }
  }
  if (route.invalid) return <section className="mr-page"><h1>Ghi và kiểm tra chỉ số</h1><p role="alert">Đường dẫn hoặc phạm vi không hợp lệ. Vui lòng lựa chọn lại.</p><button type="button" className="mr-button" onClick={() => onNavigate('/meter-readings')}>Chọn lại phạm vi</button></section>;
  if (c.fatal) return <section className="mr-page"><h1>Ghi và kiểm tra chỉ số</h1><p className="mr-notice mr-notice--error" role="alert">{c.fatal}</p><button type="button" className="mr-button" onClick={() => onNavigate('/meter-readings')}>Chọn lại phạm vi</button></section>;
  return <section className="mr-page" ref={root} aria-labelledby="mr-title">
    <header className="mr-header"><div><h1 id="mr-title">Ghi và kiểm tra chỉ số</h1><p>Đối chiếu nguồn, ghi theo kỳ, theo dõi phòng còn thiếu.</p></div><button type="button" className="mr-button" disabled={busy || (!route.periodIds.length && !route.readingId)} onClick={() => void (c.needsReconcile ? c.reconcile() : c.refresh())}>{c.recovering ? 'Đang đối chiếu…' : c.needsReconcile ? 'Tải lại để đối chiếu' : 'Tải lại dữ liệu'}</button></header>
    {route.readingId ? <button type="button" className="mr-button" disabled={busy} onClick={() => navigate({ readingId: null })}>Về danh sách chỉ số</button> : <ScopePicker route={route} navigate={navigate} c={c} />}
    {!route.readingId && <nav className="mr-views" aria-label="Chế độ ghi chỉ số">{([['single', 'Ghi đơn lẻ'], ['batch', 'Ghi hàng loạt'], ['progress', 'Xem tiến độ']] as const).map(([view, label]) => <a key={view} href={meterUrl({ ...route, view })} aria-current={route.view === view ? 'page' : undefined} onClick={(event) => { event.preventDefault(); if (!busy) navigate({ view }); }}>{label}</a>)}</nav>}
    <div aria-live="polite" aria-atomic="true">{c.notice && <p className={'mr-notice mr-notice--' + c.notice.kind} role={c.notice.kind === 'error' ? 'alert' : 'status'}>{c.notice.message}</p>}</div>
    {c.needsReconcile && <div className="mr-notice mr-notice--info"><p>{m.uncertain} Các mục đã xác nhận lưu được bảo lưu.</p><button type="button" className="mr-button" disabled={busy} onClick={() => void c.reconcile()}>Đối chiếu kết quả thực tế</button></div>}
    {route.periodIds.length > 0 && <section className="mr-progress" aria-labelledby="mr-progress-title"><div className="mr-section-heading"><h2 id="mr-progress-title">Tiến độ toàn phạm vi</h2><span>{route.periodIds.length} kỳ đã chọn</span></div>
      {c.progressLoading && !c.progress ? <Skeleton label="Đang tải tiến độ…" /> : c.progress ? <>
        {!c.progressFresh && <p className="mr-field-help" role="status">{c.progressLoading ? 'Đang tải lại tiến độ…' : 'Tiến độ chưa được cập nhật, đang hiển thị số liệu lần tải trước.'}</p>}
        <dl className={'mr-stats' + (!c.progressFresh ? ' mr-stats--stale' : '')}><div><dt>Phòng cần ghi</dt><dd>{c.progress.required}</dd></div><div><dt>Đã ghi đủ</dt><dd>{c.progress.completed}</dd></div><div><dt>Còn thiếu</dt><dd>{c.progress.pending}</dd></div></dl>
        {c.progressFresh && c.progress.required === 0 && <p className="mr-empty">{m.empty}</p>}
        {c.progressFresh && c.progress.required > 0 && c.progress.pending === 0 && <p role="status">Tất cả phòng đã ghi đủ chỉ số. Bạn vẫn có thể xem hoặc cập nhật bản ghi đủ điều kiện.</p>}
        {route.view === 'progress' && c.progress.pendingRooms.length > 0 && <div className="mr-pending-list"><h3>Phòng còn thiếu chỉ số</h3>{c.progress.pendingRooms.map((room) => <div key={room.roomId} className="mr-pending-row"><div><strong>Phòng {room.roomCode}</strong><span>{room.missingRequirementIds.length} mục còn thiếu</span></div><div className="mr-actions"><button type="button" className="mr-button" disabled={busy || !c.progressFresh} onClick={() => void goToPending(room.roomId, 'single')}>Ghi đơn lẻ phòng {room.roomCode}</button><button type="button" className="mr-button" disabled={busy || !c.progressFresh} onClick={() => void goToPending(room.roomId, 'batch')}>Ghi hàng loạt</button></div></div>)}</div>}
      </> : null}
      {c.progressError && <div className="mr-notice mr-notice--error" role="alert">{c.progressError} {Object.values(c.receipts).some((r) => r.state === 'SAVED') && m.savedReload}<button type="button" className="mr-button" disabled={busy} onClick={() => void c.refresh()}>Tải lại tiến độ</button></div>}
    </section>}
    {(!route.periodIds.length && !route.readingId) ? <p className="mr-empty">Chọn các kỳ đã có để ghi chỉ số hoặc xem tiến độ.</p> : <>
      {c.listError && <div className="mr-notice mr-notice--error" role="alert">{c.listError} {Object.values(c.receipts).some((r) => r.state === 'SAVED') && m.savedReload}<button type="button" className="mr-button" disabled={busy} onClick={() => void c.refresh()}>Tải lại danh sách</button></div>}
      {(route.view !== 'progress' || route.readingId) && <section aria-labelledby="mr-list-title"><div className="mr-section-heading"><h2 id="mr-list-title">{route.readingId ? 'Bản ghi đã lưu' : route.view === 'batch' ? 'Bảng ghi hàng loạt' : 'Chỉ số theo phòng và dịch vụ'}</h2>{c.snapshot && <span>{c.snapshot.total} mục trong phạm vi</span>}</div>
        {c.listLoading && !c.snapshot ? <Skeleton label="Đang tải chỉ số…" /> : c.snapshot && <>
          {!c.listFresh && <p className="mr-field-help" role="status">{c.listLoading ? 'Đang tải lại danh sách…' : 'Danh sách chưa được cập nhật. Tải lại trước khi tiếp tục ghi.'}</p>}
          {c.snapshot.total === 0 && c.listFresh ? <p className="mr-empty">{m.empty}</p> : !c.snapshot.items.length && c.listFresh ? <p>Trang này không còn mục. Hãy quay lại trang trước.</p> : <div className="mr-table-scroll" tabIndex={0} role="region" aria-label="Bảng chỉ số, có thể cuộn ngang"><table className="mr-table"><caption>Mỗi dòng là một phòng, dịch vụ và kỳ riêng. Lượng tiêu thụ hiển thị là kết quả đã lưu.</caption><thead><tr>{route.view === 'batch' && !route.readingId && <th scope="col">Chọn lưu</th>}<th scope="col">Phòng / dịch vụ</th><th scope="col">Kỳ ghi</th><th scope="col">Chỉ số đầu / nguồn</th><th scope="col">Chỉ số cuối</th><th scope="col">Tiêu thụ</th><th scope="col">Trạng thái / thao tác</th></tr></thead><tbody>{c.snapshot.items.map((item) => {
            const key = meterKey(item), draft = c.drafts[key], receipt = c.receipts[key];
            const batch = route.view === 'batch' && !route.readingId, editable = batch && item.canCreate;
            return <Fragment key={key}><tr className={c.activeKey === key ? 'mr-row--editing' : undefined}>
              {batch && <td data-label="Chọn lưu"><label className="mr-row-check"><input type="checkbox" aria-label={`Chọn lưu phòng ${item.roomCode}, ${item.serviceName}, ${range(item)}`} checked={draft?.selected ?? false} disabled={busy || !editable || !c.listFresh || c.needsReconcile || !!draft?.reviewRequired} onChange={(e) => c.change(item, { selected: e.target.checked })} /><span>Chọn</span></label></td>}
              <th scope="row"><strong>Phòng {item.roomCode}</strong><span>{item.buildingName}</span><span>{item.serviceName} ({item.unit})</span></th>
              <td data-label="Kỳ ghi"><span>{range(item)}</span><small>Chu kỳ gốc {day(item.cycleStart)} đến trước {day(item.cycleEnd)}</small></td>
              <td data-label="Chỉ số đầu / nguồn"><strong className="mr-number">{value(item.startIndex)}</strong><span>{item.initialStartAllowed ? 'Cần xác nhận ban đầu' : item.startSource ? meterSourceLabels[item.startSource] : 'Chưa có nguồn hợp lệ'}</span></td>
              <td data-label="Chỉ số cuối">{batch && (editable || !!draft) ? <Fields item={item} draft={draft} c={c} batch /> : <strong className="mr-number">{value(item.endIndex)}</strong>}</td>
              <td data-label="Tiêu thụ"><strong className="mr-number">{value(item.consumption)}</strong>{item.consumption !== null && <span>{item.unit}</span>}</td>
              <td data-label="Trạng thái / thao tác"><span className={'mr-status' + (item.readingId ? ' mr-status--saved' : '')}>{item.readingId ? 'Đã có bản ghi' : 'Chưa ghi'}</span>{receipt && <p className="mr-row-result" role="status"><strong>{resultLabels[receipt.state]}</strong><span>{receipt.message}</span></p>}{block(item) && <p className="mr-field-help">{block(item)}</p>}
                {item.readingId ? route.readingId ? <button type="button" className="mr-button" disabled={busy || !item.canUpdate || !c.listFresh || c.needsReconcile} onClick={(e) => { opener.current = e.currentTarget; c.begin(item); }}>Cập nhật chỉ số</button> : <a className="mr-button" href={meterUrl({ ...route, readingId: item.readingId, view: 'single' })} onClick={(e) => { e.preventDefault(); if (!busy) navigate({ readingId: item.readingId, view: 'single' }); }}>Xem / cập nhật</a>
                : !batch && <button type="button" className="mr-button" disabled={busy || !item.canCreate || !c.listFresh || c.needsReconcile} onClick={(e) => { opener.current = e.currentTarget; c.begin(item); }}>Ghi chỉ số</button>}
              </td>
            </tr>{!batch && c.activeKey === key && draft && <tr className="mr-editor-row"><td colSpan={6}><div className="mr-editor-context"><strong>{item.readingId ? 'Cập nhật' : 'Ghi mới'} {item.serviceName}, phòng {item.roomCode}</strong><span>{range(item)}</span></div><Fields item={item} draft={draft} c={c} batch={false} /></td></tr>}</Fragment>;
          })}</tbody></table></div>}
          {!route.readingId && <Pagination page={route.page} total={c.snapshot.total} busy={busy} label="chỉ số" onPage={(page) => navigate({ page })} />}
        </>}
        {route.view === 'batch' && !route.readingId && <div className="mr-save-bar"><div><strong>{selectedCount} mục đang chọn lưu</strong><span>Chỉ lưu mục đã chọn; ô trống không được tính là 0.</span></div><div className="mr-actions"><button type="button" className="mr-button" disabled={busy} onClick={() => c.discard()}>Hủy nhập chưa lưu</button><button type="button" className="mr-button mr-button--primary" disabled={busy || !c.listFresh || c.needsReconcile} aria-busy={c.saving} onClick={() => void c.save(true)}>{c.saving ? 'Đang lưu từng mục…' : 'Lưu các mục đã chọn'}</button></div></div>}
      </section>}
    </>}
    {Object.keys(c.receipts).length > 0 && <details className="mr-receipts"><summary>Kết quả thao tác trong phiên này ({Object.keys(c.receipts).length} mục)</summary><ul>{Object.entries(c.receipts).map(([key, r]) => <li key={key}><strong>Phòng {r.item.roomCode}, {r.item.serviceName}</strong><span>{range(r.item)}</span><span>{resultLabels[r.state]}: {r.message}</span>{r.item.readingId && <span>Chỉ số cuối: {value(r.item.endIndex)}; tiêu thụ: {value(r.item.consumption)} {r.item.unit}</span>}</li>)}</ul></details>}
  </section>;
}
