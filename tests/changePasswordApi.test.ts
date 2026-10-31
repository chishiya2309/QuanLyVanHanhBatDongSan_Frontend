import { describe, expect, it, vi } from 'vitest';
import { changePassword, clearCsrfCache } from '../src/services/authApi';
import { changePasswordMessages as m } from '../src/types/changePassword';
import { failure, ok } from './apiMock';

const payload = { currentPassword: ' old ', newPassword: ' newPassword ', confirmPassword: ' newPassword ' };
const success = () => new Response(JSON.stringify({ status: 200, message: m.success, data: null }));
function api(response: () => Promise<Response> = async () => success()) {
  clearCsrfCache();
  const csrf = vi.fn(async () => ok({ token: 'fresh-csrf', headerName: 'X-UC05-CSRF' }));
  const post = vi.fn(response);
  const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    void init;
    return String(url).endsWith('/csrf') ? csrf() : post();
  });
  vi.stubGlobal('fetch', fetch);
  return { fetch, csrf, post };
}

describe('UC05 API', () => {
  it('fetches fresh CSRF for every submit and sends only three unchanged secrets with cookies', async () => {
    const mock = api();
    const input = { ...payload, accountId: 'must-not-send', role: 'ADMIN' };
    await changePassword(input);
    await changePassword(input);
    expect(mock.csrf).toHaveBeenCalledTimes(2);
    expect(mock.fetch.mock.calls[0][0]).toBe('/api/v1/auth/csrf');
    const [url, init] = mock.fetch.mock.calls[1];
    expect(url).toBe('/api/v1/auth/change-password');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', cache: 'no-store', headers: {
      'X-UC05-CSRF': 'fresh-csrf', 'Content-Type': 'application/json', Accept: 'application/json',
    } });
    expect(JSON.parse(String(init?.body))).toEqual(payload);
  });
  it('filters backend field errors to known nonempty string fields', async () => {
    api(async () => new Response(JSON.stringify({ status: 400, message: m.currentIncorrect, fieldErrors: {
      currentPassword: m.currentIncorrect, role: 'ignored', newPassword: 42, confirmPassword: '',
    } }), { status: 400 }));
    await expect(changePassword(payload)).rejects.toMatchObject({ status: 400, fieldErrors: { currentPassword: m.currentIncorrect } });
  });
  it.each([
    [400, '', m.invalidData], [401, 'wrong backend text', m.sessionInvalid],
    [403, m.forbidden, m.forbidden], [403, m.csrfInvalid, m.csrfInvalid], [500, 'internal detail', m.failure],
  ])('normalizes HTTP %s and does not retry', async (status, message, expected) => {
    const mock = api(async () => failure(status, message));
    await expect(changePassword(payload)).rejects.toMatchObject({ status, message: expected });
    expect(mock.post).toHaveBeenCalledTimes(1);
  });
  it.each([null, { status: 201, data: null }, { status: 200, message: m.success, data: {} }, { status: 200, message: 'unverified', data: null }])('rejects malformed success %j', async (body) => {
    api(async () => new Response(JSON.stringify(body)));
    await expect(changePassword(payload)).rejects.toMatchObject({ message: m.failure });
  });
  it('handles invalid JSON, network failures, CSRF failure and malformed CSRF without posting', async () => {
    api(async () => new Response('<html>error</html>'));
    await expect(changePassword(payload)).rejects.toMatchObject({ message: m.failure });
    api(async () => { throw new TypeError('offline'); });
    await expect(changePassword(payload)).rejects.toMatchObject({ status: 0, message: m.failure });
    const mock = api();
    mock.csrf.mockResolvedValueOnce(failure(500, 'unavailable')).mockResolvedValueOnce(ok({ token: '', headerName: 'X-CSRF-TOKEN' }));
    await expect(changePassword(payload)).rejects.toMatchObject({ message: m.failure });
    await expect(changePassword(payload)).rejects.toMatchObject({ message: m.failure });
    expect(mock.post).not.toHaveBeenCalled();
  });
});
