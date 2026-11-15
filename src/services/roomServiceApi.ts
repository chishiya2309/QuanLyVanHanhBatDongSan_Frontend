import { isRecord, safeInteger } from './assetCodec';
import { AuthApiError } from './authErrors';
import { clearCsrfCache, getCsrfToken } from './csrfClient';
import { authenticatedFetch, sessionGuard } from './sessionClient';
import { isAssetId } from '../utils/assetNavigation';
import {
  decodeAvailableRoomServices,
  decodeRoomServices,
  decodeRoomServiceWrite,
  encodeRoomServiceWrite,
  parseRoomServiceJson,
} from './roomServiceCodec';
import { roomServiceMessages as m, type RoomServiceWrite } from '../types/roomServices';

const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
export class RoomServiceApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  phase: 'read' | 'csrf' | 'write' | 'uncertain';
  constructor(
    status: number,
    message: string,
    fieldErrors: Record<string, string> = {},
    phase: RoomServiceApiError['phase'] = 'read',
  ) {
    super(message);
    this.name = 'RoomServiceApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.phase = phase;
  }
}
export const isRoomServiceAbort = (error: unknown) =>
  error instanceof Error && error.name === 'AbortError';
function errorResponse(status: number, value: unknown, write: boolean): RoomServiceApiError {
  const valid = isRecord(value) && safeInteger(value.status) === status;
  let message: string = write ? m.saveFailure : m.getFailure;
  const fields: Record<string, string> = {};
  if (valid && isRecord(value.fieldErrors))
    for (const [key, text] of Object.entries(value.fieldErrors))
      if (typeof text === 'string') fields[key] = text;
  if (status === 401) message = m.sessionInvalid;
  else if (status === 403)
    message = valid && value.message === m.csrfInvalid ? m.csrfInvalid : m.forbidden;
  else if (status === 404) message = m.notFound;
  else if (status === 400) message = m.invalid;
  else if (status === 409)
    message = valid && typeof value.message === 'string' ? value.message : m.stale;
  if (message === m.csrfInvalid) clearCsrfCache();
  return new RoomServiceApiError(status, message, fields, write ? 'write' : 'read');
}
async function request<T>(
  path: string,
  expected: number,
  decode: (data: unknown, message: string) => T,
  init: RequestInit = {},
  shouldSend = () => true,
): Promise<T> {
  const write = Boolean(init.method && init.method !== 'GET');
  const current = sessionGuard(shouldSend);
  let response: Response;
  try {
    response = await authenticatedFetch(
      base + path,
      {
        ...init,
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json', ...init.headers },
      },
      { shouldSend: current, trackNavigation: true },
    );
  } catch (error) {
    if (isRoomServiceAbort(error)) throw error;
    if (error instanceof AuthApiError)
      throw new RoomServiceApiError(
        error.status,
        error.status === 401 ? m.sessionInvalid : error.message,
        {},
        write ? 'write' : 'read',
      );
    throw new RoomServiceApiError(
      0,
      write ? m.uncertain : m.getFailure,
      {},
      write ? 'uncertain' : 'read',
    );
  }
  let value: unknown;
  try {
    value = parseRoomServiceJson(await response.text());
  } catch {
    if (!current()) throw new DOMException('Stale response', 'AbortError');
    if (!response.ok) throw errorResponse(response.status, null, write);
    throw new RoomServiceApiError(
      response.status,
      write ? m.uncertain : m.getFailure,
      {},
      write ? 'uncertain' : 'read',
    );
  }
  if (!current()) throw new DOMException('Stale response', 'AbortError');
  if (!response.ok) throw errorResponse(response.status, value, write);
  try {
    if (
      response.status !== expected ||
      !isRecord(value) ||
      safeInteger(value.status) !== expected ||
      typeof value.message !== 'string' ||
      !Object.hasOwn(value, 'data')
    )
      throw new Error('Invalid envelope');
    return decode(value.data, value.message);
  } catch {
    throw new RoomServiceApiError(
      response.status,
      write ? m.uncertain : m.getFailure,
      {},
      write ? 'uncertain' : 'read',
    );
  }
}
function pathFor(roomId: string): string {
  if (!isAssetId(roomId)) throw new RoomServiceApiError(404, m.notFound);
  return '/rooms/' + encodeURIComponent(roomId) + '/services';
}
export async function getRoomServices(roomId: string, signal?: AbortSignal) {
  return request(pathFor(roomId), 200, (value) => decodeRoomServices(value, roomId), { signal });
}
export async function getAvailableRoomServices(roomId: string, signal?: AbortSignal) {
  return request(
    pathFor(roomId) + '/available',
    200,
    (value) => decodeAvailableRoomServices(value, roomId),
    { signal },
  );
}
export async function writeRoomService(
  roomId: string,
  action: RoomServiceWrite,
  shouldSend = () => true,
) {
  let path = pathFor(roomId),
    body: string;
  try {
    body = encodeRoomServiceWrite(action);
  } catch {
    throw new RoomServiceApiError(400, m.invalid, {}, 'write');
  }
  if (action.kind !== 'add') {
    if (!isAssetId(action.item.serviceId)) throw new RoomServiceApiError(404, m.notFound);
    path += '/' + action.item.serviceId + '/' + (action.kind === 'status' ? 'status' : 'price');
  }
  const current = sessionGuard(shouldSend);
  let csrf: { headerName: string; token: string };
  try {
    csrf = await getCsrfToken();
    if (
      !csrf ||
      !/^[!#$%&'*+.^_`|~\da-z-]+$/i.test(csrf.headerName) ||
      !csrf.token?.trim() ||
      /[\r\n]/.test(csrf.token) ||
      ['accept', 'content-type', 'cookie', 'authorization', 'host'].includes(
        csrf.headerName.toLowerCase(),
      )
    )
      throw new Error('Invalid CSRF');
  } catch (error) {
    if (!current()) throw new DOMException('Stale request', 'AbortError');
    clearCsrfCache();
    throw new RoomServiceApiError(
      error instanceof AuthApiError && error.status !== 401 ? error.status : 0,
      error instanceof AuthApiError && error.status === 403 ? m.csrfInvalid : m.csrfFailure,
      {},
      'csrf',
    );
  }
  if (!current()) throw new DOMException('Stale request', 'AbortError');
  return request(
    path,
    action.kind === 'add' ? 201 : 200,
    (value, message) => ({ item: decodeRoomServiceWrite(value, action), message }),
    {
      method: action.kind === 'add' ? 'POST' : action.kind === 'status' ? 'PATCH' : 'PUT',
      body,
      headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
    },
    current,
  );
}
