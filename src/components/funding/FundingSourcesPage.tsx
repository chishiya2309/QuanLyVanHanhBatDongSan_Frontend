import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AuthenticatedUserResponse } from '../../types/auth';
import type { NavigationGuardRegistration } from '../../hooks/useServiceCatalog';
import { useFundingSources } from '../../hooks/useFundingSources';
import { fundingLabels, fundingMessages as m, type FundingAction, type FundingNotice, type FundingRoute, type FundingSource } from '../../types/fundingSource';
import { fundingUrl } from '../../utils/fundingNavigation';
import { FundingDialog } from './FundingDialog';
import './fundingSources.css';
export function FundingForbidden({ onBack }: { onBack: () => void }) { return <section className="fs-page"><h1>{m.title}</h1><p role="alert">{m.forbidden}</p><button type="button" className="fs-button" onClick={onBack}>Về tổng quan</button></section>; }
interface Props { user: AuthenticatedUserResponse; route: FundingRoute; onNavigate: (url: string, replace?: boolean) => void; onSessionExpired: () => void; onForbidden: () => void; onBack: () => void; registerGuard: NavigationGuardRegistration }
export function FundingSourcesPage(props: Props) {
  const [visit, setVisit] = useState(0);
  useEffect(() => { const previous = document.title; document.title = m.title + ' | RentOps'; return () => { document.title = previous; }; }, []);
  useLayoutEffect(() => {
    // A same-account login also invalidates drafts, snapshots and pending requests.
    // The shared session client handles the authentication epoch itself.
    const changed = (event: StorageEvent) => {
      if (event.key !== 'rentops-session-change' || !event.newValue) return;
      try { const value = JSON.parse(event.newValue); if (value?.accountId === props.user.accountId) setVisit(n => n + 1); } catch { /* Ignore unrelated storage. */ }
    };
    window.addEventListener('storage', changed); return () => window.removeEventListener('storage', changed);
  }, [props.user.accountId]);
  return props.user.role === 'HOST' ? <FundingContent key={props.user.accountId + '/' + visit} {...props} /> : <FundingForbidden onBack={props.onBack} />;
}
function FundingContent({ route, onNavigate, onSessionExpired, onForbidden, registerGuard }: Props) {
  const { list, banks, notice, setNotice, fail } = useFundingSources(route, onSessionExpired, onForbidden);
  const opener = useRef<HTMLElement | null>(null);
  const returnFocus = useRef(false);
  useLayoutEffect(() => { document.getElementById('funding-title')?.focus(); }, []);
  useEffect(() => { if (route.invalid) { onNavigate(fundingUrl(route), true); void Promise.resolve().then(() => setNotice({ kind: 'error', message: m.invalidRoute })); } }, [route, onNavigate, setNotice]);
  const open = (action: FundingAction, id: string | null = null, trigger?: HTMLElement) => { opener.current = trigger || document.activeElement as HTMLElement; onNavigate(fundingUrl(route, action, id)); };
  useLayoutEffect(() => {
    if (route.action || !returnFocus.current || list.status === 'loading') return;
    returnFocus.current = false;
    const target = opener.current;
    if (target?.isConnected && !target.matches(':disabled')) target.focus(); else document.getElementById('funding-title')?.focus();
  }, [route.action, list.status]);
  const finished = (message: string, kind: FundingNotice['kind']) => { returnFocus.current = true; setNotice({ message, kind }); list.refresh(); onNavigate(fundingUrl(route), true); };
  const close = () => { returnFocus.current = true; onNavigate(fundingUrl(route), true); };
  const bankNames = new Map(banks.data?.map(b => [b.bankCode, b.name]));
  const actions = (s: FundingSource) => <div className="fs-row-actions"><button type="button" className="fs-button" onClick={e => open('edit', s.id, e.currentTarget)}>Chỉnh sửa</button>
    <button type="button" className="fs-button" onClick={e => open(s.active ? 'deactivate' : 'activate', s.id, e.currentTarget)}>{s.active ? 'Ngừng hoạt động' : 'Kích hoạt lại'}</button></div>;
  return <section className="fs-page" aria-labelledby="funding-title">
    <header className="fs-heading"><div><h1 id="funding-title" tabIndex={-1}>{m.title}</h1><p>Khai báo nguồn nhận tiền và quản lý khả năng sử dụng cho thu chi.</p></div>
      <div className="fs-heading-actions"><button type="button" className="fs-button fs-button--primary" disabled={list.status !== 'ready'} onClick={e => open('create-bank', null, e.currentTarget)}>Thêm tài khoản ngân hàng</button><button type="button" className="fs-button" disabled={list.status !== 'ready'} onClick={e => open('create-cash', null, e.currentTarget)}>Thêm nguồn tiền mặt</button></div></header>
    {notice && <div className={'fs-banner' + (notice.kind === 'error' ? ' fs-banner--error' : '')} role={notice.kind === 'success' ? 'status' : 'alert'}><p>{notice.message}</p>
      {notice.kind === 'success' && list.status === 'error' && <p>Đã lưu thành công nhưng danh sách chưa cập nhật. Vui lòng tải lại.</p>}<button type="button" className="fs-button" aria-label="Đóng thông báo" onClick={() => setNotice(null)}>Đóng</button></div>}
    <div className="fs-toolbar"><div className="fs-filter"><label htmlFor="fs-filter-type">Loại nguồn</label><select id="fs-filter-type" value={route.type} onChange={e => onNavigate(fundingUrl({ ...route, type: e.target.value as FundingRoute['type'] }))}><option value="">Tất cả loại nguồn</option><option value="CASH">Tiền mặt</option><option value="BANK">Tài khoản ngân hàng</option></select></div>
      <div className="fs-filter"><label htmlFor="fs-filter-active">Trạng thái hoạt động</label><select id="fs-filter-active" value={route.active} onChange={e => onNavigate(fundingUrl({ ...route, active: e.target.value as FundingRoute['active'] }))}><option value="">Tất cả trạng thái</option><option value="true">Đang hoạt động</option><option value="false">Ngừng hoạt động</option></select></div>
      <button type="button" className="fs-button" disabled={list.status === 'loading'} onClick={list.refresh}>Tải lại danh sách</button></div>
    {banks.status === 'error' && <div className="fs-bank-notice" role="status"><p>{banks.error}</p><button type="button" className="fs-button" onClick={banks.refresh}>Tải lại ngân hàng</button></div>}
    {list.status === 'loading' ? <div className="fs-state" role="status"><p>Đang tải danh sách nguồn tiền…</p><div className="fs-skeleton" aria-hidden="true" /><div className="fs-skeleton" aria-hidden="true" /></div>
      : list.status === 'error' ? <div className="fs-state fs-state--error" role="alert"><h2>Chưa thể tải danh sách</h2><p>{list.error}</p><button type="button" className="fs-button" onClick={list.refresh}>Thử lại</button></div>
        : !list.data?.length ? <div className="fs-state"><h2>{route.type || route.active ? 'Không có nguồn tiền phù hợp bộ lọc' : 'Chưa có nguồn tiền'}</h2><p>{route.type || route.active ? 'Xóa bộ lọc để xem các nguồn tiền hiện có.' : 'Thêm tài khoản ngân hàng hoặc nguồn tiền mặt để bắt đầu.'}</p>
          {route.type || route.active ? <button type="button" className="fs-button" onClick={() => onNavigate('/funding-sources')}>Xóa bộ lọc</button> : <button type="button" className="fs-button" onClick={e => open('create-cash', null, e.currentTarget)}>Thêm tiền mặt</button>}</div>
          : <table className="fs-table"><caption className="fs-sr-only">Nguồn tiền thuộc phạm vi quản lý của bạn</caption><thead><tr><th scope="col">Tên nguồn tiền</th><th scope="col">Loại nguồn</th><th scope="col">Thông tin ngân hàng</th><th scope="col">Trạng thái</th><th scope="col">Lịch sử giao dịch</th><th scope="col">Thao tác</th></tr></thead>
            <tbody>{list.data.map(s => <tr key={s.id}><th scope="row" className="fs-source-name">{s.name}</th><td data-label="Loại nguồn">{fundingLabels[s.type]}</td><td data-label="Thông tin ngân hàng">{s.bankDetails ? <div className="fs-bank-info"><span>{bankNames.get(s.bankDetails.bankCode) || s.bankDetails.bankCode}</span><span className="fs-digits">{s.bankDetails.accountNumber}</span><span>{s.bankDetails.accountHolder}</span></div> : 'Không áp dụng'}</td>
              <td data-label="Trạng thái"><span className={'fs-badge fs-badge--' + (s.active ? 'active' : 'inactive')}>{s.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></td><td data-label="Lịch sử giao dịch"><span className="fs-history">{s.hasTransactions ? 'Đã phát sinh giao dịch' : 'Chưa phát sinh giao dịch'}</span>{s.type === 'BANK' && s.hasTransactions && <span className="fs-help">Chỉ được đổi tên</span>}</td><td data-label="Thao tác">{actions(s)}</td></tr>)}</tbody></table>}
    {route.action && <FundingDialog key={route.action + '/' + route.sourceId} action={route.action} sourceId={route.sourceId} banks={banks.data || []} banksReady={banks.status === 'ready'} bankError={banks.error} retryBanks={banks.refresh}
      opener={opener} onClose={close} onFinished={finished} onFailure={fail} registerGuard={registerGuard} />}
  </section>;
}
