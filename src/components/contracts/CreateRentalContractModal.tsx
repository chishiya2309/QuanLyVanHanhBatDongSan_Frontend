import React, { useState, useEffect } from 'react';
import type {
  AvailableCustomerForRental,
  AvailableRoomForRental,
  RentalContract,
} from '../../types/rentalContract';
import {
  rentalContractApi,
  RentalContractApiError,
} from '../../services/rentalContractApi';
import { quickCreateCustomer } from '../../services/depositContractApi';
import './contracts.css';

interface CreateRentalContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedContract: RentalContract) => void;
  onSessionExpired?: () => void;
}

export const CreateRentalContractModal: React.FC<CreateRentalContractModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSessionExpired,
}) => {
  const [customers, setCustomers] = useState<AvailableCustomerForRental[]>([]);
  const [rooms, setRooms] = useState<AvailableRoomForRental[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [rent, setRent] = useState<number | ''>('');
  const [depositRequired, setDepositRequired] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cycleMonths, setCycleMonths] = useState<number>(1);
  const [billingAnchor, setBillingAnchor] = useState<number>(1);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick Customer Create State
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickFullName, setQuickFullName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickIdentityNo, setQuickIdentityNo] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickCustomerError, setQuickCustomerError] = useState<string | null>(null);
  const [quickSaving, setQuickSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setShowQuickCustomer(false);
      setQuickFullName('');
      setQuickPhone('');
      setQuickIdentityNo('');
      setQuickEmail('');
      setQuickCustomerError(null);
      return;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const nextYear = new Date(today);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const nextYearStr = nextYear.toISOString().split('T')[0];

    setCustomerId('');
    setRoomId('');
    setRent('');
    setDepositRequired('');
    setStartDate(todayStr);
    setEndDate(nextYearStr);
    setCycleMonths(1);
    setBillingAnchor(today.getDate());

    setLoadingData(true);
    Promise.all([
      rentalContractApi.getAvailableCustomers(),
      rentalContractApi.getAvailableRooms(),
    ])
      .then(([custList, roomList]) => {
        setCustomers(custList);
        setRooms(roomList);
      })
      .catch((err) => {
        console.error('Lỗi khi tải dữ liệu khởi tạo hợp đồng thuê:', err);
      })
      .finally(() => {
        setLoadingData(false);
      });
  }, [isOpen]);

  const handleStartDateChange = (newStartDate: string) => {
    setStartDate(newStartDate);
    if (newStartDate) {
      const parts = newStartDate.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[2], 10);
        if (!isNaN(day) && day >= 1 && day <= 31) {
          setBillingAnchor(day);
        }
      }

      if (endDate && endDate <= newStartDate) {
        const next = new Date(newStartDate);
        next.setFullYear(next.getFullYear() + 1);
        setEndDate(next.toISOString().split('T')[0]);
      }
    }
  };

  const handleRoomChange = (selectedRoomId: string) => {
    setRoomId(selectedRoomId);
    const selected = rooms.find((r) => r.id === selectedRoomId);
    if (selected) {
      if (selected.defaultRent && selected.defaultRent > 0) {
        setRent(selected.defaultRent);
      }
      if (selected.defaultDeposit && selected.defaultDeposit > 0) {
        setDepositRequired(selected.defaultDeposit);
      } else if (selected.defaultRent && selected.defaultRent > 0) {
        setDepositRequired(selected.defaultRent);
      }
    }
  };

  const handleQuickCreateCustomer = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!quickFullName.trim() || !quickPhone.trim()) {
      setQuickCustomerError('Họ tên và số điện thoại là bắt buộc');
      return;
    }

    try {
      setQuickSaving(true);
      setQuickCustomerError(null);
      const newCust = await quickCreateCustomer({
        fullName: quickFullName.trim(),
        phone: quickPhone.trim(),
        identityNo: quickIdentityNo.trim() || undefined,
        email: quickEmail.trim() || undefined,
      });

      const converted: AvailableCustomerForRental = {
        id: newCust.id,
        fullName: newCust.fullName,
        phone: newCust.phone || '',
        identityNo: newCust.identityNo,
        email: newCust.email,
      };

      setCustomers((prev) => [converted, ...prev]);
      setCustomerId(newCust.id);
      setShowQuickCustomer(false);
      setQuickFullName('');
      setQuickPhone('');
      setQuickIdentityNo('');
      setQuickEmail('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tạo nhanh khách thuê';
      setQuickCustomerError(msg);
    } finally {
      setQuickSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!customerId) {
      setErrorMessage('Vui lòng chọn khách thuê đại diện');
      return;
    }
    if (!roomId) {
      setErrorMessage('Vui lòng chọn phòng cần thuê');
      return;
    }
    if (rent === '' || Number(rent) <= 0) {
      setErrorMessage('Giá thuê phòng hàng tháng phải lớn hơn 0');
      return;
    }
    if (depositRequired === '' || Number(depositRequired) < 0) {
      setErrorMessage('Tiền cọc cam kết không được âm');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMessage('Vui lòng nhập ngày bắt đầu và kết thúc thuê');
      return;
    }
    if (endDate <= startDate) {
      setErrorMessage('Ngày kết thúc thuê phải sau ngày bắt đầu thuê');
      return;
    }
    if (cycleMonths < 1) {
      setErrorMessage('Chu kỳ thanh toán phải từ 1 tháng trở lên');
      return;
    }

    try {
      setSubmitting(true);
      const response = await rentalContractApi.createRentalContract({
        customerId,
        roomId,
        rent: Number(rent),
        depositRequired: Number(depositRequired),
        startDate,
        endDate,
        cycleMonths,
        billingAnchor,
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
        const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo hợp đồng thuê';
        setErrorMessage(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="contract-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="contract-modal" onClick={(e) => e.stopPropagation()}>
        <div className="contract-modal-header">
          <div>
            <h2>Lập hợp đồng thuê mới</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--color-muted)', fontSize: '13px' }}>
              Tạo hợp đồng thuê trực tiếp, tự động kích hoạt trạng thái ĐANG THUÊ (OCCUPIED) cho phòng
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

            {/* Khách thuê */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label required">Khách thuê đại diện</label>
                <button
                  type="button"
                  onClick={() => setShowQuickCustomer(!showQuickCustomer)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-accent-primary, #b91c1c)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {showQuickCustomer ? '✕ Thu gọn' : '+ Thêm nhanh khách mới'}
                </button>
              </div>

              {showQuickCustomer && (
                <div
                  style={{
                    background: '#f9fafb',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--color-rule)',
                    marginBottom: '12px',
                  }}
                >
                  <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600 }}>Tạo nhanh hồ sơ khách thuê</p>
                  {quickCustomerError && (
                    <div style={{ color: '#dc2626', fontSize: '12px', marginBottom: '8px' }}>
                      {quickCustomerError}
                    </div>
                  )}
                  <div className="form-row" style={{ marginBottom: '8px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Họ và tên *"
                        value={quickFullName}
                        onChange={(e) => setQuickFullName(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Số điện thoại *"
                        value={quickPhone}
                        onChange={(e) => setQuickPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-row" style={{ marginBottom: '8px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="CCCD/CMND (tùy chọn)"
                        value={quickIdentityNo}
                        onChange={(e) => setQuickIdentityNo(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="Email (tùy chọn)"
                        value={quickEmail}
                        onChange={(e) => setQuickEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="contract-action-btn btn-primary"
                    onClick={handleQuickCreateCustomer}
                    disabled={quickSaving}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    {quickSaving ? 'Đang lưu...' : 'Lưu và chọn khách này'}
                  </button>
                </div>
              )}

              <select
                className="form-control"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                disabled={loadingData}
                required
              >
                <option value="">-- Chọn khách thuê đại diện --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} - {c.phone} {c.identityNo ? `(${c.identityNo})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Phòng thuê */}
            <div className="form-group">
              <label className="form-label required">Phòng thuê (chỉ phòng Đang trống - VACANT)</label>
              <select
                className="form-control"
                value={roomId}
                onChange={(e) => handleRoomChange(e.target.value)}
                disabled={loadingData}
                required
              >
                <option value="">-- Chọn phòng trống --</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} - {r.name} ({r.buildingName ? `${r.buildingName} - ` : ''}Tầng {r.floorLevel || 0})
                    {r.defaultRent ? ` - ${Number(r.defaultRent).toLocaleString('vi-VN')} đ/th` : ''}
                  </option>
                ))}
              </select>
              {rooms.length === 0 && !loadingData && (
                <small style={{ color: '#d97706', display: 'block', marginTop: '4px' }}>
                  Hiện không có phòng nào đang trống (VACANT) để lập hợp đồng thuê mới.
                </small>
              )}
            </div>

            {/* Giá thuê và Tiền cọc */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Giá thuê thỏa thuận (VNĐ/tháng)</label>
                <div className="input-group">
                  <input
                    type="number"
                    step="any"
                    min="1"
                    className="form-control"
                    placeholder="Ví dụ: 4500000"
                    value={rent}
                    onChange={(e) => setRent(e.target.value === '' ? '' : Number(e.target.value))}
                    required
                  />
                  <span className="input-suffix">VNĐ/tháng</span>
                </div>
                {rent !== '' && Number(rent) > 0 && (
                  <small style={{ color: 'var(--color-muted)', display: 'block', marginTop: '4px' }}>
                    {Number(rent).toLocaleString('vi-VN')} đ/tháng
                  </small>
                )}
              </div>

              <div className="form-group">
                <label className="form-label required">Tiền cọc cam kết HĐ (VNĐ)</label>
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
              </div>
            </div>

            {/* Ngày bắt đầu và kết thúc */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Ngày bắt đầu thuê</label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label required">Ngày kết thúc thuê</label>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Chu kỳ thanh toán và Ngày chốt hóa đơn */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Chu kỳ thanh toán</label>
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

            {/* Callout box về quy trình tự động UC16 */}
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                fontSize: '13px',
                color: '#166534',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Đồng bộ trạng thái sau khi tạo hợp đồng:
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                <li>Hợp đồng thuê chính thức sẽ được kích hoạt ngay ở trạng thái <strong>ĐANG HIỆU LỰC (ACTIVE)</strong>.</li>
                <li>Phòng thuê sẽ tự động chuyển từ Đang trống sang <strong>ĐANG THUÊ (OCCUPIED)</strong>.</li>
                <li>Hệ thống tự động khởi tạo lượt ở đầu tiên (RoomTenancy) tương ứng với thời hạn hợp đồng.</li>
              </ul>
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
              disabled={submitting || loadingData}
            >
              {submitting ? 'Đang tạo hợp đồng...' : 'Xác nhận tạo HĐ thuê'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
