import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAutoDraftJobLogs,
  fetchHostNotifications,
  getAutoDraftSettings,
  markHostNotificationRead,
  triggerAutoDraftJob,
  updateAutoDraftSettings,
} from '../services/autoDraftBillingApi';
import type {
  AutoDraftJobRun,
  AutoDraftSettingsResponse,
  HostNotificationItem,
} from '../types/autoDraftBilling';

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function useAutoDraftSettings() {
  const [settings, setSettings] = useState<AutoDraftSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getAutoDraftSettings(controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setSettings(data);
        setError(null);
        setLoading(false);
      },
      (err) => {
        if (controller.signal.aborted || (err as DOMException)?.name === 'AbortError') return;
        setError(errorMessage(err, 'Chưa thể tải cấu hình lập hóa đơn tự động.'));
        setLoading(false);
      },
    );
    return () => controller.abort();
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAutoDraftSettings();
      setSettings(data);
    } catch (err) {
      setError(errorMessage(err, 'Chưa thể tải cấu hình lập hóa đơn tự động.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = useCallback(async (nextValue: boolean) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAutoDraftSettings(nextValue);
      setSettings(updated);
    } catch (err) {
      setError(errorMessage(err, 'Không thể cập nhật cấu hình tự động lập hóa đơn nháp.'));
    } finally {
      setSaving(false);
    }
  }, [saving]);

  return { settings, loading, saving, error, toggle, reload: () => void reload() };
}

export function useHostNotifications(enabled: boolean) {
  const [items, setItems] = useState<HostNotificationItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetchHostNotifications(0, controller.signal).then(
      (res) => {
        if (controller.signal.aborted) return;
        setItems(res.items);
        setPage(res.page);
        setHasNext(res.hasNext);
        setError(null);
        setLoading(false);
      },
      (err) => {
        if (controller.signal.aborted || (err as DOMException)?.name === 'AbortError') return;
        setError(errorMessage(err, 'Chưa thể tải hòm thư thông báo tổng kết.'));
        setLoading(false);
      },
    );
    return () => controller.abort();
  }, [enabled]);

  const loadPage = useCallback(async (targetPage: number, append: boolean) => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchHostNotifications(targetPage);
      setItems((prev) => (append ? [...prev, ...res.items] : res.items));
      setPage(res.page);
      setHasNext(res.hasNext);
    } catch (err) {
      setError(errorMessage(err, 'Chưa thể tải hòm thư thông báo tổng kết.'));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (markingId) return;
    setMarkingId(notificationId);
    setError(null);
    try {
      await markHostNotificationRead(notificationId);
      setItems((prev) =>
        prev.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
      );
    } catch (err) {
      setError(errorMessage(err, 'Chưa thể đánh dấu đã đọc.'));
    } finally {
      setMarkingId(null);
    }
  }, [markingId]);

  const visibleItems = enabled ? items : [];
  const unreadCount = visibleItems.filter((item) => !item.read).length;

  return {
    items: visibleItems,
    page,
    hasNext: enabled && hasNext,
    unreadCount,
    loading,
    error,
    markingId,
    refresh: () => void loadPage(0, false),
    loadMore: () => void loadPage(page + 1, true),
    markAsRead,
  };
}

export function useAdminAutoDraftJobs() {
  const [logs, setLogs] = useState<AutoDraftJobRun[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRunResult, setLastRunResult] = useState<AutoDraftJobRun | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    fetchAutoDraftJobLogs(0, controller.signal).then(
      (res) => {
        if (controller.signal.aborted || !mounted.current) return;
        setLogs(res.items);
        setPage(res.page);
        setHasNext(res.hasNext);
        setError(null);
        setLoading(false);
      },
      (err) => {
        if (controller.signal.aborted || (err as DOMException)?.name === 'AbortError' || !mounted.current) return;
        setError(errorMessage(err, 'Chưa thể tải nhật ký tiến trình tự động.'));
        setLoading(false);
      },
    );
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, []);

  const loadLogs = useCallback(async (targetPage = 0) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAutoDraftJobLogs(targetPage);
      if (!mounted.current) return;
      setLogs(res.items);
      setPage(res.page);
      setHasNext(res.hasNext);
    } catch (err) {
      if (!mounted.current) return;
      setError(errorMessage(err, 'Chưa thể tải nhật ký tiến trình tự động.'));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const triggerRun = useCallback(async (runDate?: string) => {
    if (triggering) return;
    setTriggering(true);
    setError(null);
    try {
      const result = await triggerAutoDraftJob(runDate);
      if (!mounted.current) return;
      setLastRunResult(result);
      await loadLogs(0);
    } catch (err) {
      if (!mounted.current) return;
      setError(errorMessage(err, 'Chưa thể kích hoạt tiến trình tự động.'));
    } finally {
      if (mounted.current) setTriggering(false);
    }
  }, [triggering, loadLogs]);

  return {
    logs,
    page,
    hasNext,
    loading,
    triggering,
    error,
    lastRunResult,
    loadLogs: (p: number) => void loadLogs(p),
    triggerRun,
  };
}
