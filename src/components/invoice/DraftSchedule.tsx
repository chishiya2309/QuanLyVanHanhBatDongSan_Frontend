import { useEffect, useState, type FormEvent } from 'react';
import { createDraft, createDraftBatch, getDraftDefaults, listDraftSchedule, previewDraftBatch, setPaymentTerm,
  type BatchItem, type Period } from '../../services/invoiceDraftApi';

import { draftDate, draftError, today } from './invoiceDraftFormat';
const labels: Record<string, string> = {UPCOMING:'Chưa đến kỳ', DUE:'Đến kỳ', OVERDUE:'Quá hạn lập', DRAFT:'Có hóa đơn nháp',
  ISSUED:'Đã phát hành', READY:'Sẵn sàng', NEEDS_ATTENTION:'Cần xử lý', EXISTS:'Đã có hóa đơn', FAILED:'Thất bại',
  COMPLETE:'Tính đầy đủ', INCOMPLETE:'Thiếu dữ liệu', INVALID:'Dữ liệu bất thường'};
const scheduleUrl = (params: URLSearchParams) => '/invoices/host?' + params;
const draftDetailUrl = (id: string, search: string) => '/invoices/host/' + encodeURIComponent(id) + search;

export function DraftSchedule({search}: {search: string}) {
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

  useEffect(() => {
    const ac = new AbortController();
    const filters = new URLSearchParams(search);
    filters.delete('view');
    listDraftSchedule(filters, ac.signal).then(setRows, error => {if (!ac.signal.aborted) setError(draftError(error));});
    return () => ac.abort();
  }, [search, revision]);
  useEffect(() => {
    const ac = new AbortController();
    listDraftSchedule(new URLSearchParams(), ac.signal).then(setLocations, () => {});
    return () => ac.abort();
  }, []);

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
    setRevision(value => value + 1);
  }

  return <section className="pc-state invoice-drafts">
    <h2>Lịch lập hóa đơn</h2>
    <form onSubmit={filter} className="invoice-filters">
      <label>Tòa nhà<select name="buildingId" defaultValue={params.get('buildingId') ?? ''}><option value="">Tất cả</option>
        {[...new Map(locations.map(row => [row.building_id, row.building_name]))].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Phòng<select name="roomId" defaultValue={params.get('roomId') ?? ''}><option value="">Tất cả</option>
        {[...new Map(locations.map(row => [row.room_id, row])).values()].map(row => <option key={row.room_id} value={row.room_id}>{row.room_code} ({row.building_name})</option>)}</select></label>
      <label>Từ ngày<input type="date" name="from" defaultValue={params.get('from') ?? ''}/></label>
      <label>Đến ngày<input type="date" name="to" defaultValue={params.get('to') ?? ''}/></label>
      <label>Trạng thái<select name="status" defaultValue={params.get('status') ?? ''}><option value="">Tất cả</option>
        {['UPCOMING','DUE','OVERDUE','DRAFT','ISSUED','COMPLETE','INCOMPLETE','INVALID'].map(key => <option key={key} value={key}>{labels[key]}</option>)}</select></label>
      <button className="pc-button" disabled={busy}>Lọc</button>
    </form>
    {error && <p role="alert">{error} {!rows && <button type="button" onClick={() => {setError(''); setRevision(v => v + 1);}}>Thử lại</button>}</p>}
    {busy && <p role="status">Đang xử lý…</p>}
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
        <button type="button" disabled={busy} onClick={() => setSingle(undefined)}>Đóng thông tin kỳ</button>
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
            onChange={e => setSelected(ids => e.target.checked ? [...new Set([...ids, item.periodId])] : ids.filter(id => id !== item.periodId))}/>}
            {rows?.find(row => row.period_id === item.periodId)?.room_code ?? item.periodId} {item.message}
            {item.invoiceId && <> <a href={draftDetailUrl(item.invoiceId, search)}>Mở hóa đơn</a></>}
          </li>)}</ul>}</div>;
      })}
      <button disabled={busy || !results.some(item => item.status === 'FAILED' && selected.includes(item.periodId))}
        onClick={() => void run(async () => setPreview(await previewDraftBatch(results.filter(item => item.status === 'FAILED' && selected.includes(item.periodId)).map(item => item.periodId))))}>Xem trước các kỳ thử lại</button>
    </section>}
    <div className="invoice-actions"><span role="status">Đã chọn {selected.length}/100 kỳ</span>
      <button className="pc-button" disabled={!selected.length || busy || !!preview} onClick={() => void run(async () => setPreview(await previewDraftBatch(selected)))}>Xem trước lập hàng loạt</button></div>
    {!rows ? !error && <p role="status">Đang tải kỳ tính tiền…</p> : !rows.length ? <p>Không có kỳ tính tiền phù hợp. Hãy đổi bộ lọc.</p> :
      <div className="invoice-table" tabIndex={0} aria-label="Các kỳ tính tiền"><table>
        <thead><tr><th>Chọn</th><th>Phòng</th><th>Kỳ tính phí</th><th>Ngày dự kiến lập</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.period_id}>
          <td><input type="checkbox" aria-label={'Chọn ' + row.room_code + ' ' + row.from_date} checked={selected.includes(row.period_id)}
            disabled={busy || !!preview || (!selected.includes(row.period_id) && selected.length >= 100)}
            onChange={event => setSelected(ids => event.target.checked ? [...ids, row.period_id] : ids.filter(id => id !== row.period_id))}/></td>
          <td>{row.room_code}<br/>{row.building_name}</td><td>{draftDate(row.from_date)} đến trước {draftDate(row.to_date)}</td><td>{draftDate(row.scheduledBillingDate)}</td>
          <td>{labels[row.scheduleStatus] ?? row.scheduleStatus}</td><td>{row.invoice_id ? <a href={draftDetailUrl(row.invoice_id, search)}>Mở hóa đơn</a> :
            <button type="button" disabled={busy || row.status !== 'OPEN'} onClick={() => openPeriod(row.period_id)}>Lập nháp</button>}</td>
        </tr>)}</tbody></table></div>}
  </section>;
}
