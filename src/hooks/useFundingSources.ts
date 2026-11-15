import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FundingApiError, isFundingAbort, listBanks, listFundingSources } from '../services/fundingApi';
import { fundingMessages as m, type FundingNotice, type FundingRoute } from '../types/fundingSource';
export function useFundingResource<T>(load: (signal: AbortSignal) => Promise<T>, fail: (e: unknown) => boolean, fallback: string) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ data: T | null; status: 'loading' | 'ready' | 'error'; error: string | null }>({ data: null, status: 'loading', error: null });
  const sequence = useRef(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true; const seq = ++sequence.current;
    void (async () => {
      await Promise.resolve(); if (!active) return;
      setState({ data: null, status: 'loading', error: null });
      try { const data = await load(controller.signal); if (active && seq === sequence.current) setState({ data, status: 'ready', error: null }); }
      catch (e) { if (active && seq === sequence.current && !isFundingAbort(e) && !fail(e)) setState({ data: null, status: 'error', error: e instanceof Error ? e.message : fallback }); }
    })();
    return () => { active = false; controller.abort(); };
  }, [load, fail, fallback, revision]);
  const refresh = useCallback(() => { sequence.current++; setState({ data: null, status: 'loading', error: null }); setRevision(r => r + 1); }, []);
  return { ...state, refresh };
}
export function useFundingSources(route: FundingRoute, onSessionExpired: () => void, onForbidden: () => void) {
  const [notice, setNotice] = useState<FundingNotice | null>(null);
  const callbacks = useRef({ onSessionExpired, onForbidden });
  useLayoutEffect(() => { callbacks.current = { onSessionExpired, onForbidden }; });
  const fail = useCallback((e: unknown) => {
    if (!(e instanceof FundingApiError)) return false;
    if (e.status === 401) { callbacks.current.onSessionExpired(); return true; }
    if (e.status === 403 && e.code === 'FORBIDDEN') { callbacks.current.onForbidden(); return true; }
    return false;
  }, []);
  const load = useCallback((signal: AbortSignal) => listFundingSources({ type: route.type, active: route.active }, signal), [route.type, route.active]);
  const list = useFundingResource(load, fail, m.listFailure), banks = useFundingResource(listBanks, fail, m.bankFailure);
  return { list, banks, fail, notice, setNotice };
}
