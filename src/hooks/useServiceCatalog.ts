import { useCallback, useEffect, useRef, useState } from 'react';
import { catalogMessages as m, type CatalogNotice, type CatalogRoute } from '../types/serviceCatalog';
import { CatalogApiError, listCatalogServices } from '../services/serviceCatalogApi';
import { catalogUrl } from '../utils/serviceCatalogNavigation';
import { useCatalogResource } from './useCatalogResource';

export type CatalogNavigate = (url: string, replace?: boolean) => void;
export type NavigationGuardRegistration = (guard: (() => boolean) | null) => void;
export function useServiceCatalog(route: CatalogRoute, onNavigate: CatalogNavigate, onSessionExpired: () => void, onForbidden: () => void) {
  const [notice, setNotice] = useState<CatalogNotice | null>(null);
  const callbacks = useRef({ onSessionExpired, onForbidden });
  useEffect(() => { callbacks.current = { onSessionExpired, onForbidden }; }, [onSessionExpired, onForbidden]);
  const fail = useCallback((error: unknown) => {
    if (!(error instanceof CatalogApiError)) return false;
    if (error.status === 401) { callbacks.current.onSessionExpired(); return true; }
    if (error.status === 403 && error.message !== m.csrfInvalid) { callbacks.current.onForbidden(); return true; }
    return false;
  }, []);
  const list = useCatalogResource(listCatalogServices, fail, m.listFailure);
  useEffect(() => {
    if (!route.invalid) return;
    onNavigate(catalogUrl(route), true);
    void Promise.resolve().then(() => setNotice({ kind: 'error', message: m.invalidRoute }));
  }, [route, onNavigate]);
  const finished = (message: string, kind: CatalogNotice['kind'] = 'success') => {
    setNotice({ message, kind }); list.refresh(); onNavigate(catalogUrl(route), true);
  };
  return { list, notice, dismiss: () => setNotice(null), fail, finished };
}
