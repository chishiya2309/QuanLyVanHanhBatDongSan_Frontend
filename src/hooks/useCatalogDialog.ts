import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { catalogMessages as m, type CatalogAction, type CatalogFields, type CatalogFieldErrors, type CatalogService, type CatalogNotice } from '../types/serviceCatalog';
import { CatalogApiError, changeCatalogServiceStatus, createCatalogService, getCatalogService, isCatalogAbort, updateCatalogService } from '../services/serviceCatalogApi';
import { catalogFields, validateCatalogFields } from '../utils/serviceCatalogValidation';
import type { NavigationGuardRegistration } from './useServiceCatalog';

export function useCatalogDialog({ action, serviceId, onFinished, onFailure, registerGuard }: {
  action: CatalogAction; serviceId: string | null; onFinished: (message: string, kind?: CatalogNotice['kind']) => void;
  onFailure: (error: unknown) => boolean; registerGuard: NavigationGuardRegistration;
}) {
  const [state, set] = useState<{ loading: boolean; snapshot: CatalogService | null; latest: CatalogService | null; fields: CatalogFields;
    previousDraft: CatalogFields | null; error: string | null; errors: CatalogFieldErrors; blocked: boolean; pending: boolean }>({
    loading: action !== 'create', snapshot: null, latest: null, fields: catalogFields(), previousDraft: null, error: null, errors: {}, blocked: false, pending: false,
  });
  const [reload, setReload] = useState(0); const lock = useRef(false); const life = useRef({ active: true, ended: false });
  const callbacks = useRef({ onFinished, onFailure });
  useLayoutEffect(() => { callbacks.current = { onFinished, onFailure }; });
  useLayoutEffect(() => { life.current = { active: true, ended: false }; return () => { life.current.active = false; }; }, []);
  const finish = useCallback((message: string, kind: CatalogNotice['kind'] = 'error') => {
    life.current.ended = true; callbacks.current.onFinished(message, kind);
  }, []);
  useEffect(() => {
    if (action === 'create' || !serviceId) return;
    const controller = new AbortController(); let active = true;
    void (async () => {
      await Promise.resolve(); if (!active) return;
      set((old) => ({ ...old, loading: true, error: null }));
      try {
        const item = await getCatalogService(serviceId, controller.signal);
        if (!active) return;
        if ((action === 'activate' || action === 'deactivate') && item.active === (action === 'activate')) { finish(m.statusConflict); return; }
        set((old) => ({ ...old, loading: false, snapshot: item, fields: catalogFields(item), blocked: action === 'activate' && item.pricingStatus === 'UNCONFIGURED',
          error: action === 'activate' && item.pricingStatus === 'UNCONFIGURED' ? m.priceRequired : null }));
      } catch (error) {
        if (!active || isCatalogAbort(error)) return;
        if (callbacks.current.onFailure(error)) return;
        if (error instanceof CatalogApiError && error.status === 404) finish(error.message);
        else set((old) => ({ ...old, loading: false, error: error instanceof Error ? error.message : m.detailFailure }));
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [action, serviceId, reload, finish]);
  const dirty = (action === 'create' || action === 'edit') && JSON.stringify(state.fields) !== JSON.stringify(catalogFields(state.snapshot ?? undefined));
  useLayoutEffect(() => {
    const guard = () => life.current.ended || !lock.current && (!dirty || window.confirm('Bỏ các thay đổi chưa lưu?'));
    registerGuard(guard);
    return () => registerGuard(null);
  }, [dirty, registerGuard]);
  useEffect(() => {
    if (!dirty && !state.pending) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, state.pending]);
  const change = (key: keyof CatalogFields, value: string, validate = false) => set((old) => {
    const fields = { ...old.fields, [key]: value };
    const errors = { ...old.errors };
    if (validate || errors[key]) errors[key] = validateCatalogFields(fields)[key];
    return { ...old, fields, errors };
  });
  const reviewLatest = () => set((old) => old.latest ? { ...old, previousDraft: { ...old.fields }, snapshot: old.latest, latest: null,
    fields: catalogFields(old.latest), error: null, errors: {}, blocked: false } : old);
  const retryConflict = async () => {
    if (!state.snapshot || state.loading || lock.current) return;
    set((old) => ({ ...old, loading: true }));
    try {
      const latest = await getCatalogService(state.snapshot.id);
      if (life.current.active && !life.current.ended) set((old) => ({ ...old, latest, loading: false, error: m.stale }));
    } catch (error) {
      if (!life.current.active || life.current.ended || isCatalogAbort(error)) return;
      if (callbacks.current.onFailure(error)) return;
      if (error instanceof CatalogApiError && error.status === 404) finish(error.message);
      else set((old) => ({ ...old, loading: false, error: m.stale + '. ' + m.detailFailure }));
    }
  };
  const submit = async () => {
    if (lock.current || state.loading || state.blocked || life.current.ended || action !== 'create' && !state.snapshot) return;
    if (action === 'create' || action === 'edit') {
      const errors = validateCatalogFields(state.fields);
      if (Object.keys(errors).length) { set((old) => ({ ...old, errors })); return; }
    }
    const snapshot = state.snapshot; lock.current = true;
    set((old) => ({ ...old, pending: true, error: null, errors: {} }));
    const current = () => life.current.active && !life.current.ended;
    try {
      if (action === 'create') await createCatalogService(state.fields, current);
      else if (snapshot && action === 'edit') await updateCatalogService(snapshot.id, state.fields, snapshot.version, current);
      else if (snapshot) await changeCatalogServiceStatus(snapshot.id, action === 'activate', snapshot.version, current);
      if (current()) finish(action === 'create' ? m.createSuccess : action === 'edit' ? m.updateSuccess : action === 'activate' ? m.activateSuccess : m.deactivateSuccess, 'success');
    } catch (error) {
      if (!current() || isCatalogAbort(error)) return;
      if (callbacks.current.onFailure(error)) { life.current.ended = true; return; }
      if (!(error instanceof CatalogApiError) || error.phase === 'uncertain') { finish(m.uncertain); return; }
      if (error.status === 404) { finish(error.message); return; }
      if (error.status === 409 && error.message === m.stale && action === 'edit' && snapshot) {
        set((old) => ({ ...old, blocked: true, error: error.message }));
        try {
          const latest = await getCatalogService(snapshot.id);
          if (current()) set((old) => ({ ...old, latest }));
        } catch (readError) {
          if (!current() || isCatalogAbort(readError)) return;
          if (!callbacks.current.onFailure(readError)) {
            if (readError instanceof CatalogApiError && readError.status === 404) finish(readError.message);
            else set((old) => ({ ...old, error: m.stale + '. ' + m.detailFailure }));
          }
        }
      } else if (error.status === 409 && (action === 'activate' || action === 'deactivate') && error.message !== m.priceRequired) {
        let message: string = error.message;
        if (error.currentActive !== undefined) message += error.currentActive ? '. Trạng thái hiện tại: Đang bật.' : '. Trạng thái hiện tại: Đã tắt.';
        finish(message);
      } else set((old) => ({ ...old, error: error.message, errors: error.fieldErrors,
        blocked: error.status === 409 && (error.message === m.priceConflict || error.message === m.priceRequired) }));
    } finally { lock.current = false; if (life.current.active) set((old) => ({ ...old, pending: false })); }
  };
  return { ...state, dirty, change, reviewLatest, retryConflict, submit, retry: () => setReload((value) => value + 1) };
}
