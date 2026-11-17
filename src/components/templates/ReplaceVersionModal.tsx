import React, { useState, useRef } from 'react';
import type { DocumentTemplate, ValidationResult } from '../../types/documentTemplate';
import { documentTemplateApi, DocumentTemplateApiError } from '../../services/documentTemplateApi';

interface ReplaceVersionModalProps {
  template: DocumentTemplate;
  onSuccess: () => void;
  onClose: () => void;
}

export const ReplaceVersionModal: React.FC<ReplaceVersionModalProps> = ({ template, onSuccess, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runValidation = (selectedFile: File) => {
    setValidating(true);
    setValidationResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('type', template.type);

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
      processFile(e.target.files[0]);
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
    runValidation(selected);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!file) {
      setErrorMessage('Vui lòng chọn tệp mẫu biểu mới (.docx hoặc .pdf)');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (changeNote.trim()) {
        formData.append('changeNote', changeNote.trim());
      }

      await documentTemplateApi.replaceVersion(template.id, formData);
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof DocumentTemplateApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Đã xảy ra lỗi khi tạo phiên bản mới');
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="templates-modal-backdrop" onClick={onClose}>
      <div className="templates-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <form onSubmit={handleSubmit} className="templates-modal-form">
          <div className="templates-modal-header">
            <h2>Thay thế tệp mẫu (Tạo phiên bản v{template.currentVersionNo + 1})</h2>
            <button type="button" className="templates-modal-close" onClick={onClose} aria-label="Đóng">
              &times;
            </button>
          </div>

          <div className="templates-modal-body">
            {errorMessage && <div className="template-alert error">{errorMessage}</div>}

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
              <div>
                <strong>Mẫu tài liệu:</strong> {template.name} ({template.typeDisplay})
              </div>
              <div style={{ marginTop: '4px', color: '#64748b' }}>
                Phiên bản hiện tại: v{template.currentVersionNo} ({template.currentFileName})
              </div>
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#0369a1', fontStyle: 'italic' }}>
                ℹ Tệp mới sẽ được lưu dưới dạng phiên bản v{template.currentVersionNo + 1}. Các phiên bản cũ vẫn được lưu trữ bất biến phục vụ tra cứu lịch sử xuất.
              </div>
            </div>

            <div className="form-group">
              <label>
                Chọn tệp thay thế (.docx hoặc .pdf, tối đa 10MB) <span className="required">*</span>
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
                <div className="file-dropzone-text">Kéo thả tệp mới vào đây hoặc bấm để chọn tệp</div>
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
              </div>
            )}

            <div className="form-group">
              <label>Ghi chú lý do thay đổi phiên bản (tùy chọn)</label>
              <textarea
                className="form-textarea"
                placeholder="Ví dụ: Cập nhật điều khoản thanh toán tiền cọc, sửa lỗi chính tả..."
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                disabled={submitting}
                maxLength={500}
              />
            </div>
          </div>

          <div className="templates-modal-footer">
            <button type="button" className="btn-template-secondary" onClick={onClose} disabled={submitting}>
              Hủy bỏ
            </button>
            <button type="submit" className="btn-template-primary" disabled={submitting || validating || !file}>
              {submitting ? 'Đang cập nhật...' : 'Xác nhận tạo phiên bản mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
