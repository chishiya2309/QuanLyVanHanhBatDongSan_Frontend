import React from 'react';
import type { UserProfile } from '../../types/dashboard';

interface TopbarProps {
  user: UserProfile;
  selectedPropertyId: string;
  onSelectProperty: (propertyId: string) => void;
  onLogout: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  user,
  selectedPropertyId,
  onSelectProperty,
  onLogout,
}) => {
  const userInitials = user.fullName
    .split(' ')
    .slice(-2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <header className="dash-topbar" role="banner">
      <div className="dash-topbar-left">
        <a href="#dashboard" className="dash-brand" aria-label="Trang chủ RentOps">
          <span className="dash-brand-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </span>
          <span>RentOps</span>
        </a>

        <div className="dash-divider-v" aria-hidden="true" />

        {/* Facility / Property Switcher */}
        <div className="property-switcher-container" title="Chọn cơ sở quản lý">
          <label htmlFor="propertySwitcher" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
            Chọn tòa nhà cơ sở
          </label>
          <select
            id="propertySwitcher"
            className="property-switcher-select"
            value={selectedPropertyId}
            onChange={(e) => onSelectProperty(e.target.value)}
          >
            {user.managedProperties.map((prop) => (
              <option key={prop.id} value={prop.id}>
                {prop.name}
              </option>
            ))}
          </select>
          <span className="property-switcher-arrow" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </div>
      </div>

      <div className="dash-topbar-right">
        {/* Notification Bell */}
        <button
          type="button"
          className="notification-btn"
          aria-label="Thông báo hệ thống, 4 việc cần xử lý"
          title="4 thông báo cần xử lý"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span className="notification-badge">4</span>
        </button>

        {/* User Identity */}
        <div className="user-profile-badge">
          <div className="user-avatar" aria-hidden="true">
            {userInitials}
          </div>
          <div className="user-info">
            <span className="user-name">{user.fullName}</span>
            <span className="user-role-tag">
              {user.role === 'LANDLORD' ? 'Chủ cơ sở' : 'Ban quản lý'}
            </span>
          </div>
        </div>

        {/* Quick Logout Action */}
        <button
          type="button"
          className="logout-btn"
          onClick={onLogout}
          title="Đăng xuất khỏi hệ thống"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>Đăng xuất</span>
        </button>
      </div>
    </header>
  );
};
