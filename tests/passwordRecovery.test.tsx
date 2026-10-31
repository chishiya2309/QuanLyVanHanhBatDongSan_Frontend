import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { createRecoveryBootstrap, captureRecoveryEntry } from '../src/utils/recoveryNavigation';
import { validateRecoveryEmail, validateResetPassword } from '../src/schemas/passwordRecoveryValidation';
import { requestPasswordReset, resetPassword, validatePasswordResetToken } from '../src/services/passwordRecoveryApi';
import { recoveryMessages as m } from '../src/types/passwordRecovery';
import { deferred, failure, ok } from './apiMock';

beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(() => window.history.replaceState(null, '', '/'));
const reply = (message: string) => new Response(JSON.stringify({ status: 200, message, data: null }));
function install() {
  const forgot = vi.fn(async () => reply(m.accepted));
  const validate = vi.fn(async () => reply(m.linkValid));
  const reset = vi.fn(async () => reply(m.success));
  const csrf = vi.fn(async () => ok({ token: 'fresh', headerName: 'X-CSRF-TOKEN' }));
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); void init;
    if (url.endsWith('/auth/csrf')) return csrf();
    if (url.endsWith('/auth/me')) return failure(401, 'guest');
    if (url.endsWith('/forgot-password')) return forgot();
    if (url.endsWith('/reset-password/validate')) return validate();
    if (url.endsWith('/reset-password')) return reset();
    throw new Error('Unexpected fixture request');
  });
  vi.stubGlobal('fetch', fetch);
  return { forgot, validate, reset, csrf, fetch };
}
function mountReset(token = 'fixture-token', strict = true) {
  window.history.replaceState(null, '', `/reset-password${token ? '#token=' + token : ''}`);
  const bootstrap = createRecoveryBootstrap();
  const app = <App initialRecovery={bootstrap} />;
  const view = render(strict ? <StrictMode>{app}</StrictMode> : app);
  return { ...view, bootstrap };
}
async function fillReset() {
  await screen.findByLabelText('Mật khẩu mới *');
  fireEvent.change(screen.getByLabelText('Mật khẩu mới *'), { target: { value: ' newPassword123 ' } });
  fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu mới *'), { target: { value: ' newPassword123 ' } });
}

describe('UC06 validation and navigation bootstrap', () => {
  it('validates normalized email without changing the original and checks 254 characters', () => {
    expect(validateRecoveryEmail('  ')).toEqual({ email: m.emailRequired });
    expect(validateRecoveryEmail('  HOST@EXAMPLE.COM ')).toEqual({});
    expect(validateRecoveryEmail('bad')).toEqual({ email: m.emailInvalid });
    expect(validateRecoveryEmail('a'.repeat(250) + '@example.com')).toEqual({ email: m.emailInvalid });
  });
  it('prioritizes required errors and measures UTF-8 while preserving exact confirmation', () => {
    expect(validateResetPassword({ newPassword: ' ', confirmPassword: '' })).toEqual({ newPassword: m.newRequired, confirmPassword: m.confirmRequired });
    for (const [password, error] of [['a'.repeat(7), m.minLength], ['a'.repeat(8), undefined], ['a'.repeat(72), undefined], ['a'.repeat(73), m.maxBytes], ['á'.repeat(36), undefined], ['á'.repeat(37), m.maxBytes]]) {
      expect(validateResetPassword({ newPassword: password!, confirmPassword: password! }).newPassword).toBe(error);
    }
    expect(validateResetPassword({ newPassword: ' password ', confirmPassword: 'password' }).confirmPassword).toBe(m.mismatch);
  });
  it.each(['', '#token=', '#token=a&token=b', '?token=not-accepted'])('rejects missing/ambiguous token %s and sanitizes the URL', (suffix) => {
    window.history.replaceState(null, '', '/reset-password' + suffix);
    expect(captureRecoveryEntry()).toEqual({ path: '/reset-password', token: null });
    expect(location.href.endsWith('/reset-password')).toBe(true);
    expect(history.state).toBeNull();
  });
});

