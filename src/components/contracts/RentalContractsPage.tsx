import React, { useState, useEffect, useCallback } from 'react';
import type {
  RentalContract,
  RentalContractRoute,
  RentalStatus,
  ExpiringRentalContract,
} from '../../types/rentalContract';
import {
  rentalContractApi,
  RentalContractApiError,
} from '../../services/rentalContractApi';
import { buildRentalContractUrl } from '../../utils/rentalContractNavigation';
import { CreateRentalContractModal } from './CreateRentalContractModal';
import { UpdateRentalContractModal } from './UpdateRentalContractModal';
import { ExtendRentalContractModal } from './ExtendRentalContractModal';
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

const renderUrgencyBadge = (level: string, days: number) => {
  let badgeClass = 'urgency-info';
  if (level === 'CRITICAL' || days <= 7) {
    badgeClass = 'urgency-critical';
  } else if (level === 'WARNING' || days <= 15) {
    badgeClass = 'urgency-warning';
  }
  return (
    <span className={`urgency-badge ${badgeClass}`}>
      {days <= 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`}
    </span>
  );
};

export const RentalContractsPage: React.FC<RentalContractsPageProps> = ({
  route,
  onNavigate,
  onSessionExpired,
}) => {
  // Sub-tabs: 'all' or 'expiring' (UC28)
  const [activeSubtab, setActiveSubtab] = useState<'all' | 'expiring'>('all');

  // Main contracts list state
  const [contracts, setContracts] = useState<RentalContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Expiring contracts state (UC28)
  const [expiringContracts, setExpiringContracts] = useState<ExpiringRentalContract[]>([]);
  const [loadingExpiring, setLoadingExpiring] = useState(false);
  const [expiringThreshold, setExpiringThreshold] = useState<number>(30);
  const [expiringCount30, setExpiringCount30] = useState<number>(0);
  const [expiringPage, setExpiringPage] = useState<number>(0);
  const [expiringTotalPages, setExpiringTotalPages] = useState<number>(0);
  const [expiringTotalElements, setExpiringTotalElements] = useState<number>(0);

  // Search & Filter state
  const [keyword, setKeyword] = useState(route.keyword || '');
  const [statusFilter, setStatusFilter] = useState<RentalStatus | ''>(route.status || '');
  const [showAdvancedDateFilter, setShowAdvancedDateFilter] = useState(false);
  const [startDateFrom, setStartDateFrom] = useState('');
  const [startDateTo, setStartDateTo] = useState('');
  const [endDateFrom, setEndDateFrom] = useState('');
  const [endDateTo, setEndDateTo] = useState('');
  const currentPage = route.page || 0;

  // Modal & Drawer state
  const [createModalOpen, setCreateModalOpen] = useState(Boolean(route.create));
  const [editModalOpen, setEditModalOpen] = useState(Boolean(route.editId));
  const [contractToEdit, setContractToEdit] = useState<RentalContract | null>(null);

  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [contractToExtend, setContractToExtend] = useState<RentalContract | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(Boolean(route.detailId));
  const [detailContract, setDetailContract] = useState<RentalContract | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch expiring count for badge
  const fetchExpiringBadge = useCallback(async () => {
    try {
      const count = await rentalContractApi.countExpiringRentalContracts(30);
      setExpiringCount30(count);
    } catch {
      // Non-critical background count
    }
  }, []);

  // Fetch all contracts (Main Tab)
  const loadContracts = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await rentalContractApi.searchRentalContracts({
        keyword: keyword.trim() || undefined,
        status: statusFilter || undefined,
        startDateFrom: startDateFrom || undefined,
        startDateTo: startDateTo || undefined,
        endDateFrom: endDateFrom || undefined,
        endDateTo: endDateTo || undefined,
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
  }, [keyword, statusFilter, startDateFrom, startDateTo, endDateFrom, endDateTo, currentPage, onSessionExpired]);

  // Fetch expiring contracts (Expiring Tab - UC28)
  const loadExpiringContracts = useCallback(async () => {
    try {
      setLoadingExpiring(true);
      setLoadError(null);
      const res = await rentalContractApi.getExpiringRentalContracts(expiringThreshold, expiringPage, 15);
      setExpiringContracts(res.content || []);
      setExpiringTotalPages(res.totalPages || 0);
      setExpiringTotalElements(res.totalElements || 0);
    } catch (err) {
      if (err instanceof RentalContractApiError && err.status === 401) {
        onSessionExpired();
      } else {
        const msg = err instanceof Error ? err.message : 'Lỗi khi tải danh sách hợp đồng sắp hết hạn';
        setLoadError(msg);
        console.error('Lỗi khi tải danh sách hợp đồng sắp hết hạn:', err);
      }
    } finally {
      setLoadingExpiring(false);
    }
  }, [expiringThreshold, expiringPage, onSessionExpired]);

  useEffect(() => {
    if (activeSubtab === 'all') {
      loadContracts();
    } else {
      loadExpiringContracts();
    }
    fetchExpiringBadge();
  }, [activeSubtab, loadContracts, loadExpiringContracts, fetchExpiringBadge]);

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

  const handleOpenDetail = (contract: { id: string }) => {
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
    fetchExpiringBadge();
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  const handleUpdateSuccess = (saved: RentalContract) => {
    setSuccessMessage(`Cập nhật hợp đồng thuê ${saved.contractNumber} thành công!`);
    loadContracts();
    fetchExpiringBadge();
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  const handleOpenExtend = async (contract: { id: string }) => {
    try {
      const full = await rentalContractApi.getRentalContractDetail(contract.id);
      setContractToExtend(full);
      setExtendModalOpen(true);
    } catch {
      setLoadError('Không thể tải thông tin hợp đồng để gia hạn');
    }
  };

  const handleExtendSuccess = (saved: RentalContract) => {
    setSuccessMessage(`Gia hạn hợp đồng ${saved.contractNumber} thành công! Ngày kết thúc mới: ${saved.endDate}`);
    loadContracts();
    fetchExpiringBadge();
    if (activeSubtab === 'expiring') {
      loadExpiringContracts();
    }
    if (detailContract && detailContract.id === saved.id) {
      setDetailContract(saved);
    }
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  return (
    <div className="contracts-page">
      {/* Top tabs navigation between Deposit Contracts & Rental Contracts */}
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
          <p>Quản lý hợp đồng thuê phòng, điều khoản chu kỳ thanh toán và theo dõi hợp đồng sắp hết hạn</p>
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

      {/* Sub-tabs for UC28: "Tất cả hợp đồng" vs "Hợp đồng sắp hết hạn" */}
      <div className="contracts-subtabs">
        <button
          type="button"
          className={`subtab-btn ${activeSubtab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('all')}
        >
          Tất cả hợp đồng
        </button>
        <button
          type="button"
          className={`subtab-btn ${activeSubtab === 'expiring' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('expiring')}
        >
          Hợp đồng sắp hết hạn
          {expiringCount30 > 0 && (
            <span className="subtab-badge" title={`${expiringCount30} hợp đồng sắp hết hạn trong 30 ngày`}>
              {expiringCount30}
            </span>
          )}
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

      {/* Tab 1: Tất cả hợp đồng */}
      {activeSubtab === 'all' && (
        <>
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

            <button
              type="button"
              className="contract-action-btn"
              onClick={() => setShowAdvancedDateFilter(!showAdvancedDateFilter)}
              style={{ background: showAdvancedDateFilter ? '#f3f4f6' : 'white' }}
            >
              {showAdvancedDateFilter ? 'Ẩn lọc ngày ▴' : 'Lọc theo ngày ▾'}
            </button>

            <button type="submit" className="contract-action-btn btn-secondary">
              Tìm kiếm
            </button>
          </form>

          {/* Advanced Date Filters Drawer / Panel */}
          {showAdvancedDateFilter && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '14px 16px',
                marginBottom: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <div className="contract-date-filter">
                <span>Bắt đầu từ:</span>
                <input
                  type="date"
                  value={startDateFrom}
                  onChange={(e) => setStartDateFrom(e.target.value)}
                />
              </div>
              <div className="contract-date-filter">
                <span>đến:</span>
                <input
                  type="date"
                  value={startDateTo}
                  onChange={(e) => setStartDateTo(e.target.value)}
                />
              </div>
              <div className="contract-date-filter">
                <span>Kết thúc từ:</span>
                <input
                  type="date"
                  value={endDateFrom}
                  onChange={(e) => setEndDateFrom(e.target.value)}
                />
              </div>
              <div className="contract-date-filter">
                <span>đến:</span>
                <input
                  type="date"
                  value={endDateTo}
                  onChange={(e) => setEndDateTo(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="contract-action-btn"
                  onClick={() => {
                    setStartDateFrom('');
                    setStartDateTo('');
                    setEndDateFrom('');
                    setEndDateTo('');
                  }}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  Xóa lọc ngày
                </button>
                <button
                  type="button"
                  className="contract-action-btn btn-primary"
                  onClick={() => loadContracts()}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  Áp dụng
                </button>
              </div>
            </div>
          )}

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

                          {c.status === 'ACTIVE' && (
                            <button
                              type="button"
                              className="contract-action-btn"
                              style={{
                                padding: '4px 10px',
                                fontSize: '12px',
                                color: '#16a34a',
                                borderColor: '#bbf7d0',
                                background: '#f0fdf4',
                                marginRight: '6px',
                                fontWeight: 500,
                              }}
                              onClick={() => handleOpenExtend(c)}
                              title="Gia hạn hợp đồng thuê (UC29)"
                            >
                              Gia hạn
                            </button>
                          )}

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
        </>
      )}

      {/* Tab 2: Hợp đồng sắp hết hạn (UC28 - Luồng theo dõi hợp đồng sắp hết hạn) */}
      {activeSubtab === 'expiring' && (
        <>
          {/* Threshold Filter Bar */}
          <div className="contract-filter-bar" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
                Ngưỡng thời gian cảnh báo hết hạn:
              </span>
              <select
                className="contract-select"
                value={expiringThreshold}
                onChange={(e) => {
                  setExpiringThreshold(Number(e.target.value));
                  setExpiringPage(0);
                }}
                style={{ minWidth: '160px' }}
              >
                <option value={7}>Trong vòng 7 ngày tới (Khẩn cấp)</option>
                <option value={15}>Trong vòng 15 ngày tới (Cảnh báo)</option>
                <option value={30}>Trong vòng 30 ngày tới (Thông tin)</option>
                <option value={60}>Trong vòng 60 ngày tới (Mở rộng)</option>
              </select>
            </div>

            <div style={{ fontSize: '13px', color: '#64748b' }}>
              Tìm thấy <strong style={{ color: '#0f172a' }}>{expiringTotalElements}</strong> hợp đồng sắp hết hạn
            </div>
          </div>

          {/* Expiring Contracts Table */}
          <div className="contract-card">
            <div className="contract-table-container">
              <table className="contract-table">
                <thead>
                  <tr>
                    <th>Mã hợp đồng</th>
                    <th>Phòng thuê</th>
                    <th>Khách thuê đại diện</th>
                    <th>Ngày kết thúc</th>
                    <th>Thời gian còn lại</th>
                    <th>Giá thuê hiện tại</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingExpiring ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>
                        <div style={{ color: 'var(--color-muted)' }}>Đang tải danh sách hợp đồng sắp hết hạn...</div>
                      </td>
                    </tr>
                  ) : expiringContracts.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>
                        <div style={{ color: '#059669', fontSize: '14px', fontWeight: 500 }}>
                          ✓ Tuyệt vời! Không có hợp đồng nào hết hạn trong vòng {expiringThreshold} ngày tới.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    expiringContracts.map((c) => (
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
                            <strong>{c.roomCode || 'Chưa xếp'}</strong>
                            {c.roomName ? ` - ${c.roomName}` : ''}
                          </div>
                          {c.buildingName && (
                            <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                              {c.buildingName}
                            </div>
                          )}
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
                          <strong style={{ color: '#111827' }}>{c.endDate}</strong>
                        </td>
                        <td>{renderUrgencyBadge(c.urgencyLevel, c.daysRemaining)}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#047857' }}>
                            {c.currentRent !== undefined && c.currentRent !== null
                              ? `${Number(c.currentRent).toLocaleString('vi-VN')} đ`
                              : '-'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="contract-action-btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '12px', marginRight: '6px' }}
                            onClick={() => handleOpenDetail(c)}
                          >
                            Chi tiết
                          </button>
                          <button
                            type="button"
                            className="contract-action-btn"
                            style={{
                              padding: '4px 10px',
                              fontSize: '12px',
                              color: '#16a34a',
                              borderColor: '#bbf7d0',
                              background: '#f0fdf4',
                              fontWeight: 500,
                            }}
                            onClick={() => handleOpenExtend(c)}
                            title="Gia hạn hợp đồng thuê (UC29)"
                          >
                            Gia hạn
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination for Expiring Tab */}
            <div className="contract-pagination">
              <div style={{ color: 'var(--color-muted)', fontSize: '13px' }}>
                Hiển thị {expiringContracts.length} / {expiringTotalElements} hợp đồng
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="contract-action-btn btn-secondary"
                  disabled={expiringPage <= 0}
                  onClick={() => setExpiringPage((prev) => Math.max(0, prev - 1))}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  &larr; Trang trước
                </button>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px', fontSize: '13px' }}>
                  Trang {expiringPage + 1} / {Math.max(1, expiringTotalPages)}
                </span>
                <button
                  type="button"
                  className="contract-action-btn btn-secondary"
                  disabled={expiringTotalPages === 0 || expiringPage >= expiringTotalPages - 1}
                  onClick={() => setExpiringPage((prev) => prev + 1)}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  Trang sau &rarr;
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
        onExtend={(contract) => {
          handleCloseDrawer();
          handleOpenExtend(contract);
        }}
        contract={detailContract}
      />

      {/* Modal Gia hạn hợp đồng thuê (UC29) */}
      <ExtendRentalContractModal
        isOpen={extendModalOpen}
        onClose={() => {
          setExtendModalOpen(false);
          setContractToExtend(null);
        }}
        onSuccess={handleExtendSuccess}
        contract={contractToExtend}
        onSessionExpired={onSessionExpired}
      />
    </div>
  );
};
