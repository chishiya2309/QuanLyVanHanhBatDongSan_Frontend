import React, { useState, useEffect } from 'react';
import type { RentalContract } from '../../types/rentalContract';
import {
  rentalContractApi,
  RentalContractApiError,
} from '../../services/rentalContractApi';
import './contracts.css';

interface ExtendRentalContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedContract: RentalContract) => void;
  contract: RentalContract | null;
  onSessionExpired?: () => void;
}

const formatDateDisplay = (dateStr?: string): string => {
  if (!dateStr) return '---';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

// Hàm tính ngày sau khi cộng số tháng từ ngày gốc (YYYY-MM-DD)
const addMonthsToDateString = (dateStr: string, monthsToAdd: number): string => {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed
  const day = parseInt(parts[2], 10);

  const d = new Date(year, month, day);
  d.setMonth(d.getMonth() + monthsToAdd);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Hàm lấy ngày tiếp theo (YYYY-MM-DD) để làm min date
const getNextDayString = (dateStr: string): string => {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const d = new Date(year, month, day);
  d.setDate(d.getDate() + 1);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const ExtendRentalContractModal: React.FC<ExtendRentalContractModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  contract,
  onSessionExpired,
}) => {
  const [newEndDate, setNewEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen || !contract) {
      setErrorMessage(null);
      setFieldErrors({});
      setReason('');
      setNewEndDate('');
      return;
    }

    // Mặc định chọn nhanh +6 tháng từ ngày kết thúc hiện tại
    if (contract.endDate) {
      setNewEndDate(addMonthsToDateString(contract.endDate, 6));
    } else {
      setNewEndDate('');
    }
    setReason('');
    setErrorMessage(null);
    setFieldErrors({});
    setSubmitting(false);
  }, [isOpen, contract]);

  if (!isOpen || !contract) return null;

  const minDate = contract.endDate ? getNextDayString(contract.endDate) : '';

  const handleQuickAdd = (months: number) => {
    if (!contract.endDate) return;
    const computed = addMonthsToDateString(contract.endDate, months);
    setNewEndDate(computed);
    if (fieldErrors.newEndDate) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.newEndDate;
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!newEndDate) {
      errors.newEndDate = 'Vui lòng chọn ngày kết thúc mới';
    } else if (contract.endDate && newEndDate <= contract.endDate) {
      errors.newEndDate = 'Ngày kết thúc mới phải sau ngày kết thúc hiện tại của hợp đồng';
    }

    if (!reason.trim()) {
      errors.reason = 'Vui lòng nhập lý do gia hạn hợp đồng';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract) return;
    setErrorMessage(null);

    if (!validate()) {
      return;
    }

    try {
      setSubmitting(true);
      const updatedContract = await rentalContractApi.extendRentalContract(contract.id, {
        newEndDate,
        reason: reason.trim(),
      });

      onSuccess(updatedContract);
      onClose();
    } catch (err) {
      if (err instanceof RentalContractApiError) {
        if (err.status === 401 && onSessionExpired) {
          onSessionExpired();
          return;
        }
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors);
        }
        setErrorMessage(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi gia hạn hợp đồng thuê';
        setErrorMessage(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="contract-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="contract-modal" style={{ maxWidth: '580px', width: '92%' }}>
        <div className="contract-modal-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
              Gia hạn hợp đồng thuê
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
              <span>Mã HĐ:</span>
              <strong style={{ color: '#0f172a' }}>{contract.contractNumber}</strong>
              <span className="badge-status-active" style={{ fontSize: '11px', padding: '1px 6px' }}>
                Đang hiệu lực
              </span>
            </div>
          </div>
          <button
            type="button"
            className="contract-modal-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Đóng"
            style={{ fontSize: '24px', lineHeight: 1, padding: '4px' }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="contract-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '72vh', overflowY: 'auto' }}>
            {errorMessage && (
              <div className="error-banner" role="alert">
                {errorMessage}
              </div>
            )}

            {/* Readonly Contract Summary Card */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Khách thuê đại diện:</span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{contract.customerName}</span>
                  {contract.customerPhone && (
                    <span style={{ color: '#64748b', display: 'block', fontSize: '12px', marginTop: '2px' }}>
                      {contract.customerPhone}
                    </span>
                  )}
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Phòng đang thuê:</span>
                  <span style={{ fontWeight: 600, color: '#4338ca' }}>
                    {contract.currentRoomCode || '---'} {contract.currentRoomName ? `- ${contract.currentRoomName}` : ''}
                  </span>
                </div>
              </div>

              <div
                style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: '#64748b', fontSize: '12px' }}>Ngày kết thúc hiện tại:</span>
                <span style={{ fontWeight: 700, color: '#b45309' }}>
                  {formatDateDisplay(contract.endDate)}
                </span>
              </div>
            </div>

            {/* Quick Options */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>
                Chọn nhanh thời hạn gia hạn:
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="contract-action-btn"
                  onClick={() => handleQuickAdd(3)}
                  disabled={submitting}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  +3 tháng
                </button>
                <button
                  type="button"
                  className="contract-action-btn"
                  onClick={() => handleQuickAdd(6)}
                  disabled={submitting}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  +6 tháng
                </button>
                <button
                  type="button"
                  className="contract-action-btn"
                  onClick={() => handleQuickAdd(12)}
                  disabled={submitting}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  +12 tháng (1 năm)
                </button>
              </div>
            </div>

            {/* New End Date */}
            <div className="form-group">
              <label htmlFor="extend-new-end-date">
                Ngày kết thúc mới <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                id="extend-new-end-date"
                type="date"
                min={minDate}
                value={newEndDate}
                onChange={(e) => {
                  setNewEndDate(e.target.value);
                  if (fieldErrors.newEndDate) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.newEndDate;
                      return next;
                    });
                  }
                }}
                disabled={submitting}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderColor: fieldErrors.newEndDate ? '#ef4444' : undefined,
                }}
              />
              {fieldErrors.newEndDate && (
                <span style={{ fontSize: '12px', color: '#dc2626' }}>{fieldErrors.newEndDate}</span>
              )}
            </div>

            {/* Reason */}
            <div className="form-group">
              <label htmlFor="extend-reason">
                Lý do gia hạn <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                id="extend-reason"
                rows={3}
                placeholder="Ví dụ: Khách thuê đồng ý ký tiếp phụ lục gia hạn thêm..."
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (fieldErrors.reason) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.reason;
                      return next;
                    });
                  }
                }}
                disabled={submitting}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 10px',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: fieldErrors.reason ? '#ef4444' : '#cbd5e1',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                }}
              />
              {fieldErrors.reason && (
                <span style={{ fontSize: '12px', color: '#dc2626' }}>{fieldErrors.reason}</span>
              )}
            </div>

            {/* Business rules info note */}
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: '#1e40af',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px' }}>ℹ️</span>
                <span>Quy ước nghiệp vụ khi gia hạn:</span>
              </div>
              <ul style={{ margin: '4px 0 0 18px', padding: 0, color: '#1d4ed8' }}>
                <li>Hợp đồng tiếp tục giữ nguyên trạng thái <strong>ĐANG HIỆU LỰC (ACTIVE)</strong>.</li>
                <li>Phòng tiếp tục giữ nguyên trạng thái <strong>ĐANG THUÊ (OCCUPIED)</strong>.</li>
                <li>Tự động tạo phụ lục gia hạn và lưu vào lịch sử theo dõi của hợp đồng.</li>
              </ul>
            </div>
          </div>

          <div className="contract-modal-footer">
            <button
              type="button"
              className="contract-action-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="contract-action-btn btn-primary"
              disabled={submitting}
              style={{ minWidth: '150px', justifyContent: 'center', fontWeight: 600 }}
            >
              {submitting ? 'Đang xử lý...' : '✓ Xác nhận gia hạn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
