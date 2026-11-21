import { createPortal } from 'react-dom';
import { useEffect, useState, type FormEvent } from 'react';
import { invoicePath, invoiceRequest, type InvoiceRole } from '../../services/invoiceApi';
import '../provisional/provisionalCharges.css';
import './invoice.css';
import { CashPayment, type CashResult } from './CashPayment';

type Invoice = {
  id: string; number: string | null; lifecycle: 'DRAFT' | 'ISSUED';
  from_date: string; to_date: string; due_date: string | null; issued_at: string | null;
  room_code: string; building_name: string; customer_name: string;
  total: string | null; paid_amount: string; remaining: string | null;
  payment_status: string | null; is_overdue: boolean;
};
type Line = { name: string; quantity: string | null; unitPrice: string | null; amount: string | null };
type Payment = { id: string; paid_at: string; amount: string; method: string; status: string; receipt_id: string | null };
type Transfer = { status: string; bankName: string; accountNumber: string; accountHolder: string; reference: string; amount: string; png: string | null };
type Detail = { invoice: Invoice; lines: Line[]; payments: Payment[]; transfer: Transfer; missingSnapshot: boolean };
type Location = { building_id: string; building_name: string; room_id: string; room_code: string };
type Page = { items: Invoice[]; page: number; hasNext: boolean };

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const money = (value: string | null) => value == null ? '—' : vnd.format(/^-?\d+$/.test(value) ? BigInt(value) : Number(value));
const date = (value: string | null) => value ? value.slice(0, 10).split('-').reverse().join('/') : '—';
const timestamp = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const statuses: Record<string, string> = {
  UNPAID: 'Chưa thanh toán', PARTIALLY_PAID: 'Đã trả một phần', PAID: 'Đã tất toán',
  CONFIRMED: 'Đã xác nhận', PENDING: 'Đang chờ', VOIDED: 'Đã hủy',
};
const status = (invoice: Invoice) => invoice.lifecycle === 'DRAFT' ? 'Nháp' :
  invoice.total === '0' ? 'Không còn nghĩa vụ thanh toán' : statuses[invoice.payment_status ?? ''] || 'Thiếu dữ liệu';
const message = (error: unknown) => error instanceof Error ? error.message : 'Chưa thể tải dữ liệu hóa đơn.';
const vietnamToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export function InvoicePage({ accountRole, pathname, search }: { accountRole: string; pathname: string; search: string }) {
  const [, , role, id] = pathname.split('/');
  if (accountRole.toLowerCase() !== role || (role !== 'host' && role !== 'customer')) {
    return <section className="pc-page"><p role="alert">Bạn không có quyền truy cập hóa đơn này.</p></section>;
  }
  return <section className="pc-page invoice-page">
    <header className="pc-page-heading"><h1>{role === 'host' ? 'Quản lý hóa đơn' : 'Hóa đơn của tôi'}</h1></header>
    {id ? <InvoiceDetail key={id} role={role} id={id} search={search} /> : <InvoiceList role={role} search={search} />}
  </section>;
}

function useCashPayment() {
  const [target, setTarget] = useState<{id: string; opener: HTMLElement}>();
  const [result, setResult] = useState<CashResult>();
  const [revision, setRevision] = useState(0);
  function open(invoice: Invoice, opener: HTMLElement) {
    setTarget({ id: invoice.id, opener });
  }
  function close() { setTarget(undefined); }
  function success(result: CashResult) {
    setResult(result);
    close();
    setRevision(value => value + 1);
  }
  return { target, result, revision, open, close, success, refresh: () => setRevision(value => value + 1) };
}

function applyCash(invoice: Invoice, result: CashResult): Invoice {
  return { ...invoice, paid_amount: result.paidAmount, remaining: result.remaining,
    payment_status: result.paymentStatus, is_overdue: result.paymentStatus !== 'PAID' && invoice.is_overdue };
}

