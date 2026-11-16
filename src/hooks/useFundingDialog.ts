import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NavigationGuardRegistration } from './useServiceCatalog';
import { changeFundingSourceStatus, createFundingSource, FundingApiError, getDeactivationImpact, getFundingSource, isFundingAbort, listFundingSources, updateFundingSource } from '../services/fundingApi';
import { fundingMessages as m, type DeactivationImpact, type FundingAction, type FundingErrors, type FundingFields, type FundingNotice, type FundingSource, type SupportedBank } from '../types/fundingSource';
import { fundingFields, validateFundingFields } from '../utils/fundingValidation';
interface DialogState {
  loading: boolean; pending: boolean; snapshot: FundingSource | null; impact: DeactivationImpact | null;
  fields: FundingFields; errors: FundingErrors; error: string | null; blocked: boolean;
  latest: FundingSource | null; previousDraft: FundingFields | null; uncertain: boolean; verification: FundingSource[] | null;
  validationAttempt: number;
}
export function useFundingDialog({ action, sourceId, banks, banksReady, onFinished, onFailure, onClose, registerGuard }: {
  action: FundingAction; sourceId: string | null; banks: SupportedBank[]; banksReady: boolean;
  onFinished: (message: string, kind: FundingNotice['kind']) => void; onFailure: (e: unknown) => boolean;
  onClose: () => void; registerGuard: NavigationGuardRegistration;
}) {
  const [state, set] = useState<DialogState>({ loading: !action.startsWith('create-'), pending: false, snapshot: null, impact: null,
    fields: fundingFields(), errors: {}, error: null, blocked: false, latest: null, previousDraft: null, uncertain: false, verification: null, validationAttempt: 0 });
  const lock = useRef(false), life = useRef({ active: true, ended: false }), loadSequence = useRef(0);
  const callbacks = useRef({ onFinished, onFailure, onClose });
  useLayoutEffect(() => { callbacks.current = { onFinished, onFailure, onClose }; });
  useLayoutEffect(() => { life.current = { active: true, ended: false }; return () => { life.current.active = false; }; }, []);
  const current = useCallback(() => life.current.active && !life.current.ended, []);
  const finish = useCallback((message: string, kind: FundingNotice['kind']) => { life.current.ended = true; callbacks.current.onFinished(message, kind); }, []);
  const load = useCallback(async (signal?: AbortSignal, conflict = false) => {
    if (!sourceId) return;
    const sequence = ++loadSequence.current;
    const relevant = () => current() && !signal?.aborted && sequence === loadSequence.current;
    set(old => ({ ...old, loading: true, impact: null, error: conflict ? old.error : null }));
    try {
      const snapshot = await getFundingSource(sourceId, signal);
      if (!relevant()) return;
      if ((action === 'deactivate' && !snapshot.active) || (action === 'activate' && snapshot.active)) { finish('Trạng thái nguồn tiền đã thay đổi. Danh sách sẽ được cập nhật.', 'error'); return; }
      if (action === 'deactivate') {
        const impact = await getDeactivationImpact(sourceId, signal);
        if (!relevant()) return;
        if (!impact.active) { finish('Nguồn tiền đã ngừng hoạt động.', 'error'); return; }
        set(old => ({ ...old, snapshot, impact, loading: false, blocked: false }));
      } else if (conflict && action === 'edit') set(old => ({ ...old, latest: snapshot, loading: false, blocked: true }));
      else set(old => ({ ...old, snapshot, fields: fundingFields(snapshot), loading: false, blocked: false }));
    } catch (e) {
      if (!relevant() || isFundingAbort(e)) return;
      if (callbacks.current.onFailure(e)) return;
      if (e instanceof FundingApiError && e.status === 404) { finish(e.message, 'error'); return; }
      set(old => ({ ...old, loading: false, blocked: true, error: e instanceof Error ? e.message : m.detailFailure }));
    }
  }, [action, sourceId, current, finish]);
  useEffect(() => {
    if (action.startsWith('create-')) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => controller.abort();
  }, [action, load]);
  const dirty = (action === 'edit' || action.startsWith('create-')) && JSON.stringify(state.fields) !== JSON.stringify(fundingFields(state.snapshot ?? undefined));
  useLayoutEffect(() => {
    registerGuard(() => life.current.ended || !lock.current && (!dirty || window.confirm('Bỏ các thay đổi chưa lưu?')));
    return () => registerGuard(null);
  }, [dirty, registerGuard]);
  useEffect(() => {
    if (!dirty && !state.pending) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, state.pending]);
  const change = (key: keyof FundingFields, value: string, touched = false) => set(old => {
    const fields = { ...old.fields, [key]: value }, errors = { ...old.errors };
    if (touched || errors[key]) errors[key] = validateFundingFields(fields, action === 'create-bank' || !!old.snapshot?.canEditBankDetails, banksReady ? banks : undefined)[key];
    return { ...old, fields, errors };
  });
  const cancel = () => {
    if (lock.current) return;
    if (state.uncertain) finish(m.uncertain, 'error');
    else { life.current.ended = true; callbacks.current.onClose(); }
  };
  const review = () => set(old => old.latest ? { ...old, snapshot: old.latest, latest: null, previousDraft: old.fields,
    fields: { ...fundingFields(old.latest), ...(old.latest.hasTransactions ? { name: old.fields.name } : {}) }, errors: {}, error: null, blocked: false } : old);
  const submit = async () => {
    if (lock.current || state.loading || state.blocked || !current()) return;
    if (!action.startsWith('create-') && !state.snapshot) return;
    if (action === 'create-bank' && (!banksReady || !banks.length)) { set(old => ({ ...old, error: m.bankFailure })); return; }
    lock.current = true; set(old => ({ ...old, pending: true, errors: {}, error: null }));
    try {
      if (action.startsWith('create-')) await createFundingSource(action === 'create-bank' ? 'BANK' : 'CASH', state.fields, banks, current);
      else if (action === 'edit') await updateFundingSource(state.snapshot!, state.fields, banks, current);
      else await changeFundingSourceStatus(sourceId!, action === 'activate', action === 'deactivate' ? state.impact!.version : state.snapshot!.version, state.impact, current);
      if (current()) finish(action.startsWith('create-') ? m.createSuccess : action === 'edit' ? m.updateSuccess : action === 'activate' ? m.activateSuccess : m.deactivateSuccess, 'success');
    } catch (e) {
      if (!current() || isFundingAbort(e)) return;
      if (callbacks.current.onFailure(e)) { life.current.ended = true; return; }
      if (!(e instanceof FundingApiError) || e.phase === 'uncertain') { set(old => ({ ...old, blocked: true, uncertain: true, impact: null, error: m.uncertain })); return; }
      if (e.status === 404) { finish(e.message, 'error'); return; }
      set(old => ({ ...old, error: e.message, errors: e.fieldErrors, validationAttempt: old.validationAttempt + 1 }));
      if (['FUNDING_BANK_DETAILS_LOCKED', 'FUNDING_VERSION_STALE', 'FUNDING_IMPACT_CHANGED'].includes(e.code) || e.status === 409 && !['FUNDING_NAME_DUPLICATE', 'FUNDING_BANK_ACCOUNT_DUPLICATE'].includes(e.code)) {
        set(old => ({ ...old, blocked: true, impact: null })); await load(undefined, true);
      }
    } finally { lock.current = false; if (current()) set(old => ({ ...old, pending: false })); }
  };
  const verify = async () => {
    if (lock.current || !state.uncertain) return;
    lock.current = true; set(old => ({ ...old, pending: true }));
    try {
      const rows = sourceId ? [await getFundingSource(sourceId)] : await listFundingSources({ type: '', active: '' });
      if (current()) set(old => ({ ...old, verification: sourceId ? rows : rows.filter(s => s.name === old.fields.name.trim() || s.bankDetails?.accountNumber === old.fields.accountNumber.trim()), error: m.uncertain }));
    } catch (e) { if (current() && !isFundingAbort(e) && !callbacks.current.onFailure(e)) set(old => ({ ...old, error: m.uncertain + ' Không thể kiểm tra dữ liệu mới nhất. Vui lòng thử lại.' })); }
    finally { lock.current = false; if (current()) set(old => ({ ...old, pending: false })); }
  };
  return { ...state, dirty, change, cancel, review, submit, verify, retry: () => { if (!lock.current) void load(undefined, state.blocked && action === 'edit' && state.snapshot !== null); } };
}
