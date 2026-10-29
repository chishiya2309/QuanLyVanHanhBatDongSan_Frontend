import { describe, expect, it } from 'vitest';
import { MAX_LOGO_BYTES, validateAdminProfile, validateHostProfile, validateLogo } from '../src/schemas/profileValidation';
import { profileMessages as m } from '../src/types/profile';
import { profileBirthDate, profileIdentityType, profileInitials } from '../src/utils/profilePresentation';

describe('profile validation', () => {
  it('prioritizes required fields and permits clearing the optional Admin phone', () => {
    expect(validateAdminProfile({ fullName: ' ', phoneNumber: null })).toEqual({ fullName: m.nameRequired });
    expect(validateAdminProfile({ fullName: 'Admin', phoneNumber: '' })).toEqual({});
    expect(validateHostProfile({ businessName: ' ', phoneNumber: ' ', removeLogo: false })).toEqual({ businessName: m.hostNameRequired, phoneNumber: m.phoneRequired });
  });
  it.each(['0901234567', '+0123', '+1', '+1234567890123456', ' +84901234567', '+84 901234567'])('rejects invalid phone %s without normalizing it', (phoneNumber) => {
    expect(validateAdminProfile({ fullName: 'Admin', phoneNumber }).phoneNumber).toBe(m.phoneInvalid);
  });
  it.each(['+12', '+84901234567', '+123456789012345'])('accepts E.164 boundary %s', (phoneNumber) => {
    expect(validateAdminProfile({ fullName: 'Admin', phoneNumber })).toEqual({});
  });
  it('enforces the backend name limit', () => {
    expect(validateAdminProfile({ fullName: 'a'.repeat(255) })).toEqual({});
    expect(validateAdminProfile({ fullName: 'a'.repeat(256) }).fullName).toBe(m.fieldProtected);
  });
  it('accepts the exact 5 MiB limit and rejects empty, oversized, unsupported and conflicting images', () => {
    const png = new File([new Uint8Array(MAX_LOGO_BYTES)], 'logo.png', { type: 'image/png' });
    expect(validateLogo(png)).toBeUndefined();
    expect(validateLogo(png, true)).toBe(m.imageFailure);
    expect(validateLogo(new File([], 'empty.png', { type: 'image/png' }))).toBe(m.imageFailure);
    expect(validateLogo(new File([new Uint8Array(MAX_LOGO_BYTES + 1)], 'large.jpg', { type: 'image/jpeg' }))).toBe(m.imageFailure);
    expect(validateLogo(new File(['GIF'], 'logo.gif', { type: 'image/gif' }))).toBe(m.imageFailure);
    expect(validateLogo(new File(['JPEG'], 'logo.jpg', { type: 'image/jpeg' }))).toBeUndefined();
  });
  it('formats a date without applying time zones and labels identities', () => {
    expect(profileBirthDate('1995-05-15')).toBe('15/05/1995');
    expect(profileBirthDate(null)).toBe('Chưa cập nhật');
    expect(profileIdentityType('PASSPORT')).toBe('Hộ chiếu');
    expect(profileIdentityType('CMND')).toBe('CMND');
    expect(profileInitials('  Nguyễn   Văn Admin  ')).toBe('VA');
  });
});
