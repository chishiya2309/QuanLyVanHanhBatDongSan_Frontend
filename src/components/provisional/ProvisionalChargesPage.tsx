import { useEffect, useRef, useState } from 'react';
import { invoicePath, invoiceRequest } from '../../services/invoiceApi';
import type { AuthenticatedUserResponse } from '../../types/auth';
import type { ProvisionalRoute } from '../../types/provisionalCharge';
import { provisionalMessages as m } from '../../types/provisionalCharge';
import { useProvisionalCharges } from '../../hooks/useProvisionalCharges';
import { provisionalUrl } from '../../utils/provisionalChargeNavigation';
import { formatProvisionalVnd } from '../../utils/provisionalChargeFormat';
import { ProvisionalApiError } from '../../services/provisionalChargeApi';
import { ContextSelector } from './ContextSelector';
import { ChargeItemsTable, PeriodResult } from './ProvisionalResult';
import './provisionalCharges.css';

interface Props {
  user: AuthenticatedUserResponse; route: ProvisionalRoute;
  onNavigate: (url: string) => void; onSessionExpired: (message: string) => void; onBack: () => void;
}

function errorMessage(error: ProvisionalApiError): string {
  switch (error.code) {
    case 'MISSING_CONTEXT_FIELDS': return m.context;
    case 'INVALID_SESSION': return m.session;
    case 'ACCESS_DENIED': case 'PERIOD_NOT_FOUND': return m.denied;
    case 'TENANCY_TERMINATED_OR_MOVED': return m.moved;
    case 'INVALID_CONTEXT_LINK': return m.invalid;
    case 'PERIOD_SEALED_OR_INVOICE_ISSUED': return m.closed;
    case 'CONTEXT_STALE_CONCURRENCY_CONFLICT': return m.concurrency;
    case 'CALCULATION_OR_SOURCE_DATA_INVALID': return m.source;
    default: return m.readFailure;
  }
}

export function ProvisionalForbidden({ onBack }: { onBack: () => void }) {
  return <section className="pc-page" aria-labelledby="pc-title">
    <h1 id="pc-title">{m.title}</h1>
    <div className="pc-state pc-state--error" role="alert"><h2>Không có quyền truy cập</h2><p>{m.denied}</p>
      <button className="pc-button" type="button" onClick={onBack}>Về tổng quan</button>
    </div>
  </section>;
}

// The boundary stays outside the data hook: a wrong-role URL never sends a business request.
export function ProvisionalChargesPage(props: Props) {
  return props.user.role !== props.route.role
    ? <ProvisionalForbidden onBack={props.onBack} /> : <AuthorizedPage {...props} />;
}

