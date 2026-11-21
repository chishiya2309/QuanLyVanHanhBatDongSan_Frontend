import type { PaymentPolicy, PaymentSource } from '../../types/roomPaymentPolicy';

export function PaymentRecipient({ source }: { source: PaymentSource | null }) {
  if (!source) return <span>Không chấp nhận</span>;
  return <><span>{source.name}</span>{!source.active && <strong className="rpp-warning">Ngừng hoạt động</strong>}
    {source.bankDetails && <span className="rpp-recipient">{source.bankDetails.bankCode}: {source.bankDetails.accountNumber}<br />{source.bankDetails.accountHolder}</span>}</>;
}
export function PaymentPolicySummary({ policy }: { policy: PaymentPolicy | null }) {
  if (!policy) return <p>Phòng chưa có cấu hình thanh toán.</p>;
  return <dl className="rpp-facts"><div><dt>Tiền mặt</dt><dd><PaymentRecipient source={policy.cashDefault} /></dd></div>
    <div><dt>Chuyển khoản</dt><dd><PaymentRecipient source={policy.bankDefault} /></dd></div></dl>;
}
