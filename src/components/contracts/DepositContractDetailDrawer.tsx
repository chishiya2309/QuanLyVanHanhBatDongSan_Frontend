import React from 'react';
import type { DepositContract, DepositStatus } from '../../types/depositContract';

interface DepositContractDetailDrawerProps {
  contract: DepositContract | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (contract: DepositContract) => void;
  onCancel?: (contract: DepositContract) => void;
  onConvert?: (contract: DepositContract) => void;
}

const renderStatusBadge = (status: DepositStatus) => {
  switch (status) {
    case 'RESERVED':
      return <span className="badge-status-reserved">Đang giữ chỗ (RESERVED)</span>;
    case 'DRAFT':
      return <span className="badge-status-draft">Nháp (DRAFT)</span>;
    case 'CONVERTED':
      return <span className="badge-status-converted">Đã chuyển thuê (CONVERTED)</span>;
    case 'CANCELLED':
      return <span className="badge-status-cancelled">Đã hủy (CANCELLED)</span>;
    default:
      return <span>{status}</span>;
  }
};

export const DepositContractDetailDrawer: React.FC<DepositContractDetailDrawerProps> = ({
  contract,
  isOpen,
  onClose,
  onEdit,
  onCancel,
  onConvert,
}) => {
  if (!isOpen || !contract) return null;

  const canEdit = contract.status === 'DRAFT' || contract.status === 'RESERVED';

  return (
    <div className="contract-drawer-backdrop" onClick={onClose}>
      <div className="contract-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="contract-drawer-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Chi tiết hợp đồng đặt cọc</h2>
            <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--color-muted)' }}>
              Mã: <strong style={{ color: 'var(--color-accent-primary)' }}>{contract.contractNumber}</strong>
            </div>
          </div>
          <button type="button" className="contract-modal-close" onClick={onClose} aria-label="Đóng">
            &times;
          </button>
        </div>

        <div className="contract-drawer-body">
          {/* Trạng thái hợp đồng */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-paper-2)', borderRadius: '6px', border: '1px solid var(--color-rule)' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Trạng thái hiện tại:</span>
            {renderStatusBadge(contract.status)}
          </div>

          {/* Khối thông tin hủy cọc nếu hợp đồng CANCELLED */}
          {contract.status === 'CANCELLED' && (
            <div className="drawer-section" style={{ background: 'var(--color-error-wash)', border: '1px solid var(--color-error-ring)', borderRadius: '6px', padding: '12px 14px' }}>
              <h3 style={{ color: 'var(--color-error)', marginBottom: '8px' }}>Thông tin hủy đặt cọc</h3>
              <div className="info-grid">
                <span className="info-label" style={{ color: 'var(--color-error)' }}>Thời điểm hủy:</span>
                <span className="info-value" style={{ fontWeight: 600 }}>
                  {contract.cancelledAt ? new Date(contract.cancelledAt).toLocaleString('vi-VN') : 'Không rõ'}
                </span>

                <span className="info-label" style={{ color: 'var(--color-error)' }}>Lý do hủy:</span>
                <span className="info-value" style={{ color: 'var(--color-error)' }}>
                  {contract.cancelReason || 'Không có lý do'}
                </span>
              </div>
            </div>
          )}

          {/* Khối thông tin nếu hợp đồng CONVERTED sang HĐ thuê */}
          {contract.status === 'CONVERTED' && (
            <div className="drawer-section" style={{ background: 'var(--color-accent-wash)', border: '1px solid var(--color-rule)', borderRadius: '6px', padding: '12px 14px' }}>
              <h3 style={{ color: 'var(--color-accent-primary)', marginBottom: '8px' }}>Đã chuyển thành Hợp đồng thuê</h3>
              <div className="info-grid">
                <span className="info-label" style={{ color: 'var(--color-accent-primary)' }}>Trạng thái:</span>
                <span className="info-value" style={{ fontWeight: 600, color: 'var(--color-accent-primary)' }}>
                  Đã hoàn tất chuyển đổi
                </span>

                {contract.convertedToRentalNumber && (
                  <>
                    <span className="info-label" style={{ color: 'var(--color-accent-primary)' }}>Mã HĐ thuê:</span>
                    <span className="info-value" style={{ fontWeight: 600, color: 'var(--color-ink)' }}>
                      {contract.convertedToRentalNumber}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Thông tin phòng đặt cọc */}
          <div className="drawer-section">
            <h3>Phòng đặt cọc</h3>
            <div className="info-grid">
              <span className="info-label">Mã phòng:</span>
              <span className="info-value">{contract.roomCode}</span>

              <span className="info-label">Tên phòng:</span>
              <span className="info-value">{contract.roomName}</span>

              <span className="info-label">Tòa nhà:</span>
              <span className="info-value">{contract.buildingName}</span>

              <span className="info-label">Cấp tầng:</span>
              <span className="info-value">Tầng {contract.floorLevel}</span>
            </div>
          </div>

          {/* Thông tin khách thuê đại diện */}
          <div className="drawer-section">
            <h3>Khách thuê đại diện (Customer)</h3>
            <div className="info-grid">
              <span className="info-label">Họ và tên:</span>
              <span className="info-value">{contract.customerName}</span>

              <span className="info-label">Số điện thoại:</span>
              <span className="info-value">{contract.customerPhone || 'Chưa cập nhật'}</span>

              <span className="info-label">Số định danh:</span>
              <span className="info-value">{contract.partySnapshot?.identityNo || 'Chưa cập nhật'}</span>
            </div>
          </div>

          {/* Điều khoản & Tài chính */}
          <div className="drawer-section">
            <h3>Điều khoản đặt cọc</h3>
            <div className="info-grid">
              <span className="info-label">Tiền cọc yêu cầu:</span>
              <span className="info-value" style={{ color: 'var(--color-accent-primary)', fontSize: '15px', fontWeight: 600 }}>
                {contract.amountRequired.toLocaleString('vi-VN')} VNĐ
              </span>

              <span className="info-label">Ngày đặt cọc:</span>
              <span className="info-value">{contract.reservedFrom}</span>

              <span className="info-label">Ngày dự kiến nhận:</span>
              <span className="info-value">{contract.moveInDate}</span>

              <span className="info-label">Ghi chú:</span>
              <span className="info-value">{contract.note || 'Không có ghi chú'}</span>
            </div>
          </div>

          {/* Thông tin bên cho thuê (Party Snapshot) */}
          {contract.partySnapshot?.hostName && (
            <div className="drawer-section">
              <h3>Bên cho thuê (Host Snapshot)</h3>
              <div className="info-grid">
                <span className="info-label">Tên đơn vị:</span>
                <span className="info-value">{contract.partySnapshot.hostName}</span>

                <span className="info-label">Địa chỉ kinh doanh:</span>
                <span className="info-value">{contract.partySnapshot.hostAddress || 'Chưa cập nhật'}</span>
              </div>
            </div>
          )}

          {/* Thông tin thời gian hệ thống */}
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div>Thời điểm tạo: {new Date(contract.createdAt).toLocaleString('vi-VN')}</div>
            {contract.updatedAt && <div>Cập nhật lần cuối: {new Date(contract.updatedAt).toLocaleString('vi-VN')}</div>}
          </div>
        </div>

        <div className="contract-modal-footer">
          <button type="button" className="contract-action-btn" onClick={onClose}>
            Đóng
          </button>
          {canEdit && onCancel && (
            <button
              type="button"
              className="contract-action-btn"
              style={{ color: 'var(--color-error)', borderColor: 'var(--color-error-ring)' }}
              onClick={() => {
                onClose();
                onCancel(contract);
              }}
            >
              Hủy đặt cọc
            </button>
          )}
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
          {contract.status === 'RESERVED' && onConvert && (
            <button
              type="button"
              className="contract-action-btn"
              style={{ color: 'var(--color-white)', background: 'var(--color-accent-primary)', borderColor: 'var(--color-accent-primary)', fontWeight: 600 }}
              onClick={() => {
                onClose();
                onConvert(contract);
              }}
            >
              Chuyển thành HĐ thuê
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

