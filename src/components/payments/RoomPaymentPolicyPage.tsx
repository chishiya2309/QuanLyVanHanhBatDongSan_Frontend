import { useEffect, useRef } from 'react';
import type { NavigationGuardRegistration } from '../../hooks/useServiceCatalog';
import { useRoomPaymentPolicy } from '../../hooks/useRoomPaymentPolicy';
import { paymentMessages as m, type PaymentPolicyRoute } from '../../types/roomPaymentPolicy';
import { PaymentPolicyApplications } from './PaymentPolicyApplications';
import { PaymentMethodField } from './PaymentMethodField';
import { PaymentPolicySummary } from './PaymentPolicySummary';
import './roomPaymentPolicy.css';

export function RoomPaymentPolicyPage({ route, allowed = true, registerGuard, onNavigate, onManageFunds, onSessionExpired, onForbidden, onMissing }: {
  route: PaymentPolicyRoute; allowed?: boolean; registerGuard: NavigationGuardRegistration; onNavigate: (url: string) => void;
  onManageFunds: () => void; onSessionExpired: (message: string) => void; onForbidden: (message: string) => void; onMissing: (message: string) => void;
}) {
  const c = useRoomPaymentPolicy({ roomId: route.roomId, allowed, registerGuard, onSessionExpired, onForbidden, onMissing });
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (Object.values(c.errors).some(Boolean)) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [c.errors]);
  if (!allowed) return <section className="rpp-page"><h1>{m.title}</h1><p role="alert">{m.forbidden}</p></section>;
  const disabled = Boolean(c.pending || c.loading || c.blocked || c.uncertain || c.batchOpen);
  return <section className="rpp-page" aria-labelledby="rpp-title" aria-busy={Boolean(c.loading || c.pending)}>
    <header className="rpp-header"><div><button type="button" className="rpp-link" disabled={Boolean(c.pending)} onClick={() => onNavigate(route.returnTo)}>Quay lại phòng</button>
      <h1 id="rpp-title">{m.title}</h1>{c.snapshot && <p className="rpp-identity">Phòng {c.snapshot.roomCode} — {c.snapshot.roomName}<span>{c.snapshot.buildingName}</span></p>}</div>
      {c.snapshot && <span className="rpp-status">{c.snapshot.configured ? 'Đã cấu hình' : 'Chưa cấu hình'}</span>}</header>
    <div role="status" aria-live="polite">{c.notice && <p className="rpp-notice rpp-notice--success">{c.notice}</p>}</div>
    {c.error && <div className="rpp-notice rpp-notice--error" role="alert"><p>{c.error}</p>
      {(c.blocked || c.uncertain || !c.snapshot) && <button type="button" className="rpp-button" disabled={Boolean(c.pending || c.loading)} onClick={c.reload}>Tải lại để đối chiếu</button>}
    </div>}
    {c.uncertain && c.verified && <div className="rpp-notice"><p>Cấu hình hiện tại đã được tải bên dưới. Kiểm tra phòng mẫu{c.uncertain === 'apply' ? ' và từng phòng đích' : ''} trước khi tiếp tục. Đây không phải xác nhận kết quả của yêu cầu trước.</p>
      <button type="button" className="rpp-button" onClick={c.acknowledge}>Đã kiểm tra cấu hình hiện tại</button></div>}
    {c.loading && <div className="rpp-skeleton" role="status">Đang tải cấu hình thanh toán…</div>}
    {c.snapshot && <>
      <section className="rpp-saved" aria-labelledby="rpp-saved-title"><h2 id="rpp-saved-title">Cấu hình đã lưu</h2><PaymentPolicySummary policy={c.snapshot.policy} /></section>
      <form ref={form} className="rpp-form" noValidate onSubmit={e => { e.preventDefault(); void c.save(); }}>
        <div className="rpp-section-header"><h2>{c.dirty ? 'Thay đổi chưa lưu' : 'Thiết lập phương thức'}</h2>{c.dirty && <button className="rpp-button" type="button" disabled={disabled} onClick={c.discard}>Bỏ thay đổi</button>}</div>
        <PaymentMethodField type="CASH" controller={c} onManageFunds={onManageFunds} />
        <PaymentMethodField type="BANK" controller={c} onManageFunds={onManageFunds} />
        <p className="rpp-help">{m.invoice}</p>
        <div className="rpp-actions"><button type="button" className="rpp-button" disabled={Boolean(c.pending)} onClick={() => c.cancel(() => onNavigate(route.returnTo))}>Hủy bỏ</button>
          <button type="submit" className="rpp-button rpp-button--primary" disabled={disabled}>{c.pending === 'save' ? 'Đang lưu…' : 'Lưu cấu hình'}</button></div>
      </form>
      {c.previousDraft && <details className="rpp-previous"><summary>Xem bản nháp trước khi tải lại</summary><p>Tiền mặt: {c.previousDraft.allowCash ? 'Bật' : 'Tắt'}. Chuyển khoản: {c.previousDraft.allowTransfer ? 'Bật' : 'Tắt'}.</p>
        <p>Nguồn tiền mặt: {c.previousDraft.cashDefaultId || 'Chưa chọn'}. Nguồn ngân hàng: {c.previousDraft.bankDefaultId || 'Chưa chọn'}.</p></details>}
      {!c.batchOpen && <section className="rpp-copy"><div><h2>Áp dụng cho phòng khác</h2><p>Sao chép cấu hình đã lưu trong cùng tòa nhà.</p>{c.dirty && <p className="rpp-help">Lưu hoặc bỏ thay đổi trước khi áp dụng.</p>}</div>
        <button type="button" className="rpp-button" disabled={Boolean(c.pending || c.loading || c.blocked || c.uncertain || !c.snapshot.configured)} onClick={c.beginBatch}>Áp dụng cho các phòng khác trong tòa nhà</button></section>}
      <PaymentPolicyApplications controller={c} />
    </>}
  </section>;
}
