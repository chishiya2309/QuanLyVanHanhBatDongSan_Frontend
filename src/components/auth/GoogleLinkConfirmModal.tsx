import { useEffect, useRef, type FC, type FormEvent } from 'react';
import type { GoogleLinkFormData, LoginFieldErrors } from '../../types/auth';
import './authModal.css';

interface GoogleLinkConfirmModalProps {
  isOpen: boolean;
  formData: GoogleLinkFormData;
  fieldErrors: LoginFieldErrors;
  generalError: string | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  showPassword: boolean;
  onToggleShowPassword: () => void;
  onChange: (field: 'loginName' | 'password', value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export const GoogleLinkConfirmModal: FC<GoogleLinkConfirmModalProps> = ({
  isOpen,
  formData,
  fieldErrors,
  generalError,
  status,
  showPassword,
  onToggleShowPassword,
  onChange,
  onSubmit,
  onClose,
}) => {
  const loginInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loginInputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && status !== 'loading') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, status, onClose]);

  if (!isOpen) return null;

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && status !== 'loading') {
          onClose();
        }
      }}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-link-modal-title"
        aria-describedby="google-link-modal-desc"
      >
        <div className="modal-header">
          <span className="modal-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z" fill="#EA4335" />
              <path d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" fill="#4285F4" />
              <path d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.7s.1-2 .4-2.7L1.9 6.4C.7 8.8 0 10.3 0 12s.7 3.2 1.9 5.6l3.7-2.9z" fill="#FBBC05" />
              <path d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.3 7.5 23 12 23z" fill="#34A853" />
            </svg>
            Liên kết tài khoản Google
          </span>
          <h3 className="modal-title" id="google-link-modal-title">
            Xác nhận liên kết tài khoản
          </h3>
          <p className="modal-description" id="google-link-modal-desc">
            Tài khoản Google của bạn chưa được liên kết với hệ thống RentOps. Vui lòng xác nhận bằng tên đăng nhập và mật khẩu tài khoản RentOps hiện có để hoàn tất liên kết.
          </p>
        </div>

        {generalError && (
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
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} noValidate>
          {/* Tên đăng nhập */}
          <div className={`form-field ${fieldErrors.loginName ? 'has-error' : ''}`} style={{ marginBottom: 'var(--space-md)' }}>
            <label className="field-label" htmlFor="link-loginName">
              Tên đăng nhập RentOps <span className="required-indicator">*</span>
            </label>
            <div className="input-container">
              <span className="input-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                ref={loginInputRef}
                className="text-input"
                id="link-loginName"
                name="loginName"
                type="text"
                autoComplete="username"
                placeholder="Nhập tên đăng nhập của bạn"
                value={formData.loginName}
                onChange={(e) => onChange('loginName', e.target.value)}
                aria-invalid={!!fieldErrors.loginName}
                aria-describedby={fieldErrors.loginName ? 'link-loginName-error' : undefined}
                disabled={status === 'loading'}
              />
            </div>
            {fieldErrors.loginName && (
              <span className="field-error-message" id="link-loginName-error" role="alert">
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
            <label className="field-label" htmlFor="link-password">
              Mật khẩu <span className="required-indicator">*</span>
            </label>
            <div className="input-container">
              <span className="input-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                className="text-input input-password-field"
                id="link-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu hiện tại"
                value={formData.password}
                onChange={(e) => onChange('password', e.target.value)}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'link-password-error' : undefined}
                disabled={status === 'loading'}
              />
              <button
                type="button"
                className="password-toggle-btn"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                onClick={onToggleShowPassword}
                tabIndex={0}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <span className="field-error-message" id="link-password-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {fieldErrors.password}
              </span>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={status === 'loading'}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="btn-primary-link"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? (
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
                  <span>Đang liên kết…</span>
                </>
              ) : (
                <span>Xác nhận liên kết</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
