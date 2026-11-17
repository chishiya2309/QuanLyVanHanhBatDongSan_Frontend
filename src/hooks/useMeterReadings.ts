import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NavigationGuardRegistration } from './useServiceCatalog';
import { correctMeterReading, createMeterBatch, createMeterReading, getAllMeterItems, getMeterItems, getMeterProgress, getMeterReading, isMeterAbort, isMeterCsrf, MeterApiError } from '../services/meterApi';
import { sessionGuard } from '../services/sessionClient';
import { meterKey, meterMessages as m, type MeterCreate, type MeterDraft, type MeterItem, type MeterPage, type MeterProgress, type MeterResultState, type MeterRoute } from '../types/meterReading';
import { meterDraftErrors } from '../utils/meterDecimal';
import { meterScope, meterUrl } from '../utils/meterNavigation';

export interface MeterReceipt { item: MeterItem; state: MeterResultState | 'EXISTS' | 'NOT_SAVED'; message: string }
type Notice = { kind: 'success' | 'error' | 'info'; message: string };
export function useMeterReadings({ route, registerGuard, onSessionExpired }: {
  route: MeterRoute; registerGuard: NavigationGuardRegistration; onSessionExpired: (message?: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<MeterPage<MeterItem> | null>(null);
  const [progress, setProgress] = useState<MeterProgress | null>(null);
  const [listLoading, setListLoading] = useState(false), [progressLoading, setProgressLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null), [progressError, setProgressError] = useState<string | null>(null);
  const [listFresh, setListFresh] = useState(false), [progressFresh, setProgressFresh] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, MeterDraft>>({});
  const [receipts, setReceipts] = useState<Record<string, MeterReceipt>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false), [recovering, setRecovering] = useState(false);
  const [needsReconcile, setNeedsReconcile] = useState(false);
  const lock = useRef(false), alive = useRef(false), generation = useRef(0);
  const callbacks = useRef({ onSessionExpired });
  const reads = useRef<{ list?: AbortController; progress?: AbortController; reconcile?: AbortController }>({});
  const latest = useRef({ drafts, receipts, saving, needsReconcile });
  useLayoutEffect(() => { callbacks.current = { onSessionExpired }; latest.current = { drafts, receipts, saving, needsReconcile }; });
  useLayoutEffect(() => { alive.current = true; const controllers = reads.current, ticket = generation; return () => { alive.current = false; ticket.current++; Object.values(controllers).forEach((c) => c?.abort()); }; }, []);
  const makeGuard = useCallback(() => { const ticket = generation.current; return sessionGuard(() => alive.current && generation.current === ticket); }, []);
  const handleFatal = useCallback((error: unknown, knownMessage?: string) => {
    if (!(error instanceof MeterApiError) || isMeterCsrf(error) && error.status !== 401) return false;
    if (![401, 403, 404].includes(error.status)) return false;
    setSnapshot(null); setProgress(null); setDrafts({}); setReceipts({}); setActiveKey(null);
    setListFresh(false); setProgressFresh(false); setFatal(knownMessage ? error.message + ' ' + knownMessage : error.message);
    if (error.status === 401) callbacks.current.onSessionExpired(knownMessage ? error.message + ' ' + knownMessage : error.message);
    return true;
  }, []);
  const routeKey = meterUrl(route);
  const dirty = Object.values(drafts).some((d) => d.end !== (d.item.endIndex ?? '') || d.start !== '' || d.confirmed);
  useLayoutEffect(() => {
    registerGuard(() => {
      if (lock.current) return false;
      if ((dirty || needsReconcile) && !window.confirm(needsReconcile ? 'Một số kết quả lưu chưa được đối chiếu. Rời màn hình và bỏ dữ liệu chưa lưu?' : 'Bỏ các thay đổi chỉ số chưa lưu?')) return false;
      setDrafts({}); setActiveKey(null); return true;
    });
    return () => registerGuard(null);
  }, [dirty, needsReconcile, registerGuard]);
  useEffect(() => {
    if (!dirty && !saving && !needsReconcile) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving, needsReconcile]);

  const loadList = useCallback(async () => {
    if (route.invalid || (!route.periodIds.length && !route.readingId)) return;
    reads.current.list?.abort(); const controller = new AbortController(); reads.current.list = controller;
    const current = makeGuard(), href = window.location.href;
    setListLoading(true); setListFresh(false); setListError(null);
    try {
      const result = route.readingId
        ? { items: [await getMeterReading(route.readingId, controller.signal)], total: 1, page: 0, size: 20 }
        : await getMeterItems(meterScope(route), route.page, controller.signal);
      if (!current() || controller.signal.aborted) return;
      setSnapshot(result); setListFresh(true);
      setDrafts((old) => Object.fromEntries(Object.entries(old).map(([key, d]) => {
        const fresh = result.items.find((item) => meterKey(item) === key);
        return [key, fresh && fresh.version !== d.item.version ? { ...d, selected: false, reviewRequired: true } : d];
      })));
    } catch (e) {
      if (alive.current && href === window.location.href && e instanceof MeterApiError && e.status === 401) { handleFatal(e); return; }
      if (!current() || controller.signal.aborted || isMeterAbort(e)) return;
      if (!handleFatal(e)) setListError(e instanceof Error ? e.message : m.readFailure);
    } finally { if (current() && !controller.signal.aborted) setListLoading(false); }
  // The serialized route is the complete request identity, including navigation guards.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, makeGuard, handleFatal]);
  const loadProgress = useCallback(async () => {
    if (route.invalid || !route.periodIds.length) return;
    reads.current.progress?.abort(); const controller = new AbortController(); reads.current.progress = controller;
    const current = makeGuard(), href = window.location.href;
    setProgressLoading(true); setProgressFresh(false); setProgressError(null);
    try { const result = await getMeterProgress(meterScope(route), controller.signal); if (current() && !controller.signal.aborted) { setProgress(result); setProgressFresh(true); } }
    catch (e) {
      if (alive.current && href === window.location.href && e instanceof MeterApiError && e.status === 401) { handleFatal(e); return; }
      if (!current() || controller.signal.aborted || isMeterAbort(e)) return;
      if (!handleFatal(e)) setProgressError(e instanceof Error ? e.message : m.readFailure);
    } finally { if (current() && !controller.signal.aborted) setProgressLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, makeGuard, handleFatal]);
  const refresh = useCallback(async () => { await Promise.allSettled([loadList(), loadProgress()]); }, [loadList, loadProgress]);
  useEffect(() => {
    let active = true; const controllers = reads.current;
    void Promise.resolve().then(() => { if (active) void refresh(); });
    return () => { active = false; controllers.list?.abort(); controllers.progress?.abort(); };
  }, [refresh]);

  function begin(item: MeterItem) {
    if (lock.current || !listFresh || needsReconcile || !(item.readingId ? item.canUpdate : item.canCreate)) return;
    const key = meterKey(item);
    setDrafts((old) => ({ ...old, [key]: old[key] || { item, end: item.endIndex ?? '', start: '', confirmed: false, selected: false, reviewRequired: false, fields: {} } }));
    setActiveKey(key);
  }
  function change(item: MeterItem, patch: Partial<Pick<MeterDraft, 'end' | 'start' | 'confirmed' | 'selected'>>) {
    if (lock.current || needsReconcile || !listFresh) return;
    const key = meterKey(item);
    setDrafts((old) => {
      const draft = old[key] || { item, end: item.endIndex ?? '', start: '', confirmed: false, selected: false, reviewRequired: false, fields: {} };
      if (draft.reviewRequired || !(item.readingId ? item.canUpdate : item.canCreate)) return old;
      const next = { ...draft, selected: true, ...patch, fields: { ...draft.fields } };
      if (patch.start !== undefined) next.confirmed = false;
      delete next.fields.server;
      const errors = meterDraftErrors(item, next);
      for (const name of Object.keys(next.fields)) { if (errors[name]) next.fields[name] = errors[name]; else delete next.fields[name]; }
      return { ...old, [key]: next };
    });
  }
  function checkField(item: MeterItem, field: 'endIndex' | 'startIndex') {
    if (lock.current || needsReconcile) return;
    setDrafts((old) => {
      const key = meterKey(item), draft = old[key];
      if (!draft || draft.reviewRequired) return old;
      const errors = meterDraftErrors(item, draft), fields = { ...draft.fields };
      if (errors[field]) fields[field] = errors[field]; else delete fields[field];
      return { ...old, [key]: { ...draft, fields } };
    });
  }
  function discard(key?: string) {
    if (lock.current) return;
    setDrafts((old) => { if (!key) return {}; const next = { ...old }; delete next[key]; return next; });
    if (!key || key === activeKey) setActiveKey(null);
  }
  function review(item: MeterItem) {
    if (lock.current || needsReconcile || !listFresh) return;
    setDrafts((old) => {
      const key = meterKey(item), draft = old[key];
      if (!draft) return old;
      return { ...old, [key]: { ...draft, item, start: '', confirmed: false, selected: false, reviewRequired: false, fields: {} } };
    });
    setNotice({ kind: 'info', message: 'Đã dùng bối cảnh mới. Kiểm tra chỉ số đầu và cuối, rồi chủ động lưu hoặc chọn lại mục.' });
  }
  function patchSaved(items: MeterItem[]) {
    const saved = new Map(items.map((item) => [meterKey(item), item]));
    setSnapshot((old) => old ? { ...old, items: old.items.map((item) => saved.get(meterKey(item)) || item) } : old);
    setDrafts((old) => Object.fromEntries(Object.entries(old).filter(([key]) => !saved.has(key))));
    setActiveKey((old) => old && saved.has(old) ? null : old);
    setProgressFresh(false); setListFresh(false);
  }
  async function save(batch: boolean, singleKey?: string) {
    if (lock.current || !listFresh || needsReconcile || fatal) return;
    const selected = Object.entries(latest.current.drafts).filter(([key, d]) => batch ? d.selected && !d.item.readingId : key === singleKey);
    if (!selected.length) { setNotice({ kind: 'error', message: 'Nhập hoặc chọn ít nhất một mục cần lưu.' }); return; }
    const valid: [string, MeterDraft][] = [], invalid: Record<string, MeterDraft> = {};
    const pairs = selected.map(([, d]) => meterKey(d.item));
    for (const [key, d] of selected) {
      const fields = meterDraftErrors(d.item, d);
      if (d.reviewRequired) fields.context = m.stale;
      if (!(d.item.readingId ? d.item.canUpdate : d.item.canCreate)) fields.context = 'Mục này hiện không được phép lưu.';
      if (pairs.filter((pair) => pair === meterKey(d.item)).length > 1) fields.context = 'Các mục trùng kỳ và dịch vụ đều phải được kiểm tra lại.';
      if (Object.keys(fields).length) invalid[key] = { ...d, fields }; else valid.push([key, d]);
    }
    setDrafts((old) => ({ ...old, ...invalid }));
    const localFailed = Object.keys(invalid).length;
    if (!valid.length) { setNotice({ kind: 'error', message: 'Không có mục nào được lưu. Kiểm tra lỗi tại từng mục.' }); return; }
    lock.current = true; setSaving(true); setNotice(null);
    const current = makeGuard(), href = window.location.href;
    const toCreate = (d: MeterDraft): MeterCreate => ({ periodId: d.item.periodId, roomServiceId: d.item.roomServiceId, endIndex: d.end, version: d.item.version,
      ...(d.item.initialStartAllowed ? { startIndex: d.start } : {}) });
    try {
      if (batch) {
        const result = await createMeterBatch(valid.map(([, d]) => toCreate(d)), current);
        if (!current()) return;
        const next: Record<string, MeterReceipt> = {};
        for (const r of result.results) {
          const [key, d] = valid[r.index];
          next[key] = { item: r.saved || d.item, state: r.state, message: r.message || 'Xem lại kết quả của mục này.' };
        }
        setReceipts((old) => ({ ...old, ...next }));
        patchSaved(result.results.flatMap((r) => r.saved ? [r.saved] : []));
        setDrafts((old) => {
          const changed = { ...old };
          for (const r of result.results) {
            const key = valid[r.index][0], d = changed[key];
            if (d) changed[key] = { ...d, selected: false, reviewRequired: r.state === 'UNKNOWN' || r.state === 'NOT_PROCESSED' || r.status === 409,
              fields: r.state === 'FAILED' ? { server: r.message || 'Không thể lưu mục này.' } : {} };
          }
          return changed;
        });
        const ambiguous = result.results.some((r) => r.state === 'UNKNOWN' || r.state === 'NOT_PROCESSED');
        setNeedsReconcile(ambiguous);
        const message = result.outcome === 'INTERRUPTED' ? `Quá trình bị gián đoạn. Đã xác nhận lưu ${result.saved} mục. Tải lại để đối chiếu phần còn lại.`
          : result.saved === 0 ? 'Không có mục nào được lưu. Xem nguyên nhân tại từng mục.'
          : result.failed || localFailed ? `Đã lưu ${result.saved} mục; ${result.failed + localFailed} mục chưa được lưu. Chỉ chọn lại các mục đã khắc phục.`
          : `Đã lưu tất cả ${result.saved} mục đã gửi.`;
        setNotice({ kind: result.saved ? ambiguous || result.failed || localFailed ? 'info' : 'success' : 'error', message });
        const denied = result.results.find((r) => r.status === 401 || r.status === 403);
        if (denied) { handleFatal(new MeterApiError(denied.status!, denied.status === 401 ? m.sessionInvalid : m.forbidden), message); return; }
        await refresh();
      } else {
        const [key, d] = valid[0];
        const item = d.item.readingId ? await correctMeterReading(d.item.readingId, { endIndex: d.end, version: d.item.version }, current) : await createMeterReading(toCreate(d), current);
        if (!current()) return;
        patchSaved([item]);
        setReceipts((old) => ({ ...old, [key]: { item, state: 'SAVED', message: d.item.readingId ? 'Đã cập nhật chỉ số.' : 'Đã lưu chỉ số.' } }));
        setNotice({ kind: 'success', message: d.item.readingId ? 'Đã cập nhật chỉ số.' : 'Đã lưu chỉ số.' });
        await refresh();
      }
    } catch (e) {
      if (alive.current && href === window.location.href && e instanceof MeterApiError && e.status === 401) { handleFatal(e); return; }
      if (!current() || isMeterAbort(e)) return;
      if (handleFatal(e)) return;
      const uncertain = e instanceof MeterApiError && e.phase === 'uncertain';
      if (e instanceof MeterApiError && e.status === 409) setListFresh(false);
      const message = e instanceof Error ? e.message : 'Không thể lưu chỉ số.';
      setNotice({ kind: 'error', message });
      if (uncertain) setNeedsReconcile(true);
      setDrafts((old) => {
        const next = { ...old };
        for (const [key] of valid) if (next[key]) next[key] = { ...next[key], selected: false, reviewRequired: uncertain || e instanceof MeterApiError && e.status === 409,
          fields: { ...(e instanceof MeterApiError ? e.fieldErrors : {}), server: message } };
        return next;
      });
      if (uncertain) setReceipts((old) => ({ ...old, ...Object.fromEntries(valid.map(([key, d]) => [key, { item: d.item, state: 'UNKNOWN' as const, message: m.uncertain }])) }));
    } finally { lock.current = false; if (alive.current) setSaving(false); }
  }
  async function reconcile() {
    if (lock.current || fatal) return;
    lock.current = true; setRecovering(true);
    reads.current.reconcile?.abort(); const controller = new AbortController(); reads.current.reconcile = controller;
    const current = makeGuard(), href = window.location.href;
    try {
      const all = route.readingId ? [await getMeterReading(route.readingId, controller.signal)] : await getAllMeterItems(meterScope(route), controller.signal);
      if (!current()) return;
      const uncertain = Object.entries(latest.current.receipts).filter(([, r]) => r.state === 'UNKNOWN' || r.state === 'NOT_PROCESSED');
      const next: Record<string, MeterReceipt> = {};
      let unresolved = false;
      for (const [key, receipt] of uncertain) {
        const item = all.find((item) => meterKey(item) === key);
        if (!item) { unresolved = true; continue; }
        next[key] = { item, state: item.readingId ? 'EXISTS' : 'NOT_SAVED', message: item.readingId ? 'Đã có bản ghi thực tế. Kiểm tra giá trị đã lưu; không gửi tạo mới lại.' : 'Đã đối chiếu: chưa có bản ghi. Kiểm tra bối cảnh mới và chủ động chọn lại nếu đủ điều kiện.' };
        if (!receipt.item.readingId && item.readingId || receipt.item.readingId) {
          setDrafts((old) => { const changed = { ...old }; delete changed[key]; return changed; });
        } else setDrafts((old) => old[key] ? { ...old, [key]: { ...old[key], selected: false, reviewRequired: true } } : old);
      }
      setReceipts((old) => ({ ...old, ...next })); setNeedsReconcile(unresolved);
      setNotice({ kind: 'info', message: unresolved ? 'Một số mục không còn xuất hiện trong phạm vi. Chưa thể xác định đầy đủ kết quả.' : 'Đã đối chiếu dữ liệu thực tế. Kiểm tra kết quả từng mục trước khi thao tác tiếp.' });
      await refresh();
    } catch (e) {
      if (alive.current && href === window.location.href && e instanceof MeterApiError && e.status === 401) { handleFatal(e); return; }
      if (!current() || isMeterAbort(e)) return;
      if (!handleFatal(e)) setNotice({ kind: 'error', message: 'Chưa thể đối chiếu kết quả. Dữ liệu chưa được gửi lại. Vui lòng tải lại.' });
    } finally { lock.current = false; if (alive.current) setRecovering(false); }
  }
  return { snapshot, progress, listLoading, progressLoading, listError, progressError, listFresh, progressFresh,
    drafts, receipts, activeKey, notice, fatal, saving, recovering, needsReconcile, begin, change, checkField, discard, review,
    refresh, reconcile, save, makeGuard, handleFatal, setNotice };
}