describe('UC06 API contract and privacy', () => {
  it('posts only allowed fields with fresh CSRF and unchanged passwords', async () => {
    const api = install();
    await requestPasswordReset({ email: '  HOST@EXAMPLE.COM ' });
    await validatePasswordResetToken('fragment-token');
    await resetPassword({ token: 'fragment-token', newPassword: ' password ', confirmPassword: ' password ' });
    expect(api.csrf).toHaveBeenCalledTimes(3);
    const posts = api.fetch.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts.map(([url]) => String(url))).toEqual(['/api/v1/auth/forgot-password', '/api/v1/auth/reset-password/validate', '/api/v1/auth/reset-password']);
    expect(posts.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([{ email: 'host@example.com' }, { token: 'fragment-token' }, { token: 'fragment-token', newPassword: ' password ', confirmPassword: ' password ' }]);
    for (const [, init] of posts) expect(init).toMatchObject({ credentials: 'include', cache: 'no-store', headers: { 'X-CSRF-TOKEN': 'fresh' } });
  });
  it('does not expose unknown account messages or keys and does not retry', async () => {
    const api = install();
    api.forgot.mockResolvedValueOnce(failure(400, 'Email chưa đăng ký', { email: 'Email chưa đăng ký', accountId: 'sensitive' }));
    await expect(requestPasswordReset({ email: 'user@example.com' })).rejects.toMatchObject({ message: m.failure, fieldErrors: {} });
    expect(api.forgot).toHaveBeenCalledTimes(1);
  });
  it('maps documented field errors and distinguishes invalid token from technical failures', async () => {
    const api = install();
    api.reset.mockResolvedValueOnce(failure(400, m.minLength, { newPassword: m.minLength, token: 'ignore' }));
    await expect(resetPassword({ token: 'a', newPassword: 'short', confirmPassword: 'short' })).rejects.toMatchObject({ fieldErrors: { newPassword: m.minLength } });
    api.validate.mockResolvedValueOnce(failure(400, m.linkInvalid)).mockResolvedValueOnce(failure(500, 'server detail'));
    await expect(validatePasswordResetToken('a')).rejects.toMatchObject({ message: m.linkInvalid });
    await expect(validatePasswordResetToken('a')).rejects.toMatchObject({ message: m.failure });
  });
  it('rejects malformed success, network errors and failed CSRF without posting', async () => {
    const api = install();
    api.forgot.mockResolvedValueOnce(ok(null)).mockRejectedValueOnce(new TypeError('offline'));
    await expect(requestPasswordReset({ email: 'a@b.com' })).rejects.toMatchObject({ message: m.failure });
    await expect(requestPasswordReset({ email: 'a@b.com' })).rejects.toMatchObject({ message: m.failure });
    api.csrf.mockResolvedValueOnce(ok({ token: '', headerName: 'X-CSRF-TOKEN' }));
    await expect(requestPasswordReset({ email: 'a@b.com' })).rejects.toMatchObject({ message: m.failure });
    expect(api.forgot).toHaveBeenCalledTimes(2);
  });
});

