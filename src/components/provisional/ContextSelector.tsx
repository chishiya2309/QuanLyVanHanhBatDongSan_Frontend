import type { Ref } from 'react';
import type { PeriodHeader, ProvisionalDetail, ProvisionalRoute } from '../../types/provisionalCharge';
import { provisionalUrl, sortProvisionalPeriods } from '../../utils/provisionalChargeNavigation';
import { formatPeriodRange } from '../../utils/provisionalChargeFormat';

export function ContextSelector({ route, periods, detail, loading, onNavigate, roomRef }: {
  route: ProvisionalRoute; periods: PeriodHeader[]; detail: ProvisionalDetail | null; loading: boolean;
  onNavigate: (url: string) => void; roomRef: Ref<HTMLSelectElement>;
}) {
  // A validated direct-link detail may be newer than the list read before it.
  const headers = detail && !periods.some(p => p.periodId === detail.periodId) ? [...periods, detail] : periods;
  const rooms = [...new Map(headers.map(p => [p.roomId, p])).values()]
    .sort((a, b) => a.roomCode.localeCompare(b.roomCode, 'vi') || a.buildingName.localeCompare(b.buildingName, 'vi') || a.roomId.localeCompare(b.roomId));
  const choices = sortProvisionalPeriods(headers.filter(p => p.roomId === route.roomId));
  return <div className="pc-context" aria-busy={loading}>
    <div className="pc-field">
      <label htmlFor="pc-room">Phòng</label>
      <select id="pc-room" ref={roomRef} value={route.roomId} disabled={loading} aria-invalid={route.invalid || undefined}
        onChange={e => onNavigate(provisionalUrl({ role: route.role, roomId: e.target.value }))}>
        <option value="">Chọn phòng</option>
        {route.roomId && !rooms.some(p => p.roomId === route.roomId) && <option value={route.roomId}>Phòng cần xác minh</option>}
        {rooms.map(p => <option key={p.roomId} value={p.roomId}>{p.roomCode}, {p.buildingName}</option>)}
      </select>
    </div>
    <div className="pc-field pc-field--period">
      <label htmlFor="pc-period">Kỳ / phần kỳ</label>
      <select id="pc-period" value={route.periodId} disabled={loading || !route.roomId || !choices.length}
        aria-describedby="pc-date-help" aria-invalid={route.invalid || undefined}
        onChange={e => onNavigate(provisionalUrl({ role: route.role, roomId: route.roomId, periodId: e.target.value }))}>
        <option value="">Chọn kỳ</option>
        {route.periodId && !choices.some(p => p.periodId === route.periodId) && <option value={route.periodId}>Kỳ cần xác minh</option>}
        {choices.map(p => <option key={p.periodId} value={p.periodId}>{formatPeriodRange(p.fromDate, p.toDate)}{p.fromDate !== p.cycleStart || p.toDate !== p.cycleEnd ? ' (phần kỳ)' : ''}</option>)}
      </select>
    </div>
    <p id="pc-date-help">Khoảng kỳ không bao gồm ngày kết thúc.</p>
  </div>;
}
