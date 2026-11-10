import { useRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomersPage } from '../src/components/customers/CustomersPage';
import { customerAccountMessages as m } from '../src/types/customerAccount';
import { parseCustomerRoute } from '../src/utils/customerNavigation';

const id = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const baseCustomer = { id, fullName: 'Nguyễn Văn An', phone: null, email: 'contact@example.com', identityType: null,
  identityNo: null, birthDate: null, address: null, note: null, version: 0 };
const absent = { customerId: id, hasAccount: false, accountId: null, loginName: null, role: null, status: null, createdAt: null, customerVersion: 0 };
const present = { ...absent, hasAccount: true, accountId, loginName: 'login@example.com', role: 'CUSTOMER', status: 'ACTIVE', createdAt: '2026-11-09T00:00:00Z', customerVersion: 1 };
let customer: typeof baseCustomer;
let account: typeof absent | typeof present;
let mode: string;
let calls: { method: string; path: string; body: Record<string, unknown> | null }[];
let releaseWrite: (() => void) | null;
const expired = vi.fn(); const forbidden = vi.fn();
const reply = (status: number, message: string, data: unknown = null, fieldErrors = {}) => new Response(JSON.stringify(
  status < 400 ? { status, message, data } : { status, message, fieldErrors }), { status });

function Harness({ initial = `/customers/${id}` }: { initial?: string }) {
  const [route, setRoute] = useState(() => { window.history.replaceState(null, '', initial); return parseCustomerRoute(location.pathname, location.search)!; });
  const [ended, setEnded] = useState(false);
  const guard = useRef<(() => boolean) | null>(null);
  if (ended) return <p>Phiên đã kết thúc</p>;
  return <CustomersPage route={route} registerGuard={(next) => { guard.current = next; }}
    onNavigate={(url, replace) => {
      if (guard.current?.() === false) return;
      if (replace) history.replaceState(null, '', url); else history.pushState(null, '', url);
      setRoute(parseCustomerRoute(location.pathname, location.search)!);
    }} onSessionExpired={(message) => { expired(message); setEnded(true); }} onForbidden={() => { forbidden(); setEnded(true); }} />;
}

beforeEach(() => {
  customer = { ...baseCustomer }; account = { ...absent }; mode = 'normal'; calls = []; releaseWrite = null;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = new URL(String(input), location.origin).pathname;
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null;
    calls.push({ path, method, body });
    if (path.endsWith('/auth/csrf')) return new Response(JSON.stringify({ data: { token: 'token', headerName: 'X-CSRF-TOKEN' } }));
    if (path.endsWith('/auth/me') || path.endsWith('/auth/refresh')) return reply(mode === 'refresh-unavailable' ? 503 : 401, m.sessionInvalid);
    if (path.endsWith('/account') && method === 'GET') {
      if (mode === 'load-error') return reply(500, 'Failure');
      if (mode === 'forbidden') return reply(403, m.forbidden);
      if (mode === 'expired') return reply(401, m.sessionInvalid);
      if (mode === 'not-found') return reply(404, 'Không thể truy cập Customer được yêu cầu');
      if (mode === 'wrong-role') return reply(200, m.detailSuccess, { ...present, role: 'HOST' });
      return reply(200, m.detailSuccess, account);
    }
    if (path.includes('/account') && method !== 'GET') {
      if (mode === 'refresh-unavailable') return reply(401, m.sessionInvalid);
      if (mode === 'delayed') await new Promise<void>((resolve) => { releaseWrite = resolve; });
      if (mode === 'email-duplicate') return reply(409, m.emailDuplicate, null, { email: m.emailDuplicate });
      if (mode === 'stale') return reply(409, 'Hồ sơ Customer đã thay đổi. Vui lòng tải lại dữ liệu', null, { customerVersion: 'Hồ sơ Customer đã thay đổi. Vui lòng tải lại dữ liệu' });
      if (mode === 'csrf') return reply(403, m.csrfInvalid);
      if (mode === 'write-failure') return reply(500, 'Failed');
      if (mode === 'uncertain') throw new TypeError('Lost response');
      if (mode === 'already-account') { account = { ...present }; return reply(409, m.alreadyHasAccount); }
      if (mode === 'no-account') { account = { ...absent }; return reply(409, m.noAccount); }
      if (mode === 'already-locked') { account = { ...present, status: 'LOCKED' }; return reply(409, m.alreadyLocked); }
      if (mode === 'already-active') { account = { ...present }; return reply(409, m.alreadyActive); }
      if (method === 'POST') {
        customer = { ...customer, version: customer.version + 1 };
        account = { ...present, loginName: String(body?.email), customerVersion: customer.version };
        return reply(201, m.provisionSuccess, account);
      }
      account = { ...present, status: path.endsWith('/unlock') ? 'ACTIVE' : 'LOCKED' };
      return reply(200, path.endsWith('/unlock') ? m.unlockSuccess : m.lockSuccess, account);
    }
    if (path.endsWith('/vehicles')) return reply(200, 'Lấy danh sách phương tiện thành công', { customerId: id, customerVersion: customer.version, vehicles: [] });
    if (path.endsWith(`/customers/${id}`)) return mode === 'profile-not-found' ? reply(404, 'Không thể truy cập Customer được yêu cầu')
      : reply(200, 'Lấy thông tin Customer thành công', customer);
    if (path.endsWith('/customers')) return reply(200, 'Lấy danh sách Customer thành công', { content: [customer], page: 0, size: 20, totalElements: 1, totalPages: 1, first: true, last: true });
    return reply(404, 'Unexpected endpoint');
  }));
});

