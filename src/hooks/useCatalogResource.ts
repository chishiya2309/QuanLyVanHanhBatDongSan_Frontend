import { useCallback, useEffect, useRef, useState } from 'react';
import { CatalogApiError, isCatalogAbort } from '../services/serviceCatalogApi';

export function useCatalogResource<T>(load: (signal: AbortSignal) => Promise<T>, fail: (error: unknown) => boolean, fallback: string) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ data: T | null; status: 'loading' | 'ready' | 'error'; error: string | null; stale: boolean }>({ data: null, status: 'loading', error: null, stale: false });
  const sequence = useRef(0);
  useEffect(() => {
    const controller = new AbortController(); const request = ++sequence.current; let active = true;
    void (async () => {
      await Promise.resolve(); if (!active) return;
      setState((old) => ({ ...old, status: 'loading', error: null, stale: old.data !== null }));
      try {
        const data = await load(controller.signal);
        if (active && request === sequence.current) setState({ data, status: 'ready', error: null, stale: false });
      } catch (error) {
        if (!active || request !== sequence.current || isCatalogAbort(error)) return;
        if (!fail(error)) setState((old) => ({ ...old, status: 'error', stale: old.data !== null, error: error instanceof CatalogApiError ? error.message : fallback }));
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [load, fail, fallback, revision]);
  const refresh = useCallback(() => { sequence.current++; setState((old) => ({ ...old, status: 'loading', stale: old.data !== null, error: null })); setRevision((value) => value + 1); }, []);
  return { ...state, refresh };
}
