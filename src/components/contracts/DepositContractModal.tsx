import React, { useState, useEffect } from 'react';
import type {
  AvailableCustomerForDeposit,
  AvailableRoomForDeposit,
  DepositContract,
  CreateDepositContractInput,
  UpdateDepositContractInput,
} from '../../types/depositContract';
import {
  createDepositContract,
  updateDepositContract,
  getAvailableCustomersForDeposit,
  getAvailableRoomsForDeposit,
  quickCreateCustomer,
  DepositContractApiError,
} from '../../services/depositContractApi';

interface DepositContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedContract: DepositContract) => void;
  contractToEdit?: DepositContract | null;
  onSessionExpired?: () => void;
}

export const DepositContractModal: React.FC<DepositContractModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  contractToEdit,
  onSessionExpired,
}) => {
  const isEditing = Boolean(contractToEdit);

  const [customers, setCustomers] = useState<AvailableCustomerForDeposit[]>([]);
  const [rooms, setRooms] = useState<AvailableRoomForDeposit[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isChangingRoom, setIsChangingRoom] = useState(false);
  const [amountRequired, setAmountRequired] = useState<number | ''>('');
  const [reservedFrom, setReservedFrom] = useState('');
  const [moveInDate, setMoveInDate] = useState('');
  const [note, setNote] = useState('');

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

  // Initialize form
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setIsChangingRoom(false);
      setShowQuickCustomer(false);
      setQuickFullName('');
      setQuickPhone('');
      setQuickIdentityNo('');
      setQuickEmail('');
      setQuickCustomerError(null);
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStr = nextWeekDate.toISOString().split('T')[0];

    if (contractToEdit) {
      setCustomerId(contractToEdit.customerId);
      setRoomId(contractToEdit.roomId);
      setAmountRequired(contractToEdit.amountRequired);
      setReservedFrom(contractToEdit.reservedFrom);
      setMoveInDate(contractToEdit.moveInDate);
      setNote(contractToEdit.note || '');
    } else {
      setCustomerId('');
      setRoomId('');
      setAmountRequired('');
      setReservedFrom(todayStr);
      setMoveInDate(nextWeekStr);
      setNote('');
    }

    // Fetch available customers & rooms
    setLoadingData(true);
    Promise.all([getAvailableCustomersForDeposit(), getAvailableRoomsForDeposit()])
      .then(([custList, roomList]) => {
        setCustomers(custList);
        setRooms(roomList);
      })
      .catch((err) => {
        console.error('Lỗi khi tải dữ liệu khởi tạo hợp đồng:', err);
      })
      .finally(() => {
        setLoadingData(false);
      });
  }, [isOpen, contractToEdit]);

  // Khi chọn phòng lần đầu tiên ở form tạo mới, tự động gợi ý tiền cọc mặc định của phòng đó
  const handleRoomChange = (newRoomId: string) => {
    setRoomId(newRoomId);
    if (!isEditing || isChangingRoom) {
      const selected = rooms.find((r) => r.id === newRoomId);
      if (selected && selected.defaultDeposit > 0) {
        setAmountRequired(selected.defaultDeposit);
      }
    }
  };

  const handleQuickCreateCustomer = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!quickFullName.trim()) {
      setQuickCustomerError('Vui lòng nhập họ và tên khách thuê');
      return;
    }
    try {
      setQuickSaving(true);
      setQuickCustomerError(null);
      const newCust = await quickCreateCustomer({
        fullName: quickFullName.trim(),
        phone: quickPhone.trim() || undefined,
        identityNo: quickIdentityNo.trim() || undefined,
        email: quickEmail.trim() || undefined,
      });
      setCustomers((prev) => [...prev, newCust]);
      setCustomerId(newCust.id);
      setShowQuickCustomer(false);
      setQuickFullName('');
      setQuickPhone('');
      setQuickIdentityNo('');
      setQuickEmail('');
    } catch (err: unknown) {
      if (err instanceof DepositContractApiError) {
        if (err.status === 401 && onSessionExpired) {
          onSessionExpired();
          return;
        }
        setQuickCustomerError(err.message);
      } else {
        setQuickCustomerError('Không thể tạo khách thuê. Vui lòng thử lại.');
      }
    } finally {
      setQuickSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!customerId || !roomId) {
      setErrorMessage('Vui lòng chọn khách thuê đại diện và phòng đặt cọc');
      return;
    }
    if (typeof amountRequired !== 'number' || amountRequired <= 0) {
      setErrorMessage('Số tiền cọc phải lớn hơn 0');
      return;
    }
    if (!reservedFrom) {
      setErrorMessage('Vui lòng nhập ngày đặt cọc');
      return;
    }
    if (!moveInDate) {
      setErrorMessage('Vui lòng nhập ngày dự kiến nhận phòng');
      return;
    }
    if (moveInDate < reservedFrom) {
      setErrorMessage('Ngày dự kiến nhận phòng không được trước ngày đặt cọc');
      return;
    }

    try {
      setSubmitting(true);
      if (isEditing && contractToEdit) {
        const updateInput: UpdateDepositContractInput = {
          customerId,
          roomId,
          reservedFrom,
          amountRequired,
          moveInDate,
          note: note.trim() || undefined,
        };
        const updated = await updateDepositContract(contractToEdit.id, updateInput);
        onSuccess(updated);
      } else {
        const createInput: CreateDepositContractInput = {
          customerId,
          roomId,
          reservedFrom,
          amountRequired,
          moveInDate,
          note: note.trim() || undefined,
        };
        const created = await createDepositContract(createInput);
        onSuccess(created);
      }
      onClose();
    } catch (err: unknown) {
      if (err instanceof DepositContractApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Đã xảy ra lỗi không xác định. Vui lòng thử lại.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="contract-modal-backdrop" onClick={onClose}>
      <div className="contract-modal" onClick={(e) => e.stopPropagation()}>
        <div className="contract-modal-header">
          <h2>{isEditing ? `Chỉnh sửa hợp đồng cọc: ${contractToEdit?.contractNumber}` : 'Tạo hợp đồng đặt cọc mới'}</h2>
          <button type="button" className="contract-modal-close" onClick={onClose} aria-label="Đóng">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="contract-modal-body">
            {errorMessage && <div className="error-banner">{errorMessage}</div>}

            {/* Khách thuê */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label htmlFor="customer-select" style={{ marginBottom: 0 }}>Khách thuê đại diện (*)</label>
                {!showQuickCustomer && (
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: 'var(--color-accent-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                    onClick={() => setShowQuickCustomer(true)}
                  >
                    + Thêm khách mới
                  </button>
                )}
              </div>

              {showQuickCustomer ? (
                <div style={{ padding: '12px', background: 'var(--color-paper-2)', border: '1px solid var(--color-rule-2)', borderRadius: '6px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '13px', color: 'var(--color-ink)' }}>Thêm nhanh khách thuê mới</strong>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--color-muted)' }}
                      onClick={() => setShowQuickCustomer(false)}
                      disabled={quickSaving}
                    >
                      &times;
                    </button>
                  </div>
                  {quickCustomerError && (
                    <div style={{ color: 'var(--color-error)', fontSize: '12px', marginBottom: '8px', padding: '6px 8px', background: 'var(--color-error-wash)', borderRadius: '4px' }}>
                      {quickCustomerError}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <label htmlFor="quick-fullname" style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '2px' }}>Họ và tên (*)</label>
                      <input
                        id="quick-fullname"
                        type="text"
                        placeholder="VD: Nguyễn Văn A"
                        value={quickFullName}
                        onChange={(e) => setQuickFullName(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--color-rule-2)' }}
                        disabled={quickSaving}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-phone" style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '2px' }}>Số điện thoại</label>
                      <input
                        id="quick-phone"
                        type="tel"
                        placeholder="VD: 0912345678"
                        value={quickPhone}
                        onChange={(e) => setQuickPhone(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--color-rule-2)' }}
                        disabled={quickSaving}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <div>
                      <label htmlFor="quick-identity" style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '2px' }}>Số <abbr title="Căn cước công dân">CCCD</abbr> / <abbr title="Chứng minh nhân dân">CMND</abbr></label>
                      <input
                        id="quick-identity"
                        type="text"
                        placeholder="VD: 079201001234"
                        value={quickIdentityNo}
                        onChange={(e) => setQuickIdentityNo(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--color-rule-2)' }}
                        disabled={quickSaving}
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-email" style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '2px' }}>Email</label>
                      <input
                        id="quick-email"
                        type="email"
                        placeholder="VD: khachthue@gmail.com"
                        value={quickEmail}
                        onChange={(e) => setQuickEmail(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--color-rule-2)' }}
                        disabled={quickSaving}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      aria-label="Hủy thêm khách"
                      className="contract-action-btn"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => setShowQuickCustomer(false)}
                      disabled={quickSaving}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="contract-action-btn btn-primary"
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                      onClick={handleQuickCreateCustomer}
                      disabled={quickSaving || !quickFullName.trim()}
                    >
                      {quickSaving ? 'Đang lưu...' : 'Lưu & Chọn'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <select
                    id="customer-select"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    disabled={loadingData}
                    required
                  >
                    <option value="">-- Chọn khách thuê đại diện --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} {c.phone ? `- ${c.phone}` : ''} {c.identityNo ? `(CCCD: ${c.identityNo})` : ''}
                      </option>
                    ))}
                  </select>
                  {customers.length === 0 && (
                    <p style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '4px', marginBottom: 0 }}>
                      Chưa có khách thuê nào. Bấm <strong>+ Thêm khách mới</strong> ở trên để tạo nhanh.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Phòng đặt cọc */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="room-select">Phòng đặt cọc (*)</label>
                {isEditing && !isChangingRoom && (
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: 'var(--color-accent-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                    onClick={() => setIsChangingRoom(true)}
                  >
                    + Đổi sang phòng khác
                  </button>
                )}
              </div>

              {isEditing && !isChangingRoom ? (
                <div style={{ padding: '8px 12px', background: 'var(--color-paper-2)', borderRadius: '4px', border: '1px solid var(--color-rule)' }}>
                  <strong>{contractToEdit?.roomCode}</strong> - {contractToEdit?.roomName} ({contractToEdit?.buildingName})
                </div>
              ) : (
                <select
                  id="room-select"
                  value={roomId}
                  onChange={(e) => handleRoomChange(e.target.value)}
                  disabled={loadingData}
                  required
                >
                  <option value="">-- Chọn phòng đang trống (VACANT) --</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} - {r.name} ({r.buildingName} - Tầng {r.floorLevel}) - Cọc gợi ý: {r.defaultDeposit.toLocaleString('vi-VN')} đ
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Tiền cọc yêu cầu */}
            <div className="form-group">
              <label htmlFor="amount-required">Số tiền cọc yêu cầu (VNĐ) (*)</label>
              <input
                id="amount-required"
                type="number"
                min="1"
                step="any"
                placeholder="Ví dụ: 3000000"
                value={amountRequired}
                onChange={(e) => setAmountRequired(e.target.value === '' ? '' : Number(e.target.value))}
                required
              />
            </div>

            {/* Thời gian cọc và nhận phòng */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reserved-from">Ngày đặt cọc (*)</label>
                <input
                  id="reserved-from"
                  type="date"
                  value={reservedFrom}
                  onChange={(e) => setReservedFrom(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="move-in-date">Ngày dự kiến nhận phòng (*)</label>
                <input
                  id="move-in-date"
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Ghi chú */}
            <div className="form-group">
              <label htmlFor="contract-note">Ghi chú bổ sung</label>
              <textarea
                id="contract-note"
                rows={2}
                placeholder="Ví dụ: Giữ phòng tối đa 7 ngày, kèm 1 xe máy..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="contract-modal-footer">
            <button type="button" className="contract-action-btn" onClick={onClose} disabled={submitting}>
              Hủy
            </button>
            <button type="submit" className="contract-action-btn btn-primary" disabled={submitting}>
              {submitting ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Xác nhận tạo hợp đồng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

