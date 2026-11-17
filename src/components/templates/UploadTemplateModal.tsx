import React, { useState, useRef } from 'react';
import type { TemplateType, ValidationResult } from '../../types/documentTemplate';
import { TEMPLATE_TYPE_LABELS } from '../../types/documentTemplate';
import { documentTemplateApi, DocumentTemplateApiError } from '../../services/documentTemplateApi';

interface UploadTemplateModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

export const UploadTemplateModal: React.FC<UploadTemplateModalProps> = ({ onSuccess, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<TemplateType>('RENTAL_CONTRACT');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runValidation = (selectedFile: File, selectedType: TemplateType) => {
    setValidating(true);
    setValidationResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('type', selectedType);

    documentTemplateApi
      .validateFile(formData)
      .then((res) => {
        setValidationResult(res);
        setValidating(false);
      })
      .catch((err) => {
        console.error('Validation error:', err);
        setValidating(false);
      });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      processFile(selected);
    }
  };

  const processFile = (selected: File) => {
    setErrorMessage(null);
    const lowerName = selected.name.toLowerCase();
    if (!lowerName.endsWith('.docx') && !lowerName.endsWith('.pdf')) {
      setErrorMessage('Định dạng tệp không được hỗ trợ. Vui lòng chỉ chọn tệp .docx hoặc .pdf');
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setErrorMessage('Dung lượng tệp vượt quá giới hạn tối đa 10MB');
      return;
    }

    setFile(selected);
    if (!name) {
      const baseName = selected.name.replace(/\.[^/.]+$/, '');
      setName(baseName);
    }
    runValidation(selected, type);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleTypeChange = (newType: TemplateType) => {
    setType(newType);
    if (file) {
      runValidation(file, newType);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!file) {
      setErrorMessage('Vui lòng chọn tệp mẫu biểu (.docx hoặc .pdf)');
      return;
    }
    if (!name.trim()) {
      setErrorMessage('Vui lòng nhập tên mẫu biểu');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name.trim());
      formData.append('type', type);
      if (description.trim()) {
        formData.append('description', description.trim());
      }
      formData.append('isDefault', String(isDefault));

      await documentTemplateApi.uploadTemplate(formData);
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof DocumentTemplateApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Đã xảy ra lỗi khi tải lên mẫu tài liệu');
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="templates-modal-backdrop" onClick={onClose}>
      <div className="templates-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <form onSubmit={handleSubmit} className="templates-modal-form">
          <div className="templates-modal-header">
            <h2>Tải lên mẫu tài liệu mới</h2>
            <button type="button" className="templates-modal-close" onClick={onClose} aria-label="Đóng">
              &times;
            </button>
          </div>

          <div className="templates-modal-body">
            {errorMessage && <div className="template-alert error">{errorMessage}</div>}

            <div className="form-group">
              <label>
                Loại tài liệu mẫu <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as TemplateType)}
                disabled={submitting}
              >
                {(Object.keys(TEMPLATE_TYPE_LABELS) as TemplateType[]).map((t) => (
                  <option key={t} value={t}>
                    {TEMPLATE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>
                Tệp mẫu biểu (.docx hoặc .pdf, tối đa 10MB) <span className="required">*</span>
              </label>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".docx,.pdf"
                onChange={handleFileChange}
              />

              <div
                className={`file-dropzone ${dragOver ? 'dragover' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="file-dropzone-icon">📄</div>
                <div className="file-dropzone-text">Kéo thả tệp vào đây hoặc bấm để chọn tệp</div>
                <div className="file-dropzone-sub">Hỗ trợ Microsoft Word (.docx) và Adobe PDF (.pdf)</div>
              </div>

              {file && (
                <div className="selected-file-card">
                  <div className="selected-file-info">
                    <span>📎</span>
                    <span>
                      {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setValidationResult(null);
                    }}
                  >
                    Gỡ bỏ
                  </button>
                </div>
              )}
            </div>

            {validating && (
              <div style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic' }}>
                Đang quét và kiểm tra các biến trong tệp mẫu...
              </div>
            )}

            {validationResult && (
              <div className="validation-box">
                <div className="validation-header">
                  <span>✓</span>
                  <span>Kết quả kiểm tra biến (Phát hiện {validationResult.detectedVariables.length} biến)</span>
                </div>

                {validationResult.unsupportedVariables.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ color: '#b91c1c', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      ⚠ Các biến chưa được hỗ trợ cho loại tài liệu này:
                    </div>
                    <div className="validation-tags">
                      {validationResult.unsupportedVariables.map((v) => (
                        <span key={v} className="variable-tag unsupported">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {validationResult.missingRequiredVariables.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ color: '#b45309', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      ℹ Các biến khuyến nghị chưa có trong mẫu:
                    </div>
                    <div className="validation-tags">
                      {validationResult.missingRequiredVariables.map((v) => (
                        <span key={v} className="variable-tag missing">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {validationResult.unsupportedVariables.length === 0 && (
                  <div style={{ color: '#15803d', fontSize: '12px', marginTop: '6px' }}>
                    Tất cả các biến trong tệp mẫu đều hợp lệ và tương thích.
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label>
                Tên mẫu tài liệu <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Ví dụ: Mẫu hợp đồng thuê phòng chuẩn 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                maxLength={100}
                required
              />
            </div>

            <div className="form-group">
              <label>Mô tả ghi chú (tùy chọn)</label>
              <textarea
                className="form-textarea"
                placeholder="Ghi chú về mẫu biểu, phạm vi áp dụng..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                maxLength={500}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <input
                type="checkbox"
                id="isDefaultUpload"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                disabled={submitting}
              />
              <label htmlFor="isDefaultUpload" style={{ fontSize: '13px', cursor: 'pointer', userSelect: 'none' }}>
                Đặt làm mẫu mặc định cho loại chứng từ này
              </label>
            </div>
          </div>

          <div className="templates-modal-footer">
            <button type="button" className="btn-template-secondary" onClick={onClose} disabled={submitting}>
              Hủy bỏ
            </button>
            <button type="submit" className="btn-template-primary" disabled={submitting || validating || !file}>
              {submitting ? 'Đang tải lên...' : 'Lưu mẫu tài liệu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
