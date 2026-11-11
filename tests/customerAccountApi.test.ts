import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isLosslessNumber, parse } from 'lossless-json';
import { CustomerAccountApiError, getCustomerAccount, lockCustomerAccount, provisionCustomerAccount, unlockCustomerAccount } from '../src/services/customerAccountApi';
import { accountVersion, decodeCustomerAccount, encodeProvisionCustomerAccount } from '../src/services/customerAccountCodec';
import { customerAccountMessages as m } from '../src/types/customerAccount';
import { validateCustomerAccount } from '../src/utils/customerAccountValidation';
import { parseCustomerRoute, customerUrl } from '../src/utils/customerNavigation';
import { cachedCsrfToken } from '../src/services/csrfClient';

vi.mock('../src/services/sessionClient', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/services/sessionClient')>(),
  authenticatedFetch: (url: string, init: RequestInit) => fetch(url, init),
}));

const id = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const absent = { customerId: id, hasAccount: false, accountId: null, loginName: null, role: null, status: null, createdAt: null, customerVersion: 0 };
const active = { ...absent, hasAccount: true, accountId, loginName: 'login@example.com', role: 'CUSTOMER', status: 'ACTIVE', createdAt: '2026-11-09T01:00:00Z', customerVersion: 1 };
const fields = { email: ' login@example.com ', password: ' Abcd123 ', confirmPassword: ' Abcd123 ' };
const response = (status: number, message: string, data: unknown, fieldErrors = {}) => new Response(JSON.stringify(
  status < 400 ? { status, message, data } : { status, message, fieldErrors, path: `/api/v1/customers/${id}/account`, error: 'Error', timestamp: '2026-11-09T01:00:00Z' }
), { status, headers: { 'Content-Type': 'application/json' } });
let next: () => Response;
let calls: { url: string; init: RequestInit }[];
beforeEach(() => {
  window.history.replaceState(null, '', '/');
  calls = []; next = () => response(200, m.detailSuccess, absent);
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/auth/csrf')) return new Response(JSON.stringify({ data: { token: 'token', headerName: 'X-CSRF-TOKEN' } }));
    return next();
  }));
});

