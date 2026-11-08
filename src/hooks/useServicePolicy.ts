import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NavigationGuardRegistration } from './useServiceCatalog';
import {
  servicePolicyMessages as m,
  type BuildingLookupItem,
  type ChargeMethod,
  type PolicyFieldErrors,
  type ServicePolicy,
  type ServicePolicyNotice,
  type ServicePolicyRoute,
} from '../types/servicePolicy';
import {
  getServicePolicy,
  isPolicyAbort,
  lookupHostBuildings,
  ServicePolicyApiError,
  updateServicePolicy,
} from '../services/servicePolicyApi';
import { servicePolicyUrl } from '../utils/servicePolicyNavigation';
import {
  calculatePolicyDiff,
  createPolicyDraft,
  isDraftDirty,
  validatePolicyDraft,
  type ServicePolicyDraft,
} from '../utils/servicePolicyValidation';

export function useServicePolicy({
  route,
  onNavigate,
  onSessionExpired,
  onForbidden,
  registerGuard,
}: {
  route: ServicePolicyRoute;
  onNavigate: (url: string, replace?: boolean) => void;
  onSessionExpired: () => void;
  onForbidden: () => void;
  registerGuard: NavigationGuardRegistration;
}) {
  const serviceId = route.serviceId;
  const [loading, setLoading] = useState<boolean>(Boolean(serviceId));
  const [snapshot, setSnapshot] = useState<ServicePolicy | null>(null);
  const [latestSnapshot, setLatestSnapshot] = useState<ServicePolicy | null>(null);
  const [draft, setDraft] = useState<ServicePolicyDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ServicePolicyNotice | null>(null);
  const [fieldErrors, setFieldErrors] = useState<PolicyFieldErrors>({});
  const [saving, setSaving] = useState<boolean>(false);

  // Buildings lookup state
  const [buildingsLoading, setBuildingsLoading] = useState<boolean>(false);
  const [buildingsList, setBuildingsList] = useState<BuildingLookupItem[]>([]);
  const [buildingsError, setBuildingsError] = useState<string | null>(null);
  const [buildingsRevision, setBuildingsRevision] = useState<number>(0);
  const [policyRevision, setPolicyRevision] = useState<number>(0);

  const lock = useRef<boolean>(false);
  const life = useRef({ active: true, ended: false });
  const callbacks = useRef({ onSessionExpired, onForbidden });

  useLayoutEffect(() => {
    callbacks.current = { onSessionExpired, onForbidden };
  });

  useLayoutEffect(() => {
    life.current = { active: true, ended: false };
    return () => {
      life.current.active = false;
    };
  }, []);

  // Normalize invalid route
  useEffect(() => {
    if (!route.invalid) return;
    onNavigate(servicePolicyUrl({ serviceId: null, q: route.q, state: route.state }), true);
    void Promise.resolve().then(() => setNotice({ kind: 'error', message: m.invalidRoute }));
  }, [route, onNavigate]);

  // Fetch host buildings lookup
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setBuildingsLoading(true);
      setBuildingsError(null);
      try {
        const items = await lookupHostBuildings(controller.signal);
        if (active) {
          setBuildingsList(items);
          setBuildingsLoading(false);
        }
      } catch (err: unknown) {
        if (!active || isPolicyAbort(err)) return;
        setBuildingsLoading(false);
        setBuildingsError(err instanceof Error ? err.message : m.buildingsFailure);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [buildingsRevision]);

  // Load policy for the current serviceId
  useEffect(() => {
    if (!serviceId) {
      void Promise.resolve().then(() => {
        setLoading(false);
        setSnapshot(null);
        setLatestSnapshot(null);
        setDraft(null);
      });
      return;
    }

    const controller = new AbortController();
    let active = true;

    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setError(null);
      setNotice(null);
      setFieldErrors({});
      setLatestSnapshot(null);

      try {
        const data = await getServicePolicy(serviceId, controller.signal);
        if (active) {
          setSnapshot(data);
          setDraft(createPolicyDraft(data));
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!active || isPolicyAbort(err)) return;
        setLoading(false);
        if (err instanceof ServicePolicyApiError) {
          if (err.status === 401) {
            callbacks.current.onSessionExpired();
            return;
          }
          if (err.status === 403) {
            callbacks.current.onForbidden();
            return;
          }
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : m.getFailure);
        }
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [serviceId, policyRevision]);

  // Unsaved changes navigation guard
  const dirty = isDraftDirty(snapshot, draft);

  useLayoutEffect(() => {
    const guard = () => {
      if (life.current.ended) return true;
      if (lock.current) return false;
      if (!dirty) return true;
      return window.confirm('Bỏ các thay đổi chưa lưu?');
    };
    registerGuard(guard);
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

  // Draft update actions
  const setMethod = useCallback((method: ChargeMethod) => {
    setDraft((old) => (old ? { ...old, method } : old));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.method;
      return next;
    });
  }, []);

  const setDefaultPrice = useCallback((defaultPrice: string) => {
    setDraft((old) => (old ? { ...old, defaultPrice } : old));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.defaultPrice;
      return next;
    });
  }, []);

  const setProrate = useCallback((prorate: boolean | null) => {
    setDraft((old) => (old ? { ...old, prorate } : old));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.prorate;
      return next;
    });
  }, []);

  const setExistingBuildingFlag = useCallback((buildingId: string, flag: boolean) => {
    setDraft((old) => {
      if (!old) return old;
      return {
        ...old,
        existingBuildingFlags: {
          ...old.existingBuildingFlags,
          [buildingId]: flag,
        },
      };
    });
  }, []);

  const addNewBuilding = useCallback((building: BuildingLookupItem) => {
    setDraft((old) => {
      if (!old) return old;
      const next = new Map(old.newBuildings);
      if (!next.has(building.id)) {
        next.set(building.id, { building, defaultForNewRoom: null });
      }
      return { ...old, newBuildings: next };
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.buildings;
      return next;
    });
  }, []);

  const removeNewBuilding = useCallback((buildingId: string) => {
    setDraft((old) => {
      if (!old) return old;
      const next = new Map(old.newBuildings);
      next.delete(buildingId);
      return { ...old, newBuildings: next };
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`newBuilding_${buildingId}`];
      return next;
    });
  }, []);

  const setNewBuildingFlag = useCallback((buildingId: string, flag: boolean | null) => {
    setDraft((old) => {
      if (!old) return old;
      const item = old.newBuildings.get(buildingId);
      if (!item) return old;
      const next = new Map(old.newBuildings);
      next.set(buildingId, { ...item, defaultForNewRoom: flag });
      return { ...old, newBuildings: next };
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`newBuilding_${buildingId}`];
      return next;
    });
  }, []);

  // When conflict (409) occurs, Host can apply the latest snapshot
  const applyLatestSnapshot = useCallback(() => {
    if (!latestSnapshot) return;
    setSnapshot(latestSnapshot);
    setDraft(createPolicyDraft(latestSnapshot));
    setLatestSnapshot(null);
    setError(null);
    setFieldErrors({});
  }, [latestSnapshot]);

  // Submit policy
  const submit = async () => {
    if (lock.current || saving || loading || !snapshot || !draft || !serviceId) return;

    const diff = calculatePolicyDiff(snapshot, draft);
    if (!diff.hasChanges || !diff.payload) {
      setError(m.noChanges);
      return;
    }

    const validation = validatePolicyDraft(snapshot, draft, diff);
    if (Object.keys(validation.errors).length > 0) {
      setFieldErrors(validation.errors);
      if (validation.firstErrorField) {
        const el = document.getElementById(validation.firstErrorField) || document.querySelector(`[name="${validation.firstErrorField}"]`);
        if (el instanceof HTMLElement) el.focus();
      }
      return;
    }

    lock.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    setFieldErrors({});

    const current = () => life.current.active && !life.current.ended;

    try {
      const updated = await updateServicePolicy(serviceId, diff.payload, current);
      if (!current()) return;
      setSnapshot(updated);
      setDraft(createPolicyDraft(updated));
      setNotice({ kind: 'success', message: m.saveSuccess });
    } catch (err: unknown) {
      if (!current() || isPolicyAbort(err)) return;

      if (err instanceof ServicePolicyApiError) {
        if (err.status === 401) {
          life.current.ended = true;
          callbacks.current.onSessionExpired();
          return;
        }
        if (err.status === 403 && err.message !== m.csrfInvalid) {
          life.current.ended = true;
          callbacks.current.onForbidden();
          return;
        }

        // Map indexed fieldErrors to building UI IDs
        const mappedErrors: PolicyFieldErrors = { ...err.fieldErrors };
        for (let i = 0; i < diff.frozenBuildings.length; i++) {
          const item = diff.frozenBuildings[i];
          const keyPrefix = `buildings[${i}]`;
          if (mappedErrors[`${keyPrefix}.buildingId`]) {
            mappedErrors[`newBuilding_${item.buildingId}`] = mappedErrors[`${keyPrefix}.buildingId`];
          }
          if (mappedErrors[`${keyPrefix}.defaultForNewRoom`]) {
            mappedErrors[`newBuilding_${item.buildingId}`] = mappedErrors[`${keyPrefix}.defaultForNewRoom`];
          }
        }
        setFieldErrors(mappedErrors);
        setError(err.message);

        // On 409 conflict: retain draft, fetch latest policy in background
        if (err.status === 409) {
          getServicePolicy(serviceId)
            .then((fresh) => {
              if (current()) {
                setLatestSnapshot(fresh);
              }
            })
            .catch(() => undefined);
        }
      } else {
        setError(err instanceof Error ? err.message : m.saveFailure);
      }
    } finally {
      lock.current = false;
      if (current()) {
        setSaving(false);
      }
    }
  };

  return {
    loading,
    snapshot,
    latestSnapshot,
    draft,
    error,
    notice,
    fieldErrors,
    saving,
    dirty,
    buildingsLoading,
    buildingsList,
    buildingsError,
    setMethod,
    setDefaultPrice,
    setProrate,
    setExistingBuildingFlag,
    addNewBuilding,
    removeNewBuilding,
    setNewBuildingFlag,
    applyLatestSnapshot,
    retryLoadBuildings: () => setBuildingsRevision((r) => r + 1),
    refreshPolicy: () => setPolicyRevision((r) => r + 1),
    submit,
    dismissNotice: () => setNotice(null),
    dismissError: () => setError(null),
  };
}
