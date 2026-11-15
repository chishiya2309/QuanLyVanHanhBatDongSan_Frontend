import { describe, expect, it, vi } from 'vitest';
import { stringify } from 'lossless-json';
import { createFundingSource, updateFundingSource, changeFundingSourceStatus, listBanks, listFundingSources, getFundingSource, getDeactivationImpact } from '../src/services/fundingApi';
import { decodeFundingSource, encodeFundingBody, parseFundingJson } from '../src/services/fundingCodec';
import { parseFundingRoute, fundingUrl } from '../src/utils/fundingNavigation';
import { fundingFields, validateFundingFields } from '../src/utils/fundingValidation';
import { rememberSession, invalidateSession } from '../src/services/sessionClient';
import { fsBank, fsBanks, fsCash, fsFixture, fsHost, fsImpact, fsLocked, fsReply, fsRoute, fsWire } from './fixtures/fundingSources';
import { deferred } from './apiMock';
function setup(mode = 'full') { const f = fsFixture({ mode }); window.history.replaceState(null, '', '/funding-sources'); rememberSession(fsHost); vi.stubGlobal('fetch', f.fetcher); return f; }
const writes = (f: ReturnType<typeof setup>) => f.calls.filter(c => ['POST', 'PATCH'].includes(c.method));
describe('UC40 wire contract and validation', () => {
  it.each(['0', '9007199254740993', '9223372036854775807'])('round trips Long version %s as an exact JSON number', version => {
    const value = decodeFundingSource(parseFundingJson(stringify(fsWire({ ...fsBank, version }))!));
    // Decode a real lossless number, never an already rounded native Number.
    expect(value.version).toBe(version);
    expect(encodeFundingBody({ name: 'Mới', version })).toBe(`{"name":"Mới","version":${version}}`);
  });
  it.each(['-1', '0.1', '1e3', '9223372036854775808'])('refuses invalid version %s', version => expect(() => encodeFundingBody({ version })).toThrow());
  it('validates Unicode code points and preserves account text', () => {
    const f = { ...fundingFields(fsBank), name: '😀'.repeat(100), accountHolder: 'Nguyễn Văn An' };
    expect(validateFundingFields(f, true, fsBanks)).toEqual({});
    expect(validateFundingFields({ ...f, name: f.name + '😀' }, true, fsBanks).name).toBeTruthy();
    for (const accountNumber of ['12345', '1'.repeat(26), '１２３４５６', '0012a345', '001 234']) expect(validateFundingFields({ ...f, accountNumber }, true, fsBanks).accountNumber).toBeTruthy();
    expect(validateFundingFields({ ...f, name: '  ', bankCode: 'BAD', accountHolder: ' ' }, true, fsBanks)).toHaveProperty('accountHolder');
  });
  it('GETs use filters, cookies and no CSRF acquisition', async () => {
    const f = setup(); expect(await listFundingSources({ type: 'BANK', active: 'false' })).toHaveLength(1); await listBanks(); await getFundingSource(fsBank.id); await getDeactivationImpact(fsBank.id);
    expect(f.calls.some(c => c.path.endsWith('/auth/csrf'))).toBe(false);
    expect(f.calls[0].query).toBe('?type=BANK&active=false');
  });
  it('creates exact CASH/BANK payloads without client-controlled ownership/status', async () => {
    const f = setup(); await createFundingSource('CASH', { ...fundingFields(), name: ' Tiền mặt ' }, []);
    await createFundingSource('BANK', fundingFields(fsBank), fsBanks);
    expect(writes(f)[0].body).toBe('{"name":"Tiền mặt","type":"CASH"}');
    expect(JSON.parse(writes(f)[1].body!)).toEqual({ name: fsBank.name, type: 'BANK', bankDetails: fsBank.bankDetails });
    expect(writes(f).every(c => c.csrf === 'fs-test-token')).toBe(true);
  });
  it('omits bankDetails for locked history, CASH and unchanged BANK; sends all fields when changed', async () => {
    const f = setup(); await updateFundingSource(fsLocked, { ...fundingFields(fsLocked), name: 'Tên mới', accountNumber: '99999999' }, fsBanks);
    expect(writes(f)[0].body).toBe('{"name":"Tên mới","version":9007199254740993}');
    await updateFundingSource(fsCash, fundingFields(fsCash), []);
    await updateFundingSource(fsBank, fundingFields(fsBank), fsBanks);
    expect(writes(f).every(c => !c.body!.includes('bankDetails'))).toBe(true);
    await updateFundingSource(fsBank, { ...fundingFields(fsBank), accountNumber: '000000123456' }, fsBanks);
    expect(JSON.parse(writes(f).at(-1)!.body!).bankDetails).toEqual({ ...fsBank.bankDetails, accountNumber: '000000123456' });
  });
  it('binds deactivation to its exact preview; activation sends no token', async () => {
    const f = setup(); await changeFundingSourceStatus(fsBank.id, false, fsBank.version, fsImpact(), () => true);
    expect(writes(f)[0].body).toBe(`{"active":false,"confirmed":true,"version":9007199254740993,"confirmationToken":"${'a'.repeat(64)}"}`);
    expect(() => changeFundingSourceStatus(fsBank.id, false, '1', fsImpact())).toThrow();
    await changeFundingSourceStatus(fsLocked.id, true, fsLocked.version, null); expect(writes(f)[1].body).not.toContain('confirmationToken');
  });
  it.each([['duplicate', 'FUNDING_NAME_DUPLICATE', 'name'], ['account-duplicate', 'FUNDING_BANK_ACCOUNT_DUPLICATE', 'accountNumber'], ['fields', 'FUNDING_INVALID_DATA', 'accountHolder']])('uses business code and dotted field errors: %s', async (mode, code, field) => {
    const f = setup(mode); await expect(createFundingSource('BANK', fundingFields(fsBank), fsBanks)).rejects.toMatchObject({ code, fieldErrors: { [field]: expect.any(String) }, phase: 'write' }); expect(writes(f)).toHaveLength(1);
  });
  it.each(['uncertain', 'bad-response'])('marks %s uncertain without retry', async mode => {
    const f = setup(mode); await expect(createFundingSource('BANK', fundingFields(fsBank), fsBanks)).rejects.toMatchObject({ phase: 'uncertain' }); expect(writes(f)).toHaveLength(1);
  });
  it('distinguishes known rollback and CSRF errors from role denial', async () => {
    setup('storage'); await expect(createFundingSource('CASH', { ...fundingFields(), name: 'Mới' }, [])).rejects.toMatchObject({ phase: 'write', code: 'FUNDING_STORAGE_FAILURE' });
    setup('csrf'); await expect(createFundingSource('CASH', { ...fundingFields(), name: 'Mới' }, [])).rejects.toMatchObject({ status: 403, code: 'CSRF_INVALID' });
    setup('denied'); await expect(listBanks()).resolves.toHaveLength(2); await expect(listFundingSources(fsRoute)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it.each(['navigation', 'session'])('prevents old write after %s changes during CSRF', async kind => {
    const gate = deferred<Response>(), f = setup();
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => String(input).endsWith('/auth/csrf') ? gate.promise : f.fetcher(input, init));
    const pending = createFundingSource('CASH', { ...fundingFields(), name: 'Mới' }, []), result = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    if (kind === 'session') invalidateSession(); else window.history.replaceState(null, '', '/');
    gate.resolve(fsReply({ headerName: 'X-CSRF-TOKEN', token: 'late' })); await result; expect(writes(f)).toHaveLength(0);
  });
});
describe('UC40 URL privacy', () => {
  it.each(['action=edit', 'action=edit&sourceId=bad', 'action=delete', 'type=OTHER', 'active=yes', 'action=create-bank&sourceId=' + fsBank.id, 'type=BANK&type=CASH', 'accountNumber=123456'])('rejects malformed context %s', query => expect(parseFundingRoute('/funding-sources', '?' + query)?.invalid).toBe(true));
  it('retains only filters/action/id and rejects other routes', () => {
    const url = fundingUrl({ ...fsRoute, type: 'BANK', active: 'false' }, 'edit', fsBank.id);
    expect(url).toBe('/funding-sources?type=BANK&active=false&action=edit&sourceId=' + fsBank.id);
    expect(parseFundingRoute('/funding-sources', url.slice(url.indexOf('?')))).toMatchObject({ action: 'edit', sourceId: fsBank.id, invalid: false });
    expect(parseFundingRoute('/other', '')).toBeNull();
  });
});
