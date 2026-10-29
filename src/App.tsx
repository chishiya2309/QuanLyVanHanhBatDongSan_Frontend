import { useState, type FormEvent } from 'react';
import { NarrativePanel } from './components/auth/NarrativePanel';
import { RegisterHostPage } from './components/auth/RegisterHostPage';
import { DashboardShell } from './components/dashboard/DashboardShell';
import { mockCurrentUser } from './mocks/dashboardMockData';

export default function App() {
  const [view, setView] = useState<'login' | 'register' | 'dashboard'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleLoginSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (submitState !== 'idle') return;
    
    setSubmitState('loading');
    setTimeout(() => {
      setSubmitState('success');
      setTimeout(() => {
        setSubmitState('idle');
        setView('dashboard');
      }, 700);
    }, 800);
  };

  if (view === 'dashboard') {
    return (
      <DashboardShell
        user={mockCurrentUser}
        onLogout={() => {
          setView('login');
          setSubmitState('idle');
        }}
      />
    );
  }

  if (view === 'register') {
    return (
      <RegisterHostPage
        onNavigateToLogin={() => setView('login')}
        onSuccess={(registeredEmail) => {
          setIdentifier(registeredEmail);
          setView('login');
        }}
      />
    );
  }

  return (
    <main className="page-shell">
      <div className="auth-container">
        
        {/* LEFT PANEL: Reusable Brand Narrative */}
        <NarrativePanel />

        {/* RIGHT PANEL: Authentication Form */}
        <section className="form-panel" aria-label="Khu vực đăng nhập">
          <div className="form-inner">
            
            <div className="form-heading-group">
              <h2 className="form-title">Đăng nhập tài khoản</h2>
              <p className="form-subtitle">Chào mừng bạn quay trở lại! Vui lòng nhập thông tin để truy cập.</p>
            </div>

            <form className="auth-form" onSubmit={handleLoginSubmit}>
              
              {/* Identifier Field */}
              <div className="form-field">
                <label className="field-label" htmlFor="identifier">
                  Email hoặc Số điện thoại <span className="required-indicator">*</span>
                </label>
                <div className="input-container">
                  <span className="input-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="4"></circle>
                      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path>
                    </svg>
                  </span>
                  <input
                    className="text-input"
                    id="identifier"
                    type="text"
                    required
                    placeholder="vidu@rentops.vn hoặc 0901234567"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="form-field">
                <label className="field-label" htmlFor="password">
                  Mật khẩu <span className="required-indicator">*</span>
                </label>
                <div className="input-container">
                  <span className="input-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </span>
                  <input
                    className="text-input input-password-field"
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Nhập mật khẩu của bạn"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    id="togglePassword"
                    aria-label="Ẩn hiện mật khẩu"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span id="eyeIcon" style={{ display: 'flex', alignItems: 'center' }} aria-hidden="true">
                      {showPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                          <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      )}
                    </span>
                  </button>
                </div>
              </div>

              {/* Utilities: Remember & Forgot */}
              <div className="form-utilities">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Ghi nhớ đăng nhập</span>
                </label>
                <a href="javascript:void(0)" className="forgot-link">Quên mật khẩu?</a>
              </div>

              {/* Primary Submit Button */}
              <div>
                <button
                  type="submit"
                  className={`submit-btn ${submitState === 'success' ? 'is-success' : ''}`}
                  id="submitBtn"
                  disabled={submitState === 'loading'}
                >
                  {submitState === 'loading' && (
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
                      <span>Đang xác thực…</span>
                    </>
                  )}
                  {submitState === 'success' && (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      <span>Đăng nhập thành công! Đang chuyển hướng…</span>
                    </>
                  )}
                  {submitState === 'idle' && (
                    <>
                      <span>Đăng nhập hệ thống</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Divider */}
            <div className="auth-divider">
              <span className="divider-text">hoặc tiếp tục với</span>
            </div>

            {/* Google SSO Button */}
            <button
              type="button"
              className="sso-google-btn"
              onClick={() => {
                setSubmitState('loading');
                setTimeout(() => {
                  setSubmitState('success');
                  setTimeout(() => {
                    setSubmitState('idle');
                    setView('dashboard');
                  }, 600);
                }, 600);
              }}
            >
              <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z" fill="#EA4335"></path>
                <path d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" fill="#4285F4"></path>
                <path d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.7s.1-2 .4-2.7L1.9 6.4C.7 8.8 0 10.3 0 12s.7 3.2 1.9 5.6l3.7-2.9z" fill="#FBBC05"></path>
                <path d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.3 7.5 23 12 23z" fill="#34A853"></path>
              </svg>
              <span>Đăng nhập với Google</span>
            </button>

            {/* Form Footer Links */}
            <div className="form-footer">
              <p className="register-prompt">
                Chưa có tài khoản?
                <button
                  type="button"
                  className="register-link"
                  onClick={() => setView('register')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
                >
                  Đăng ký dùng thử 30 ngày
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </p>
              <p className="terms-note">
                Bằng việc tiếp tục, bạn đồng ý với{' '}
                <a href="javascript:void(0)" className="terms-link">Điều khoản dịch vụ</a>
                {' '}&amp;{' '}
                <a href="javascript:void(0)" className="terms-link">Chính sách bảo mật</a>.
              </p>
            </div>

          </div>
        </section>

      </div>
    </main>
  );
}
