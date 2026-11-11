import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CustomerApiError, createCustomer, isCustomerAbort, listCustomers } from '../services/customerApi';
import { customerMessages as m, type CreateCustomerInput, type CustomerFieldErrors, type CustomerNotice, type CustomerPageResponse, type CustomerRoute } from '../types/customer';
import { customerUrl } from '../utils/customerNavigation';

export interface UseCustomersOptions {
  onNavigate: (url: string, replace?: boolean) => void;
  onSessionExpired: () => void;
  onForbidden: () => void;
}

export function useCustomers(route: CustomerRoute, options: UseCustomersOptions) {
  const callbacks = useRef(options);
  useLayoutEffect(() => {
    callbacks.current = options;
  });

  const { page, size, q, view } = route;
  const [data, setData] = useState<CustomerPageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<CustomerNotice | null>(null);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<CustomerFieldErrors>({});
  const sequence = useRef(0);

  const fail = useCallback((err: unknown): boolean => {
    if (!(err instanceof CustomerApiError)) return false;
    if (err.status === 401) {
      callbacks.current.onSessionExpired();
      return true;
    }
    if (err.status === 403 && err.message !== m.csrfInvalid) {
      callbacks.current.onForbidden();
      return true;
    }
    return false;
  }, []);

  const load = useCallback(() => {
    if (view !== 'list' || route.invalid) return;
    const reqId = ++sequence.current;
    const controller = new AbortController();
    let active = true;

    void Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true);
      setError(null);

      void listCustomers({ page, size, q }, controller.signal)
        .then((res) => {
          if (active && sequence.current === reqId) {
            setData(res);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!active || sequence.current !== reqId || isCustomerAbort(err)) return;
          if (!fail(err)) {
            setError(err instanceof CustomerApiError ? err.message : m.listFailure);
            setLoading(false);
          }
        });
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [view, page, size, q, fail, route.invalid]);

  useEffect(() => {
    return load();
  }, [load]);

  // Handle invalid route normalization
  useEffect(() => {
    if (!route.invalid) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      callbacks.current.onNavigate(customerUrl({ q: route.q.length <= 200 ? route.q : '', page: route.page, size: route.size }, { customerId: route.customerId }), true);
      setNotice({ kind: 'error', message: 'Đường dẫn khách thuê không hợp lệ. Vui lòng chọn lại thao tác.' });
    });
    return () => {
      active = false;
    };
  }, [route.invalid, route.customerId, route.q, route.page, route.size]);

  // Adjust out-of-bounds page
  useEffect(() => {
    if (view === 'list' && data && page > 0 && page >= data.totalPages) {
      callbacks.current.onNavigate(customerUrl({ q, page: Math.max(0, data.totalPages - 1), size }), true);
    }
  }, [view, data, page, q, size]);

  const submitCreate = async (input: CreateCustomerInput): Promise<boolean> => {
    if (pending) return false;
    setPending(true);
    setFieldErrors({});

    try {
      await createCustomer(input);
      setPending(false);
      setNotice({ kind: 'success', message: m.createSuccess });
      callbacks.current.onNavigate(customerUrl(route, { action: null }), true);
      load();
      return true;
    } catch (err) {
      setPending(false);
      if (fail(err)) return false;
      if (err instanceof CustomerApiError) {
        setNotice({ kind: 'error', message: err.message, fieldErrors: err.fieldErrors as CustomerFieldErrors });
        setFieldErrors(err.fieldErrors as CustomerFieldErrors);
      } else {
        setNotice({ kind: 'error', message: m.createFailure });
      }
      return false;
    }
  };

  return {
    data,
    loading,
    error,
    notice,
    pending,
    fieldErrors,
    refresh: load,
    dismissNotice: () => setNotice(null),
    submitCreate,
  };
}
