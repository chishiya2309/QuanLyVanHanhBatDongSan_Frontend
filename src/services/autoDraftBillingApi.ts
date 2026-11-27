import { invoiceRequest } from './invoiceApi';
import type {
  AutoDraftJobLogPage,
  AutoDraftJobRun,
  AutoDraftSettingsResponse,
  HostNotificationPage,
} from '../types/autoDraftBilling';

export function getAutoDraftSettings(signal?: AbortSignal): Promise<AutoDraftSettingsResponse> {
  return invoiceRequest<AutoDraftSettingsResponse>('/host/settings/auto-draft', signal);
}

export function updateAutoDraftSettings(
  autoDraftEnabled: boolean,
  signal?: AbortSignal,
): Promise<AutoDraftSettingsResponse> {
  return invoiceRequest<AutoDraftSettingsResponse>(
    '/host/settings/auto-draft',
    signal,
    { autoDraftEnabled },
    undefined,
    'PUT',
  );
}

export function fetchHostNotifications(
  page = 0,
  signal?: AbortSignal,
): Promise<HostNotificationPage> {
  return invoiceRequest<HostNotificationPage>(`/host/notifications?page=${page}`, signal);
}

export function markHostNotificationRead(
  notificationId: string,
  signal?: AbortSignal,
): Promise<null> {
  return invoiceRequest<null>(
    `/host/notifications/${encodeURIComponent(notificationId)}/read`,
    signal,
    undefined,
    undefined,
    'PATCH',
  );
}

export function fetchAutoDraftJobLogs(
  page = 0,
  signal?: AbortSignal,
): Promise<AutoDraftJobLogPage> {
  return invoiceRequest<AutoDraftJobLogPage>(`/admin/auto-draft-jobs/logs?page=${page}`, signal);
}

export function triggerAutoDraftJob(
  runDate?: string,
  signal?: AbortSignal,
): Promise<AutoDraftJobRun> {
  const query = runDate?.trim() ? `?runDate=${encodeURIComponent(runDate.trim())}` : '';
  return invoiceRequest<AutoDraftJobRun>(
    `/admin/auto-draft-jobs/trigger${query}`,
    signal,
    {},
    undefined,
    'POST',
  );
}
