import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { ChangePasswordModal } from '../src/components/auth/ChangePasswordModal';
import { changePasswordMessages as m } from '../src/types/changePassword';
import type { AccountRole } from '../src/types/auth';
import { adminProfile, customerProfile, hostProfile } from './fixtures/profiles';
import { deferred, failure, ok } from './apiMock';

const success = () => new Response(JSON.stringify({ status: 200, message: m.success, data: null }));
function install(role: AccountRole = 'ADMIN') {
  const post = vi.fn(async (): Promise<Response> => success());
  const csrf = vi.fn(async () => ok({ token: 'fresh', headerName: 'X-CSRF-TOKEN' }));
  const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.endsWith('/auth/me')) return ok({ accountId: 'uc05-user', loginName: 'uc05-login', role, hostId: null, customerId: null });
    if (path.endsWith('/profile')) return ok(role === 'HOST' ? hostProfile : role === 'CUSTOMER' ? customerProfile : adminProfile);
    if (path.endsWith('/csrf')) return csrf();
    if (path.endsWith('/change-password')) return post();
    if (path.endsWith('/logout')) return ok(null);
    if (path.endsWith('/login')) return failure(401, 'Tên đăng nhập hoặc mật khẩu không chính xác');
    throw new Error(`Unexpected fixture request ${path} ${init?.method}`);
  });
  vi.stubGlobal('fetch', fetch);
  return { post, csrf, fetch };
}

function fill() {
  for (const [label, value] of [['Mật khẩu hiện tại', 'old'], ['Mật khẩu mới', ' newPassword123 '], ['Xác nhận mật khẩu mới', ' newPassword123 ']]) {
    fireEvent.change(screen.getByLabelText(label + ' *', { exact: true }), { target: { value } });
  }
}
async function openFromProfile(role: AccountRole = 'ADMIN') {
  const api = install(role);
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /^Xem hồ sơ cá nhân của/ }));
  await user.click(await screen.findByRole('button', { name: 'Đổi mật khẩu' }));
  return { ...api, user };
}