const mutations = () => calls.filter((call) => call.path.includes('/account') && call.method !== 'GET');
async function openProvision() {
  const button = await screen.findByRole('button', { name: 'Cấp tài khoản' });
  button.focus(); fireEvent.click(button);
  await screen.findByLabelText('Email đăng nhập (bắt buộc)');
}
function fillPasswords(value = 'Password123') {
  fireEvent.change(screen.getByLabelText('Mật khẩu ban đầu (bắt buộc)'), { target: { value } });
  fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu (bắt buộc)'), { target: { value } });
}
const modal = () => within(screen.getByRole('dialog'));

describe('UC08 integrated account workflows', () => {
  it('only reads the selected Customer, keeps contact email, and refreshes the full UC21 snapshot after provisioning', async () => {
    render(<Harness />);
    await openProvision();
    expect((screen.getByLabelText('Email đăng nhập (bắt buộc)') as HTMLInputElement).value).toBe('contact@example.com');
    expect(document.activeElement).toBe(screen.getByLabelText('Email đăng nhập (bắt buộc)'));
    fillPasswords();
    fireEvent.change(screen.getByLabelText('Email đăng nhập (bắt buộc)'), { target: { value: 'separate@example.com' } });
    fireEvent.click(modal().getByRole('button', { name: 'Cấp tài khoản' }));
    await screen.findByText(m.provisionSuccess);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('separate@example.com')).toBeDefined();
    expect(screen.getByText('contact@example.com')).toBeDefined();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
    await screen.findByRole('dialog');
    expect(customer.version).toBe(1);
    expect(calls.filter((call) => call.path.endsWith(`/customers/${id}`))).toHaveLength(2);
    expect(mutations()).toHaveLength(1);
  });
  it('does not fetch any account on the customer list', async () => {
    render(<Harness initial="/customers?q=An" />);
    await screen.findByText('1 khách thuê');
    expect(calls.some((call) => call.path.includes('/account'))).toBe(false);
  });
  it('shows validation in the modal and focuses the first invalid field without sending', async () => {
    render(<Harness />); await openProvision();
    fireEvent.change(screen.getByLabelText('Email đăng nhập (bắt buộc)'), { target: { value: '' } });
    fireEvent.click(modal().getByRole('button', { name: 'Cấp tài khoản' }));
    await screen.findByText(m.emailRequired);
    expect(document.activeElement).toBe(screen.getByLabelText('Email đăng nhập (bắt buộc)'));
    expect(mutations()).toHaveLength(0);
  });
  it('retains both passwords on duplicate email and clears the field error when corrected', async () => {
    render(<Harness />); await openProvision(); fillPasswords(); mode = 'email-duplicate';
    fireEvent.click(modal().getByRole('button', { name: 'Cấp tài khoản' }));
    await screen.findAllByText(m.emailDuplicate);
    expect((screen.getByLabelText('Mật khẩu ban đầu (bắt buộc)') as HTMLInputElement).value).toBe('Password123');
    expect((screen.getByLabelText('Xác nhận mật khẩu (bắt buộc)') as HTMLInputElement).value).toBe('Password123');
    expect(document.activeElement).toBe(screen.getByLabelText('Email đăng nhập (bắt buộc)'));
    fireEvent.change(screen.getByLabelText('Email đăng nhập (bắt buộc)'), { target: { value: 'different@example.com' } });
    expect(screen.getByLabelText('Email đăng nhập (bắt buộc)').getAttribute('aria-invalid')).toBe('false');
    mode = 'normal'; fireEvent.click(modal().getByRole('button', { name: 'Cấp tài khoản' }));
    await screen.findByText(m.provisionSuccess);
  });
  it('uses independent password toggles and clears secrets after confirmed discard', async () => {
    render(<Harness />); await openProvision(); fillPasswords();
    expect(screen.getByLabelText('Mật khẩu ban đầu (bắt buộc)').getAttribute('autocomplete')).toBe('new-password');
    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu ban đầu' }));
    expect(screen.getByLabelText('Mật khẩu ban đầu (bắt buộc)').getAttribute('type')).toBe('text');
    expect(screen.getByLabelText('Xác nhận mật khẩu (bắt buộc)').getAttribute('type')).toBe('password');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('dialog')).toBeDefined();
    confirm.mockReturnValue(true); fireEvent.click(modal().getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cấp tài khoản' }));
    await openProvision();
    expect((screen.getByLabelText('Mật khẩu ban đầu (bắt buộc)') as HTMLInputElement).value).toBe('');
    expect(mutations()).toHaveLength(0);
  });
  it('waits for explicit stale reload, retains the draft, and sends the new version only on a new submit', async () => {
    render(<Harness />); await openProvision(); fillPasswords(); mode = 'stale';
    fireEvent.click(modal().getByRole('button', { name: 'Cấp tài khoản' }));
    await screen.findByText(m.stale);
    expect(mutations()).toHaveLength(1);
    account = { ...absent, customerVersion: 4 }; customer = { ...customer, version: 4 }; mode = 'normal';
    fireEvent.click(modal().getByRole('button', { name: 'Tải lại' }));
    await waitFor(() => expect(modal().getByRole('button', { name: 'Cấp tài khoản' }).hasAttribute('disabled')).toBe(false));
    expect((screen.getByLabelText('Mật khẩu ban đầu (bắt buộc)') as HTMLInputElement).value).toBe('Password123');
    expect(mutations()).toHaveLength(1);
    fireEvent.click(modal().getByRole('button', { name: 'Cấp tài khoản' }));
    await screen.findByText(m.provisionSuccess);
    expect(mutations()[1].body?.customerVersion).toBe(4);
  });
  it('requires confirmation for lock/unlock, and cancellation never writes', async () => {
    account = { ...present }; render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Khóa tài khoản' }));
    await screen.findByText('Customer sẽ bị đăng xuất khỏi mọi thiết bị ngay lập tức');
    expect(document.activeElement).toBe(modal().getByRole('button', { name: 'Hủy' }));
    fireEvent.click(modal().getByRole('button', { name: 'Hủy' })); expect(mutations()).toHaveLength(0);
    fireEvent.click(await screen.findByRole('button', { name: 'Khóa tài khoản' }));
    await screen.findByText('Customer sẽ bị đăng xuất khỏi mọi thiết bị ngay lập tức');
    fireEvent.click(modal().getByRole('button', { name: 'Khóa tài khoản' }));
    await screen.findByText(m.lockSuccess); expect(screen.getByText('Đã khóa')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Mở khóa tài khoản' }));
    await screen.findByText('Customer cần tự đăng nhập lại, hệ thống không đăng nhập thay');
    fireEvent.click(modal().getByRole('button', { name: 'Hủy' })); expect(mutations()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Mở khóa tài khoản' }));
    await screen.findByText('Customer cần tự đăng nhập lại, hệ thống không đăng nhập thay');
    fireEvent.click(modal().getByRole('button', { name: 'Mở khóa tài khoản' }));
    await screen.findByText(m.unlockSuccess); expect(screen.getByText('Đang hoạt động')).toBeDefined();
  });
  it('blocks double submit and Escape while a mutation is pending', async () => {
    render(<Harness />); await openProvision(); fillPasswords(); mode = 'delayed';
    const form = screen.getByRole('dialog').querySelector('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(releaseWrite).not.toBeNull());
    expect(mutations()).toHaveLength(1);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('dialog')).toBeDefined();
    await act(async () => { releaseWrite!(); });
    await screen.findByText(m.provisionSuccess);
  });
  it.each(['csrf', 'write-failure', 'uncertain'])('keeps the draft after %s without optimistic success or automatic retry', async (failureMode) => {
    render(<Harness />); await openProvision(); fillPasswords(); mode = failureMode;
    fireEvent.click(modal().getByRole('button', { name: 'Cấp tài khoản' }));
    await screen.findByText(failureMode === 'csrf' ? m.csrfInvalid : failureMode === 'write-failure' ? m.provisionFailure : m.uncertain);
    expect((screen.getByLabelText('Mật khẩu ban đầu (bắt buộc)') as HTMLInputElement).value).toBe('Password123');
    expect(mutations()).toHaveLength(1); expect(screen.queryByText(m.provisionSuccess)).toBeNull();
    expect(expired).not.toHaveBeenCalled(); expect(forbidden).not.toHaveBeenCalled();
    if (failureMode === 'uncertain') {
      mode = 'normal'; fireEvent.click(modal().getByRole('button', { name: 'Tải lại' }));
      await waitFor(() => expect(modal().getByRole('button', { name: 'Cấp tài khoản' }).hasAttribute('disabled')).toBe(false));
      expect(mutations()).toHaveLength(1);
    }
  });
  it.each(['already-account', 'no-account', 'already-locked', 'already-active'])('reconciles the concurrent state %s', async (failureMode) => {
    const action = failureMode === 'already-account' ? 'provision' : failureMode === 'already-active' ? 'unlock' : 'lock';
    if (action !== 'provision') account = { ...present, status: action === 'unlock' ? 'LOCKED' : 'ACTIVE' };
    render(<Harness initial={`/customers/${id}?accountAction=${action}`} />);
    if (action === 'provision') { await screen.findByLabelText('Email đăng nhập (bắt buộc)'); fillPasswords(); }
    else await screen.findByText(action === 'lock' ? 'Customer sẽ bị đăng xuất khỏi mọi thiết bị ngay lập tức' : 'Customer cần tự đăng nhập lại, hệ thống không đăng nhập thay');
    mode = failureMode;
    fireEvent.click(modal().getByRole('button', { name: action === 'provision' ? 'Cấp tài khoản' : action === 'lock' ? 'Khóa tài khoản' : 'Mở khóa tài khoản' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mutations()).toHaveLength(1);
    expect(within(screen.getByRole('alert')).getByText(failureMode === 'already-account' ? m.alreadyHasAccount : failureMode === 'no-account' ? m.noAccount : failureMode === 'already-locked' ? m.alreadyLocked : m.alreadyActive)).toBeDefined();
  });
  it('isolates account load failures and wrong role from the visible customer profile', async () => {
    mode = 'load-error'; render(<Harness />);
    await screen.findByText(m.detailFailure);
    expect(screen.getByText('contact@example.com')).toBeDefined();
    expect(screen.getByText('Khách thuê chưa đăng ký phương tiện nào')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Cấp tài khoản' })).toBeNull();
    mode = 'wrong-role'; fireEvent.click(within(screen.getByText(m.detailFailure).closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Thử lại' }));
    await screen.findByText(m.wrongRole); expect(mutations()).toHaveLength(0);
  });
  it.each(['expired', 'forbidden'])('ends the protected page for %s', async (failureMode) => {
    mode = failureMode; render(<Harness />);
    await screen.findByText('Phiên đã kết thúc');
    expect(failureMode === 'expired' ? expired : forbidden).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('contact@example.com')).toBeNull();
  });
  it('normalizes competing actions to the same detail without any mutation', async () => {
    render(<Harness initial={`/customers/${id}?accountAction=lock&action=edit&q=An&page=2&size=50`} />);
    await screen.findByText('Đường dẫn khách thuê không hợp lệ. Vui lòng chọn lại thao tác.');
    await waitFor(() => expect(location.search).toBe('?q=An&page=2&size=50'));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(mutations()).toHaveLength(0);
  });
  it('returns to the list with the use case message for a cross-host/not-found account', async () => {
    mode = 'not-found'; render(<Harness />);
    await screen.findByText(m.notFound);
    expect(location.pathname).toBe('/customers'); expect(mutations()).toHaveLength(0);
  });
  it('also preserves the access failure notice when the Customer profile is missing before the account loads', async () => {
    mode = 'profile-not-found'; render(<Harness />);
    await screen.findByText(m.notFound);
    expect(location.pathname).toBe('/customers'); expect(mutations()).toHaveLength(0);
  });
  it('retains the password draft during a temporary session refresh failure', async () => {
    render(<Harness />); await openProvision(); fillPasswords(); mode = 'refresh-unavailable';
    fireEvent.click(modal().getByRole('button', { name: 'Cấp tài khoản' }));
    await screen.findByText('Chưa thể làm mới phiên đăng nhập. Thông tin đang nhập được giữ lại. Vui lòng thử lại.');
    expect((screen.getByLabelText('Mật khẩu ban đầu (bắt buộc)') as HTMLInputElement).value).toBe('Password123');
    expect(expired).not.toHaveBeenCalled(); expect(forbidden).not.toHaveBeenCalled();
    expect(mutations()).toHaveLength(1);
  });
});
