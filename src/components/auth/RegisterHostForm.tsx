import type { FC } from 'react';
import { useRegisterHost } from '../../hooks/useRegisterHost';

interface RegisterHostFormProps {
  onNavigateToLogin: () => void;
  onSuccess?: (email: string, phone: string) => void;
}

export const RegisterHostForm: FC<RegisterHostFormProps> = ({
  onNavigateToLogin,
  onSuccess,
}) => {
  const {
    formData,
    fieldErrors,
    generalError,
    successMessage,
    status,
    showPassword,
    showConfirmPassword,
    handleChange,
    toggleShowPassword,
    toggleShowConfirmPassword,
    handleSubmit,
  } = useRegisterHost((email, phone) => {
    if (onSuccess) {
      onSuccess(email, phone);
    } else {
      onNavigateToLogin();
    }
  });

  return (
    <div className="form-inner form-inner-wide">
      <div className="form-heading-group">
        <h2 className="form-title">Đăng ký tài khoản Host</h2>
        <p className="form-subtitle">
          Khởi tạo tài khoản quản trị để số hóa toàn diện việc vận hành nhà trọ, căn hộ và chuỗi phòng cho thuê.
        </p>
      </div>

      {/* General Error Banner */}
      {generalError && (
        <div className="alert-banner alert-error" role="alert">
          <svg className="alert-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{generalError}</span>
        </div>
      )}

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="alert-banner alert-success" role="status">
          <svg className="alert-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <div>
            <strong>{successMessage}</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem' }}>Đang chuyển hướng về trang đăng nhập…</p>
          </div>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {/* 1. Họ và tên (Full width) */}
        <div className={`form-field ${fieldErrors.fullName ? 'has-error' : ''}`}>
          <label htmlFor="fullName" className="field-label">
            Họ và tên <span className="required-indicator">*</span>
          </label>
          <div className="input-container">
            <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              placeholder="VD: Nguyễn Văn An"
              className="text-input"
              value={formData.fullName}
              onChange={handleChange}
              disabled={status === 'loading'}
              aria-invalid={!!fieldErrors.fullName}
              aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
            />
          </div>
          {fieldErrors.fullName && (
            <p className="field-error-message" id="fullName-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{fieldErrors.fullName}</span>
            </p>
          )}
        </div>

        {/* 2. Thông tin liên hệ: Email & Số điện thoại (2 cột trên desktop/tablet) */}
        <div className="form-grid-2">
          {/* Email */}
          <div className={`form-field ${fieldErrors.email ? 'has-error' : ''}`}>
            <label htmlFor="email" className="field-label">
              Email <span className="required-indicator">*</span>
            </label>
            <div className="input-container">
              <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="host@example.com"
                className="text-input"
                value={formData.email}
                onChange={handleChange}
                disabled={status === 'loading'}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              />
            </div>
            {fieldErrors.email && (
              <p className="field-error-message" id="email-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{fieldErrors.email}</span>
              </p>
            )}
          </div>

          {/* Số điện thoại */}
          <div className={`form-field ${fieldErrors.phoneNumber ? 'has-error' : ''}`}>
            <label htmlFor="phoneNumber" className="field-label">
              Số điện thoại <span className="required-indicator">*</span>
            </label>
            <div className="input-container">
              <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                autoComplete="tel"
                placeholder="+84901234567"
                className="text-input"
                value={formData.phoneNumber}
                onChange={handleChange}
                disabled={status === 'loading'}
                aria-invalid={!!fieldErrors.phoneNumber}
                aria-describedby={fieldErrors.phoneNumber ? 'phoneNumber-error' : 'phoneNumber-helper'}
              />
            </div>
            <span className="field-helper-text" id="phoneNumber-helper">
              Định dạng quốc tế E.164 (+84...)
            </span>
            {fieldErrors.phoneNumber && (
              <p className="field-error-message" id="phoneNumber-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{fieldErrors.phoneNumber}</span>
              </p>
            )}
          </div>
        </div>

        {/* 3. Bảo mật: Mật khẩu & Xác nhận mật khẩu (2 cột trên desktop/tablet) */}
        <div className="form-grid-2">
          {/* Mật khẩu */}
          <div className={`form-field ${fieldErrors.password ? 'has-error' : ''}`}>
            <label htmlFor="password" className="field-label">
              Mật khẩu <span className="required-indicator">*</span>
            </label>
            <div className="input-container">
              <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Tối thiểu 8 ký tự"
                className="text-input input-password-field"
                value={formData.password}
                onChange={handleChange}
                disabled={status === 'loading'}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={toggleShowPassword}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="field-error-message" id="password-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{fieldErrors.password}</span>
              </p>
            )}
          </div>

          {/* Xác nhận mật khẩu */}
          <div className={`form-field ${fieldErrors.confirmPassword ? 'has-error' : ''}`}>
            <label htmlFor="confirmPassword" className="field-label">
              Xác nhận mật khẩu <span className="required-indicator">*</span>
            </label>
            <div className="input-container">
              <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu"
                className="text-input input-password-field"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={status === 'loading'}
                aria-invalid={!!fieldErrors.confirmPassword}
                aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={toggleShowConfirmPassword}
                aria-label={showConfirmPassword ? 'Ẩn xác nhận mật khẩu' : 'Hiện xác nhận mật khẩu'}
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p className="field-error-message" id="confirmPassword-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{fieldErrors.confirmPassword}</span>
              </p>
            )}
          </div>
        </div>

        {/* Nút Submit */}
        <div style={{ marginTop: 'var(--space-2xs)' }}>
          <button
            type="submit"
            className={`submit-btn ${status === 'success' ? 'is-success' : ''}`}
            disabled={status === 'loading'}
            id="registerSubmitBtn"
          >
            {status === 'loading' && (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }} aria-hidden="true">
                  <line x1="12" y1="2" x2="12" y2="6"></line>
                  <line x1="12" y1="18" x2="12" y2="22"></line>
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                  <line x1="2" y1="12" x2="6" y2="12"></line>
                  <line x1="18" y1="12" x2="22" y2="12"></line>
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                </svg>
                <span>Đang xử lý đăng ký…</span>
              </>
            )}
            {status === 'success' && (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>Đăng ký thành công!</span>
              </>
            )}
            {status !== 'loading' && status !== 'success' && (
              <>
                <span>Đăng ký tài khoản Host</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Footer Navigation */}
      <div className="form-footer">
        <p className="register-prompt">
          Đã có tài khoản quản lý?
          <button
            type="button"
            className="register-link"
            onClick={onNavigateToLogin}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
          >
            Đăng nhập ngay
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </p>
        <p className="terms-note">
          Bằng việc đăng ký tài khoản Host, bạn đồng ý với{' '}
          <a href="#terms" className="terms-link">Điều khoản dịch vụ</a>
          {' '}&amp;{' '}
          <a href="#privacy" className="terms-link">Chính sách bảo mật</a> của RentOps.
        </p>
      </div>
    </div>
  );
};