describe('UC05 modal and form state', () => {
  it('focuses required fields on submit and revalidates touched confirmation when new password changes', async () => {
    const api = install();
    render(<ChangePasswordModal onClose={vi.fn()} onAuthenticationEnded={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByLabelText('Mật khẩu hiện tại *', { exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(screen.getByText(m.currentRequired)).toBeTruthy();
    expect(screen.getByText(m.newRequired)).toBeTruthy();
    expect(screen.getByText(m.confirmRequired)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
    fill();
    fireEvent.change(screen.getByLabelText('Mật khẩu mới *', { exact: true }), { target: { value: 'different123' } });
    expect(screen.getByText(m.mismatch)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Mật khẩu hiện tại *', { exact: true }));
  });
  it('toggles each field independently without losing values or input focus', async () => {
    install();
    render(<ChangePasswordModal onClose={vi.fn()} onAuthenticationEnded={vi.fn()} />);
    fill();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Hiện mật khẩu hiện tại' }));
    const input = screen.getByLabelText('Mật khẩu hiện tại *', { exact: true }) as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.value).toBe('old');
    expect(document.activeElement).toBe(input);
    expect((screen.getByLabelText('Mật khẩu mới *', { exact: true }) as HTMLInputElement).type).toBe('password');
    await user.click(screen.getByRole('button', { name: 'Ẩn mật khẩu hiện tại' }));
    expect(input.type).toBe('password');
  });
  it('blocks duplicate submits and dismissal while pending, then keeps values after failure and allows retry', async () => {
    const api = install();
    const onClose = vi.fn();
    const gate = deferred<Response>();
    api.post.mockReturnValueOnce(gate.promise);
    render(<ChangePasswordModal onClose={onClose} onAuthenticationEnded={vi.fn()} />);
    fill();
    const form = document.querySelector('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect((screen.getByRole('button', { name: 'Hủy' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => gate.resolve(failure(500, m.failure)));
    expect(screen.getByRole('alert').textContent).toContain(m.failure);
    expect(document.activeElement).toBe(screen.getByRole('alert'));
    expect((screen.getByLabelText('Mật khẩu mới *', { exact: true }) as HTMLInputElement).value).toBe(' newPassword123 ');
    api.post.mockResolvedValueOnce(failure(400, m.currentIncorrect, { currentPassword: m.currentIncorrect }));
    fireEvent.submit(form);
    await screen.findByText(m.currentIncorrect);
    expect(document.activeElement).toBe(screen.getByLabelText('Mật khẩu hiện tại *', { exact: true }));
    expect(api.post).toHaveBeenCalledTimes(2);
  });
  it('ignores a delayed result after unmount', async () => {
    const api = install();
    const gate = deferred<Response>();
    api.post.mockReturnValueOnce(gate.promise);
    const callback = vi.fn();
    const view = render(<ChangePasswordModal onClose={vi.fn()} onAuthenticationEnded={callback} />);
    fill(); fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => gate.resolve(success()));
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('UC05 App integration', () => {
  it.each<AccountRole>(['ADMIN', 'HOST', 'CUSTOMER'])('opens for %s, uses one dialog, restores profile focus and resets secrets on reopening', async (role) => {
    const { user } = await openFromProfile(role);
    expect(document.querySelectorAll('dialog[open]')).toHaveLength(1);
    fill();
    await user.click(screen.getByRole('button', { name: 'Hiện mật khẩu mới' }));
    await user.click(screen.getByRole('button', { name: 'Hủy' }));
    const trigger = screen.getByRole('button', { name: 'Đổi mật khẩu' });
    expect(document.activeElement).toBe(trigger);
    await user.click(trigger);
    for (const input of document.querySelectorAll<HTMLInputElement>('dialog input')) { expect(input.value).toBe(''); expect(input.type).toBe('password'); }
    await user.keyboard('{Escape}');
    expect(screen.getByRole('heading', { name: 'Hồ sơ cá nhân' })).toBeTruthy();
    expect(document.querySelectorAll('dialog[open]')).toHaveLength(1);
  });
  it('hides the change-password action while editing a profile', async () => {
    const { user } = await openFromProfile();
    await user.click(screen.getByRole('button', { name: 'Hủy' }));
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
    expect(screen.queryByRole('button', { name: 'Đổi mật khẩu' })).toBeNull();
  });
  it.each(['success', '401'] as const)('returns to login with a typed %s notice without logout or refresh', async (scenario) => {
    const api = await openFromProfile();
    if (scenario === '401') api.post.mockResolvedValueOnce(failure(401, 'ignored'));
    fill();
    await api.user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    const message = scenario === 'success' ? m.success : m.sessionInvalid;
    await screen.findByText(message);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(screen.getByRole(scenario === 'success' ? 'status' : 'alert')).getByText(message)).toBeTruthy();
    expect((screen.getByLabelText(/Tên đăng nhập/) as HTMLInputElement).value).toBe('uc05-login');
    expect((screen.getByLabelText(/^Mật khẩu/) as HTMLInputElement).value).toBe('');
    expect(api.fetch.mock.calls.some(([url]) => /\/(logout|refresh)$/.test(String(url)))).toBe(false);
    await api.user.type(screen.getByLabelText(/^Mật khẩu/), 'a');
    expect(screen.queryByText(message)).toBeNull();
  });
  it('allows dismissing the success notice', async () => {
    const api = await openFromProfile(); fill();
    await api.user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    await screen.findByText(m.success);
    await api.user.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
    expect(screen.queryByText(m.success)).toBeNull();
  });
  it('ends a forbidden operation but keeps the authenticated view', async () => {
    const api = await openFromProfile();
    api.post.mockResolvedValueOnce(failure(403, m.forbidden)); fill();
    await api.user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    await screen.findByText(m.forbidden);
    expect(document.querySelector('dialog input')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đổi mật khẩu' })).toBeNull();
    await api.user.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.getByRole('heading', { name: 'Hồ sơ cá nhân' })).toBeTruthy();
  });
  it('handles CSRF rejection as recoverable and fetches a fresh token only on explicit retry', async () => {
    const api = await openFromProfile();
    api.post.mockResolvedValueOnce(failure(403, m.csrfInvalid)); fill();
    await api.user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    await screen.findByText(m.csrfInvalid);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText('Mật khẩu mới *', { exact: true }) as HTMLInputElement).value).toBe(' newPassword123 ');
    await api.user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    await screen.findByText(m.success);
    expect(api.csrf).toHaveBeenCalledTimes(2);
  });
});
