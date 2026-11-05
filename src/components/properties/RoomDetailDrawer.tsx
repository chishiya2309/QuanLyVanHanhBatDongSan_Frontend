import React, { useState, useEffect } from 'react';
import type { RoomDetail, RoomHistory } from '../../types/properties';
import { getRoomDetail, getRoomHistory, PropertyApiError } from '../../services/propertiesApi';

interface RoomDetailDrawerProps {
  isOpen: boolean;
  roomId: string | null;
  buildingId?: string | null;
  initialTab?: 'detail' | 'history';
  onClose: () => void;
  onEditRoom: (room: RoomDetail) => void;
  onSessionExpired: () => void;
}

export const RoomDetailDrawer: React.FC<RoomDetailDrawerProps> = ({
  isOpen,
  roomId,
  buildingId,
  initialTab = 'detail',
  onClose,
  onEditRoom,
  onSessionExpired,
}) => {
  const [activeTab, setActiveTab] = useState<'detail' | 'tenancy' | 'state'>(
    initialTab === 'history' ? 'state' : 'detail'
  );
  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [history, setHistory] = useState<RoomHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab === 'history' ? 'state' : 'detail');
  }, [initialTab]);

  useEffect(() => {
    if (!isOpen || !roomId) {
      setDetail(null);
      setHistory(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getRoomDetail(roomId, buildingId || undefined),
      getRoomHistory(roomId),
    ])
      .then(([detailRes, historyRes]) => {
        if (!isMounted) return;
        setDetail(detailRes);
        setHistory(historyRes);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err instanceof PropertyApiError && err.status === 401) {
          onSessionExpired();
          return;
        }
        setError(err instanceof Error ? err.message : 'Không thể tải thông tin phòng');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, roomId, buildingId, onSessionExpired]);

  if (!isOpen || !roomId) return null;

  const renderStatusBadge = (status?: string, isMaintenance?: boolean) => {
    switch (status) {
      case 'OCCUPIED':
        return <span className="prop-badge prop-badge--occupied">Đang thuê {isMaintenance ? '· Bảo trì' : ''}</span>;
      case 'RESERVED':
        return <span className="prop-badge prop-badge--reserved">Đang cọc {isMaintenance ? '· Bảo trì' : ''}</span>;
      case 'MAINTENANCE':
        return <span className="prop-badge prop-badge--maint">Đang bảo trì</span>;
      case 'VACANT':
      default:
        return <span className="prop-badge prop-badge--vacant">Đang trống</span>;
    }
  };

  return (
    <div className="prop-drawer-backdrop" onClick={onClose}>
      <aside
        className="prop-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Chi tiết và lịch sử phòng"
      >
        <header className="prop-drawer-header">
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>
              {detail ? `Phòng: ${detail.code}` : 'Chi tiết phòng'}
            </h2>
            {detail && <div style={{ marginTop: '4px' }}>{renderStatusBadge(detail.status, detail.maintenance)}</div>}
          </div>
          <button type="button" className="prop-btn prop-btn--outline prop-btn--sm" onClick={onClose}>
            ✕
          </button>
        </header>

        {/* Navigation Tabs in Drawer */}
        <nav className="prop-tabs" style={{ padding: '0 var(--space-lg)', margin: 0 }}>
          <button
            type="button"
            className={`prop-tab-btn ${activeTab === 'detail' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('detail')}
          >
            Thông tin cấu hình
          </button>
          <button
            type="button"
            className={`prop-tab-btn ${activeTab === 'tenancy' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('tenancy')}
          >
            Lịch sử lưu trú ({history?.tenancyHistory?.length || 0})
          </button>
          <button
            type="button"
            className={`prop-tab-btn ${activeTab === 'state' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('state')}
          >
            Biến động trạng thái ({history?.stateHistory?.length || 0})
          </button>
        </nav>

        <div className="prop-drawer-body">
          {loading && <p>Đang tải thông tin chi tiết...</p>}
          {error && (
            <div className="prop-banner prop-banner--error" role="alert">
              <p>{error}</p>
            </div>
          )}

          {/* TAB 1: THÔNG TIN CẤU HÌNH */}
          {!loading && detail && activeTab === 'detail' && (
            <div>
              <dl className="prop-facts-grid">
                <div>
                  <dt>Mã phòng</dt>
                  <dd style={{ fontSize: 'var(--text-md)', fontWeight: 700 }}>{detail.code}</dd>
                </div>
                <div>
                  <dt>Tên phòng</dt>
                  <dd>{detail.name}</dd>
                </div>
                <div>
                  <dt>Khu vực</dt>
                  <dd>{detail.areaName || '—'}</dd>
                </div>
                <div>
                  <dt>Tòa nhà</dt>
                  <dd>{detail.buildingName || '—'}</dd>
                </div>
                <div>
                  <dt>Tầng</dt>
                  <dd>{detail.floorName ? `${detail.floorName} (Cấp ${detail.floorLevel})` : '—'}</dd>
                </div>
                <div>
                  <dt>Diện tích</dt>
                  <dd>{detail.area} m²</dd>
                </div>
                <div>
                  <dt>Giá thuê mặc định</dt>
                  <dd style={{ color: 'var(--color-accent-primary)', fontWeight: 600 }}>
                    {detail.defaultRent?.toLocaleString('vi-VN')} đ / tháng
                  </dd>
                </div>
                <div>
                  <dt>Tiền đặt cọc mặc định</dt>
                  <dd>{detail.defaultDeposit?.toLocaleString('vi-VN')} đ</dd>
                </div>
                <div>
                  <dt>Trạng thái chỉnh sửa</dt>
                  <dd>
                    {detail.hasActiveContractOrReservation ? (
                      <span style={{ color: 'var(--color-status-warn)', fontSize: 'var(--text-xs)' }}>
                        🔒 Khóa thông tin cơ bản (Đang có hợp đồng/giữ chỗ)
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-success)', fontSize: 'var(--text-xs)' }}>
                        ✓ Cho phép chỉnh sửa đầy đủ
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* TAB 2: LỊCH SỬ THUÊ / HỢP ĐỒNG */}
          {!loading && activeTab === 'tenancy' && (
            <div>
              {history?.tenancyHistory && history.tenancyHistory.length > 0 ? (
                <div className="prop-table-wrap">
                  <table className="prop-table">
                    <thead>
                      <tr>
                        <th>Mã HĐ</th>
                        <th>Khách thuê</th>
                        <th>Số ĐT</th>
                        <th>Thời gian</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.tenancyHistory.map((t) => (
                        <tr key={t.tenancyId}>
                          <td><strong>{t.contractNumber}</strong></td>
                          <td>{t.customerName}</td>
                          <td>{t.customerPhone}</td>
                          <td>{t.fromDate} ~ {t.toDate || 'Hiện tại'}</td>
                          <td>
                            {t.isCurrent ? (
                              <span className="prop-badge prop-badge--occupied">Đang thuê</span>
                            ) : (
                              <span className="prop-badge prop-badge--inactive">Đã kết thúc</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="prop-empty" style={{ padding: 'var(--space-lg)' }}>
                  <p>Chưa có lịch sử lưu trú / hợp đồng nào được ghi nhận cho phòng này.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LỊCH SỬ BIẾN ĐỘNG TRẠNG THÁI */}
          {!loading && activeTab === 'state' && (
            <div>
              {history?.stateHistory && history.stateHistory.length > 0 ? (
                <div className="prop-table-wrap">
                  <table className="prop-table">
                    <thead>
                      <tr>
                        <th>Thời điểm</th>
                        <th>Chuyển trạng thái</th>
                        <th>Lý do</th>
                        <th>Người thực hiện</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.stateHistory.map((s) => (
                        <tr key={s.id}>
                          <td>{new Date(s.changedAt).toLocaleString('vi-VN')}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {renderStatusBadge(s.fromStatus)} → {renderStatusBadge(s.toStatus)}
                            </div>
                          </td>
                          <td style={{ color: 'var(--color-muted)' }}>{s.reason || '—'}</td>
                          <td><strong>{s.actorName || 'Hệ thống'}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="prop-empty" style={{ padding: 'var(--space-lg)' }}>
                  <p>Chưa có biến động trạng thái nào được ghi nhận.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="prop-drawer-footer">
          <button type="button" className="prop-btn" onClick={onClose}>
            Đóng
          </button>
          {detail && (
            <button
              type="button"
              className="prop-btn prop-btn--primary"
              onClick={() => {
                onClose();
                onEditRoom(detail);
              }}
            >
              Chỉnh sửa thông tin phòng
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
};

