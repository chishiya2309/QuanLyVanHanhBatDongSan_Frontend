import React from 'react';
import type { RentalContract, RentalStatus } from '../../types/rentalContract';
import './contracts.css';

interface RentalContractDetailDrawerProps {
  contract: RentalContract | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (contract: RentalContract) => void;
}

const renderStatusBadge = (status: RentalStatus) => {
  switch (status) {
    case 'ACTIVE':
      return <span className="badge-status-active">Đang hiệu lực (ACTIVE)</span>;
    case 'DRAFT':
      return <span className="badge-status-draft">Nháp (DRAFT)</span>;
    case 'TERMINATED':
      return <span className="badge-status-terminated">Đã thanh lý (TERMINATED)</span>;
    default:
      return <span>{status}</span>;
  }
};

export const RentalContractDetailDrawer: React.FC<RentalContractDetailDrawerProps> = ({
  contract,
  isOpen,
  onClose,
  onEdit,
}) => {
  if (!isOpen || !contract) return null;

  const canEdit = contract.status === 'ACTIVE' || contract.status === 'DRAFT';

  return (
    <div className="contract-drawer-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="contract-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="contract-drawer-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Chi tiết hợp đồng thuê</h2>
            <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--color-muted)' }}>
              Mã: <strong style={{ color: 'var(--color-accent-primary, #b91c1c)' }}>{contract.contractNumber}</strong>
            </div>
          </div>
          <button type="button" className="contract-modal-close" onClick={onClose} aria-label="Đóng">
            &times;
          </button>
        </div>

        <div className="contract-drawer-body">
          {/* Trạng thái hợp đồng */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Trạng thái hiện tại:</span>
            {renderStatusBadge(contract.status)}
          </div>

          {/* Banner chuyển từ HĐ cọc */}
          {contract.convertedFromDepositNumber && (
            <div
              className="drawer-section"
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                padding: '12px 14px',
              }}
            >
              <h3 style={{ color: '#1d4ed8', margin: '0 0 6px', fontSize: '13px', fontWeight: 600 }}>
                Nguồn gốc hợp đồng: Chuyển đổi từ đặt cọc
              </h3>
              <div style={{ fontSize: '13px', color: '#1e40af' }}>
                Hợp đồng được chuyển đổi từ thỏa thuận đặt cọc giữ chỗ:{' '}
                <strong>{contract.convertedFromDepositNumber}</strong>
              </div>
            </div>
          )}

          {/* Điều khoản hợp đồng */}
          <div className="drawer-section">
            <h3>Điều khoản hợp đồng</h3>
            <div className="info-grid">
              <span className="info-label">Ngày bắt đầu:</span>
              <span className="info-value">{contract.startDate}</span>

              <span className="info-label">Ngày kết thúc:</span>
              <span className="info-value">{contract.endDate}</span>

              <span className="info-label">Tiền cọc cam kết:</span>
              <span className="info-value" style={{ fontWeight: 600, color: 'var(--color-accent-primary, #b91c1c)' }}>
                {Number(contract.depositRequired ?? 0).toLocaleString('vi-VN')} đ
              </span>

              <span className="info-label">Chu kỳ thanh toán:</span>
              <span className="info-value">{contract.cycleMonths} tháng / lần</span>

              <span className="info-label">Ngày chốt hóa đơn:</span>
              <span className="info-value">Ngày {contract.billingAnchor} hàng tháng</span>
            </div>
          </div>

          {/* Khách thuê */}
          <div className="drawer-section">
            <h3>Khách thuê đại diện</h3>
            <div className="info-grid">
              <span className="info-label">Họ và tên:</span>
              <span className="info-value" style={{ fontWeight: 600 }}>
                {contract.partySnapshot?.customerName || contract.customerName}
              </span>

              <span className="info-label">Số điện thoại:</span>
              <span className="info-value">
                {contract.partySnapshot?.phone || contract.customerPhone || 'Chưa cập nhật'}
              </span>

              <span className="info-label">CCCD / CMND:</span>
              <span className="info-value">
                {contract.partySnapshot?.identityNo || 'Chưa cập nhật'}
              </span>
            </div>
          </div>

          {/* Phòng & Danh sách lượt ở */}
          <div className="drawer-section">
            <h3>Phòng &amp; Lịch sử lượt ở</h3>
            <div style={{ marginBottom: '12px', fontSize: '13px' }}>
              <span style={{ color: 'var(--color-muted)' }}>Phòng hiện tại: </span>
              <strong style={{ color: 'var(--color-accent-primary, #b91c1c)', fontSize: '14px' }}>
                {contract.currentRoomCode || 'Chưa xếp phòng'}
                {contract.currentRoomName ? ` - ${contract.currentRoomName}` : ''}
              </strong>
              {contract.currentRent && contract.currentRent > 0 && (
                <span style={{ marginLeft: '8px', color: '#047857', fontWeight: 600 }}>
                  ({Number(contract.currentRent).toLocaleString('vi-VN')} đ/tháng)
                </span>
              )}
            </div>

            {contract.tenancies && contract.tenancies.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '6px 8px' }}>Mã phòng</th>
                      <th style={{ padding: '6px 8px' }}>Tên phòng</th>
                      <th style={{ padding: '6px 8px' }}>Giá thuê</th>
                      <th style={{ padding: '6px 8px' }}>Từ ngày</th>
                      <th style={{ padding: '6px 8px' }}>Đến ngày</th>
                      <th style={{ padding: '6px 8px' }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contract.tenancies.map((t, idx) => {
                      const isCurrent = idx === contract.tenancies.length - 1;
                      return (
                        <tr
                          key={t.id || idx}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            background: isCurrent ? '#f0fdf4' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>{t.roomCode}</td>
                          <td style={{ padding: '6px 8px' }}>{t.roomName}</td>
                          <td style={{ padding: '6px 8px', fontWeight: 500, color: '#047857' }}>
                            {Number(t.rent).toLocaleString('vi-VN')} đ
                          </td>
                          <td style={{ padding: '6px 8px' }}>{t.fromDate}</td>
                          <td style={{ padding: '6px 8px' }}>{t.toDate || 'Hiện tại'}</td>
                          <td style={{ padding: '6px 8px' }}>
                            {isCurrent ? (
                              <span style={{ color: '#059669', fontWeight: 600 }}>● Đang ở</span>
                            ) : (
                              <span style={{ color: '#64748b' }}>Đã kết thúc</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-muted)' }}>Chưa có lượt ở nào.</p>
            )}
          </div>

          {/* Bên cho thuê */}
          {contract.partySnapshot?.hostName && (
            <div className="drawer-section">
              <h3>Bên cho thuê (Host)</h3>
              <div className="info-grid">
                <span className="info-label">Đại diện:</span>
                <span className="info-value">{contract.partySnapshot.hostName}</span>

                <span className="info-label">Địa chỉ:</span>
                <span className="info-value">{contract.partySnapshot.hostAddress || 'Chưa cập nhật'}</span>
              </div>
            </div>
          )}

          {/* Thông tin hệ thống */}
          <div className="drawer-section">
            <h3>Thông tin lưu trữ</h3>
            <div className="info-grid">
              <span className="info-label">Thời điểm tạo:</span>
              <span className="info-value">
                {contract.createdAt ? new Date(contract.createdAt).toLocaleString('vi-VN') : 'Không rõ'}
              </span>

              <span className="info-label">Cập nhật lần cuối:</span>
              <span className="info-value">
                {contract.updatedAt ? new Date(contract.updatedAt).toLocaleString('vi-VN') : 'Không rõ'}
              </span>
            </div>
          </div>
        </div>

        {/* Drawer footer actions */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--color-rule)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            background: 'white',
          }}
        >
          <button
            type="button"
            className="contract-action-btn btn-secondary"
            onClick={onClose}
          >
            Đóng
          </button>

          {canEdit && (
            <button
              type="button"
              className="contract-action-btn btn-primary"
              onClick={() => {
                onClose();
                onEdit(contract);
              }}
            >
              Chỉnh sửa hợp đồng
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
