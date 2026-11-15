import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthenticatedUserResponse } from '../types/auth';
import type { ProvisionalDetail, ProvisionalPeriods, ProvisionalRoute } from '../types/provisionalCharge';
import { provisionalMessages as m } from '../types/provisionalCharge';
import { getProvisionalDetail, getProvisionalPeriods, isProvisionalAbort, ProvisionalApiError } from '../services/provisionalChargeApi';

interface Snapshot { key: string; detail: ProvisionalDetail; etag: string }
interface View {
  key: string; list: ProvisionalPeriods | null; listLoading: boolean; listError: string | null;
  detail: ProvisionalDetail | null; loading: boolean; refreshing: boolean;
  error: ProvisionalApiError | null; stale: boolean; checkedAt: Date | null;
}
const initial = (key: string, complete: boolean): View => ({ key, list: null, listLoading: true, listError: null,
  detail: null, loading: complete, refreshing: false, error: null, stale: false, checkedAt: null });
const revokes = (e: ProvisionalApiError) => [400, 401, 403, 404, 422].includes(e.status)
  || ['PERIOD_SEALED_OR_INVOICE_ISSUED', 'INVALID_CONTEXT_LINK'].includes(e.code);

export function useProvisionalCharges(user: AuthenticatedUserResponse, route: ProvisionalRoute, onSessionExpired: (message: string) => void) {
  const { role, roomId, periodId, invalid } = route;
  const key = [user.accountId, user.role, user.hostId, user.customerId, role, roomId, periodId, invalid].join(':');
  const complete = !!roomId && !!periodId && !invalid;
  const [view, setView] = useState<View>(() => initial(key, complete));
  const snapshot = useRef<Snapshot | null>(null);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const flight = useRef<string | null>(null);
  const expired = useRef(onSessionExpired);
  useEffect(() => { expired.current = onSessionExpired; }, [onSessionExpired]);
  const cancel = useCallback(() => {
    sequence.current++; controller.current?.abort(); flight.current = null; snapshot.current = null;
  }, []);

  const load = useCallback(async (refresh = false) => {
    if (flight.current === key && !controller.current?.signal.aborted) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request; flight.current = key;
    const version = ++sequence.current;
    const current = () => sequence.current === version && !request.signal.aborted;
    if (snapshot.current?.key !== key) snapshot.current = null;
    const previous = refresh ? snapshot.current : null;
    setView(old => ({ ...(old.key === key ? old : initial(key, complete)), listLoading: true, listError: null,
      error: null, detail: previous?.detail ?? null, loading: complete && !previous, refreshing: !!previous, stale: !!previous }));
    let listLoaded = false;
    try {
      const list = await getProvisionalPeriods(role, request.signal);
      if (!current()) return;
      listLoaded = true;
      // A fresh scope list that excludes the selected period revokes the old snapshot.
      // A deep link still reaches detail so the server can return its specific 403/404/409.
      if (refresh && previous && !list.periods.some(p => p.periodId === periodId && p.roomId === roomId)) {
        snapshot.current = null;
        setView(old => ({ ...old, detail: null, stale: false, refreshing: false, loading: complete }));
      }
      setView(old => ({ ...old, list, listLoading: false, listError: null }));
      if (!complete) {
        snapshot.current = null;
        setView(old => ({ ...old, detail: null, loading: false, refreshing: false, stale: false,
          error: invalid ? new ProvisionalApiError(400, 'MISSING_CONTEXT_FIELDS', m.context) : null }));
        return;
      }
      let result = await getProvisionalDetail(role, roomId, periodId, request.signal, snapshot.current?.etag);
      if (!current()) return;
      if (result.kind === 'not-modified' && snapshot.current?.key !== key) {
        result = await getProvisionalDetail(role, roomId, periodId, request.signal);
        if (!current()) return;
        if (result.kind === 'not-modified') throw new ProvisionalApiError(200, 'INVALID_RESPONSE', m.readFailure);
      }
      if (result.kind === 'data') snapshot.current = { key, detail: result.detail, etag: result.etag };
      else if (result.etag && snapshot.current) snapshot.current.etag = result.etag;
      const ready = snapshot.current;
      if (!ready || ready.key !== key) throw new ProvisionalApiError(200, 'INVALID_RESPONSE', m.readFailure);
      setView(old => ({ ...old, detail: ready.detail, loading: false, refreshing: false, error: null,
        stale: result.kind === 'not-modified' ? false : ready.detail.isStale, checkedAt: new Date() }));
    } catch (error) {
      if (!current()) return;
      if (isProvisionalAbort(error)) {
        snapshot.current = null;
        setView(old => ({ ...old, listLoading: false, loading: false, refreshing: false, detail: null }));
        return;
      }
      const e = error instanceof ProvisionalApiError ? error : new ProvisionalApiError(0, 'DATA_ACCESS_ERROR', m.readFailure);
      const keep = refresh && snapshot.current?.key === key && !revokes(e);
      if (!keep) snapshot.current = null;
      setView(old => ({ ...old, list: [401, 403, 404].includes(e.status) ? null : old.list, listLoading: false, listError: listLoaded ? old.listError : m.readFailure,
        loading: false, refreshing: false, detail: keep ? snapshot.current!.detail : null, stale: !!keep, error: e }));
      if (e.status === 401) expired.current(m.session);
    } finally {
      if (current()) flight.current = null;
    }
  }, [key, complete, invalid, role, roomId, periodId]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) void load(); });
    return () => {
      cancelled = true; cancel();
    };
  }, [load, cancel]);
  useEffect(() => {
    const visible = () => { if (document.visibilityState === 'visible') void load(true); };
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, [load]);
  useEffect(() => {
    // The shared client invalidates pending requests even for a new login to the
    // same account. Drop the idle snapshot too, then verify scope without its ETag.
    const sessionChanged = (event: StorageEvent) => {
      if (event.key !== 'rentops-session-change' || !event.newValue) return;
      try {
        const value: unknown = JSON.parse(event.newValue);
        if (!value || typeof value !== 'object' || !('accountId' in value) || value.accountId !== user.accountId) return;
      } catch { return; }
      cancel(); setView(initial(key, complete)); void load();
    };
    window.addEventListener('storage', sessionChanged);
    return () => window.removeEventListener('storage', sessionChanged);
  }, [load, cancel, key, complete, user.accountId]);
  // Redaction occurs during render, before effects for a new account or context run.
  return { ...(view.key === key ? view : initial(key, complete)), reload: () => void load(true) };
}
