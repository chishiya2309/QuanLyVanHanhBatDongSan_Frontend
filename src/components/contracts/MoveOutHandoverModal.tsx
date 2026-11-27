import React, { useState, useEffect } from 'react';
import type { RentalContract } from '../../types/rentalContract';
import type {
  HandoverReport,
  AssetState,
  CatalogSystemCode,
  CreateHandoverReportInput,
} from '../../types/handover';
import {
  rentalContractApi,
  RentalContractApiError,
} from '../../services/rentalContractApi';
import { DocumentExportModal } from './DocumentExportModal';
import './contracts.css';

interface MoveOutHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (report: HandoverReport) => void;
  contract: RentalContract | null;
  onSessionExpired?: () => void;
  onProceedToTerminate?: (contract: RentalContract, deductionReason?: string) => void;
}

interface LocalAssetItem {
  assetId: string;
  assetName: string;
  initialCondition?: AssetState;
  initialNote?: string;
  condition: AssetState;
  note: string;
}

interface LocalMeterItem {
  serviceId: string;
  serviceName: string;
  unit: string;
  systemCode?: CatalogSystemCode;
  initialIndex: number | null;
  indexValue: number | '';
}

const formatDateTimeLocal = (isoString?: string): string => {
  const d = isoString ? new Date(isoString) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatCurrency = (val?: number | null): string => {
  if (val === undefined || val === null) return '0 đ';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
};

const renderAssetStateBadge = (state?: AssetState) => {
  switch (state) {
    case 'GOOD':
      return (
        <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
          Tốt
        </span>
      );
    case 'DAMAGED':
      return (
        <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
          Hỏng hóc
        </span>
      );
    case 'REPAIRING':
      return (
        <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
          Đang sửa chữa
        </span>
      );
    case 'RETIRED':
      return (
        <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
          Đã thanh lý
        </span>
      );
    default:
      return <span style={{ color: '#94a3b8' }}>Chưa rõ</span>;
  }
};

export const MoveOutHandoverModal: React.FC<MoveOutHandoverModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  contract,
  onSessionExpired,
  onProceedToTerminate,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [occurredAt, setOccurredAt] = useState('');
  const [roomCondition, setRoomCondition] = useState('');
  const [assetItems, setAssetItems] = useState<LocalAssetItem[]>([]);
  const [meterItems, setMeterItems] = useState<LocalMeterItem[]>([]);

  const [isDraft, setIsDraft] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);

  // Success dialog state after confirming move-out
  const [confirmedResult, setConfirmedResult] = useState<HandoverReport | null>(null);

  // Load template & draft report
  useEffect(() => {
    if (!isOpen || !contract) {
      setOccurredAt('');
      setRoomCondition('');
      setAssetItems([]);
      setMeterItems([]);
      setIsDraft(false);
      setIsReadOnly(false);
      setCurrentReportId(null);
      setErrorMessage(null);
      setFieldErrors({});
      setShowConfirmPopup(false);
      setConfirmedResult(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setErrorMessage(null);

    rentalContractApi
      .getHandoverTemplate(contract.id, 'MOVE_OUT')
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
            (r.assetItems || []).map((ai) => {
              const matchedAvailable = (tpl.availableAssets || []).find((a) => a.assetId === ai.assetId);
              return {
                assetId: ai.assetId,
                assetName: ai.assetName || 'Tài sản',
                initialCondition: matchedAvailable?.initialCondition,
                initialNote: matchedAvailable?.initialNote,
                condition: ai.condition,
                note: ai.note || '',
              };
            })
          );

          setMeterItems(
            (r.meterItems || []).map((mi) => {
              const matchedService = (tpl.availableServices || []).find((s) => s.serviceId === mi.serviceId);
              return {
                serviceId: mi.serviceId,
                serviceName: mi.serviceName || 'Dịch vụ',
                unit: mi.unit || '',
                systemCode: mi.systemCode,
                initialIndex: matchedService?.initialIndex ?? null,
                indexValue: mi.indexValue,
              };
            })
          );
        } else if (tpl.draftReport) {
          // Đã có bản nháp trả phòng -> Cho phép chỉnh sửa tiếp
          const d = tpl.draftReport;
          setIsReadOnly(false);
          setIsDraft(true);
          setCurrentReportId(d.id);
          setOccurredAt(formatDateTimeLocal(d.occurredAt));
          setRoomCondition(d.roomCondition || '');

          const draftAssetMap = new Map((d.assetItems || []).map((a) => [a.assetId, a]));
          const mappedAssets = (tpl.availableAssets || []).map((a) => {
            const saved = draftAssetMap.get(a.assetId);
            return {
              assetId: a.assetId,
              assetName: a.assetName,
              initialCondition: a.initialCondition,
              initialNote: a.initialNote,
              condition: saved ? saved.condition : a.currentCondition || 'GOOD',
              note: saved ? saved.note || '' : a.note || '',
            };
          });
          setAssetItems(mappedAssets);

          const draftMeterMap = new Map((d.meterItems || []).map((m) => [m.serviceId, m]));
          const mappedMeters: LocalMeterItem[] = (tpl.availableServices || []).map((s) => {
            const saved = draftMeterMap.get(s.serviceId);
            return {
              serviceId: s.serviceId,
              serviceName: s.serviceName,
              unit: s.unit,
              systemCode: s.systemCode,
              initialIndex: s.initialIndex ?? null,
              indexValue: saved ? saved.indexValue : '',
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
              initialCondition: a.initialCondition,
              initialNote: a.initialNote,
              condition: a.currentCondition || a.initialCondition || 'GOOD',
              note: a.note || '',
            }))
          );

          const initialMeters: LocalMeterItem[] = (tpl.availableServices || []).map((s) => ({
            serviceId: s.serviceId,
            serviceName: s.serviceName,
            unit: s.unit,
            systemCode: s.systemCode,
            initialIndex: s.initialIndex ?? null,
            indexValue: '',
          }));
          setMeterItems(initialMeters);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err instanceof RentalContractApiError && err.status === 401) {
          onSessionExpired?.();
          return;
        }
        setErrorMessage(err.message || 'Không thể tải dữ liệu mẫu bàn giao trả phòng');
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
      errors.occurredAt = 'Vui lòng chọn thời điểm bàn giao trả phòng';
    }

    if (confirmFlag) {
      if (!roomCondition || roomCondition.trim().length === 0) {
        errors.roomCondition = 'Vui lòng nhập mô tả hiện trạng phòng khi xác nhận bàn giao';
      }
    }

    for (const m of meterItems) {
      if (m.indexValue === '' || isNaN(m.indexValue) || m.indexValue < 0) {
        errors[`meter_${m.serviceId}`] = 'Chỉ số công tơ không được âm hoặc để trống';
      } else if (
        confirmFlag &&
        m.initialIndex !== null &&
        m.initialIndex !== undefined &&
        m.indexValue < m.initialIndex
      ) {
        errors[`meter_${m.serviceId}`] = `Chỉ số chốt không được nhỏ hơn chỉ số ban đầu (${m.initialIndex} ${m.unit})`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage('Vui lòng kiểm tra lại các trường thông tin chưa hợp lệ');
      setShowConfirmPopup(false);
      return;
    }

    const payload: CreateHandoverReportInput = {
      type: 'MOVE_OUT',
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

      if (confirmFlag) {
        // Show success summary popup with 1-click navigate to UC31
        setConfirmedResult(result);
      } else {
        onClose();
      }
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
        setErrorMessage('Có lỗi xảy ra khi lưu biên bản bàn giao trả phòng. Vui lòng thử lại sau.');
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
        style={{ maxWidth: '880px', width: '95%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="contract-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {isReadOnly ? 'Biên bản bàn giao trả phòng (Đã khóa)' : 'Ghi nhận bàn giao trả phòng'}
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
              Đối soát tình trạng tài sản & chốt công tơ điện nước trả phòng
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
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              Đang tải dữ liệu đối soát bàn giao trả phòng...
            </div>
          ) : (
            <>
              {errorMessage && (
                <div
                  style={{
                    padding: '12px 16px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    color: '#b91c1c',
                    fontSize: '13px',
                  }}
                >
                  {errorMessage}
                </div>
              )}

              {/* Thông tin HĐ tóm tắt */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '10px',
                  fontSize: '13px',
                }}
              >
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Khách thuê đại diện:</span>
                  <strong>{contract.customerName || '---'}</strong>
                  {contract.customerPhone && <div style={{ fontSize: '11px', color: '#64748b' }}>{contract.customerPhone}</div>}
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Phòng trả:</span>
                  <strong style={{ color: '#b91c1c' }}>{contract.currentRoomCode || 'Chưa xếp'}</strong>
                  {contract.currentRoomName && <span style={{ color: '#64748b' }}> - {contract.currentRoomName}</span>}
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Thời hạn thuê:</span>
                  <span>{contract.startDate} ~ {contract.endDate}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Tiền cọc cam kết:</span>
                  <span style={{ fontWeight: 600, color: '#047857' }}>{formatCurrency(contract.depositRequired)}</span>
                </div>
              </div>

              {/* Thời điểm trả phòng */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Thời điểm bàn giao trả phòng <span style={{ color: '#dc2626' }}>*</span>
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
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: fieldErrors.occurredAt ? '1px solid #dc2626' : '1px solid #cbd5e1',
                    fontSize: '13px',
                    background: isReadOnly ? '#f1f5f9' : '#fff',
                  }}
                />
                {fieldErrors.occurredAt && (
                  <span style={{ color: '#dc2626', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                    {fieldErrors.occurredAt}
                  </span>
                )}
              </div>

              {/* Hiện trạng chung phòng khi trả */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>
                  Hiện trạng chung của phòng khi trả phòng <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  rows={3}
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
                  placeholder="Ghi nhận hiện trạng vệ sinh, tường sơn, trần nhà, gạch ốp, khóa cửa và bàn giao chìa khóa..."
                  disabled={isReadOnly || submitting}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: fieldErrors.roomCondition ? '1px solid #dc2626' : '1px solid #cbd5e1',
                    fontSize: '13px',
                    resize: 'vertical',
                    background: isReadOnly ? '#f1f5f9' : '#fff',
                  }}
                />
                {fieldErrors.roomCondition && (
                  <span style={{ color: '#dc2626', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                    {fieldErrors.roomCondition}
                  </span>
                )}
              </div>

              {/* Đối soát công tơ dịch vụ đo đếm */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Chỉ số công tơ dịch vụ đo đếm chốt trả (Điện, Nước) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Tự động tính lượng tiêu thụ chu kỳ cuối để quyết toán
                  </span>
                </div>

                {meterItems.length === 0 ? (
                  <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                    Không có dịch vụ tính theo chỉ số công tơ nào trong phòng này.
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Dịch vụ</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Đơn vị</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Chỉ số lúc nhận</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', width: '170px' }}>Chỉ số chốt trả</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Tiêu thụ (Δ)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meterItems.map((m) => {
                          const initialVal = m.initialIndex;
                          const finalVal = typeof m.indexValue === 'number' ? m.indexValue : null;
                          const delta =
                            finalVal !== null && initialVal !== null && initialVal !== undefined
                              ? finalVal - initialVal
                              : null;
                          const isInvalidProgression =
                            finalVal !== null && initialVal !== null && initialVal !== undefined && finalVal < initialVal;

                          return (
                            <tr key={m.serviceId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 12px' }}>
                                <strong>{m.serviceName}</strong>
                                {m.systemCode && (
                                  <div style={{ fontSize: '10px', color: '#64748b' }}>Mã HT: {m.systemCode}</div>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px', color: '#64748b' }}>{m.unit}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                {initialVal !== null && initialVal !== undefined ? (
                                  <span style={{ fontWeight: 600, color: '#334155' }}>
                                    {initialVal.toLocaleString('vi-VN')}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>
                                    Chưa chốt lúc nhận
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={m.indexValue}
                                  onChange={(e) => handleMeterIndexChange(m.serviceId, e.target.value)}
                                  placeholder="Nhập số chốt..."
                                  disabled={isReadOnly || submitting}
                                  style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    border:
                                      fieldErrors[`meter_${m.serviceId}`] || isInvalidProgression
                                        ? '1px solid #dc2626'
                                        : '1px solid #cbd5e1',
                                    fontSize: '13px',
                                    textAlign: 'right',
                                    background: isReadOnly ? '#f1f5f9' : '#fff',
                                  }}
                                />
                                {fieldErrors[`meter_${m.serviceId}`] && (
                                  <span style={{ color: '#dc2626', fontSize: '10px', display: 'block', marginTop: '2px' }}>
                                    {fieldErrors[`meter_${m.serviceId}`]}
                                  </span>
                                )}
                                {!fieldErrors[`meter_${m.serviceId}`] && isInvalidProgression && (
                                  <span style={{ color: '#dc2626', fontSize: '10px', display: 'block', marginTop: '2px' }}>
                                    Số chốt &lt; số nhận
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                {delta !== null ? (
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      color: delta < 0 ? '#dc2626' : '#047857',
                                    }}
                                  >
                                    {delta >= 0 ? `+${delta.toLocaleString('vi-VN')}` : delta.toLocaleString('vi-VN')} {m.unit}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>--</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Đối soát hiện trạng tài sản side-by-side */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Đối soát hiện trạng tài sản trong phòng ({assetItems.length} tài sản)
                  </label>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Đánh dấu tài sản hư hỏng để đưa vào bồi thường thanh lý
                  </span>
                </div>

                {assetItems.length === 0 ? (
                  <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                    Phòng hiện chưa gắn tài sản nào trong danh mục quản lý tài sản.
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Tài sản</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', width: '140px' }}>Lúc nhận phòng</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', width: '160px' }}>Lúc trả phòng</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Ghi chú / Thỏa thuận bồi thường</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assetItems.map((a) => {
                          const isDegraded =
                            (a.initialCondition === 'GOOD' && a.condition !== 'GOOD') ||
                            a.condition === 'DAMAGED' ||
                            a.condition === 'RETIRED';

                          return (
                            <tr
                              key={a.assetId}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                background: isDegraded ? '#fffdfa' : 'transparent',
                              }}
                            >
                              <td style={{ padding: '10px 12px' }}>
                                <strong>{a.assetName}</strong>
                                {isDegraded && (
                                  <div style={{ marginTop: '3px' }}>
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        padding: '1px 6px',
                                        borderRadius: '3px',
                                        background: '#fef2f2',
                                        color: '#b91c1c',
                                        border: '1px solid #fecaca',
                                      }}
                                    >
                                      ⚠️ Phát sinh hư hại / đền bù
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <div>{renderAssetStateBadge(a.initialCondition)}</div>
                                {a.initialNote && (
                                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                    {a.initialNote}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <select
                                  value={a.condition}
                                  onChange={(e) => handleAssetConditionChange(a.assetId, e.target.value as AssetState)}
                                  disabled={isReadOnly || submitting}
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    borderRadius: '4px',
                                    border: isDegraded ? '1px solid #f97316' : '1px solid #cbd5e1',
                                    fontSize: '13px',
                                    background: isReadOnly ? '#f1f5f9' : '#fff',
                                    fontWeight: isDegraded ? 600 : 400,
                                  }}
                                >
                                  <option value="GOOD">Tốt (GOOD)</option>
                                  <option value="DAMAGED">Hỏng hóc (DAMAGED)</option>
                                  <option value="REPAIRING">Đang sửa (REPAIRING)</option>
                                  <option value="RETIRED">Thanh lý (RETIRED)</option>
                                </select>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <input
                                  type="text"
                                  value={a.note}
                                  onChange={(e) => handleAssetNoteChange(a.assetId, e.target.value)}
                                  placeholder={isDegraded ? 'Mô tả hư hại, mức bồi thường dự kiến...' : 'Ghi chú thêm...'}
                                  disabled={isReadOnly || submitting}
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '13px',
                                    background: isReadOnly ? '#f1f5f9' : '#fff',
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Hướng dẫn lưu ý */}
              <div
                style={{
                  background: '#fefce8',
                  border: '1px solid #fef08a',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  fontSize: '12px',
                  color: '#854d0e',
                  lineHeight: '1.5',
                }}
              >
                <strong>⚠️ Lưu ý quan trọng:</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  <li>Bấm <strong>&quot;Lưu nháp&quot;</strong> để lưu tạm và quay lại cập nhật thêm sau.</li>
                  <li>
                    Bấm <strong>&quot;Xác nhận bàn giao&quot;</strong> sẽ khóa vĩnh viễn biên bản, đồng bộ chỉ số điện nước chốt cuối vào lượt ở và cập nhật kho tài sản.
                  </li>
                  <li>
                    Sau khi xác nhận thành công, hệ thống hỗ trợ <strong>chuyển ngay sang Thanh lý hợp đồng thuê</strong> với nội dung hư hại tài sản được điền tự động.
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="contract-modal-footer"
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            background: '#fafafa',
          }}
        >
          <button
            type="button"
            className="contract-action-btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            {isReadOnly ? 'Đóng' : 'Hủy bỏ'}
          </button>

          {isReadOnly && currentReportId && (
            <button
              type="button"
              className="contract-action-btn"
              style={{
                minWidth: '140px',
                color: '#0284c7',
                borderColor: '#bae6fd',
                background: '#f0f9ff',
                fontWeight: 600,
                padding: '8px 16px',
              }}
              onClick={() => setExportModalOpen(true)}
              title="Xuất biên bản bàn giao trả phòng"
            >
              📥 Xuất biên bản
            </button>
          )}

          {!isReadOnly && (
            <>
              <button
                type="button"
                className="contract-action-btn"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontWeight: 600,
                  padding: '8px 16px',
                }}
                disabled={submitting || loading}
                onClick={() => executeSubmit(false)}
              >
                {submitting ? 'Đang lưu...' : 'Lưu nháp'}
              </button>

              <button
                type="button"
                className="contract-action-btn btn-primary"
                style={{
                  fontWeight: 600,
                  padding: '8px 16px',
                  background: '#b91c1c',
                  borderColor: '#b91c1c',
                }}
                disabled={submitting || loading}
                onClick={() => setShowConfirmPopup(true)}
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận bàn giao trả phòng'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Popup before locking officially */}
      {showConfirmPopup && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setShowConfirmPopup(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '460px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 10px', fontSize: '17px', color: '#b91c1c', fontWeight: 700 }}>
              Xác nhận khóa biên bản trả phòng?
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              Sau khi xác nhận, biên bản bàn giao trả phòng sẽ <strong>bị khóa vĩnh viễn</strong> và không thể thay đổi. Chỉ số điện nước chốt cuối sẽ được lưu vào lượt ở của phòng và tình trạng tài sản hư hại sẽ được cập nhật.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="contract-action-btn btn-secondary"
                onClick={() => setShowConfirmPopup(false)}
                disabled={submitting}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="contract-action-btn btn-primary"
                style={{ background: '#b91c1c', borderColor: '#b91c1c' }}
                onClick={() => executeSubmit(true)}
                disabled={submitting}
              >
                {submitting ? 'Đang xác nhận...' : 'Đồng ý xác nhận khóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-confirmation Success Dialog with 1-click navigate to UC31 */}
      {confirmedResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
          }}
          onClick={() => {
            setConfirmedResult(null);
            onClose();
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '520px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700 }}>
                ✓
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a', fontWeight: 700 }}>
                  Xác nhận bàn giao trả phòng thành công!
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Hợp đồng: <strong>{confirmedResult.contractNumber}</strong> &bull; Phòng: <strong>{confirmedResult.roomCode}</strong>
                </div>
              </div>
            </div>

            {/* Consumptions summary */}
            {confirmedResult.meterConsumptions && confirmedResult.meterConsumptions.length > 0 && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px' }}>
                <strong style={{ display: 'block', marginBottom: '6px', color: '#334155' }}>Chỉ số chốt & lượng tiêu thụ:</strong>
                {confirmedResult.meterConsumptions.map((mc) => (
                  <div key={mc.serviceId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ color: '#475569' }}>{mc.serviceName}:</span>
                    <span>
                      Chốt <strong>{mc.finalIndex.toLocaleString('vi-VN')} {mc.unit}</strong>
                      {mc.consumption !== null && mc.consumption !== undefined && (
                        <span style={{ color: '#047857', marginLeft: '6px' }}>(Tiêu thụ: +{mc.consumption.toLocaleString('vi-VN')} {mc.unit})</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Damaged assets summary */}
            {confirmedResult.damagedAssetsSummary ? (
              <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px' }}>
                <strong style={{ color: '#c2410c', display: 'block', marginBottom: '4px' }}>
                  ⚠️ Tài sản ghi nhận bồi thường hư hại:
                </strong>
                <div style={{ color: '#9a3412', lineHeight: 1.4 }}>
                  {confirmedResult.damagedAssetsSummary}
                </div>
              </div>
            ) : (
              <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#166534' }}>
                Tất cả tài sản trong phòng đều ở tình trạng tốt, không phát sinh đền bù.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="contract-action-btn btn-secondary"
                onClick={() => {
                  setConfirmedResult(null);
                  onClose();
                }}
              >
                Đóng
              </button>

              {onProceedToTerminate && (
                <button
                  type="button"
                  className="contract-action-btn btn-primary"
                  style={{ background: '#b91c1c', borderColor: '#b91c1c' }}
                  onClick={() => {
                    const deduction = confirmedResult.damagedAssetsSummary;
                    setConfirmedResult(null);
                    onClose();
                    onProceedToTerminate(contract, deduction);
                  }}
                >
                  Chuyển sang Thanh lý hợp đồng thuê &rarr;
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Xuất biên bản trả phòng (UC35, UC78, UC79) */}
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
  );
};