describe('UC06 integrated screens', () => {
  it('connects login, validates email, acknowledges honestly and only resubmits manually', async () => {
    const api = install(); render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Quên mật khẩu?' }));
    expect(location.pathname).toBe('/forgot-password');
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    expect(screen.getByText(m.emailRequired)).toBeTruthy(); expect(api.forgot).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText('Email *'));
    await user.type(screen.getByLabelText('Email *'), ' USER@EXAMPLE.COM ');
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await screen.findByText(m.accepted);
    expect(screen.queryByLabelText('Email *')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu khác' }));
    expect(api.forgot).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText('Email *') as HTMLInputElement).value).toBe('');
    await user.click(screen.getByRole('link', { name: 'Quay lại Đăng nhập' }));
    expect(location.pathname).toBe('/');
  });
  it('preserves token through StrictMode, sanitizes bootstrap and prevents auth bootstrap from overriding recovery', async () => {
    const api = install();
    const gate = deferred<Response>(); api.validate.mockReturnValueOnce(gate.promise);
    const { bootstrap } = mountReset();
    expect(location.hash).toBe(''); expect(bootstrap.read().token).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Đang kiểm tra');
    expect(screen.queryByLabelText('Mật khẩu mới *')).toBeNull();
    await waitFor(() => expect(api.validate).toHaveBeenCalledTimes(1));
    expect(api.fetch.mock.calls.some(([url]) => String(url).endsWith('/auth/me'))).toBe(false);
    await act(async () => gate.resolve(reply(m.linkValid)));
    await fillReset();
    expect(api.fetch.mock.calls.find(([url]) => String(url).endsWith('/validate'))?.[1]?.body).toBe(JSON.stringify({ token: 'fixture-token' }));
  });
  it('shows missing/invalid links without displaying a password form and offers a new request', async () => {
    const api = install(); mountReset('');
    await screen.findByText(m.linkInvalid);
    expect(api.validate).not.toHaveBeenCalled(); expect(screen.queryByLabelText('Mật khẩu mới *')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu khôi phục mới' }));
    expect(location.pathname).toBe('/forgot-password');
  });
  it('retries a verification network failure without declaring the link invalid', async () => {
    const api = install(); api.validate.mockRejectedValueOnce(new TypeError('offline'));
    mountReset(); await screen.findByText(m.failure);
    expect(screen.queryByText(m.linkInvalid)).toBeNull(); expect(screen.queryByLabelText('Mật khẩu mới *')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByLabelText('Mật khẩu mới *'); expect(api.validate).toHaveBeenCalledTimes(2);
  });
  it.each([m.requestInvalid, m.csrfInvalid, m.failure])('handles reset result %s correctly', async (message) => {
    const api = install(); api.reset.mockResolvedValueOnce(failure(message === m.csrfInvalid ? 403 : message === m.failure ? 500 : 400, message));
    mountReset(); await fillReset(); fireEvent.submit(document.querySelector('.recovery-form')!);
    await screen.findByText(message);
    if (message === m.requestInvalid) expect(screen.queryByLabelText('Mật khẩu mới *')).toBeNull();
    else {
      expect((screen.getByLabelText('Mật khẩu mới *') as HTMLInputElement).value).toBe(' newPassword123 ');
      expect(api.reset).toHaveBeenCalledTimes(1);
      await userEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));
      await screen.findByText(m.success);
    }
  });
  it('guards duplicate submits and navigates to typed success without login/logout/refresh', async () => {
    const api = install(); const gate = deferred<Response>(); api.reset.mockReturnValueOnce(gate.promise);
    mountReset(); await fillReset();
    const form = document.querySelector('.recovery-form')!; fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(api.reset).toHaveBeenCalledTimes(1));
    expect((screen.getByLabelText('Mật khẩu mới *') as HTMLInputElement).disabled).toBe(true);
    await act(async () => gate.resolve(reply(m.success)));
    await screen.findByText(m.success); expect(screen.getByRole('status')).toBeTruthy();
    expect(location.pathname).toBe('/'); expect(location.hash).toBe('');
    expect((screen.getByLabelText(/^Mật khẩu/) as HTMLInputElement).value).toBe('');
    expect(api.fetch.mock.calls.some(([url]) => /\/(login|logout|refresh)$/.test(String(url)))).toBe(false);
  });
  it('ignores an unmounted submission and handles Back/Forward without recovering a saved token', async () => {
    const api = install(); const gate = deferred<Response>(); api.reset.mockReturnValueOnce(gate.promise);
    mountReset(); await fillReset(); fireEvent.submit(document.querySelector('.recovery-form')!);
    await waitFor(() => expect(api.reset).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('link', { name: 'Quay lại Đăng nhập' }));
    await act(async () => gate.resolve(reply(m.success)));
    expect(screen.queryByText(m.success)).toBeNull();
    act(() => { history.replaceState(null, '', '/reset-password'); window.dispatchEvent(new PopStateEvent('popstate')); });
    await screen.findByText(m.linkInvalid); expect(screen.queryByLabelText('Mật khẩu mới *')).toBeNull();
  });
});
