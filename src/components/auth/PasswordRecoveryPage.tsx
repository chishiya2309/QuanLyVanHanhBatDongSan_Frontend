import { useEffect, useRef, type ReactNode } from 'react';
import { NarrativePanel } from './NarrativePanel';
import { useForgotPassword, useResetPassword } from '../../hooks/usePasswordRecovery';
import { recoveryMessages as m, type ResetPasswordField } from '../../types/passwordRecovery';
import type { AuthNotice } from '../../types/changePassword';
import './passwordRecovery.css';

function useRecoveryFocus(request: number, selector: string) {
  const region = useRef<HTMLDivElement>(null);
  const handled = useRef(-1);
  useEffect(() => {
    if (handled.current === request) return;
    handled.current = request;
    const element = region.current?.querySelector<HTMLElement>(selector);
    element?.focus(); element?.scrollIntoView?.({ block: 'nearest' });
  }, [request, selector]);
  return region;
}

function RecoveryShell({ children, isolated }: { children: ReactNode; isolated?: boolean }) {
  return <main className={`page-shell recovery-shell${isolated ? ' recovery-shell--isolated' : ''}`}>
    <div className="auth-container">{!isolated && <NarrativePanel />}
      <section className="form-panel recovery-panel" aria-label="Khôi phục mật khẩu">{children}</section>
    </div>
  </main>;
}

function Banner({ children }: { children: string }) {
  return <div className="recovery-error" role="alert" tabIndex={-1}>{children}</div>;
}
function BackToLogin({ onClick }: { onClick: () => void }) {
  return <a className="recovery-back" href="/" onClick={(event) => { event.preventDefault(); onClick(); }}>Quay lại Đăng nhập</a>;
}
function Spinner() { return <span className="recovery-spinner" aria-hidden="true" />; }

export function ForgotPasswordPage({ onLogin, isolated }: { onLogin: () => void; isolated?: boolean }) {
  const c = useForgotPassword();
  const busy = c.status === 'submitting';
  const accepted = c.status === 'accepted';
  const region = useRecoveryFocus(c.focusRequest, accepted ? '[role="status"]' : c.fieldErrors.email ? '#recovery-email' : c.generalError ? '[role="alert"]' : '#recovery-email');
  return <RecoveryShell isolated={isolated}><div className="form-inner recovery-content" ref={region}>
    <header className="recovery-heading"><h2>Quên mật khẩu</h2><p>Nhập email đã dùng để tạo tài khoản để nhận hướng dẫn khôi phục.</p></header>
    {accepted ? <>
      <div className="recovery-accepted" role="status" tabIndex={-1}>{m.accepted}</div>
      <button type="button" className="recovery-button" onClick={c.startAgain}>Gửi yêu cầu khác</button>
    </> : <form className="recovery-form" noValidate aria-busy={busy} onSubmit={(event) => { event.preventDefault(); void c.handleSubmit(); }}>
      {c.generalError && <Banner>{c.generalError}</Banner>}
      <p className="recovery-required">Dấu * là thông tin bắt buộc.</p>
      <div className="recovery-field"><label htmlFor="recovery-email">Email <span aria-hidden="true">*</span></label>
        <input id="recovery-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
          required aria-required="true" aria-invalid={!!c.fieldErrors.email} aria-describedby="recovery-email-help" disabled={busy}
          value={c.email} onChange={(event) => c.handleChange(event.target.value)} onBlur={c.handleBlur} />
        <p id="recovery-email-help" className={`recovery-help${c.fieldErrors.email ? ' recovery-help--error' : ''}`} aria-live="polite">{c.fieldErrors.email || ''}</p>
      </div>
      <button type="submit" className="recovery-button recovery-button--primary" disabled={busy} aria-busy={busy}>{busy && <Spinner />}{busy ? 'Đang gửi yêu cầu' : 'Gửi yêu cầu'}</button>
    </form>}
    <BackToLogin onClick={onLogin} />
  </div></RecoveryShell>;
}

