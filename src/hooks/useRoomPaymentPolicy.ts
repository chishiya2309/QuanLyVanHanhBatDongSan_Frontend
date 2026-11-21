import { useCallback, useEffect, useRef, useState } from 'react';
import type { NavigationGuardRegistration } from './useServiceCatalog';
import { FundingApiError, listFundingSources } from '../services/fundingApi';
import { applyRoomPaymentPolicy, getPaymentTargets, getRoomPaymentPolicy, isPaymentAbort, PaymentPolicyApiError, saveRoomPaymentPolicy } from '../services/roomPaymentPolicyApi';
import { paymentMessages as m, type PaymentDraft, type PaymentErrors, type PaymentSource, type RoomPaymentPolicy } from '../types/roomPaymentPolicy';
import { paymentDraft, validatePaymentDraft } from '../utils/roomPaymentPolicyValidation';

type Choice = { rows: PaymentSource[]; status: 'loading' | 'ready' | 'error'; error: string | null };
type State = {
  snapshot: RoomPaymentPolicy | null; draft: PaymentDraft; previousDraft: PaymentDraft | null;
  loading: boolean; pending: 'save' | 'apply' | null; error: string | null; errors: PaymentErrors; notice: string | null;
  blocked: boolean; uncertain: 'save' | 'apply' | null; verified: boolean;
  batchOpen: boolean; targets: RoomPaymentPolicy[] | null; targetLoading: boolean; targetError: string | null;
  selected: string[]; all: boolean; confirm: boolean;
};
const initial = (): State => ({ snapshot: null, draft: paymentDraft(), previousDraft: null, loading: true,
  pending: null, error: null, errors: {}, notice: null, blocked: false, uncertain: null, verified: false,
  batchOpen: false, targets: null, targetLoading: false, targetError: null, selected: [], all: false, confirm: false });
