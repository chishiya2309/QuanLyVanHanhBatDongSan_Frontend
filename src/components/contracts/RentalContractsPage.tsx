import React, { useState, useEffect, useCallback } from 'react';
import type {
  RentalContract,
  RentalContractRoute,
  RentalStatus,
} from '../../types/rentalContract';
import {
  rentalContractApi,
  RentalContractApiError,
} from '../../services/rentalContractApi';
import { buildRentalContractUrl } from '../../utils/rentalContractNavigation';
import { CreateRentalContractModal } from './CreateRentalContractModal';
import { UpdateRentalContractModal } from './UpdateRentalContractModal';
import { RentalContractDetailDrawer } from './RentalContractDetailDrawer';
import './contracts.css';

interface RentalContractsPageProps {
  route: RentalContractRoute;
  onNavigate: (url: string) => void;
  onSessionExpired: () => void;
}

const renderStatusBadge = (status: RentalStatus) => {
  switch (status) {
    case 'ACTIVE':
      return <span className="badge-status-active">Đang hiệu lực</span>;
    case 'DRAFT':
      return <span className="badge-status-draft">Nháp</span>;
    case 'TERMINATED':
      return <span className="badge-status-terminated">Đã thanh lý</span>;
    default:
      return <span>{status}</span>;
  }
};