function AuthorizedPage({ user, route, onNavigate, onSessionExpired, onBack }: Props) {
  const v = useProvisionalCharges(user, route, onSessionExpired);
  const selector = useRef<HTMLSelectElement>(null);
  useEffect(() => { if (route.invalid && !v.listLoading) selector.current?.focus(); }, [route.invalid, v.listLoading]);
  const reset = () => {
    if (route.roomId || route.periodId || route.invalid) onNavigate(provisionalUrl({ role: route.role }));
    else v.reload();
  };
  const scopeError = v.error && ['TENANCY_TERMINATED_OR_MOVED', 'INVALID_CONTEXT_LINK', 'PERIOD_NOT_FOUND',
    'PERIOD_SEALED_OR_INVOICE_ISSUED', 'MISSING_CONTEXT_FIELDS'].includes(v.error.code);
  const denied = v.error?.code === 'ACCESS_DENIED';
  const busy = v.listLoading || v.loading || v.refreshing;
  const emptyList = v.list && !v.list.periods.length && !v.detail && !v.loading && !v.error;
  return <section className="pc-page" aria-labelledby="pc-title">
    <header className="pc-page-heading">
      <div><h1 id="pc-title">{m.title}</h1><p>{m.intro}</p></div>
      <button type="button" className="pc-button" disabled={busy} onClick={v.reload}>
        {v.refreshing ? 'Đang tải lại…' : 'Tải lại'}
      </button>
    </header>
    <ContextSelector route={route} periods={v.list?.periods ?? []} detail={v.detail}
      loading={v.listLoading} onNavigate={onNavigate} roomRef={selector} />
    <div className="pc-announcement" role="status" aria-live="polite" aria-atomic="true">
      {v.loading ? 'Đang tải tạm tính cho kỳ đã chọn.' : v.refreshing ? 'Đang kiểm tra lại phạm vi và dữ liệu.'
        : v.detail ? `${v.detail.summary.displayLabel}. ${v.stale ? 'Chưa cập nhật.' : 'Đã kiểm tra dữ liệu.'}` : ''}
    </div>
    {v.error && (v.detail ? <div className="pc-notice" role="alert">
      <strong>Chưa cập nhật</strong><p>{v.error.code === 'CONTEXT_STALE_CONCURRENCY_CONFLICT' ? m.concurrency : m.reloadFailure}</p>
      <button type="button" className="pc-button" disabled={busy} onClick={v.reload}>Thử tải lại</button>
    </div> : <div className="pc-state pc-state--error" role="alert">
      <h2>{denied ? 'Không có quyền truy cập' : 'Chưa thể xem tạm tính'}</h2>
      <p>{errorMessage(v.error)}</p>
      <button type="button" className="pc-button" disabled={busy} onClick={denied ? onBack : scopeError ? reset : v.reload}>
        {denied ? 'Về tổng quan' : v.error.code === 'TENANCY_TERMINATED_OR_MOVED' ? 'Tải lại phạm vi'
          : v.error.code === 'PERIOD_SEALED_OR_INVOICE_ISSUED' ? 'Tải lại danh sách kỳ' : scopeError ? 'Tải lại danh sách' : 'Thử lại'}
      </button>
    </div>)}
    {v.listLoading && !v.detail && !v.loading && <div className="pc-state" aria-busy="true"><p>Đang tải danh sách phòng và kỳ…</p></div>}
    {v.loading && <div className="pc-skeleton" aria-busy="true" aria-label="Đang tải chi tiết tạm tính">
      <div /><div /><div /><div /><p>Đang tải chi tiết tạm tính…</p>
    </div>}
    {emptyList && <div className="pc-state"><h2>{v.list?.code === 'NO_ACTIVE_TENANCY' ? m.noTenancy : m.noPeriods}</h2>
      <p>Chỉ các kỳ còn mở, chưa phát hành hóa đơn mới xuất hiện tại đây.</p></div>}
    {!busy && !v.error && !emptyList && !v.detail && <div className="pc-state">
      <h2>{m.choose}</h2><p>{route.roomId ? 'Chọn một kỳ của phòng để xem các khoản.' : 'Mỗi lần xem chỉ gồm một phòng và một kỳ.'}</p>
    </div>}
    {v.detail && <div className="pc-result" aria-busy={v.refreshing}>
      <PeriodResult detail={v.detail} stale={v.stale} checkedAt={v.checkedAt} />
      {route.role === 'HOST' && <InvoiceDraftAction key={v.detail.periodId} periodId={v.detail.periodId} disabled={busy || v.stale} />}
      <ChargeItemsTable items={v.detail.items} />
      <div className={`pc-total pc-total--${v.detail.summary.status.toLowerCase()}`}>
        <div><h2>{v.detail.summary.displayLabel}</h2>
          <p>{v.detail.summary.calculatedItemsCount} khoản đã tính{v.detail.summary.missingItemsCount > 0 ? `, ${v.detail.summary.missingItemsCount} khoản còn thiếu dữ liệu` : ''}.</p>
          {v.detail.summary.status === 'PARTIAL' && <p>Tổng một phần, chưa bao gồm các khoản chưa tính được.</p>}
        </div>
        <SummaryAmount value={v.detail.summary.totalAmount} />
      </div>
    </div>}
  </section>;
}

function InvoiceDraftAction({ periodId, disabled }: { periodId: string; disabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function openDraft() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const path = invoicePath('host');
      const { invoiceId } = await invoiceRequest<{ invoiceId: string }>(path + '/drafts', undefined, { periodId });
      window.location.assign(path + '/' + encodeURIComponent(invoiceId));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Chưa thể tạo hóa đơn nháp.');
    } finally { setBusy(false); }
  }
  return <div>
    <button type="button" className="pc-button" disabled={disabled || busy} onClick={() => void openDraft()}>
      {busy ? 'Đang mở hóa đơn…' : 'Mở hoặc tạo hóa đơn nháp'}
    </button>
    {error && <p role="alert">{error}</p>}
  </div>;
}

function SummaryAmount({ value }: { value: string | null }) {
  return <p className="pc-total-amount" data-testid="provisional-total">{value === null ? 'Chưa đủ dữ liệu để tạm tính' : formatProvisionalVnd(value)}</p>;
}
