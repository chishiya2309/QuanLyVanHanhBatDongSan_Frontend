import React, { useState, useEffect, useMemo } from 'react';
import type { RentalContract, TerminationRecord, TerminateRentalContractInput } from '../../types/rentalContract';
import {
  rentalContractApi,
  RentalContractApiError,
} from '../../services/rentalContractApi';
import './contracts.css';

interface TerminateRentalContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (record: TerminationRecord) => void;
  contract: RentalContract | null;
  onSessionExpired?: () => void;
  initialDeductionReason?: string;
}

const formatDateDisplay = (dateStr?: string): string => {
  if (!dateStr) return '---';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const formatCurrency = (val?: number | null): string => {
  if (val === undefined || val === null) return '0 đ';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
};

const getTodayString = (): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const TerminateRentalContractModal: React.FC<TerminateRentalContractModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  contract,
  onSessionExpired,
  initialDeductionReason,
}) => {
  const [endedAt, setEndedAt] = useState('');
  const [debtRemaining, setDebtRemaining] = useState<number | ''>(0);
  const [deductionAmount, setDeductionAmount] = useState<number | ''>(0);
  const [deductionReason, setDeductionReason] = useState('');
  const [reason, setReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Lấy lượt ở hiện tại
  const currentTenancy = useMemo(() => {
    if (!contract || !contract.tenancies || contract.tenancies.length === 0) return null;
    return (
      contract.tenancies.find((t) => !t.toDate || t.toDate === contract.endDate) ||
      contract.tenancies[contract.tenancies.length - 1]
    );
  }, [contract]);

  const minEndedDate = useMemo(() => {
    return currentTenancy?.fromDate || contract?.startDate || '';
  }, [currentTenancy, contract]);

  const maxEndedDate = useMemo(() => {
    return getTodayString();
  }, []);

  // Tính toán quyết toán tự động
  const depositHeld = contract?.depositRequired || 0;
  const debt = typeof debtRemaining === 'number' ? debtRemaining : 0;
  const deduction = typeof deductionAmount === 'number' ? deductionAmount : 0;
  const refundDue = depositHeld - debt - deduction;

  useEffect(() => {
    if (!isOpen || !contract) {
      setEndedAt('');
      setDebtRemaining(0);
      setDeductionAmount(0);
      setDeductionReason('');
      setReason('');
      setErrorMessage(null);
      setFieldErrors({});
      setSubmitting(false);
      return;
    }

    setDeductionReason(initialDeductionReason || '');

    const today = getTodayString();
    if (minEndedDate && today < minEndedDate) {
      setEndedAt(minEndedDate);
    } else {
      setEndedAt(today);
    }
  }, [isOpen, contract, minEndedDate, initialDeductionReason]);

  if (!isOpen || !contract) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!endedAt) {
      errors.endedAt = 'Vui lòng chọn ngày kết thúc thực tế';
    } else {
      if (minEndedDate && endedAt < minEndedDate) {
        errors.endedAt = `Ngày kết thúc không được trước ngày nhận phòng (${formatDateDisplay(minEndedDate)})`;
      }
      if (endedAt > maxEndedDate) {
        errors.endedAt = 'Ngày kết thúc thực tế không được vượt quá ngày hiện tại';
      }
    }

    if (debt < 0) {
      errors.debtRemaining = 'Công nợ còn lại không được là số âm';
    }

    if (deduction < 0) {
      errors.deductionAmount = 'Chi phí khấu trừ không được là số âm';
    }

    if (deduction > 0 && !deductionReason.trim()) {
      errors.deductionReason = 'Vui lòng nhập diễn giải lý do khấu trừ hoặc bồi thường';
    }

    if (!reason.trim()) {
      errors.reason = 'Vui lòng nhập lý do thanh lý hợp đồng';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setErrorMessage(null);

    const payload: TerminateRentalContractInput = {
      endedAt,
      debtRemaining: debt,
      deductionAmount: deduction,
      deductionReason: deduction > 0 ? deductionReason.trim() : undefined,
      reason: reason.trim(),
    };

    try {
      const record = await rentalContractApi.terminateRentalContract(contract.id, payload);
      onSuccess(record);
      onClose();
    } catch (err) {
      if (err instanceof RentalContractApiError) {
        if (err.status === 401 && onSessionExpired) {
          onSessionExpired();
          return;
        }
        setErrorMessage(err.message);
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors);
        }
      } else {
        setErrorMessage('Không thể thực hiện thanh lý hợp đồng. Vui lòng thử lại sau.');
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
      <div className="contract-modal" style={{ maxWidth: '640px', width: '92%' }}>
        {/* Modal Header */}
        <div
          className="contract-modal-header"
          style={{
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
              Thanh lý hợp đồng thuê
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            className="contract-modal-body"
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxHeight: '74vh',
              overflowY: 'auto',
            }}
          >
            {/* Global Error Banner */}
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
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '10px',
                fontSize: '12.5px',
              }}
            >
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>Khách thuê:</span>
                <strong style={{ color: '#1e293b' }}>{contract.customerName}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>Phòng hiện tại:</span>
                <strong style={{ color: '#0369a1' }}>
                  {currentTenancy ? currentTenancy.roomCode : contract.currentRoomCode || '---'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>Thời hạn hợp đồng:</span>
                <span style={{ color: '#334155' }}>
                  {formatDateDisplay(contract.startDate)} &rarr; {formatDateDisplay(contract.endDate)}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>Tiền cọc cam kết:</span>
                <strong style={{ color: '#047857' }}>{formatCurrency(depositHeld)}</strong>
              </div>
            </div>

            {/* Form Fields: Row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* Ngày kết thúc thực tế */}
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Ngày kết thúc thực tế <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="date"
                  min={minEndedDate}
                  max={maxEndedDate}
                  value={endedAt}
                  onChange={(e) => {
                    setEndedAt(e.target.value);
                    if (fieldErrors.endedAt) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.endedAt;
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
                    borderColor: fieldErrors.endedAt ? '#ef4444' : '#cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                  }}
                />
                {fieldErrors.endedAt ? (
                  <span style={{ fontSize: '12px', color: '#dc2626' }}>{fieldErrors.endedAt}</span>
                ) : (
                  <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                    Từ {formatDateDisplay(minEndedDate)} đến hôm nay
                  </span>
                )}
              </div>

              {/* Tiền cọc đang giữ */}
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Tiền cọc đang giữ
                </label>
                <input
                  type="text"
                  disabled
                  value={formatCurrency(depositHeld)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                    background: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'not-allowed',
                  }}
                />
                <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>Tiền cọc quy định theo hợp đồng</span>
              </div>
            </div>

            {/* Form Fields: Row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* Nợ tiền thuê / dịch vụ còn lại */}
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Nợ tiền thuê / dịch vụ còn lại (đ)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  value={debtRemaining === '' ? '' : debtRemaining}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDebtRemaining(val === '' ? '' : Number(val));
                    if (fieldErrors.debtRemaining) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.debtRemaining;
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
                    borderColor: fieldErrors.debtRemaining ? '#ef4444' : '#cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                  }}
                />
                {fieldErrors.debtRemaining && (
                  <span style={{ fontSize: '12px', color: '#dc2626' }}>{fieldErrors.debtRemaining}</span>
                )}
              </div>

              {/* Chi phí khấu trừ / bồi thường */}
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Khấu trừ / Bồi thường hư hại (đ)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  value={deductionAmount === '' ? '' : deductionAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDeductionAmount(val === '' ? '' : Number(val));
                    if (fieldErrors.deductionAmount) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.deductionAmount;
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
                    borderColor: fieldErrors.deductionAmount ? '#ef4444' : '#cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                  }}
                />
                {fieldErrors.deductionAmount && (
                  <span style={{ fontSize: '12px', color: '#dc2626' }}>{fieldErrors.deductionAmount}</span>
                )}
              </div>
            </div>

            {/* Diễn giải lý do khấu trừ (khi deduction > 0) */}
            {deduction > 0 && (
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Lý do khấu trừ / bồi thường <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={deductionReason}
                  onChange={(e) => {
                    setDeductionReason(e.target.value);
                    if (fieldErrors.deductionReason) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.deductionReason;
                        return next;
                      });
                    }
                  }}
                  placeholder="Ví dụ: Bồi thường hỏng thiết bị phòng, cửa kính nứt, vệ sinh..."
                  disabled={submitting}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: fieldErrors.deductionReason ? '#ef4444' : '#cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                  }}
                />
                {fieldErrors.deductionReason && (
                  <span style={{ fontSize: '12px', color: '#dc2626' }}>{fieldErrors.deductionReason}</span>
                )}
              </div>
            )}

            {/* Bảng Quyết toán tài chính trực quan (FC-06-12) */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em' }}>
                  Bảng quyết toán tài chính
                </span>
                <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                  (Tiền cọc - Công nợ - Khấu trừ)
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Tiền cọc giữ:</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(depositHeld)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Trừ Công nợ tồn đọng:</span>
                <span style={{ fontWeight: 600, color: '#b45309' }}>- {formatCurrency(debt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Trừ Khấu trừ hư hại / bồi thường:</span>
                <span style={{ fontWeight: 600, color: '#b45309' }}>- {formatCurrency(deduction)}</span>
              </div>

              <div
                style={{
                  borderTop: '1px dashed #cbd5e1',
                  paddingTop: '8px',
                  marginTop: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 700, color: '#1e293b' }}>
                  {refundDue > 0
                    ? 'Số tiền hoàn lại cho khách:'
                    : refundDue < 0
                    ? 'Số tiền khách phải nộp bù:'
                    : 'Số tiền chênh lệch (tất toán đủ):'}
                </span>
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    color: refundDue > 0 ? '#16a34a' : refundDue < 0 ? '#dc2626' : '#475569',
                  }}
                >
                  {refundDue > 0 ? `+ ${formatCurrency(refundDue)}` : formatCurrency(refundDue)}
                </span>
              </div>

              {refundDue > 0 && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '4px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    color: '#15803d',
                    marginTop: '4px',
                  }}
                >
                  ✓ Hệ thống sẽ ghi nhận giao dịch hoàn cọc <strong>{formatCurrency(refundDue)}</strong> cho khách thuê.
                </div>
              )}
              {refundDue < 0 && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '4px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    color: '#b91c1c',
                    marginTop: '4px',
                  }}
                >
                  ⚠️ Khách thuê cần thanh toán bù <strong>{formatCurrency(Math.abs(refundDue))}</strong> trước khi hoàn tất thủ tục bàn giao.
                </div>
              )}
            </div>

            {/* Lý do thanh lý */}
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Lý do thanh lý hợp đồng <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                rows={2}
                placeholder="Ví dụ: Hết hạn hợp đồng khách không gia hạn, chuyển công tác, chấm dứt trước hạn..."
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

            {/* Warning Banner */}
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                padding: '10px 14px',
                fontSize: '12.5px',
                color: '#92400e',
                lineHeight: 1.5,
              }}
            >
              <strong>Lưu ý:</strong> Sau khi xác nhận thanh lý, hợp đồng sẽ chuyển sang trạng thái{' '}
              <strong>ĐÃ THANH LÝ (TERMINATED)</strong>, phòng sẽ tự động chuyển về trạng thái{' '}
              <strong>TRỐNG (VACANT)</strong> và không thể hoàn tác.
            </div>
          </div>

          {/* Modal Footer */}
          <div className="contract-modal-footer">
            <button
              type="button"
              className="contract-action-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="contract-action-btn"
              disabled={submitting}
              style={{
                background: '#dc2626',
                borderColor: '#b91c1c',
                color: 'white',
                minWidth: '160px',
                justifyContent: 'center',
                fontWeight: 600,
              }}
            >
              {submitting ? 'Đang xử lý...' : '✓ Xác nhận thanh lý'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
