import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../src/components/auth/LoginPage';
import { clearCsrfCache } from '../src/services/authApi';
import { registerWithGoogle, setGooglePassword } from '../src/services/googleAuthApi';
import { validateGoogleOnboarding } from '../src/schemas/googleOnboardingValidation';
import { deferred, failure, ok } from './apiMock';
import type { GoogleOnboardingContext } from '../src/types/auth';
const user = { accountId: 'account-1', loginName: 'host@gmail.com', role: 'HOST', hostId: 'host-1', customerId: null };
const valid = { fullName: 'Nhà An', phoneNumber: '0347983243', password: ' password123 ', confirmPassword: ' password123 ' };
function context(purpose: GoogleOnboardingContext['purpose'] = 'REGISTER_HOST'): GoogleOnboardingContext {
  return { flowId: 'flow-1', purpose, email: 'host@gmail.com', suggestedName: 'Tên Google', expiresAt: new Date(Date.now() + 900000).toISOString() };
}
function install(data = context()) {
  const complete = vi.fn<() => Promise<Response>>(async () => ok(user));
  const cancel = vi.fn(async () => ok(null));
  const me = vi.fn(async () => failure(401, 'Phiên không hợp lệ'));
  const load = vi.fn(async () => ok(data));
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input);
    if (path.endsWith('/csrf')) return ok({ token: 'csrf-fixture', headerName: 'X-CSRF-TOKEN' });
    if (path.endsWith('/google/onboarding')) return load();
    if (path.endsWith('/google/register') || path.endsWith('/google/set-password')) return complete();
    if (path.endsWith('/google/cancel')) return cancel();
    if (path.endsWith('/me')) return me();
    throw new Error(`Unexpected request ${path}: ${init?.method}`);
  });
  vi.stubGlobal('fetch', fetchMock); return { complete, cancel, me, load, fetchMock };
}
function mount(strict = false) {
  const success = vi.fn();
  const page = <LoginPage onNavigateToRegister={vi.fn()} onLoginSuccess={success} />;
  render(strict ? <StrictMode>{page}</StrictMode> : page); return success;
}
async function fill(values = valid) {
  await screen.findByLabelText('Mật khẩu RentOps *');
  for (const [name, value] of Object.entries(values)) fireEvent.change(document.getElementById(`google-${name}`)!, { target: { value } });
}
beforeEach(() => { clearCsrfCache(); window.history.replaceState(null, '', '/auth/callback?status=onboarding_required'); });

describe('Google onboarding API', () => {
  it('sends only editable fields, browser flow and normalized phone, preserving passwords', async () => {
    const api = install();
    await registerWithGoogle({ flowId: 'flow-1', ...valid, fullName: ' Nhà An ' });
    const call = api.fetchMock.mock.calls.find(([url]) => String(url).endsWith('/google/register'))!;
    expect(call[1]).toMatchObject({ method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'X-CSRF-TOKEN': 'csrf-fixture' } });
    expect(JSON.parse(String(call[1]?.body))).toEqual({ ...valid, flowId: 'flow-1', phoneNumber: '+84347983243' });
    await setGooglePassword({ flowId: 'flow-1', password: valid.password, confirmPassword: valid.password });
    const pwd = api.fetchMock.mock.calls.find(([url]) => String(url).endsWith('/google/set-password'))!;
    expect(JSON.parse(String(pwd[1]?.body))).toEqual({ flowId: 'flow-1', password: valid.password, confirmPassword: valid.password });
  });
  it('retries only a CSRF rejection once with a fresh token', async () => {
    const api = install();
    api.complete.mockResolvedValueOnce(failure(403, 'CSRF token bị thiếu hoặc không hợp lệ')).mockResolvedValueOnce(ok(user));
    await setGooglePassword({ flowId: 'flow-1', password: valid.password, confirmPassword: valid.password });
    expect(api.complete).toHaveBeenCalledTimes(2);
    expect(api.fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/csrf'))).toHaveLength(2);
  });
});

