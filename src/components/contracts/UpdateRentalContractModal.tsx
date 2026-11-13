import React, { useState, useEffect } from 'react';
import type { RentalContract } from '../../types/rentalContract';
import {
  rentalContractApi,
  RentalContractApiError,
} from '../../services/rentalContractApi';
import './contracts.css';

interface UpdateRentalContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedContract: RentalContract) => void;
  contract: RentalContract | null;
  onSessionExpired?: () => void;
}

export const UpdateRentalContractModal: React.FC<UpdateRentalContractModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  contract,
  onSessionExpired,
}) => {
  const [depositRequired, setDepositRequired] = useState<number | ''>('');
  const [cycleMonths, setCycleMonths] = useState<number>(1);
  const [billingAnchor, setBillingAnchor] = useState<number>(1);
  const [note, setNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !contract) {
      setErrorMessage(null);
      return;
    }

    setDepositRequired(contract.depositRequired ?? 0);
    setCycleMonths(contract.cycleMonths || 1);
    setBillingAnchor(contract.billingAnchor || 1);
    setNote('');
  }, [isOpen, contract]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract) return;
    setErrorMessage(null);

    if (depositRequired === '' || Number(depositRequired) < 0) {
      setErrorMessage('Tiền cọc cam kết không được âm');
      return;
    }
    if (cycleMonths < 1) {
      setErrorMessage('Chu kỳ thanh toán phải từ 1 tháng trở lên');
      return;
    }
    if (billingAnchor < 1 || billingAnchor > 31) {
      setErrorMessage('Ngày chốt hóa đơn phải từ ngày 1 đến 31');
      return;
    }

    try {
      setSubmitting(true);
      const response = await rentalContractApi.updateActiveRentalContract(contract.id, {
        depositRequired: Number(depositRequired),
        cycleMonths,
        billingAnchor,
        note: note.trim() || undefined,
      });

      onSuccess(response);
      onClose();
    } catch (err) {
      if (err instanceof RentalContractApiError) {
        if (err.status === 401 && onSessionExpired) {
          onSessionExpired();
          return;
        }
        setErrorMessage(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi cập nhật thông tin hợp đồng';
        setErrorMessage(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !contract) return null;

  return (
    <div className="contract-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="contract-modal" onClick={(e) => e.stopPropagation()}>
        <div className="contract-modal-header">
          <div>
            <h2>Cập nhật hợp đồng thuê</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--color-muted)', fontSize: '13px' }}>
              Mã HĐ: <strong>{contract.contractNumber}</strong> - Trạng thái:{' '}
              <span className={`badge-status-${contract.status.toLowerCase()}`}>
                {contract.status === 'ACTIVE'
                  ? 'Đang hiệu lực'
                  : contract.status === 'DRAFT'
                  ? 'Nháp'
                  : 'Đã thanh lý'}
              </span>
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Đóng">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="contract-modal-body">
            {errorMessage && (
              <div className="error-banner" style={{ marginBottom: '16px' }} role="alert">
                {errorMessage}
              </div>
            )}

            {/* Read-only party and room info */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                fontSize: '13px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px 16px',
              }}
            >
              <div>
                <span style={{ color: 'var(--color-muted)' }}>Khách thuê: </span>
                <strong>{contract.customerName}</strong>
                {contract.customerPhone ? ` (${contract.customerPhone})` : ''}
              </div>
              <div>
                <span style={{ color: 'var(--color-muted)' }}>Phòng hiện tại: </span>
                <strong style={{ color: 'var(--color-accent-primary, #b91c1c)' }}>
                  {contract.currentRoomCode || 'Chưa xếp phòng'}
                  {contract.currentRoomName ? ` - ${contract.currentRoomName}` : ''}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-muted)' }}>Ngày bắt đầu: </span>
                <strong>{contract.startDate}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-muted)' }}>Ngày kết thúc: </span>
                <strong>{contract.endDate}</strong>
              </div>
            </div>

            <p style={{ margin: '0', fontSize: '12px', color: 'var(--color-muted)', fontStyle: 'italic' }}>
              * Lưu ý nghiệp vụ: Không thể sửa trực tiếp Khách thuê, Phòng thuê hay Thời hạn thuê tại đây. Để chuyển phòng hoặc gia hạn ngày, vui lòng sử dụng chức năng Chuyển phòng hoặc Gia hạn hợp đồng.
            </p>

            {/* Editable deposit required */}
            <div className="form-group">
              <label className="form-label required">Tiền cọc cam kết điều khoản HĐ (VNĐ)</label>
              <div className="input-group">
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="form-control"
                  placeholder="Ví dụ: 4500000"
                  value={depositRequired}
                  onChange={(e) => setDepositRequired(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                />
                <span className="input-suffix">VNĐ</span>
              </div>
              {depositRequired !== '' && Number(depositRequired) >= 0 && (
                <small style={{ color: 'var(--color-muted)', display: 'block', marginTop: '4px' }}>
                  {Number(depositRequired).toLocaleString('vi-VN')} đ
                </small>
              )}
              <small style={{ color: '#64748b', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                Thay đổi nghĩa vụ tiền cọc cam kết trên văn bản hợp đồng. Thao tác này không tạo phiếu thu/chi tiền mặt tự động.
              </small>
            </div>

            {/* Chu kỳ thanh toán và Ngày chốt hóa đơn */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Chu kỳ thanh toán mới</label>
                <select
                  className="form-control"
                  value={cycleMonths}
                  onChange={(e) => setCycleMonths(Number(e.target.value))}
                  required
                >
                  <option value={1}>1 tháng / lần</option>
                  <option value={2}>2 tháng / lần</option>
                  <option value={3}>3 tháng / lần</option>
                  <option value={6}>6 tháng / lần</option>
                  <option value={12}>12 tháng (1 năm) / lần</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label required">Ngày chốt hóa đơn</label>
                <select
                  className="form-control"
                  value={billingAnchor}
                  onChange={(e) => setBillingAnchor(Number(e.target.value))}
                  required
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      Ngày {day} hàng tháng
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Note */}
            <div className="form-group">
              <label className="form-label">Ghi chú điều chỉnh</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Nhập lý do điều chỉnh điều khoản hoặc ghi chú bổ sung..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="contract-modal-footer">
            <button
              type="button"
              className="contract-action-btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="contract-action-btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Đang cập nhật...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