export const RentalContractsPage: React.FC<RentalContractsPageProps> = ({
  route,
  onNavigate,
  onSessionExpired,
}) => {
  const [contracts, setContracts] = useState<RentalContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [keyword, setKeyword] = useState(route.keyword || '');
  const [statusFilter, setStatusFilter] = useState<RentalStatus | ''>(route.status || '');
  const currentPage = route.page || 0;

  const [createModalOpen, setCreateModalOpen] = useState(Boolean(route.create));
  const [editModalOpen, setEditModalOpen] = useState(Boolean(route.editId));
  const [contractToEdit, setContractToEdit] = useState<RentalContract | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(Boolean(route.detailId));
  const [detailContract, setDetailContract] = useState<RentalContract | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch contracts
  const loadContracts = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await rentalContractApi.searchRentalContracts({
        keyword: keyword.trim() || undefined,
        status: statusFilter || undefined,
        page: currentPage,
        size: 15,
      });
      setContracts(res.content || []);
      setTotalPages(res.totalPages || 0);
      setTotalElements(res.totalElements || 0);
    } catch (err) {
      if (err instanceof RentalContractApiError && err.status === 401) {
        onSessionExpired();
      } else {
        const msg = err instanceof Error ? err.message : 'Lỗi khi tải danh sách hợp đồng thuê';
        setLoadError(msg);
        console.error('Lỗi khi tải danh sách hợp đồng thuê:', err);
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
      rentalContractApi
        .getRentalContractDetail(route.detailId)
        .then((data) => {
          setDetailContract(data);
          setDrawerOpen(true);
        })
        .catch((err) => {
          console.error('Không tìm thấy chi tiết hợp đồng thuê:', err);
          onNavigate(
            buildRentalContractUrl({
              ...route,
              detailId: undefined,
            })
          );
        });
    } else {
      setDrawerOpen(false);
      setDetailContract(null);
    }
  }, [route.detailId]);

  // Sync route editId
  useEffect(() => {
    if (route.editId) {
      rentalContractApi
        .getRentalContractDetail(route.editId)
        .then((data) => {
          setContractToEdit(data);
          setEditModalOpen(true);
        })
        .catch((err) => {
          console.error('Không thể tải hợp đồng để chỉnh sửa:', err);
          onNavigate(
            buildRentalContractUrl({
              ...route,
              editId: undefined,
            })
          );
        });
    } else {
      setEditModalOpen(false);
      setContractToEdit(null);
    }
  }, [route.editId]);

  // Sync route create
  useEffect(() => {
    setCreateModalOpen(Boolean(route.create));
  }, [route.create]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate(
      buildRentalContractUrl({
        ...route,
        keyword: keyword.trim() || undefined,
        status: statusFilter || undefined,
        page: 0,
      })
    );
  };

  const handleStatusChange = (val: string) => {
    const nextStatus = (val as RentalStatus) || undefined;
    setStatusFilter(val as RentalStatus | '');
    onNavigate(
      buildRentalContractUrl({
        ...route,
        status: nextStatus,
        page: 0,
      })
    );
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 0 || (totalPages > 0 && newPage >= totalPages)) return;
    onNavigate(
      buildRentalContractUrl({
        ...route,
        page: newPage,
      })
    );
  };

  const handleOpenCreateModal = () => {
    onNavigate(
      buildRentalContractUrl({
        ...route,
        create: true,
      })
    );
  };

  const handleCloseCreateModal = () => {
    onNavigate(
      buildRentalContractUrl({
        ...route,
        create: undefined,
      })
    );
  };

  const handleOpenDetail = (contract: RentalContract) => {
    onNavigate(
      buildRentalContractUrl({
        ...route,
        detailId: contract.id,
      })
    );
  };

  const handleCloseDrawer = () => {
    onNavigate(
      buildRentalContractUrl({
        ...route,
        detailId: undefined,
      })
    );
  };

  const handleOpenEdit = (contract: RentalContract) => {
    onNavigate(
      buildRentalContractUrl({
        ...route,
        editId: contract.id,
      })
    );
  };

  const handleCloseEditModal = () => {
    onNavigate(
      buildRentalContractUrl({
        ...route,
        editId: undefined,
      })
    );
  };

  const handleCreateSuccess = (saved: RentalContract) => {
    setSuccessMessage(
      `Lập hợp đồng thuê ${saved.contractNumber} thành công! Phòng đã được đồng bộ sang trạng thái ĐANG THUÊ (OCCUPIED).`
    );
    loadContracts();
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  const handleUpdateSuccess = (saved: RentalContract) => {
    setSuccessMessage(`Cập nhật hợp đồng thuê ${saved.contractNumber} thành công!`);
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
          className="contracts-tab-btn"
          onClick={() => onNavigate('/deposit-contracts')}
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
          className="contracts-tab-btn is-active"
          aria-current="page"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          Hợp đồng thuê
        </button>
      </div>

      {/* Heading */}
      <div className="contract-page-heading">
        <div>
          <h1>Hợp đồng thuê</h1>
          <p>Quản lý hợp đồng thuê phòng, điều khoản chu kỳ thanh toán và các lượt ở</p>
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
          Tạo hợp đồng thuê
        </button>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="success-banner" style={{ marginBottom: '16px' }} role="status">
          {successMessage}
        </div>
      )}

      {/* Error banner */}
      {loadError && (
        <div className="error-banner" style={{ marginBottom: '16px' }} role="alert">
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
          <option value="ACTIVE">Đang hiệu lực (ACTIVE)</option>
          <option value="DRAFT">Nháp (DRAFT)</option>
          <option value="TERMINATED">Đã thanh lý (TERMINATED)</option>
        </select>

        <button type="submit" className="contract-action-btn btn-secondary">
          Tìm kiếm
        </button>
      </form>

      {/* Table */}
      <div className="contract-card">
        <div className="contract-table-container">
          <table className="contract-table">
            <thead>
              <tr>
                <th>Mã hợp đồng</th>
                <th>Phòng thuê</th>
                <th>Khách thuê đại diện</th>
                <th>Giá thuê</th>
                <th>Tiền cọc cam kết</th>
                <th>Thời hạn thuê</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px' }}>
                    <div style={{ color: 'var(--color-muted)' }}>Đang tải danh sách hợp đồng thuê...</div>
                  </td>
                </tr>
              ) : contracts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ color: 'var(--color-muted)', fontSize: '14px' }}>
                      Không có hợp đồng thuê nào phù hợp với điều kiện tìm kiếm.
                    </div>
                  </td>
                </tr>
              ) : (
                contracts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong
                        style={{
                          color: 'var(--color-accent-primary, #b91c1c)',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleOpenDetail(c)}
                      >
                        {c.contractNumber}
                      </strong>
                    </td>
                    <td>
                      <div>
                        <strong>{c.currentRoomCode || 'Chưa xếp'}</strong>
                        {c.currentRoomName ? ` - ${c.currentRoomName}` : ''}
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong>{c.customerName}</strong>
                      </div>
                      {c.customerPhone && (
                        <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                          {c.customerPhone}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#047857' }}>
                        {c.currentRent !== undefined && c.currentRent !== null
                          ? `${Number(c.currentRent).toLocaleString('vi-VN')} đ`
                          : '-'}
                      </span>
                    </td>
                    <td>
                      <span>{Number(c.depositRequired ?? 0).toLocaleString('vi-VN')} đ</span>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px' }}>
                        {c.startDate} ~ {c.endDate}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                        Kỳ TT: {c.cycleMonths} tháng | Chốt ngày {c.billingAnchor}
                      </div>
                    </td>
                    <td>{renderStatusBadge(c.status)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="contract-action-btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px', marginRight: '6px' }}
                        onClick={() => handleOpenDetail(c)}
                      >
                        Chi tiết
                      </button>

                      {(c.status === 'ACTIVE' || c.status === 'DRAFT') && (
                        <button
                          type="button"
                          className="contract-action-btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => handleOpenEdit(c)}
                        >
                          Chỉnh sửa
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="contract-pagination">
          <div style={{ color: 'var(--color-muted)', fontSize: '13px' }}>
            Hiển thị {contracts.length} / {totalElements} hợp đồng
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="contract-action-btn btn-secondary"
              disabled={currentPage <= 0}
              onClick={() => handlePageChange(currentPage - 1)}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              &larr; Trang trước
            </button>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px', fontSize: '13px' }}>
              Trang {currentPage + 1} / {Math.max(1, totalPages)}
            </span>
            <button
              type="button"
              className="contract-action-btn btn-secondary"
              disabled={totalPages === 0 || currentPage >= totalPages - 1}
              onClick={() => handlePageChange(currentPage + 1)}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              Trang sau &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Modal Lập hợp đồng mới */}
      <CreateRentalContractModal
        isOpen={createModalOpen}
        onClose={handleCloseCreateModal}
        onSuccess={handleCreateSuccess}
        onSessionExpired={onSessionExpired}
      />

      {/* Modal Cập nhật hợp đồng */}
      <UpdateRentalContractModal
        isOpen={editModalOpen}
        onClose={handleCloseEditModal}
        onSuccess={handleUpdateSuccess}
        contract={contractToEdit}
        onSessionExpired={onSessionExpired}
      />

      {/* Drawer Chi tiết hợp đồng */}
      <RentalContractDetailDrawer
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        onEdit={(contract) => {
          handleCloseDrawer();
          handleOpenEdit(contract);
        }}
        contract={detailContract}
      />
    </div>
  );
};

