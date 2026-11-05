import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AssetApiError, isAssetAbort } from '../services/assetsApi';
export interface AssetResource<T> { key: string; identity: string | null; data: T | null; status: 'loading' | 'ready' | 'error'; error: string | null; stale: boolean; refresh: () => void }
type Resource<T> = Omit<AssetResource<T>, 'refresh'>;

export function useAssetResource<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, fail: (error: unknown) => boolean, fallback: string, identity = key) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<Resource<T>>({ key: '', identity: null, data: null, status: 'loading', error: null, stale: false });
  const sequence = useRef(0);
  useLayoutEffect(() => { sequence.current++; }, [key]);
  useEffect(() => {
    const request = ++sequence.current;
    const controller = new AbortController();
    let active = true;
    if (key !== null) void (async () => {
      await Promise.resolve();
      if (!active) return;
      setState((previous) => ({ key, identity, data: previous.identity === identity ? previous.data : null, status: 'loading', error: null, stale: previous.identity === identity && previous.data !== null }));
      try {
        const data = await load(controller.signal);
        if (active && sequence.current === request) setState({ key, identity, data, status: 'ready', error: null, stale: false });
      } catch (error) {
        if (!active || sequence.current !== request || isAssetAbort(error)) return;
        if (!fail(error)) setState((previous) => ({ ...previous, key, status: 'error', stale: previous.data !== null, error: error instanceof AssetApiError ? error.message : fallback }));
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [key, identity, load, fail, fallback, version]);
  const refresh = useCallback(() => {
    setState((previous) => ({ ...previous, status: 'loading', error: null, stale: previous.data !== null }));
    setVersion((value) => value + 1);
  }, []);
  const current: Resource<T> = state.key === key ? state : { key: key || '', identity, data: null, status: 'loading', error: null, stale: false };
  return { ...current, refresh };
}
