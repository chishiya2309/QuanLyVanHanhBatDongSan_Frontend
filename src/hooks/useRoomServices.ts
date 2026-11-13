import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NavigationGuardRegistration } from './useServiceCatalog';
import {
  getAvailableRoomServices,
  getRoomServices,
  isRoomServiceAbort,
  RoomServiceApiError,
  writeRoomService,
} from '../services/roomServiceApi';
import { sessionGuard } from '../services/sessionClient';
import { catalogMoney } from '../utils/serviceCatalogValidation';
import {
  roomServiceMessages as m,
  type RoomServiceCandidate,
  type RoomServiceItem,
  type RoomServices,
  type RoomServiceWrite,
} from '../types/roomServices';

type Draft =
  | { kind: 'add'; serviceId: string; version: string; reviewRequired: boolean }
  | { kind: 'price'; item: RoomServiceItem; value: string; reviewRequired: boolean };
type Trust = 'fresh' | 'blocked' | 'uncertain' | 'saved' | 'fatal';
type Notice = { kind: 'success' | 'error' | 'info'; message: string };
export function useRoomServices({
  roomId,
  registerGuard,
  onSessionExpired,
}: {
  roomId: string;
  registerGuard: NavigationGuardRegistration;
  onSessionExpired: () => void;
}) {
  const [snapshot, setSnapshot] = useState<RoomServices | null>(null);
  const [loading, setLoading] = useState(true);
  const [trust, setTrust] = useState<Trust>('blocked');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [available, setAvailable] = useState<RoomServiceCandidate[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [availableError, setAvailableError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const lock = useRef(false);
  const life = useRef({ active: true });
  const reads = useRef<{ list?: AbortController; choices?: AbortController }>({});
  const callbacks = useRef({ onSessionExpired });
  useLayoutEffect(() => {
    callbacks.current = { onSessionExpired };
  });
  useLayoutEffect(() => {
    const context = { active: true };
    life.current = context;
    const controllers = reads.current;
    return () => {
      context.active = false;
      controllers.list?.abort();
      controllers.choices?.abort();
    };
  }, []);
  const contextGuard = useCallback(() => {
    const context = life.current;
    return sessionGuard(() => context.active);
  }, []);
  const fatalError = useCallback((failure: unknown): boolean => {
    if (!(failure instanceof RoomServiceApiError) || failure.phase === 'csrf') return false;
    if (
      failure.status === 401 ||
      failure.status === 404 ||
      (failure.status === 403 && failure.message !== m.csrfInvalid)
    ) {
      setSnapshot(null);
      setDraft(null);
      setAvailable([]);
      setTrust('fatal');
      setError(failure.message);
      if (failure.status === 401) callbacks.current.onSessionExpired();
      return true;
    }
    return false;
  }, []);

  const load = useCallback(
    async (reason: 'normal' | 'saved' | 'uncertain' = 'normal') => {
      reads.current.list?.abort();
      const controller = new AbortController();
      reads.current.list = controller;
      const current = contextGuard();
      const context = life.current,
        page = window.location.href;
      setLoading(true);
      setError(null);
      if (reason === 'normal') setTrust('blocked');
      try {
        const result = await getRoomServices(roomId, controller.signal);
        if (!current() || controller.signal.aborted) return;
        setSnapshot(result);
        setTrust('fresh');
        setLoading(false);
        if (reason === 'uncertain')
          setNotice({
            kind: 'info',
            message:
              'Đã tải lại cấu hình hiện tại. Hãy đối chiếu kết quả và mở lại thao tác nếu cần.',
          });
      } catch (failure) {
        // Confirmed refresh expiry invalidates the session epoch before throwing.
        if (
          context.active &&
          page === window.location.href &&
          failure instanceof RoomServiceApiError &&
          failure.status === 401
        ) {
          setLoading(false);
          fatalError(failure);
          return;
        }
        if (!current() || controller.signal.aborted || isRoomServiceAbort(failure)) return;
        setLoading(false);
        if (fatalError(failure)) return;
        setTrust(reason === 'saved' ? 'saved' : reason === 'uncertain' ? 'uncertain' : 'blocked');
        setError(
          reason === 'saved'
            ? m.savedReloadFailure
            : reason === 'uncertain'
              ? m.uncertain
              : failure instanceof Error
                ? failure.message
                : m.getFailure,
        );
      }
    },
    [roomId, contextGuard, fatalError],
  );

  const loadAvailable = useCallback(async () => {
    reads.current.choices?.abort();
    const controller = new AbortController();
    reads.current.choices = controller;
    const current = contextGuard();
    const context = life.current,
      page = window.location.href;
    setAvailableLoading(true);
    setAvailableError(null);
    setAvailable([]);
    try {
      const result = await getAvailableRoomServices(roomId, controller.signal);
      if (!current() || controller.signal.aborted) return;
      setAvailable(result.services);
      setAvailableLoading(false);
    } catch (failure) {
      if (
        context.active &&
        page === window.location.href &&
        failure instanceof RoomServiceApiError &&
        failure.status === 401
      ) {
        setAvailableLoading(false);
        fatalError(failure);
        return;
      }
      if (!current() || controller.signal.aborted || isRoomServiceAbort(failure)) return;
      setAvailableLoading(false);
      if (!fatalError(failure))
        setAvailableError(failure instanceof Error ? failure.message : m.availableFailure);
    }
  }, [roomId, contextGuard, fatalError]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const dirty =
    draft?.kind === 'add'
      ? Boolean(draft.serviceId)
      : draft?.kind === 'price'
        ? draft.value !== (draft.item.roomPrice ?? '')
        : false;
  useLayoutEffect(() => {
    registerGuard(() => !lock.current && (!dirty || window.confirm('Bỏ các thay đổi chưa lưu?')));
    return () => registerGuard(null);
  }, [dirty, registerGuard]);
  useEffect(() => {
    if (!dirty && !saving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, saving]);

  const canWrite = trust === 'fresh' && !loading && !saving;
  function cancel() {
    if (lock.current) return;
    reads.current.choices?.abort();
    setDraft(null);
    setFields({});
  }
  function openAdd() {
    if (!canWrite || lock.current || (dirty && !window.confirm('Bỏ các thay đổi chưa lưu?')))
      return;
    setDraft({ kind: 'add', serviceId: '', version: '', reviewRequired: false });
    setFields({});
    setNotice(null);
    setError(null);
    void loadAvailable();
  }
  function openPrice(item: RoomServiceItem) {
    if (!canWrite || lock.current || (dirty && !window.confirm('Bỏ các thay đổi chưa lưu?')))
      return;
    reads.current.choices?.abort();
    setDraft({ kind: 'price', item, value: item.roomPrice ?? '', reviewRequired: false });
    setFields({});
    setNotice(null);
    setError(null);
  }
  function choose(serviceId: string) {
    const candidate = available.find((item) => item.serviceId === serviceId);
    if (draft?.kind !== 'add' || saving || draft.reviewRequired) return;
    setDraft({ ...draft, serviceId, version: candidate?.version ?? '' });
    setFields({});
  }
  function changePrice(value: string) {
    if (draft?.kind !== 'price' || saving || draft.reviewRequired) return;
    setDraft({ ...draft, value });
    setFields({});
  }
  async function save(action: RoomServiceWrite) {
    if (!canWrite || lock.current) return;
    lock.current = true;
    setSaving(true);
    setPendingId(action.kind === 'add' ? action.serviceId : action.item.serviceId);
    setFields({});
    setNotice(null);
    setError(null);
    const current = contextGuard();
    const context = life.current,
      page = window.location.href;
    try {
      const { item: result, message } = await writeRoomService(roomId, action, current);
      if (!current()) return;
      setSnapshot((old) =>
        old
          ? {
              ...old,
              services: old.services.some((item) => item.serviceId === result.serviceId)
                ? old.services.map((item) => (item.serviceId === result.serviceId ? result : item))
                : [...old.services, result],
            }
          : old,
      );
      setDraft(null);
      setTrust('saved');
      const unchanged = message === 'Dịch vụ đã ở trạng thái được yêu cầu';
      setNotice({
        kind: 'success',
        message:
          action.kind === 'add'
            ? 'Thêm dịch vụ riêng thành công'
            : (unchanged
                ? 'Dịch vụ đã ở trạng thái được yêu cầu. '
                : 'Cấu hình dịch vụ đã được lưu. ') + m.cycle,
      });
      await load('saved');
    } catch (failure) {
      if (
        context.active &&
        page === window.location.href &&
        failure instanceof RoomServiceApiError &&
        failure.status === 401
      ) {
        setSaving(false);
        setPendingId(null);
        fatalError(failure);
        return;
      }
      if (!current() || isRoomServiceAbort(failure)) return;
      if (fatalError(failure)) return;
      if (failure instanceof RoomServiceApiError) {
        setFields(failure.fieldErrors);
        if (failure.phase === 'uncertain') {
          setTrust('uncertain');
          setError(m.uncertain);
          setDraft((old) => (old ? { ...old, reviewRequired: true } : old));
        } else if (failure.status === 409) {
          if (failure.message === m.duplicate) {
            setNotice({ kind: 'error', message: failure.message });
            setDraft(null);
            await load();
          } else if (failure.message === m.ineligible && action.kind === 'add') {
            setNotice({ kind: 'error', message: failure.message });
            setDraft({ kind: 'add', serviceId: '', version: '', reviewRequired: false });
            await loadAvailable();
          } else {
            setTrust('blocked');
            setDraft((old) => (old ? { ...old, reviewRequired: true } : old));
            setError(failure.message);
          }
        } else setError(failure.message);
      } else {
        // A client failure after dispatch cannot prove rollback.
        setTrust('uncertain');
        setError(m.uncertain);
        setDraft((old) => (old ? { ...old, reviewRequired: true } : old));
      }
    } finally {
      lock.current = false;
      if (current()) {
        setSaving(false);
        setPendingId(null);
      }
    }
  }
  function submit() {
    if (!draft || draft.reviewRequired || !canWrite || lock.current) return;
    if (draft.kind === 'add') {
      if (!draft.serviceId || !draft.version) {
        setFields({ serviceId: m.serviceRequired });
        return;
      }
      if (availableLoading || availableError) return;
      void save({ kind: 'add', serviceId: draft.serviceId, version: draft.version });
    } else {
      const unitPrice = catalogMoney(draft.value);
      if (unitPrice === null) {
        setFields({ unitPrice: m.priceInvalid });
        return;
      }
      void save({ kind: 'price', item: draft.item, unitPrice });
    }
  }
  function toggle(item: RoomServiceItem) {
    if (item.serviceSource !== 'ROOM_PRIVATE' || draft) return;
    void save({ kind: 'status', item, enabled: !item.enabled });
  }
  function reload() {
    if (lock.current || trust === 'fatal') return;
    setDraft((old) => (old ? { ...old, reviewRequired: true } : old));
    void load(trust === 'saved' ? 'saved' : trust === 'uncertain' ? 'uncertain' : 'normal');
  }
  return {
    snapshot,
    loading,
    trust,
    error,
    notice,
    draft,
    fields,
    available,
    availableLoading,
    availableError,
    saving,
    pendingId,
    canWrite,
    dirty,
    openAdd,
    openPrice,
    choose,
    changePrice,
    cancel,
    submit,
    toggle,
    reload,
    loadAvailable,
  };
}