describe('UC08 contract and lossless codec', () => {
  it('decodes absent and present accounts without confusing loading errors with no account', () => {
    expect(decodeCustomerAccount(absent, id)).toMatchObject({ hasAccount: false, customerVersion: '0' });
    expect(decodeCustomerAccount(active, id)).toMatchObject({ hasAccount: true, role: 'CUSTOMER', customerVersion: '1' });
    for (const invalid of [{ ...active, role: 'HOST' }, { ...active, status: 'UNKNOWN' }, { ...active, createdAt: 'yesterday' },
      { ...active, loginName: undefined }, { ...absent, accountId }, { ...active, customerVersion: undefined }, { ...active, customerId: accountId }]) {
      expect(() => decodeCustomerAccount(invalid, id)).toThrow();
    }
  });
  it.each(['9007199254740993', '9223372036854775807'])('round-trips Long version %s as a JSON number', (version) => {
    const encoded = encodeProvisionCustomerAccount({ ...fields, customerVersion: version });
    expect(encoded).toContain(`"customerVersion":${version}`);
    const wire = parse(encoded) as Record<string, unknown>;
    expect(isLosslessNumber(wire.customerVersion)).toBe(true);
    expect(decodeCustomerAccount({ ...absent, customerVersion: wire.customerVersion }, id).customerVersion).toBe(version);
    expect(wire.email).toBe('login@example.com');
    expect(wire.password).toBe(fields.password);
  });
  it.each(['-1', '1.5', '9223372036854775808', '1e2', '', Number.MAX_SAFE_INTEGER + 1])('rejects invalid version %s', (version) => {
    expect(() => accountVersion(version)).toThrow();
  });
  it('rejects unknown provision fields instead of leaking account roles or ownership', () => {
    expect(() => encodeProvisionCustomerAccount({ ...fields, customerVersion: '0', ...{ hostId: id } })).toThrow();
  });
  it('uses the existing GET endpoint and no-store credentials', async () => {
    expect((await getCustomerAccount(id)).hasAccount).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: `/api/v1/customers/${id}/account`, init: { method: 'GET', credentials: 'include', cache: 'no-store' } });
  });
  it('sends exactly four provision fields and bodyless PATCH actions with CSRF', async () => {
    next = () => response(201, m.provisionSuccess, active);
    await provisionCustomerAccount(id, { ...fields, customerVersion: '0' });
    const post = calls.find((call) => call.init.method === 'POST')!;
    expect(JSON.parse(String(post.init.body))).toEqual({ ...fields, email: 'login@example.com', customerVersion: 0 });
    expect(new Headers(post.init.headers).get('X-CSRF-TOKEN')).toBe('token');
    next = () => response(200, m.lockSuccess, { ...active, status: 'LOCKED' });
    await lockCustomerAccount(id);
    next = () => response(200, m.unlockSuccess, active);
    await unlockCustomerAccount(id);
    const patches = calls.filter((call) => call.init.method === 'PATCH');
    expect(patches.map((call) => call.url)).toEqual([`/api/v1/customers/${id}/account/lock`, `/api/v1/customers/${id}/account/unlock`]);
    for (const call of patches) {
      expect(call.init.body).toBeUndefined();
      expect(new Headers(call.init.headers).get('X-CSRF-TOKEN')).toBe('token');
    }
  });
  it.each([
    [401, 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại', m.sessionInvalid],
    [403, m.forbidden, m.forbidden], [404, 'Không thể truy cập Customer được yêu cầu', m.notFound],
    [400, m.invalidData, m.invalidData], [409, m.alreadyHasAccount, m.alreadyHasAccount],
    [409, m.emailDuplicate, m.emailDuplicate], [409, m.noAccount, m.noAccount],
    [409, m.alreadyLocked, m.alreadyLocked], [409, m.alreadyActive, m.alreadyActive],
    [409, 'Hồ sơ Customer đã thay đổi. Vui lòng tải lại dữ liệu', m.stale],
    [500, 'Lỗi hệ thống khi xử lý tài khoản', m.wrongRole], [500, 'Unknown server failure', m.detailFailure],
  ])('maps HTTP %s / %s without invented error codes', async (status, message, expected) => {
    next = () => response(status, message, null);
    await expect(getCustomerAccount(id)).rejects.toMatchObject({ status, message: expected });
  });
  it('keeps field errors and clears only the CSRF cache for a CSRF rejection', async () => {
    next = () => response(409, m.emailDuplicate, null, { email: m.emailDuplicate });
    await expect(provisionCustomerAccount(id, { ...fields, customerVersion: '0' })).rejects.toMatchObject({ fieldErrors: { email: m.emailDuplicate } });
    expect(cachedCsrfToken()).not.toBeNull();
    next = () => response(403, m.csrfInvalid, null);
    await expect(lockCustomerAccount(id)).rejects.toMatchObject({ message: m.csrfInvalid });
    expect(cachedCsrfToken()).toBeNull();
  });
  it.each(['provision', 'lock', 'unlock'] as const)('uses the correct failure message for %s', async (action) => {
    next = () => response(500, 'Server failure', null);
    const promise = action === 'provision' ? provisionCustomerAccount(id, { ...fields, customerVersion: '0' })
      : action === 'lock' ? lockCustomerAccount(id) : unlockCustomerAccount(id);
    await expect(promise).rejects.toMatchObject({ message: action === 'provision' ? m.provisionFailure : action === 'lock' ? m.lockFailure : m.unlockFailure });
  });
  it('treats lost or malformed write responses as uncertain and never retries', async () => {
    next = () => { throw new TypeError('Network failed'); };
    await expect(lockCustomerAccount(id)).rejects.toMatchObject({ phase: 'uncertain', message: m.uncertain });
    expect(calls.filter((call) => call.init.method === 'PATCH')).toHaveLength(1);
    next = () => new Response('not-json', { status: 201 });
    await expect(provisionCustomerAccount(id, { ...fields, customerVersion: '0' })).rejects.toBeInstanceOf(CustomerAccountApiError);
    next = () => response(200, m.lockSuccess, active);
    await expect(lockCustomerAccount(id)).rejects.toMatchObject({ phase: 'uncertain' });
  });
  it('stops a write if navigation changes while waiting for CSRF', async () => {
    let release!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { release = resolve; })));
    const promise = lockCustomerAccount(id);
    window.history.pushState(null, '', '/customers');
    release(new Response(JSON.stringify({ data: { token: 'token', headerName: 'X-CSRF-TOKEN' } })));
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('UC08 Unicode validation and safe routes', () => {
  it('requires every visible field and validates the login email', () => {
    expect(validateCustomerAccount({ email: '', password: '', confirmPassword: '' })).toEqual({ email: m.emailRequired, password: m.passwordRequired, confirmPassword: m.confirmationRequired });
    expect(validateCustomerAccount({ ...fields, email: 'invalid' }).email).toBe(m.emailInvalid);
    expect(validateCustomerAccount({ ...fields, email: 'a'.repeat(256) + '@test.com' }).email).toBe(m.emailInvalid);
    expect(validateCustomerAccount({ ...fields, confirmPassword: 'different' }).confirmPassword).toBe(m.confirmationMismatch);
  });
  it.each([
    ['😀'.repeat(7), m.passwordShort], ['😀'.repeat(8), undefined],
    ['a'.repeat(72), undefined], ['a'.repeat(73), m.passwordLong],
    ['é'.repeat(36), undefined], ['é'.repeat(37), m.passwordLong],
  ])('checks code points and UTF-8 bytes independently', (password, error) => {
    expect(validateCustomerAccount({ email: 'a@test.com', password, confirmPassword: password }).password).toBe(error);
  });
  it.each(['provision', 'lock', 'unlock'] as const)('preserves context for %s without side effects', (accountAction) => {
    const url = customerUrl({ q: 'Nguyễn', page: 2, size: 50 }, { customerId: id, accountAction });
    const parsed = new URL(url, location.origin);
    expect(parseCustomerRoute(parsed.pathname, parsed.search)).toMatchObject({ accountAction, q: 'Nguyễn', page: 2, size: 50, invalid: false });
  });
  it.each(['?accountAction=delete', '?accountAction=lock&accountAction=unlock', '?accountAction=lock&action=edit', '?accountAction=lock&vehicleAction=create'])('rejects malformed or competing modal routes %s', (search) => {
    expect(parseCustomerRoute(`/customers/${id}`, search)?.invalid).toBe(true);
  });
  it('rejects account modal on list and invalid UUIDs', () => {
    expect(parseCustomerRoute('/customers', '?accountAction=provision')?.invalid).toBe(true);
    expect(parseCustomerRoute('/customers/invalid', '?accountAction=provision')).toMatchObject({ customerId: null, invalid: true });
  });
});
