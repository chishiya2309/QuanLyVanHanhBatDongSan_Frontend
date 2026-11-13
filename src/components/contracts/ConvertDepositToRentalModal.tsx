import React, { useState, useEffect } from 'react';
import type { DepositContract } from '../../types/depositContract';
import type { RentalContract, ConvertDepositToRentalInput } from '../../types/rentalContract';
import { rentalContractApi, RentalContractApiError } from '../../services/rentalContractApi';
import './contracts.css';

interface ConvertDepositToRentalModalProps {
  isOpen: boolean;
  contract: DepositContract | null;
  onClose: () => void;
  onSuccess: (rentalContract: RentalContract) => void;
  onSessionExpired?: () => void;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export const ConvertDepositToRentalModal: React.FC<ConvertDepositToRentalModalProps> = ({
  isOpen,
  contract,
  onClose,
  onSuccess,
  onSessionExpired,
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rent, setRent] = useState<number | ''>('');
  const [depositRequired, setDepositRequired] = useState<number | ''>('');
  const [cycleMonths, setCycleMonths] = useState<number>(1);
  const [billingAnchor, setBillingAnchor] = useState<number>(1);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && contract) {
      const initialStart = contract.moveInDate || new Date().toISOString().split('T')[0];
      setStartDate(initialStart);

      // Mặc định hợp đồng 1 năm
      const startObj = new Date(initialStart);
      startObj.setFullYear(startObj.getFullYear() + 1);
      setEndDate(startObj.toISOString().split('T')[0]);

      // Mặc định tiền cọc kế thừa từ cọc nguồn
      setDepositRequired(contract.amountRequired || 0);

      // Giá thuê
      setRent('');

      setCycleMonths(1);
      setBillingAnchor(1);
      setFieldErrors({});
      setGeneralError(null);
      setSubmitting(false);
    }
  }, [isOpen, contract]);

  if (!isOpen || !contract) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!startDate) {
      errors.startDate = 'Vui lòng chọn ngày bắt đầu thuê';
    }
    if (!endDate) {
      errors.endDate = 'Vui lòng chọn ngày kết thúc thuê';
    } else if (startDate && endDate <= startDate) {
      errors.endDate = 'Ngày kết thúc thuê phải sau ngày bắt đầu thuê';
    }

    if (rent === '' || typeof rent !== 'number' || rent <= 0) {
      errors.rent = 'Giá thuê phòng hàng tháng phải lớn hơn 0';
    }

    if (depositRequired !== '' && typeof depositRequired === 'number' && depositRequired < 0) {
      errors.depositRequired = 'Tiền cọc cam kết không được nhỏ hơn 0';
    }

    if (!cycleMonths || cycleMonths < 1) {
      errors.cycleMonths = 'Chu kỳ thanh toán phải từ 1 tháng trở lên';
    }

    if (!billingAnchor || billingAnchor < 1 || billingAnchor > 31) {
      errors.billingAnchor = 'Ngày chốt hóa đơn phải từ ngày 1 đến ngày 31';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) {
      return;
    }

    try {
      setSubmitting(true);
      const input: ConvertDepositToRentalInput = {
        startDate,
        endDate,
        rent: Number(rent),
        depositRequired: depositRequired !== '' ? Number(depositRequired) : undefined,
        cycleMonths: Number(cycleMonths),
        billingAnchor: Number(billingAnchor),
      };

      const result = await rentalContractApi.convertDepositToRental(contract.id, input);
      onSuccess(result);
      onClose();
    } catch (err: unknown) {
      if (err instanceof RentalContractApiError) {
        if (err.status === 401) {
          onSessionExpired?.();
          return;
        }
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors);
        }
        setGeneralError(err.message);
      } else if (err instanceof Error) {
        setGeneralError(err.message);
      } else {
        setGeneralError('Đã có lỗi xảy ra khi chuyển hợp đồng. Vui lòng thử lại.');
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
    >
      <div className="contract-modal" style={{ maxWidth: '600px', width: '92%' }}>
        {/* Header */}
        <div className="contract-modal-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
              Chuyển đặt cọc thành hợp đồng thuê
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
              <span>HĐ cọc:</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{contract.contractNumber}</span>
              <span className="badge-status-reserved" style={{ fontSize: '11px', padding: '1px 6px' }}>
                Đang giữ chỗ
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

        {/* Content Form */}
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="contract-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '72vh', overflowY: 'auto' }}>
            {generalError && (
              <div className="error-banner" role="alert">
                {generalError}
              </div>
            )}

            {/* Readonly Summary Info Card */}
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
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Phòng đặt cọc:</span>
                  <span style={{ fontWeight: 600, color: '#4338ca' }}>
                    {contract.roomCode} - {contract.roomName}
                  </span>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px', marginTop: '2px' }}>
                    {contract.buildingName} {contract.floorLevel ? `(Tầng ${contract.floorLevel})` : ''}
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
                <span style={{ color: '#64748b', fontSize: '12px' }}>Tiền cọc từ thỏa thuận:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatCurrency(contract.amountRequired)}</span>
              </div>
            </div>

            {/* Giá thuê */}
            <div className="form-group">
              <label htmlFor="convert-rent">
                Giá thuê hàng tháng (VNĐ) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="convert-rent"
                  type="number"
                  min="1"
                  step="any"
                  placeholder="Ví dụ: 4500000"
                  value={rent}
                  onChange={(e) => setRent(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    paddingRight: '85px',
                    borderColor: fieldErrors.rent ? '#ef4444' : undefined,
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '12px',
                    color: '#64748b',
                    fontWeight: 500,
                    pointerEvents: 'none',
                  }}
                >
                  VNĐ/tháng
                </span>
              </div>
              {rent !== '' && Number(rent) > 0 && (
                <span style={{ fontSize: '12px', color: '#4338ca', fontWeight: 600 }}>
                  {formatCurrency(Number(rent))} / tháng
                </span>
              )}
              {fieldErrors.rent && <span style={{ fontSize: '12px', color: '#dc2626' }}>{fieldErrors.rent}</span>}
            </div>

            {/* Thời hạn thuê */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="convert-start-date">
                  Ngày bắt đầu thuê <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="convert-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    borderColor: fieldErrors.startDate ? '#ef4444' : undefined,
                  }}
                />
                {fieldErrors.startDate && (
                  <span style={{ fontSize: '12px', color: '#dc2626' }}>{fieldErrors.startDate}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="convert-end-date">
                  Ngày kết thúc thuê <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="convert-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    borderColor: fieldErrors.endDate ? '#ef4444' : undefined,
                  }}
                />
                {fieldErrors.endDate && (
                  <span style={{ fontSize: '12px', color: '#dc2626' }}>{fieldErrors.endDate}</span>
                )}
              </div>
            </div>

            {/* Tiền cọc cam kết */}
            <div className="form-group">
              <label htmlFor="convert-deposit-req">Tiền cọc cam kết HĐ thuê (VNĐ)</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="convert-deposit-req"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Mặc định lấy từ thỏa thuận cọc"
                  value={depositRequired}
                  onChange={(e) => setDepositRequired(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    paddingRight: '55px',
                    borderColor: fieldErrors.depositRequired ? '#ef4444' : undefined,
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '12px',
                    color: '#64748b',
                    fontWeight: 500,
                    pointerEvents: 'none',
                  }}
                >
                  VNĐ
                </span>
              </div>
              {depositRequired !== '' && Number(depositRequired) > 0 && (
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {formatCurrency(Number(depositRequired))}
                </span>
              )}
              {fieldErrors.depositRequired && (
                <span style={{ fontSize: '12px', color: '#dc2626' }}>{fieldErrors.depositRequired}</span>
              )}
            </div>

            {/* Chu kỳ & Ngày chốt */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="convert-cycle">
                  Chu kỳ thanh toán <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  id="convert-cycle"
                  value={cycleMonths}
                  onChange={(e) => setCycleMonths(Number(e.target.value))}
                  disabled={submitting}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value={1}>1 tháng / lần</option>
                  <option value={2}>2 tháng / lần</option>
                  <option value={3}>3 tháng / lần (Theo quý)</option>
                  <option value={6}>6 tháng / lần (Nửa năm)</option>
                  <option value={12}>12 tháng / lần (Theo năm)</option>
                </select>
                {fieldErrors.cycleMonths && (
                  <span style={{ fontSize: '12px', color: '#dc2626' }}>{fieldErrors.cycleMonths}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="convert-billing-anchor">
                  Ngày chốt hóa đơn <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  id="convert-billing-anchor"
                  value={billingAnchor}
                  onChange={(e) => setBillingAnchor(Number(e.target.value))}
                  disabled={submitting}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      Ngày {day} hàng tháng
                    </option>
                  ))}
                </select>
                {fieldErrors.billingAnchor && (
                  <span style={{ fontSize: '12px', color: '#dc2626' }}>{fieldErrors.billingAnchor}</span>
                )}
              </div>
            </div>

            {/* Lưu ý nghiệp vụ */}
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: '#92400e',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px' }}>ℹ️</span>
                <span>Đồng bộ trạng thái sau khi chuyển đổi:</span>
              </div>
              <ul style={{ margin: '4px 0 0 18px', padding: 0, color: '#b45309' }}>
                <li>
                  Hợp đồng cọc chuyển sang trạng thái <strong>ĐÃ CHUYỂN THUÊ (CONVERTED)</strong>.
                </li>
                <li>
                  Phòng <strong>{contract.roomCode}</strong> chuyển sang trạng thái <strong>ĐANG THUÊ (OCCUPIED)</strong>.
                </li>
                <li>Một hợp đồng thuê chính thức sẽ được kích hoạt ngay lập tức.</li>
              </ul>
            </div>
          </div>

          {/* Footer Actions */}
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
              style={{ minWidth: '160px', justifyContent: 'center', fontWeight: 600 }}
            >
              {submitting ? 'Đang xử lý...' : '✓ Xác nhận tạo HĐ thuê'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
