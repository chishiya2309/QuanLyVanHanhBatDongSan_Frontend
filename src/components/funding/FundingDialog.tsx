import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { NavigationGuardRegistration } from '../../hooks/useServiceCatalog';
import { useFundingDialog } from '../../hooks/useFundingDialog';
import { fundingLabels, fundingMessages as m, fundingTitles, type FundingAction, type FundingFields, type FundingNotice, type FundingSource, type SupportedBank } from '../../types/fundingSource';
export function SourceFacts({ source }: { source: FundingSource }) {
  return <dl className="fs-facts"><div><dt>Tên nguồn tiền</dt><dd>{source.name}</dd></div><div><dt>Loại nguồn</dt><dd>{fundingLabels[source.type]}</dd></div>
    {source.bankDetails && <><div><dt>Ngân hàng</dt><dd>{source.bankDetails.bankCode}</dd></div><div><dt>Số tài khoản</dt><dd className="fs-digits">{source.bankDetails.accountNumber}</dd></div><div><dt>Chủ tài khoản</dt><dd>{source.bankDetails.accountHolder}</dd></div></>}
    <div><dt>Trạng thái</dt><dd>{source.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</dd></div></dl>;
}
export function FundingDialog({ action, sourceId, banks, banksReady, bankError, retryBanks, opener, onClose, onFinished, onFailure, registerGuard }: {
  action: FundingAction; sourceId: string | null; banks: SupportedBank[]; banksReady: boolean; bankError: string | null; retryBanks: () => void;
  opener: RefObject<HTMLElement | null>; onClose: () => void; onFinished: (message: string, kind: FundingNotice['kind']) => void;
  onFailure: (e: unknown) => boolean; registerGuard: NavigationGuardRegistration;
}) {
  const c = useFundingDialog({ action, sourceId, banks, banksReady, onClose, onFinished, onFailure, registerGuard });
  const node = useRef<HTMLDialogElement>(null), focused = useRef(false), focusedAttempt = useRef(0);
  const formAction = action.startsWith('create-') || action === 'edit';
  const isBank = action === 'create-bank' || c.snapshot?.type === 'BANK';
  const locked = !!c.snapshot?.hasTransactions;
  const ready = !c.loading && !c.pending && !c.blocked && (action.startsWith('create-') || !!c.snapshot) && (action !== 'deactivate' || !!c.impact);
  useEffect(() => {
    const dialog = node.current, previous = opener.current || document.activeElement as HTMLElement | null;
    dialog?.showModal(); dialog?.querySelector<HTMLElement>('h2')?.focus();
    const overflow = document.body.style.overflowY; document.body.style.overflowY = 'hidden';
    return () => { dialog?.close(); document.body.style.overflowY = overflow; if (previous?.isConnected && !previous.matches(':disabled')) previous.focus(); else document.getElementById('funding-title')?.focus(); };
  }, [opener]);
  useEffect(() => { if (!c.loading && !focused.current) { focused.current = true; node.current?.querySelector<HTMLElement>(formAction ? 'input:not(:disabled)' : '[data-fs-cancel]')?.focus(); } }, [c.loading, formAction]);
  useEffect(() => {
    if (focusedAttempt.current === c.validationAttempt) return;
    focusedAttempt.current = c.validationAttempt;
    if (Object.values(c.errors).some(Boolean)) node.current?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)')?.focus();
  }, [c.errors, c.validationAttempt]);
  const field = (key: keyof FundingFields, label: string, helper: string, readOnly = false) => <div className="fs-field">
    <label htmlFor={'fs-' + key}>{label}{!readOnly && <span> (bắt buộc)</span>}</label>
    <input id={'fs-' + key} name={key} type="text" inputMode={key === 'accountNumber' ? 'numeric' : undefined} autoComplete="off" value={c.fields[key]}
      readOnly={readOnly} disabled={c.pending || key !== 'name' && !readOnly && !banksReady} aria-required={!readOnly} aria-invalid={!!c.errors[key]} aria-describedby={'fs-help-' + key}
      onChange={e => c.change(key, e.target.value)} onBlur={e => c.change(key, e.currentTarget.value, true)} />
    <p id={'fs-help-' + key} className={c.errors[key] ? 'fs-field-error' : 'fs-help'}>{c.errors[key] || helper}</p>
  </div>;
  return createPortal(<dialog ref={node} className="fs-dialog" aria-labelledby="fs-dialog-title" aria-busy={c.loading || c.pending}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = [...(node.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, a[href]') || [])].filter(el => el.tabIndex >= 0 && el.getClientRects().length > 0);
      if (!controls.length) { event.preventDefault(); node.current?.querySelector<HTMLElement>('h2')?.focus(); return; }
      const first = controls[0], last = controls.at(-1)!;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node.current?.querySelector('h2'))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onCancel={e => { e.preventDefault(); c.cancel(); }} onClick={e => { if (e.target === node.current) { const r = node.current.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) c.cancel(); } }}>
    <header className="fs-dialog-header"><h2 id="fs-dialog-title" tabIndex={-1}>{fundingTitles[action]}</h2><button type="button" className="fs-button fs-close" aria-label="Đóng biểu mẫu" disabled={c.pending} onClick={c.cancel}>×</button></header>
    <div className="fs-dialog-body">
      {c.error && <div className="fs-banner fs-banner--error" role="alert"><p>{c.error}</p></div>}
      {c.loading && <div className="fs-state" role="status"><p>Đang tải thông tin nguồn tiền…</p><div className="fs-skeleton" aria-hidden="true" /></div>}
      {!c.loading && c.blocked && !c.latest && !c.uncertain && <button type="button" className="fs-button" disabled={c.pending} onClick={c.retry}>Tải lại thông tin</button>}
      {c.latest && <section className="fs-review" aria-label="Xem lại dữ liệu thay đổi"><h3>Dữ liệu mới nhất từ hệ thống</h3><SourceFacts source={c.latest} />
        <p>Tên bạn đang nhập: <strong>{c.fields.name || 'Chưa nhập'}</strong></p>
        {!c.latest.hasTransactions && c.fields.accountNumber && <p>Số tài khoản đang nhập: <span className="fs-digits">{c.fields.accountNumber}</span>. Sau khi xem lại, hãy nhập lại thay đổi cần lưu.</p>}
        <button type="button" className="fs-button" onClick={c.review}>Đã xem, dùng dữ liệu mới</button></section>}
      {c.previousDraft && <details className="fs-draft"><summary>Xem thông tin đã nhập trước khi tải lại</summary><p>Tên: {c.previousDraft.name}</p>{c.previousDraft.accountNumber && <p>Số tài khoản: {c.previousDraft.accountNumber}</p>}</details>}
      {c.uncertain ? <section aria-label="Kiểm tra kết quả thao tác"><h3>Chưa xác định kết quả thao tác</h3><p>Không gửi lại yêu cầu. Kiểm tra dữ liệu mới nhất rồi đóng biểu mẫu để xem lại danh sách.</p>
        <button type="button" className="fs-button" disabled={c.pending} onClick={() => void c.verify()}>{c.pending ? 'Đang kiểm tra…' : 'Kiểm tra kết quả'}</button>
        {c.verification && <div role="status"><h3>Dữ liệu kiểm tra từ hệ thống</h3>{c.verification.length ? c.verification.map(s => <SourceFacts key={s.id} source={s} />) : <p>Chưa tìm thấy nguồn khớp thông tin đang nhập. Hãy kiểm tra danh sách trước khi tạo lại.</p>}</div>}
      </section> : formAction && (!c.loading || c.snapshot) ? <form id="fs-form" noValidate onSubmit={e => { e.preventDefault(); if (ready) void c.submit(); }}>
        {c.snapshot && <p className="fs-help">Loại nguồn cố định: <strong>{fundingLabels[c.snapshot.type]}</strong></p>}
        {field('name', 'Tên gợi nhớ nguồn tiền', 'Từ 1–100 ký tự. Tên phải khác các nguồn khác trong tài khoản của bạn.')}
        {isBank && <>
          {locked && <p className="fs-lock-message">{m.bankLocked}</p>}
          {!locked && (bankError || banksReady && !banks.length) && <div className="fs-bank-error" role="alert"><p>{bankError || 'Danh mục ngân hàng chưa có dữ liệu.'}</p><button type="button" className="fs-button" onClick={retryBanks} disabled={c.pending}>Tải lại ngân hàng</button></div>}
          <div className="fs-field"><label htmlFor="fs-bankCode">Ngân hàng{!locked && <span> (bắt buộc)</span>}</label>
            {locked ? <input id="fs-bankCode" name="bankCode" value={c.fields.bankCode} readOnly /> : <select id="fs-bankCode" name="bankCode" value={c.fields.bankCode}
              disabled={!banksReady || c.pending} aria-required="true" aria-invalid={!!c.errors.bankCode} aria-describedby="fs-help-bankCode" onChange={e => c.change('bankCode', e.target.value)} onBlur={e => c.change('bankCode', e.currentTarget.value, true)}>
              <option value="">{banksReady ? 'Chọn ngân hàng' : 'Đang tải ngân hàng…'}</option>
              {c.fields.bankCode && !banks.some(b => b.bankCode === c.fields.bankCode) && <option value={c.fields.bankCode}>{c.fields.bankCode}</option>}
              {banks.map(b => <option key={b.bankCode} value={b.bankCode}>{b.name} ({b.bankCode})</option>)}</select>}
            <p id="fs-help-bankCode" className={c.errors.bankCode ? 'fs-field-error' : 'fs-help'}>{c.errors.bankCode || (locked ? 'Thông tin tài khoản được bảo toàn theo lịch sử giao dịch.' : 'Chọn từ danh mục được hệ thống hỗ trợ.')}</p>
          </div>
          {field('accountNumber', 'Số tài khoản', 'Nhập đầy đủ 6–25 chữ số, bao gồm số 0 ở đầu.', locked)}
          {field('accountHolder', 'Tên chủ tài khoản', 'Giữ tên theo thông tin ngân hàng, tối đa 255 ký tự.', locked)}
        </>}
      </form> : !c.loading && !c.uncertain && c.snapshot && <section aria-label="Xác nhận thay đổi trạng thái"><SourceFacts source={c.snapshot} />
        {action === 'deactivate' && c.impact ? <><p className="fs-warning">{c.impact.warning}</p>
          <h3>Phòng bị ảnh hưởng ({c.impact.totalRooms})</h3>
          {c.impact.affectedRooms.length ? <ul className="fs-room-list">{c.impact.affectedRooms.map(r => <li key={r.roomId}><strong>{r.roomCode}: {r.roomName}</strong><span>{r.buildingName}</span><span>Nguồn mặc định: {fundingLabels[r.defaultRole]}</span></li>)}</ul>
            : <p>Không có phòng nào đang dùng nguồn tiền này làm nguồn mặc định.</p>}
          <p>Lịch sử giao dịch được giữ nguyên. Chính sách thanh toán của phòng không tự thay đổi.</p></> : action === 'activate' && <p>Xác nhận kích hoạt lại nguồn tiền để tiếp tục sử dụng cho các hoạt động mới?</p>}
      </section>}
    </div>
    <footer className="fs-dialog-footer"><button type="button" className="fs-button" data-fs-cancel disabled={c.pending} onClick={c.cancel}>{c.uncertain ? 'Đóng và xem danh sách' : 'Hủy'}</button>
      {!c.uncertain && <button type={formAction ? 'submit' : 'button'} form={formAction ? 'fs-form' : undefined} className="fs-button fs-button--primary" disabled={!ready}
        onClick={formAction ? undefined : () => { if (ready) void c.submit(); }}>{c.pending ? 'Đang lưu…' : formAction ? 'Lưu' : action === 'deactivate' ? 'Xác nhận ngừng hoạt động' : 'Xác nhận kích hoạt'}</button>}
    </footer>
  </dialog>, document.body);
}
