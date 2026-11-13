import React, { useState, useMemo, useEffect } from 'react';
import type { UserProfile, OverviewMetrics } from '../../types/dashboard';
import {
  mockMetrics,
  mockRevenueTrend,
  mockUrgentAlerts,
  mockAttentionRooms,
} from '../../mocks/dashboardMockData';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { QuickActionBar } from './QuickActionBar';
import { MetricSection } from './MetricSection';
import { RevenueCashflowChart } from './RevenueCashflowChart';
import { UrgentTasksList } from './UrgentTasksList';
import { PropertyStatusTable } from './PropertyStatusTable';
import './dashboard.css';

interface DashboardShellProps {
  showServices?: boolean; servicesActive?: boolean; onNavigateServices?: () => void;
  user: UserProfile;
  onLogout: () => void;
  onOpenProfile: () => void;
  children?: React.ReactNode;
  hostAccountsActive?: boolean;
  showHostAccounts?: boolean;
  assetsActive?: boolean;
  showAssets?: boolean;
  onNavigateAssets?: () => void;
  showProperties?: boolean;
  propertiesActive?: boolean;
  onNavigateProperties?: () => void;
  showRooms?: boolean;
  roomsActive?: boolean;
  onNavigateRooms?: () => void;
  showCustomers?: boolean;
  customersActive?: boolean;
  onNavigateCustomers?: () => void;
  showContracts?: boolean;
  contractsActive?: boolean;
  onNavigateContracts?: () => void;
  rentalContractsActive?: boolean;
  onNavigateRentalContracts?: () => void;
  onNavigateOverview?: () => void;
  onNavigateHostAccounts?: () => void;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  showServices = false, servicesActive = false, onNavigateServices,
  user,
  onLogout,
  onOpenProfile,
  children,
  hostAccountsActive = false,
  showHostAccounts = false,
  assetsActive = false,
  showAssets = false,
  onNavigateAssets,
  showProperties = false,
  propertiesActive = false,
  onNavigateProperties,
  showRooms = false,
  roomsActive = false,
  onNavigateRooms,
  showCustomers = false,
  customersActive = false,
  onNavigateCustomers,
  showContracts = false,
  contractsActive = false,
  rentalContractsActive = false,
  onNavigateContracts,
  onNavigateRentalContracts,
  onNavigateOverview,
  onNavigateHostAccounts,
}) => {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('prop_all');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [smallScreen, setSmallScreen] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1024px)').matches);
  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 1024px)');
    const changed = (event: MediaQueryListEvent) => setSmallScreen(event.matches);
    query?.addEventListener('change', changed);
    return () => query?.removeEventListener('change', changed);
  }, []);
  const mobileNavigate = (action?: () => void) => () => { setMobileOpen(false); action?.(); };
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Formatted Vietnamese Date
  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
  }, []);

  // Filter or scale data based on selected property
  const { currentMetrics, currentAlerts, currentRooms, selectedPropertyName } = useMemo(() => {
    const selectedProp = user.managedProperties.find((p) => p.id === selectedPropertyId);
    const propName = selectedProp ? selectedProp.name : 'Tất cả cơ sở';

    if (selectedPropertyId === 'prop_all') {
      return {
        currentMetrics: mockMetrics,
        currentAlerts: mockUrgentAlerts,
        currentRooms: mockAttentionRooms,
        selectedPropertyName: propName,
      };
    }

    if (selectedPropertyId === 'prop_sunrise') {
      const sunriseMetrics: OverviewMetrics = {
        occupancyRate: 93,
        totalRooms: 28,
        occupiedRooms: 26,
        vacantRooms: 2,
        monthlyRevenueActual: 88000000,
        monthlyRevenueExpected: 94000000,
        revenueGrowthMoM: 7.2,
        pendingIssuesCount: 2,
        urgentIssuesCount: 1,
        expiringContractsCount: 4,
        expiringDaysWindow: 30,
      };
      return {
        currentMetrics: sunriseMetrics,
        currentAlerts: mockUrgentAlerts.filter((a) => a.propertyName.includes('Sunrise')),
        currentRooms: mockAttentionRooms.filter((r) => r.propertyName.includes('Sunrise')),
        selectedPropertyName: propName,
      };
    }

    if (selectedPropertyId === 'prop_greenhouse') {
      const greenMetrics: OverviewMetrics = {
        occupancyRate: 93,
        totalRooms: 14,
        occupiedRooms: 13,
        vacantRooms: 1,
        monthlyRevenueActual: 38000000,
        monthlyRevenueExpected: 42000000,
        revenueGrowthMoM: 5.5,
        pendingIssuesCount: 1,
        urgentIssuesCount: 0,
        expiringContractsCount: 2,
        expiringDaysWindow: 30,
      };
      return {
        currentMetrics: greenMetrics,
        currentAlerts: mockUrgentAlerts.filter((a) => a.propertyName.includes('Green')),
        currentRooms: mockAttentionRooms.filter((r) => r.propertyName.includes('Green')),
        selectedPropertyName: propName,
      };
    }

    // prop_tanbinh
    const tanbinhMetrics: OverviewMetrics = {
      occupancyRate: 88,
      totalRooms: 8,
      occupiedRooms: 7,
      vacantRooms: 1,
      monthlyRevenueActual: 19000000,
      monthlyRevenueExpected: 22000000,
      revenueGrowthMoM: 4.1,
      pendingIssuesCount: 1,
      urgentIssuesCount: 0,
      expiringContractsCount: 1,
      expiringDaysWindow: 30,
    };
    return {
      currentMetrics: tanbinhMetrics,
      currentAlerts: mockUrgentAlerts.filter((a) => a.propertyName.includes('Tân Bình')),
      currentRooms: mockAttentionRooms.filter((r) => r.propertyName.includes('Tân Bình')),
      selectedPropertyName: propName,
    };
  }, [selectedPropertyId, user.managedProperties]);

  const handleQuickAction = (actionKey: string) => {
    const actionTitles: Record<string, string> = {
      'create-contract': 'Mở biểu mẫu tạo Hợp đồng thuê phòng mới',
      'add-tenant': 'Mở biểu mẫu tiếp nhận thông tin Khách thuê mới',
      'record-utilities': 'Mở bảng kê ghi số công tơ Điện & Nước kỳ này',
      'report-issue': 'Mở phiếu tiếp nhận sự cố kỹ thuật & điều phối thợ',
    };
    const title = actionTitles[actionKey] || 'Thao tác nghiệp vụ';
    setToastMessage(`Đã chọn: "${title}"`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const isCustomView = hostAccountsActive || assetsActive || propertiesActive || roomsActive || servicesActive || customersActive;

  return (
    <div className={`dashboard-root${hostAccountsActive ? ' dashboard-root--admin' : ''}${assetsActive ? ' dashboard-root--assets' : ''}`}>
      {/* Top Navigation */}
      <Topbar
        user={user}
        selectedPropertyId={selectedPropertyId}
        onSelectProperty={setSelectedPropertyId}
        onLogout={onLogout}
        onOpenProfile={onOpenProfile}
        showPropertySwitcher={!isCustomView}
        showNotifications={!isCustomView}
        onNavigateOverview={onNavigateOverview}
      />

      {/* Main Layout: Sidebar + Canvas */}
      <button type="button" className="dash-mobile-menu-toggle" aria-expanded={mobileOpen} aria-controls="rentops-navigation" onClick={() => setMobileOpen((open) => !open)}>Điều hướng</button>
      {!mobileOpen && <nav className="dash-mobile-shortcuts asset-mobile-nav" aria-label="Điều hướng nhanh trên thiết bị nhỏ">
        {[
          { label: 'Tổng quan', path: '/', active: !isCustomView, action: onNavigateOverview, show: true },
          { label: 'Tài sản', path: '/assets', active: assetsActive, action: onNavigateAssets, show: showAssets },
          { label: 'Khách thuê', path: '/customers', active: customersActive, action: onNavigateCustomers, show: showCustomers },
          { label: 'Danh mục dịch vụ', path: '/services', active: servicesActive, action: onNavigateServices, show: showServices },
          { label: 'Cơ sở & Tòa nhà', path: '/properties', active: propertiesActive, action: onNavigateProperties, show: propertiesActive },
          { label: 'Mặt bằng & Phòng', path: '/rooms', active: roomsActive, action: onNavigateRooms, show: roomsActive },
          { label: 'Hợp đồng cọc', path: '/deposit-contracts', active: contractsActive, action: onNavigateContracts, show: showContracts },
          { label: 'Hợp đồng thuê', path: '/rental-contracts', active: rentalContractsActive, action: onNavigateRentalContracts, show: showContracts },
          { label: 'Tài khoản Host', path: '/admin/host-accounts', active: hostAccountsActive, action: onNavigateHostAccounts, show: hostAccountsActive },
        ].filter((item) => item.show).map((item) => <a key={item.path} href={item.path} aria-current={smallScreen && item.active ? 'page' : undefined} onClick={(event) => { event.preventDefault(); item.action?.(); }}>{item.label}</a>)}
      </nav>}
      <div className="dashboard-layout">
        <Sidebar
          markCurrent={!smallScreen || mobileOpen}
          mobileOpen={mobileOpen}
          showServices={showServices}
          servicesActive={servicesActive}
          onNavigateServices={mobileNavigate(onNavigateServices)}
          showHostAccounts={showHostAccounts}
          hostAccountsActive={hostAccountsActive}
          showAssets={showAssets}
          assetsActive={assetsActive}
          onNavigateAssets={mobileNavigate(onNavigateAssets)}
          showProperties={showProperties}
          propertiesActive={propertiesActive}
          onNavigateProperties={mobileNavigate(onNavigateProperties)}
          showRooms={showRooms}
          roomsActive={roomsActive}
          onNavigateRooms={mobileNavigate(onNavigateRooms)}
          showCustomers={showCustomers}
          customersActive={customersActive}
          onNavigateCustomers={mobileNavigate(onNavigateCustomers)}
          showContracts={showContracts}
          contractsActive={contractsActive}
          rentalContractsActive={rentalContractsActive}
          onNavigateContracts={mobileNavigate(onNavigateContracts)}
          onNavigateRentalContracts={mobileNavigate(onNavigateRentalContracts)}
          onNavigateOverview={mobileNavigate(onNavigateOverview)}
          onNavigateHostAccounts={mobileNavigate(onNavigateHostAccounts)}
        />

        <main className="dash-canvas" id="main-content">
          {children || (
            <>
              {/* Toast Notification */}
              {toastMessage && (
                <div className="dash-toast" role="status">
                  <span>{toastMessage}</span>
                  <button
                    type="button"
                    onClick={() => setToastMessage(null)}
                    className="dash-toast-close"
                    aria-label="Đóng thông báo"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Context & Greeting Row */}
              <section className="dash-context-row" aria-label="Lời chào và thông tin phiên làm việc">
                <div>
                  <h1 className="greeting-title">
                    Chào buổi sáng, {user.fullName}
                  </h1>
                  <p className="greeting-subtitle">
                    Đang quản lý: <strong style={{ color: 'var(--color-ink)' }}>{selectedPropertyName}</strong> • {todayFormatted}
                  </p>
                </div>

                {/* Quick Action Buttons */}
                <QuickActionBar onActionClick={handleQuickAction} />
              </section>

              {/* Metric KPIs Strip */}
              <MetricSection metrics={currentMetrics} />

              {/* Analytics (Chart) & Alerts Grid */}
              <section className="analytics-alerts-grid" aria-label="Thống kê tài chính và cảnh báo">
                <RevenueCashflowChart data={mockRevenueTrend} />
                <UrgentTasksList alerts={currentAlerts} />
              </section>

              {/* Property Status Table */}
              <PropertyStatusTable rooms={currentRooms} />
            </>
          )}
        </main>
      </div>
    </div>
  );
};
