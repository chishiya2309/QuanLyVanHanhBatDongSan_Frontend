import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RegisterHostForm } from '../src/components/auth/RegisterHostForm';
import { validateRegisterHost } from '../src/schemas/registerHostValidation';
import { validateAdminProfile, validateHostProfile } from '../src/schemas/profileValidation';
import { registerHost } from '../src/services/authApi';
import { PHONE_NUMBER_HELP } from '../src/utils/phoneNumber';
import { deferred, failure, ok } from './apiMock';

const valid = {
  fullName: 'Nguyễn Văn An', email: 'host@example.com', phoneNumber: '0347983243',
  password: 'Password123', confirmPassword: 'Password123',
};

const acceptedPhones = [
  ['0347983243', '+84347983243'], ['0989897676', '+84989897676'],
  ['0547983243', '+84547983243'], ['0747983243', '+84747983243'],
  ['0847983243', '+84847983243'], ['  0347983243  ', '+84347983243'],
  ['+84347983243', '+84347983243'], ['  +14155552671  ', '+14155552671'],
  ['+442079460958', '+442079460958'],
];

describe('phone validation across registration and profiles', () => {
  it.each(acceptedPhones)('accepts %s consistently and leaves the input unchanged', (phoneNumber) => {
    const data = { ...valid, phoneNumber };
    expect(validateRegisterHost(data).isValid).toBe(true);
    expect(validateAdminProfile({ fullName: valid.fullName, phoneNumber })).toEqual({});
    expect(validateHostProfile({ businessName: valid.fullName, phoneNumber, removeLogo: false })).toEqual({});
    expect(data.phoneNumber).toBe(phoneNumber);
  });

  it.each([
    '034798324', '03479832430', '0247983243', '0147983243', '034798324a',
    '034 7983243', '034-798-3243', '034.798.3243', '+84 347983243',
    '+0123456789', '+1', '+1234567890123456', '84347983243',
  ])('rejects invalid %s consistently', (phoneNumber) => {
    expect(validateRegisterHost({ ...valid, phoneNumber }).errors.phoneNumber).toBe('Số điện thoại không hợp lệ');
    expect(validateAdminProfile({ fullName: valid.fullName, phoneNumber }).phoneNumber).toBe('Số điện thoại không hợp lệ');
    expect(validateHostProfile({ businessName: valid.fullName, phoneNumber, removeLogo: false }).phoneNumber).toBe('Số điện thoại không hợp lệ');
  });

  it('prioritizes required errors and allows an optional Admin phone to be cleared', () => {
    expect(validateRegisterHost({ ...valid, phoneNumber: ' ' }).errors.phoneNumber).toBe('Vui lòng nhập số điện thoại');
    expect(validateHostProfile({ businessName: valid.fullName, phoneNumber: ' ', removeLogo: false }).phoneNumber).toBe('Vui lòng nhập số điện thoại');
    expect(validateAdminProfile({ fullName: valid.fullName, phoneNumber: ' ' })).toEqual({});
  });
});

describe('registration phone submission', () => {
  it.each(acceptedPhones)('posts normalized %s as %s without mutating the request', async (phoneNumber, expected) => {
    const fetchMock = vi.fn<typeof fetch>(async () => ok(null));
    vi.stubGlobal('fetch', fetchMock);
    const request = { ...valid, phoneNumber };
    await registerHost(request);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/register-host', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ ...valid, phoneNumber: expected });
    expect(request.phoneNumber).toBe(phoneNumber);
  });

  it('keeps the typed domestic phone and displays a server duplicate error inline', async () => {
    const gate = deferred<Response>();
    const fetchMock = vi.fn<typeof fetch>(() => gate.promise);
    vi.stubGlobal('fetch', fetchMock);
    render(<RegisterHostForm onNavigateToLogin={vi.fn()} />);
    for (const [id, value] of Object.entries(valid)) {
      fireEvent.change(document.getElementById(id)!, { target: { value } });
    }
    expect(screen.getByText(PHONE_NUMBER_HELP)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký tài khoản Host' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).phoneNumber).toBe('+84347983243');
    expect((screen.getByLabelText(/Số điện thoại/) as HTMLInputElement).value).toBe('0347983243');
    await act(async () => {
      gate.resolve(failure(409, 'Số điện thoại đã được đăng ký', { phoneNumber: 'Số điện thoại đã được đăng ký' }));
    });
    await screen.findByText('Số điện thoại đã được đăng ký');
    expect(screen.getByLabelText(/Số điện thoại/).getAttribute('aria-invalid')).toBe('true');
    expect((screen.getByLabelText(/Số điện thoại/) as HTMLInputElement).value).toBe('0347983243');
  });
});
