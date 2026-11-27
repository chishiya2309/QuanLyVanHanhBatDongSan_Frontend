import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../src/components/dashboard/Sidebar';
import { HostNotificationDrawer } from '../src/components/dashboard/HostNotificationDrawer';

describe('SPA navigation for Invoice and Billing Schedule links', () => {
  it('prevents full page reload on normal left-click and allows Ctrl+Click for new tab', () => {
    const onNavigateInvoice = vi.fn();
    const onNavigateSchedule = vi.fn();

    render(
      <Sidebar
        invoiceLink={{
          path: '/invoices/host',
          label: 'Quản lý hóa đơn',
          active: false,
          onNavigate: onNavigateInvoice,
        }}
        billingScheduleLink={{
          path: '/billing-schedules',
          label: 'Lịch lập hóa đơn',
          active: false,
          onNavigate: onNavigateSchedule,
        }}
      />,
    );

    const invoiceAnchor = screen.getByRole('link', { name: 'Quản lý hóa đơn' });
    const normalClick = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    invoiceAnchor.dispatchEvent(normalClick);
    expect(normalClick.defaultPrevented).toBe(true);
    expect(onNavigateInvoice).toHaveBeenCalledTimes(1);

    const ctrlClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      ctrlKey: true,
    });
    invoiceAnchor.dispatchEvent(ctrlClick);
    expect(ctrlClick.defaultPrevented).toBe(false);
    expect(onNavigateInvoice).toHaveBeenCalledTimes(1);

    const scheduleAnchor = screen.getByRole('link', { name: 'Lịch lập hóa đơn' });
    fireEvent.click(scheduleAnchor);
    expect(onNavigateSchedule).toHaveBeenCalledTimes(1);
  });

  it('uses SPA navigation for HostNotificationDrawer links and closes the drawer', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();

    render(
      <HostNotificationDrawer
        open={true}
        items={[
          {
            id: 'n-1',
            type: 'AUTO_DRAFT_SUMMARY',
            title: 'Tổng kết',
            body: 'Đã tạo 1 hóa đơn nháp.',
            metadata: {
              createdCount: 1,
              waitingMeterRooms: ['P101'],
              expiredContracts: ['HD-01'],
              errorRooms: [],
            },
            runDate: '2026-02-01',
            read: false,
            createdAt: '2026-02-01T01:00:00Z',
          },
        ]}
        loading={false}
        error={null}
        hasNext={false}
        markingId={null}
        onClose={onClose}
        onMarkAsRead={vi.fn()}
        onLoadMore={vi.fn()}
        onRefresh={vi.fn()}
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByRole('link', { name: /Rà soát hóa đơn nháp/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('/invoices/host');
  });
});
