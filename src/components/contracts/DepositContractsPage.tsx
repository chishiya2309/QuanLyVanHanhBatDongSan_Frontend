import React, { useState, useEffect, useCallback } from 'react';
import type { DepositContract, DepositContractRoute, DepositStatus } from '../../types/depositContract';
import { getDepositContracts, getDepositContractDetail, DepositContractApiError } from '../../services/depositContractApi';
import { buildDepositContractUrl } from '../../utils/depositContractNavigation';
import { DepositContractModal } from './DepositContractModal';
import { DepositContractDetailDrawer } from './DepositContractDetailDrawer';
import { CancelDepositModal } from './CancelDepositModal';
import { ConvertDepositToRentalModal } from './ConvertDepositToRentalModal';
import type { RentalContract } from '../../types/rentalContract';
import './contracts.css';

interface DepositContractsPageProps {
  route: DepositContractRoute;
  onNavigate: (url: string) => void;
  onSessionExpired: () => void;
}

const renderStatusBadge = (status: DepositStatus) => {
  switch (status) {
    case 'RESERVED':
      return <span className="badge-status-reserved">Đang giữ chỗ</span>;
    case 'DRAFT':
      return <span className="badge-status-draft">Nháp</span>;
    case 'CONVERTED':
      return <span className="badge-status-converted">Đã chuyển thuê</span>;
    case 'CANCELLED':
      return <span className="badge-status-cancelled">Đã hủy</span>;
    default:
      return <span>{status}</span>;
  }
};

