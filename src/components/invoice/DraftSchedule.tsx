import { useEffect, useState, type FormEvent } from 'react';
import { createDraft, createDraftBatch, getDraftDefaults, listDraftSchedule, previewDraftBatch, setPaymentTerm,
  type BatchItem, type Period } from '../../services/invoiceDraftApi';
import {
  billingSchedulePath, matchDraftPeriods, readDraftHandoff, type DraftHandoff,
} from '../../utils/billingScheduleNavigation';
import { BillingCycleSegments } from './BillingSchedulePage';
import { draftDate, draftError, today } from './invoiceDraftFormat';
const labels: Record<string, string> = {UPCOMING:'Chưa đến kỳ', DUE:'Đến kỳ', OVERDUE:'Quá hạn lập', DRAFT:'Có hóa đơn nháp',
  ISSUED:'Đã phát hành', READY:'Sẵn sàng', NEEDS_ATTENTION:'Cần xử lý', EXISTS:'Đã có hóa đơn', FAILED:'Thất bại',
  COMPLETE:'Tính đầy đủ', INCOMPLETE:'Thiếu dữ liệu', INVALID:'Dữ liệu bất thường'};
const scheduleUrl = (params: URLSearchParams) => '/invoices/host?' + params;
const draftDetailUrl = (id: string, search: string) => '/invoices/host/' + encodeURIComponent(id) + search;
const draftBatchLimit = 100;

export function DraftSchedule({ search, accountId }: { search: string; accountId?: string }) {
  const token = new URLSearchParams(search).get('handoff');
  const [handoff] = useState(() => token === null ? null : readDraftHandoff(token, accountId));
  if (token !== null && !handoff) return <section className="pc-state invoice-drafts">
    <h2>Lập hóa đơn nháp</h2>
    <p role="alert">Thông tin kỳ chuyển sang đã hết hạn hoặc không còn khả dụng.</p>
    <a href={billingSchedulePath}>Quay lại lịch lập hóa đơn</a>
  </section>;
  return <DraftScheduleWorkspace search={search} handoff={handoff} />;
}

