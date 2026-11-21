import React, { useState, useEffect, useCallback } from 'react';
import type {
  DocumentTemplate,
  TemplateType,
} from '../../types/documentTemplate';
import { documentTemplateApi, DocumentTemplateApiError } from '../../services/documentTemplateApi';
import type { DocumentTemplateRoute } from '../../utils/documentTemplateNavigation';
import { buildDocumentTemplateUrl } from '../../utils/documentTemplateNavigation';
import { UploadTemplateModal } from './UploadTemplateModal';
import { ReplaceVersionModal } from './ReplaceVersionModal';
import { EditTemplateInfoModal } from './EditTemplateInfoModal';
import { VersionHistoryModal } from './VersionHistoryModal';
import { SupportedVariablesModal } from './SupportedVariablesModal';
import '../contracts/contracts.css';
import './templates.css';

interface DocumentTemplatesPageProps {
  route?: DocumentTemplateRoute | null;
  onNavigate?: (url: string) => void;
  onSessionExpired?: (message?: string) => void;
}

interface CategoryTab {
  key: TemplateType | '';
  label: string;
}

const CATEGORY_TABS: CategoryTab[] = [
  { key: 'DEPOSIT_CONTRACT', label: 'Hợp đồng đặt cọc' },
  { key: 'RENTAL_CONTRACT', label: 'Hợp đồng thuê' },
  { key: 'HANDOVER', label: 'Biên bản bàn giao' },
  { key: 'INVOICE', label: 'Mẫu hóa đơn' },
  { key: 'RECEIPT', label: 'Mẫu thu chi' },
  { key: '', label: 'Tất cả biểu mẫu' },
];

