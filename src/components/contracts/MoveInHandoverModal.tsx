import React, { useState, useEffect, useMemo } from 'react';
import type { RentalContract } from '../../types/rentalContract';
import type {
  HandoverReport,
  AssetState,
  CreateHandoverReportInput,
} from '../../types/handover';
import {
  rentalContractApi,
  RentalContractApiError,
} from '../../services/rentalContractApi';
import { DocumentExportModal } from './DocumentExportModal';
import './contracts.css';

interface MoveInHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: RentalContract | null;
  onSuccess: (report: HandoverReport) => void;
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

const formatDateTimeLocal = (date?: Date | string): string => {
  const d = date ? new Date(date) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const ASSET_STATE_LABELS: Record<AssetState, { label: string; color: string; bg: string }> = {
  GOOD: { label: 'Tốt (GOOD)', color: '#047857', bg: '#ecfdf5' },
  DAMAGED: { label: 'Hư hỏng (DAMAGED)', color: '#b91c1c', bg: '#fef2f2' },
  REPAIRING: { label: 'Đang sửa (REPAIRING)', color: '#d97706', bg: '#fffbeb' },
  RETIRED: { label: 'Hỏng nặng / Bỏ (RETIRED)', color: '#64748b', bg: '#f1f5f9' },
};

export const MoveInHandoverModal: React.FC<MoveInHandoverModalProps> = ({
  isOpen,
  onClose,
  contract,
  onSuccess,
  onSessionExpired,
}) => {
  const [loading, setLoading] = useState(false);

  const [occurredAt, setOccurredAt] = useState('');
  const [roomCondition, setRoomCondition] = useState('');
  const [assetItems, setAssetItems] = useState<
    { assetId: string; assetName: string; condition: AssetState; note: string }[]
  >([]);
  const [meterItems, setMeterItems] = useState<
    { serviceId: string; serviceName: string; unit: string; systemCode?: string; indexValue: number | '' }[]
  >([]);

  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Lấy lượt ở hiện tại của hợp đồng
  const currentTenancy = useMemo(() => {
    if (!contract || !contract.tenancies || contract.tenancies.length === 0) return null;
    return (
      contract.tenancies.find((t) => !t.toDate || t.toDate === contract.endDate) ||
      contract.tenancies[contract.tenancies.length - 1]
    );
  }, [contract]);

  // Load template data when modal opens
  useEffect(() => {
    if (!isOpen || !contract) {
      setOccurredAt('');
      setRoomCondition('');
      setAssetItems([]);
      setMeterItems([]);
      setIsReadOnly(false);
      setIsDraft(false);
      setCurrentReportId(null);
      setErrorMessage(null);
      setFieldErrors({});
      setShowConfirmPopup(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setErrorMessage(null);

    rentalContractApi
      .getHandoverTemplate(contract.id, 'MOVE_IN')
      .then((tpl) => {
        if (!isMounted) return;

        if (tpl.confirmedReport) {
          // Đã có biên bản xác nhận khóa -> Readonly
          const r = tpl.confirmedReport;
          setIsReadOnly(true);
          setIsDraft(false);
          setCurrentReportId(r.id);
          setOccurredAt(formatDateTimeLocal(r.occurredAt));
          setRoomCondition(r.roomCondition || '');

          setAssetItems(
            (r.assetItems || []).map((ai) => ({
              assetId: ai.assetId,
              assetName: ai.assetName || 'Tài sản',
              condition: ai.condition,
              note: ai.note || '',
            }))
          );

          setMeterItems(
            (r.meterItems || []).map((mi) => ({
              serviceId: mi.serviceId,
              serviceName: mi.serviceName || 'Dịch vụ',
              unit: mi.unit || '',
              systemCode: mi.systemCode,
              indexValue: mi.indexValue,
            }))
          );
        } else if (tpl.draftReport) {
          // Đã có bản nháp -> Cho phép chỉnh sửa tiếp
          const d = tpl.draftReport;
          setIsReadOnly(false);
          setIsDraft(true);
          setCurrentReportId(d.id);
          setOccurredAt(formatDateTimeLocal(d.occurredAt));
          setRoomCondition(d.roomCondition || '');

          // Map assets từ availableAssets và merge với draft items
          const draftAssetMap = new Map((d.assetItems || []).map((a) => [a.assetId, a]));
          const mappedAssets = (tpl.availableAssets || []).map((a) => {
            const saved = draftAssetMap.get(a.assetId);
            return {
              assetId: a.assetId,
              assetName: a.assetName,
              condition: saved ? saved.condition : a.currentCondition || 'GOOD',
              note: saved ? saved.note || '' : a.note || '',
            };
          });
          setAssetItems(mappedAssets);

          // Map meters từ availableServices và merge với draft items
          const draftMeterMap = new Map((d.meterItems || []).map((m) => [m.serviceId, m]));
          const mappedMeters = (tpl.availableServices || []).map((s) => {
            const saved = draftMeterMap.get(s.serviceId);
            return {
              serviceId: s.serviceId,
              serviceName: s.serviceName,
              unit: s.unit,
              systemCode: s.systemCode,
              indexValue: saved ? saved.indexValue : s.initialIndex ?? 0,
            };
          });
          setMeterItems(mappedMeters);
        } else {
          // Tạo mới hoàn toàn
          setIsReadOnly(false);
          setIsDraft(false);
          setCurrentReportId(null);
          setOccurredAt(formatDateTimeLocal());
          setRoomCondition('');

          setAssetItems(
            (tpl.availableAssets || []).map((a) => ({
              assetId: a.assetId,
              assetName: a.assetName,
              condition: a.currentCondition || 'GOOD',
              note: a.note || '',
            }))
          );

          setMeterItems(
            (tpl.availableServices || []).map((s) => ({
              serviceId: s.serviceId,
              serviceName: s.serviceName,
              unit: s.unit,
              systemCode: s.systemCode,
              indexValue: s.initialIndex ?? 0,
            }))
          );
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err instanceof RentalContractApiError && err.status === 401) {
          onSessionExpired?.();
          return;
        }
        setErrorMessage(err.message || 'Không thể tải dữ liệu mẫu bàn giao nhận phòng');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, contract, onSessionExpired]);

  const handleAssetConditionChange = (assetId: string, condition: AssetState) => {
    if (isReadOnly) return;
    setAssetItems((prev) =>
      prev.map((item) => (item.assetId === assetId ? { ...item, condition } : item))
    );
  };

  const handleAssetNoteChange = (assetId: string, note: string) => {
    if (isReadOnly) return;
    setAssetItems((prev) =>
      prev.map((item) => (item.assetId === assetId ? { ...item, note } : item))
    );
  };

  const handleMeterIndexChange = (serviceId: string, val: string) => {
    if (isReadOnly) return;
    const num = val === '' ? '' : parseFloat(val);
    setMeterItems((prev) =>
      prev.map((item) => (item.serviceId === serviceId ? { ...item, indexValue: num } : item))
    );
    if (fieldErrors[`meter_${serviceId}`]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[`meter_${serviceId}`];
        return next;
      });
    }
  };

  // Submit action (draft or confirm)
  const executeSubmit = async (confirmFlag: boolean) => {
    if (!contract) return;
    setErrorMessage(null);
    setFieldErrors({});

    // Client-side validations
    const errors: Record<string, string> = {};

    if (!occurredAt) {
      errors.occurredAt = 'Vui lòng chọn thời điểm bàn giao nhận phòng';
    }

    if (confirmFlag) {
      if (!roomCondition || roomCondition.trim().length === 0) {
        errors.roomCondition = 'Vui lòng nhập mô tả hiện trạng phòng khi xác nhận bàn giao';
      }
    }

    for (const m of meterItems) {
      if (m.indexValue === '' || isNaN(m.indexValue) || m.indexValue < 0) {
        errors[`meter_${m.serviceId}`] = 'Chỉ số công tơ không được âm hoặc để trống';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage('Vui lòng kiểm tra lại các trường thông tin chưa hợp lệ');
      setShowConfirmPopup(false);
      return;
    }

    const payload: CreateHandoverReportInput = {
      type: 'MOVE_IN',
      occurredAt: new Date(occurredAt).toISOString(),
      roomCondition: roomCondition.trim(),
      confirmed: confirmFlag,
      assetItems: assetItems.map((a) => ({
        assetId: a.assetId,
        condition: a.condition,
        note: a.note,
      })),
      meterItems: meterItems.map((m) => ({
        serviceId: m.serviceId,
        indexValue: typeof m.indexValue === 'number' ? m.indexValue : 0,
      })),
    };

    setSubmitting(true);
    setShowConfirmPopup(false);

    try {
      let result: HandoverReport;
      if (isDraft && currentReportId) {
        result = await rentalContractApi.updateDraftHandoverReport(contract.id, currentReportId, payload);
      } else {
        result = await rentalContractApi.createHandoverReport(contract.id, payload);
      }

      onSuccess(result);
      onClose();
    } catch (err: unknown) {
      if (err instanceof RentalContractApiError) {
        if (err.status === 401) {
          onSessionExpired?.();
          return;
        }
        setErrorMessage(err.message);
        if (err.fieldErrors) {
          setFieldErrors(err.fieldErrors);
        }
      } else {
        setErrorMessage('Có lỗi xảy ra khi lưu biên bản bàn giao. Vui lòng thử lại sau.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !contract) return null;

  return (
    <div className="contract-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="contract-modal"
        style={{ maxWidth: '820px', width: '95%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="contract-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {isReadOnly ? 'Biên bản bàn giao nhận phòng (Đã khóa)' : 'Ghi nhận bàn giao nhận phòng'}
              </h2>
              {isReadOnly && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: '#ecfdf5',
                    color: '#047857',
                    border: '1px solid #a7f3d0',
                  }}
                >
                  ĐÃ XÁC NHẬN KHÓA
                </span>
              )}
              {!isReadOnly && isDraft && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #bae6fd',
                  }}
                >
                  BẢN NHÁP
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
              Mã HĐ: <strong style={{ color: '#0f172a' }}>{contract.contractNumber}</strong>
              <span style={{ margin: '0 6px' }}>&bull;</span>
              Chụp ảnh hiện trạng tài sản & chỉ số công tơ điện nước đầu vào
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

        {/* Modal Body */}
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
            <div className="error-banner" role="alert" style={{ marginBottom: '4px' }}>
              {errorMessage}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
              Đang tải dữ liệu biên bản bàn giao...
            </div>
          ) : (
            <>
              {/* Summary Card */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '10px',
                  fontSize: '12.5px',
                }}
              >
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>Khách thuê đại diện:</span>
                  <strong style={{ color: '#1e293b' }}>{contract.customerName}</strong>
                  {contract.customerPhone && (
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>
                      {contract.customerPhone}
                    </span>
                  )}
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>Phòng bàn giao:</span>
                  <strong style={{ color: '#0369a1' }}>
                    {currentTenancy ? currentTenancy.roomCode : contract.currentRoomCode || '---'}
                  </strong>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>
                    {currentTenancy?.roomName || contract.currentRoomName || ''}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>Thời hạn thuê:</span>
                  <span style={{ color: '#334155' }}>
                    {formatDateDisplay(contract.startDate)} &rarr; {formatDateDisplay(contract.endDate)}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>Trạng thái biên bản:</span>
                  <strong style={{ color: isReadOnly ? '#047857' : isDraft ? '#0369a1' : '#b45309' }}>
                    {isReadOnly ? 'Đã khóa chính thức' : isDraft ? 'Bản nháp lưu tạm' : 'Chưa lập biên bản'}
                  </strong>
                </div>
              </div>

              {/* Row: Thời điểm bàn giao */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Thời điểm bàn giao nhận phòng <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={occurredAt}
                    onChange={(e) => {
                      setOccurredAt(e.target.value);
                      if (fieldErrors.occurredAt) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.occurredAt;
                          return next;
                        });
                      }
                    }}
                    disabled={isReadOnly || submitting}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 10px',
                      borderRadius: '4px',
                      border: fieldErrors.occurredAt ? '1px solid #ef4444' : '1px solid #cbd5e1',
                      fontSize: '13px',
                      background: isReadOnly ? '#f1f5f9' : '#ffffff',
                    }}
                  />
                  {fieldErrors.occurredAt && (
                    <span style={{ color: '#ef4444', fontSize: '11.5px' }}>{fieldErrors.occurredAt}</span>
                  )}
                </div>
              </div>

              {/* Section 1: Hiện trạng chung phòng */}
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Hiện trạng chung của phòng {!isReadOnly && <span style={{ color: '#dc2626' }}>*</span>}
                </label>
                <textarea
                  rows={2}
                  placeholder={
                    isReadOnly
                      ? 'Không có ghi nhận'
                      : 'Mô tả hiện trạng tường, trần, sàn, khóa cửa, cửa sổ, thiết bị vệ sinh... (Bắt buộc khi xác nhận)'
                  }
                  value={roomCondition}
                  onChange={(e) => {
                    setRoomCondition(e.target.value);
                    if (fieldErrors.roomCondition) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.roomCondition;
                        return next;
                      });
                    }
                  }}
                  disabled={isReadOnly || submitting}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: fieldErrors.roomCondition ? '1px solid #ef4444' : '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    background: isReadOnly ? '#f1f5f9' : '#ffffff',
                  }}
                />
                {fieldErrors.roomCondition && (
                  <span style={{ color: '#ef4444', fontSize: '11.5px' }}>{fieldErrors.roomCondition}</span>
                )}
              </div>

              {/* Section 2: Chỉ số công tơ dịch vụ đo đếm (Điện, Nước) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Chỉ số công tơ dịch vụ đo đếm ban đầu (Điện, Nước) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                    Chỉ số này sẽ được đồng bộ làm mốc đầu kỳ tính tiền phòng
                  </span>
                </div>

                {meterItems.length === 0 ? (
                  <div
                    style={{
                      padding: '12px',
                      background: '#f8fafc',
                      borderRadius: '4px',
                      border: '1px dashed #cbd5e1',
                      fontSize: '12.5px',
                      color: '#64748b',
                      textAlign: 'center',
                    }}
                  >
                    Chưa có cấu hình dịch vụ đo đếm (Điện/Nước) cho cơ sở này.
                  </div>
                ) : (
                  <div className="contract-table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                    <table className="contract-table" style={{ margin: 0, fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ width: '40%', padding: '8px 12px' }}>Dịch vụ</th>
                          <th style={{ width: '20%', padding: '8px 12px' }}>Đơn vị</th>
                          <th style={{ width: '40%', padding: '8px 12px' }}>Chỉ số ban đầu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meterItems.map((meter) => (
                          <tr key={meter.serviceId}>
                            <td style={{ padding: '8px 12px' }}>
                              <strong style={{ color: '#1e293b' }}>{meter.serviceName}</strong>
                              {meter.systemCode && (
                                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                                  Mã HT: {meter.systemCode}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>{meter.unit || '---'}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={meter.indexValue}
                                onChange={(e) => handleMeterIndexChange(meter.serviceId, e.target.value)}
                                disabled={isReadOnly || submitting}
                                placeholder="0.0"
                                style={{
                                  width: '100%',
                                  maxWidth: '160px',
                                  padding: '6px 10px',
                                  borderRadius: '4px',
                                  border: fieldErrors[`meter_${meter.serviceId}`]
                                    ? '1px solid #ef4444'
                                    : '1px solid #cbd5e1',
                                  fontSize: '13px',
                                  background: isReadOnly ? '#f1f5f9' : '#ffffff',
                                }}
                              />
                              {fieldErrors[`meter_${meter.serviceId}`] && (
                                <span style={{ color: '#ef4444', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                                  {fieldErrors[`meter_${meter.serviceId}`]}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section 3: Bảng snapshot hiện trạng tài sản */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Hiện trạng tài sản trong phòng ({assetItems.length} tài sản)
                  </label>
                  {!isReadOnly && (
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                      Phải đánh giá đầy đủ toàn bộ tài sản khi xác nhận
                    </span>
                  )}
                </div>

                {assetItems.length === 0 ? (
                  <div
                    style={{
                      padding: '14px',
                      background: '#f8fafc',
                      borderRadius: '4px',
                      border: '1px dashed #cbd5e1',
                      fontSize: '12.5px',
                      color: '#64748b',
                      textAlign: 'center',
                    }}
                  >
                    Phòng hiện chưa gắn tài sản nào trong danh mục quản lý tài sản.
                  </div>
                ) : (
                  <div className="contract-table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                    <table className="contract-table" style={{ margin: 0, fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ width: '32%', padding: '8px 12px' }}>Tên tài sản</th>
                          <th style={{ width: '30%', padding: '8px 12px' }}>Tình trạng bàn giao</th>
                          <th style={{ width: '38%', padding: '8px 12px' }}>Ghi chú tình trạng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assetItems.map((asset) => (
                          <tr key={asset.assetId}>
                            <td style={{ padding: '8px 12px' }}>
                              <strong style={{ color: '#1e293b' }}>{asset.assetName}</strong>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              {isReadOnly ? (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    background: ASSET_STATE_LABELS[asset.condition]?.bg || '#f1f5f9',
                                    color: ASSET_STATE_LABELS[asset.condition]?.color || '#334155',
                                  }}
                                >
                                  {ASSET_STATE_LABELS[asset.condition]?.label || asset.condition}
                                </span>
                              ) : (
                                <select
                                  value={asset.condition}
                                  onChange={(e) =>
                                    handleAssetConditionChange(asset.assetId, e.target.value as AssetState)
                                  }
                                  disabled={submitting}
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '12.5px',
                                    background: '#ffffff',
                                  }}
                                >
                                  <option value="GOOD">Tốt (GOOD)</option>
                                  <option value="DAMAGED">Hư hỏng (DAMAGED)</option>
                                  <option value="REPAIRING">Đang sửa (REPAIRING)</option>
                                  <option value="RETIRED">Hỏng nặng / Bỏ (RETIRED)</option>
                                </select>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              {isReadOnly ? (
                                <span style={{ color: '#475569' }}>{asset.note || '---'}</span>
                              ) : (
                                <input
                                  type="text"
                                  value={asset.note}
                                  onChange={(e) => handleAssetNoteChange(asset.assetId, e.target.value)}
                                  placeholder="Ghi chú chi tiết (nếu có)..."
                                  disabled={submitting}
                                  style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '6px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '12.5px',
                                  }}
                                />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {!isReadOnly && (
                <div
                  style={{
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    fontSize: '12px',
                    color: '#92400e',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '15px', lineHeight: 1 }}>&#9888;</span>
                  <div>
                    <strong>Lưu ý quan trọng:</strong>
                    <div style={{ marginTop: '2px' }}>
                      - Bấm <strong>"Lưu nháp"</strong> để lưu tạm và quay lại cập nhật thêm sau.
                      <br />- Bấm <strong>"Xác nhận bàn giao"</strong> sẽ khóa vĩnh viễn biên bản và đồng bộ chỉ số
                      điện nước vào phòng thuê.
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="contract-modal-footer">
          {isReadOnly ? (
            <>
              <button
                type="button"
                className="contract-btn-secondary"
                onClick={onClose}
                style={{ minWidth: '90px' }}
              >
                Đóng
              </button>
              {currentReportId && (
                <button
                  type="button"
                  className="contract-action-btn"
                  style={{
                    minWidth: '140px',
                    color: '#0284c7',
                    borderColor: '#bae6fd',
                    background: '#f0f9ff',
                    fontWeight: 600,
                  }}
                  onClick={() => setExportModalOpen(true)}
                  title="Xuất biên bản bàn giao nhận phòng"
                >
                  📥 Xuất biên bản
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="contract-btn-secondary"
                onClick={onClose}
                disabled={submitting || loading}
                style={{ minWidth: '90px' }}
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                className="contract-action-btn"
                onClick={() => executeSubmit(false)}
                disabled={submitting || loading}
                style={{
                  minWidth: '100px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontWeight: 600,
                }}
              >
                {submitting ? 'Đang lưu...' : 'Lưu nháp'}
              </button>

              <button
                type="button"
                className="contract-btn-primary"
                onClick={() => setShowConfirmPopup(true)}
                disabled={submitting || loading}
                style={{ minWidth: '150px' }}
              >
                Xác nhận bàn giao
              </button>
            </>
          )}
        </div>

        {/* Confirmation Dialog Popup */}
        {showConfirmPopup && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1100,
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '20px 24px',
                maxWidth: '440px',
                width: '90%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Xác nhận khóa biên bản bàn giao?
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                Sau khi xác nhận, biên bản bàn giao nhận phòng sẽ bị <strong>KHÓA VĨNH VIỄN</strong>, không thể chỉnh sửa hay
                xóa. Chỉ số công tơ điện nước ban đầu sẽ được đồng bộ trực tiếp vào lượt ở của khách thuê.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="contract-btn-secondary"
                  onClick={() => setShowConfirmPopup(false)}
                  disabled={submitting}
                  style={{ padding: '6px 14px', fontSize: '13px' }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="contract-btn-primary"
                  onClick={() => executeSubmit(true)}
                  disabled={submitting}
                  style={{ padding: '6px 16px', fontSize: '13px' }}
                >
                  {submitting ? 'Đang xác nhận...' : 'Đồng ý xác nhận'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Xuất biên bản nhận phòng (UC35, UC78, UC79) */}
        {contract && currentReportId && (
          <DocumentExportModal
            isOpen={exportModalOpen}
            onClose={() => setExportModalOpen(false)}
            sourceType="HANDOVER"
            sourceId={contract.id}
            handoverReportId={currentReportId}
          />
        )}
      </div>
    </div>
  );
};
