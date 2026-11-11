import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCustomerAccount } from '../../hooks/useCustomerAccount';
import type { NavigationGuardRegistration } from '../../hooks/useServiceCatalog';
import { CustomerAccountApiError } from '../../services/customerAccountApi';
import { customerAccountMessages as m, type CustomerAccountResponse } from '../../types/customerAccount';
import type { CustomerResponse, CustomerRoute } from '../../types/customer';
import { customerUrl } from '../../utils/customerNavigation';
import { CustomerAccountDialog } from './CustomerAccountDialog';
import './customer-accounts.css';

interface Props {
  customer: CustomerResponse;
  route: CustomerRoute;
  registerGuard?: NavigationGuardRegistration;
  onNavigate: (url: string, replace?: boolean) => void;
  onSessionExpired: (message?: string) => void;
  onForbidden: () => void;
  onProfileRefresh: () => void;
  onUnavailable: (message: string) => void;
}

export function CustomerAccountSection(props: Props) {
  const { customer, route, onNavigate, onProfileRefresh, registerGuard } = props;
  const callbacks = useRef(props);
  const title = useRef<HTMLHeadingElement>(null);
  const requestedVersion = useRef(customer.version);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  useLayoutEffect(() => { callbacks.current = props; });
  useEffect(() => {
    if (notice?.kind !== 'success') return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const failure = useCallback((error: unknown) => {
    if (!(error instanceof CustomerAccountApiError)) return false;
    if (error.status !== 401 && error.status !== 404 && !(error.status === 403 && error.message === m.forbidden)) return false;
    callbacks.current.registerGuard?.(null);
    if (error.status === 401) callbacks.current.onSessionExpired(m.sessionInvalid);
    else if (error.status === 403) callbacks.current.onForbidden();
    else {
      callbacks.current.onUnavailable(m.notFound);
      callbacks.current.onNavigate(customerUrl(callbacks.current.route), true);
    }
    return true;
  }, []);
  const account = useCustomerAccount(customer.id, failure);
  const updated = (result: CustomerAccountResponse) => {
    account.update(result);
    if (result.customerVersion !== customer.version && result.customerVersion !== requestedVersion.current) {
      requestedVersion.current = result.customerVersion; onProfileRefresh();
    }
  };
  const close = () => onNavigate(customerUrl(route, { customerId: customer.id }), true);
  const finished = (result: CustomerAccountResponse, message: string, kind: 'success' | 'error') => {
    updated(result); setNotice({ kind, message }); close();
  };
  return (
    <section className="customer-account-section" aria-labelledby={`account-${customer.id}`}>
      <div className="customer-account-header">
        <div>
          <h2 id={`account-${customer.id}`} ref={title} tabIndex={-1}>Tài khoản truy cập</h2>
          <p className="customer-account-hint">Cấp và quản lý quyền truy cập RentOps của khách thuê.</p>
        </div>
        {!account.loading && !account.error && account.account && <button type="button" className="customer-button"
          onClick={() => onNavigate(customerUrl(route, { customerId: customer.id,
            accountAction: !account.account?.hasAccount ? 'provision' : account.account.status === 'ACTIVE' ? 'lock' : 'unlock' }))}>
          {!account.account.hasAccount ? 'Cấp tài khoản' : account.account.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
        </button>}
      </div>
      {notice && <div className={`customer-banner${notice.kind === 'error' ? ' customer-banner--error' : ''}`} role={notice.kind === 'success' ? 'status' : 'alert'}>
        <p>{notice.message}</p><button type="button" className="customer-button" onClick={() => setNotice(null)}>Đóng thông báo</button>
      </div>}
      {account.loading ? <div role="status" className="customer-account-skeleton"><span aria-hidden="true" />Đang tải thông tin tài khoản…</div>
        : account.error ? <div role="alert" className="customer-error"><p>{account.error}</p><button type="button" className="customer-button" onClick={account.refresh}>Thử lại</button></div>
          : account.account?.hasAccount ? <dl className="customer-account-facts">
            <div><dt>Email đăng nhập</dt><dd>{account.account.loginName}</dd></div>
            <div><dt>Trạng thái tài khoản</dt><dd><span className={`customer-account-status ${account.account.status === 'ACTIVE' ? 'is-active' : 'is-locked'}`}>
              {account.account.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}</span></dd></div>
          </dl> : <p className="customer-account-hint">{m.noAccount}</p>}
      {route.accountAction && !route.invalid && <CustomerAccountDialog key={`${customer.id}-${route.accountAction}`}
        customer={customer} action={route.accountAction} registerGuard={registerGuard} onFailure={failure}
        onUpdated={updated} onProfileRefresh={onProfileRefresh} onFinished={finished} onClose={close}
        onRestoreFocus={() => title.current?.focus()} />}
    </section>
  );
}
