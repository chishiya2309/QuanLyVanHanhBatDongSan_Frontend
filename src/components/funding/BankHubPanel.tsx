import { useEffect, useRef, useState } from 'react';
import { changeBankHub, FundingApiError, getBankHubStatus, isFundingAbort, type BankHubAccountType, type BankHubSetup,
  type BankHubStatus } from '../../services/fundingApi';
import type { FundingSource } from '../../types/fundingSource';

const states: Record<string, string> = {
  NOT_CONFIGURED: 'Chưa thiết lập', HEALTHY: 'Kết nối đã xác minh', DEGRADED: 'Kết nối cần kiểm tra',
  RELINK_REQUIRED: 'Cần thiết lập lại', REVOCATION_PENDING: 'Đang chờ hủy liên kết',
  INACTIVATED: 'Đã vô hiệu hóa tại Bank Hub', UNLINKED: 'Đã gỡ liên kết tại ngân hàng',
};
const sessionStates: Record<string, string> = {
  STARTING: 'Đang khởi tạo phiên', OPEN: 'Đang chờ hoàn tất trên Bank Hub', VERIFYING: 'Đang xác minh',
  CANCEL_REQUESTED: 'Đang hủy phiên', CLEANUP_PENDING: 'Đang chờ xử lý', EXPIRED: 'Phiên đã hết hạn',
};
const actionLabels = {
  SETUP: 'Thiết lập xác nhận tự động', REPAIR: 'Khắc phục kết nối', CHECK: 'Kiểm tra kết nối',
  PAUSE: 'Tạm dừng xác nhận tự động', RESUME: 'Bật lại xác nhận tự động',
  UNLINK: 'Hủy liên kết', CANCEL_SESSION: 'Hủy phiên hiện tại',
} as const;
type Action = keyof typeof actionLabels;
const operations = {
  SETUP: 'sessions', REPAIR: 'sessions', CHECK: 'check', PAUSE: 'pause',
  RESUME: 'resume', UNLINK: 'unlink', CANCEL_SESSION: 'cancel',
} as const;
const confirmations: Partial<Record<Action, string>> = {
  SETUP: 'Bạn đồng ý dùng Bank Hub Sandbox để liên kết tài khoản thử nghiệm này?',
  REPAIR: 'Bạn đồng ý kiểm tra hoặc thiết lập lại liên kết Sandbox?',
  PAUSE: 'Các giao dịch phát sinh trong thời gian tạm dừng cần kiểm tra thủ công.',
  UNLINK: 'Xác nhận tự động sẽ dừng ngay. Sau đó, hoàn tất hủy liên kết trong Hosted Link của Bank Hub.',
};

