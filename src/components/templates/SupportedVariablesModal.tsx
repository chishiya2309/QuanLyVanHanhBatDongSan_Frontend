import React, { useState, useEffect } from 'react';
import type { TemplateType, TemplateVariable } from '../../types/documentTemplate';
import { TEMPLATE_TYPE_LABELS } from '../../types/documentTemplate';
import { documentTemplateApi } from '../../services/documentTemplateApi';

interface SupportedVariablesModalProps {
  initialType?: TemplateType;
  onClose: () => void;
}

export const SupportedVariablesModal: React.FC<SupportedVariablesModalProps> = ({
  initialType = 'RENTAL_CONTRACT',
  onClose,
}) => {
  const [selectedType, setSelectedType] = useState<TemplateType>(initialType);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    documentTemplateApi
      .getSupportedVariables(selectedType)
      .then((data) => {
        if (isMounted) {
          setVariables(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Lỗi khi tải danh sách biến:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedType]);

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const filtered = variables.filter(
    (v) =>
      v.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="templates-modal-backdrop" onClick={onClose}>
      <div
        className="templates-modal templates-modal-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="templates-modal-header">
          <h2>Danh sách biến hỗ trợ (Template Placeholders)</h2>
          <button className="templates-modal-close" onClick={onClose} aria-label="Đóng">
            &times;
          </button>
        </div>

        <div className="templates-modal-body">
          <p style={{ margin: 0, color: '#4b5563', fontSize: '13px' }}>
            Sao chép mã biến (dạng <code>{'{ten_bien}'}</code>) và dán vào tệp mẫu Word (<code>.docx</code>) hoặc biểu mẫu PDF (<code>.pdf</code>) của bạn. Hệ thống sẽ tự động điền dữ liệu tương ứng khi xuất chứng từ.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 200px' }}>
              <select
                className="form-select"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as TemplateType)}
              >
                {(Object.keys(TEMPLATE_TYPE_LABELS) as TemplateType[]).map((t) => (
                  <option key={t} value={t}>
                    {TEMPLATE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: '2 1 240px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Tìm biến theo mã hoặc mô tả..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>
                Đang tải danh sách biến...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>
                Không tìm thấy biến phù hợp
              </div>
            ) : (
              <table className="variables-table">
                <thead>
                  <tr>
                    <th style={{ width: '220px' }}>Mã biến (Click sao chép)</th>
                    <th>Ý nghĩa & Mô tả</th>
                    <th style={{ width: '100px' }}>Bắt buộc</th>
                    <th style={{ width: '180px' }}>Giá trị mẫu</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <tr key={v.key}>
                      <td>
                        <button
                          type="button"
                          className={`copy-btn ${copiedKey === v.key ? 'copied' : ''}`}
                          onClick={() => handleCopy(v.key)}
                          title="Bấm để sao chép mã biến"
                        >
                          {copiedKey === v.key ? '✓ Đã chép' : v.key}
                        </button>
                      </td>
                      <td>{v.description}</td>
                      <td>
                        {v.required ? (
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>Bắt buộc</span>
                        ) : (
                          <span style={{ color: '#6b7280' }}>Tùy chọn</span>
                        )}
                      </td>
                      <td style={{ color: '#475569', fontStyle: 'italic' }}>{v.sampleValue || '---'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="templates-modal-footer">
          <button type="button" className="btn-template-secondary" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
