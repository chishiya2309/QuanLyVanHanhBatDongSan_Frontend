export const AUTO_DRAFT_JOBS_PATH = '/admin/auto-draft-jobs';

export function isAutoDraftJobsPath(pathname: string): boolean {
  return pathname === AUTO_DRAFT_JOBS_PATH || pathname === `${AUTO_DRAFT_JOBS_PATH}/`;
}

export interface AutoDraftSettingsResponse {
  autoDraftEnabled: boolean;
  updatedAt: string | null;
}

export interface AutoDraftSummaryMetadata {
  runDate?: string;
  createdCount?: number;
  waitingMeterRooms?: string[];
  errorRooms?: string[];
  expiredContracts?: string[];
}

export interface HostNotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata: AutoDraftSummaryMetadata;
  runDate: string;
  read: boolean;
  createdAt: string;
}

export interface HostNotificationPage {
  items: HostNotificationItem[];
  page: number;
  hasNext: boolean;
}

export type AutoDraftJobStatus = 'RUNNING' | 'COMPLETED' | 'SKIPPED_LOCKED' | 'FAILED';

export interface AutoDraftJobRun {
  id: string;
  runDate: string;
  startedAt: string;
  finishedAt: string | null;
  status: AutoDraftJobStatus;
  totalHostsScanned: number;
  totalContractsScanned: number;
  createdCount: number;
  waitingMeterCount: number;
  errorCount: number;
  expiredCount: number;
  details: {
    waitingMeterRooms?: string[];
    errorRooms?: string[];
    expiredContracts?: string[];
    reason?: string;
    message?: string;
    error?: string;
  };
}

export interface AutoDraftJobLogPage {
  items: AutoDraftJobRun[];
  page: number;
  hasNext: boolean;
}
