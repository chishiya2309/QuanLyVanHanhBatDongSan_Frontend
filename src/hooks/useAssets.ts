import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AssetApiError, createAsset, getAsset, isAssetAbort, listAssets, recordAssetCondition, updateAsset } from '../services/assetsApi';
import { assetMessages as m, type Asset, type AssetFieldErrors, type AssetRoute, type CreateAssetInput, type RecordConditionInput, type UpdateAssetInput } from '../types/assets';
import { assetRouteKey, assetUrl } from '../utils/assetNavigation';

interface Resource<T> { key: string; identity: string | null; data: T | null; status: 'loading' | 'ready' | 'error'; error: string | null; stale: boolean }
interface Notice { kind: 'success' | 'error'; message: string; assetId?: string; uncertain?: boolean }
type Mutation = { kind: 'create'; input: CreateAssetInput } | { kind: 'edit'; id: string; input: UpdateAssetInput } | { kind: 'condition'; id: string; input: RecordConditionInput };
interface Options { onNavigate: (url: string, replace?: boolean) => void; onSessionExpired: () => void; onForbidden: () => void }

function useAssetResource<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, fail: (error: unknown) => boolean, fallback: string, identity = key) {
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

export function useAssets(route: AssetRoute, options: Options) {
  const callbacks = useRef(options);
  const life = useRef({ active: true, generation: 0, blocked: false });
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [mutationError, setMutationError] = useState<{ message: string; fields: AssetFieldErrors; key: string } | null>(null);
  const key = assetRouteKey(route);
  const { q, page, size, assetId, screen } = route;
  useLayoutEffect(() => { callbacks.current = options; });
  useLayoutEffect(() => {
    const current = life.current; current.active = true; current.generation++;
    return () => { current.active = false; current.generation++; };
  }, [key]);
  const fatal = useCallback((error: unknown): boolean => {
    if (!(error instanceof AssetApiError)) return false;
    if (error.status === 401 || (error.status === 403 && error.message !== m.csrfInvalid)) {
      life.current.blocked = true; life.current.generation++;
      setNotice(null); setMutationError(null);
      if (error.status === 401) callbacks.current.onSessionExpired(); else callbacks.current.onForbidden();
      return true;
    }
    if (error.status === 404) {
      setNotice({ kind: 'error', message: m.notFound });
      callbacks.current.onNavigate(assetUrl(parseQuery()), true);
      return true;
    }
    return false;
    function parseQuery() {
      const params = new URLSearchParams(window.location.search);
      return { q: params.get('q') || '', page: Number(params.get('page')) || 0, size: Number(params.get('size')) || 20 };
    }
  }, []);
  const loadList = useCallback((signal: AbortSignal) => listAssets({ q, page, size }, signal), [q, page, size]);
  const loadDetail = useCallback((signal: AbortSignal) => getAsset(assetId || '', signal), [assetId]);
  const list = useAssetResource(screen === 'list' && q.length <= 200 ? assetUrl({ q, page, size }) : null, loadList, fatal, m.listFailure);
  const detail = useAssetResource(assetId !== null ? assetId + '/' + screen : null, loadDetail, fatal, m.detailFailure, assetId);
  useEffect(() => {
    const data = list.data;
    if (screen === 'list' && list.status === 'ready' && data && page > 0 && page >= data.totalPages) {
      callbacks.current.onNavigate(assetUrl({ q, page: Math.max(0, data.totalPages - 1), size }, null, 'list', route.create), true);
    }
  }, [list.data, list.status, page, q, size, screen, route.create]);
  const source = screen === 'list' ? list : detail;
  const canMutate = source.status === 'ready' && !source.stale && !pending;
  const mutate = async (command: Mutation) => {
    if (lock.current || !canMutate || life.current.blocked) return;
    lock.current = true; setPending(true); setMutationError(null);
    const generation = life.current.generation;
    const current = () => life.current.active && !life.current.blocked && life.current.generation === generation;
    const navigateAfter = (asset?: Asset, uncertain = false) => {
      if (command.kind === 'create') {
        setNotice({ kind: uncertain ? 'error' : 'success', message: uncertain ? m.uncertain : m.createSuccess, assetId: asset?.assetId, uncertain });
        callbacks.current.onNavigate(assetUrl({ q, page: 0, size }), true); list.refresh();
      } else {
        setNotice({ kind: uncertain ? 'error' : 'success', message: uncertain ? m.uncertain : command.kind === 'edit' ? m.updateSuccess : m.conditionSuccess, uncertain });
        callbacks.current.onNavigate(assetUrl({ q, page, size }, command.id)); detail.refresh();
      }
    };
    try {
      if (command.kind === 'create') {
        const created = await createAsset(command.input, current);
        if (current()) navigateAfter(created);
      } else if (command.kind === 'edit') {
        const updated = await updateAsset(command.id, command.input, current);
        if (current()) navigateAfter(updated);
      } else {
        await recordAssetCondition(command.id, command.input, current);
        if (current()) navigateAfter();
      }
    } catch (error) {
      if (!current() || isAssetAbort(error)) return;
      if (error instanceof AssetApiError && error.phase === 'uncertain') navigateAfter(undefined, true);
      else if (!fatal(error)) setMutationError({ key, message: error instanceof AssetApiError ? error.message : m.saveFailure, fields: error instanceof AssetApiError ? error.fieldErrors : {} });
    } finally {
      lock.current = false;
      if (life.current.active) setPending(false);
    }
  };
  return { list, detail, pending, canMutate, mutate, notice, dismissNotice: () => setNotice(null), mutationError: mutationError?.key === key ? mutationError : null };
}