function DraftScheduleWorkspace({ search, handoff }: { search: string; handoff: DraftHandoff | null }) {
  const [rows, setRows] = useState<Period[]>();
  const [locations, setLocations] = useState<Period[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [single, setSingle] = useState<Period>();
  const [due, setDue] = useState('');
  const [term, setTerm] = useState('');
  const [editTerm, setEditTerm] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewDraftBatch>>>();
  const [results, setResults] = useState<BatchItem[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const params = new URLSearchParams(search);
  const keys = ['buildingId','roomId','from','to','status'] as const;
  const matches = handoff && rows ? matchDraftPeriods(handoff.cycles, rows) : [];
  const batchIds = handoff?.mode === 'batch'
    ? [...new Set(matches.flatMap(match => match.period ? [match.period.period_id] : []))]
    : [];
  const groups = Array.from({ length: Math.ceil(batchIds.length / draftBatchLimit) }, (_, index) =>
    batchIds.slice(index * draftBatchLimit, (index + 1) * draftBatchLimit));
  const completed = new Set(results?.map(item => item.periodId));
  const missing = matches.filter(match => match.reason);

  useEffect(() => {
    const ac = new AbortController();
    const filters = new URLSearchParams(handoff ? '' : search);
    filters.delete('view');
    void listDraftSchedule(filters, ac.signal).then(async periods => {
      if (ac.signal.aborted) return;
      if (handoff?.mode === 'single') {
        const match = matchDraftPeriods(handoff.cycles, periods)[0];
        if (match.period) {
          const defaults = await getDraftDefaults(match.period.period_id, ac.signal);
          if (ac.signal.aborted) return;
          setSingle(defaults);
          setDue(defaults.suggestedDueDate ?? '');
          setTerm(defaults.payment_term_days?.toString() ?? '');
        }
      }
      setRows(periods);
    }).catch(error => { if (!ac.signal.aborted) setError(draftError(error)); });
    return () => ac.abort();
  }, [handoff, search, revision]);
  useEffect(() => {
    if (handoff) return;
    const ac = new AbortController();
    listDraftSchedule(new URLSearchParams(), ac.signal).then(setLocations, () => {});
    return () => ac.abort();
  }, [handoff]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (error) { setError(draftError(error)); }
    finally { setBusy(false); }
  }

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const next = new URLSearchParams({view: 'schedule'});
    for (const key of keys) {
      const value = values.get(key);
      if (typeof value === 'string' && value) next.set(key, value);
    }
    window.location.assign(scheduleUrl(next));
  }

  function openPeriod(id: string) {
    void run(async () => {
      const data = await getDraftDefaults(id);
      setSingle(data); setDue(data.suggestedDueDate ?? '');
      setTerm(data.payment_term_days?.toString() ?? ''); setEditTerm(false);
    });
  }

  async function submitBatch() {
    if (!preview) return;
    const result = await createDraftBatch(preview.map(item => item.periodId));
    setResults(previous => [...new Map([...(previous ?? []), ...result.items].map(
      item => [item.periodId, item])).values()]); setPreview(undefined); setSelected([]);
    if (!handoff) setRevision(value => value + 1);
  }

  return <section className="pc-state invoice-drafts">
    <h2>{handoff ? 'Lập hóa đơn nháp' : 'Lịch lập hóa đơn'}</h2>
    {handoff && <a href={billingSchedulePath + (handoff.search ? '?' + handoff.search : '')}>Quay lại lịch lập hóa đơn</a>}
    {!handoff && <form onSubmit={filter} className="invoice-filters">
      <label>Tòa nhà<select name="buildingId" defaultValue={params.get('buildingId') ?? ''}><option value="">Tất cả</option>
        {[...new Map(locations.map(row => [row.building_id, row.building_name]))].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Phòng<select name="roomId" defaultValue={params.get('roomId') ?? ''}><option value="">Tất cả</option>
        {[...new Map(locations.map(row => [row.room_id, row])).values()].map(row => <option key={row.room_id} value={row.room_id}>{row.room_code} ({row.building_name})</option>)}</select></label>
      <label>Từ ngày<input type="date" name="from" defaultValue={params.get('from') ?? ''}/></label>
      <label>Đến ngày<input type="date" name="to" defaultValue={params.get('to') ?? ''}/></label>
      <label>Trạng thái<select name="status" defaultValue={params.get('status') ?? ''}><option value="">Tất cả</option>
        {['UPCOMING','DUE','OVERDUE','DRAFT','ISSUED','COMPLETE','INCOMPLETE','INVALID'].map(key => <option key={key} value={key}>{labels[key]}</option>)}</select></label>
      <button className="pc-button" disabled={busy}>Lọc</button>
    </form>}
    {error && <p role="alert">{error} {!rows && <button type="button" onClick={() => {setError(''); setRevision(v => v + 1);}}>Thử lại</button>}</p>}
    {busy && <p role="status">Đang xử lý…</p>}
    {handoff && !rows && !error && <p role="status">Đang đối chiếu kỳ tính tiền…</p>}
    {handoff && (handoff.mode === 'single' || missing.length > 0) && (
      <section className="billing-handoff-summary" aria-label="Kỳ chuyển từ lịch lập hóa đơn">
        <h3>{handoff.mode === 'single' ? 'Kỳ đã chọn' : 'Kỳ cần kiểm tra'}</h3>
        <ul>{(handoff.mode === 'single' ? [{ cycle: handoff.cycles[0], reason: matches[0]?.reason }] : missing)
          .map(({ cycle, reason }) => <li key={cycle.contractId}>
            <strong>{cycle.roomName ?? 'Phòng chưa xác định'}</strong>{cycle.propertyName && <> ({cycle.propertyName})</>}
            <p>Hợp đồng {cycle.contractId}</p>
            <p>{draftDate(cycle.cycleStart)} đến {draftDate(cycle.cycleEnd)}</p>
            {cycle.hasRoomTransferInCycle && <BillingCycleSegments segments={cycle.cycleSegments} />}
            {reason && <p>{reason}</p>}
          </li>)}</ul>
      </section>
    )}
    {single && <section aria-label="Thông tin tạo nháp">
      <h3>{single.invoice_id ? 'Kỳ đã có hóa đơn' : 'Xác nhận tạo hóa đơn nháp'}</h3>
      <dl className="invoice-facts">
        <div><dt>Phòng và tòa nhà</dt><dd>{single.room_code}, {single.building_name}</dd></div>
        <div><dt>Người thuê</dt><dd>{single.customer_name}</dd></div>
        <div><dt>Hợp đồng</dt><dd>{single.contract_id}</dd></div>
        <div><dt>Chu kỳ chuẩn</dt><dd>{draftDate(single.cycle_start)} đến trước {draftDate(single.cycle_end)}</dd></div>
        <div><dt>Khoảng tính phí</dt><dd>{draftDate(single.from_date)} đến trước {draftDate(single.to_date)}</dd></div>
        <div><dt>Ngày dự kiến lập</dt><dd>{draftDate(single.scheduledBillingDate)}</dd></div>
      </dl>
      {single.invoice_id ? <a href={draftDetailUrl(single.invoice_id, search)}>Mở hóa đơn hiện có</a> :
        <form className="invoice-actions" onSubmit={event => {event.preventDefault(); void run(async () => {
          const result = await createDraft(single.period_id, due);
          if (!result.invoiceId) throw new Error(result.message ?? 'Chưa tạo được nháp.');
          const next = new URLSearchParams(search);
          if (result.status === 'EXISTS') next.set('existing', '1');
          window.location.assign(draftDetailUrl(result.invoiceId, '?' + next));
        });}}>
          <label>Hạn thanh toán <input type="date" required={!!single.suggestedDueDate} value={due} disabled={busy} onChange={event => setDue(event.target.value)}/></label>
          {due && due < today() && <span role="status">Hạn đã qua. Cần xác nhận hoặc đổi hạn trước khi phát hành.</span>}
          <button className="pc-button" disabled={busy}>Xác nhận tạo nháp</button>
        </form>}
      <div className="invoice-actions">
        <button type="button" disabled={busy} onClick={() => setEditTerm(open => !open)}>Cài thời hạn</button>
        {!handoff && <button type="button" disabled={busy} onClick={() => setSingle(undefined)}>Đóng thông tin kỳ</button>}
      </div>
      {editTerm && <form className="invoice-actions" onSubmit={event => {event.preventDefault(); void run(async () => {
        await setPaymentTerm(single.contract_id, term === '' ? null : Number(term));
        const next = await getDraftDefaults(single.period_id);
        setSingle(next); setDue(value => value === (single.suggestedDueDate ?? '') ? next.suggestedDueDate ?? '' : value);
        setEditTerm(false);
      });}}>
        <label>Số ngày từ ngày dự kiến lập <input type="number" min="0" max="2147483647" step="1" value={term} onChange={e => setTerm(e.target.value)}/></label>
        <button disabled={busy}>Lưu cấu hình</button>
      </form>}
    </section>}
    {preview && <section aria-label="Xem trước lập hàng loạt">
      <h3>Xem trước {preview.length} kỳ</h3>
      <ul>{preview.map(item => <li key={item.periodId}>
        {rows?.find(row => row.period_id === item.periodId)?.room_code ?? item.periodId} {item.dueDate && '– Hạn ' + item.dueDate}
        {item.invoiceId && <> <a href={draftDetailUrl(item.invoiceId, search)}>Đã có hóa đơn</a></>}
        {item.message && <p>{item.message}</p>}{item.issues.map((issue, index) => <p key={index}>{issue.message}</p>)}
      </li>)}</ul>
      <div className="invoice-actions"><button className="pc-button" disabled={busy} onClick={() => void run(submitBatch)}>Xác nhận lập hàng loạt</button>
        <button disabled={busy} onClick={() => setPreview(undefined)}>Hủy xem trước</button></div>
    </section>}
    {results && <section aria-label="Kết quả lập hàng loạt"><h3>Kết quả lập hàng loạt</h3>
      {(['READY','NEEDS_ATTENTION','EXISTS','FAILED'] as const).map(group => {
        const items = results.filter(item => item.status === group);
        return <div key={group}><h4>{labels[group]} ({items.length})</h4>
          {!!items.length && <ul>{items.map(item => <li key={item.periodId}>{group === 'FAILED' && <input type="checkbox"
            aria-label={'Thử lại kỳ ' + item.periodId} checked={selected.includes(item.periodId)}
            disabled={busy || !!preview || (!selected.includes(item.periodId) && selected.length >= draftBatchLimit)}
            onChange={e => setSelected(ids => e.target.checked ? [...new Set([...ids, item.periodId])] : ids.filter(id => id !== item.periodId))}/>}
            {rows?.find(row => row.period_id === item.periodId)?.room_code ?? item.periodId} {item.message}
            {item.invoiceId && <> <a href={draftDetailUrl(item.invoiceId, search)}>Mở hóa đơn</a></>}
          </li>)}</ul>}</div>;
      })}
      <button disabled={busy || !!preview || !results.some(item => item.status === 'FAILED' && selected.includes(item.periodId))}
        onClick={() => void run(async () => setPreview(await previewDraftBatch(results.filter(item => item.status === 'FAILED' && selected.includes(item.periodId)).map(item => item.periodId))))}>Xem trước các kỳ thử lại</button>
    </section>}
    {handoff?.mode === 'batch' && rows && batchIds.length > 0 && <section aria-label="Các nhóm lập hóa đơn nháp">
      <h3>{batchIds.length} kỳ đã đối chiếu</h3>
      <ul>{groups.map((ids, index) => {
        const remaining = ids.filter(id => !completed.has(id));
        return <li key={ids[0]}>
          <button type="button" disabled={busy || !!preview || !remaining.length}
            onClick={() => void run(async () => setPreview(await previewDraftBatch(remaining)))}>
            {remaining.length ? `Xem trước nhóm ${index + 1} (${remaining.length} kỳ)` : `Đã xử lý nhóm ${index + 1}`}
          </button>
        </li>;
      })}</ul>
    </section>}
    {!handoff && <><div className="invoice-actions"><span role="status">Đã chọn {selected.length}/100 kỳ</span>
      <button className="pc-button" disabled={!selected.length || busy || !!preview} onClick={() => void run(async () => setPreview(await previewDraftBatch(selected)))}>Xem trước lập hàng loạt</button></div>
    {!rows ? !error && <p role="status">Đang tải kỳ tính tiền…</p> : !rows.length ? <p>Không có kỳ tính tiền phù hợp. Hãy đổi bộ lọc.</p> :
      <div className="invoice-table" tabIndex={0} aria-label="Các kỳ tính tiền"><table>
        <thead><tr><th>Chọn</th><th>Phòng</th><th>Kỳ tính phí</th><th>Ngày dự kiến lập</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.period_id}>
          <td><input type="checkbox" aria-label={'Chọn ' + row.room_code + ' ' + row.from_date} checked={selected.includes(row.period_id)}
            disabled={busy || !!preview || (!selected.includes(row.period_id) && selected.length >= draftBatchLimit)}
            onChange={event => setSelected(ids => event.target.checked ? [...ids, row.period_id] : ids.filter(id => id !== row.period_id))}/></td>
          <td>{row.room_code}<br/>{row.building_name}</td><td>{draftDate(row.from_date)} đến trước {draftDate(row.to_date)}</td><td>{draftDate(row.scheduledBillingDate)}</td>
          <td>{labels[row.scheduleStatus] ?? row.scheduleStatus}</td><td>{row.invoice_id ? <a href={draftDetailUrl(row.invoice_id, search)}>Mở hóa đơn</a> :
            <button type="button" disabled={busy || row.status !== 'OPEN'} onClick={() => openPeriod(row.period_id)}>Lập nháp</button>}</td>
        </tr>)}</tbody></table></div>}</>}
  </section>;
}
