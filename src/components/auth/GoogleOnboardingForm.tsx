import { useLayoutEffect, useRef } from 'react';
import type { useGoogleAuthCallback } from '../../hooks/useGoogleAuthCallback';
import type { GoogleOnboardingForm as FormData } from '../../types/auth';
import { PHONE_NUMBER_HELP } from '../../utils/phoneNumber';
import './googleOnboarding.css';

type Controller = ReturnType<typeof useGoogleAuthCallback>;
export function GoogleOnboardingForm({ controller: c }: { controller: Controller }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const register = c.context?.purpose === 'REGISTER_HOST';
  const busy = c.phase === 'submitting';
  const showForm = c.context && (c.phase === 'ready' || busy || c.phase === 'uncertain');
  useLayoutEffect(() => { if (c.context) heading.current?.focus(); }, [c.context]);
  const fields: { name: keyof FormData; label: string; autoComplete: string; type: string; help?: string }[] = [
    ...(register ? [
      { name: 'fullName' as const, label: 'Họ tên hoặc tên kinh doanh', autoComplete: 'name', type: 'text' },
      { name: 'phoneNumber' as const, label: 'Số điện thoại', autoComplete: 'tel', type: 'tel', help: PHONE_NUMBER_HELP },
    ] : []),
    { name: 'password', label: register ? 'Mật khẩu RentOps' : 'Mật khẩu mới', autoComplete: 'new-password', type: 'password',
      help: 'Tối thiểu 8 ký tự, tối đa 72 byte UTF-8. Dùng mật khẩu này khi đăng nhập bằng email.' },
    { name: 'confirmPassword', label: 'Xác nhận mật khẩu', autoComplete: 'new-password', type: 'password' },
  ];
  return <div className="form-inner form-inner-wide google-onboarding">
    <div className="form-heading-group">
      <h2 className="form-title" ref={heading} tabIndex={-1}>{register || !c.context ? 'Hoàn tất tài khoản của bạn' : 'Đặt mật khẩu để hoàn tất đăng nhập'}</h2>
      {c.context && <p className="form-subtitle">{register
        ? 'Bổ sung thông tin để bắt đầu sử dụng RentOps. Sau đó bạn có thể đăng nhập bằng Google hoặc email và mật khẩu này.'
        : 'Bạn đang xác thực bằng Google. Hãy đặt mật khẩu mới cho tài khoản RentOps; các phiên đăng nhập trước sẽ được kết thúc.'}</p>}
    </div>
    {c.context && <div className="google-onboarding-identity"><div><span>Email Google</span><strong>{c.context.email}</strong></div>
      <button type="button" disabled={busy || c.phase === 'uncertain'} onClick={() => void c.leave(true)}>Đổi tài khoản Google</button></div>}
    {c.error && <div className="alert-banner alert-error" role="alert">{c.error}</div>}
    {c.phase === 'loading' && <p role="status">Đang tải thông tin Google…</p>}
    {showForm && <form noValidate aria-busy={busy} onSubmit={(e) => { e.preventDefault(); void c.submit(); }}>
      <p className="google-onboarding-required">Dấu * là thông tin bắt buộc.</p>
      {fields.map(({ name, label, autoComplete, type, help }) => <div className={`form-field ${c.errors[name] ? 'has-error' : ''}`} key={name}>
        <label className="field-label" htmlFor={`google-${name}`}>{label} <span aria-hidden="true">*</span></label>
        <div className="google-onboarding-input">
          <input className="text-input" id={`google-${name}`} name={name} type={type === 'password' && c.showPassword ? 'text' : type}
            autoComplete={autoComplete} inputMode={type === 'tel' ? 'tel' : undefined} required
            maxLength={name === 'fullName' ? 255 : undefined} value={c.form[name]} disabled={busy || c.phase === 'uncertain'}
            aria-invalid={!!c.errors[name]} aria-describedby={c.errors[name] || help ? `google-${name}-help` : undefined}
            onChange={(e) => c.change(name, e.target.value)} />
          {type === 'password' && <button className="google-password-toggle" type="button" disabled={busy || c.phase === 'uncertain'}
            aria-label={`${c.showPassword ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`} aria-pressed={c.showPassword}
            onClick={() => c.setShowPassword(!c.showPassword)}>{c.showPassword ? 'Ẩn' : 'Hiện'}</button>}
        </div>
        {(c.errors[name] || help) && <span id={`google-${name}-help`} className={c.errors[name] ? 'field-error-message' : 'google-onboarding-help'}
          role={c.errors[name] ? 'alert' : undefined}>{c.errors[name] || help}</span>}
      </div>)}
      {c.phase === 'uncertain' ? <button type="button" className="google-onboarding-primary" onClick={() => void c.recover()}>Kiểm tra kết quả</button>
        : <button className="google-onboarding-primary" type="submit" disabled={busy}>{busy ? 'Đang hoàn tất…' : register ? 'Tạo tài khoản và tiếp tục' : 'Lưu mật khẩu và tiếp tục'}</button>}
    </form>}
    {(c.phase === 'expired' || c.phase === 'failed') && <div className="google-onboarding-retry">
      {c.phase === 'failed' && <button type="button" className="google-onboarding-primary" onClick={c.reload}>Thử tải lại</button>}
      <button type="button" className="google-onboarding-primary" onClick={() => void c.leave(true)}>Tiếp tục lại với Google</button>
    </div>}
    <button type="button" className="google-onboarding-back" disabled={busy || c.phase === 'uncertain'} onClick={() => void c.leave()}>Hủy và quay lại đăng nhập</button>
  </div>;
}
