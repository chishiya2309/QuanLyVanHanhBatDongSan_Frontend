import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AssetApiError, createAsset, getAsset, getAssetHistory, isAssetAbort, listAssets, recordAssetCondition, updateAsset } from '../services/assetsApi';
import { assetMessages as m, type Asset, type AssetFieldErrors, type AssetRoute, type CreateAssetInput, type RecordConditionInput, type UpdateAssetInput } from '../types/assets';
import { assetRouteKey, assetUrl } from '../utils/assetNavigation';

import { useAssetResource } from './useAssetResource';
interface Notice { kind: 'success' | 'error'; message: string; assetId?: string; uncertain?: boolean }
type Mutation = { kind: 'create'; input: CreateAssetInput } | { kind: 'edit'; id: string; input: UpdateAssetInput } | { kind: 'condition'; id: string; input: RecordConditionInput };
interface Options { onNavigate: (url: string, replace?: boolean) => void; onSessionExpired: () => void; onForbidden: () => void }

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
  const loadHistory = useCallback((signal: AbortSignal) => getAssetHistory(assetId || '', signal), [assetId]);
  const listKey = assetUrl({ q, page, size });
  const list = useAssetResource(screen === 'list' && q.length <= 200 ? listKey : null, loadList, fatal, m.listFailure, assetUrl({ q, page, size }));
  const detail = useAssetResource(assetId !== null ? assetId + '/' + screen : null, loadDetail, fatal, m.detailFailure, assetId);
  const history = useAssetResource(screen === 'history' && assetId !== null ? key : null, loadHistory, fatal, m.historyFailure);
  useEffect(() => {
    if (!route.invalidPlacement) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setNotice({ kind: 'error', message: m.placementSelectionInvalid });
      callbacks.current.onNavigate(assetUrl(route, assetId, screen), true);
    });
    return () => { active = false; };
  }, [route, assetId, screen]);
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
  const finishPlacement = (message: string, uncertain = false, toList = false) => {
    setNotice({ kind: uncertain || message !== m.assignSuccess && message !== m.transferSuccess ? 'error' : 'success', message });
    callbacks.current.onNavigate(assetUrl(route, toList ? null : assetId, toList ? 'list' : screen), true);
    list.refresh(); detail.refresh(); history.refresh();
  };
  const handlePlacementFailure = (error: unknown) => {
    const handled = fatal(error);
    if (handled && error instanceof AssetApiError && error.status === 404) {
      list.refresh(); detail.refresh(); history.refresh();
    }
    return handled;
  };
  return { list, detail, history, pending, canMutate, mutate, notice, finishPlacement, handleFailure: handlePlacementFailure,
    dismissNotice: () => setNotice(null), mutationError: mutationError?.key === key ? mutationError : null };
}
