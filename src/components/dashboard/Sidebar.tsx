import React from 'react';

interface SidebarProps {
  showHostAccounts?: boolean; hostAccountsActive?: boolean;
  showAssets?: boolean; assetsActive?: boolean; onNavigateAssets?: () => void;
  showProperties?: boolean; propertiesActive?: boolean; onNavigateProperties?: () => void;
  showRooms?: boolean; roomsActive?: boolean; onNavigateRooms?: () => void;
  showContracts?: boolean; contractsActive?: boolean; onNavigateContracts?: () => void;
  onNavigateOverview?: () => void; onNavigateHostAccounts?: () => void;
}
export const Sidebar: React.FC<SidebarProps> = ({
  showHostAccounts = false,
  hostAccountsActive = false,
  showAssets = false,
  assetsActive = false,
  showProperties = false,
  propertiesActive = false,
  showRooms = false,
  roomsActive = false,
  showContracts = false,
  contractsActive = false,
  onNavigateAssets,
  onNavigateProperties,
  onNavigateRooms,
  onNavigateContracts,
  onNavigateOverview,
  onNavigateHostAccounts,
}) => {
  const isOverviewActive = !hostAccountsActive && !assetsActive && !propertiesActive && !roomsActive && !contractsActive;

  return (
    <aside className="dash-sidebar" aria-label="Thanh điều hướng chính">
      <div className="dash-nav-group">
        <span className="dash-nav-header">Vận hành</span>

        <button type="button" className={`dash-nav-item${isOverviewActive ? ' is-active' : ''}`} aria-current={isOverviewActive ? 'page' : undefined} onClick={onNavigateOverview}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Tổng quan</span>
        </button>

        {showProperties && (
          <button
            type="button"
            className={`dash-nav-item${propertiesActive ? ' is-active' : ''}`}
            aria-current={propertiesActive ? 'page' : undefined}
            onClick={onNavigateProperties}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
            </svg>
            <span>Cơ sở &amp; Tòa nhà</span>
          </button>
        )}

        {showRooms ? (
          <button
            type="button"
            className={`dash-nav-item${roomsActive ? ' is-active' : ''}`}
            aria-current={roomsActive ? 'page' : undefined}
            onClick={onNavigateRooms}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Mặt bằng &amp; Phòng</span>
          </button>
        ) : (
          <button type="button" className="dash-nav-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Phòng &amp; Căn hộ</span>
          </button>
        )}

        {showAssets && <button type="button" className={`dash-nav-item${assetsActive ? ' is-active' : ''}`} aria-current={assetsActive ? 'page' : undefined} onClick={onNavigateAssets}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 5V3h8v2M3 11h18M10 11v4h4v-4" /></svg>
          <span>Tài sản</span>
        </button>}

        <button type="button" className="dash-nav-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>Khách thuê</span>
        </button>

        {showContracts ? (
          <button
            type="button"
            className={`dash-nav-item${contractsActive ? ' is-active' : ''}`}
            aria-current={contractsActive ? 'page' : undefined}
            onClick={onNavigateContracts}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>Hợp đồng đặt cọc</span>
          </button>
        ) : (
          <button type="button" className="dash-nav-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>Hợp đồng đặt cọc</span>
          </button>
        )}

        <span className="dash-nav-header" style={{ marginTop: '12px' }}>Dịch vụ &amp; Tài chính</span>

        <button type="button" className="dash-nav-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span>Chỉ số Điện &amp; Nước</span>
        </button>

        <button type="button" className="dash-nav-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <span>Báo cáo Dòng tiền</span>
        </button>

        <button type="button" className="dash-nav-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>Cấu hình hệ thống</span>
        </button>
        {showHostAccounts && <>
          <span className="dash-nav-header">Tài khoản</span>
          <button type="button" className={`dash-nav-item${hostAccountsActive ? ' is-active' : ''}`} aria-current={hostAccountsActive ? 'page' : undefined} onClick={onNavigateHostAccounts}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="10" r="2" /><path d="M5 17v-1a3 3 0 0 1 6 0v1m3-7h4m-4 4h4" /></svg>
            <span>Tài khoản Host</span>
          </button>
        </>}
      </div>

      {!hostAccountsActive && !assetsActive && !propertiesActive && !roomsActive && !contractsActive && (
        <div className="dash-sidebar-footer">
          <div className="system-status-box">
            <div>
              <span className="system-status-dot" aria-hidden="true" />
              <strong style={{ color: 'var(--color-ink)' }}>RentOps v2.4</strong>
            </div>
            <div style={{ marginTop: '2px' }}>Dữ liệu đồng bộ lúc 14:30</div>
          </div>
        </div>
      )}
    </aside>
  );
};