export const DepositContractsPage: React.FC<DepositContractsPageProps> = ({
  route,
  onNavigate,
  onSessionExpired,
}) => {
  const [contracts, setContracts] = useState<DepositContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [keyword, setKeyword] = useState(route.keyword || '');
  const [statusFilter, setStatusFilter] = useState<DepositStatus | ''>(route.status || '');
  const currentPage = route.page || 0;

  const [modalOpen, setModalOpen] = useState(Boolean(route.create || route.editId));
  const [contractToEdit, setContractToEdit] = useState<DepositContract | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(Boolean(route.detailId));
  const [detailContract, setDetailContract] = useState<DepositContract | null>(null);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [contractToCancel, setContractToCancel] = useState<DepositContract | null>(null);

  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [contractToConvert, setContractToConvert] = useState<DepositContract | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch contracts
  const loadContracts = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await getDepositContracts({
        keyword: keyword.trim() || undefined,
        status: statusFilter || undefined,
        page: currentPage,
        size: 15,
      });
      setContracts(res.content);
      setTotalPages(res.totalPages);
      setTotalElements(res.totalElements);
    } catch (err) {
      if (err instanceof DepositContractApiError && err.status === 401) {
        onSessionExpired();
      } else {
        const msg = err instanceof Error ? err.message : 'Lỗi khi tải danh sách hợp đồng đặt cọc';
        setLoadError(msg);
        console.error('Lỗi khi tải danh sách hợp đồng đặt cọc:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [keyword, statusFilter, currentPage, onSessionExpired]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  // Sync route detailId
  useEffect(() => {
    if (route.detailId) {
      getDepositContractDetail(route.detailId)
        .then((data) => {
          setDetailContract(data);
          setDrawerOpen(true);
        })
        .catch((err) => {
          if (err instanceof DepositContractApiError && err.status === 401) {
            onSessionExpired();
          }
        });
    } else {
      setDrawerOpen(false);
      setDetailContract(null);
    }
  }, [route.detailId, onSessionExpired]);

  // Sync route editId
  useEffect(() => {
    if (route.editId) {
      getDepositContractDetail(route.editId)
        .then((data) => {
          setContractToEdit(data);
          setModalOpen(true);
        })
        .catch((err) => {
          if (err instanceof DepositContractApiError && err.status === 401) {
            onSessionExpired();
          }
        });
    } else if (route.create) {
      setContractToEdit(null);
      setModalOpen(true);
    } else {
      setModalOpen(false);
      setContractToEdit(null);
    }
  }, [route.editId, route.create, onSessionExpired]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate(buildDepositContractUrl({
      ...route,
      keyword: keyword.trim() || undefined,
      status: statusFilter || undefined,
      page: 0,
    }));
  };

  const handleStatusChange = (newStatus: string) => {
    const val = (newStatus as DepositStatus) || undefined;
    setStatusFilter(val || '');
    onNavigate(buildDepositContractUrl({
      ...route,
      status: val,
      page: 0,
    }));
  };

  const handleOpenCreateModal = () => {
    onNavigate(buildDepositContractUrl({ ...route, create: true, editId: undefined, detailId: undefined }));
  };

  const handleCloseModal = () => {
    onNavigate(buildDepositContractUrl({ ...route, create: undefined, editId: undefined }));
  };

  const handleOpenDetail = (c: DepositContract) => {
    onNavigate(buildDepositContractUrl({ ...route, detailId: c.id, create: undefined, editId: undefined }));
  };

  const handleCloseDetail = () => {
    onNavigate(buildDepositContractUrl({ ...route, detailId: undefined }));
  };

  const handleOpenEdit = (c: DepositContract) => {
    onNavigate(buildDepositContractUrl({ ...route, editId: c.id, create: undefined, detailId: undefined }));
  };

  const handleOpenCancel = (c: DepositContract) => {
    setContractToCancel(c);
    setCancelModalOpen(true);
  };

  const handleCloseCancel = () => {
    setCancelModalOpen(false);
    setContractToCancel(null);
  };

  const handleOpenConvert = (c: DepositContract) => {
    setContractToConvert(c);
    setConvertModalOpen(true);
  };

  const handleCloseConvert = () => {
    setConvertModalOpen(false);
    setContractToConvert(null);
  };

  const handleConvertSuccess = (rental: RentalContract) => {
    setSuccessMessage(
      `Chuyển hợp đồng đặt cọc sang hợp đồng thuê ${rental.contractNumber} thành công! Phòng đã chuyển sang trạng thái Đang thuê (OCCUPIED).`
    );
    loadContracts();
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  const handleCancelSuccess = (cancelled: DepositContract) => {
    setSuccessMessage(
      cancelled.roomId
        ? `Hủy hợp đồng đặt cọc ${cancelled.contractNumber} thành công, phòng đã chuyển về trạng thái Đang trống!`
        : `Hủy hợp đồng đặt cọc ${cancelled.contractNumber} thành công!`
    );
    loadContracts();
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  const handleSaveSuccess = (saved: DepositContract) => {
    setSuccessMessage(
      contractToEdit
        ? `Cập nhật hợp đồng ${saved.contractNumber} thành công!`
        : `Tạo hợp đồng đặt cọc ${saved.contractNumber} thành công!`
    );
    loadContracts();
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  return (
    <div className="contracts-page">
      {/* Tabs navigation between Deposit Contracts & Rental Contracts */}
      <div className="contracts-tabs">
        <button
          type="button"
          className="contracts-tab-btn is-active"
          aria-current="page"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          Hợp đồng đặt cọc
        </button>
        <button
          type="button"
          className="contracts-tab-btn"
          onClick={() => onNavigate('/rental-contracts')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          Hợp đồng thuê
        </button>
      </div>

      {/* Header */}
      <div className="contract-page-heading">
        <div>
          <h1>Hợp đồng đặt cọc</h1>
          <p>Lập hợp đồng giữ chỗ phòng cho khách thuê, tự động đồng bộ trạng thái phòng sang RESERVED</p>
        </div>

        <button
          type="button"
          className="contract-action-btn btn-primary"
          onClick={handleOpenCreateModal}
          style={{ padding: '8px 16px', fontWeight: 600 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Tạo hợp đồng đặt cọc
        </button>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="success-banner" style={{ marginBottom: '16px' }}>
          {successMessage}
        </div>
      )}

      {/* Load error banner */}
      {loadError && (
        <div className="error-banner" style={{ marginBottom: '16px' }}>
          {loadError}
        </div>
      )}

      {/* Filter bar */}
      <form onSubmit={handleSearchSubmit} className="contract-filter-bar">
        <input
          type="text"
          className="contract-search-input"
          placeholder="Tìm theo mã HĐ, tên khách, số điện thoại, mã phòng..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />

        <select
          className="contract-select"
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <option value="">-- Tất cả trạng thái --</option>
          <option value="RESERVED">Đang giữ chỗ (RESERVED)</option>
          <option value="DRAFT">Nháp (DRAFT)</option>
          <option value="CONVERTED">Đã chuyển thuê (CONVERTED)</option>
          <option value="CANCELLED">Đã hủy (CANCELLED)</option>
        </select>

        <button type="submit" className="contract-action-btn" style={{ height: '38px' }}>
          Tìm kiếm
        </button>

        {(keyword || statusFilter) && (
          <button
            type="button"
            className="contract-action-btn"
            style={{ height: '38px', color: 'var(--color-muted)' }}
            onClick={() => {
              setKeyword('');
              setStatusFilter('');
              onNavigate(buildDepositContractUrl({ ...route, keyword: undefined, status: undefined, page: 0 }));
            }}
          >
            Xóa lọc
          </button>
        )}
      </form>

      {/* Table Card */}
      <div className="contract-card">
        <div className="contract-table-container">
          <table className="contract-table">
            <thead>
              <tr>
                <th>Mã hợp đồng</th>
                <th>Phòng cọc</th>
                <th>Khách thuê đại diện</th>
                <th>Tiền cọc yêu cầu</th>
                <th>Ngày cọc</th>
                <th>Ngày nhận dự kiến</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-muted)' }}>
                    Đang tải danh sách hợp đồng đặt cọc...
                  </td>
                </tr>
              ) : contracts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--color-muted)' }}>
                    <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '6px' }}>Không có hợp đồng đặt cọc nào</div>
                    <div style={{ fontSize: '13px' }}>Bấm nút "+ Tạo hợp đồng đặt cọc" ở góc trên để tạo hợp đồng giữ chỗ đầu tiên.</div>
                  </td>
                </tr>
              ) : (
                contracts.map((c) => {
                  const canEdit = c.status === 'DRAFT' || c.status === 'RESERVED';
                  return (
                    <tr key={c.id}>
                      <td>
                        <button
                          type="button"
                          className="contract-number-link"
                          onClick={() => handleOpenDetail(c)}
                        >
                          {c.contractNumber}
                        </button>
                      </td>
                      <td>
                        <strong>{c.roomCode}</strong> - {c.roomName}
                        <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{c.buildingName} - Tầng {c.floorLevel}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{c.customerName}</div>
                        {c.customerPhone && <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{c.customerPhone}</div>}
                      </td>
                      <td>
                        <span className="contract-amount">{c.amountRequired.toLocaleString('vi-VN')} đ</span>
                      </td>
                      <td>{c.reservedFrom}</td>
                      <td>{c.moveInDate}</td>
                      <td>{renderStatusBadge(c.status)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="contract-action-btn"
                          style={{ marginRight: '6px' }}
                          onClick={() => handleOpenDetail(c)}
                        >
                          Chi tiết
                        </button>
                        {c.status === 'RESERVED' && (
                          <button
                            type="button"
                            className="contract-action-btn"
                            style={{ color: 'var(--color-accent-primary)', borderColor: 'var(--color-rule)', fontWeight: 600, marginRight: '6px' }}
                            onClick={() => handleOpenConvert(c)}
                            title="Chuyển đặt cọc này thành hợp đồng thuê chính thức"
                          >
                            Chuyển HĐ thuê
                          </button>
                        )}
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              className="contract-action-btn"
                              style={{ marginRight: '6px' }}
                              onClick={() => handleOpenEdit(c)}
                            >
                              Chỉnh sửa
                            </button>
                            <button
                              type="button"
                              className="contract-action-btn"
                              style={{ color: 'var(--color-error)', borderColor: 'var(--color-error-ring)' }}
                              onClick={() => handleOpenCancel(c)}
                            >
                              Hủy cọc
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--color-rule)' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
              Hiển thị {contracts.length} trên tổng số {totalElements} hợp đồng
            </span>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="contract-action-btn"
                disabled={currentPage === 0}
                onClick={() => onNavigate(buildDepositContractUrl({ ...route, page: currentPage - 1 }))}
              >
                Trước
              </button>
              <span style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}>
                Trang {currentPage + 1} / {totalPages}
              </span>
              <button
                type="button"
                className="contract-action-btn"
                disabled={currentPage >= totalPages - 1}
                onClick={() => onNavigate(buildDepositContractUrl({ ...route, page: currentPage + 1 }))}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal tạo mới / sửa */}
      <DepositContractModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSaveSuccess}
        contractToEdit={contractToEdit}
      />

      {/* Drawer xem chi tiết */}
      <DepositContractDetailDrawer
        isOpen={drawerOpen}
        contract={detailContract}
        onClose={handleCloseDetail}
        onEdit={(c) => {
          handleCloseDetail();
          handleOpenEdit(c);
        }}
        onCancel={(c) => {
          handleCloseDetail();
          handleOpenCancel(c);
        }}
        onConvert={(c) => {
          handleCloseDetail();
          handleOpenConvert(c);
        }}
      />

      {/* Modal xác nhận hủy cọc (UC25) */}
      <CancelDepositModal
        isOpen={cancelModalOpen}
        contract={contractToCancel}
        onClose={handleCloseCancel}
        onSuccess={handleCancelSuccess}
        onSessionExpired={onSessionExpired}
      />

      {/* Modal chuyển đặt cọc thành hợp đồng thuê (UC26) */}
      <ConvertDepositToRentalModal
        isOpen={convertModalOpen}
        contract={contractToConvert}
        onClose={handleCloseConvert}
        onSuccess={handleConvertSuccess}
        onSessionExpired={onSessionExpired}
      />
    </div>
  );
};

