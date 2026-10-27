import type { FC } from 'react';

export const NarrativePanel: FC = () => {
  return (
    <section className="narrative-panel" aria-label="Giới thiệu giải pháp RentOps">
      <div>
        {/* Brand Masthead */}
        <div className="brand-masthead">
          <div className="brand-icon" aria-hidden="true">
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
  );
};
