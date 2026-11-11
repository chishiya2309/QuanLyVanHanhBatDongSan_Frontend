import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  CustomerApiError,
  createCustomerVehicle,
  getCustomer,
  isCustomerAbort,
  listCustomerVehicles,
  updateCustomer,
  updateCustomerVehicle,
} from '../services/customerApi';
import {
  customerMessages as m,
  type CreateVehicleInput,
  type CustomerFieldErrors,
  type CustomerNotice,
  type CustomerResponse,
  type CustomerRoute,
  type UpdateCustomerInput,
  type UpdateVehicleInput,
  type VehicleFieldErrors,
  type VehicleResponse,
} from '../types/customer';
import { customerUrl } from '../utils/customerNavigation';

export interface UseCustomerDetailOptions {
  onNavigate: (url: string, replace?: boolean) => void;
  onSessionExpired: () => void;
  onForbidden: () => void;
  onUnavailable?: (message: string) => void;
}

export function useCustomerDetail(route: CustomerRoute, options: UseCustomerDetailOptions) {
  const callbacks = useRef(options);
  useLayoutEffect(() => {
    callbacks.current = options;
  });

  const { customerId, view } = route;
  const [customer, setCustomer] = useState<CustomerResponse | null>(null);
  const [vehicles, setVehicles] = useState<VehicleResponse[]>([]);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);
  const [notice, setNotice] = useState<CustomerNotice | null>(null);
  const [pending, setPending] = useState(false);
  const [customerFieldErrors, setCustomerFieldErrors] = useState<CustomerFieldErrors>({});
  const [vehicleFieldErrors, setVehicleFieldErrors] = useState<VehicleFieldErrors>({});
  const sequence = useRef(0);
  const [customerRevision, setCustomerRevision] = useState(0);
  const [vehicleRevision, setVehicleRevision] = useState(0);
  const [snapshotRefreshing, setSnapshotRefreshing] = useState(false);
  const refreshCustomer = useCallback(() => { setSnapshotRefreshing(true); setCustomerRevision((value) => value + 1); }, []);
  const refreshVehicles = useCallback(() => setVehicleRevision((value) => value + 1), []);
  const refreshAfterAccount = useCallback(() => { refreshCustomer(); refreshVehicles(); }, [refreshCustomer, refreshVehicles]);

  const fail = useCallback(
    (err: unknown): boolean => {
      if (!(err instanceof CustomerApiError)) return false;
      if (err.status === 401) {
        callbacks.current.onSessionExpired();
        return true;
      }
      if (err.status === 403 && err.message !== m.csrfInvalid) {
        callbacks.current.onForbidden();
        return true;
      }
      if (err.status === 404) {
        setNotice({ kind: 'error', message: m.notFound });
        callbacks.current.onUnavailable?.(m.notFound);
        callbacks.current.onNavigate(customerUrl({ q: route.q, page: route.page, size: route.size }), true);
        return true;
      }
      return false;
    },
    [route.q, route.page, route.size]
  );

  const loadCustomer = useCallback(() => {
    if (!customerId || view !== 'detail') return;
    const reqId = ++sequence.current;
    const controller = new AbortController();
    let active = true;

    void Promise.resolve().then(() => {
      if (!active) return;
      setLoadingCustomer(true);
      setCustomerError(null);

      void getCustomer(customerId, controller.signal)
        .then((res) => {
          if (active && sequence.current === reqId) {
            setCustomer(res);
            setLoadingCustomer(false);
            setSnapshotRefreshing(false);
          }
        })
        .catch((err) => {
          if (!active || sequence.current !== reqId || isCustomerAbort(err)) return;
          if (!fail(err)) {
            setCustomerError(err instanceof CustomerApiError ? err.message : m.detailFailure);
            setLoadingCustomer(false);
          }
        });
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [customerId, view, fail]);

  const loadVehicles = useCallback(() => {
    if (!customerId || view !== 'detail') return;
    const controller = new AbortController();
    let active = true;

    void Promise.resolve().then(() => {
      if (!active) return;
      setLoadingVehicles(true);
      setVehiclesError(null);

      void listCustomerVehicles(customerId, controller.signal)
        .then((res) => {
          if (active) {
            setVehicles(res.vehicles);
            setLoadingVehicles(false);
          }
        })
        .catch((err) => {
          if (!active || isCustomerAbort(err)) return;
          if (!fail(err)) {
            setVehiclesError(err instanceof CustomerApiError ? err.message : m.vehiclesFailure);
            setLoadingVehicles(false);
          }
        });
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [customerId, view, fail]);

  useEffect(loadCustomer, [loadCustomer, customerRevision]);
  useEffect(loadVehicles, [loadVehicles, vehicleRevision]);

  const submitUpdateCustomer = async (input: UpdateCustomerInput): Promise<boolean> => {
    if (!customerId || pending) return false;
    setPending(true);
    setCustomerFieldErrors({});

    try {
      const updated = await updateCustomer(customerId, input);
      setCustomer(updated);
      setPending(false);
      setNotice({ kind: 'success', message: m.updateSuccess });
      callbacks.current.onNavigate(customerUrl(route, { customerId, action: null }), true);
      refreshVehicles();
      return true;
    } catch (err) {
      setPending(false);
      if (fail(err)) return false;
      if (err instanceof CustomerApiError) {
        setNotice({ kind: 'error', message: err.message, fieldErrors: err.fieldErrors as CustomerFieldErrors });
        setCustomerFieldErrors(err.fieldErrors as CustomerFieldErrors);
      } else {
        setNotice({ kind: 'error', message: m.updateFailure });
      }
      return false;
    }
  };

  const submitAddVehicle = async (input: CreateVehicleInput): Promise<boolean> => {
    if (!customerId || pending) return false;
    setPending(true);
    setVehicleFieldErrors({});

    try {
      await createCustomerVehicle(customerId, input);
      setPending(false);
      setNotice({ kind: 'success', message: m.vehicleCreateSuccess });
      callbacks.current.onNavigate(customerUrl(route, { customerId, vehicleAction: null, vehicleId: null }), true);
      refreshVehicles();
      return true;
    } catch (err) {
      setPending(false);
      if (fail(err)) return false;
      if (err instanceof CustomerApiError) {
        setNotice({ kind: 'error', message: err.message, fieldErrors: err.fieldErrors as VehicleFieldErrors });
        setVehicleFieldErrors(err.fieldErrors as VehicleFieldErrors);
      } else {
        setNotice({ kind: 'error', message: m.vehicleCreateFailure });
      }
      return false;
    }
  };

  const submitUpdateVehicle = async (vehicleId: string, input: UpdateVehicleInput): Promise<boolean> => {
    if (!customerId || pending) return false;
    setPending(true);
    setVehicleFieldErrors({});

    try {
      await updateCustomerVehicle(customerId, vehicleId, input);
      setPending(false);
      setNotice({ kind: 'success', message: m.vehicleUpdateSuccess });
      callbacks.current.onNavigate(customerUrl(route, { customerId, vehicleAction: null, vehicleId: null }), true);
      refreshVehicles();
      return true;
    } catch (err) {
      setPending(false);
      if (fail(err)) return false;
      if (err instanceof CustomerApiError) {
        setNotice({ kind: 'error', message: err.message, fieldErrors: err.fieldErrors as VehicleFieldErrors });
        setVehicleFieldErrors(err.fieldErrors as VehicleFieldErrors);
      } else {
        setNotice({ kind: 'error', message: m.vehicleUpdateFailure });
      }
      return false;
    }
  };

  return {
    customer,
    vehicles,
    loading: loadingCustomer || loadingVehicles,
    loadingCustomer,
    loadingVehicles,
    customerError,
    vehiclesError,
    notice,
    pending,
    customerFieldErrors,
    vehicleFieldErrors,
    snapshotRefreshing,
    refreshCustomer,
    refreshVehicles,
    refreshAfterAccount,
    dismissNotice: () => setNotice(null),
    submitUpdateCustomer,
    submitAddVehicle,
    submitUpdateVehicle,
  };
}
