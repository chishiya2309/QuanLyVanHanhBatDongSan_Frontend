import type { ChangeEvent, FC } from 'react';
import { useLogin } from '../../hooks/useLogin';
import { initiateGoogleLogin } from '../../services/authApi';
import type { AuthenticatedUserResponse } from '../../types/auth';
import type { AuthNotice } from '../../types/changePassword';
import './changePassword.css';

interface LoginFormProps {
  onNavigateToRegister: () => void;
  onSuccess?: (user: AuthenticatedUserResponse) => void;
  initialLoginName?: string;
  googleError?: string | null;
  sessionError?: string | null;
  onDismissSessionError?: () => void;
  authNotice?: AuthNotice | null;
  onDismissAuthNotice?: () => void;
  onForgotPassword?: () => void;
}

export const LoginForm: FC<LoginFormProps> = ({
  onNavigateToRegister,
  onSuccess,
  initialLoginName = '',
  googleError,
  sessionError,
  onDismissSessionError,
  authNotice,
  onDismissAuthNotice,
  onForgotPassword,
}) => {
  const {
    formData,
    fieldErrors,
    generalError,
    successMessage,
    status,
    showPassword,
    handleChange,
    toggleShowPassword,
    handleSubmit,
  } = useLogin(initialLoginName, onSuccess);

  const displayError = generalError || sessionError || googleError;
  const handleFormChange = (event: ChangeEvent<HTMLInputElement>) => {
    onDismissSessionError?.();
    onDismissAuthNotice?.();
    handleChange(event);
  };

  return (
    <div className="form-inner">
      <div className="form-heading-group">
        <h2 className="form-title">Đăng nhập tài khoản</h2>
        <p className="form-subtitle">
          Chào mừng bạn quay trở lại! Vui lòng nhập thông tin để truy cập.
        </p>
      </div>

      {authNotice && <div className={`alert-banner auth-notice ${authNotice.kind === 'success' ? 'alert-success' : 'alert-error'}`}
        role={authNotice.kind === 'success' ? 'status' : 'alert'}>
        <span>{authNotice.message}</span>
        <button type="button" className="auth-notice-close" aria-label="Đóng thông báo" onClick={onDismissAuthNotice}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>}

      {/* Alert Banner: Lỗi hệ thống hoặc lỗi Google */}
      {displayError && (
        <div className="alert-banner alert-error" role="alert" aria-live="polite">
          <svg
            className="alert-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{displayError}</span>
        </div>
      )}

      {/* Alert Banner: Thành công */}
      {successMessage && (
        <div className="alert-banner alert-success" role="status" aria-live="polite">
          <svg
            className="alert-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      <form className="auth-form" onSubmit={(event) => { onDismissSessionError?.(); onDismissAuthNotice?.(); void handleSubmit(event); }} noValidate>
        {/* Tên đăng nhập */}
        <div className={`form-field ${fieldErrors.loginName ? 'has-error' : ''}`}>
          <label className="field-label" htmlFor="loginName">
            Tên đăng nhập <span className="required-indicator">*</span>
          </label>
          <div className="input-container">
            <span className="input-icon" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
              </svg>
            </span>
            <input
              className="text-input"
              id="loginName"
              name="loginName"
              type="text"
              autoComplete="username"
              placeholder="Nhập tên đăng nhập của bạn"
              value={formData.loginName}
              onChange={handleFormChange}
              disabled={status === 'loading'}
              aria-invalid={!!fieldErrors.loginName}
              aria-describedby={fieldErrors.loginName ? 'loginName-error' : undefined}
            />
          </div>
          {fieldErrors.loginName && (
            <span className="field-error-message" id="loginName-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {fieldErrors.loginName}
            </span>
          )}
        </div>

        {/* Mật khẩu */}
        <div className={`form-field ${fieldErrors.password ? 'has-error' : ''}`}>
          <label className="field-label" htmlFor="password">
            Mật khẩu <span className="required-indicator">*</span>
          </label>
          <div className="input-container">
            <span className="input-icon" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input
              className="text-input input-password-field"
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu của bạn"
              value={formData.password}
              onChange={handleFormChange}
              disabled={status === 'loading'}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            />
            <button
              type="button"
              className="password-toggle-btn"
              id="togglePassword"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              onClick={toggleShowPassword}
              tabIndex={0}
            >
              {showPassword ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <span className="field-error-message" id="password-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {fieldErrors.password}
            </span>
          )}
        </div>

        {/* Tiện ích: Ghi nhớ & Quên mật khẩu */}
        <div className="form-utilities">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="rememberMe"
              className="checkbox-input"
              checked={formData.rememberMe}
              onChange={handleFormChange}
              disabled={status === 'loading'}
            />
            <span>Ghi nhớ đăng nhập</span>
          </label>
          <a href="/forgot-password" className="forgot-link" onClick={(event) => {
            if (onForgotPassword) { event.preventDefault(); onDismissAuthNotice?.(); onForgotPassword(); }
          }}>
            Quên mật khẩu?
          </a>
        </div>

        {/* Nút hành động chính */}
        <div>
          <button
            type="submit"
            className={`submit-btn ${status === 'success' ? 'is-success' : ''}`}
            id="submitBtn"
            disabled={status === 'loading'}
          >
            {status === 'loading' && (
              <>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ animation: 'spin 0.8s linear infinite' }}
                  aria-hidden="true"
                >
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
                <span>Đang xác thực…</span>
              </>
            )}
            {status === 'success' && (
              <>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>Đăng nhập thành công! Đang chuyển hướng…</span>
              </>
            )}
            {status !== 'loading' && status !== 'success' && (
              <>
                <span>Đăng nhập hệ thống</span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Đường phân cách */}
      <div className="auth-divider">
        <span className="divider-text">hoặc tiếp tục với</span>
      </div>

      {/* Nút Đăng nhập Google */}
      <button
        type="button"
        className="sso-google-btn"
        onClick={() => { onDismissAuthNotice?.(); initiateGoogleLogin(); }}
        disabled={status === 'loading'}
      >
        <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z"
            fill="#EA4335"
          />
          <path
            d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
            fill="#4285F4"
          />
          <path
            d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.7s.1-2 .4-2.7L1.9 6.4C.7 8.8 0 10.3 0 12s.7 3.2 1.9 5.6l3.7-2.9z"
            fill="#FBBC05"
          />
          <path
            d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.3 7.5 23 12 23z"
            fill="#34A853"
          />
        </svg>
        <span>Đăng nhập với Google</span>
      </button>

      {/* Footer điều hướng sang Đăng ký */}
      <div className="form-footer">
        <p className="register-prompt">
          Chưa có tài khoản?
          <button
            type="button"
            className="register-link"
            onClick={onNavigateToRegister}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              font: 'inherit',
            }}
          >
            Đăng ký dùng thử 30 ngày
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </p>
        <p className="terms-note">
          Bằng việc tiếp tục, bạn đồng ý với{' '}
          <a href="#terms" className="terms-link" onClick={(e) => e.preventDefault()}>
            Điều khoản dịch vụ
          </a>{' '}
          &amp;{' '}
          <a href="#privacy" className="terms-link" onClick={(e) => e.preventDefault()}>
            Chính sách bảo mật
          </a>
          .
        </p>
      </div>
    </div>
  );
};
