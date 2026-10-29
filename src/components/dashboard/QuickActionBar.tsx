import React from 'react';

interface QuickActionBarProps {
  onActionClick: (actionKey: string) => void;
}

export const QuickActionBar: React.FC<QuickActionBarProps> = ({ onActionClick }) => {
  return (
    <nav className="quick-action-bar" aria-label="Thao tác nhanh">
      <button
        type="button"
        className="quick-action-btn is-primary"
        onClick={() => onActionClick('create-contract')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Tạo hợp đồng mới</span>
      </button>

      <button
        type="button"
        className="quick-action-btn"
        onClick={() => onActionClick('add-tenant')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="8.5" cy="7" r="4"></circle>
          <line x1="20" y1="8" x2="20" y2="14"></line>
          <line x1="23" y1="11" x2="17" y2="11"></line>
        </svg>
        <span>Thêm khách thuê</span>
      </button>

      <button
        type="button"
        className="quick-action-btn"
        onClick={() => onActionClick('record-utilities')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        <span>Ghi chỉ số điện/nước</span>
      </button>

      <button
        type="button"
        className="quick-action-btn"
        onClick={() => onActionClick('report-issue')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>Báo sự cố &amp; bảo trì</span>
      </button>
    </nav>
  );
};
