import { vi } from 'vitest';
import type { PersonalProfileResponse } from '../src/types/profile';
import { clearCsrfCache } from '../src/services/authApi';

export function ok(data: unknown) { return new Response(JSON.stringify({ status: 200, message: 'OK', data }), { status: 200 }); }
export function failure(status: number, message: string, fieldErrors: Record<string, string> = {}) {
  return new Response(JSON.stringify({ status, message, fieldErrors }), { status });
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

export function installApi(profile: PersonalProfileResponse) {
  clearCsrfCache();
  const getProfile = vi.fn(async () => ok(profile));
  const patchProfile = vi.fn(async (init: RequestInit) => { void init; return ok(profile); });
  const csrf = vi.fn(async () => ok({ token: 'csrf-fixture', headerName: 'X-CSRF-TOKEN' }));
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const path = String(input);
    if (path.endsWith('/auth/me')) return ok({ accountId: 'fixture-session', loginName: 'profile-user', role: profile.role, hostId: null, customerId: null });
    if (path.endsWith('/auth/csrf')) return csrf();
    if (path.endsWith('/auth/logout')) return ok(null);
    if (path.endsWith('/profile')) return init.method === 'PATCH' ? patchProfile(init) : getProfile();
    throw new Error(`Unexpected test request: ${path}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, getProfile, patchProfile, csrf };
}
