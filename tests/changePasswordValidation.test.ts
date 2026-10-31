import { describe, expect, it } from 'vitest';
import { validateChangePassword as validate } from '../src/schemas/changePasswordValidation';
import { changePasswordMessages as m } from '../src/types/changePassword';

const form = (newPassword = 'newPassword123', confirmPassword = newPassword) => ({ currentPassword: 'old', newPassword, confirmPassword });

describe('UC05 validation', () => {
  it('prioritizes required messages without changing the input', () => {
    const data = { currentPassword: '   ', newPassword: '', confirmPassword: '' };
    expect(validate(data)).toEqual({ currentPassword: m.currentRequired, newPassword: m.newRequired, confirmPassword: m.confirmRequired });
    expect(data.currentPassword).toBe('   ');
  });
  it.each([[7, m.minLength], [8, undefined], [72, undefined], [73, m.maxBytes]])('checks %s ASCII characters', (length, error) => {
    expect(validate(form('a'.repeat(length))).newPassword).toBe(error);
  });
  it('measures UTF-8 bytes rather than characters and matches backend UTF-16 length', () => {
    expect(validate(form('á'.repeat(36)))).toEqual({});
    expect(validate(form('á'.repeat(37))).newPassword).toBe(m.maxBytes);
    expect(validate(form('😀'.repeat(18)))).toEqual({});
    expect(validate(form('😀'.repeat(19))).newPassword).toBe(m.maxBytes);
    expect(validate(form('😀'.repeat(4)))).toEqual({});
  });
  it('preserves spaces, checks exact confirmation and allows reusing the current password', () => {
    expect(validate(form(' password ', 'password')).confirmPassword).toBe(m.mismatch);
    expect(validate({ ...form(' password '), currentPassword: ' password ' })).toEqual({});
  });
});
