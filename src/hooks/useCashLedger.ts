import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthApiError } from '../services/authErrors';
import { CashLedgerApiError, fetchCashLedger, fetchCashLedgerDetail } from '../services/cashLedgerApi';
import { listFundingSources } from '../services/fundingApi';
import { getAreas, getBuildings, getRoomsByBuilding } from '../services/propertiesApi';
import type {
  CashLedgerDetail,
  CashLedgerDirection,
  CashLedgerFilterState,
  CashLedgerOrigin,
  CashLedgerPageData,
  CashLedgerScopeType,
} from '../types/cashLedger';
import type { FundingSource } from '../types/fundingSource';
import type { Area, Building, Room } from '../types/properties';
import type { FinanceRoute } from '../utils/financeNavigation';

export interface CashLedgerCatalog {
  areas: Area[];
  buildings: Building[];
  rooms: Room[];
  sources: FundingSource[];
}

const INVALID_RANGE_MESSAGE = 'Khoảng thời gian không hợp lệ. Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc';

export function getCurrentMonthRange(): { fromDate: string; toDate: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === 'year')?.value ?? new Date().getFullYear());
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? new Date().getMonth() + 1);
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');
  return { fromDate: `${year}-${mm}-01`, toDate: `${year}-${mm}-${dd}` };
}

function routeToFilter(route: FinanceRoute): CashLedgerFilterState {
  const defaults = getCurrentMonthRange();
  const f = route.filter;
  let scopeType: CashLedgerScopeType = 'ALL';
  if (f.scopeType === 'COMMON_EXPENSE') scopeType = 'COMMON_EXPENSE';
  else if (f.roomId) scopeType = 'ROOM';
  else if (f.buildingId) scopeType = 'BUILDING';
  else if (f.areaId) scopeType = 'AREA';

  return {
    fromDate: f.fromDate || defaults.fromDate,
    toDate: f.toDate || defaults.toDate,
    direction: f.direction === 'IN' || f.direction === 'OUT' ? (f.direction as CashLedgerDirection) : undefined,
    categoryCodes: f.transactionCategory ?? [],
    sourceId: f.sourceId,
    scopeType,
    areaId: f.areaId,
    buildingId: f.buildingId,
    roomId: f.roomId,
    origin: f.origin as CashLedgerOrigin | undefined,
    affectsProfit: f.affectsProfit === 'true' ? true : f.affectsProfit === 'false' ? false : undefined,
    entryId: route.entryId,
    dimension: f.dimension,
    groupKey: f.groupKey,
  };
}

export function useCashLedger(
  route: FinanceRoute,
  onSessionExpired: (message?: string) => void,
) {
  const [draftFilter, setDraftFilter] = useState<CashLedgerFilterState>(() => routeToFilter(route));
  const [appliedFilter, setAppliedFilter] = useState<CashLedgerFilterState>(() => routeToFilter(route));
  const [page, setPage] = useState<number>(route.page);
  const [size, setSize] = useState<number>(route.size);

  const [data, setData] = useState<CashLedgerPageData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<CashLedgerCatalog>({ areas: [], buildings: [], rooms: [], sources: [] });

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(route.entryId ?? null);
  const [detail, setDetail] = useState<CashLedgerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [reloadTick, setReloadTick] = useState(0);
  const listAbortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    const loadCatalog = async () => {
      try {
        const [areasRes, buildingsRes, sourcesRes] = await Promise.all([
          getAreas().catch(() => [] as Area[]),
          getBuildings().catch(() => [] as Building[]),
          listFundingSources({ type: '', active: '' }).catch(() => [] as FundingSource[]),
        ]);
        if (!active) return;
        setCatalog((prev) => ({
          ...prev,
          areas: areasRes,
          buildings: buildingsRes,
          sources: sourcesRes,
        }));
      } catch {
        // Catalog failure shouldn't block ledger search
      }
    };
    void loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!draftFilter.buildingId) return;
    let active = true;
    getRoomsByBuilding(draftFilter.buildingId)
      .then((rooms) => {
        if (active) setCatalog((prev) => ({ ...prev, rooms }));
      })
      .catch(() => {
        if (active) setCatalog((prev) => ({ ...prev, rooms: [] }));
      });
    return () => {
      active = false;
    };
  }, [draftFilter.buildingId]);

  useEffect(() => {
    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;

    const run = async () => {
      setLoading(true);
      setError(null);
      setForbidden(null);
      try {
        const result = await fetchCashLedger(appliedFilter, page, size, route.financial, controller.signal);
        if (controller.signal.aborted) return;
        setData(result);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof AuthApiError || (err instanceof CashLedgerApiError && err.status === 401)) {
          onSessionExpired(err.message);
          return;
        }
        if (err instanceof CashLedgerApiError && err.status === 403) {
          setForbidden(err.message);
          return;
        }
        setError(err instanceof Error ? err.message : 'Không thể tải sổ thu chi lúc này.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    void run();

    return () => {
      controller.abort();
    };
  }, [appliedFilter, page, size, route.financial, onSessionExpired, reloadTick]);

  useEffect(() => {
    if (!selectedEntryId) return;
    detailAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;

    const run = async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const result = await fetchCashLedgerDetail(selectedEntryId, controller.signal);
        if (controller.signal.aborted) return;
        setDetail(result);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof AuthApiError || (err instanceof CashLedgerApiError && err.status === 401)) {
          onSessionExpired(err.message);
          return;
        }
        setDetailError(err instanceof Error ? err.message : 'Không thể tải chi tiết giao dịch.');
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    };
    void run();

    return () => {
      controller.abort();
    };
  }, [selectedEntryId, onSessionExpired]);

  const applyFilters = useCallback(() => {
    if (!draftFilter.fromDate || !draftFilter.toDate || draftFilter.fromDate > draftFilter.toDate) {
      setFilterError(INVALID_RANGE_MESSAGE);
      return false;
    }
    setFilterError(null);
    setPage(0);
    setAppliedFilter({ ...draftFilter });
    return true;
  }, [draftFilter]);

  const resetFilters = useCallback(() => {
    const defaults = getCurrentMonthRange();
    const resetState: CashLedgerFilterState = {
      fromDate: defaults.fromDate,
      toDate: defaults.toDate,
      categoryCodes: [],
      scopeType: 'ALL',
    };
    setFilterError(null);
    setDraftFilter(resetState);
    setAppliedFilter(resetState);
    setPage(0);
  }, []);

  const openDetail = useCallback((entryId: string) => {
    setSelectedEntryId(entryId);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedEntryId(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  const reload = useCallback(() => {
    setReloadTick((t) => t + 1);
  }, []);

  const effectiveCatalog: CashLedgerCatalog = draftFilter.buildingId
    ? catalog
    : { ...catalog, rooms: [] };

  return {
    draftFilter,
    setDraftFilter,
    appliedFilter,
    page,
    setPage,
    size,
    setSize,
    data,
    loading,
    error,
    forbidden,
    filterError,
    catalog: effectiveCatalog,
    selectedEntryId,
    detail,
    detailLoading,
    detailError,
    applyFilters,
    resetFilters,
    openDetail,
    closeDetail,
    reload,
  };
}
