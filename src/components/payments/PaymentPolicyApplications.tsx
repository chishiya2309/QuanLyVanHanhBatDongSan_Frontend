import type { RoomPaymentController } from '../../hooks/useRoomPaymentPolicy';
import { paymentMessages as m } from '../../types/roomPaymentPolicy';
import { PropertyDialog } from '../properties/PropertyDialog';
import { PaymentPolicySummary, PaymentRecipient } from './PaymentPolicySummary';
import '../properties/properties.css';

export function PaymentPolicyApplications({ controller: c }: { controller: RoomPaymentController }) {
  if (!c.batchOpen || !c.snapshot) return null;
  const unavailable = Boolean(c.pending || c.loading || c.blocked || c.uncertain || c.targetLoading || !c.targets?.length);
  const selected = c.all ? c.targets ?? [] : (c.targets ?? []).filter(r => c.selected.includes(r.roomId));
  return <section className="rpp-applications" aria-labelledby="rpp-applications-title">
    <header className="rpp-section-header"><div><h2 id="rpp-applications-title">Áp dụng trong cùng tòa nhà</h2><p>Chỉ sao chép cấu hình đã lưu của phòng {c.snapshot.roomCode}.</p></div>
      <button className="rpp-button" type="button" disabled={Boolean(c.pending)} onClick={c.closeBatch}>Đóng áp dụng</button></header>
    {c.targetLoading && <div className="rpp-skeleton" role="status">Đang tải danh sách phòng đích…</div>}
    {c.targetError && <div className="rpp-notice rpp-notice--error" role="alert"><p>{c.targetError}</p><button type="button" className="rpp-button" onClick={c.reloadTargets}>Thử tải lại phòng đích</button></div>}
    {!c.targetLoading && c.targets?.length === 0 && <p className="rpp-empty">Không có phòng đích trong tòa nhà này.</p>}
    {!!c.targets?.length && <>
      <label className="rpp-toggle" htmlFor="rpp-all"><input id="rpp-all" type="checkbox" checked={c.all} disabled={unavailable} onChange={e => c.selectAll(e.target.checked)} />Áp dụng cho tất cả phòng trong tòa nhà</label>
      <p className="rpp-help">Tất cả bao gồm toàn bộ phòng đích hợp lệ trong tòa nhà tại thời điểm áp dụng.</p>
      <div className="rpp-table-scroll" role="region" aria-label="Cấu hình hiện tại của phòng đích" tabIndex={0}>
        <table className="rpp-table"><caption>Cấu hình hiện tại trước khi ghi đè</caption><thead><tr><th scope="col">Chọn</th><th scope="col">Phòng</th><th scope="col">Tiền mặt</th><th scope="col">Chuyển khoản</th></tr></thead>
          <tbody>{c.targets.map(r => <tr key={r.roomId}><td><label className="rpp-room-check"><input type="checkbox" aria-label={'Chọn phòng ' + r.roomCode} checked={c.all || c.selected.includes(r.roomId)} disabled={unavailable || c.all}
            onChange={e => c.select(r.roomId, e.target.checked)} aria-describedby={c.errors.roomIds ? 'rpp-roomIds-error' : undefined} /> <span className="visually-hidden">Phòng {r.roomCode}</span></label></td>
            <th scope="row">{r.roomCode}<span className="rpp-recipient">{r.roomName}</span></th>
            {r.configured ? <><td><PaymentRecipient source={r.policy!.cashDefault} /></td><td><PaymentRecipient source={r.policy!.bankDefault} /></td></> : <td colSpan={2}>Chưa cấu hình</td>}</tr>)}</tbody>
        </table>
      </div>
      <p id="rpp-roomIds-error" className="rpp-field-error" role={c.errors.roomIds ? 'alert' : undefined}>{c.errors.roomIds || '\u00a0'}</p>
      <div className="rpp-actions"><p>{selected.length} phòng đang được chọn</p><button type="button" className="rpp-button rpp-button--primary" disabled={unavailable} onClick={c.prepare}>Xác nhận áp dụng</button></div>
    </>}
    {c.confirm && <PropertyDialog labelledBy="rpp-confirm-title" pending={Boolean(c.pending)} onClose={c.closeConfirmation}>
      <div className="rpp-confirm"><header><h2 id="rpp-confirm-title">Ghi đè cấu hình thanh toán?</h2><p>Phòng mẫu: {c.snapshot.roomCode} — {c.snapshot.buildingName}</p></header>
        <div className="rpp-confirm-body"><p>{m.confirm}</p><PaymentPolicySummary policy={c.snapshot.policy} />
          <h3>{c.all ? 'Tất cả phòng đích trong tòa nhà' : `${selected.length} phòng được chọn`}</h3><ul className="rpp-selected">{selected.map(r => <li key={r.roomId}>{r.roomCode} — {r.roomName}</li>)}</ul>
          {c.all && <p className="rpp-help">Phạm vi tất cả được backend kiểm tra lại khi áp dụng; số lượng thực tế có thể thay đổi.</p>}
        </div>
        <footer className="rpp-actions"><button type="button" className="rpp-button" disabled={Boolean(c.pending)} onClick={c.closeConfirmation}>Quay lại chọn phòng</button>
          <button type="button" className="rpp-button rpp-button--primary" disabled={Boolean(c.pending)} onClick={() => void c.apply()}>{c.pending ? 'Đang áp dụng…' : 'Áp dụng cấu hình'}</button></footer>
      </div>
    </PropertyDialog>}
  </section>;
}
