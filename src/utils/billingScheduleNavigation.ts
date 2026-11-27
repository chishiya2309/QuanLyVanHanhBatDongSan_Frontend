import { billingScheduleStatuses, type BillingScheduleFilterRequest } from '../services/billingScheduleApi';
import type { BillingScheduleItem } from '../services/billingScheduleApi';
import type { Period } from '../services/invoiceDraftApi';

export const billingSchedulePath = '/billing-schedules';
export const isBillingSchedulePath = (path: string) => /^\/billing-schedules\/?$/.test(path);

export function parseBillingScheduleFilters(search: string): BillingScheduleFilterRequest {
  const params = new URLSearchParams(search);
  const month = Number(params.get('month'));
  const year = Number(params.get('year'));
  return {
    propertyId: params.get('propertyId'),
    status: billingScheduleStatuses.filter(status => params.getAll('status').includes(status)),
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : null,
    year: Number.isInteger(year) && year >= 1 && year <= 9999 ? year : null,
  };
}

type DraftCycle = Pick<BillingScheduleItem,
  'contractId' | 'roomId' | 'roomName' | 'propertyName' | 'cycleStart' | 'cycleEnd' |
  'hasRoomTransferInCycle' | 'cycleSegments'>;

interface DraftHandoff {
  accountId: string;
  expiresAt: number;
  mode: 'single' | 'batch';
  search: string;
  cycles: DraftCycle[];
}

const handoffPrefix = 'uc54:draft:';
const handoffLifetime = 8 * 60 * 60 * 1000;

export function createDraftHandoff(
  accountId: string, mode: DraftHandoff['mode'], search: string, items: BillingScheduleItem[],
): string {
  const storage = window.sessionStorage;
  for (const key of Object.keys(storage)) {
    if (!key.startsWith(handoffPrefix)) continue;
    const previous = readStoredHandoff(storage, key);
    if (!previous || previous.expiresAt <= Date.now() || previous.accountId !== accountId) storage.removeItem(key);
  }
  const token = window.crypto.randomUUID();
  const cycles: DraftCycle[] = items.map(item => ({
    contractId: item.contractId,
    roomId: item.roomId,
    roomName: item.roomName,
    propertyName: item.propertyName,
    cycleStart: item.cycleStart,
    cycleEnd: item.cycleEnd,
    hasRoomTransferInCycle: item.hasRoomTransferInCycle,
    cycleSegments: item.cycleSegments,
  }));
  const handoff: DraftHandoff = { accountId, mode, search, cycles, expiresAt: Date.now() + handoffLifetime };
  storage.setItem(handoffPrefix + token, JSON.stringify(handoff));
  return '/invoices/host?view=schedule&handoff=' + token;
}

function readStoredHandoff(storage: Storage, key: string): DraftHandoff | null {
  try {
    return JSON.parse(storage.getItem(key) ?? 'null') as DraftHandoff | null;
  } catch {
    return null;
  }
}

const isTextOrNull = (value: unknown) => value === null || typeof value === 'string';

function isStoredCycle(cycle: DraftCycle): boolean {
  return Boolean(cycle && typeof cycle.contractId === 'string'
    && [cycle.roomId, cycle.roomName, cycle.propertyName, cycle.cycleStart, cycle.cycleEnd].every(isTextOrNull)
    && typeof cycle.hasRoomTransferInCycle === 'boolean'
    && Array.isArray(cycle.cycleSegments)
    && cycle.cycleSegments.every(segment => segment && isTextOrNull(segment.roomId) && isTextOrNull(segment.roomName)
      && typeof segment.segmentStart === 'string' && typeof segment.segmentEnd === 'string'
      && Number.isInteger(segment.actualDays)));
}

export function readDraftHandoff(token: string, accountId: string | undefined): DraftHandoff | null {
  try {
    if (!accountId || !/^[\da-f-]{36}$/i.test(token)) return null;
    const handoff = readStoredHandoff(window.sessionStorage, handoffPrefix + token);
    if (!handoff || handoff.accountId !== accountId || !(handoff.expiresAt > Date.now())
      || typeof handoff.search !== 'string' || !Array.isArray(handoff.cycles) || !handoff.cycles.length
      || (handoff.mode === 'single' ? handoff.cycles.length !== 1 : handoff.mode !== 'batch')
      || !handoff.cycles.every(isStoredCycle)) return null;
    return handoff;
  } catch {
    return null;
  }
}

export function matchDraftPeriods(cycles: DraftCycle[], periods: Period[]) {
  const cycleKey = (contract: string, room: string, start: string, end: string) =>
    [contract, room, start, end].join('/');
  const periodsByCycle = new Map<string, Period[]>();
  for (const period of periods) {
    const key = cycleKey(period.contract_id, period.room_id, period.cycle_start, period.cycle_end);
    const matches = periodsByCycle.get(key) ?? [];
    matches.push(period);
    periodsByCycle.set(key, matches);
  }
  return cycles.map(cycle => {
    const { contractId, roomId, cycleStart, cycleEnd } = cycle;
    const matches = roomId && cycleStart && cycleEnd
      ? periodsByCycle.get(cycleKey(contractId, roomId, cycleStart, cycleEnd)) ?? []
      : [];
    if (matches.length === 0) return { cycle, reason: 'Chưa có kỳ tính tiền đã đăng ký khớp với lịch này.' };
    if (matches.length > 1) return { cycle, reason: 'Có nhiều kỳ tính tiền khớp. Hãy kiểm tra lại phòng và kỳ.' };
    const period = matches[0];
    if (period.status !== 'OPEN' && !period.invoice_id) return { cycle, reason: 'Kỳ tính tiền đã đóng.' };
    return { cycle, period };
  });
}

export type { DraftCycle, DraftHandoff };
