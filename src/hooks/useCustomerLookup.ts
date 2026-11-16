import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getCustomer } from '../services/customerApi';
import { getRentalHistory, LookupApiError, searchCustomers } from '../services/customerLookupApi';
import type { LookupPage, LookupRoute, RentalHistory } from '../types/customerLookup';
import type { CustomerResponse } from '../types/customer';
import { lookupUrl } from '../utils/customerLookupNavigation';
interface Data { page?: LookupPage; history?: RentalHistory; customer?: CustomerResponse }
export function useCustomerLookup(route: LookupRoute, options: {
  onNavigate: (url: string, replace?: boolean) => void; onSessionExpired: (message?: string) => void; onForbidden: () => void;
}) {
  const callbacks = useRef(options);
  useLayoutEffect(() => { callbacks.current = options; });
  const key = JSON.stringify(route);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; attempt: number; data?: Data; error?: LookupApiError }>({ key: '', attempt: -1 });
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (route.invalid) return;
    const controller = new AbortController();
    let active = true;
    const selected: LookupRoute = JSON.parse(key);
    void Promise.resolve().then(async () => {
      if (!active) return;
      try {
        let data: Data;
        if (selected.view === 'history') {
          const [history, customer] = await Promise.all([
            getRentalHistory(selected.customerId!, controller.signal), getCustomer(selected.customerId!, controller.signal),
          ]);
          if (customer.id !== selected.customerId) throw new LookupApiError(500, 'Không thể xác định Customer được yêu cầu.');
          data = { history, customer };
        } else {
          const page = await searchCustomers(selected, controller.signal);
          data = { page };
          if (active && page.pageReset) {
            setNotice('Danh sách đã thay đổi. Đã chuyển về trang đầu.');
            callbacks.current.onNavigate(lookupUrl({ ...selected, page: page.page }), true);
          }
        }
        if (active) setState({ key, attempt, data });
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        controller.abort();
        const status = error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : 0;
        const failure = error instanceof LookupApiError ? error : new LookupApiError(status, 'Không thể tải dữ liệu. Vui lòng thử lại.');
        setState({ key, attempt, error: failure });
        if (status === 401) callbacks.current.onSessionExpired('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        if (status === 403) callbacks.current.onForbidden();
      }
    });
    return () => { active = false; controller.abort(); };
  }, [key, attempt, route.invalid]);
  const current = state.key === key && state.attempt === attempt ? state : null;
  return { data: current?.data, error: current?.error, loading: !route.invalid && !current,
    retry: () => setAttempt(n => n + 1), notice, clearNotice: () => setNotice('') };
}
