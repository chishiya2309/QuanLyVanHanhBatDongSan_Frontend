import { useState, type FormEvent } from 'react';

export default function App() {
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
      }, 1500);
    }, 1000);
  };

  return (
    <main className="page-shell">
      <div className="auth-container">
        
        {/* LEFT PANEL: Brand Narrative & Real Estate Operations Teaser */}
        <section className="narrative-panel" aria-label="Giới thiệu giải pháp RentOps">
          <div>
            {/* Brand Masthead */}
            <div className="brand-masthead">
              <div className="brand-icon" aria-hidden="true">
                {/* Architectural Apartment Building Glyph */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="2" width="16" height="20" rx="2"></rect>
                  <path d="M9 22v-4h6v4"></path>
                  <path d="M8 6h.01"></path>
                  <path d="M16 6h.01"></path>
                  <path d="M8 10h.01"></path>
                  <path d="M16 10h.01"></path>
                  <path d="M8 14h.01"></path>
                  <path d="M16 14h.01"></path>
                </svg>
              </div>
              <div>
                <p className="brand-title">RentOps<span className="brand-dot">.</span></p>
                <p className="brand-subtitle">Nền tảng quản lý vận hành bất động sản</p>
              </div>
            </div>

            {/* Hero Narrative */}
            <div className="hero-copy">
              <h1 className="hero-heading">Quản lý nhà cho thuê gọn, chuẩn, đúng hạn.</h1>
              <p className="hero-lead">Nền tảng số hóa toàn diện dành riêng cho chủ nhà trọ, căn hộ dịch vụ và chuỗi chung cư mini hiện đại.</p>
            </div>

            {/* Operations Signature: Live Property Status Snapshot */}
            <div className="operations-teaser">
              <div className="teaser-header">
                <p className="teaser-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="4" y="2" width="16" height="20" rx="2"></rect>
                    <path d="M9 22v-4h6v4"></path>
                    <path d="M8 6h.01"></path>
                    <path d="M16 6h.01"></path>
                    <path d="M8 10h.01"></path>
                    <path d="M16 10h.01"></path>
                    <path d="M8 14h.01"></path>
                    <path d="M16 14h.01"></path>
                  </svg>
                  Tòa nhà An Phú (Tầng 2 &amp; 3)
                </p>
                <span className="teaser-status-chip">Lấp đầy 94%</span>
              </div>

              {/* Mini Floor Plan Matrix */}
              <div className="room-grid">
                <div className="room-chip">
                  <span className="room-name">P.201</span>
                  <span className="room-state room-state-occupied">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    Đang thuê
                  </span>
                </div>
                <div className="room-chip">
                  <span className="room-name">P.202</span>
                  <span className="room-state room-state-billing">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    Đến hạn thu
                  </span>
                </div>
                <div className="room-chip">
                  <span className="room-name">P.203</span>
                  <span className="room-state room-state-vacant">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 21h18"></path>
                      <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"></path>
                      <path d="M15 11h.01"></path>
                    </svg>
                    Phòng trống
                  </span>
                </div>
                <div className="room-chip">
                  <span className="room-name">P.301</span>
                  <span className="room-state room-state-occupied">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    Đang thuê
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Key Differentiators */}
            <div className="capabilities-matrix">
              <div className="capability-item">
                <div className="capability-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="4" y="2" width="16" height="20" rx="2"></rect>
                    <path d="M9 22v-4h6v4"></path>
                    <path d="M8 6h.01"></path>
                    <path d="M16 6h.01"></path>
                    <path d="M8 10h.01"></path>
                    <path d="M16 10h.01"></path>
                    <path d="M8 14h.01"></path>
                    <path d="M16 14h.01"></path>
                  </svg>
                </div>
                <div>
                  <p className="capability-name">Sơ đồ phòng trực quan</p>
                  <p className="capability-desc">Theo tầng &amp; tình trạng thực</p>
                </div>
              </div>

              <div className="capability-item">
                <div className="capability-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                    <path d="M14 14h3v3h-3z"></path>
                    <path d="M20 14v3"></path>
                    <path d="M14 20h7"></path>
                  </svg>
                </div>
                <div>
                  <p className="capability-name">Tự tính điện nước &amp; QR</p>
                  <p className="capability-desc">Gạch nợ tức thì qua SePay</p>
                </div>
              </div>

              <div className="capability-item">
                <div className="capability-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <div>
                  <p className="capability-name">Quản lý hợp đồng</p>
                  <p className="capability-desc">Cảnh báo trước 30 ngày</p>
                </div>
              </div>

              <div className="capability-item">
                <div className="capability-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                  </svg>
                </div>
                <div>
                  <p className="capability-name">Báo cáo dòng tiền</p>
                  <p className="capability-desc">Lấp đầy &amp; công nợ live</p>
                </div>
              </div>
            </div>
          </div>

          {/* Trust Row */}
          <div className="trust-row">
            <div className="city-badges" aria-label="Các thành phố hoạt động">
              <span className="city-badge" title="Hà Nội">HN</span>
              <span className="city-badge" title="TP. Hồ Chí Minh">SG</span>
              <span className="city-badge" title="Đà Nẵng">ĐN</span>
            </div>
            <p className="trust-text">
              Được tin dùng bởi hơn <span className="trust-highlight">1.200+ chủ nhà</span> &amp; đơn vị vận hành toàn quốc.
            </p>
          </div>
        </section>

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
                      <span>Đang xác thực...</span>
                    </>
                  )}
                  {submitState === 'success' && (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      <span>Đăng nhập thành công!</span>
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
            <button type="button" className="sso-google-btn">
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
                <a href="javascript:void(0)" className="register-link">
                  Đăng ký dùng thử 30 ngày
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </a>
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
