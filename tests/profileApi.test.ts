import { describe, expect, it } from 'vitest';
import { getPersonalProfile, ProfileApiError, updateAdminProfile, updateHostProfile } from '../src/services/profileApi';
import { profileMessages as m } from '../src/types/profile';
import { adminProfile, customerProfile, hostProfile } from './fixtures/profiles';
import { failure, installApi, ok } from './apiMock';

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(blob); });
}

describe('profile API', () => {
  it.each([adminProfile, hostProfile, customerProfile])('loads $role using cookies and no-store', async (profile) => {
    const api = installApi(profile);
    expect(await getPersonalProfile()).toEqual(profile);
    expect(api.fetchMock).toHaveBeenCalledWith('/api/v1/profile', expect.objectContaining({ method: 'GET', credentials: 'include', cache: 'no-store', headers: expect.objectContaining({ 'Cache-Control': 'no-store' }) }));
  });
  it('whitelists Admin JSON fields and sends CSRF using the supplied header name', async () => {
    const api = installApi(adminProfile);
    api.csrf.mockResolvedValueOnce(ok({ token: 'custom-token', headerName: 'X-Profile-CSRF' }));
    const payload = { fullName: ' Admin mới ', phoneNumber: '', email: 'forged@example.com', id: 'other', role: 'HOST' };
    await updateAdminProfile(payload);
    const init = api.patchProfile.mock.calls[0][0];
    expect(JSON.parse(String(init.body))).toEqual({ fullName: 'Admin mới', phoneNumber: null });
    expect(init).toMatchObject({ credentials: 'include', cache: 'no-store', headers: { 'X-Profile-CSRF': 'custom-token', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  });
  it('whitelists Host JSON and supports explicit logo/address removal', async () => {
    const api = installApi(hostProfile);
    await updateHostProfile({ businessName: ' Host ', phoneNumber: '+84987654321', officeAddress: ' ', removeLogo: true, accountId: 'other' } as Parameters<typeof updateHostProfile>[0]);
    expect(JSON.parse(String(api.patchProfile.mock.calls[0][0].body))).toEqual({ businessName: 'Host', phoneNumber: '+84987654321', officeAddress: null, removeLogo: true });
  });
  it('uses a JSON Blob plus a binary logo without setting multipart Content-Type', async () => {
    const api = installApi(hostProfile);
    const file = new File(['image'], 'logo.png', { type: 'image/png' });
    await updateHostProfile({ businessName: ' Host ', phoneNumber: hostProfile.phoneNumber, officeAddress: ' Office ', removeLogo: false }, file);
    const init = api.patchProfile.mock.calls[0][0];
    const body = init.body as FormData;
    const json = body.get('profile') as Blob;
    expect(json.type).toBe('application/json');
    expect(JSON.parse(await readBlob(json))).toEqual({ businessName: 'Host', phoneNumber: hostProfile.phoneNumber, officeAddress: 'Office', removeLogo: false });
    expect(body.get('logo')).toBe(file);
    expect(init.headers).not.toHaveProperty('Content-Type');
    expect(init.headers).toHaveProperty('X-CSRF-TOKEN', 'csrf-fixture');
  });
  it.each([[400, m.emailProtected], [401, m.sessionInvalid], [403, m.forbidden], [404, m.notFound], [409, m.phoneDuplicate], [500, m.saveFailure]] as const)('preserves status and messages for HTTP %i', async (status, message) => {
    const api = installApi(hostProfile);
    api.patchProfile.mockResolvedValueOnce(failure(status, message, { phoneNumber: message }));
    await expect(updateHostProfile({ ...hostProfile, removeLogo: false })).rejects.toMatchObject({ status, message, fieldErrors: { phoneNumber: message } });
  });
  it('normalizes malformed responses, network errors and CSRF failures', async () => {
    const api = installApi(adminProfile);
    api.getProfile.mockResolvedValueOnce(ok({ role: 'UNKNOWN' }));
    await expect(getPersonalProfile()).rejects.toBeInstanceOf(ProfileApiError);
    api.patchProfile.mockRejectedValueOnce(new TypeError('offline'));
    await expect(updateAdminProfile(adminProfile)).rejects.toMatchObject({ status: 0, message: m.saveFailure });
    api.csrf.mockResolvedValueOnce(failure(401, 'expired'));
    await expect(updateAdminProfile(adminProfile)).rejects.toMatchObject({ status: 401, message: m.sessionInvalid });
  });
});