function mayTakeCash(invoice: Invoice) {
  return invoice.lifecycle === 'ISSUED' && invoice.payment_status !== 'PAID'
    && invoice.remaining != null && /^\d+$/.test(invoice.remaining) && BigInt(invoice.remaining) > 0n;
}

function CashSuccessToast({ result }: { result: CashResult }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  return visible && <div className="invoice-success-toast">
      <span className="invoice-success-icon" aria-hidden="true">✓</span>
      <div>
        <strong>Ghi nhận thanh toán thành công</strong>
        <div>{result.paymentStatus === 'PAID'
          ? 'Hóa đơn đã tất toán.'
          : 'Thanh toán một phần. Còn phải trả ' + money(result.remaining) + '.'}</div>
      </div>
  </div>;
}

function CashFeedback({ result }: { result?: CashResult }) {
  return <>
    {createPortal(<div role="status" className="invoice-success-live">
      {result && <CashSuccessToast key={result.paymentId} result={result} />}
    </div>, document.body)}
    {result && <div className="pc-notice">
    <p>Đã ghi nhận thanh toán tiền mặt. {statuses[result.paymentStatus]}.
      {result.paymentStatus === 'PARTIALLY_PAID' && <> Còn phải trả {money(result.remaining)}.</>}
    </p>
    {result.paymentStatus === 'PAID' && <>
      <button className="pc-button" type="button" onClick={() => window.print()}>In/Xuất phiếu thu</button>
      {createPortal(<article className="cash-payment-receipt" aria-label="Phiếu thu">
        <h1>Phiếu thu tiền mặt</h1>
        <dl>
          <dt>Mã khoản thu</dt><dd>{result.cashEntryId}</dd>
          <dt>Hóa đơn</dt><dd>{result.invoiceNumber}</dd>
          <dt>Số tiền thực nhận</dt><dd>{money(result.amount)}</dd>
          <dt>Thời gian thanh toán</dt><dd>{timestamp(result.paidAt)}</dd>
          <dt>Nguồn tiền mặt</dt><dd>{result.fundName}</dd>
        </dl>
      </article>, document.body)}
    </>}
    </div>}
  </>;
}

