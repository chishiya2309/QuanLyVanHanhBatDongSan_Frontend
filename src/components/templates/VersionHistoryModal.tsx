import React, { useState, useEffect } from 'react';
import type { DocumentTemplateDetail } from '../../types/documentTemplate';
import { documentTemplateApi } from '../../services/documentTemplateApi';

interface VersionHistoryModalProps {
  templateId: string;
  onClose: () => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({ templateId, onClose }) => {
  const [detail, setDetail] = useState<DocumentTemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingNo, setDownloadingNo] = useState<number | null>(null);

  useEffect(() => {
    documentTemplateApi
      .getTemplateDetail(templateId)
      .then((data) => {
        setDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading template detail:', err);
        setLoading(false);
      });
  }, [templateId]);

  const handleDownload = async (versionNo: number) => {
    setDownloadingNo(versionNo);
    try {
      await documentTemplateApi.downloadTemplate(templateId, versionNo);
    } catch (err) {
      console.error('Download error:', err);
      alert('Không thể tải tệp phiên bản này');
    } finally {
      setDownloadingNo(null);
    }
  };

  return (
    <div className="templates-modal-backdrop" onClick={onClose}>
      <div
        className="templates-modal templates-modal-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="templates-modal-header">
          <h2>Lịch sử các phiên bản mẫu biểu</h2>
          <button className="templates-modal-close" onClick={onClose} aria-label="Đóng">
            &times;
          </button>
        </div>

        <div className="templates-modal-body">
          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>
              Đang tải lịch sử phiên bản...
            </div>
          ) : !detail ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#dc2626' }}>
              Không tìm thấy thông tin mẫu tài liệu
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600 }}>{detail.name}</h3>
                <div style={{ color: '#6b7280', fontSize: '13px' }}>
                  Loại: <strong>{detail.typeDisplay}</strong> | Tổng số phiên bản: {detail.versions.length}
                </div>
              </div>

              <div className="version-timeline">
                {detail.versions.map((ver) => {
                  const isCurrent = ver.versionNo === detail.currentVersionNo;
                  return (
                    <div key={ver.id} className={`version-item ${isCurrent ? 'current' : ''}`}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: isCurrent ? '#1d4ed8' : '#111827' }}>
                            Phiên bản v{ver.versionNo}
                          </span>
                          {isCurrent && (
                            <span style={{ fontSize: '11px', fontWeight: 600, background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px' }}>
                              Đang sử dụng
                            </span>
                          )}
                          <span className="badge-filetype">{ver.fileType}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#4b5563' }}>
                          Tệp: <strong>{ver.fileName}</strong> ({(ver.fileSize / 1024).toFixed(1)} KB)
                        </div>
                        {ver.changeNote && (
                          <div style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic', marginTop: '2px' }}>
                            Ghi chú: {ver.changeNote}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                          Ngày tạo: {new Date(ver.createdAt).toLocaleString('vi-VN')} | Số biến: {ver.detectedVariables.length}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-template-outline"
                        onClick={() => handleDownload(ver.versionNo)}
                        disabled={downloadingNo === ver.versionNo}
                      >
                        {downloadingNo === ver.versionNo ? 'Đang tải...' : '📥 Tải file'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
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
