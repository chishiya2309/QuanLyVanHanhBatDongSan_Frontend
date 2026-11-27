import React, { useEffect, useRef } from 'react';
import { invoicePath } from '../../services/invoiceApi';
import type { HostNotificationItem } from '../../types/autoDraftBilling';
import '../invoice/autoDraftBilling.css';

interface HostNotificationDrawerProps {
  open: boolean;
  items: HostNotificationItem[];
  loading: boolean;
  error: string | null;
  hasNext: boolean;
  markingId: string | null;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onLoadMore: () => void;
  onRefresh: () => void;
  onNavigate?: (path: string) => void;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export const HostNotificationDrawer: React.FC<HostNotificationDrawerProps> = ({
  open,
  items,
  loading,
  error,
  hasNext,
  markingId,
  onClose,
  onMarkAsRead,
  onLoadMore,
  onRefresh,
  onNavigate,
}) => {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (
      onNavigate &&
      event.button === 0 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      onClose();
      onNavigate(path);
    }
  };

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="uc55-drawer-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="uc55-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Thông báo lập hóa đơn tự động"
      >
        <header className="uc55-drawer-header">
          <div>
            <h2>Thông báo lập hóa đơn tự động</h2>
            <p className="uc55-drawer-subtitle">
              Tổng kết tiến trình nền hằng ngày lúc 01:00 AM (UTC+7)
            </p>
          </div>
          <div className="uc55-drawer-header-actions">
            <button
              type="button"
              className="uc55-btn uc55-btn--ghost"
              onClick={onRefresh}
              disabled={loading}
            >
              Làm mới
            </button>
            <button
              ref={closeBtnRef}
              type="button"
              className="uc55-btn uc55-btn--ghost"
              onClick={onClose}
              aria-label="Đóng hòm thư thông báo"
            >
              Đóng
            </button>
          </div>
        </header>

        <div className="uc55-drawer-body">
          {error && (
            <div className="uc55-alert uc55-alert--error" role="alert">
              <span>{error}</span>
              <button type="button" className="uc55-btn uc55-btn--ghost" onClick={onRefresh}>
                Thử lại
              </button>
            </div>
          )}

          {loading && items.length === 0 && (
            <p className="uc55-empty" role="status">
              Đang tải thông báo tổng kết...
            </p>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="uc55-empty">
              <p>Chưa có thông báo tổng kết mới từ tiến trình tự động.</p>
              <a className="uc55-link" href="/billing-schedules" onClick={(e) => handleLinkClick(e, '/billing-schedules')}>
                Xem lịch lập hóa đơn
              </a>
            </div>
          )}

          <ul className="uc55-notif-list">
            {items.map((item) => {
              const meta = item.metadata ?? {};
              const waitingRooms = meta.waitingMeterRooms ?? [];
              const errorRooms = meta.errorRooms ?? [];
              const expiredContracts = meta.expiredContracts ?? [];
              const createdCount = meta.createdCount ?? 0;

              return (
                <li
                  key={item.id}
                  className={`uc55-notif-item${item.read ? ' is-read' : ''}`}
                >
                  <div className="uc55-notif-top">
                    <span className={`uc55-badge ${item.read ? 'uc55-badge--neutral' : 'uc55-badge--accent'}`}>
                      {item.read ? 'Đã đọc' : 'Mới'}
                    </span>
                    <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
                  </div>

                  <h3 className="uc55-notif-title">{item.title}</h3>
                  <p className="uc55-notif-body">{item.body}</p>

                  <div className="uc55-notif-meta">
                    {createdCount > 0 && (
                      <div className="uc55-meta-row">
                        <span>Đã khởi tạo {createdCount} hóa đơn nháp.</span>
                        <a className="uc55-link" href={invoicePath('host')} onClick={(e) => handleLinkClick(e, invoicePath('host'))}>
                          Rà soát hóa đơn nháp
                        </a>
                      </div>
                    )}

                    {waitingRooms.length > 0 && (
                      <div className="uc55-meta-row uc55-meta-row--warn">
                        <span>Chờ nhập chỉ số công tơ: {waitingRooms.join(', ')}</span>
                        <a className="uc55-link" href="/meter-readings" onClick={(e) => handleLinkClick(e, '/meter-readings')}>
                          Bổ sung chỉ số
                        </a>
                      </div>
                    )}

                    {expiredContracts.length > 0 && (
                      <div className="uc55-meta-row uc55-meta-row--info">
                        <span>Hợp đồng hết hạn cần xử lý: {expiredContracts.join(', ')}</span>
                        <a className="uc55-link" href="/rental-contracts" onClick={(e) => handleLinkClick(e, '/rental-contracts')}>
                          Xem hợp đồng
                        </a>
                      </div>
                    )}

                    {errorRooms.length > 0 && (
                      <div className="uc55-meta-row uc55-meta-row--error">
                        <span>Phòng lỗi dữ liệu (đã hoàn tác riêng): {errorRooms.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {!item.read && (
                    <div className="uc55-notif-actions">
                      <button
                        type="button"
                        className="uc55-btn"
                        disabled={markingId === item.id}
                        onClick={() => onMarkAsRead(item.id)}
                      >
                        {markingId === item.id ? 'Đang lưu...' : 'Đánh dấu đã đọc'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {hasNext && (
            <div className="uc55-drawer-more">
              <button
                type="button"
                className="uc55-btn"
                onClick={onLoadMore}
                disabled={loading}
              >
                {loading ? 'Đang tải...' : 'Tải thêm'}
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
