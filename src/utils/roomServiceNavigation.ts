import type { RoomServicesRoute } from '../types/roomServices';

export function roomServicesReturnTo(value: string | null | undefined): string {
  if (!value || !/^\/rooms(?:\?|\/?$)/.test(value)) return '/rooms';
  const url = new URL(value, 'https://rentops.local');
  return /^\/rooms\/?$/.test(url.pathname) ? url.pathname + url.search : '/rooms';
}
export function parseRoomServicesRoute(pathname: string, search: string): RoomServicesRoute | null {
  const match = /^\/rooms\/([^/]+)\/services\/?$/.exec(pathname);
  if (!match) return null;
  let roomId = match[1];
  try {
    roomId = decodeURIComponent(roomId);
  } catch {
    /* Invalid identity is rejected by the API client. */
  }
  return { roomId, returnTo: roomServicesReturnTo(new URLSearchParams(search).get('returnTo')) };
}
export function roomServicesUrl(roomId: string, returnTo?: string): string {
  const back = roomServicesReturnTo(returnTo);
  return (
    '/rooms/' +
    encodeURIComponent(roomId) +
    '/services' +
    (back === '/rooms' ? '' : '?returnTo=' + encodeURIComponent(back))
  );
}
