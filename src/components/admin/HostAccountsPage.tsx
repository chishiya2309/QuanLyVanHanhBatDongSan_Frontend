import { useEffect, useRef, type ReactNode, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useHostAccounts } from '../../hooks/useHostAccounts';
import { HOST_ACCOUNTS_PATH, hostAccountMessages as m, type HostAccountConfirmation, type HostAccountSummary } from '../../types/hostAccounts';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import './hostAccounts.css';

const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
function CreatedAt({ value }: { value: string }) { return <time dateTime={value}>{dateFormat.format(new Date(value))}</time>; }
function Status({ status }: { status: HostAccountSummary['status'] }) { return <span className={`host-status host-status--${status.toLowerCase()}`}>{status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}</span>; }
function DetailField({ label, children }: { label: string; children?: ReactNode }) { return <div className="host-detail-field"><dt>{label}</dt><dd>{children || <span className="host-muted">Chưa cập nhật</span>}</dd></div>; }
function Spinner() { return <span className="host-spinner" aria-hidden="true" />; }
function ErrorBanner({ children }: { children: string }) { return <div className="host-alert host-alert--error" role="alert" tabIndex={-1}>{children}</div>; }

export function HostAccountsForbidden({ onOverview }: { onOverview: () => void }) {
  return <section className="host-page"><h1>Quản lý tài khoản Host</h1><ErrorBanner>{m.forbidden}</ErrorBanner><button type="button" className="host-button" onClick={onOverview}>Quay lại Tổng quan</button></section>;
}

function HostAccountConfirmDialog({ confirmation: c, busy, onConfirm, onCancel }: {
  confirmation: HostAccountConfirmation; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const locking = c.action === 'lock';
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const overflow = document.body.style.overflowY;
    document.body.style.overflowY = 'hidden'; dialog.showModal(); cancelRef.current?.focus();
    return () => { dialog.close(); document.body.style.overflowY = overflow; if (c.trigger?.isConnected) c.trigger.focus(); };
  }, [c]);
  const close = () => { if (!busy) onCancel(); };
  return createPortal(<dialog className="host-confirm" ref={dialogRef} tabIndex={-1} aria-modal="true" aria-labelledby="host-confirm-title" aria-describedby="host-confirm-impact"
    onCancel={(event) => { event.preventDefault(); close(); }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
    }} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const first = controls[0]; const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); event.currentTarget.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
    <form noValidate aria-busy={busy} onSubmit={(event) => { event.preventDefault(); onConfirm(); }}>
      <div className="host-confirm-body"><h2 id="host-confirm-title">{locking ? 'Bạn có chắc chắn muốn khóa tài khoản Host này?' : 'Bạn có chắc chắn muốn mở khóa tài khoản Host này?'}</h2>
        <dl className="host-confirm-identity"><DetailField label="Email đăng nhập">{c.account.loginEmail}</DetailField><DetailField label="Tên kinh doanh">{c.account.businessName}</DetailField></dl>
        <p id="host-confirm-impact">{locking ? 'Host sẽ bị đăng xuất khỏi tất cả thiết bị và không thể đăng nhập cho đến khi được mở khóa.' : 'Host cần đăng nhập lại. Các phiên đã thu hồi sẽ không được khôi phục.'}</p>
      </div>
      <footer className="host-confirm-footer"><button type="button" ref={cancelRef} className="host-button" disabled={busy} onClick={close}>Hủy</button>
        <button type="submit" className="host-button host-button--primary" disabled={busy} aria-busy={busy}>{busy && <Spinner />}{busy ? 'Đang xử lý' : 'Xác nhận'}</button></footer>
    </form>
  </dialog>, document.body);
}

