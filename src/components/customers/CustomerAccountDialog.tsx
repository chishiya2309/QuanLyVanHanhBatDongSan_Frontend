import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useCustomerAccountDialog } from '../../hooks/useCustomerAccount';
import type { CustomerResponse } from '../../types/customer';
import type { CustomerAccountAction, CustomerAccountResponse } from '../../types/customerAccount';
import type { NavigationGuardRegistration } from '../../hooks/useServiceCatalog';

interface Props {
  customer: CustomerResponse;
  action: NonNullable<CustomerAccountAction>;
  registerGuard?: NavigationGuardRegistration;
  onFailure: (error: unknown) => boolean;
  onUpdated: (account: CustomerAccountResponse) => void;
  onProfileRefresh: () => void;
  onFinished: (account: CustomerAccountResponse, message: string, kind: 'success' | 'error') => void;
  onClose: () => void;
  onRestoreFocus: () => void;
}

export function CustomerAccountDialog({ customer, onRestoreFocus, ...props }: Props) {
  const state = useCustomerAccountDialog({ ...props, customerId: customer.id, contactEmail: customer.email });
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const restore = useRef(onRestoreFocus);
  const readyFocused = useRef(false);
  const id = useId();
  const [visible, setVisible] = useState({ password: false, confirmPassword: false });
  const provision = props.action === 'provision';
  const title = provision ? 'Cấp tài khoản' : props.action === 'lock' ? 'Khóa tài khoản' : 'Mở khóa tài khoản';
  useLayoutEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restoreFocus = restore.current;
    element?.showModal();
    return () => {
      element?.close();
      if (opener?.isConnected && opener !== document.body && !opener.matches(':disabled')) opener.focus(); else restoreFocus();
    };
  }, []);
  useLayoutEffect(() => {
    if (state.loading || !state.snapshot || readyFocused.current) return;
    readyFocused.current = true;
    if (provision) form.current?.querySelector<HTMLInputElement>('[name="email"]')?.focus(); else cancel.current?.focus();
  }, [state.loading, state.snapshot, provision]);
  return (
    <dialog ref={dialog} className="customer-dialog customer-account-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-context`}
      tabIndex={-1} onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]')]
          .filter((node) => node.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (!first) { event.preventDefault(); event.currentTarget.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
      onCancel={(event) => { event.preventDefault(); state.close(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) state.close();
      }}>
      <form ref={form} noValidate aria-busy={state.pending || state.loading} onSubmit={(event) => {
        event.preventDefault();
        void state.submit().then((key) => { if (key) form.current?.querySelector<HTMLInputElement>(`[name="${key}"]`)?.focus(); });
      }}>
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-context`}>Customer: <strong>{customer.fullName}</strong></p>
        {state.loading && <p role="status" className="customer-account-hint">Đang kiểm tra tài khoản…</p>}
        {state.error && <div role="alert" className="customer-error"><p>{state.error}</p></div>}
        {!state.loading && state.snapshot && (provision ? (
          <fieldset disabled={state.pending}>
            <legend className="visually-hidden">Thông tin truy cập mới</legend>
            <div className="customer-field">
              <label htmlFor={`${id}-email`}>Email đăng nhập (bắt buộc)</label>
              <input id={`${id}-email`} name="email" type="email" autoComplete="username" required aria-required="true"
                value={state.fields.email} aria-invalid={!!state.errors.email} aria-describedby={`${id}-email-help`}
                onChange={(event) => state.change('email', event.target.value)} onBlur={() => state.change('email', state.fields.email, true)} />
              <p id={`${id}-email-help`} className={state.errors.email ? 'customer-field-error' : 'customer-account-hint'}>
                {state.errors.email || 'Email đăng nhập độc lập với email liên hệ của Customer.'}
              </p>
            </div>
            {(['password', 'confirmPassword'] as const).map((key) => (
              <div className="customer-field" key={key}>
                <label htmlFor={`${id}-${key}`}>{key === 'password' ? 'Mật khẩu ban đầu' : 'Xác nhận mật khẩu'} (bắt buộc)</label>
                <div className="customer-account-password">
                  <input id={`${id}-${key}`} name={key} type={visible[key] ? 'text' : 'password'} autoComplete="new-password"
                    required aria-required="true" value={state.fields[key]} aria-invalid={!!state.errors[key]}
                    aria-describedby={`${id}-${key}-help`} onChange={(event) => state.change(key, event.target.value)}
                    onBlur={() => state.change(key, state.fields[key], true)} />
                  <button type="button" className="customer-button" aria-controls={`${id}-${key}`} aria-pressed={visible[key]}
                    aria-label={`${visible[key] ? 'Ẩn' : 'Hiện'} ${key === 'password' ? 'mật khẩu ban đầu' : 'xác nhận mật khẩu'}`}
                    onClick={() => setVisible((old) => ({ ...old, [key]: !old[key] }))}>{visible[key] ? 'Ẩn' : 'Hiện'}</button>
                </div>
                <p id={`${id}-${key}-help`} className={state.errors[key] ? 'customer-field-error' : 'customer-account-hint'}>
                  {state.errors[key] || (key === 'password' ? 'Mật khẩu có tối thiểu 8 ký tự và không vượt quá 72 byte UTF-8' : 'Nhập lại chính xác mật khẩu ban đầu.')}
                </p>
              </div>
            ))}
            <p className="customer-account-hint">Host tự bàn giao thông tin truy cập cho Customer ngoài hệ thống.</p>
          </fieldset>
        ) : (
          <div className="customer-account-confirmation">
            <p>Email đăng nhập: <strong>{state.snapshot.loginName}</strong></p>
            <p>{props.action === 'lock' ? 'Customer sẽ bị đăng xuất khỏi mọi thiết bị ngay lập tức' : 'Customer cần tự đăng nhập lại, hệ thống không đăng nhập thay'}</p>
          </div>
        ))}
        {state.error && (!state.snapshot || state.blocked) && <button type="button" className="customer-button" disabled={state.pending || state.loading}
          onClick={() => void state.reload()}>Tải lại</button>}
        <div className="customer-dialog-actions">
          <button ref={cancel} type="button" className="customer-button" disabled={state.pending} onClick={state.close}>Hủy</button>
          <button type="submit" className={`customer-button ${props.action === 'lock' ? 'customer-account-danger' : 'customer-button--primary'}`}
            disabled={state.pending || state.loading || state.blocked || !state.snapshot}>{state.pending ? 'Đang xử lý…' : title}</button>
        </div>
      </form>
    </dialog>
  );
}
