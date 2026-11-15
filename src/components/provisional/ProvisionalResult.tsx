import type { ChargeItem, ProvisionalDetail } from '../../types/provisionalCharge';
import { provisionalMessages as m } from '../../types/provisionalCharge';
import { formatPeriodRange, formatProvisionalDate, formatProvisionalDecimal as decimal,
  formatProvisionalVnd as vnd, methodLabels, pricingLabels } from '../../utils/provisionalChargeFormat';

export function PeriodResult({ detail: d, stale, checkedAt }: { detail: ProvisionalDetail; stale: boolean; checkedAt: Date | null }) {
  const partial = d.fromDate !== d.cycleStart || d.toDate !== d.cycleEnd;
  return <header className="pc-period-heading">
    <div><h2>{d.roomCode}, {d.buildingName}</h2>
      <p>{partial ? 'Phần kỳ' : 'Kỳ'} {formatPeriodRange(d.fromDate, d.toDate)}</p>
      {partial && <p className="pc-muted">Chu kỳ gốc: {formatPeriodRange(d.cycleStart, d.cycleEnd)}</p>}
    </div>
    <div className="pc-check"><span className={`pc-badge${stale ? ' pc-badge--missing' : ''}`}>{stale ? 'Chưa cập nhật' : 'Tạm tính'}</span>
      {checkedAt && <p>Đã kiểm tra lúc {new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(checkedAt)}</p>}
    </div>
  </header>;
}

function Inputs({ item: i }: { item: ChargeItem }) {
  if (i.itemType !== 'SERVICE') return <p>{i.itemType === 'FEE' ? 'Khoản cộng' : 'Khoản giảm trừ'}</p>;
  return <>
    {i.chargeMethod === 'METERED' && <dl className="pc-inputs">
      <div><dt>Chỉ số đầu</dt><dd>{decimal(i.startIndex)}</dd></div>
      <div><dt>Chỉ số cuối</dt><dd>{decimal(i.endIndex)}</dd></div>
      <div><dt>Tiêu thụ</dt><dd>{decimal(i.consumption)}{i.consumption !== null && ` ${i.unit}`}</dd></div>
    </dl>}
    {i.chargeMethod === 'QUANTITY' && <p>Số lượng: <span className="pc-number">{decimal(i.quantity)}</span>{i.quantity !== null && ` ${i.unit}`}</p>}
    {i.chargeMethod === 'FIXED' && <p>Đơn giá cố định cho kỳ.</p>}
    {i.chargeMethod === 'CUSTOM' && <p>Phí thực tế: <span className="pc-number">{vnd(i.manualAmount)}</span></p>}
    <details className="pc-basis"><summary>Xem căn cứ tính<span className="pc-sr"> {i.itemName}</span></summary>
      <dl className="pc-inputs">
        <div><dt>Cách tính</dt><dd>{methodLabels[i.chargeMethod]}</dd></div>
        {i.pricingSource !== null && <div><dt>Nguồn đơn giá</dt><dd>{pricingLabels[i.pricingSource]}</dd></div>}
        {i.basisDate !== null && <div><dt>Ngày căn cứ</dt><dd>{formatProvisionalDate(i.basisDate)}</dd></div>}
        {i.prorateFactor !== null && <div><dt>Hệ số áp dụng</dt><dd>{decimal(i.prorateFactor)}</dd></div>}
      </dl>
    </details>
  </>;
}

export function ChargeItemsTable({ items }: { items: ChargeItem[] }) {
  if (!items.length) return <div className="pc-empty-charges"><h3>{m.noCharges}</h3><p>Kỳ hợp lệ và chưa có khoản áp dụng.</p></div>;
  return <div className="pc-table-wrap"><table className="pc-table" role="table">
    <caption className="pc-sr">Các khoản tạm tính của kỳ đã chọn</caption>
    <thead role="rowgroup"><tr role="row"><th scope="col">Khoản</th><th scope="col">Đầu vào và căn cứ</th><th scope="col" className="pc-money">Đơn giá</th>
      <th scope="col" className="pc-money">Thành tiền</th><th scope="col">Trạng thái</th></tr></thead>
    <tbody role="rowgroup">{items.map(i => <tr role="row" key={i.itemType + ':' + i.itemCode}>
      <th scope="row" role="rowheader" data-label="Khoản"><strong>{i.itemName}</strong><span className="pc-item-kind">{i.itemType === 'SERVICE' ? methodLabels[i.chargeMethod] : i.itemType === 'FEE' ? 'Phí phát sinh' : 'Giảm trừ'}</span></th>
      <td role="cell" data-label="Đầu vào và căn cứ"><Inputs item={i} /></td>
      <td role="cell" data-label="Đơn giá" className="pc-money pc-number">{i.unitPrice === null ? (i.itemType !== 'SERVICE' || i.chargeMethod === 'CUSTOM' ? 'Không áp dụng' : 'Chưa có') : vnd(i.unitPrice)}</td>
      <td role="cell" data-label="Thành tiền" className="pc-money pc-number pc-line-amount">{vnd(i.amount)}</td>
      <td role="cell" data-label="Trạng thái"><span className={`pc-badge${i.status === 'MISSING_DATA' ? ' pc-badge--missing' : ''}`}>
        {i.status === 'CALCULATED' ? 'Đã tính' : 'Thiếu dữ liệu'}</span>
        {i.missingReason !== null && <p className="pc-missing-reason">{i.missingReason}</p>}
      </td>
    </tr>)}</tbody>
  </table></div>;
}
