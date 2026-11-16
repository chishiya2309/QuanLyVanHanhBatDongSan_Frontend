import React, { useState, useEffect } from 'react';
import type { RentalContract, AvailableRoomForRental, TransferRoomInput } from '../../types/rentalContract';
import {
  rentalContractApi,
  RentalContractApiError,
} from '../../services/rentalContractApi';
import './contracts.css';

interface TransferRoomModalProps {
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

const getTodayString = (): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const TransferRoomModal: React.FC<TransferRoomModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  contract,
  onSessionExpired,
}) => {
  // Form fields
  const [availableRooms, setAvailableRooms] = useState<AvailableRoomForRental[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [newRent, setNewRent] = useState<number | ''>('');
  const [oldRoomElectricityIndex, setOldRoomElectricityIndex] = useState<number | ''>('');
  const [oldRoomWaterIndex, setOldRoomWaterIndex] = useState<number | ''>('');
  const [newRoomElectricityIndex, setNewRoomElectricityIndex] = useState<number | ''>('');
  const [newRoomWaterIndex, setNewRoomWaterIndex] = useState<number | ''>('');
  const [handoverNote, setHandoverNote] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset and load available rooms when modal opens
  useEffect(() => {
    if (!isOpen || !contract) {
      setSelectedRoomId('');
      setTransferDate('');
      setNewRent('');
      setOldRoomElectricityIndex('');
      setOldRoomWaterIndex('');
      setNewRoomElectricityIndex('');
      setNewRoomWaterIndex('');
      setHandoverNote('');
      setAvailableRooms([]);
      setErrorMessage(null);
      setFieldErrors({});
      setSubmitting(false);
      return;
    }

    // Default transferDate to today, bounded by contract range
    const today = getTodayString();
    const currentTenancy = contract.tenancies && contract.tenancies.length > 0
      ? contract.tenancies[contract.tenancies.length - 1]
      : null;
    const minD = currentTenancy?.fromDate || contract.startDate || '';
    const maxD = contract.endDate || '';

    let initialDate = today;
    if (minD && initialDate < minD) initialDate = minD;
    if (maxD && initialDate > maxD) initialDate = maxD;
    setTransferDate(initialDate);

    // Fetch available rooms for this contract
    setLoadingRooms(true);
    setErrorMessage(null);
    setFieldErrors({});

    rentalContractApi
      .getTransferAvailableRooms(contract.id)
      .then((rooms) => {
        setAvailableRooms(rooms);
      })
      .catch((err) => {
        if (err instanceof RentalContractApiError) {
          if (err.status === 401 && onSessionExpired) {
            onSessionExpired();
            return;
          }
          setErrorMessage(err.message);
        } else {
          setErrorMessage('Không thể tải danh sách phòng khả dụng');
        }
      })
      .finally(() => {
        setLoadingRooms(false);
      });
  }, [isOpen, contract, onSessionExpired]);

  if (!isOpen || !contract) return null;

  const currentTenancy = contract.tenancies && contract.tenancies.length > 0
    ? contract.tenancies[contract.tenancies.length - 1]
    : null;
  const minDate = currentTenancy?.fromDate || contract.startDate || '';
  const maxDate = contract.endDate || '';

  const handleRoomChange = (roomId: string) => {
    setSelectedRoomId(roomId);
    if (fieldErrors.newRoomId) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.newRoomId;
        return next;
      });
    }

    const room = availableRooms.find((r) => r.id === roomId);
    if (room && room.defaultRent !== undefined && room.defaultRent !== null) {
      setNewRent(room.defaultRent);
      if (fieldErrors.newRent) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.newRent;
          return next;
        });
      }
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!selectedRoomId) {
      errors.newRoomId = 'Vui lòng chọn phòng mới cần chuyển đến';
    } else if (contract.currentRoomId && selectedRoomId === contract.currentRoomId) {
      errors.newRoomId = 'Phòng mới phải khác phòng hiện tại đang thuê';
    }

    if (!transferDate) {
      errors.transferDate = 'Vui lòng chọn ngày chuyển phòng';
    } else {
      if (minDate && transferDate < minDate) {
        errors.transferDate = `Ngày chuyển phòng không được trước ngày bắt đầu ở (${formatDateDisplay(minDate)})`;
      } else if (maxDate && transferDate > maxDate) {
        errors.transferDate = `Ngày chuyển phòng không được sau ngày kết thúc hợp đồng (${formatDateDisplay(maxDate)})`;
      }
    }

    if (newRent === '' || Number(newRent) <= 0) {
      errors.newRent = 'Giá thuê mới phải lớn hơn 0';
    }

    if (oldRoomElectricityIndex !== '' && Number(oldRoomElectricityIndex) < 0) {
      errors.oldRoomElectricityIndex = 'Chỉ số điện không được âm';
    }
    if (oldRoomWaterIndex !== '' && Number(oldRoomWaterIndex) < 0) {
      errors.oldRoomWaterIndex = 'Chỉ số nước không được âm';
    }
    if (newRoomElectricityIndex !== '' && Number(newRoomElectricityIndex) < 0) {
      errors.newRoomElectricityIndex = 'Chỉ số điện không được âm';
    }
    if (newRoomWaterIndex !== '' && Number(newRoomWaterIndex) < 0) {
      errors.newRoomWaterIndex = 'Chỉ số nước không được âm';
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

    const payload: TransferRoomInput = {
      newRoomId: selectedRoomId,
      transferDate,
      newRent: Number(newRent),
      handoverNote: handoverNote.trim() ? handoverNote.trim() : undefined,
      oldRoomElectricityIndex: oldRoomElectricityIndex !== '' ? Number(oldRoomElectricityIndex) : undefined,
      oldRoomWaterIndex: oldRoomWaterIndex !== '' ? Number(oldRoomWaterIndex) : undefined,
      newRoomElectricityIndex: newRoomElectricityIndex !== '' ? Number(newRoomElectricityIndex) : undefined,
      newRoomWaterIndex: newRoomWaterIndex !== '' ? Number(newRoomWaterIndex) : undefined,
    };

    try {
      setSubmitting(true);
      const updatedContract = await rentalContractApi.transferRoom(contract.id, payload);
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
        const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi thực hiện chuyển phòng thuê';
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
      <div className="contract-modal" style={{ maxWidth: '640px', width: '94%' }}>
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
              Chuyển phòng thuê
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
            {errorMessage && (
              <div className="error-banner" role="alert">
                {errorMessage}
              </div>
            )}

            {/* Workflow Guidance Banner */}
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                padding: '10px 14px',
                fontSize: '12.5px',
                color: '#1e40af',
                lineHeight: 1.5,
              }}
            >
              <strong>Quy trình chuyển phòng (UC30):</strong> Phòng cũ sẽ chuyển về trạng thái <strong>Trống (VACANT)</strong>,
              phòng mới chuyển sang <strong>Đang thuê (OCCUPIED)</strong>. Hệ thống lưu trữ chỉ số điện nước bàn giao và lịch sử lượt ở,
              hợp đồng tiếp tục duy trì trạng thái <strong>Đang hiệu lực (ACTIVE)</strong>.
            </div>

            {/* Current Contract & Room Summary Card */}
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
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px' }}>Phòng đang thuê hiện tại:</span>
                  <span style={{ fontWeight: 600, color: '#b91c1c' }}>
                    {contract.currentRoomCode || '---'} {contract.currentRoomName ? `- ${contract.currentRoomName}` : ''}
                  </span>
                  {contract.currentRent && (
                    <span style={{ color: '#047857', display: 'block', fontSize: '12px', marginTop: '2px', fontWeight: 500 }}>
                      {Number(contract.currentRent).toLocaleString('vi-VN')} đ/tháng
                    </span>
                  )}
                </div>
              </div>

              <div
                style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  color: '#64748b',
                }}
              >
                <span>Thời hạn hợp đồng: <strong>{formatDateDisplay(contract.startDate)}</strong> ➔ <strong>{formatDateDisplay(contract.endDate)}</strong></span>
                {currentTenancy?.fromDate && (
                  <span>Lượt ở hiện tại từ: <strong>{formatDateDisplay(currentTenancy.fromDate)}</strong></span>
                )}
              </div>
            </div>

            {/* Room Selection */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Chọn phòng mới cần chuyển đến <span style={{ color: '#dc2626' }}>*</span>
              </label>
              {loadingRooms ? (
                <div style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic', padding: '8px 0' }}>
                  Đang tải danh sách phòng khả dụng...
                </div>
              ) : availableRooms.length === 0 ? (
                <div
                  style={{
                    padding: '10px 12px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    color: '#991b1b',
                    fontSize: '13px',
                  }}
                >
                  Không có phòng nào đang trống (VACANT) để chuyển đến vào thời điểm này.
                </div>
              ) : (
                <select
                  value={selectedRoomId}
                  onChange={(e) => handleRoomChange(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: fieldErrors.newRoomId ? '1px solid #ef4444' : '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    backgroundColor: '#fff',
                  }}
                >
                  <option value="">-- Chọn phòng trống --</option>
                  {availableRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.name} {r.buildingName ? `(${r.buildingName})` : ''}
                      {r.floorLevel !== undefined && r.floorLevel !== null ? ` - Tầng ${r.floorLevel}` : ''}
                      {r.area ? ` - ${r.area} m²` : ''}
                      {r.defaultRent ? ` - Giá gợi ý: ${Number(r.defaultRent).toLocaleString('vi-VN')} đ` : ''}
                    </option>
                  ))}
                </select>
              )}
              {fieldErrors.newRoomId && (
                <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {fieldErrors.newRoomId}
                </span>
              )}
            </div>

            {/* Transfer Date and New Rent */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Ngày bắt đầu chuyển phòng <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="date"
                  value={transferDate}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => {
                    setTransferDate(e.target.value);
                    if (fieldErrors.transferDate) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.transferDate;
                        return next;
                      });
                    }
                  }}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: fieldErrors.transferDate ? '1px solid #ef4444' : '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                />
                {fieldErrors.transferDate && (
                  <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {fieldErrors.transferDate}
                  </span>
                )}
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                  Từ {formatDateDisplay(minDate)} đến {formatDateDisplay(maxDate)}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Giá thuê mới (VNĐ/tháng) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="10000"
                  value={newRent}
                  placeholder="Nhập giá thuê..."
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setNewRent(val);
                    if (fieldErrors.newRent) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.newRent;
                        return next;
                      });
                    }
                  }}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: fieldErrors.newRent ? '1px solid #ef4444' : '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                />
                {fieldErrors.newRent && (
                  <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    {fieldErrors.newRent}
                  </span>
                )}
                {newRent !== '' && Number(newRent) > 0 && (
                  <span style={{ fontSize: '11.5px', color: '#047857', marginTop: '2px', display: 'block', fontWeight: 500 }}>
                    {Number(newRent).toLocaleString('vi-VN')} đ/tháng
                  </span>
                )}
              </div>
            </div>

            {/* Handover Meter Readings */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '12px 14px',
                background: '#fafafa',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '10px' }}>
                Chỉ số điện nước bàn giao (Tùy chọn ghi nhận)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* Old room final meter */}
                <div style={{ padding: '8px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#b91c1c', marginBottom: '8px' }}>
                    Chốt chỉ số trả phòng cũ
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: '#475569', marginBottom: '3px' }}>
                        Điện chốt cuối (kWh)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="VD: 1420"
                        value={oldRoomElectricityIndex}
                        onChange={(e) => {
                          setOldRoomElectricityIndex(e.target.value === '' ? '' : Number(e.target.value));
                        }}
                        disabled={submitting}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: fieldErrors.oldRoomElectricityIndex ? '1px solid #ef4444' : '1px solid #cbd5e1',
                          borderRadius: '4px',
                          fontSize: '12.5px',
                        }}
                      />
                      {fieldErrors.oldRoomElectricityIndex && (
                        <span style={{ color: '#ef4444', fontSize: '11px' }}>{fieldErrors.oldRoomElectricityIndex}</span>
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: '#475569', marginBottom: '3px' }}>
                        Nước chốt cuối (m³)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="VD: 55"
                        value={oldRoomWaterIndex}
                        onChange={(e) => {
                          setOldRoomWaterIndex(e.target.value === '' ? '' : Number(e.target.value));
                        }}
                        disabled={submitting}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: fieldErrors.oldRoomWaterIndex ? '1px solid #ef4444' : '1px solid #cbd5e1',
                          borderRadius: '4px',
                          fontSize: '12.5px',
                        }}
                      />
                      {fieldErrors.oldRoomWaterIndex && (
                        <span style={{ color: '#ef4444', fontSize: '11px' }}>{fieldErrors.oldRoomWaterIndex}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* New room initial meter */}
                <div style={{ padding: '8px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#047857', marginBottom: '8px' }}>
                    Chỉ số khởi đầu nhận phòng mới
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: '#475569', marginBottom: '3px' }}>
                        Điện nhận bàn giao (kWh)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="VD: 0 hoặc chỉ số hiện tại"
                        value={newRoomElectricityIndex}
                        onChange={(e) => {
                          setNewRoomElectricityIndex(e.target.value === '' ? '' : Number(e.target.value));
                        }}
                        disabled={submitting}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: fieldErrors.newRoomElectricityIndex ? '1px solid #ef4444' : '1px solid #cbd5e1',
                          borderRadius: '4px',
                          fontSize: '12.5px',
                        }}
                      />
                      {fieldErrors.newRoomElectricityIndex && (
                        <span style={{ color: '#ef4444', fontSize: '11px' }}>{fieldErrors.newRoomElectricityIndex}</span>
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: '#475569', marginBottom: '3px' }}>
                        Nước nhận bàn giao (m³)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="VD: 0 hoặc chỉ số hiện tại"
                        value={newRoomWaterIndex}
                        onChange={(e) => {
                          setNewRoomWaterIndex(e.target.value === '' ? '' : Number(e.target.value));
                        }}
                        disabled={submitting}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: fieldErrors.newRoomWaterIndex ? '1px solid #ef4444' : '1px solid #cbd5e1',
                          borderRadius: '4px',
                          fontSize: '12.5px',
                        }}
                      />
                      {fieldErrors.newRoomWaterIndex && (
                        <span style={{ color: '#ef4444', fontSize: '11px' }}>{fieldErrors.newRoomWaterIndex}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Handover Note / Reason */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Ghi chú chuyển phòng / Bàn giao
              </label>
              <textarea
                rows={3}
                value={handoverNote}
                onChange={(e) => setHandoverNote(e.target.value)}
                placeholder="Nhập lý do đổi phòng, tình trạng bàn giao phòng cũ / phòng mới..."
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '13px',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div
            className="contract-modal-footer"
            style={{
              padding: '14px 20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              background: '#f8fafc',
            }}
          >
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
              disabled={submitting || loadingRooms || availableRooms.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#4f46e5',
                borderColor: '#4338ca',
                color: '#fff',
                fontWeight: 600,
              }}
            >
              {submitting ? (
                <>
                  <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                  Đang xử lý...
                </>
              ) : (
                'Xác nhận chuyển phòng'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