export function HostAccountsPage({ accountId, onNavigate, onSessionExpired, onForbidden }: {
  accountId: string | null; onNavigate: (accountId: string | null) => void; onSessionExpired: () => void; onForbidden: () => void;
}) {
  const c = useHostAccounts(accountId, { onNavigate, onSessionExpired, onForbidden });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const source = accountId === null ? c.list : c.detail;
  const detail = c.detail.data?.accountId.toLowerCase() === accountId?.toLowerCase() ? c.detail.data : null;
  const loading = source.status === 'idle' || source.status === 'loading' || (accountId !== null && !detail && source.status === 'ready');
  useEffect(() => { headingRef.current?.focus(); }, [accountId]);
  const navigate = (event: MouseEvent<HTMLAnchorElement>, id: string | null) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); onNavigate(id);
  };
  const actions = (host: HostAccountSummary) => <div className="host-actions">
    <a className="host-button host-button--quiet" href={`${HOST_ACCOUNTS_PATH}/${encodeURIComponent(host.accountId)}`}
      aria-label={`Xem chi tiết ${host.loginEmail}`} onClick={(event) => navigate(event, host.accountId)}>Xem chi tiết</a>
    <button type="button" className="host-button" disabled={!c.canMutate} aria-label={`${host.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'} ${host.loginEmail}`}
      onClick={(event) => void c.prepare(host.accountId, host.status === 'ACTIVE' ? 'lock' : 'unlock', event.currentTarget)}>
      {c.preparingId === host.accountId && <Spinner />}{c.preparingId === host.accountId ? 'Đang kiểm tra' : host.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
    </button>
  </div>;

  return <section className="host-page" aria-label="Quản lý tài khoản Host">
    {accountId !== null && <a href={HOST_ACCOUNTS_PATH} className="host-back" onClick={(event) => navigate(event, null)}>Quay lại danh sách</a>}
    <header className="host-page-header"><div><h1 ref={headingRef} tabIndex={-1}>{accountId === null ? 'Quản lý tài khoản Host' : 'Thông tin tài khoản Host'}</h1>
      <p>{accountId === null ? 'Xem thông tin và quản lý quyền truy cập của Host.' : 'Thông tin đăng nhập và hồ sơ kinh doanh của Host.'}</p></div>
      <button type="button" className="host-button" onClick={() => void c.retry()} disabled={loading || c.isMutating || !!c.preparingId}>Tải lại</button>
    </header>
    {c.notice && <div className={`host-alert host-alert--${c.notice.kind}`} role={c.notice.kind === 'success' ? 'status' : 'alert'} tabIndex={-1}>{c.notice.message}</div>}
    {source.error && <><ErrorBanner>{source.error}</ErrorBanner><button type="button" className="host-button" onClick={() => void c.retry()}>Thử lại</button></>}
    {accountId !== null && c.list.error && <><ErrorBanner>{c.list.error}</ErrorBanner><button type="button" className="host-button" onClick={() => void c.retry()}>Thử lại</button></>}
    {(source.stale && source.data || accountId !== null && c.list.status === 'error') && <p className="host-stale">Dữ liệu chưa được cập nhật. Vui lòng tải lại trước khi thực hiện thao tác tiếp theo.</p>}
    {loading ? <div className="host-loading" role="status" aria-label="Đang tải tài khoản Host"><span className="visually-hidden">Đang tải tài khoản Host</span>{[0, 1, 2, 3].map((row) => <div className="host-skeleton" key={row} />)}</div>
      : accountId === null ? c.list.data && (c.list.data.length === 0 ? <p className="host-empty">{m.empty}</p> : <>
        <div className="host-table-wrap"><table className="host-table"><caption className="visually-hidden">Danh sách tài khoản Host</caption>
          <thead><tr>{['Mã tài khoản', 'Email đăng nhập', 'Tên kinh doanh', 'Trạng thái', 'Ngày tạo', 'Thao tác'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{c.list.data.map((host) => <tr key={host.accountId}><td className="host-id">{host.accountId}</td><td>{host.loginEmail}</td><td>{host.businessName || <span className="host-muted">Chưa xác định hồ sơ</span>}</td><td><Status status={host.status} /></td><td><CreatedAt value={host.createdAt} /></td><td>{actions(host)}</td></tr>)}</tbody>
        </table></div>
        <ul className="host-mobile-list">{c.list.data.map((host) => <li key={host.accountId}><dl className="host-mobile-record">
          <DetailField label="Mã tài khoản">{host.accountId}</DetailField><DetailField label="Email đăng nhập">{host.loginEmail}</DetailField>
          <DetailField label="Tên kinh doanh">{host.businessName || 'Chưa xác định hồ sơ'}</DetailField><DetailField label="Trạng thái"><Status status={host.status} /></DetailField>
          <DetailField label="Ngày tạo"><CreatedAt value={host.createdAt} /></DetailField>
        </dl>{actions(host)}</li>)}</ul>
      </>) : detail && <div className="host-detail">
        <div className="host-detail-identity"><ProfileAvatar key={`${detail.accountId}-${detail.logoUrl || ''}`} name={detail.businessName || detail.loginEmail} src={detail.logoUrl} />
          <div><h2>{detail.businessName || 'Chưa cập nhật'}</h2><Status status={detail.status} /></div></div>
        <dl className="host-detail-grid"><DetailField label="Mã tài khoản">{detail.accountId}</DetailField><DetailField label="Email đăng nhập">{detail.loginEmail}</DetailField>
          <DetailField label="Tên kinh doanh">{detail.businessName}</DetailField><DetailField label="Trạng thái"><Status status={detail.status} /></DetailField>
          <DetailField label="Ngày tạo"><CreatedAt value={detail.createdAt} /></DetailField><DetailField label="Địa chỉ văn phòng">{detail.officeAddress}</DetailField>
          <DetailField label="Điện thoại kinh doanh">{detail.businessPhone}</DetailField><DetailField label="Email kinh doanh">{detail.businessEmail}</DetailField>
        </dl><div className="host-detail-actions"><button type="button" className="host-button host-button--primary" disabled={!c.canMutate}
          onClick={(event) => void c.prepare(detail.accountId, detail.status === 'ACTIVE' ? 'lock' : 'unlock', event.currentTarget)}>
          {c.preparingId && <Spinner />}{c.preparingId ? 'Đang kiểm tra' : detail.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
        </button></div>
      </div>}
    {c.confirmation && <HostAccountConfirmDialog confirmation={c.confirmation} busy={c.isMutating} onConfirm={() => void c.confirm()} onCancel={c.cancel} />}
  </section>;
}
