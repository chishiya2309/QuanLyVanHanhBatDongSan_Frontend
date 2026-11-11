import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CustomerAccountApiError, getCustomerAccount, lockCustomerAccount, provisionCustomerAccount, unlockCustomerAccount } from '../services/customerAccountApi';
import { isCustomerAbort } from '../services/customerApi';
import { customerAccountMessages as m, type CustomerAccountAction, type CustomerAccountFieldErrors, type CustomerAccountResponse, type ProvisionCustomerAccountFields } from '../types/customerAccount';
import type { NavigationGuardRegistration } from './useServiceCatalog';
import { validateCustomerAccount } from '../utils/customerAccountValidation';

export function useCustomerAccount(customerId: string, onFailure: (error: unknown) => boolean) {
  const [account, setAccount] = useState<CustomerAccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const failure = useRef(onFailure);
  const sequence = useRef(0);
  useLayoutEffect(() => { failure.current = onFailure; });
  useEffect(() => {
    const requestId = ++sequence.current;
    const controller = new AbortController(); let active = true;
    void (async () => {
      await Promise.resolve(); if (!active) return;
      setLoading(true); setError(null);
      try {
        const result = await getCustomerAccount(customerId, controller.signal, () => active && sequence.current === requestId);
        if (active && sequence.current === requestId) { setAccount(result); setLoading(false); }
      } catch (err) {
        if (!active || sequence.current !== requestId || isCustomerAbort(err)) return;
        if (!failure.current(err)) { setError(err instanceof CustomerAccountApiError ? err.message : m.detailFailure); setLoading(false); }
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [customerId, revision]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const update = useCallback((value: CustomerAccountResponse) => {
    sequence.current++; setAccount(value); setLoading(false); setError(null);
  }, []);
  return { account, loading, error, refresh, update };
}

interface DialogOptions {
  customerId: string;
  contactEmail: string | null;
  action: NonNullable<CustomerAccountAction>;
  registerGuard?: NavigationGuardRegistration;
  onFailure: (error: unknown) => boolean;
  onUpdated: (account: CustomerAccountResponse) => void;
  onProfileRefresh: () => void;
  onFinished: (account: CustomerAccountResponse, message: string, kind: 'success' | 'error') => void;
  onClose: () => void;
}

const emptyFields = (): ProvisionCustomerAccountFields => ({ email: '', password: '', confirmPassword: '' });
const firstFieldError = (errors: CustomerAccountFieldErrors) =>
  (['email', 'password', 'confirmPassword'] as const).find((key) => errors[key]) ?? null;

export function useCustomerAccountDialog(options: DialogOptions) {
  const { customerId, contactEmail, action, registerGuard } = options;
  const callbacks = useRef(options);
  useLayoutEffect(() => { callbacks.current = options; });
  const life = useRef({ active: true, ended: false });
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const initialEmail = useRef(contactEmail || '');
  const [fields, setFields] = useState<ProvisionCustomerAccountFields>(() => ({ ...emptyFields(), email: contactEmail || '' }));
  const [errors, setErrors] = useState<CustomerAccountFieldErrors>({});
  const [snapshot, setSnapshot] = useState<CustomerAccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const dirty = action === 'provision' && (fields.email !== initialEmail.current || !!fields.password || !!fields.confirmPassword);

  useLayoutEffect(() => {
    life.current = { active: true, ended: false };
    return () => { life.current.active = false; controller.current?.abort(); };
  }, []);
  const current = useCallback(() => life.current.active && !life.current.ended, []);
  const finish = useCallback((result: CustomerAccountResponse, message: string, kind: 'success' | 'error' = 'error') => {
    life.current.ended = true;
    setFields(emptyFields());
    callbacks.current.onFinished(result, message, kind);
  }, []);
  const fatal = useCallback((err: unknown) => {
    if (!(err instanceof CustomerAccountApiError) || !(err.status === 401 || err.status === 404 || err.status === 403 && err.message === m.forbidden)) return false;
    life.current.ended = true; setFields(emptyFields());
    return callbacks.current.onFailure(err);
  }, []);
  const read = useCallback(async (signal?: AbortSignal) => {
    const result = await getCustomerAccount(customerId, signal, current);
    if (!current()) return;
    callbacks.current.onUpdated(result);
    if (action === 'provision' && result.hasAccount) { finish(result, m.alreadyHasAccount); return; }
    if (action !== 'provision' && !result.hasAccount) { finish(result, m.noAccount); return; }
    if (action === 'lock' && result.status === 'LOCKED') { finish(result, m.alreadyLocked); return; }
    if (action === 'unlock' && result.status === 'ACTIVE') { finish(result, m.alreadyActive); return; }
    setSnapshot(result); setLoading(false); setBlocked(false); setError(null); setErrors({});
  }, [customerId, action, current, finish]);
  useEffect(() => {
    const abortController = new AbortController(); let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      try { await read(abortController.signal); }
      catch (err) {
        if (!active || !current() || isCustomerAbort(err) || fatal(err)) return;
        setLoading(false); setError(err instanceof CustomerAccountApiError ? err.message : m.detailFailure);
      }
    });
    return () => { active = false; abortController.abort(); };
  }, [read, current, fatal]);

  const canLeave = useCallback(() => life.current.ended || !lock.current && (!dirty || window.confirm('Bỏ thông tin cấp tài khoản chưa lưu?')), [dirty]);
  useLayoutEffect(() => {
    registerGuard?.(canLeave);
    return () => registerGuard?.(null);
  }, [registerGuard, canLeave]);
  useEffect(() => {
    if (!dirty && !pending) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [dirty, pending]);
  const close = () => {
    if (!canLeave()) return;
    life.current.ended = true; setFields(emptyFields()); callbacks.current.onClose();
  };
  const reload = async () => {
    if (lock.current || !current()) return;
    lock.current = true; setLoading(true);
    controller.current = new AbortController();
    try {
      await read(controller.current.signal);
      if (current()) callbacks.current.onProfileRefresh();
    } catch (err) {
      if (!current() || isCustomerAbort(err) || fatal(err)) return;
      setLoading(false); setBlocked(true); setError(err instanceof CustomerAccountApiError ? err.message : m.detailFailure);
    } finally { lock.current = false; }
  };
  const change = (key: keyof ProvisionCustomerAccountFields, value: string, validate = false) => {
    setFields((old) => ({ ...old, [key]: value }));
    setErrors((old) => ({ ...old, [key]: validate ? validateCustomerAccount({ ...fields, [key]: value })[key] : undefined }));
  };
  const submit = async (): Promise<keyof ProvisionCustomerAccountFields | null> => {
    if (lock.current || loading || blocked || !snapshot || !current()) return null;
    if (action === 'provision') {
      const invalid = validateCustomerAccount(fields);
      setErrors(invalid);
      if (Object.keys(invalid).length) return firstFieldError(invalid);
    }
    lock.current = true; setPending(true); setError(null); setErrors({});
    controller.current = new AbortController();
    try {
      const result = action === 'provision'
        ? await provisionCustomerAccount(customerId, { ...fields, customerVersion: snapshot.customerVersion }, controller.current.signal, current)
        : action === 'lock' ? await lockCustomerAccount(customerId, controller.current.signal, current)
          : await unlockCustomerAccount(customerId, controller.current.signal, current);
      if (current()) {
        finish(result, action === 'provision' ? m.provisionSuccess : action === 'lock' ? m.lockSuccess : m.unlockSuccess, 'success');
      }
    } catch (err) {
      if (!current() || isCustomerAbort(err) || fatal(err)) return null;
      if (err instanceof CustomerAccountApiError) {
        setError(err.message); setErrors(err.fieldErrors);
        if (err.phase === 'uncertain' || err.message === m.stale || err.message === m.wrongRole) setBlocked(true);
        if ([m.alreadyHasAccount, m.noAccount, m.alreadyLocked, m.alreadyActive].some((message) => message === err.message)) {
          setBlocked(true);
          try { await read(controller.current.signal); }
          catch (readError) {
            if (current() && !isCustomerAbort(readError) && !fatal(readError)) setError(m.detailFailure);
          }
        }
        return firstFieldError(err.fieldErrors);
      }
      setBlocked(true); setError(m.uncertain);
    } finally {
      lock.current = false;
      if (current()) setPending(false);
    }
    return null;
  };
  return { fields, errors, snapshot, loading, pending, error, blocked, change, close, reload, submit };
}