const labels: Record<ResetPasswordField, string> = { newPassword: 'Mật khẩu mới', confirmPassword: 'Xác nhận mật khẩu mới' };
export function ResetPasswordPage({ token, onLogin, onNewRequest, onSuccess, isolated }: {
  token: string | null; onLogin: () => void; onNewRequest: () => void; onSuccess: (notice: AuthNotice) => void; isolated?: boolean;
}) {
  const c = useResetPassword(token, onSuccess);
  const busy = c.status === 'submitting';
  const firstError = c.fieldErrors.newPassword ? '#reset-newPassword' : c.fieldErrors.confirmPassword ? '#reset-confirmPassword' : null;
  const region = useRecoveryFocus(c.focusRequest, firstError || (c.generalError ? '[role="alert"]' : '#reset-newPassword'));
  return <RecoveryShell isolated={isolated}><div className="form-inner recovery-content" ref={region}>
    <header className="recovery-heading"><h2>Đặt lại mật khẩu</h2><p>Thiết lập mật khẩu mới cho tài khoản RentOps của bạn.</p></header>
    {c.verification === 'checking' && <div className="recovery-checking" role="status"><Spinner />Đang kiểm tra liên kết khôi phục</div>}
    {c.verification === 'invalid' && <><Banner>{c.generalError || m.linkInvalid}</Banner><button type="button" className="recovery-button recovery-button--primary" onClick={onNewRequest}>Gửi yêu cầu khôi phục mới</button></>}
    {c.verification === 'failed' && <><Banner>{c.generalError || m.failure}</Banner><button type="button" className="recovery-button" onClick={() => void c.verify()}>Thử lại</button></>}
    {c.verification === 'valid' && <form className="recovery-form" noValidate aria-busy={busy} onSubmit={(event) => { event.preventDefault(); void c.handleSubmit(); }}>
      {c.generalError && <Banner>{c.generalError}</Banner>}
      <p className="recovery-required">Dấu * là thông tin bắt buộc.</p>
      {(['newPassword', 'confirmPassword'] as const).map((field) => <div className="recovery-field" key={field}>
        <label htmlFor={`reset-${field}`}>{labels[field]} <span aria-hidden="true">*</span></label>
        <div className="recovery-password-wrap">
          <input id={`reset-${field}`} name={field} type={c.visible[field] ? 'text' : 'password'} autoComplete="new-password" required aria-required="true"
            disabled={busy} value={c.formData[field]} onChange={(event) => c.handleChange(field, event.target.value)} onBlur={() => c.handleBlur(field)}
            aria-invalid={!!c.fieldErrors[field]} aria-describedby={`reset-${field}-help`} />
          <button type="button" className="recovery-toggle" disabled={busy} aria-label={`${c.visible[field] ? 'Ẩn' : 'Hiện'} ${labels[field].toLocaleLowerCase('vi')}`} aria-pressed={!!c.visible[field]}
            onPointerDown={(event) => event.preventDefault()} onClick={(event) => { c.toggleVisibility(field); event.currentTarget.parentElement?.querySelector<HTMLInputElement>('input')?.focus(); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{c.visible[field] && <path d="m3 3 18 18" />}</svg>
          </button>
        </div>
        <p id={`reset-${field}-help`} className={`recovery-help${c.fieldErrors[field] ? ' recovery-help--error' : ''}`} aria-live="polite">{c.fieldErrors[field] || (field === 'newPassword' ? 'Tối thiểu 8 ký tự, tối đa 72 byte UTF-8.' : '')}</p>
      </div>)}
      <button type="submit" className="recovery-button recovery-button--primary" disabled={busy} aria-busy={busy}>{busy && <Spinner />}{busy ? 'Đang đặt lại mật khẩu' : 'Đặt lại mật khẩu'}</button>
    </form>}
    <BackToLogin onClick={onLogin} />
  </div></RecoveryShell>;
}
