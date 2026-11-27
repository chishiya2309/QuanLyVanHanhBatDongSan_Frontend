import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  fetchAutoDraftJobLogs,
  fetchHostNotifications,
  getAutoDraftSettings,
  markHostNotificationRead,
  triggerAutoDraftJob,
  updateAutoDraftSettings,
} from '../src/services/autoDraftBillingApi';
import * as invoiceApi from '../src/services/invoiceApi';

describe('autoDraftBillingApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls host auto-draft settings endpoints with expected method and payload', async () => {
    const spy = vi.spyOn(invoiceApi, 'invoiceRequest').mockResolvedValue({
      autoDraftEnabled: true,
      updatedAt: '2026-02-01T01:00:00Z',
    });

    const got = await getAutoDraftSettings();
    expect(got.autoDraftEnabled).toBe(true);
    expect(spy).toHaveBeenCalledWith('/host/settings/auto-draft', undefined);

    await updateAutoDraftSettings(false);
    expect(spy).toHaveBeenCalledWith(
      '/host/settings/auto-draft',
      undefined,
      { autoDraftEnabled: false },
      undefined,
      'PUT',
    );
  });

  it('calls host notifications and mark-read endpoints', async () => {
    const spy = vi.spyOn(invoiceApi, 'invoiceRequest').mockResolvedValue({
      items: [],
      page: 0,
      hasNext: false,
    });

    await fetchHostNotifications(2);
    expect(spy).toHaveBeenCalledWith('/host/notifications?page=2', undefined);

    await markHostNotificationRead('notif-1');
    expect(spy).toHaveBeenCalledWith(
      '/host/notifications/notif-1/read',
      undefined,
      undefined,
      undefined,
      'PATCH',
    );
  });

  it('calls admin auto-draft job logs and trigger endpoints', async () => {
    const spy = vi.spyOn(invoiceApi, 'invoiceRequest').mockResolvedValue({
      items: [],
      page: 0,
      hasNext: false,
    });

    await fetchAutoDraftJobLogs(1);
    expect(spy).toHaveBeenCalledWith('/admin/auto-draft-jobs/logs?page=1', undefined);

    await triggerAutoDraftJob('2026-02-01');
    expect(spy).toHaveBeenCalledWith(
      '/admin/auto-draft-jobs/trigger?runDate=2026-02-01',
      undefined,
      {},
      undefined,
      'POST',
    );
  });
});