export const DocumentTemplatesPage: React.FC<DocumentTemplatesPageProps> = ({
  route,
  onNavigate,
  onSessionExpired,
}) => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active category tab (defaults to DEPOSIT_CONTRACT if not specified)
  const [activeTab, setActiveTab] = useState<TemplateType | ''>(
    route?.type === 'ALL' ? '' : route?.type ?? 'DEPOSIT_CONTRACT'
  );

  // Filters
  const [searchKeyword, setSearchKeyword] = useState<string>(route?.keyword || '');
  const [statusFilter, setStatusFilter] = useState<string>(
    route?.active === undefined ? '' : route.active ? 'true' : 'false'
  );
  const [pageSize, setPageSize] = useState<number>(10);

  // Modals state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showVariablesModal, setShowVariablesModal] = useState(false);
  const [variablesModalType, setVariablesModalType] = useState<TemplateType>('DEPOSIT_CONTRACT');
  const [replacingTemplate, setReplacingTemplate] = useState<DocumentTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [localHistoryTemplateId, setLocalHistoryTemplateId] = useState<string | null>(null);
  const historyTemplateId = route ? route.detailId : localHistoryTemplateId;

  // Action loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const activeParam =
        statusFilter === 'true' ? true : statusFilter === 'false' ? false : undefined;
      const typeParam = activeTab || undefined;
      const keywordParam = searchKeyword.trim() || undefined;

      const data = await documentTemplateApi.getTemplates({
        type: typeParam,
        active: activeParam,
        keyword: keywordParam,
      });
      setTemplates(data);
    } catch (err: unknown) {
      if (err instanceof DocumentTemplateApiError) {
        if (err.status === 401 && onSessionExpired) {
          onSessionExpired(err.message);
          return;
        }
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Không thể nạp danh sách mẫu tài liệu. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, statusFilter, searchKeyword, onSessionExpired]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const [previousRoute, setPreviousRoute] = useState(route);
  if (route !== previousRoute) {
    setPreviousRoute(route);
    if (route) {
      setActiveTab(route.type === 'ALL' ? '' : route.type ?? 'DEPOSIT_CONTRACT');
      setStatusFilter(route.active === undefined ? '' : String(route.active));
      setSearchKeyword(route.keyword ?? '');
    }
  }

  const navigateHistory = (detailId?: string) => {
    if (route && onNavigate) {
      onNavigate(buildDocumentTemplateUrl({ ...route, detailId }));
    } else {
      setLocalHistoryTemplateId(detailId ?? null);
    }
  };

  const handleTabChange = (tabKey: TemplateType | '') => {
    setActiveTab(tabKey);
    if (onNavigate) {
      const targetUrl = buildDocumentTemplateUrl({
        type: tabKey || 'ALL',
        active: statusFilter === 'true' ? true : statusFilter === 'false' ? false : undefined,
        keyword: searchKeyword.trim() || undefined,
      });
      onNavigate(targetUrl);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onNavigate) {
      const targetUrl = buildDocumentTemplateUrl({
        type: activeTab || 'ALL',
        active: statusFilter === 'true' ? true : statusFilter === 'false' ? false : undefined,
        keyword: searchKeyword.trim() || undefined,
      });
      onNavigate(targetUrl);
    }
    void loadTemplates();
  };

  const handleToggleDefault = async (template: DocumentTemplate) => {
    if (template.isDefault) {
      // Already default
      return;
    }
    if (!template.active) {
      alert('Mẫu biểu đã ngừng hoạt động không thể đặt làm mặc định.');
      return;
    }

    if (!window.confirm(`Bạn có chắc muốn đặt "${template.name}" làm mẫu mặc định cho loại "${template.typeDisplay}"?`)) {
      return;
    }

    setActionLoadingId(template.id);
    try {
      await documentTemplateApi.setDefault(template.id);
      showToast(`Đã đặt "${template.name}" làm mẫu mặc định.`);
      void loadTemplates();
    } catch (err: unknown) {
      if (err instanceof DocumentTemplateApiError) {
        alert(err.message);
      } else {
        alert('Không thể đặt làm mẫu mặc định.');
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleActive = async (template: DocumentTemplate) => {
    const actionName = template.active ? 'ngừng sử dụng' : 'kích hoạt lại';
    if (!window.confirm(`Bạn có chắc muốn ${actionName} mẫu "${template.name}"?`)) {
      return;
    }

    setActionLoadingId(template.id);
    try {
      if (template.active) {
        await documentTemplateApi.deactivate(template.id);
        showToast(`Đã ngừng sử dụng mẫu "${template.name}".`);
      } else {
        await documentTemplateApi.activate(template.id);
        showToast(`Đã kích hoạt lại mẫu "${template.name}".`);
      }
      void loadTemplates();
    } catch (err: unknown) {
      if (err instanceof DocumentTemplateApiError) {
        alert(err.message);
      } else {
        alert(`Thao tác ${actionName} không thành công.`);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDownloadCurrent = async (template: DocumentTemplate) => {
    try {
      await documentTemplateApi.downloadTemplate(template.id);
    } catch (err) {
      console.error('Download error:', err);
      alert('Không thể tải tệp mẫu hiện tại.');
    }
  };

  // Generate neat code format like MDC005577 in reference image
  const formatTemplateCode = (template: DocumentTemplate) => {
    const prefixMap: Record<TemplateType, string> = {
      DEPOSIT_CONTRACT: 'MDC',
      RENTAL_CONTRACT: 'MHT',
      HANDOVER: 'MBG',
      INVOICE: 'MHD',
      RECEIPT: 'MPT',
      DISBURSEMENT: 'MPC',
    };
    const prefix = prefixMap[template.type] || 'TPL';
    const cleanId = template.id.replace(/-/g, '').substring(0, 6).toUpperCase();
    return `${prefix}${cleanId}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="templates-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="template-toast" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

        {/* Heading matching other pages */}
        <div className="contract-page-heading">
          <div>
            <h1>Mẫu biểu</h1>
            <p>Quản lý mẫu hợp đồng, biên bản bàn giao, hóa đơn và phiếu thu chi.</p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="contract-action-btn"
              onClick={() => {
                setVariablesModalType(activeTab || 'DEPOSIT_CONTRACT');
                setShowVariablesModal(true);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              Tra cứu mã biến
            </button>
            <button
              type="button"
              className="contract-action-btn btn-primary"
              onClick={() => setShowUploadModal(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Tải lên mẫu mới
            </button>
          </div>
        </div>

          {/* Category Tabs matching contracts-tabs */}
          <div className="contracts-tabs">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`contracts-tab-btn ${activeTab === tab.key ? 'is-active' : ''}`}
                onClick={() => handleTabChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Error alert */}
          {errorMessage && (
              <div className="error-banner" style={{ marginBottom: '16px' }} role="alert">
                {errorMessage}
              </div>
      )}

                    {/* Filter bar */}
                    <form onSubmit={handleSearchSubmit} className="contract-filter-bar">
                      <input
                        type="text"
                        className="contract-search-input"
                        placeholder="Tìm theo mã mẫu, tên mẫu hoặc ghi chú..."
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                      />

                  <select
                    className="contract-select"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      if (onNavigate) {
                        const targetUrl = buildDocumentTemplateUrl({
                          type: activeTab || 'ALL',
                          active: e.target.value === 'true' ? true : e.target.value === 'false' ? false : undefined,
                          keyword: searchKeyword.trim() || undefined,
                        });
                        onNavigate(targetUrl);
                      }
                    }}
                  >
                    <option value="">-- Tất cả trạng thái --</option>
                    <option value="true">Đang sử dụng</option>
                    <option value="false">Ngừng sử dụng</option>
                  </select>

                    <button type="submit" className="contract-action-btn">
                      Tìm kiếm
                    </button>

                {searchKeyword && (
                  <button
                    type="button"
                    className="contract-action-btn"
                    onClick={() => {
                      setSearchKeyword('');
                      if (onNavigate) {
                        onNavigate(buildDocumentTemplateUrl({
                          type: activeTab || 'ALL',
                          active: statusFilter === 'true' ? true : statusFilter === 'false' ? false : undefined,
                        }));
                      }
                    }}
                  >
                    Xóa tìm kiếm
                  </button>
                )}
              </form>

              {/* Main Content Card & Table */}
              <div className="contract-card">
                {loading ? (
                  <div className="templates-loading">
                    <div className="templates-spinner"></div>
                    <span>Đang tải danh sách mẫu biểu...</span>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="templates-empty-state">
                    <svg aria-hidden="true" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <h3>{searchKeyword || statusFilter ? 'Không tìm thấy mẫu biểu' : 'Danh mục chưa có mẫu biểu'}</h3>
                    <p>
                      {searchKeyword || statusFilter
                        ? 'Thử đổi từ khóa hoặc chọn trạng thái khác.'
                        : 'Tải lên mẫu đầu tiên để sử dụng cho danh mục này.'}
                    </p>
                    {!searchKeyword && !statusFilter && <button
                      type="button"
                      className="contract-action-btn btn-primary"
                      onClick={() => setShowUploadModal(true)}
                    >
                      + Tải lên mẫu mới
                    </button>}
                  </div>
                ) : (
                      <div className="contract-table-container">
                        <table className="contract-table">
                          <thead>
                            <tr>
                              <th style={{ width: '130px' }}>Mã mẫu</th>
                              <th>Tên mẫu biểu</th>
                              <th style={{ width: '160px' }}>Loại biểu mẫu</th>
                              <th style={{ width: '100px', textAlign: 'center' }}>Phiên bản</th>
                              <th style={{ width: '110px', textAlign: 'center' }}>Mặc định</th>
                              <th style={{ width: '130px', textAlign: 'center' }}>Trạng thái</th>
                              <th style={{ width: '120px', textAlign: 'center' }}>Xem mẫu</th>
                              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {templates.slice(0, pageSize).map((tpl) => (
                              <tr key={tpl.id}>
                                  {/* Mã */}
                                  <td>
                                    <span className="template-code-badge">{formatTemplateCode(tpl)}</span>
                                  </td>

                                  {/* Tên mẫu */}
                                  <td>
                                    <div style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{tpl.name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '2px' }}>
                                      {tpl.currentFileName} ({formatFileSize(tpl.currentFileSize)})
                                      {tpl.description && ` • ${tpl.description}`}
                                    </div>
                                  </td>

                                  {/* Loại biểu mẫu */}
                                  <td>
                                      <span className="template-type-badge">{tpl.typeDisplay}</span>
                                  </td>

                                  {/* Phiên bản */}
                                  <td style={{ textAlign: 'center' }}>
                                    <span className="template-version-badge">v{tpl.currentVersionNo}</span>
                                  </td>

                                {/* Mặc định - Switch Toggle styled with RentOps primary accent */}
                                <td style={{ textAlign: 'center' }}>
                                  <label className="template-switch" title={tpl.isDefault ? 'Mẫu mặc định hiện tại' : 'Bật để đặt làm mẫu mặc định'}>
                                    <input
                                      type="checkbox"
                                      checked={tpl.isDefault}
                                      disabled={actionLoadingId === tpl.id || !tpl.active}
                                      onChange={() => handleToggleDefault(tpl)}
                                    />
                                    <span className="template-slider"></span>
                                  </label>
                                </td>

                                  {/* Trạng thái */}
                                  <td style={{ textAlign: 'center' }}>
                                    {tpl.active ? (
                                      <span className="badge-status-active">Đang áp dụng</span>
                                    ) : (
                                      <span className="badge-status-inactive">Ngừng sử dụng</span>
                                    )}
                                  </td>

                                    {/* Xem mẫu PDF */}
                                    <td style={{ textAlign: 'center' }}>
                                      <button
                                        type="button"
                                        className="template-link-view"
                                        onClick={() => handleDownloadCurrent(tpl)}
                                        title={`Tải xuống ${tpl.currentFileName}`}
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                          <polyline points="14 2 14 8 20 8"></polyline>
                                          <line x1="16" y1="13" x2="8" y2="13"></line>
                                          <line x1="16" y1="17" x2="8" y2="17"></line>
                                        </svg>
                                        Xem mẫu
                                      </button>
                                    </td>

                                      {/* Thao tác */}
                                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                        <button
                                          type="button"
                                          className="contract-action-btn"
                                          style={{ marginRight: '6px' }}
                                          title="Chỉnh sửa tên và thông tin mẫu"
                                          onClick={() => setEditingTemplate(tpl)}
                                        >
                                          Sửa
                                        </button>

                                        <button
                                          type="button"
                                          className="contract-action-btn"
                                          style={{ marginRight: '6px' }}
                                          title="Tải lên tệp mẫu mới (tạo phiên bản tiếp theo)"
                                          onClick={() => setReplacingTemplate(tpl)}
                                        >
                                          Thay tệp
                                        </button>

                                        <button
                                          type="button"
                                          className="contract-action-btn"
                                          style={{ marginRight: '6px' }}
                                          title="Xem lịch sử các phiên bản"
                                          onClick={() => navigateHistory(tpl.id)}
                                        >
                                          Lịch sử
                                        </button>

                                        <button
                                          type="button"
                                          className="contract-action-btn"
                                          style={tpl.active ? { color: '#dc2626', borderColor: '#fca5a5' } : { color: '#166534', borderColor: '#bbf7d0' }}
                                          title={tpl.active ? 'Ngừng sử dụng mẫu biểu' : 'Kích hoạt lại'}
                                          disabled={actionLoadingId === tpl.id}
                                          onClick={() => handleToggleActive(tpl)}
                                        >
                                          {tpl.active ? 'Ngừng dùng' : 'Kích hoạt'}
                                        </button>
                                      </td>
                                    </tr>
                ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                                {/* Footer / Pagination matching other pages */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--color-rule)', flexWrap: 'wrap', gap: '12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Số bản ghi:</span>
                                    <select
                                      className="contract-select"
                                      style={{ height: '32px', padding: '0 8px', fontSize: '13px' }}
                                      value={pageSize}
                                      onChange={(e) => setPageSize(Number(e.target.value))}
                                    >
                                      <option value="10">10</option>
                                      <option value="20">20</option>
                                      <option value="50">50</option>
                                    </select>
                                    <span style={{ fontSize: '13px', color: 'var(--color-muted)', marginLeft: '6px' }}>
                                      Hiển thị {Math.min(pageSize, templates.length)} trên tổng số {templates.length} mẫu biểu
                                    </span>
                                  </div>

                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      <button
                                        type="button"
                                        className="contract-action-btn"
                                        disabled
                                      >
                                        Trước
                                      </button>
                                      <span style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}>
                                        Trang 1 / 1
                                      </span>
                                      <button
                                        type="button"
                                        className="contract-action-btn"
                                        disabled
                                      >
                                        Sau
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Modals */}
                                {showUploadModal && (
                                  <UploadTemplateModal
                                    onSuccess={() => {
                                      setShowUploadModal(false);
                                      showToast('Tải lên mẫu biểu thành công.');
                                      void loadTemplates();
                                    }}
                                    onClose={() => setShowUploadModal(false)}
                                  />
                                )}

                                {replacingTemplate && (
                                  <ReplaceVersionModal
                                    template={replacingTemplate}
                                    onSuccess={() => {
                                      setReplacingTemplate(null);
                                      showToast(`Đã thay thế tệp và tạo phiên bản mới cho "${replacingTemplate.name}".`);
                                      void loadTemplates();
                                    }}
                                    onClose={() => setReplacingTemplate(null)}
                                  />
                                )}

                                {editingTemplate && (
                                  <EditTemplateInfoModal
                                    template={editingTemplate}
                                    onSuccess={() => {
                                      setEditingTemplate(null);
                                      showToast('Cập nhật thông tin mẫu biểu thành công.');
                                      void loadTemplates();
                                    }}
                                    onClose={() => setEditingTemplate(null)}
                                  />
                                )}

                                {historyTemplateId && (
                                  <VersionHistoryModal
                                    key={historyTemplateId}
                                    templateId={historyTemplateId}
                                    onClose={() => navigateHistory()}
                                  />
                                )}

                                {showVariablesModal && (
                                  <SupportedVariablesModal
                                    initialType={variablesModalType}
                                    onClose={() => setShowVariablesModal(false)}
                                  />
                                )}
                              </div>
                              );
};
