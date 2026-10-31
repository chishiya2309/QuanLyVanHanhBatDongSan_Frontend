import React, { useState, useMemo } from 'react';
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
  user: UserProfile;
  onLogout: () => void;
  onOpenProfile: () => void;
  children?: React.ReactNode;
  hostAccountsActive?: boolean;
  showHostAccounts?: boolean;
  onNavigateOverview?: () => void;
  onNavigateHostAccounts?: () => void;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({ user, onLogout, onOpenProfile, children, hostAccountsActive = false, showHostAccounts = false, onNavigateOverview, onNavigateHostAccounts }) => {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('prop_all');
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

  return (
    <div className={`dashboard-root${hostAccountsActive ? ' dashboard-root--admin' : ''}`}>
      {/* Top Navigation */}
      <Topbar
        user={user}
        selectedPropertyId={selectedPropertyId}
        onSelectProperty={setSelectedPropertyId}
        onLogout={onLogout}
        onOpenProfile={onOpenProfile}
        showPropertySwitcher={!hostAccountsActive}
        showNotifications={!hostAccountsActive}
        onNavigateOverview={onNavigateOverview}
      />

      {/* Main Layout: Sidebar + Canvas */}
      <div className="dashboard-layout">
        <Sidebar showHostAccounts={showHostAccounts} hostAccountsActive={hostAccountsActive}
          onNavigateOverview={onNavigateOverview} onNavigateHostAccounts={onNavigateHostAccounts} />

        <main className="dash-canvas" id="main-content">
          {showHostAccounts && <nav className="host-mobile-nav" aria-label="Điều hướng quản trị">
            <a href="/" aria-current={!hostAccountsActive ? 'page' : undefined} onClick={(event) => {
              if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigateOverview?.(); }
            }}>Tổng quan</a>
            <a href="/admin/host-accounts" aria-current={hostAccountsActive ? 'page' : undefined} onClick={(event) => {
              if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigateHostAccounts?.(); }
            }}>Tài khoản Host</a>
          </nav>}
          {children || <>
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
          </>}
        </main>
      </div>
    </div>
  );
};
