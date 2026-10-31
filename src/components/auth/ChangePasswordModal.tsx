import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useChangePassword } from '../../hooks/useChangePassword';
import { changePasswordFields, type AuthNotice, type ChangePasswordField } from '../../types/changePassword';
import './changePassword.css';

interface ChangePasswordModalProps {
  onClose: () => void;
  onAuthenticationEnded: (notice: AuthNotice) => void;
}

const labels: Record<ChangePasswordField, string> = {
  currentPassword: 'Mật khẩu hiện tại', newPassword: 'Mật khẩu mới', confirmPassword: 'Xác nhận mật khẩu mới',
};

export function ChangePasswordModal({ onClose, onAuthenticationEnded }: ChangePasswordModalProps) {
  const c = useChangePassword(onAuthenticationEnded);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const handledFocus = useRef(0);
  const isSubmitting = c.status === 'submitting';
  const isForbidden = c.status === 'forbidden';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflowY;
    document.body.style.overflowY = 'hidden';
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('input')?.focus();
    return () => {
      dialog.close();
      document.body.style.overflowY = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  useEffect(() => {
    if (c.focusRequest === handledFocus.current) return;
    handledFocus.current = c.focusRequest;
    const field = changePasswordFields.find((key) => c.fieldErrors[key]);
    const element = field ? dialogRef.current?.querySelector<HTMLElement>(`#change-${field}`)
      : dialogRef.current?.querySelector<HTMLElement>('[role="alert"]');
    element?.focus();
    element?.scrollIntoView?.({ block: 'nearest' });
  }, [c.focusRequest, c.fieldErrors]);

  const requestClose = () => { if (!isSubmitting) onClose(); };

  return createPortal(<dialog ref={dialogRef} className="change-dialog" tabIndex={-1}
    aria-modal="true" aria-labelledby="change-title" aria-describedby="change-description"
    onCancel={(event) => { event.preventDefault(); requestClose(); }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) requestClose();
    }}
    onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); requestClose(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); event.currentTarget.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) {
        event.preventDefault(); first.focus();
      }
    }}>
    <header className="change-header">
      <div className="change-heading">
        <h2 id="change-title">Đổi mật khẩu</h2>
        <p id="change-description">Sau khi đổi mật khẩu, bạn sẽ đăng xuất khỏi tất cả thiết bị.</p>
      </div>
      <button type="button" className="change-icon-button" aria-label="Đóng cửa sổ đổi mật khẩu" disabled={isSubmitting} onClick={requestClose}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
      </button>
    </header>
    <form className="change-form" noValidate aria-busy={isSubmitting} onSubmit={(event) => { event.preventDefault(); void c.handleSubmit(); }}>
      <div className="change-body">
        {c.generalError && <div className="change-alert" role="alert" tabIndex={-1}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 3v1" /></svg>
          <span>{c.generalError}</span>
        </div>}
        {!isForbidden && <>
          <p className="change-required">Dấu * là thông tin bắt buộc.</p>
          {changePasswordFields.map((field) => {
            const id = `change-${field}`;
            const error = c.fieldErrors[field];
            return <div className="change-field" key={field}>
              <label htmlFor={id}>{labels[field]} <span aria-hidden="true">*</span></label>
              <div className="change-input-wrap">
                <input id={id} name={field} type={c.visibleFields[field] ? 'text' : 'password'} required aria-required="true"
                  autoComplete={field === 'currentPassword' ? 'current-password' : 'new-password'}
                  value={c.formData[field]} onChange={(event) => c.handleChange(field, event.target.value)}
                  onBlur={() => c.handleBlur(field)} disabled={isSubmitting} aria-invalid={!!error} aria-describedby={`${id}-help`} />
                <button type="button" className="change-icon-button change-toggle" disabled={isSubmitting}
                  aria-label={`${c.visibleFields[field] ? 'Ẩn' : 'Hiện'} ${labels[field].toLocaleLowerCase('vi')}`}
                  aria-pressed={!!c.visibleFields[field]} onPointerDown={(event) => event.preventDefault()}
                  onClick={(event) => { c.toggleVisibility(field); event.currentTarget.parentElement?.querySelector<HTMLInputElement>('input')?.focus(); }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
                    {c.visibleFields[field] && <path d="m3 3 18 18" />}
                  </svg>
                </button>
              </div>
              <p id={`${id}-help`} className={`change-help${error ? ' change-help--error' : ''}`} aria-live="polite">
                {error || (field === 'newPassword' ? 'Tối thiểu 8 ký tự, tối đa 72 byte UTF-8.' : '')}
              </p>
            </div>;
          })}
        </>}
      </div>
      <footer className="change-footer">
        <button type="button" className="change-button" disabled={isSubmitting} onClick={requestClose}>{isForbidden ? 'Đóng' : 'Hủy'}</button>
        {!isForbidden && <button type="submit" className="change-button change-button--primary" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting && <span className="change-spinner" aria-hidden="true" />}
          {isSubmitting ? 'Đang đổi mật khẩu' : 'Đổi mật khẩu'}
        </button>}
      </footer>
    </form>
  </dialog>, document.body);
}
