import { useEffect, useEffectEvent, useState } from 'react';
import { FinanceApiError } from '../../services/financeApi';
import { AuthApiError } from '../../services/authErrors';

export function useFinanceRequest<T>(key: string | undefined, load: (signal: AbortSignal) => Promise<T>, expired: () => void, unavailable: string) {
  const [attempt, retry] = useState(0);
  const [result, setResult] = useState<{ key: string; attempt: number; data?: T; error?: string }>();
  const request = useEffectEvent(load);
  const onExpired = useEffectEvent(expired);
  const fallback = useEffectEvent(() => unavailable);
  useEffect(() => {
    if (key === undefined) return;
    const controller = new AbortController();
    void request(controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ key, attempt, data });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if ((error instanceof FinanceApiError || error instanceof AuthApiError) && error.status === 401) onExpired();
      const message = error instanceof FinanceApiError && error.status < 500
        ? error.message || 'Bộ lọc không hợp lệ hoặc nằm ngoài phạm vi quản lý.' : fallback();
      setResult({ key, attempt, error: message });
    });
    return () => controller.abort();
  }, [key, attempt]);
  const current = result?.key === key && result?.attempt === attempt ? result : undefined;
  return { data: current?.data, error: current?.error, retry: () => retry(value => value + 1) };
}

