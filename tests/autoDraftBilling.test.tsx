import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingSchedulePage } from '../src/components/invoice/BillingSchedulePage';
import { HostNotificationDrawer } from '../src/components/dashboard/HostNotificationDrawer';
import { AutoDraftJobsForbidden, AutoDraftJobsPage } from '../src/components/admin/AutoDraftJobsPage';
import { Topbar } from '../src/components/dashboard/Topbar';
import * as autoDraftApi from '../src/services/autoDraftBillingApi';
import * as billingScheduleApi from '../src/services/billingScheduleApi';
import * as servicePolicyApi from '../src/services/servicePolicyApi';
import type { UserProfile } from '../src/types/dashboard';

describe('UC55 Frontend Components', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.pushState(null, '', '/billing-schedules');
  });

  it('renders auto-draft switch on BillingSchedulePage, shows 2a note when off, and toggles via PUT', async () => {
    vi.spyOn(billingScheduleApi, 'fetchBillingSchedules').mockResolvedValue({
      summary: {
        overdueCount: 0,
        dueCount: 0,
        upcomingCount: 0,
        draftCount: 0,
        issuedCount: 0,
        totalActiveContracts: 0,
      },
      items: [],
      emptyStateMessage: 'Chưa có hợp đồng thuê đang hoạt động để theo dõi lịch lập hóa đơn',
    });
    vi.spyOn(servicePolicyApi, 'lookupHostBuildings').mockResolvedValue([]);
    vi.spyOn(autoDraftApi, 'getAutoDraftSettings').mockResolvedValue({
      autoDraftEnabled: false,
      updatedAt: null,
    });
    const updateSpy = vi.spyOn(autoDraftApi, 'updateAutoDraftSettings').mockResolvedValue({
      autoDraftEnabled: true,
      updatedAt: '2026-02-01T01:00:00Z',
    });

    render(<BillingSchedulePage accountId="acc-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Đang tắt tự động/i)).toBeTruthy();
    });

    const toggle = screen.getByRole('switch', { name: /Tự động lập hóa đơn nháp khi đến kỳ/i });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(true);
      expect(toggle.getAttribute('aria-checked')).toBe('true');
    });
  });

  it('renders HostNotificationDrawer with 7a/E4a/E7a details, marks read, and closes on Escape', () => {
    const onClose = vi.fn();
    const onMarkAsRead = vi.fn();

    render(
      <HostNotificationDrawer
        open={true}
        items={[
          {
            id: 'n-1',
            type: 'AUTO_DRAFT_SUMMARY',
            title: 'Tổng kết lập hóa đơn nháp tự động ngày 2026-02-01',
            body: 'Đã tạo 2 hóa đơn nháp.',
            metadata: {
              runDate: '2026-02-01',
              createdCount: 2,
              waitingMeterRooms: ['P101'],
              errorRooms: ['P102 (Tổng tiền âm)'],
              expiredContracts: ['HD-09'],
            },
            runDate: '2026-02-01',
            read: false,
            createdAt: '2026-02-01T01:00:05Z',
          },
        ]}
        loading={false}
        error={null}
        hasNext={false}
        markingId={null}
        onClose={onClose}
        onMarkAsRead={onMarkAsRead}
        onLoadMore={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText(/Chờ nhập chỉ số công tơ: P101/i)).toBeTruthy();
    expect(screen.getByText(/Hợp đồng hết hạn cần xử lý: HD-09/i)).toBeTruthy();
    expect(screen.getByText(/Phòng lỗi dữ liệu.*P102/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Đánh dấu đã đọc/i }));
    expect(onMarkAsRead).toHaveBeenCalledWith('n-1');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('hides Host notification bell from CUSTOMER role on Topbar', () => {
    const customerUser: UserProfile = {
      id: 'c-1',
      accountId: 'acc-c1',
      fullName: 'Khách thuê A',
      email: 'cust@test.local',
      role: 'CUSTOMER',
      managedProperties: [],
    };

    render(
      <Topbar
        user={customerUser}
        selectedPropertyId="prop_all"
        onSelectProperty={vi.fn()}
        onLogout={vi.fn()}
        onOpenProfile={vi.fn()}
        showNotifications={false}
      />,
    );

    expect(screen.queryByRole('button', { name: /Hòm thư lập hóa đơn tự động/i })).toBeNull();
  });

  it('renders AutoDraftJobsPage for ADMIN, triggers runDate, and renders SKIPPED_LOCKED', async () => {
    vi.spyOn(autoDraftApi, 'fetchAutoDraftJobLogs').mockResolvedValue({
      items: [
        {
          id: 'run-1',
          runDate: '2026-02-01',
          startedAt: '2026-02-01T01:00:00Z',
          finishedAt: '2026-02-01T01:00:02Z',
          status: 'SKIPPED_LOCKED',
          totalHostsScanned: 0,
          totalContractsScanned: 0,
          createdCount: 0,
          waitingMeterCount: 0,
          errorCount: 0,
          expiredCount: 0,
          details: { reason: 'Locked by another node' },
        },
      ],
      page: 0,
      hasNext: false,
    });
    const triggerSpy = vi.spyOn(autoDraftApi, 'triggerAutoDraftJob').mockResolvedValue({
      id: 'run-2',
      runDate: '2026-02-01',
      startedAt: '2026-02-01T02:00:00Z',
      finishedAt: '2026-02-01T02:00:03Z',
      status: 'COMPLETED',
      totalHostsScanned: 1,
      totalContractsScanned: 3,
      createdCount: 3,
      waitingMeterCount: 1,
      errorCount: 0,
      expiredCount: 0,
      details: { waitingMeterRooms: ['P101'] },
    });

    render(<AutoDraftJobsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Bỏ qua \(đang khóa\)/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Chạy tiến trình ngay/i }));

    await waitFor(() => {
      expect(triggerSpy).toHaveBeenCalled();
      expect(screen.getByText(/Tạo mới 3 nháp/i)).toBeTruthy();
    });

    const onOverview = vi.fn();
    render(<AutoDraftJobsForbidden onOverview={onOverview} />);
    expect(screen.getByRole('alert').textContent).toContain('không có quyền');
  });
});