function InvoiceList({ role, search }: { role: InvoiceRole; search: string }) {
  const path = invoicePath(role);
  const cash = useCashPayment();
  const [page, setPage] = useState<Page>();
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState('');
  const [locationError, setLocationError] = useState('');
  const filters = new URLSearchParams(search);
  const [building, setBuilding] = useState(filters.get('buildingId') || '');
  const [room, setRoom] = useState(filters.get('roomId') || '');

  useEffect(() => {
    const request = new AbortController();
    invoiceRequest<Page>(path + search, request.signal).then(value => { if (!request.signal.aborted) { setPage(value); setError(''); } }, e => {
      if (!request.signal.aborted) setError(message(e));
    });
    if (role === 'host') {
      invoiceRequest<Location[]>(path + '/locations', request.signal).then(setLocations, e => {
        if (!request.signal.aborted) setLocationError(message(e));
      });
    }
    return () => request.abort();
  }, [path, role, search, cash.revision]);

  const go = (index: number) => {
    const next = new URLSearchParams(search);
    next.set('page', String(index));
    return path + '?' + next.toString();
  };
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const [name, value] of new FormData(event.currentTarget)) {
      if (typeof value === 'string' && value.trim()) next.set(name, value.trim());
    }
    window.location.assign(path + '?' + next.toString());
  }

  const buildings = new Map(locations.map(item => [item.building_id, item.building_name]));
  return <>
    {role === 'host' && <form className="invoice-filters pc-state" onSubmit={filter}>
      <label>Bất động sản<select name="buildingId" value={building} onChange={e => { setBuilding(e.target.value); setRoom(''); }}>
        <option value="">Tất cả</option>{Array.from(buildings, ([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      <label>Phòng<select name="roomId" value={room} onChange={e => setRoom(e.target.value)}>
        <option value="">Tất cả</option>{locations.filter(item => !building || item.building_id === building).map(item =>
          <option key={item.room_id} value={item.room_id}>{item.room_code}{building ? '' : ' · ' + item.building_name}</option>)}
      </select></label>
      <label>Tháng của kỳ<input name="month" type="month" defaultValue={filters.get('month') || ''} /></label>
      <label>Vòng đời<select name="lifecycle" defaultValue={filters.get('lifecycle') || ''}>
        <option value="">Tất cả</option><option value="DRAFT">Nháp</option><option value="ISSUED">Đã phát hành</option>
      </select></label>
      <label>Thanh toán<select name="paymentStatus" defaultValue={filters.get('paymentStatus') || ''}>
        <option value="">Tất cả</option>{['UNPAID', 'PARTIALLY_PAID', 'PAID'].map(value => <option key={value} value={value}>{statuses[value]}</option>)}
      </select></label>
      <label>Hạn thanh toán<select name="overdue" defaultValue={filters.get('overdue') || ''}>
        <option value="">Tất cả</option><option value="true">Quá hạn</option><option value="false">Không quá hạn</option>
      </select></label>
      <div className="invoice-filter-search">
        <label>Tìm hóa đơn<input name="q" maxLength={200} defaultValue={filters.get('q') || ''} placeholder="Số hóa đơn, tên khách, mã thanh toán" /></label>
        <div className="invoice-actions"><button className="pc-button">Lọc</button><a href={path}>Đặt lại bộ lọc</a></div>
      </div>
    </form>}
    <CashFeedback result={cash.result} />
    {cash.target && <CashPayment endpoint={path + '/' + encodeURIComponent(cash.target.id)}
      opener={cash.target.opener} onClose={cash.close} onRefresh={cash.refresh} onSuccess={result => {
        const id = cash.target?.id;
        setPage(current => current && ({ ...current, items: current.items.map(item => item.id === id ? applyCash(item, result) : item) }));
        cash.success(result);
      }} />}
    {locationError && <p role="alert">{locationError}</p>}
    {error && <p className="pc-state" role="alert">{error} <button type="button" onClick={() => window.location.reload()}>Tải lại</button></p>}
    {!page ? !error && <p role="status">Đang tải hóa đơn…</p>
      : !page.items.length ? <p className="pc-state">Không tìm thấy hóa đơn phù hợp.</p>
        : <div className="invoice-table"><table>
          <thead><tr><th>Số hóa đơn</th><th>Phòng</th><th>Kỳ tính tiền</th><th>Tổng tiền</th><th>Hạn thanh toán</th><th>Trạng thái</th>{role === 'host' && <th>Thao tác</th>}</tr></thead>
          <tbody>{page.items.map(item => <tr key={item.id}>
            <td><a href={path + '/' + item.id + search}>{item.number || 'Xem hóa đơn'}</a></td>
            <td>{item.room_code} · {item.building_name}</td><td>{date(item.from_date)} – {date(item.to_date)}</td>
            <td>{money(item.total)}</td><td>{date(item.due_date)}</td><td>{status(item)}{item.is_overdue && <strong className="invoice-overdue">Quá hạn</strong>}</td>
            {role === 'host' && <td>{mayTakeCash(item) && <button type="button" className="pc-button"
              onClick={event => cash.open(item, event.currentTarget)}>Ghi nhận thanh toán tiền mặt</button>}</td>}
          </tr>)}</tbody>
        </table></div>}
    {page && (page.page > 0 || page.hasNext) && <nav aria-label="Trang hóa đơn" className="invoice-actions">
      {page.page > 0 && <a href={go(page.page - 1)}>Trang trước</a>}
      <span>Trang {page.page + 1}</span>{page.hasNext && <a href={go(page.page + 1)}>Trang sau</a>}
    </nav>}
  </>;
}

function InvoiceDetail({ role, id, search }: { role: InvoiceRole; id: string; search: string }) {
  const path = invoicePath(role);
  const endpoint = path + '/' + encodeURIComponent(id);
  const cash = useCashPayment();
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    invoiceRequest<Detail>(endpoint, request.signal).then(value => { if (!request.signal.aborted) { setDetail(value); setError(''); } }, e => {
      if (!request.signal.aborted) setError(message(e));
    });
    return () => request.abort();
  }, [endpoint, loadVersion, cash.revision]);

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const dueDate = new FormData(event.currentTarget).get('dueDate');
    setBusy(true);
    setError('');
    try { setDetail(await invoiceRequest<Detail>(endpoint + '/issue', undefined, { dueDate })); }
    catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }

  const invoice = detail?.invoice;
  return <>
    <div className="invoice-actions">
      <a href={path + search}>Về danh sách</a>
      <button className="pc-button" type="button" disabled={busy} onClick={() => { setError(''); setDetail(undefined); setLoadVersion(v => v + 1); }}>Tải lại</button>
    </div>
    <CashFeedback result={cash.result} />
    {cash.target && <CashPayment endpoint={endpoint} opener={cash.target.opener} onClose={cash.close} onRefresh={cash.refresh}
      onSuccess={result => {
        setDetail(current => current && ({
          ...current, invoice: applyCash(current.invoice, result),
          payments: [{ id: result.paymentId, amount: result.amount, paid_at: result.paidAt, method: 'CASH',
            status: 'CONFIRMED', receipt_id: result.cashEntryId }, ...current.payments.filter(payment => payment.id !== result.paymentId)],
        }));
        cash.success(result);
      }} />}
    {error && <p role="alert" className="pc-notice">{error}</p>}
    {!invoice || !detail ? !error && <p role="status">Đang tải chi tiết hóa đơn…</p> : <>
      <section className="pc-state">
        <h2>{invoice.number || 'Chi tiết hóa đơn'}</h2>
        <p>{invoice.room_code} · {invoice.building_name} · {date(invoice.from_date)} – {date(invoice.to_date)}</p>
        <p>{status(invoice)}{invoice.is_overdue && <strong className="invoice-overdue">Quá hạn</strong>}</p>
        <dl className="invoice-facts">
          <div><dt>Hạn thanh toán</dt><dd>{date(invoice.due_date)}</dd></div>
          {invoice.issued_at && <div><dt>Phát hành</dt><dd>{timestamp(invoice.issued_at)}</dd></div>}
          <div><dt>{invoice.lifecycle === 'DRAFT' ? 'Tạm tính' : 'Tổng tiền'}</dt><dd>{money(invoice.total)}</dd></div>
          {invoice.lifecycle === 'ISSUED' && <>
            <div><dt>Đã thanh toán</dt><dd>{money(invoice.paid_amount)}</dd></div>
            <div><dt>Còn phải trả</dt><dd>{money(invoice.remaining)}</dd></div>
          </>}
        </dl>
        {role === 'host' && mayTakeCash(invoice) && <button type="button" className="pc-button"
          onClick={event => cash.open(invoice, event.currentTarget)}>Ghi nhận thanh toán tiền mặt</button>}
        {role === 'host' && invoice.lifecycle === 'DRAFT' && <form onSubmit={issue} className="invoice-actions">
          <label>Hạn thanh toán <input required type="date" name="dueDate" min={vietnamToday()} /></label>
          <button className="pc-button" disabled={busy}>{busy ? 'Đang phát hành…' : 'Phát hành hóa đơn'}</button>
        </form>}
      </section>
      <section className="pc-state"><h2>Dòng chi phí</h2>{detail.missingSnapshot ? <p>Chứng từ đã phát hành thiếu dữ liệu lưu trữ.</p>
        : <div className="invoice-table"><table>
          <thead><tr><th>Khoản phí</th><th>Số lượng / tỷ lệ</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
          <tbody>{detail.lines.map((line, index) => <tr key={index}><td>{line.name}</td><td>{line.quantity ?? '—'}</td>
            <td>{money(line.unitPrice)}</td><td>{line.amount === null ? 'Thiếu dữ liệu' : money(line.amount)}</td></tr>)}</tbody>
        </table></div>}</section>
      <section className="pc-state"><h2>Lịch sử thanh toán</h2>{!detail.payments.length ? <p>Chưa ghi nhận đợt thanh toán nào cho hóa đơn này.</p>
        : <div className="invoice-table"><table>
          <thead><tr><th>Thời điểm</th><th>Số tiền</th><th>Phương thức</th><th>Trạng thái</th><th>Mã phiếu thu</th></tr></thead>
          <tbody>{detail.payments.map(payment => <tr key={payment.id}><td>{timestamp(payment.paid_at)}</td><td>{money(payment.amount)}</td>
            <td>{payment.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</td><td>{statuses[payment.status]}</td><td>{payment.receipt_id || '—'}</td></tr>)}</tbody>
        </table></div>}</section>
      <TransferPanel key={detail.transfer.status + ':' + detail.transfer.amount} transfer={detail.transfer} number={invoice.number || invoice.id} />
    </>}
  </>;
}

function TransferPanel({ transfer, number }: { transfer: Transfer; number: string }) {
  const [feedback, setFeedback] = useState('');
  const [imageError, setImageError] = useState(false);
  const notes: Record<string, string> = {
    DRAFT: 'Hóa đơn nháp chưa được phát hành để thanh toán.',
    SETTLED: 'Hóa đơn không còn số tiền phải thanh toán.',
    CASH_ONLY: 'Phòng áp dụng tiền mặt. Vui lòng thanh toán trực tiếp cho chủ nhà.',
    MISSING_INSTRUCTIONS: 'Thông tin tài khoản nhận chưa đầy đủ. Vui lòng liên hệ chủ nhà.',
  };
  const png = transfer.png && !imageError ? 'data:image/png;base64,' + transfer.png : null;
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setFeedback('Đã sao chép vào bộ nhớ tạm.'); }
    catch { setFeedback('Chưa thể sao chép tự động. Bạn có thể chọn và sao chép nội dung trên màn hình.'); }
  }
  return <section className="pc-state">
    <h2>Hướng dẫn thanh toán</h2>
    {notes[transfer.status] ? <p>{notes[transfer.status]}</p> : <div className="invoice-transfer">
      <div>{png ? <>
        <img src={png} width="240" height="240" alt="VietQR chuyển khoản cho hóa đơn" onError={() => setImageError(true)} />
        <a download={number + '-VietQR.png'} href={png}>Tải ảnh QR</a>
      </> : <p>Chưa thể hiển thị mã QR. Bạn có thể chuyển khoản bằng thông tin bên cạnh.</p>}</div>
      <div><p>{transfer.bankName} · {transfer.accountHolder}</p>
        <dl className="invoice-facts">
          <div><dt>Số tài khoản</dt><dd>{transfer.accountNumber} <button className="pc-button" onClick={() => void copy(transfer.accountNumber)}>Sao chép số tài khoản</button></dd></div>
          <div><dt>Số tiền</dt><dd>{money(transfer.amount)} <button className="pc-button" onClick={() => void copy(String(transfer.amount))}>Sao chép số tiền</button></dd></div>
          <div><dt>Nội dung</dt><dd>{transfer.reference} <button className="pc-button" onClick={() => void copy(transfer.reference)}>Sao chép nội dung</button></dd></div>
        </dl>
        <p>Kiểm tra tài khoản nhận, số tiền và nội dung trước khi xác nhận trong ứng dụng ngân hàng.</p>
        <p role="status">{feedback}</p>
      </div>
    </div>}
  </section>;
}
