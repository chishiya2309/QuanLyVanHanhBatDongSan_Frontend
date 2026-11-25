import { useEffect, useState, type FormEvent } from 'react';
import { confirmRecalculation, deleteDraft, getDraftDefaults, previewRecalculation, setRentWaiver, updateDraft,
  type DraftLine, type DraftReview, type Manual, type Period, type Preview } from '../../services/invoiceDraftApi';
import { isRecord } from '../../services/assetCodec';
import { AuthApiError } from '../../services/authErrors';
import { periodUsageUrl } from '../../utils/periodUsageNavigation';
import type { NavigationGuardRegistration } from '../../hooks/useServiceCatalog';
import { draftError, today } from './invoiceDraftFormat';

export type DraftContext = {id: string; period_id?: string; room_id?: string; building_id?: string};
type EditableLine = {key: string; value: Manual};
const vnd = new Intl.NumberFormat('vi-VN', {style:'currency', currency:'VND'});
const draftMoney = (value: string | null | undefined) => value == null ? 'Chưa xác định'
  : /^-?\d+$/.test(value) ? vnd.format(BigInt(value)) : value + ' ₫';
const statuses = {COMPLETE:'Tính đầy đủ', INCOMPLETE:'Thiếu dữ liệu', INVALID:'Dữ liệu bất thường'};
const sources: Record<string, string> = {period:'Kỳ và hợp đồng', services:'Dịch vụ', revisions:'Phiên bản giá',
  requirements:'Yêu cầu đo đếm', readings:'Chỉ số công tơ', segments:'Đoạn đo công tơ', usages:'Lượng sử dụng',
  adjustments:'Khoản điều chỉnh', waiver:'Miễn tiền thuê'};
const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const record = (value: unknown) => isRecord(value) ? value : {};
const dateTime = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh'}) : 'Chưa xác định';

function consumption(start: string, end: string) {
  if (!/^\d+(\.\d+)?$/.test(start) || !/^\d+(\.\d+)?$/.test(end)) return 'Chưa xác định';
  const [a, af = ''] = start.split('.'), [b, bf = ''] = end.split('.');
  const scale = Math.max(af.length, bf.length);
  const units = BigInt(b + bf.padEnd(scale, '0')) - BigInt(a + af.padEnd(scale, '0'));
  if (units < 0n) return 'Chưa xác định';
  const digits = units.toString().padStart(scale + 1, '0');
  return scale ? digits.slice(0, -scale) + ('.' + digits.slice(-scale)).replace(/\.?0+$/, '') : digits;
}

