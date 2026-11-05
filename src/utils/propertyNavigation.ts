import type { PropertiesRoute, RoomsRoute } from '../types/properties';

export function parsePropertiesRoute(pathname: string, search: string): PropertiesRoute | null {
  if (!/^\/properties\/?$/.test(pathname)) return null;
  const params = new URLSearchParams(search);
  const tab = params.get('tab') === 'buildings' ? 'buildings' : 'areas';
  const create = params.get('create') === '1';
  return { tab, create };
}

export function propertiesUrl(tab: 'areas' | 'buildings' = 'areas', create = false): string {
  const params = new URLSearchParams();
  if (tab !== 'areas') params.set('tab', tab);
  if (create) params.set('create', '1');
  const qs = params.toString();
  return `/properties${qs ? `?${qs}` : ''}`;
}

export function parseRoomsRoute(pathname: string, search: string): RoomsRoute | null {
  if (!/^\/rooms\/?$/.test(pathname)) return null;
  const params = new URLSearchParams(search);
  const view = params.get('view') === 'table' ? 'table' : 'matrix';
  const buildingId = params.get('buildingId') || null;
  const roomId = params.get('roomId') || null;
  const actionParam = params.get('action');
  const action = actionParam === 'create' || actionParam === 'edit' || actionParam === 'detail' || actionParam === 'history'
    ? actionParam
    : null;
  const floorId = params.get('floorId') || null;

  return { view, buildingId, roomId, action, floorId };
}

export function roomsUrl(params: {
  view?: 'matrix' | 'table';
  buildingId?: string | null;
  roomId?: string | null;
  action?: 'create' | 'edit' | 'detail' | 'history' | null;
  floorId?: string | null;
}): string {
  const q = new URLSearchParams();
  if (params.view && params.view !== 'matrix') q.set('view', params.view);
  if (params.buildingId) q.set('buildingId', params.buildingId);
  if (params.roomId) q.set('roomId', params.roomId);
  if (params.action) q.set('action', params.action);
  if (params.floorId) q.set('floorId', params.floorId);
  const qs = q.toString();
  return `/rooms${qs ? `?${qs}` : ''}`;
}

