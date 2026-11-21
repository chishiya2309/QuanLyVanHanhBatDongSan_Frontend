import React, { useEffect, useState, useMemo } from 'react';
import type {
  DocumentExportOptions,
  ExportedDocumentItem,
  ExportFormat,
  TemplateOption,
} from '../../types/documentExport';
import { documentExportApi, DocumentExportApiError } from '../../services/documentExportApi';
import './documentExportModal.css';

interface DocumentExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceType: 'RENTAL' | 'DEPOSIT' | 'HANDOVER';
  sourceId: string;
  handoverReportId?: string;
  onSuccess?: () => void;
}

const formatTemplateTypeLabel = (type?: string) => {
  switch (type) {
    case 'RENTAL_CONTRACT': return 'HĐ thuê';
    case 'DEPOSIT_CONTRACT': return 'HĐ cọc';
    case 'HANDOVER': return 'Bàn giao';
    case 'INVOICE': return 'Hóa đơn';
    case 'RECEIPT': return 'Phiếu thu';
    case 'DISBURSEMENT': return 'Phiếu chi';
    default: return 'Biểu mẫu';
  }
};

export const DocumentExportModal: React.FC<DocumentExportModalProps> = ({
  isOpen,
  onClose,
  sourceType,
  sourceId,
  handoverReportId,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'review' | 'preview' | 'history'>('review');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<DocumentExportOptions | null>(null);

  // Form selections
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('PDF');
  const [overrideValues, setOverrideValues] = useState<Record<string, string>>({});

  // Preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

  // Export state
  const [exportLoading, setExportLoading] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<ExportedDocumentItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Reset preview when selected template changes
  useEffect(() => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
  }, [selectedVersionId]);

  // Load export options when opening modal
  useEffect(() => {
    if (!isOpen || !sourceId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setExportSuccessMessage(null);
    setActiveTab('review');

    const fetchOptions = async () => {
      try {
        let res: DocumentExportOptions;
        if (sourceType === 'RENTAL') {
          res = await documentExportApi.getRentalExportOptions(sourceId);
        } else if (sourceType === 'DEPOSIT') {
          res = await documentExportApi.getDepositExportOptions(sourceId);
        } else {
          if (!handoverReportId) throw new Error('Thiếu ID biên bản bàn giao');
          res = await documentExportApi.getHandoverExportOptions(sourceId, handoverReportId);
        }

        if (!isMounted) return;
        setOptions(res);

        // Pre-select default template version
        if (res.defaultTemplateVersionId) {
          setSelectedVersionId(res.defaultTemplateVersionId);
        } else if (res.availableTemplates.length > 0) {
          setSelectedVersionId(res.availableTemplates[0].latestVersionId);
        }

        // Initialize override values with extracted DB values
        const initialOverrides: Record<string, string> = {};
        if (res.extractedData && res.extractedData.values) {
          for (const [k, v] of Object.entries(res.extractedData.values)) {
            if (v && v !== '---') {
              initialOverrides[k] = v;
            }
          }
        }
        setOverrideValues(initialOverrides);
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof DocumentExportApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Không thể tải thông tin chuẩn bị xuất tài liệu.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOptions();
    loadHistory();

    return () => {
      isMounted = false;
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [isOpen, sourceId, sourceType, handoverReportId]);

  // Load past export history
  const loadHistory = async () => {
    if (!sourceId) return;
    setHistoryLoading(true);
    try {
      let items: ExportedDocumentItem[] = [];
      if (sourceType === 'RENTAL') {
        items = await documentExportApi.getRentalExportHistory(sourceId);
      } else if (sourceType === 'DEPOSIT') {
        items = await documentExportApi.getDepositExportHistory(sourceId);
      } else if (handoverReportId) {
        items = await documentExportApi.getHandoverExportHistory(sourceId, handoverReportId);
      }
      setHistory(items);
    } catch (e) {
      console.warn('Lỗi khi tải lịch sử xuất tài liệu:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Find the selected template version option
  const currentTemplate = useMemo<TemplateOption | undefined>(() => {
    if (!options) return undefined;
    return options.availableTemplates.find(
      (t) => t.latestVersionId === selectedVersionId
    );
  }, [options, selectedVersionId]);

  // Detected variables in the active template
  const detectedVariables = useMemo<string[]>(() => {
    if (!currentTemplate) return [];
    return currentTemplate.detectedVariables || [];
  }, [currentTemplate]);

  // Handle value editing in Review Table (Trường hợp 2)
  const handleVariableChange = (rawKey: string, value: string) => {
    const cleanKey = rawKey.replace(/[{}]/g, '').trim();
    setOverrideValues((prev) => ({
      ...prev,
      [cleanKey]: value,
    }));
  };

  // Trigger Online Preview (UC79)
  const handlePreview = async () => {
    setError(null);
    setPreviewLoading(true);

    try {
      const req = {
        templateVersionId: selectedVersionId || undefined,
        overrideValues,
      };

      let resp;
      if (sourceType === 'RENTAL') {
        resp = await documentExportApi.previewRentalContract(sourceId, req);
      } else if (sourceType === 'DEPOSIT') {
        resp = await documentExportApi.previewDepositContract(sourceId, req);
      } else {
        if (!handoverReportId) throw new Error('Thiếu ID biên bản bàn giao');
        resp = await documentExportApi.previewHandover(sourceId, handoverReportId, req);
      }

      // Fetch the binary stream blob for inline rendering
      const blob = await documentExportApi.fetchPreviewBlob(resp.previewToken);
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
      const newBlobUrl = URL.createObjectURL(blob);
      setPreviewBlobUrl(newBlobUrl);
      setActiveTab('preview');
    } catch (err: unknown) {
      if (err instanceof DocumentExportApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Không thể tạo bản xem trước tài liệu.');
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  // Trigger Official Export (UC78, UC34, UC35)
  const handleExport = async () => {
    if (!options?.eligibleForExport) return;
    setError(null);
    setExportLoading(true);

    try {
      const req = {
        templateVersionId: selectedVersionId || undefined,
        format: selectedFormat,
        overrideValues,
      };

      let exportedDoc: ExportedDocumentItem;
      if (sourceType === 'RENTAL') {
        exportedDoc = await documentExportApi.exportRentalContract(sourceId, req);
      } else if (sourceType === 'DEPOSIT') {
        exportedDoc = await documentExportApi.exportDepositContract(sourceId, req);
      } else {
        if (!handoverReportId) throw new Error('Thiếu ID biên bản bàn giao');
        exportedDoc = await documentExportApi.exportHandover(sourceId, handoverReportId, req);
      }

      // Trigger automatic browser download
      await documentExportApi.downloadExportedDocument(exportedDoc.id, exportedDoc.fileName);

      setExportSuccessMessage(`Đã xuất thành công tài liệu: ${exportedDoc.fileName}`);
      loadHistory();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      if (err instanceof DocumentExportApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Lỗi khi xuất tài liệu chính thức.');
      }
    } finally {
      setExportLoading(false);
    }
  };

  if (!isOpen) return null;

  const titlePrefix =
    sourceType === 'RENTAL'
      ? 'Hợp đồng thuê'
      : sourceType === 'DEPOSIT'
      ? 'Hợp đồng đặt cọc'
      : 'Biên bản bàn giao';

  return (
    <div className="export-modal-backdrop" onClick={onClose}>
      <div className="export-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="export-modal-header">
          <div className="export-modal-title-group">
            <h3>Xuất tài liệu: {titlePrefix}</h3>
            <div className="export-modal-subtitle">
              <span>{options?.sourceSummary || (loading ? 'Đang nạp dữ liệu...' : error ? '' : 'Chưa có thông tin đối tượng')}</span>
              {options?.sourceStatus && (
                <span
                  className={`export-var-badge ${
                    options.eligibleForExport ? 'registered-filled' : 'registered-empty'
                  }`}
                >
                  {options.sourceStatus}
                </span>
              )}
            </div>
          </div>
          <button className="export-modal-close-btn" onClick={onClose} title="Đóng">
            &times;
          </button>
        </div>

        {/* Tab navigation */}
        <div className="export-modal-tabs">
          <button
            className={`export-tab-btn ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            <i className="tab-icon">📋</i> 1. Soát xét dữ liệu & Cấu hình
          </button>
          <button
            className={`export-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => {
              if (previewBlobUrl) setActiveTab('preview');
              else handlePreview();
            }}
          >
            <i className="tab-icon">👁️</i> 2. Xem trước tài liệu
          </button>
          <button
            className={`export-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('history');
              loadHistory();
            }}
          >
            <i className="tab-icon">🕒</i> 3. Lịch sử đã xuất ({history.length})
          </button>
        </div>

        {/* Body */}
        <div className="export-modal-body">
          {error && (
            <div className="export-notice-banner warning">
              <span>⚠️ {error}</span>
            </div>
          )}

          {exportSuccessMessage && (
            <div className="export-notice-banner info">
              <span>✅ {exportSuccessMessage}</span>
            </div>
          )}

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Đang phân tích mẫu biểu và trích xuất dữ liệu từ hệ thống...
            </div>
          ) : activeTab === 'review' ? (
            <div>
              {/* Draft / Ineligible Warning Banner */}
              {options && !options.eligibleForExport && (
                <div className="export-notice-banner warning">
                  <span>
                    ℹ️ <strong>Lưu ý:</strong> {options.ineligibleReason || 'Đối tượng nguồn đang ở trạng thái nháp. Bạn chỉ có thể Xem trước với watermark; cần hoàn tất thủ tục trước khi xuất bản chính thức.'}
                  </span>
                </div>
              )}

              {options && options.availableTemplates.length === 0 && (
                <div className="export-notice-banner warning">
                  <span>⚠️ Bạn chưa có mẫu biểu nào trong hệ thống. Vui lòng vào mục <strong>Mẫu biểu</strong> để tải lên mẫu biểu trước khi xuất tài liệu.</span>
                </div>
              )}

              {/* Top Configuration Grid */}
              <div className="export-config-grid">
                <div className="export-form-group">
                  <label className="export-form-label">Chọn mẫu biểu áp dụng:</label>
                  <select
                    className="export-select-control"
                    value={selectedVersionId}
                    onChange={(e) => setSelectedVersionId(e.target.value)}
                    disabled={!options || options.availableTemplates.length === 0}
                  >
                    {options && options.availableTemplates.length === 0 ? (
                      <option value="">(Chưa có mẫu biểu nào - vui lòng tạo mẫu)</option>
                    ) : (
                      options?.availableTemplates.map((t) => (
                        <option key={t.latestVersionId} value={t.latestVersionId}>
                          {t.name} (v{t.versionNo}) [{formatTemplateTypeLabel(t.type)}] {t.isDefault ? '— [Mặc định]' : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="export-form-group">
                  <label className="export-form-label">Định dạng xuất file:</label>
                  <div className="export-format-radios">
                    <label className="export-radio-label">
                      <input
                        type="radio"
                        name="exportFormat"
                        value="PDF"
                        checked={selectedFormat === 'PDF'}
                        onChange={() => setSelectedFormat('PDF')}
                      />
                      PDF (In ấn / Ký kết)
                    </label>
                    <label className="export-radio-label">
                      <input
                        type="radio"
                        name="exportFormat"
                        value="DOCX"
                        checked={selectedFormat === 'DOCX'}
                        onChange={() => setSelectedFormat('DOCX')}
                      />
                      Word (.docx)
                    </label>
                  </div>
                </div>
              </div>

              {/* Data Review & Custom Variable Table (Trường hợp 2) */}
              <div className="export-review-section">
                <div className="export-review-header">
                  <h4>Bảng soát xét dữ liệu trích xuất & Biến tùy chỉnh</h4>
                  <span className="export-review-hint">
                    Tổng số biến phát hiện: <strong>{detectedVariables.length}</strong>
                  </span>
                </div>
                <div className="export-review-hint">
                  Hệ thống tự động điền các thông tin đã có trong cơ sở dữ liệu. Bạn có thể sửa đổi bất kỳ giá trị nào hoặc nhập nội dung cho các <strong>biến tùy chỉnh</strong> tự định nghĩa trong mẫu biểu. Nếu để trống, hệ thống sẽ tự động điền <code>---</code> để tránh lộ placeholder.
                </div>

                <div className="export-table-wrapper">
                  <table className="export-review-table">
                    <thead>
                      <tr>
                        <th style={{ width: '28%' }}>Mã biến trong mẫu</th>
                        <th style={{ width: '22%' }}>Trạng thái / Phân loại</th>
                        <th style={{ width: '50%' }}>Giá trị áp dụng khi xuất</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detectedVariables.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                            Không tìm thấy biến placeholder nào trong mẫu biểu này.
                          </td>
                        </tr>
                      ) : (
                        detectedVariables.map((rawKey) => {
                          const cleanKey = rawKey.replace(/[{}]/g, '').trim();
                          const dbValue = options?.extractedData?.values?.[cleanKey];
                          const isKnownInDb = dbValue !== undefined;
                          const hasDbData = isKnownInDb && dbValue !== '---' && dbValue !== '';
                          const currentValue =
                            overrideValues[cleanKey] !== undefined
                              ? overrideValues[cleanKey]
                              : (hasDbData ? dbValue : '');

                          let badgeClass = 'custom';
                          let badgeText = 'Biến tùy chỉnh';

                          if (isKnownInDb) {
                            if (hasDbData) {
                              badgeClass = 'registered-filled';
                              badgeText = 'Đã có dữ liệu';
                            } else {
                              badgeClass = 'registered-empty';
                              badgeText = 'Chưa có dữ liệu';
                            }
                          }

                          return (
                            <tr key={rawKey}>
                              <td>
                                <code style={{ color: '#0f172a', fontWeight: 600 }}>{rawKey}</code>
                              </td>
                              <td>
                                <span className={`export-var-badge ${badgeClass}`}>
                                  {badgeText}
                                </span>
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="export-table-input"
                                  value={currentValue}
                                  placeholder={hasDbData ? '' : 'Để trống sẽ tự động điền ---'}
                                  onChange={(e) => handleVariableChange(cleanKey, e.target.value)}
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === 'preview' ? (
            /* Tab 2: Preview inline viewer */
            <div className="export-preview-container">
              <div className="export-notice-banner warning" style={{ marginBottom: '10px' }}>
                <span>
                  🛡️ <strong>Bản xem trước:</strong> Tài liệu được gắn hình mờ (Watermark) bán trong suốt nhằm phục vụ kiểm tra đối soát, không có giá trị pháp lý chính thức.
                </span>
              </div>
              {previewBlobUrl ? (
                <iframe
                  title="Bản xem trước PDF"
                  src={`${previewBlobUrl}#toolbar=1&navpanes=0`}
                  className="export-preview-iframe"
                />
              ) : (
                <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                  {previewLoading ? 'Đang tạo và gắn watermark bản xem trước...' : 'Chưa có dữ liệu xem trước.'}
                </div>
              )}
            </div>
          ) : (
            /* Tab 3: History table */
            <div>
              <div className="export-review-header">
                <h4>Lịch sử các lần xuất tài liệu nguồn này</h4>
                <button
                  className="export-btn export-btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                  onClick={loadHistory}
                >
                  Làm mới
                </button>
              </div>
              {historyLoading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  Đang tải lịch sử...
                </div>
              ) : history.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  Chưa có tài liệu nào được xuất cho đối tượng này.
                </div>
              ) : (
                <div className="export-table-wrapper" style={{ maxHeight: '420px' }}>
                  <table className="export-history-table">
                    <thead>
                      <tr>
                        <th>Thời gian xuất</th>
                        <th>Tên file</th>
                        <th>Mẫu biểu</th>
                        <th>Định dạng</th>
                        <th>Dung lượng</th>
                        <th style={{ textAlign: 'center' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((doc) => (
                        <tr key={doc.id}>
                          <td>{new Date(doc.generatedAt).toLocaleString('vi-VN')}</td>
                          <td>
                            <strong>{doc.fileName}</strong>
                          </td>
                          <td>
                            {doc.templateName} (v{doc.versionNo})
                          </td>
                          <td>
                            <span className="export-var-badge registered-filled">
                              {doc.format}
                            </span>
                          </td>
                          <td>{Math.round(doc.fileSize / 1024)} KB</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="export-btn export-btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                              onClick={() =>
                                documentExportApi.downloadExportedDocument(
                                  doc.id,
                                  doc.fileName
                                )
                              }
                            >
                              ⬇️ Tải lại file
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="export-modal-footer">
          <button className="export-btn export-btn-secondary" onClick={onClose}>
            Đóng
          </button>

          {activeTab === 'preview' && (
            <button
              className="export-btn export-btn-secondary"
              onClick={() => setActiveTab('review')}
            >
              ← Quay lại soát xét
            </button>
          )}

          <button
            className="export-btn export-btn-preview"
            onClick={handlePreview}
            disabled={previewLoading || !selectedVersionId}
          >
            {previewLoading ? 'Đang tạo xem trước...' : '👁️ Xem trước (PDF)'}
          </button>

          <button
            className="export-btn export-btn-primary"
            onClick={handleExport}
            disabled={
              exportLoading ||
              !selectedVersionId ||
              !options?.eligibleForExport
            }
            title={
              !options?.eligibleForExport
                ? options?.ineligibleReason || 'Chưa đủ điều kiện xuất chính thức'
                : 'Xuất và tải về tài liệu chính thức'
            }
          >
            {exportLoading ? 'Đang xuất...' : '📥 Xác nhận & Xuất tài liệu'}
          </button>
        </div>
      </div>
    </div>
  );
};
