import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthApiError } from '../services/authApi';
import { getHostAccount, listHostAccounts, lockHostAccount, unlockHostAccount } from '../services/hostAccountsApi';
import { hostAccountMessages as m, type HostAccountAction, type HostAccountConfirmation, type HostAccountDetail, type HostAccountSummary } from '../types/hostAccounts';

interface Resource<T> { data: T | null; status: 'idle' | 'loading' | 'ready' | 'error'; error: string | null; stale: boolean; }
const initial = <T,>(): Resource<T> => ({ data: null, status: 'idle', error: null, stale: false });
interface Callbacks { onSessionExpired: () => void; onForbidden: () => void; onNavigate: (accountId: string | null) => void; }
const isTargetError = (message: string) => [m.notFound, m.wrongRole, m.profileMissing].some((value) => value === message);

export function useHostAccounts(accountId: string | null, callbacks: Callbacks) {
  const [list, setList] = useState<Resource<HostAccountSummary[]>>(initial);
  const [detail, setDetail] = useState<Resource<HostAccountDetail>>(initial);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [confirmation, setConfirmation] = useState<HostAccountConfirmation | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [isMutating, setMutating] = useState(false);
  const callbacksRef = useRef(callbacks);
  const aliveRef = useRef(false);
  const epochRef = useRef(0);
  const listSeqRef = useRef(0);
  const detailSeqRef = useRef(0);
  const listAbortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const prepareAbortRef = useRef<AbortController | null>(null);
  const preparingRef = useRef(false);
  const mutatingRef = useRef(false);
  const activeIdRef = useRef(accountId);
  const blockedRef = useRef(false);
  useEffect(() => { callbacksRef.current = callbacks; }, [callbacks]);

  const fatal = useCallback((error: unknown): boolean => {
    if (!(error instanceof AuthApiError) || (error.status !== 401 && !(error.status === 403 && error.message !== m.csrfInvalid))) return false;
    blockedRef.current = true; epochRef.current++;
    listAbortRef.current?.abort(); detailAbortRef.current?.abort(); prepareAbortRef.current?.abort();
    setList(initial()); setDetail(initial()); setConfirmation(null); setNotice(null);
    if (error.status === 401) callbacksRef.current.onSessionExpired(); else callbacksRef.current.onForbidden();
    return true;
  }, []);
  const loadList = useCallback(async (): Promise<boolean> => {
    if (blockedRef.current) return false;
    const epoch = epochRef.current; const sequence = ++listSeqRef.current;
    listAbortRef.current?.abort(); const controller = new AbortController(); listAbortRef.current = controller;
    setList((previous) => ({ ...previous, status: 'loading', error: null, stale: !!previous.data }));
    try {
      const data = await listHostAccounts(controller.signal);
      if (!aliveRef.current || epoch !== epochRef.current || sequence !== listSeqRef.current) return false;
      setList({ data, status: 'ready', error: null, stale: false }); return true;
    } catch (error) {
      if (!aliveRef.current || epoch !== epochRef.current || sequence !== listSeqRef.current || (error instanceof Error && error.name === 'AbortError')) return false;
      if (!fatal(error)) setList((previous) => ({ ...previous, status: 'error', stale: !!previous.data, error: error instanceof AuthApiError ? error.message : m.listFailure }));
      return false;
    }
  }, [fatal]);
  const targetFailure = useCallback((message: string) => {
    setConfirmation(null); setDetail(initial()); setNotice({ kind: 'error', message });
    callbacksRef.current.onNavigate(null);
  }, []);
  const loadDetail = useCallback(async (id: string): Promise<boolean> => {
    if (blockedRef.current) return false;
    const epoch = epochRef.current; const sequence = ++detailSeqRef.current;
    detailAbortRef.current?.abort(); const controller = new AbortController(); detailAbortRef.current = controller;
    setDetail((previous) => ({ data: previous.data?.accountId === id ? previous.data : null, status: 'loading', error: null, stale: true }));
    try {
      const data = await getHostAccount(id, controller.signal);
      if (!aliveRef.current || epoch !== epochRef.current || sequence !== detailSeqRef.current || activeIdRef.current !== id) return false;
      setDetail({ data, status: 'ready', error: null, stale: false }); return true;
    } catch (error) {
      if (!aliveRef.current || epoch !== epochRef.current || sequence !== detailSeqRef.current || (error instanceof Error && error.name === 'AbortError')) return false;
      if (!fatal(error)) {
        const message = error instanceof AuthApiError ? error.message : m.detailFailure;
        if (isTargetError(message)) targetFailure(message);
        else setDetail((previous) => ({ ...previous, status: 'error', error: message, stale: !!previous.data }));
      }
      return false;
    }
  }, [fatal, targetFailure]);

  useEffect(() => {
    const epoch = epochRef;
    aliveRef.current = true;
    return () => { aliveRef.current = false; epoch.current++; listAbortRef.current?.abort(); detailAbortRef.current?.abort(); prepareAbortRef.current?.abort(); };
  }, []);
  useEffect(() => {
    epochRef.current++; activeIdRef.current = accountId;
    listAbortRef.current?.abort(); detailAbortRef.current?.abort(); prepareAbortRef.current?.abort();
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setConfirmation(null);
      setList((previous) => previous.status === 'loading' ? initial() : previous);
      if (accountId === null) void loadList(); else void loadDetail(accountId);
    });
    return () => { cancelled = true; };
  }, [accountId, loadList, loadDetail]);

  const refresh = useCallback(async () => {
    await Promise.all([loadList(), activeIdRef.current ? loadDetail(activeIdRef.current) : Promise.resolve(true)]);
  }, [loadList, loadDetail]);
  const source = accountId === null ? list : detail;
  const canMutate = source.status === 'ready' && !source.stale && !list.stale && list.status !== 'error' && list.status !== 'loading' && !preparingId && !isMutating;

  const prepare = async (id: string, action: HostAccountAction, trigger: HTMLElement | null) => {
    if (!canMutate || preparingRef.current || mutatingRef.current || blockedRef.current) return;
    preparingRef.current = true; setPreparingId(id); setNotice(null);
    const epoch = epochRef.current; const controller = new AbortController(); prepareAbortRef.current = controller;
    try {
      const account = await getHostAccount(id, controller.signal);
      if (!aliveRef.current || epoch !== epochRef.current) return;
      const expected = action === 'lock' ? 'ACTIVE' : 'LOCKED';
      if (account.status !== expected) { setNotice({ kind: 'error', message: action === 'lock' ? m.alreadyLocked : m.alreadyActive }); await refresh(); }
      else setConfirmation({ account, action, trigger });
    } catch (error) {
      if (!aliveRef.current || epoch !== epochRef.current || (error instanceof Error && error.name === 'AbortError')) return;
      if (!fatal(error)) {
        const message = error instanceof AuthApiError ? error.message : m.detailFailure;
        if (isTargetError(message)) { targetFailure(message); if (activeIdRef.current === null) await loadList(); }
        else setNotice({ kind: 'error', message });
      }
    } finally { preparingRef.current = false; if (aliveRef.current) setPreparingId(null); }
  };
  const confirm = async () => {
    if (!confirmation || mutatingRef.current || blockedRef.current) return;
    mutatingRef.current = true; setMutating(true);
    const epoch = epochRef.current; const { account, action } = confirmation;
    try {
      await (action === 'lock' ? lockHostAccount(account.accountId) : unlockHostAccount(account.accountId));
      if (!aliveRef.current || epoch !== epochRef.current) return;
      setConfirmation(null); setNotice({ kind: 'success', message: action === 'lock' ? m.lockSuccess : m.unlockSuccess });
      await refresh();
    } catch (error) {
      if (!aliveRef.current || epoch !== epochRef.current) return;
      if (!fatal(error)) {
        const message = error instanceof AuthApiError ? error.message : action === 'lock' ? m.lockFailure : m.unlockFailure;
        setConfirmation(null);
        if (isTargetError(message)) { targetFailure(message); if (activeIdRef.current === null) await loadList(); }
        else { setNotice({ kind: 'error', message }); await refresh(); }
      }
    } finally { mutatingRef.current = false; if (aliveRef.current) setMutating(false); }
  };
  const cancel = () => { if (!mutatingRef.current) setConfirmation(null); };
  return { list, detail, notice, confirmation, preparingId, isMutating, canMutate, prepare, confirm, cancel, refresh,
    retry: refresh };
}
