import React, { useState, useEffect } from 'react';
import type { DepositContract } from '../../types/depositContract';
import { cancelDepositContract, DepositContractApiError } from '../../services/depositContractApi';

interface CancelDepositModalProps {
  isOpen: boolean;
  contract: DepositContract | null;
  onClose: () => void;
  onSuccess: (updatedContract: DepositContract) => void;
  onSessionExpired?: () => void;
}

export const CancelDepositModal: React.FC<CancelDepositModalProps> = ({
  isOpen,
  contract,
  onClose,
  onSuccess,
  onSessionExpired,
}) => {
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setValidationError(null);
      setGeneralError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !contract) return null;

  const isReserved = contract.status === 'RESERVED';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setGeneralError(null);

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setValidationError('Vui lòng nhập lý do hủy đặt cọc');
      return;
    }

    try {
      setSubmitting(true);
      const updated = await cancelDepositContract(contract.id, trimmedReason);
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      if (err instanceof DepositContractApiError) {
        if (err.status === 401) {
          onSessionExpired?.();
          return;
        }
        if (err.status === 400) {
          const fieldMsg = err.fieldErrors?.reason || err.message || 'Vui lòng nhập lý do hủy đặt cọc';
          setValidationError(fieldMsg);
          return;
        }
        setGeneralError(err.message);
      } else {
        setGeneralError('Đã có lỗi xảy ra trong quá trình hủy đặt cọc. Vui lòng thử lại sau.');
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
      <div className="contract-modal" style={{ maxWidth: '520px', width: '90%' }}>
        <div className="contract-modal-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '16px 20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#dc2626', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span> Hủy hợp đồng đặt cọc
          </h2>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            disabled={submitting}
            aria-label="Đóng"
            style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="contract-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {generalError && (
              <div style={{ background: '#fef2f2', border: '1px solid #f87171', color: '#991b1b', padding: '10px 14px', borderRadius: '6px', fontSize: '13px' }}>
                {generalError}
              </div>
            )}

            {/* Thông tin tóm tắt hợp đồng */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Mã hợp đồng:</span>
                  <strong style={{ color: '#0f172a' }}>{contract.contractNumber}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Khách thuê đại diện:</span>
                  <strong style={{ color: '#0f172a' }}>{contract.customerName || contract.partySnapshot?.customerName || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Phòng đặt cọc:</span>
                  <strong style={{ color: '#0f172a' }}>{contract.roomCode} ({contract.buildingName})</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Số tiền cọc:</span>
                  <strong style={{ color: '#b91c1c' }}>{Number(contract.amountRequired).toLocaleString('vi-VN')} đ</strong>
                </div>
              </div>
            </div>

            {/* Hộp cảnh báo */}
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 14px', display: 'flex', gap: '10px' }}>
              <span style={{ fontSize: '18px', lineHeight: 1 }}>📢</span>
              <div style={{ fontSize: '13px', color: '#92400e', lineHeight: 1.5 }}>
                {isReserved ? (
                  <>
                    <strong>Lưu ý:</strong> Hợp đồng sẽ chuyển sang trạng thái <strong>ĐÃ HỦY (CANCELLED)</strong> và phòng <strong>{contract.roomCode}</strong> sẽ được tự động hoàn trả về trạng thái <strong>ĐANG TRỐNG (VACANT)</strong> để sẵn sàng cho khách khác cọc hoặc thuê.
                  </>
                ) : (
                  <>
                    <strong>Lưu ý:</strong> Hợp đồng nháp sẽ được chuyển sang trạng thái <strong>ĐÃ HỦY (CANCELLED)</strong>.
                  </>
                )}
              </div>
            </div>

            {/* Ô nhập lý do hủy */}
            <div>
              <label htmlFor="cancel-reason-input" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Lý do hủy đặt cọc (*)
              </label>
              <textarea
                id="cancel-reason-input"
                rows={3}
                placeholder="Nhập lý do khách hủy hoặc không đến nhận phòng..."
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: validationError ? '1px solid #ef4444' : '1px solid #cbd5e1',
                  outline: 'none',
                  backgroundColor: submitting ? '#f1f5f9' : '#fff',
                  boxShadow: validationError ? '0 0 0 1px #ef4444' : 'none',
                  resize: 'vertical',
                }}
                autoFocus
              />
              {validationError && (
                <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', fontWeight: 500 }}>
                  {validationError}
                </div>
              )}
            </div>
          </div>

          <div
            className="contract-modal-footer"
            style={{
              padding: '14px 20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              background: '#f8fafc',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: submitting ? 'not-allowed' : 'pointer',
                background: '#fff',
                border: '1px solid #cbd5e1',
                color: '#475569',
              }}
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                background: '#dc2626',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {submitting ? (
                <>
                  <span className="spinner" style={{ width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
                  Đang xử lý...
                </>
              ) : (
                'Xác nhận hủy đặt cọc'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

