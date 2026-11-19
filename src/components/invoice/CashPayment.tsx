import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LosslessNumber } from 'lossless-json';
import { invoiceRequest } from '../../services/invoiceApi';
import { AuthApiError } from '../../services/authErrors';
import './cashPayment.css';

type Context = { invoiceNumber: string; roomCode: string; total: string; paidAmount: string; remaining: string; defaultFundingSourceId: string | null; paidAt: string };
type Fund = { id: string; name: string };
export type CashResult = { invoiceNumber?: string; fundName?: string; paymentId: string; cashEntryId: string; amount: string; paidAt: string; paidAmount: string; remaining: string; paymentStatus: 'PAID' | 'PARTIALLY_PAID' };
const fundsPath = '/funding-sources?type=CASH&active=true';
const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const localTime = (iso: string) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short',
}).format(new Date(iso)).replace(' ', 'T');

export function CashPayment({ endpoint, opener, onClose, onRefresh, onSuccess }: {
  endpoint: string; opener: HTMLElement; onClose: () => void; onRefresh: () => void; onSuccess: (result: CashResult) => void;
}) {
  const [context, setContext] = useState<Context>();
  const [funds, setFunds] = useState<Fund[]>([]);
  const [amount, setAmount] = useState('');
  const [fund, setFund] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [field, setField] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const fundInput = useRef<HTMLSelectElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  const request = useRef<AbortController | null>(null);
  const attempt = useRef<{key: string; payload: object} | null>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); if (opener.isConnected) opener.focus(); };
  }, [opener]);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    Promise.all([
      invoiceRequest<Context>(endpoint + '/cash-payment-context', controller.signal),
      invoiceRequest<Fund[]>(fundsPath, controller.signal),
    ]).then(([data, options]) => {
      if (controller.signal.aborted) return;
      setContext(data);
      setFunds(options);
      setAmount(data.remaining);
      setFund(options.some(option => option.id === data.defaultFundingSourceId) ? data.defaultFundingSourceId! : '');
      setDate(localTime(data.paidAt));
      setLoading(false);
    }, cause => {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Chưa thể mở biểu mẫu thanh toán.');
      setLoading(false);
    });
    return () => { request.current?.abort(); };
  }, [endpoint]);

  useEffect(() => {
    if (busy || loading) return;
    ({ amount: amountInput, fund: fundInput, date: dateInput }[field])?.current?.focus();
  }, [busy, field, loading]);

  function invalid(name: string, message: string) {
    setField(name);
    setError(message);

  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current || !context || loading) return;
    if (!uncertain) {
      if (!/^-?\d+$/.test(amount.trim())) {
        invalid('amount', 'Số tiền thanh toán phải là số nguyên VND.');
        return;
      }
      if (BigInt(amount) <= 0n) { invalid('amount', 'Số tiền thanh toán phải lớn hơn 0 đồng.'); return; }
      if (BigInt(amount) > BigInt(context.remaining)) {
        invalid('amount', 'Số tiền thanh toán tiền mặt không được vượt quá số dư nợ còn lại của hóa đơn (tối đa '
          + currency.format(BigInt(context.remaining)) + '). Vui lòng trả lại tiền thừa cho khách và nhập đúng số tiền cần thanh toán.');
        return;
      }
      if (!funds.some(option => option.id === fund)) { invalid('fund', 'Hãy chọn nguồn tiền mặt đang hoạt động.'); return; }
      const time = date === localTime(context.paidAt) ? new Date(context.paidAt) : new Date(date + ':00+07:00');
      if (!Number.isFinite(time.getTime()) || time.getTime() > Date.now()) {
        invalid('date', 'Thời điểm thanh toán phải hợp lệ và không được nằm trong tương lai.');
        return;
      }
      attempt.current = { key: crypto.randomUUID(), payload: {
        amount: new LosslessNumber(BigInt(amount).toString()), expectedRemaining: new LosslessNumber(context.remaining),
        fundingSourceId: fund, paidAt: time.toISOString(), ...(note ? { note } : {}),
      } };
    }
    const command = attempt.current;
    if (!command) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setField('');
    try {
      const result = await invoiceRequest<CashResult>(endpoint + '/cash-payments', undefined, command.payload, command.key);
      setUncertain(false);
      if (request.current?.signal.aborted) return;
      onSuccess({ ...result, invoiceNumber: context.invoiceNumber, fundName: funds.find(option => option.id === fund)?.name });
    } catch (cause) {
      if (!(cause instanceof AuthApiError) || (cause.status >= 200 && cause.status < 300) || (cause.status >= 500 && cause.code !== 'CASH_PAYMENT_PERSISTENCE_FAILURE')) {
        setUncertain(true);
        setError('Chưa xác định được kết quả ghi nhận. Hãy thử lại cùng yêu cầu.');
      } else {
        setUncertain(false);
        attempt.current = null;
        setError(cause.message);
        if (cause.code === 'CASH_PAYMENT_STALE') {
          onRefresh();
          setLoading(true);
          try {
            const refreshed = await invoiceRequest<Context>(endpoint + '/cash-payment-context', request.current?.signal);
            if (request.current?.signal.aborted) return;
            setContext(refreshed);
          } catch (refreshError) {
            setContext(undefined);
            setError(cause.message + ' ' + (refreshError instanceof Error ? refreshError.message : 'Chưa thể tải lại hóa đơn.'));
          } finally { setLoading(false); }
        } else if (cause.code === 'CASH_PAYMENT_SOURCE_INACTIVE') {
          setFund('');
          invalid('fund', cause.message);
          try {
            setFunds(await invoiceRequest<Fund[]>(fundsPath, request.current?.signal));
          } catch (refreshError) {
            setFunds([]);
            setError(refreshError instanceof Error ? refreshError.message : cause.message);
          }
        } else if (['CASH_PAYMENT_EXCEEDS_REMAINING', 'CASH_PAYMENT_INVALID_AMOUNT'].includes(cause.code ?? '')) {
          invalid('amount', cause.message);
        } else if (['CASH_PAYMENT_DRAFT', 'CASH_PAYMENT_SETTLED', 'CASH_PAYMENT_DISABLED'].includes(cause.code ?? '')) {
          setContext(undefined);
        }
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return <dialog ref={dialog} className="cash-payment" aria-labelledby="cash-payment-title" onCancel={event => {
    event.preventDefault();
    if (!sending.current && !uncertain) onClose();
  }}>
    <h2 id="cash-payment-title">Ghi nhận thanh toán tiền mặt</h2>
    {loading && <p role="status">Đang tải dữ liệu thanh toán…</p>}
    {error && <p id="cash-payment-error" role="alert">{error}</p>}
    {context && <form onSubmit={submit} noValidate>
      <p>{context.invoiceNumber}, phòng {context.roomCode}</p>
      <dl className="cash-payment-facts">
        <div><dt>Còn phải trả</dt><dd>{currency.format(BigInt(context.remaining))}</dd></div>
        <div><dt>Tổng tiền</dt><dd>{currency.format(BigInt(context.total))}</dd></div>
        <div><dt>Đã thanh toán</dt><dd>{currency.format(BigInt(context.paidAmount))}</dd></div>
      </dl>
      <fieldset disabled={busy || uncertain}>
        <label>Số tiền thanh toán (VND)<input ref={amountInput} inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value)}
          aria-invalid={field === 'amount'} aria-describedby={field === 'amount' ? 'cash-payment-error' : undefined} /></label>
        <label>Nguồn tiền mặt<select ref={fundInput} value={fund} onChange={event => setFund(event.target.value)}
          aria-invalid={field === 'fund'} aria-describedby={field === 'fund' ? 'cash-payment-error' : undefined}>
          <option value="">Chọn nguồn tiền mặt</option>{funds.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select></label>
        <label>Ngày giờ thanh toán (giờ Việt Nam)<input ref={dateInput} type="datetime-local" value={date} onChange={event => setDate(event.target.value)}
          aria-invalid={field === 'date'} aria-describedby={field === 'date' ? 'cash-payment-error' : undefined} /></label>
        <label>Ghi chú<textarea maxLength={500} value={note} onChange={event => setNote(event.target.value)} /></label>
      </fieldset>
      <div className="invoice-actions">
        <button className="pc-button" disabled={busy || loading || funds.length === 0}>
          {busy ? 'Đang ghi nhận…' : uncertain ? 'Thử lại cùng yêu cầu' : 'Xác nhận thanh toán'}
        </button>
        <button className="pc-button" type="button" disabled={busy || uncertain} onClick={onClose}>Hủy bỏ</button>
      </div>
    </form>}
    {!context && <button className="pc-button" type="button" onClick={onClose}>{loading ? 'Hủy bỏ' : 'Đóng'}</button>}
  </dialog>;
}
