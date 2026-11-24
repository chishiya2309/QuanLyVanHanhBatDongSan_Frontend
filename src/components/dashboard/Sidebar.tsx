import { rentalProfileTitle } from '../../types/rentalProfile';
import React from 'react';

interface SidebarProps {
  showFundingSources?: boolean; fundingSourcesActive?: boolean; onNavigateFundingSources?: () => void;
  showRentalProfile?: boolean; rentalProfileActive?: boolean; onNavigateRentalProfile?: () => void;
  showProvisionalCharges?: boolean; provisionalChargesActive?: boolean; onNavigateProvisionalCharges?: () => void;
  invoiceLink?: { path: string; label: string; active: boolean };
  showMeterReadings?: boolean; meterReadingsActive?: boolean; onNavigateMeterReadings?: () => void;
  showPeriodUsages?: boolean; periodUsagesActive?: boolean; onNavigatePeriodUsages?: () => void;
  showServices?: boolean; servicesActive?: boolean; onNavigateServices?: () => void; mobileOpen?: boolean; markCurrent?: boolean;
  showHostAccounts?: boolean; hostAccountsActive?: boolean;
  showAssets?: boolean; assetsActive?: boolean; onNavigateAssets?: () => void;
  showProperties?: boolean; propertiesActive?: boolean; onNavigateProperties?: () => void;
  expenseBreakdownActive?: boolean; onNavigateExpenseBreakdown?: () => void;
  profitLossActive?: boolean; onNavigateProfitLoss?: () => void;
  financeActive?: boolean; onNavigateFinance?: () => void;
  occupancyAnalysisActive?: boolean; onNavigateOccupancyAnalysis?: () => void;
  occupancyActive?: boolean; onNavigateOccupancy?: () => void;
  expiringLeasesActive?: boolean; onNavigateExpiringLeases?: () => void;
  showRooms?: boolean; roomsActive?: boolean; onNavigateRooms?: () => void;
  showCustomers?: boolean; customersActive?: boolean; onNavigateCustomers?: () => void;
  showContracts?: boolean; contractsActive?: boolean; onNavigateContracts?: () => void;
  rentalContractsActive?: boolean; onNavigateRentalContracts?: () => void;
  showDocumentTemplates?: boolean; documentTemplatesActive?: boolean; onNavigateDocumentTemplates?: () => void;
  onNavigateOverview?: () => void; onNavigateHostAccounts?: () => void;
}
export const Sidebar: React.FC<SidebarProps> = ({
  showFundingSources = false, fundingSourcesActive = false, onNavigateFundingSources,
  showRentalProfile = false, rentalProfileActive = false, onNavigateRentalProfile,
  showProvisionalCharges = false, provisionalChargesActive = false, onNavigateProvisionalCharges,
  invoiceLink,
  showMeterReadings = false, meterReadingsActive = false, onNavigateMeterReadings,
  showPeriodUsages = false, periodUsagesActive = false, onNavigatePeriodUsages,
  showServices = false, servicesActive = false, onNavigateServices, mobileOpen = false, markCurrent = true,
  showHostAccounts = false,
  hostAccountsActive = false,
  showAssets = false,
  assetsActive = false,
  showProperties = false,
  propertiesActive = false,
  showRooms = false,
  expiringLeasesActive = false,
  onNavigateExpiringLeases,
  occupancyAnalysisActive = false,
  expenseBreakdownActive, onNavigateExpenseBreakdown,
  profitLossActive, onNavigateProfitLoss,
  financeActive,
  onNavigateFinance,
  onNavigateOccupancyAnalysis,
  occupancyActive = false,
  onNavigateOccupancy,
  roomsActive = false,
  showCustomers = false,
  customersActive = false,
  onNavigateCustomers,
  showContracts = false,
  contractsActive = false,
  rentalContractsActive = false,
  showDocumentTemplates = false,
  documentTemplatesActive = false,
  onNavigateDocumentTemplates,
  onNavigateContracts,
  onNavigateRentalContracts,
  onNavigateAssets,
  onNavigateProperties,
  onNavigateRooms,
  onNavigateOverview,
  onNavigateHostAccounts,
}) => {
  const isOverviewActive = !invoiceLink?.active && !rentalProfileActive && !fundingSourcesActive && !provisionalChargesActive && !meterReadingsActive && !periodUsagesActive && !hostAccountsActive && !assetsActive && !propertiesActive && !roomsActive && !financeActive && !profitLossActive && !occupancyAnalysisActive && !occupancyActive && !expiringLeasesActive && !servicesActive && !customersActive && !contractsActive && !rentalContractsActive && !documentTemplatesActive;
  return (
    <aside id="rentops-navigation" className={`dash-sidebar${mobileOpen ? ' is-mobile-open' : ''}`} aria-label="Thanh điều hướng chính">
      <div className="dash-nav-group">
        <span className="dash-nav-header">Vận hành</span>

        <button type="button" className={`dash-nav-item${isOverviewActive ? ' is-active' : ''}`} aria-current={isOverviewActive && markCurrent ? 'page' : undefined} onClick={onNavigateOverview}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Tổng quan</span>
        </button>

        {showProperties && (
          <button
            type="button"
            className={`dash-nav-item${propertiesActive ? ' is-active' : ''}`}
            aria-current={propertiesActive && markCurrent ? 'page' : undefined}
            onClick={onNavigateProperties}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
            </svg>
            <span>Cơ sở &amp; Tòa nhà</span>
          </button>
        )}

        {showRooms ? (
          <button
            type="button"
            className={`dash-nav-item${roomsActive ? ' is-active' : ''}`}
            aria-current={roomsActive && markCurrent ? 'page' : undefined}
            onClick={onNavigateRooms}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Mặt bằng &amp; Phòng</span>
          </button>
        ) : (
          <button type="button" className="dash-nav-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Phòng &amp; Căn hộ</span>
          </button>
        )}

        {showAssets && <button type="button" className={`dash-nav-item${assetsActive ? ' is-active' : ''}`} aria-current={assetsActive && markCurrent ? 'page' : undefined} onClick={onNavigateAssets}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 5V3h8v2M3 11h18M10 11v4h4v-4" /></svg>
          <span>Tài sản</span>
        </button>}

        {showCustomers ? (
          <button
            type="button"
            className={`dash-nav-item${customersActive ? ' is-active' : ''}`}
            aria-current={customersActive && markCurrent ? 'page' : undefined}
            onClick={onNavigateCustomers}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>Khách thuê</span>
          </button>
        ) : (
          <button type="button" className="dash-nav-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>Khách thuê</span>
          </button>
        )}

        {showContracts ? (
          <>
            <button
              type="button"
              className={`dash-nav-item${contractsActive ? ' is-active' : ''}`}
              aria-current={contractsActive ? 'page' : undefined}
              onClick={onNavigateContracts}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <span>Hợp đồng đặt cọc</span>
            </button>
            <button
              type="button"
              className={`dash-nav-item${rentalContractsActive ? ' is-active' : ''}`}
              aria-current={rentalContractsActive ? 'page' : undefined}
              onClick={onNavigateRentalContracts}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              <span>Hợp đồng thuê</span>
            </button>
          </>
        ) : (
          <button type="button" className="dash-nav-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>Hợp đồng đặt cọc</span>
          </button>
        )}

        <span className="dash-nav-header" style={{ marginTop: '12px' }}>Dịch vụ &amp; Tài chính</span>
        {showServices && <button type="button" className={`dash-nav-item${servicesActive ? ' is-active' : ''}`} aria-current={servicesActive && markCurrent ? 'page' : undefined} onClick={onNavigateServices}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 4h16v16H4zM4 10h16M10 4v16" /></svg><span>Danh mục dịch vụ</span>
        </button>}

        {showMeterReadings && <button type="button" className={`dash-nav-item${meterReadingsActive ? ' is-active' : ''}`} aria-current={meterReadingsActive && markCurrent ? 'page' : undefined} onClick={onNavigateMeterReadings}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h3" /></svg>
          <span>Ghi và kiểm tra chỉ số</span>
        </button>}

        {showPeriodUsages && <button type="button" className={`dash-nav-item${periodUsagesActive ? ' is-active' : ''}`} aria-current={periodUsagesActive && markCurrent ? 'page' : undefined} onClick={onNavigatePeriodUsages}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z" /></svg>
          <span>Số lượng, phí &amp; giảm trừ</span>
        </button>}

        {showFundingSources && <button type="button" className={`dash-nav-item${fundingSourcesActive ? ' is-active' : ''}`} aria-current={fundingSourcesActive && markCurrent ? 'page' : undefined} onClick={onNavigateFundingSources}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 10h18M4 10V7l8-4 8 4v3M5 10v9m7-9v9m7-9v9M3 21h18" /></svg><span>Quản lý nguồn tiền</span>
        </button>}

        {showRentalProfile && (
          <button type="button" className={`dash-nav-item rp-nav-item${rentalProfileActive ? ' is-active' : ''}`}
            aria-current={rentalProfileActive && markCurrent ? 'page' : undefined} onClick={onNavigateRentalProfile}>
            <span>{rentalProfileTitle}</span>
          </button>
        )}
        {showProvisionalCharges && <button type="button" className={`dash-nav-item pc-nav-item${provisionalChargesActive ? ' is-active' : ''}`} aria-current={provisionalChargesActive && markCurrent ? 'page' : undefined} onClick={onNavigateProvisionalCharges}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h3M14 15h2" /></svg>
          <span>Tạm tính dịch vụ</span>
        </button>}
        {invoiceLink && <a href={invoiceLink.path} className={`dash-nav-item${invoiceLink.active ? ' is-active' : ''}`}
          aria-current={invoiceLink.active && markCurrent ? 'page' : undefined}>{invoiceLink.label}</a>}

        {onNavigateFinance && <button type="button" className={financeActive ? 'dash-nav-item is-active' : 'dash-nav-item'}
          aria-current={financeActive && markCurrent ? 'page' : undefined} onClick={onNavigateFinance}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <span>Thu chi &amp; Dòng tiền</span>
        </button>}
        {onNavigateExpenseBreakdown && <button type="button" className={expenseBreakdownActive ? 'dash-nav-item is-active' : 'dash-nav-item'}
          aria-current={expenseBreakdownActive && markCurrent ? 'page' : undefined} onClick={onNavigateExpenseBreakdown}>
          Cơ cấu chi phí
        </button>}
        {onNavigateProfitLoss && <button type="button" className={profitLossActive ? 'dash-nav-item is-active' : 'dash-nav-item'}
          aria-current={profitLossActive && markCurrent ? 'page' : undefined} onClick={onNavigateProfitLoss}>
          <span>Doanh thu &amp; Lời lỗ</span>
        </button>}
        {onNavigateExpiringLeases && (
          <button type="button" className={`dash-nav-item${expiringLeasesActive ? ' is-active' : ''}`}
            aria-current={expiringLeasesActive && markCurrent ? 'page' : undefined} onClick={onNavigateExpiringLeases}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>
            <span>Phòng sắp trống</span>
          </button>
        )}
        {onNavigateOccupancyAnalysis && (
          <button type="button" className={occupancyAnalysisActive ? 'dash-nav-item is-active' : 'dash-nav-item'}
            aria-current={occupancyAnalysisActive && markCurrent ? 'page' : undefined} onClick={onNavigateOccupancyAnalysis}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 5v14h16M8 15v-4m5 4V7m5 8V9" /></svg>
            <span>Tỷ lệ lấp đầy</span>
          </button>
        )}
        {onNavigateOccupancy && (
          <button type="button" className={`dash-nav-item${occupancyActive ? ' is-active' : ''}`}
            aria-current={occupancyActive && markCurrent ? 'page' : undefined} onClick={onNavigateOccupancy}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 5v14h16M8 14h9M8 9h12" /></svg>
            <span>Phân tích phòng trống</span>
          </button>
        )}

        <button type="button" className="dash-nav-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>Cấu hình hệ thống</span>
        </button>
        {showDocumentTemplates && (
          <button
            type="button"
            className={`dash-nav-item${documentTemplatesActive ? ' is-active' : ''}`}
            aria-current={documentTemplatesActive && markCurrent ? 'page' : undefined}
            onClick={onNavigateDocumentTemplates}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>Mẫu biểu</span>
          </button>
        )}
        {showHostAccounts && <>
          <span className="dash-nav-header">Tài khoản</span>
          <button type="button" className={`dash-nav-item${hostAccountsActive ? ' is-active' : ''}`} aria-current={hostAccountsActive && markCurrent ? 'page' : undefined} onClick={onNavigateHostAccounts}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="10" r="2" /><path d="M5 17v-1a3 3 0 0 1 6 0v1m3-7h4m-4 4h4" /></svg>
            <span>Tài khoản Host</span>
          </button>
        </>}
      </div>
        {!invoiceLink?.active && !rentalProfileActive && !fundingSourcesActive && !provisionalChargesActive && !hostAccountsActive && !assetsActive && !propertiesActive && !roomsActive && !financeActive && !profitLossActive && !occupancyAnalysisActive && !occupancyActive && !expiringLeasesActive && !servicesActive && !customersActive && !contractsActive && !rentalContractsActive && !documentTemplatesActive && (
      <div className="dash-sidebar-footer">
        <div className="system-status-box">
          <div>
            <span className="system-status-dot" aria-hidden="true" />
            <strong style={{ color: 'var(--color-ink)' }}>RentOps v2.4</strong>
          </div>
          <div style={{ marginTop: '2px' }}>Dữ liệu đồng bộ lúc 14:30</div>
        </div>
      </div>
      )}
    </aside>
  );
};