const dirtyState = (s: State) => JSON.stringify(s.draft) !== JSON.stringify(paymentDraft(s.snapshot));
interface Options {
  roomId: string; allowed: boolean; registerGuard: NavigationGuardRegistration;
  onSessionExpired: (message: string) => void; onForbidden: (message: string) => void; onMissing: (message: string) => void;
}
export function useRoomPaymentPolicy(options: Options) {
  const { roomId, allowed, registerGuard } = options;
  const callbacks = useRef(options); callbacks.current = options;
  const [state, setState] = useState(initial);
  const stateRef = useRef(state); stateRef.current = state;
  const [choices, setChoices] = useState<Record<'CASH' | 'BANK', Choice>>({ CASH: { rows: [], status: 'loading', error: null }, BANK: { rows: [], status: 'loading', error: null } });
  const choicesRef = useRef(choices); choicesRef.current = choices;
  const life = useRef({ active: false, ended: false, generation: 0 });
  const lock = useRef(false), read = useRef<AbortController | null>(null), targetRead = useRef<AbortController | null>(null);
  const sourceReads = useRef<{ CASH?: AbortController; BANK?: AbortController }>({});
  const current = useCallback(() => life.current.active && !life.current.ended, []);
  const accessFailure = useCallback((e: unknown, source = false) => {
    if (!(e instanceof PaymentPolicyApiError || e instanceof FundingApiError) || e.phase === 'csrf') return false;
    if (e.status !== 401 && !(e.status === 403 && e.code === 'FORBIDDEN') && !(e.status === 404 && source)) return false;
    life.current.ended = true;
    if (e.status === 401) callbacks.current.onSessionExpired(m.session);
    else if (e.status === 403) callbacks.current.onForbidden(m.forbidden);
    else callbacks.current.onMissing(m.notFound);
    return true;
  }, []);
  const available = useCallback(() => ({ CASH: choicesRef.current.CASH.status === 'ready' ? choicesRef.current.CASH.rows : null,
    BANK: choicesRef.current.BANK.status === 'ready' ? choicesRef.current.BANK.rows : null }), []);
  const loadSources = useCallback((only?: 'CASH' | 'BANK') => {
    for (const type of only ? [only] : ['CASH', 'BANK'] as const) {
      sourceReads.current[type]?.abort(); const controller = new AbortController(); sourceReads.current[type] = controller;
      setChoices(old => ({ ...old, [type]: { ...old[type], status: 'loading', error: null } }));
      void listFundingSources({ type, active: 'true' }, controller.signal).then(rows => {
        if (!current() || controller.signal.aborted) return;
        if (rows.some(r => r.type !== type || !r.active)) throw new Error('Wrong funding choices');
        setChoices(old => ({ ...old, [type]: { rows, status: 'ready', error: null } }));
      }).catch(e => {
        if (!current() || controller.signal.aborted || isPaymentAbort(e) || accessFailure(e)) return;
        setChoices(old => ({ ...old, [type]: { ...old[type], status: 'error', error: m.sources } }));
      });
    }
  }, [accessFailure, current]);
  const load = useCallback(async () => {
    if (lock.current || !current()) return;
    read.current?.abort(); targetRead.current?.abort(); const controller = new AbortController(); read.current = controller;
    const generation = ++life.current.generation, before = stateRef.current;
    setState(old => ({ ...old, loading: true, error: null, confirm: false, verified: false }));
    try {
      const snapshot = await getRoomPaymentPolicy(roomId, controller.signal);
      const needsTargets = before.batchOpen || before.uncertain === 'apply';
      const targets = needsTargets ? await getPaymentTargets(snapshot, controller.signal) : null;
      if (!current() || generation !== life.current.generation || controller.signal.aborted) return;
      setState(old => ({ ...old, snapshot, draft: paymentDraft(snapshot), loading: false, blocked: false,
        previousDraft: dirtyState(before) ? before.draft : old.previousDraft, errors: {}, selected: [], all: false,
        targets, targetLoading: false, targetError: null, verified: Boolean(old.uncertain), error: old.uncertain ? m.uncertain : null }));
    } catch (e) {
      if (!current() || generation !== life.current.generation || controller.signal.aborted || isPaymentAbort(e)) return;
      // A batch target 404 is not evidence that the source room is missing.
      if (e instanceof PaymentPolicyApiError && e.status === 404) {
        try { await getRoomPaymentPolicy(roomId, controller.signal); }
        catch (sourceError) { if (current() && !controller.signal.aborted && accessFailure(sourceError, true)) return; }
      } else if (accessFailure(e, true)) return;
      if (!current() || controller.signal.aborted) return;
      setState(old => ({ ...old, loading: false, targetLoading: false, blocked: true,
        error: (old.notice ? old.notice + ' Chưa thể tải lại dữ liệu. ' : '') + (old.uncertain ? m.uncertain : m.read) }));
    }
  }, [accessFailure, current, roomId]);
  const loadTargets = useCallback(async (source: RoomPaymentPolicy) => {
    targetRead.current?.abort(); const controller = new AbortController(); targetRead.current = controller;
    setState(old => ({ ...old, targetLoading: true, targetError: null, confirm: false, selected: [], all: false }));
    try {
      const targets = await getPaymentTargets(source, controller.signal);
      if (current() && !controller.signal.aborted) setState(old => ({ ...old, targets, targetLoading: false }));
    } catch (e) {
      if (!current() || controller.signal.aborted || isPaymentAbort(e) || accessFailure(e)) return;
      setState(old => ({ ...old, targetLoading: false, targets: null, targetError: e instanceof PaymentPolicyApiError ? e.message : m.targetRead }));
    }
  }, [accessFailure, current]);
  useEffect(() => {
    const lifeRef = life.current;
    const reads = sourceReads.current;
    lifeRef.active = true; lifeRef.ended = false;
    if (allowed) { void load(); loadSources(); }
    else { lifeRef.ended = true; callbacks.current.onForbidden(m.forbidden); }
    return () => {
      lifeRef.active = false; lifeRef.generation++; read.current?.abort(); targetRead.current?.abort();
      reads.CASH?.abort(); reads.BANK?.abort();
    };
  }, [allowed, load, loadSources]);
  useEffect(() => {
    const permit = () => life.current.ended || !lock.current && (!dirtyState(stateRef.current) || window.confirm('Bỏ các thay đổi chưa lưu?'));
    registerGuard(permit);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!life.current.ended && (lock.current || dirtyState(stateRef.current))) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { registerGuard(null); window.removeEventListener('beforeunload', beforeUnload); };
  }, [registerGuard]);
  const writeFailure = (e: unknown, batch: boolean) => {
    if (!current() || isPaymentAbort(e) || accessFailure(e, !batch)) return;
    const failure = e instanceof PaymentPolicyApiError ? e : new PaymentPolicyApiError(0, 'PAYMENT_UNCERTAIN', m.uncertain, {}, 'uncertain');
    const uncertain = failure.phase === 'uncertain';
    setState(old => ({ ...old, pending: null, confirm: false, notice: null, errors: failure.fieldErrors,
      error: failure.message, blocked: uncertain || failure.status === 409 || failure.status === 404,
      uncertain: uncertain ? batch ? 'apply' : 'save' : null, verified: false }));
    if (failure.status === 400) loadSources();
  };
  const edit = (field: keyof PaymentDraft, value: boolean | string | null) => {
    const s = stateRef.current;
    if (lock.current || s.loading || s.blocked || s.uncertain || s.batchOpen) return;
    setState(old => {
      const draft = { ...old.draft, [field]: value };
      if (!draft.allowCash) draft.cashDefaultId = null;
      if (!draft.allowTransfer) draft.bankDefaultId = null;
      return { ...old, draft, error: null, notice: null, errors: Object.keys(old.errors).length ? validatePaymentDraft(draft, available(), old.snapshot) : {} };
    });
  };
  const validateField = (field: keyof PaymentDraft) => {
    const s = stateRef.current;
    const errors = validatePaymentDraft(s.draft, available(), s.snapshot);
    setState(old => ({ ...old, errors: { ...old.errors, [field]: errors[field] } }));
  };
  const save = async () => {
    const s = stateRef.current;
    if (lock.current || !s.snapshot || s.loading || s.blocked || s.uncertain || s.batchOpen) return;
    const errors = validatePaymentDraft(s.draft, available(), s.snapshot);
    if (Object.keys(errors).length) { setState(old => ({ ...old, errors, error: m.invalid })); return; }
    lock.current = true; setState(old => ({ ...old, pending: 'save', error: null, errors: {}, notice: null }));
    try {
      const snapshot = await saveRoomPaymentPolicy(s.snapshot, s.draft, current);
      if (current()) setState(old => ({ ...old, snapshot, draft: paymentDraft(snapshot), previousDraft: null,
        pending: null, notice: m.saved, errors: {}, error: null }));
    } catch (e) { writeFailure(e, false); }
    finally { lock.current = false; }
  };
  const beginBatch = () => {
    const s = stateRef.current;
    if (lock.current || s.loading || s.blocked || s.uncertain) return;
    if (dirtyState(s)) { setState(old => ({ ...old, error: m.dirtyApply })); return; }
    if (!s.snapshot?.configured) { setState(old => ({ ...old, error: 'Vui lòng lưu cấu hình phòng mẫu trước khi áp dụng.' })); return; }
    const errors = validatePaymentDraft(paymentDraft(s.snapshot), available(), s.snapshot);
    if (Object.keys(errors).length) { setState(old => ({ ...old, errors, error: 'Cấu hình mẫu cần được kiểm tra lại nguồn tiền trước khi áp dụng.' })); return; }
    setState(old => ({ ...old, batchOpen: true, confirm: false, error: null, errors: {} }));
    void loadTargets(s.snapshot);
  };
  const prepare = () => {
    const s = stateRef.current;
    if (lock.current || s.loading || s.blocked || s.uncertain || s.targetLoading || !s.targets?.length) return;
    if (!s.all && !s.selected.length) { setState(old => ({ ...old, errors: { ...old.errors, roomIds: m.targets } })); return; }
    setState(old => ({ ...old, confirm: true, error: null, errors: {} }));
  };
  const apply = async () => {
    const s = stateRef.current;
    if (lock.current || !s.confirm || !s.snapshot || s.blocked || s.uncertain || dirtyState(s)) return;
    lock.current = true; setState(old => ({ ...old, pending: 'apply', error: null, notice: null }));
    let succeeded = false;
    try {
      const result = await applyRoomPaymentPolicy(s.snapshot, s.all, s.all ? [] : s.selected, current);
      if (current()) {
        succeeded = true;
        setState(old => ({ ...old, pending: null, confirm: false, selected: [], all: false,
          notice: result.count ? `Đã áp dụng cấu hình thanh toán cho ${result.count} phòng.` : 'Không có phòng đích để áp dụng cấu hình.' }));
      }
    } catch (e) { writeFailure(e, true); }
    finally { lock.current = false; }
    if (succeeded) await load();
  };
  const reload = () => {
    if (lock.current) return;
    const s = stateRef.current;
    if (!s.blocked && !s.uncertain && dirtyState(s) && !window.confirm('Bỏ các thay đổi chưa lưu để tải lại?')) return;
    void load(); loadSources();
  };
  const closeBatch = () => {
    if (lock.current) return;
    targetRead.current?.abort();
    setState(old => ({ ...old, batchOpen: false, confirm: false, selected: [], all: false, targets: null, targetLoading: false, targetError: null,
      errors: { ...old.errors, roomIds: undefined } }));
  };
  return { ...state, choices, dirty: dirtyState(state), edit, validateField, save, beginBatch, prepare, apply, reload, loadSources,
    reloadTargets: () => { const s = stateRef.current; if (!lock.current && !s.blocked && !s.uncertain && s.snapshot) void loadTargets(s.snapshot); },
    closeBatch,
    cancel: (exit: () => void) => { if (!lock.current) { life.current.ended = true; exit(); } },
    discard: () => { if (!lock.current) setState(old => ({ ...old, draft: paymentDraft(old.snapshot), errors: {}, error: null, previousDraft: null })); },
    select: (id: string, checked: boolean) => { if (!lock.current) setState(old => ({ ...old, selected: checked ? [...new Set([...old.selected, id])] : old.selected.filter(x => x !== id), errors: {}, confirm: false })); },
    selectAll: (all: boolean) => { if (!lock.current) setState(old => ({ ...old, all, selected: [], errors: {}, confirm: false })); },
    closeConfirmation: () => { if (!lock.current) setState(old => ({ ...old, confirm: false })); },
    acknowledge: () => { if (!lock.current && stateRef.current.verified) setState(old => ({ ...old, uncertain: null, verified: false, blocked: false, error: null, notice: 'Đã đối chiếu cấu hình hiện tại. Bạn có thể tiếp tục thao tác.' })); },
  };
}
export type RoomPaymentController = ReturnType<typeof useRoomPaymentPolicy>;