export function BankHubPanel({ source, onClose, onSessionExpired, onForbidden }: {
  source: FundingSource; onClose: () => void; onSessionExpired: () => void; onForbidden: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef(false);
  const [accountType, setAccountType] = useState<BankHubAccountType | ''>('');
  const [data, setData] = useState<BankHubStatus | null>(null);
  const [hosted, setHosted] = useState<BankHubSetup | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Action | null>(null);
  const [refresh, setRefresh] = useState(0);
  const pending = data?.sessionId != null && data.sessionState !== 'EXPIRED';

  useEffect(() => {
    active.current = true;
    const element = dialog.current;
    element?.showModal();
    return () => { active.current = false; element?.close(); };
  }, []);

  useEffect(() => {
    if (busy) return;
    const controller = new AbortController();
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let loading = false;
    const load = async () => {
      if (loading || controller.signal.aborted) return;
      loading = true;
      try {
        const next = await getBankHubStatus(source.id, accountType, controller.signal);
        setData(next);
        setHosted(value => value && next.sessionId === value.sessionId && next.sessionState !== 'EXPIRED' ? value : null);
        if (next.sessionId && next.sessionState !== 'EXPIRED' && attempts++ < 20) timer = setTimeout(() => void load(), 2500);
      } catch (failure) {
        if (isFundingAbort(failure)) return;
        if (failure instanceof FundingApiError && failure.status === 401) onSessionExpired();
        else if (failure instanceof FundingApiError && failure.status === 403) onForbidden();
        else setError(failure instanceof Error ? failure.message : 'Chưa thể tải kết nối Bank Hub.');
      } finally {
        loading = false;
      }
    };
    const focus = () => { clearTimeout(timer); void load(); };
    void load();
    window.addEventListener('focus', focus);
    return () => { controller.abort(); clearTimeout(timer); window.removeEventListener('focus', focus); };
  }, [source.id, accountType, refresh, onSessionExpired, onForbidden, busy]);

  async function run(action: Action) {
    setConfirmation(null);
    setBusy(true);
    setError('');
    try {
      const result = await changeBankHub(source.id, operations[action], accountType, () => active.current, data?.sessionId ?? undefined);
      if ('hostedLinkUrl' in result) setHosted(result);
      else setData(result);
    } catch (failure) {
      if (isFundingAbort(failure)) return;
      if (failure instanceof FundingApiError && failure.status === 401) onSessionExpired();
      else if (failure instanceof FundingApiError && failure.status === 403 && failure.code === 'FORBIDDEN') onForbidden();
      else setError(failure instanceof Error ? failure.message : 'Chưa thể thực hiện thao tác.');
    } finally {
      if (active.current) { setBusy(false); setRefresh(value => value + 1); }
    }
  }

  return <dialog ref={dialog} className="fs-bankhub" aria-labelledby="fs-bankhub-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="fs-heading"><div><h2 id="fs-bankhub-title">Xác nhận thanh toán tự động</h2><p>{source.name}</p></div>
      <button className="fs-button" type="button" onClick={onClose}>Đóng</button></header>
    {data?.mode === 'SANDBOX' && <p><span className="fs-badge fs-badge--inactive">Sandbox</span></p>}
    <div className="fs-filter"><label htmlFor="fs-bankhub-account-type">Loại tài khoản</label>
      <select id="fs-bankhub-account-type" value={accountType} disabled={pending || busy}
        onChange={event => { setData(null); setError(''); setAccountType(event.target.value as BankHubAccountType | ''); }}>
        <option value="">Chọn loại tài khoản</option><option value="individual">Cá nhân</option>
        <option value="enterprise">Doanh nghiệp</option><option value="business_household">Hộ kinh doanh</option>
      </select></div>
    {!data && !error && <p role="status">Đang kiểm tra khả năng kết nối…</p>}
    {data && <div aria-live="polite"><p>{states[data.state] ?? data.state}{data.state === 'HEALTHY' && !data.enabled ? ' · Đã tạm dừng' : ''}</p>
      {data.sessionState && <p>{sessionStates[data.sessionState] ?? data.sessionState}</p>}
      {data.reason && <p>{data.reason}</p>}
      {data.lastCheckedAt && <p>Lần kiểm tra gần nhất {new Date(data.lastCheckedAt).toLocaleString('vi-VN')}</p>}
      <p>{data.guidance ?? 'Bạn vẫn có thể chuyển khoản, dùng VietQR và xác nhận thủ công.'}</p></div>}
    {error && <p role="alert">{error}</p>}
    {hosted && <p><a className="fs-button fs-button--primary" href={hosted.hostedLinkUrl} target="_blank" rel="noopener noreferrer">Mở Bank Hub trong tab mới</a></p>}
    {confirmation ? <div aria-live="polite"><p>{confirmations[confirmation]}</p><div className="fs-row-actions">
      <button type="button" className="fs-button fs-button--primary" onClick={() => void run(confirmation)}>Xác nhận</button>
      <button type="button" className="fs-button" onClick={() => setConfirmation(null)}>Quay lại</button>
    </div></div> : <div className="fs-row-actions">
      {data?.mode === 'SANDBOX' && data.actions.filter((action): action is Action => Object.hasOwn(actionLabels, action)).map(action =>
        <button type="button" className="fs-button" key={action} disabled={busy}
          onClick={() => confirmations[action] ? setConfirmation(action) : void run(action)}>{actionLabels[action]}</button>)}
      <button type="button" className="fs-button" disabled={busy} onClick={() => { setError(''); setRefresh(value => value + 1); }}>Tải lại trạng thái</button>
    </div>}
  </dialog>;
}
