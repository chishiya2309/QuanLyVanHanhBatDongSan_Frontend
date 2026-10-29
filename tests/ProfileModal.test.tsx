import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { ProfileModal } from '../src/components/profile/ProfileModal';
import { useProfile } from '../src/hooks/useProfile';
import { profileMessages as m } from '../src/types/profile';
import { adminProfile, customerProfile, hostProfile } from './fixtures/profiles';
import { deferred, failure, installApi, ok } from './apiMock';

const onExpired = vi.fn();
function Harness() {
  const c = useProfile(onExpired);
  const [open, setOpen] = useState(false);
  return <><button onClick={() => { setOpen(true); void c.fetchProfile(); }}>Mở hồ sơ</button>
    <ProfileModal isOpen={open} controller={c} onClose={() => setOpen(false)} /></>;
}

async function openProfile() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Mở hồ sơ' }));
  await screen.findByText('Email');
  return user;
}

describe('profile modal', () => {
  it.each([adminProfile, hostProfile, customerProfile])('shows the correct $role record and permissions', async (profile) => {
    installApi(profile);
    render(<Harness />);
    await openProfile();
    expect(screen.getByText(profile.email)).toBeTruthy();
    const edit = screen.queryByRole('button', { name: 'Chỉnh sửa hồ sơ' });
    expect(!!edit).toBe(profile.role !== 'CUSTOMER');
    if (profile.role === 'CUSTOMER') {
      expect(screen.getByText('15/05/1995')).toBeTruthy();
      expect(screen.getByText('Hộ chiếu')).toBeTruthy();
      expect(document.querySelector('.profile-avatar')).toBeNull();
    }
  });
  it('focuses the first invalid field, keeps email disabled and cancels back to server values', async () => {
    const api = installApi(adminProfile);
    render(<Harness />);
    const user = await openProfile();
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
    const name = screen.getByLabelText('Họ và tên *') as HTMLInputElement;
    expect(document.activeElement).toBe(name);
    expect((screen.getByLabelText(/Email/) as HTMLInputElement).disabled).toBe(true);
    await user.clear(name);
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(screen.getByText(m.nameRequired)).toBeTruthy();
    expect(document.activeElement).toBe(name);
    expect(api.patchProfile).not.toHaveBeenCalled();
    await user.type(name, 'Draft');
    expect(screen.queryByText(m.nameRequired)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Hủy bỏ' }));
    expect(screen.getAllByText(adminProfile.fullName).length).toBeGreaterThan(0);
    expect(screen.queryByRole('textbox')).toBeNull();
  });
  it('confirms unsaved close, Escape returns to editing, discard closes and reopening reloads', async () => {
    const api = installApi(hostProfile);
    render(<Harness />);
    const user = await openProfile();
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
    await user.type(screen.getByLabelText('Tên đơn vị quản lý *'), ' mới');
    await user.click(screen.getByRole('button', { name: 'Đóng cửa sổ hồ sơ' }));
    expect(screen.getByRole('heading', { name: 'Bỏ thay đổi chưa lưu?' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.getByLabelText('Tên đơn vị quản lý *')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Tên đơn vị quản lý *'));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Bỏ thay đổi' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mở hồ sơ' }));
    const count = api.getProfile.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Mở hồ sơ' }));
    await screen.findByText('Email');
    expect(api.getProfile.mock.calls.length).toBeGreaterThan(count);
    expect(screen.getAllByText(hostProfile.businessName).length).toBeGreaterThan(0);
  });
  it('keeps the form and preview on a failed save, locks closing while saving, and shows server success', async () => {
    const api = installApi(hostProfile);
    render(<Harness />);
    const user = await openProfile();
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
    const name = screen.getByLabelText('Tên đơn vị quản lý *');
    await user.clear(name);
    await user.type(name, 'RentOps mới');
    await user.upload(screen.getByLabelText('Tệp logo thương hiệu'), new File(['png'], 'logo.png', { type: 'image/png' }));
    const gate = deferred<Response>();
    api.patchProfile.mockReturnValueOnce(gate.promise);
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect((screen.getByRole('button', { name: 'Đóng cửa sổ hồ sơ' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByText('Bỏ thay đổi chưa lưu?')).toBeNull();
    gate.resolve(failure(500, m.saveFailure));
    await screen.findByText(m.saveFailure);
    expect((screen.getByLabelText('Tên đơn vị quản lý *') as HTMLInputElement).value).toBe('RentOps mới');
    expect(document.querySelector('.profile-avatar img')?.getAttribute('src')).toContain('blob:profile-');
    api.patchProfile.mockResolvedValueOnce(ok({ ...hostProfile, businessName: 'RentOps mới' }));
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await screen.findByText(m.success);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
  it('shows 404 without fabricating a profile and offers retry', async () => {
    const api = installApi(adminProfile);
    api.getProfile.mockImplementation(async () => failure(404, m.notFound));
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Mở hồ sơ' }));
    await screen.findByText(m.notFound);
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa hồ sơ' })).toBeNull();
    api.getProfile.mockResolvedValueOnce(ok(adminProfile));
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByText(adminProfile.email);
  });
  it('falls back to initials when a stored logo fails to load', async () => {
    installApi({ ...hostProfile, logoUrl: '/unavailable-logo.png' });
    render(<Harness />);
    await openProfile();
    const image = document.querySelector('.profile-avatar img');
    expect(image).toBeTruthy();
    fireEvent.error(image!);
    expect(document.querySelector('.profile-avatar img')).toBeNull();
    expect(document.querySelector('.profile-avatar')?.textContent).toBe('EC');
  });
  it('shows missing optional fields without inventing identity data', async () => {
    installApi({ ...customerProfile, phoneNumber: null, identityType: null, identityNo: null, birthDate: null, address: null });
    render(<Harness />);
    await openProfile();
    expect(screen.getAllByText('Chưa cập nhật')).toHaveLength(5);
    expect(screen.queryByText(customerProfile.identityNo!)).toBeNull();
  });
});

describe('App profile integration', () => {
  it('uses real identity, refreshes on open and synchronizes Topbar and greeting after save', async () => {
    const api = installApi(hostProfile);
    render(<App />);
    const user = userEvent.setup();
    const entry = await screen.findByRole('button', { name: `Xem hồ sơ cá nhân của ${hostProfile.businessName}` });
    expect(within(entry).getByText('Chủ cho thuê')).toBeTruthy();
    const count = api.getProfile.mock.calls.length;
    await user.click(entry);
    await screen.findByText('Email');
    expect(api.getProfile.mock.calls.length).toBeGreaterThan(count);
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
    await user.clear(screen.getByLabelText('Tên đơn vị quản lý *'));
    await user.type(screen.getByLabelText('Tên đơn vị quản lý *'), 'Đơn vị An Gia');
    api.patchProfile.mockResolvedValueOnce(ok({ ...hostProfile, businessName: 'Đơn vị An Gia' }));
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await screen.findByText(m.success);
    expect(screen.getByRole('button', { name: 'Xem hồ sơ cá nhân của Đơn vị An Gia' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Đơn vị An Gia');
  });
  it.each(['GET', 'PATCH'])('redirects on %s 401 and preserves the session notice on LoginPage', async (method) => {
    const api = installApi(adminProfile);
    if (method === 'GET') api.getProfile.mockImplementation(async () => failure(401, m.sessionInvalid));
    render(<App />);
    if (method === 'PATCH') {
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: `Xem hồ sơ cá nhân của ${adminProfile.fullName}` }));
      await screen.findByText('Email');
      await user.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
      api.patchProfile.mockResolvedValueOnce(failure(401, m.sessionInvalid));
      await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    }
    await screen.findByText(m.sessionInvalid);
    expect(screen.getByRole('heading', { name: 'Đăng nhập tài khoản' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
