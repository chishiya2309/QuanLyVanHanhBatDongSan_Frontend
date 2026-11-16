import React, { useState, useEffect } from 'react';
import type { RentalContract, RentalStatus, TerminationRecord } from '../../types/rentalContract';
import { rentalContractApi } from '../../services/rentalContractApi';
import './contracts.css';

interface RentalContractDetailDrawerProps {
  contract: RentalContract | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (contract: RentalContract) => void;
  onExtend?: (contract: RentalContract) => void;
  onTransfer?: (contract: RentalContract) => void;
  onTerminate?: (contract: RentalContract) => void;
  onHandover?: (contract: RentalContract) => void;
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
  onExtend,
  onTransfer,
  onTerminate,
  onHandover,
}) => {
  const [terminationRecord, setTerminationRecord] = useState<TerminationRecord | null>(null);
  const [loadingTermination, setLoadingTermination] = useState(false);

  useEffect(() => {
    if (contract?.status === 'TERMINATED' && contract?.id) {
      setLoadingTermination(true);
      rentalContractApi
        .getTerminationRecord(contract.id)
        .then((res) => setTerminationRecord(res))
        .catch(() => setTerminationRecord(null))
        .finally(() => setLoadingTermination(false));
    } else {
      setTerminationRecord(null);
    }
  }, [contract?.id, contract?.status]);

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
                      const isCurrent = t.toDate === contract.endDate || !t.toDate;
                      const hasHandoverDetails =
                        t.startElectricityIndex !== undefined ||
                        t.startWaterIndex !== undefined ||
                        t.endElectricityIndex !== undefined ||
                        t.endWaterIndex !== undefined ||
                        t.handoverNote;

                      return (
                        <React.Fragment key={t.id || idx}>
                          <tr
                            style={{
                              borderBottom: hasHandoverDetails ? 'none' : '1px solid #e2e8f0',
                              background: isCurrent ? '#f0fdf4' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '6px 8px', fontWeight: 600 }}>{t.roomCode}</td>
                            <td style={{ padding: '6px 8px' }}>
                              {t.roomName}
                              {t.buildingName ? ` (${t.buildingName})` : ''}
                            </td>
                            <td style={{ padding: '6px 8px', fontWeight: 500, color: '#047857' }}>
                              {Number(t.rent).toLocaleString('vi-VN')} đ
                            </td>
                            <td style={{ padding: '6px 8px' }}>{t.fromDate}</td>
                            <td style={{ padding: '6px 8px' }}>{t.toDate || 'Hiện tại'}</td>
                            <td style={{ padding: '6px 8px' }}>
                              {isCurrent ? (
                                <span style={{ color: '#059669', fontWeight: 600 }}>● Đang ở</span>
                              ) : (
                                <span style={{ color: '#64748b' }}>Đã chuyển/kết thúc</span>
                              )}
                            </td>
                          </tr>
                          {hasHandoverDetails && (
                            <tr
                              style={{
                                background: isCurrent ? '#fafffa' : '#f8fafc',
                                borderBottom: '1px solid #e2e8f0',
                              }}
                            >
                              <td colSpan={6} style={{ padding: '3px 8px 7px', fontSize: '11px', color: '#475569' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                                  {(t.startElectricityIndex !== undefined || t.startWaterIndex !== undefined) && (
                                    <span>
                                      <strong style={{ color: '#047857' }}>Nhận phòng:</strong> Điện: {t.startElectricityIndex ?? '---'} kWh | Nước: {t.startWaterIndex ?? '---'} m³
                                    </span>
                                  )}
                                  {(t.endElectricityIndex !== undefined || t.endWaterIndex !== undefined) && (
                                    <span>
                                      <strong style={{ color: '#b91c1c' }}>Trả phòng:</strong> Điện: {t.endElectricityIndex ?? '---'} kWh | Nước: {t.endWaterIndex ?? '---'} m³
                                    </span>
                                  )}
                                  {t.handoverNote && (
                                    <span>
                                      <strong style={{ color: '#4338ca' }}>Ghi chú:</strong> {t.handoverNote}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-muted)' }}>Chưa có lượt ở nào.</p>
            )}
          </div>

          {/* Phụ lục gia hạn hợp đồng (UC29) */}
          <div className="drawer-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ margin: 0 }}>Lịch sử phụ lục gia hạn</h3>
              {contract.amendments && contract.amendments.length > 0 && (
                <span style={{ fontSize: '12px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                  {contract.amendments.length} lần gia hạn
                </span>
              )}
            </div>

            {contract.amendments && contract.amendments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {contract.amendments.map((am, idx) => (
                  <div
                    key={am.id || idx}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      background: '#f8fafc',
                      fontSize: '12.5px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>
                        {am.oldEndDate} <span style={{ color: '#059669' }}>➔</span> <strong style={{ color: '#047857' }}>{am.newEndDate}</strong>
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {am.recordedAt ? new Date(am.recordedAt).toLocaleString('vi-VN') : ''}
                      </span>
                    </div>
                    <div style={{ color: '#475569', marginTop: '2px' }}>
                      <span style={{ color: '#64748b' }}>Lý do: </span>
                      {am.reason}
                    </div>
                    {am.createdByName && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                        Người thực hiện: {am.createdByName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-muted)' }}>
                Chưa có phụ lục gia hạn nào.
              </p>
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

          {/* Thông tin thanh lý & Quyết toán tài chính (UC31) */}
          {contract.status === 'TERMINATED' && (
            <div className="drawer-section" style={{ border: '1px solid #fecaca', background: '#fef2f2', borderRadius: '8px', padding: '14px' }}>
              <h3 style={{ color: '#991b1b', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📋</span> Biên bản thanh lý & Quyết toán tài chính
              </h3>
              {loadingTermination ? (
                <p style={{ margin: 0, fontSize: '13px', color: '#7f1d1d' }}>Đang tải thông tin biên bản thanh lý...</p>
              ) : terminationRecord ? (
                <div className="info-grid">
                  <span className="info-label" style={{ color: '#991b1b' }}>Ngày kết thúc:</span>
                  <span className="info-value" style={{ fontWeight: 600 }}>{terminationRecord.endedAt}</span>

                  <span className="info-label" style={{ color: '#991b1b' }}>Lý do thanh lý:</span>
                  <span className="info-value">{terminationRecord.reason}</span>

                  <span className="info-label" style={{ color: '#991b1b' }}>Tiền cọc giữ:</span>
                  <span className="info-value">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(terminationRecord.depositHeld)}</span>

                  <span className="info-label" style={{ color: '#991b1b' }}>Nợ tồn đọng:</span>
                  <span className="info-value" style={{ color: '#b45309' }}>
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(terminationRecord.debtRemaining)}
                  </span>

                  <span className="info-label" style={{ color: '#991b1b' }}>Khấu trừ bồi thường:</span>
                  <span className="info-value" style={{ color: '#b45309' }}>
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(terminationRecord.deductionAmount)}
                    {terminationRecord.deductionReason ? ` (${terminationRecord.deductionReason})` : ''}
                  </span>

                  <span className="info-label" style={{ color: '#991b1b', fontWeight: 700 }}>
                    {terminationRecord.refundDue > 0 ? 'Hoàn lại khách:' : terminationRecord.refundDue < 0 ? 'Khách nộp bù:' : 'Tất toán:'}
                  </span>
                  <span className="info-value" style={{ fontWeight: 700, color: terminationRecord.refundDue > 0 ? '#15803d' : terminationRecord.refundDue < 0 ? '#b91c1c' : '#374151' }}>
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(terminationRecord.refundDue)}
                  </span>

                  <span className="info-label" style={{ color: '#991b1b' }}>Trạng thái quyết toán:</span>
                  <span className="info-value">{terminationRecord.status}</span>

                  <span className="info-label" style={{ color: '#991b1b' }}>Người lập:</span>
                  <span className="info-value">{terminationRecord.createdByName || 'Hệ thống'}</span>

                  <span className="info-label" style={{ color: '#991b1b' }}>Thời điểm ghi nhận:</span>
                  <span className="info-value">{new Date(terminationRecord.recordedAt).toLocaleString('vi-VN')}</span>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '13px', color: '#991b1b' }}>
                  Không tìm thấy chi tiết biên bản thanh lý.
                </p>
              )}
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

          {contract.status === 'ACTIVE' && onHandover && (
            <button
              type="button"
              className="contract-action-btn"
              style={{
                color: '#0d9488',
                borderColor: '#99f6e4',
                background: '#f0fdfa',
                fontWeight: 600,
              }}
              onClick={() => {
                onClose();
                onHandover(contract);
              }}
              title="Ghi nhận hoặc xem biên bản bàn giao nhận phòng (UC32)"
            >
              Bàn giao nhận phòng
            </button>
          )}

          {contract.status === 'ACTIVE' && onTransfer && (
            <button
              type="button"
              className="contract-action-btn"
              style={{
                color: '#4f46e5',
                borderColor: '#c7d2fe',
                background: '#eef2ff',
                fontWeight: 600,
              }}
              onClick={() => {
                onClose();
                onTransfer(contract);
              }}
            >
              Chuyển phòng
            </button>
          )}

          {contract.status === 'ACTIVE' && onExtend && (
            <button
              type="button"
              className="contract-action-btn"
              style={{
                color: '#16a34a',
                borderColor: '#bbf7d0',
                background: '#f0fdf4',
                fontWeight: 600,
              }}
              onClick={() => {
                onClose();
                onExtend(contract);
              }}
            >
              + Gia hạn hợp đồng
            </button>
          )}

          {contract.status === 'ACTIVE' && onTerminate && (
            <button
              type="button"
              className="contract-action-btn"
              style={{
                color: '#dc2626',
                borderColor: '#fecaca',
                background: '#fef2f2',
                fontWeight: 600,
              }}
              onClick={() => {
                onClose();
                onTerminate(contract);
              }}
            >
              Thanh lý hợp đồng
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
        </div>
      </div>
    </div>
  );
};