export function LineBasis({line, sourceLink}: {line: DraftLine; sourceLink?: string}) {
  const basis = record(line.basis);
  const rate = record(basis.rate), reading = record(basis.reading);
  const context = record(basis.context), waiver = record(basis.waiver);
  const segments = Array.isArray(basis.segments) ? basis.segments.filter(isRecord) : [];
  const single = segments[0] ?? reading;
  const getStart = (item: Record<string, unknown>) => text(item.startIndex ?? item.start_index);
  const getEnd = (item: Record<string, unknown>) => text(item.endIndex ?? item.end_index);
  const details = [
    ['Số ngày tính phí', text(basis.billableDays)], ['Số ngày chu kỳ', text(basis.cycleDays)],
    ['Hệ số phân bổ', text(context.prorateFactor)], ['Đơn vị', text(basis.unit)],
    ['Mốc áp dụng giá', text(rate.basisDate)], ['Nguồn giá', text(rate.pricingSource)],
    ['Phiên bản giá', Array.isArray(rate.revisionIds) ? rate.revisionIds.join(', ') : ''],
    ['Lý do', text(basis.reason ?? waiver.reason)],
    ['Chỉ số đầu', getStart(single)], ['Chỉ số cuối', getEnd(single)],
    ['Lượng tiêu thụ', text(context.consumption ?? basis.consumption)],
  ].filter(([, value]) => value);
  if (!details.length && !segments.length && !sourceLink) return null;
  return <details className="invoice-basis"><summary>Căn cứ tính</summary>
    <dl>{details.map(([name,value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
    {!!segments.length && <details open={segments.length === 1}><summary>{segments.length === 1 ? 'Chi tiết đoạn đo' : 'Xem ' + segments.length + ' đoạn đo'}</summary>
      <ol>{segments.map((item, index) => <li key={index}>
        <strong>{({INITIAL:'Đoạn đầu', RESET:'Đặt lại công tơ', REPLACEMENT:'Thay công tơ'} as Record<string,string>)[text(item.event)] ?? 'Đoạn đo'}</strong>
        <span>{dateTime(item.fromAt ?? item.from_at)} đến {dateTime(item.toAt ?? item.to_at)}</span>
        <span>Đầu {getStart(item) || 'Chưa xác định'} / cuối {getEnd(item) || 'Chưa xác định'} / tiêu thụ {text(item.consumption) || consumption(getStart(item),getEnd(item))}</span>
        {!!item.reason && <span>{text(item.reason)}</span>}
        <span>{item.confirmedAt || item.confirmed_at ? 'Xác nhận lúc ' + dateTime(item.confirmedAt ?? item.confirmed_at) : 'Chưa có thông tin xác nhận'}</span>
      </li>)}</ol>
    </details>}
    {sourceLink && <a href={sourceLink}>Mở dữ liệu nguồn</a>}
    {sourceLink && segments.length > 1 && <p>Có nhiều đoạn đo đã lưu. Màn công tơ hiện hỗ trợ xem bản ghi này.</p>}
  </details>;
}

function makeSourceLink(invoice: DraftContext, line: DraftLine, search: string) {
  if (!invoice.period_id) return undefined;
  const basis = record(line.basis);
  const returnTo = '/invoices/host/' + encodeURIComponent(invoice.id) + search;
  const roomServiceId = text(basis.roomServiceId);
  if (basis.meterReadingPath && roomServiceId) {
    const query = new URLSearchParams({periodIds: invoice.period_id, roomServiceId, returnTo});
    if (invoice.room_id) query.set('roomIds', invoice.room_id);
    if (invoice.building_id) query.set('buildingId', invoice.building_id);
    const readingId = text(record(basis.reading).id);
    return '/meter-readings' + (readingId ? '/' + encodeURIComponent(readingId) : '') + '?' + query;
  }
  if (['QUANTITY','CUSTOM'].includes(text(basis.method)) || ['FEE','DISCOUNT'].includes(text(basis.type))) {
    return periodUsageUrl({periodId: invoice.period_id, roomId: invoice.room_id, buildingId: invoice.building_id,
      tab: basis.method === 'CUSTOM' ? 'custom' : basis.type === 'FEE' ? 'fee' : basis.type === 'DISCOUNT' ? 'discount' : 'quantity'})
      + '&returnTo=' + encodeURIComponent(returnTo);
  }
}

export function DraftEditor({invoice, search, refresh, registerGuard, issue, issuing}: {
  invoice: DraftContext & DraftReview; search: string; refresh: () => void;
  registerGuard?: NavigationGuardRegistration; issue: (event: FormEvent<HTMLFormElement>) => void; issuing: boolean;
}) {
  const [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [due, setDue] = useState(invoice.dueDate ?? '');
  const [past, setPast] = useState(false);
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [period, setPeriod] = useState<Period>();
  const [waiverReason, setWaiverReason] = useState('');
  const [waiverOpen, setWaiverOpen] = useState(false);
  const calculation = invoice.calculation;

  useEffect(() => {
    if (!editing && !waiverReason) return;
    function warn(event: BeforeUnloadEvent) {event.preventDefault(); event.returnValue = '';}
    window.addEventListener('beforeunload', warn);
    registerGuard?.(() => window.confirm('Bỏ các thay đổi chưa lưu?'));
    return () => {window.removeEventListener('beforeunload', warn); registerGuard?.(null);};
  }, [editing, waiverReason, registerGuard]);

  function resetForm() {
    setDue(invoice.dueDate ?? ''); setPast(false); setRemoved([]); setLines([]); setReason('');
  }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {await action();}
    catch (error) {
      setError(draftError(error));
      if (error instanceof AuthApiError && error.status === 409) {setPreview(undefined); refresh();}
    } finally {setBusy(false);}
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = lines.map(line => line.value);
    if ((values.length || removed.length) && !reason.trim()) {setError('Nhập lý do thay đổi dòng phí.'); return;}
    void run(async () => {
      await updateDraft(invoice.id, invoice.version, due, past, values, removed, reason);
      resetForm(); setEditing(false); setNotice('Đã lưu thay đổi.'); refresh();
    });
  }

  function change(key: string, patch: Partial<Manual>) {
    setLines(items => items.map(item => item.key === key ? {...item, value: {...item.value, ...patch}} : item));
  }

  const manual = calculation?.manualLines ?? [];
  return <section className="pc-state invoice-drafts" aria-label="Rà soát hóa đơn nháp">
    <h2>Rà soát hóa đơn nháp</h2>
    <p role="status">{calculation ? statuses[calculation.status] : 'Cần tính lại'}{invoice.isStale && ' — Nguồn đã thay đổi'}</p>
    {invoice.calculationMessage && <p>{invoice.calculationMessage}</p>}
    {!!invoice.changedSources?.length && <p>Nguồn đã đổi: {invoice.changedSources.map(source => sources[source] ?? source).join(', ')}</p>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}{busy && <p role="status">Đang xử lý…</p>}
    <div className="invoice-actions">
      <button className="pc-button" disabled={busy || editing || !!preview} onClick={() => void run(async () => setPreview(await previewRecalculation(invoice.id)))}>Xem trước tính lại</button>
      <button disabled={busy || editing || invoice.requiresRecalculation || !!preview} onClick={() => {resetForm(); setEditing(true);}}>Chỉnh sửa nháp</button>
      {invoice.period_id && <button disabled={busy || editing || !!preview} onClick={() => void run(async () => {
        setPeriod(await getDraftDefaults(invoice.period_id!)); setWaiverOpen(true);
      })}>Miễn tiền thuê của kỳ</button>}
      <button disabled={busy || editing || !!preview} onClick={() => setDeleting(true)}>Xóa nháp</button>
    </div>
    {deleting && <div role="group" aria-label="Xác nhận xóa hóa đơn nháp">
      <p>Xóa nháp sẽ xóa các dòng thủ công của nháp. Dữ liệu nguồn của kỳ vẫn được giữ.</p>
      <button disabled={busy} onClick={() => void run(async () => {await deleteDraft(invoice.id, invoice.version); window.location.assign('/invoices/host' + search);})}>Xác nhận xóa nháp</button>
      <button disabled={busy} onClick={() => setDeleting(false)}>Giữ hóa đơn nháp</button>
    </div>}
    {waiverOpen && period && <form className="invoice-actions" onSubmit={event => {event.preventDefault(); void run(async () => {
      await setRentWaiver(period.period_id, !period.rentWaiver?.active, waiverReason.trim());
      setWaiverOpen(false); setWaiverReason(''); setNotice('Đã cập nhật miễn tiền thuê. Hãy kiểm tra lại kết quả tính.'); refresh();
    });}}>
      <p>{period.rentWaiver?.active ? 'Kỳ đã được miễn tiền thuê.' : 'Kỳ chưa được miễn tiền thuê.'}</p>
      <label>Lý do <input required maxLength={500} value={waiverReason} onChange={event => setWaiverReason(event.target.value)}/></label>
      <button disabled={busy || !waiverReason.trim()}>{period.rentWaiver?.active ? 'Hủy miễn thuê' : 'Miễn tiền thuê'}</button>
      <button type="button" disabled={busy} onClick={() => {setWaiverOpen(false); setWaiverReason('');}}>Đóng</button>
    </form>}
    {preview && <section aria-label="Kết quả dự kiến sau tính lại">
      <h3>Kết quả dự kiến sau tính lại</h3>
      <p>{statuses[preview.calculation.status]}. {preview.calculation.status === 'COMPLETE' ? 'Tổng hóa đơn: ' + draftMoney(preview.calculation.total)
        : 'Tổng tạm tính: ' + draftMoney(preview.calculation.subtotal)}</p>
      <p>{preview.totalDelta == null ? 'Chưa có căn cứ xác định chênh lệch tổng.' : 'Chênh lệch tổng: ' + draftMoney(preview.totalDelta)}</p>
      {!!preview.calculation.issues.length && <ul>{preview.calculation.issues.map((issue, i) => <li key={i}>{issue.message}</li>)}</ul>}
      {preview.changes.length ? <div className="invoice-table"><table><thead><tr><th>Khoản phí</th><th>Thay đổi</th><th>Trước</th><th>Sau</th></tr></thead>
        <tbody>{preview.changes.map(item => <tr key={item.key}><th scope="row">{item.after?.value.name ?? item.before?.value.name}</th>
          <td>{!item.before ? 'Thêm' : !item.after ? 'Xóa' : 'Sửa'}</td><td>{item.before ? draftMoney(item.before.value.amount) : '—'}</td>
          <td>{item.after ? draftMoney(item.after.value.amount) : '—'}</td></tr>)}</tbody></table></div> : <p>Các dòng phí giữ nguyên.</p>}
      <div className="invoice-actions"><button className="pc-button" disabled={busy} onClick={() => void run(async () => {
        await confirmRecalculation(invoice.id, preview); setPreview(undefined); setNotice('Đã lưu kết quả tính lại.'); refresh();
      })}>Xác nhận cập nhật nháp</button><button disabled={busy} onClick={() => setPreview(undefined)}>Hủy xem trước</button></div>
    </section>}
    {editing && <form onSubmit={submit} className="invoice-draft-form">
      <h3>Chỉnh sửa nháp</h3>
      <label>Hạn thanh toán <input type="date" value={due} onChange={e => {setDue(e.target.value); setPast(false);}}/></label>
      {due && due < today() && <label><input type="checkbox" checked={past} onChange={event => setPast(event.target.checked)}/> Xác nhận hạn thanh toán đã qua</label>}
      <ul>{manual.filter(line => !removed.includes(line.id ?? '') && !lines.some(item => item.value.id === line.id)).map(line =>
        <li key={line.id}>{line.name} <button type="button" onClick={() => setLines(items => [...items, {key: line.id!, value: line}])}>Sửa {line.name}</button>
          <button type="button" onClick={() => setRemoved(items => [...items, line.id!])}>Bỏ {line.name}</button></li>)}</ul>
      {lines.map(({key, value}, index) => <fieldset key={key}><legend>Dòng thủ công {index + 1}</legend>
        <label>Tên khoản phí <input required maxLength={255} value={value.name} onChange={e => change(key, {name: e.target.value})}/></label>
        <label>Loại khoản phí <select value={value.kind} onChange={e => change(key, {kind: e.target.value as Manual['kind']})}>
          <option value="FEE">Phụ thu</option><option value="DISCOUNT">Giảm trừ</option><option value="RENT_DISCOUNT">Giảm tiền thuê</option></select></label>
        <label>Cách nhập <select value={value.quantity != null ? 'quantity' : 'amount'} onChange={e => change(key, e.target.value === 'quantity'
          ? {quantity:'', unitPrice:'', amount:undefined} : {amount:'', quantity:undefined, unitPrice:undefined})}>
          <option value="amount">Thành tiền</option><option value="quantity">Số lượng và đơn giá</option></select></label>
        {value.quantity != null ? <><label>Số lượng <input required inputMode="decimal" pattern="[0-9]+([.][0-9]+)?" value={value.quantity} onChange={e => change(key,{quantity:e.target.value})}/></label>
          <label>Đơn giá <input required inputMode="decimal" pattern="[0-9]+([.][0-9]+)?" value={value.unitPrice ?? ''} onChange={e => change(key,{unitPrice:e.target.value})}/></label></> :
          <label>Thành tiền <input required inputMode="decimal" pattern="[0-9]+([.][0-9]+)?" value={value.amount ?? ''} onChange={e => change(key,{amount:e.target.value})}/></label>}
        <button type="button" onClick={() => {setLines(items => items.filter(item => item.key !== key)); if (value.id) setRemoved(items => [...items,value.id!]);}}>Bỏ dòng này</button>
      </fieldset>)}
      <button type="button" onClick={() => setLines(items => [...items, {key: crypto.randomUUID(), value: {name:'',kind:'FEE',amount:''}}])}>Thêm dòng thủ công</button>
      <label>Lý do điều chỉnh <input maxLength={500} required={!!(lines.length || removed.length)} value={reason} onChange={e => setReason(e.target.value)}/></label>
      <div className="invoice-actions"><button className="pc-button" disabled={busy || invoice.requiresRecalculation}>Lưu thay đổi</button>
        <button type="button" disabled={busy} onClick={() => {if (window.confirm('Bỏ các thay đổi chưa lưu?')) {resetForm(); setEditing(false);}}}>Hủy chỉnh sửa</button></div>
    </form>}
    <form onSubmit={issue}><button className="pc-button"
      disabled={!invoice.canIssue || issuing || busy || editing || !!preview || waiverOpen || deleting}>
      {issuing ? 'Đang phát hành…' : 'Phát hành hóa đơn'}</button></form>
    {calculation && <>
      <p className="invoice-draft-total">{calculation.status === 'COMPLETE' ? 'Tổng hóa đơn: ' + draftMoney(calculation.total)
        : 'Tổng tạm tính: ' + draftMoney(calculation.subtotal)}</p>
      <div className="invoice-table" tabIndex={0} aria-label="Dòng chi phí"><table><thead><tr><th>Khoản phí</th><th>Số lượng / tỷ lệ</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
        <tbody>{calculation.lines.map(({key,value}) => <tr key={key}><th scope="row">{value.name}
          {calculation.issues.filter(issue => issue.source === key).map((issue,i) => <p key={i}>{issue.message}</p>)}
          <LineBasis line={value} sourceLink={makeSourceLink(invoice,value,search)}/></th>
          <td>{value.quantity ?? '—'}</td><td>{draftMoney(value.unitPrice)}</td><td>{draftMoney(value.amount)}</td></tr>)}</tbody></table></div>
      {calculation.issues.some(issue => !calculation.lines.some(line => line.key === issue.source)) &&
        <ul>{calculation.issues.filter(issue => !calculation.lines.some(line => line.key === issue.source)).map((issue,i) => <li key={i}>{issue.message}</li>)}</ul>}
    </>}
  </section>;
}
