import React, { useState, useEffect } from 'react';
import type { DocumentTemplate, TemplateType } from '../../types/documentTemplate';
import { TEMPLATE_TYPE_LABELS } from '../../types/documentTemplate';
import { documentTemplateApi, DocumentTemplateApiError } from '../../services/documentTemplateApi';

interface EditTemplateInfoModalProps {
  template: DocumentTemplate;
  onSuccess: () => void;
  onClose: () => void;
}

export const EditTemplateInfoModal: React.FC<EditTemplateInfoModalProps> = ({ template, onSuccess, onClose }) => {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || '');
  const [type, setType] = useState<TemplateType>(template.type);
  const [usedInExport, setUsedInExport] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    documentTemplateApi
      .getTemplateDetail(template.id)
      .then((detail) => {
        setUsedInExport(detail.usedInExport);
        setName(detail.name);
        setDescription(detail.description || '');
        setType(detail.type);
        setLoadingDetail(false);
      })
      .catch((err) => {
        console.error('Error loading detail:', err);
        setLoadingDetail(false);
      });
  }, [template.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Vui lòng nhập tên mẫu tài liệu');
      return;
    }

    setSubmitting(true);
    try {
      await documentTemplateApi.updateTemplateInfo(template.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        type,
      });
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof DocumentTemplateApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Đã xảy ra lỗi khi cập nhật thông tin mẫu');
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="templates-modal-backdrop" onClick={onClose}>
      <div className="templates-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <form onSubmit={handleSubmit} className="templates-modal-form">
          <div className="templates-modal-header">
            <h2>Chỉnh sửa thông tin mẫu tài liệu</h2>
            <button type="button" className="templates-modal-close" onClick={onClose} aria-label="Đóng">
              &times;
            </button>
          </div>

          <div className="templates-modal-body">
            {errorMessage && <div className="template-alert error">{errorMessage}</div>}

            {loadingDetail ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                Đang tải thông tin mẫu...
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>
                    Tên mẫu tài liệu <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={submitting}
                    maxLength={100}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Loại tài liệu</label>
                  <select
                    className="form-select"
                    value={type}
                    onChange={(e) => setType(e.target.value as TemplateType)}
                    disabled={submitting || usedInExport}
                  >
                    {(Object.keys(TEMPLATE_TYPE_LABELS) as TemplateType[]).map((t) => (
                      <option key={t} value={t}>
                        {TEMPLATE_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  {usedInExport && (
                    <div style={{ color: '#b45309', fontSize: '12px', marginTop: '4px', fontStyle: 'italic' }}>
                      🔒 Không thể thay đổi loại mẫu vì mẫu này đã từng được sử dụng để xuất chứng từ trong quá khứ.
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Mô tả ghi chú</label>
                  <textarea
                    className="form-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={submitting}
                    maxLength={500}
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>

          <div className="templates-modal-footer">
            <button type="button" className="btn-template-secondary" onClick={onClose} disabled={submitting}>
              Hủy bỏ
            </button>
            <button type="submit" className="btn-template-primary" disabled={submitting || loadingDetail}>
              {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
