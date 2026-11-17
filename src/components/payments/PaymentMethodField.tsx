import type { RoomPaymentController } from '../../hooks/useRoomPaymentPolicy';
import { paymentMessages as m } from '../../types/roomPaymentPolicy';

export function PaymentMethodField({ type, controller: c, onManageFunds }: { type: 'CASH' | 'BANK'; controller: RoomPaymentController; onManageFunds: () => void }) {
  const cash = type === 'CASH', flag = cash ? 'allowCash' : 'allowTransfer', field = cash ? 'cashDefaultId' : 'bankDefaultId';
  const enabled = c.draft[flag], id = c.draft[field], label = cash ? 'Tiền mặt' : 'Chuyển khoản';
  const choices = c.choices[type], saved = cash ? c.snapshot?.policy?.cashDefault : c.snapshot?.policy?.bankDefault;
  const selected = choices.rows.find(s => s.id === id), missingChoice = id && !selected;
  const error = c.errors[field], methodError = c.errors[flag];
  const unavailable = saved?.id === id && !saved.active;
  return <fieldset className="rpp-method" disabled={Boolean(c.pending || c.loading || c.blocked || c.uncertain || c.batchOpen)}>
    <legend>{label}</legend>
    <div className="rpp-method-grid">
      <div><label className="rpp-toggle" htmlFor={'rpp-' + flag}>
        <input id={'rpp-' + flag} type="checkbox" role="switch" checked={enabled} aria-invalid={Boolean(methodError)} aria-describedby={'rpp-' + flag + '-help'}
          onChange={e => c.edit(flag, e.target.checked)} onBlur={() => c.validateField(flag)} />Chấp nhận {cash ? 'tiền mặt' : 'chuyển khoản'}
      </label><p className={methodError ? 'rpp-field-error' : 'rpp-help'} id={'rpp-' + flag + '-help'}>{methodError || (enabled ? 'Chọn nơi nhận thanh toán bên cạnh.' : 'Phương thức này không được chấp nhận.')}</p></div>
      <div className="rpp-field"><label htmlFor={'rpp-' + field}>{cash ? 'Nguồn tiền mặt mặc định' : 'Tài khoản ngân hàng mặc định'}{enabled && <span> (bắt buộc)</span>}</label>
        <select id={'rpp-' + field} value={id ?? ''} disabled={!enabled || choices.status === 'loading'} aria-required={enabled} aria-invalid={Boolean(error)} aria-describedby={'rpp-' + field + '-help'}
          onChange={e => c.edit(field, e.target.value || null)} onBlur={() => c.validateField(field)}>
          <option value="">{choices.status === 'loading' ? 'Đang tải nguồn tiền…' : 'Chọn nguồn mặc định'}</option>
          {missingChoice && <option value={id} disabled>{saved?.id === id ? saved.name : 'Nguồn đã chọn'} — {unavailable ? 'Ngừng hoạt động' : choices.status === 'ready' ? 'Không còn hợp lệ' : 'Chưa thể kiểm tra'}</option>}
          {choices.rows.map(s => <option key={s.id} value={s.id}>{s.name}{s.bankDetails ? ` — ${s.bankDetails.bankCode} ${s.bankDetails.accountNumber} — ${s.bankDetails.accountHolder}` : ''}</option>)}
        </select>
        <p id={'rpp-' + field + '-help'} className={error || unavailable && enabled ? 'rpp-field-error' : 'rpp-help'}>{error || (unavailable && enabled ? m.inactive : !enabled ? 'Không gán nguồn cho phương thức đã tắt.' : 'Nguồn phải đang hoạt động và thuộc quyền quản lý của bạn.')}</p>
        {choices.error && <p className="rpp-field-error" role="alert">{choices.error}</p>}
        {choices.status === 'ready' && choices.rows.length === 0 && <p className="rpp-help">Chưa có nguồn {cash ? 'CASH' : 'BANK'} đang hoạt động.</p>}
        <div className="rpp-source-actions"><button className="rpp-button" type="button" disabled={choices.status === 'loading'} onClick={() => c.loadSources(type)}>Tải lại nguồn {cash ? 'tiền mặt' : 'ngân hàng'}</button>
          <button className="rpp-link" type="button" onClick={onManageFunds}>Quản lý nguồn tiền</button></div>
      </div>
    </div>
  </fieldset>;
}