describe('Google onboarding user journey', () => {
  it('restores context in StrictMode, displays immutable email and registers exactly once', async () => {
    const api = install(); const gate = deferred<Response>(); api.complete.mockImplementation(() => gate.promise);
    const success = mount(true); await fill();
    expect(window.location.pathname).toBe('/auth/onboarding');
    expect(screen.getByText('host@gmail.com')).toBeTruthy(); expect(screen.queryByRole('textbox', { name: /Email/ })).toBeNull();
    const submit = screen.getByRole('button', { name: 'Tạo tài khoản và tiếp tục' });
    fireEvent.click(submit); fireEvent.click(submit);
    await waitFor(() => expect(api.complete).toHaveBeenCalledTimes(1));
    await act(async () => gate.resolve(ok(user)));
    await waitFor(() => expect(success).toHaveBeenCalledExactlyOnceWith(user));
    expect(window.location.pathname).toBe('/');
    expect(Object.keys(window.localStorage).filter((key) => key !== 'rentops-session-change')).toEqual([]);
    expect(window.localStorage.getItem('rentops-session-change')).not.toContain('password'); expect(window.sessionStorage.length).toBe(0);
  });
  it('focuses invalid fields and preserves typed values on a duplicate phone', async () => {
    const api = install(); mount(); await screen.findByLabelText('Số điện thoại *');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản và tiếp tục' }));
    expect(document.activeElement?.id).toBe('google-phoneNumber');
    await fill(); api.complete.mockResolvedValue(failure(409, 'Số điện thoại đã được đăng ký', { phoneNumber: 'Số điện thoại đã được đăng ký' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản và tiếp tục' }));
    await waitFor(() => expect(document.activeElement?.id).toBe('google-phoneNumber'));
    expect((screen.getByLabelText('Số điện thoại *') as HTMLInputElement).value).toBe(valid.phoneNumber);
    expect((screen.getByLabelText('Mật khẩu RentOps *') as HTMLInputElement).value).toBe(valid.password);
  });
  it('sets a new password for an existing account without asking for old credentials or profile', async () => {
    const api = install(context('SET_PASSWORD')); const success = mount();
    await screen.findByLabelText('Mật khẩu mới *');
    expect(screen.queryByLabelText(/Số điện thoại/)).toBeNull(); expect(screen.queryByLabelText(/Mật khẩu hiện tại/)).toBeNull();
    for (const name of ['password', 'confirmPassword']) fireEvent.change(document.getElementById(`google-${name}`)!, { target: { value: valid.password } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu và tiếp tục' }));
    await waitFor(() => expect(success).toHaveBeenCalledWith(user));
    expect(api.fetchMock.mock.calls.some(([url]) => String(url).endsWith('/google/set-password'))).toBe(true);
  });
  it('supports refresh on the onboarding URL and clears passwords on cancellation', async () => {
    window.history.replaceState(null, '', '/auth/onboarding'); const api = install(); mount(); await fill();
    fireEvent.click(screen.getByRole('button', { name: 'Hủy và quay lại đăng nhập' }));
    await waitFor(() => expect(api.cancel).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('Hoàn tất tài khoản của bạn')).toBeNull());
    expect(window.location.pathname).toBe('/'); expect(document.getElementById('google-password')).toBeNull();
  });
  it('shows a restart action on expiration and rejects a stale tab without keeping its passwords', async () => {
    const api = install(); mount(); await fill();
    api.complete.mockResolvedValue(failure(409, 'Yêu cầu Google đã thay đổi'));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản và tiếp tục' }));
    await screen.findByRole('button', { name: 'Tiếp tục lại với Google' });
    expect(document.getElementById('google-password')).toBeNull();
  });
  it('recovers a lost response by checking the authenticated session before retrying', async () => {
    const api = install(); api.complete.mockRejectedValue(new TypeError('network')); api.me.mockResolvedValue(ok(user));
    const success = mount(); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản và tiếp tục' }));
    await waitFor(() => expect(success).toHaveBeenCalledWith(user)); expect(api.complete).toHaveBeenCalledTimes(1);
    expect(api.me).toHaveBeenCalledTimes(1);
  });
  it('blocks resubmission while the server outcome cannot be determined', async () => {
    const api = install(); api.complete.mockRejectedValue(new TypeError('network')); api.me.mockRejectedValue(new TypeError('offline'));
    mount(); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản và tiếp tục' }));
    await screen.findByRole('button', { name: 'Kiểm tra kết quả' });
    expect(screen.queryByRole('button', { name: 'Tạo tài khoản và tiếp tục' })).toBeNull(); expect(api.complete).toHaveBeenCalledTimes(1);
  });
  it('does not treat another account session as a successful completion after a network error', async () => {
    const api = install(); api.complete.mockRejectedValue(new TypeError('network'));
    api.me.mockResolvedValue(ok({ ...user, loginName: 'another@gmail.com' }));
    const success = mount(); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản và tiếp tục' }));
    await screen.findByText('Chưa hoàn tất đăng nhập. Bạn có thể thử gửi lại');
    expect(success).not.toHaveBeenCalled(); expect(api.load).toHaveBeenCalledTimes(2);
  });
  it('handles the deprecated callback without asking for an existing password', async () => {
    window.history.replaceState(null, '', '/auth/callback?status=link_required');
    const api = install(); mount();
    await screen.findByText('Yêu cầu Google cũ không còn được hỗ trợ. Vui lòng tiếp tục lại với Google');
    expect(api.load).not.toHaveBeenCalled();
    expect(screen.queryByText('Xác nhận liên kết tài khoản')).toBeNull();
  });
  it('handles a missing pending context and the deprecated callback without an old linking form', async () => {
    const api = install(); api.load.mockResolvedValue(failure(401, 'Yêu cầu đã hết hạn')); mount();
    await screen.findByRole('button', { name: 'Tiếp tục lại với Google' }); expect(document.getElementById('google-password')).toBeNull();
  });
});

describe('Google onboarding validation', () => {
  it('uses UTF-8 limits, preserves whitespace and requires matching confirmation', () => {
    expect(validateGoogleOnboarding(valid, 'REGISTER_HOST')).toEqual({});
    expect(validateGoogleOnboarding({ ...valid, password: 'á'.repeat(37), confirmPassword: 'á'.repeat(37) }, 'REGISTER_HOST').password).toContain('72 byte');
    expect(validateGoogleOnboarding({ ...valid, confirmPassword: valid.password.trim() }, 'SET_PASSWORD').confirmPassword).toBeTruthy();
    expect(validateGoogleOnboarding({ ...valid, fullName: 'a'.repeat(256) }, 'REGISTER_HOST').fullName).toBeTruthy();
  });
});
