import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LosslessNumber, stringify } from 'lossless-json';
import { RoomPaymentPolicyPage } from '../src/components/payments/RoomPaymentPolicyPage';
import { clearCsrfCache } from '../src/services/csrfClient';
import { invalidateSession, rememberSession } from '../src/services/sessionClient';
import { paymentMessages as m, type PaymentApplication, type RoomPaymentPolicy } from '../src/types/roomPaymentPolicy';
import {
  applicableTargets,
  bankSource,
  bankSourceId,
  buildingId,
  cashSource,
  cashSourceId,
  configuredBankOnlyPolicy,
  configuredCashOnlyPolicy,
  configuredRoomPolicy,
  configuredWithInactivePolicy,
  paymentPolicyReply,
  roomId,
  roomPaymentWire,
  sampleApplication,
  targetRoom1Id,
  targetRoom2Id,
  unconfiguredRoomPolicy,
} from './fixtures/roomPaymentPolicy';

const uc40CashSource = {
  ...cashSource,
  hasTransactions: false,
  canEditBankDetails: false,
  version: new LosslessNumber('0'),
};

const uc40BankSource = {
  ...bankSource,
  hasTransactions: false,
  canEditBankDetails: true,
  version: new LosslessNumber('0'),
};

describe('UC42 Room Payment Policy Component & Flows', () => {
  const hostUser = {
    accountId: 'host-1',
    loginName: 'host1',
    role: 'HOST' as const,
    hostId: 'host-uuid-1',
    customerId: null,
  };

  const defaultRoute = {
    roomId,
    returnTo: '/rooms?view=matrix&buildingId=' + buildingId + '&roomId=' + roomId,
  };

  let onNavigate: (url: string) => void;
  let onManageFunds: () => void;
  let onSessionExpired: (msg: string) => void;
  let onForbidden: (msg: string) => void;
  let onMissing: (msg: string) => void;
  let registerGuard: (guard: (() => boolean) | null) => void;
  let fetchCalls: { url: string; method?: string; body?: string }[] = [];

  beforeEach(() => {
    rememberSession(hostUser);
    clearCsrfCache();
    fetchCalls = [];
    onNavigate = vi.fn();
    onManageFunds = vi.fn();
    onSessionExpired = vi.fn();
    onForbidden = vi.fn();
    onMissing = vi.fn();
    registerGuard = vi.fn();

    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    invalidateSession();
    clearCsrfCache();
  });

  function setupFetch(options: {
    roomPolicy?: RoomPaymentPolicy;
    cashSources?: unknown[];
    bankSources?: unknown[];
    targets?: RoomPaymentPolicy[];
    saveResponse?: RoomPaymentPolicy;
    applyResponse?: PaymentApplication;
  } = {}) {
    const {
      roomPolicy = unconfiguredRoomPolicy,
      cashSources = [uc40CashSource],
      bankSources = [uc40BankSource],
      targets = applicableTargets,
      saveResponse = configuredRoomPolicy,
      applyResponse = sampleApplication,
    } = options;

    const fetcher = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';
      fetchCalls.push({ url, method, body: init?.body as string });

      if (url.endsWith('/auth/csrf')) {
        return Promise.resolve(new Response(JSON.stringify({
          status: 200,
          message: 'OK',
          data: { headerName: 'X-CSRF-TOKEN', token: 'csrf-token-123' },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }

      if (url.includes('/funding-sources')) {
        const u = new URL(url, 'http://localhost');
        const type = u.searchParams.get('type');
        if (type === 'CASH') {
          return Promise.resolve(new Response(stringify({ status: 200, message: 'OK', data: cashSources }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        if (type === 'BANK') {
          return Promise.resolve(new Response(stringify({ status: 200, message: 'OK', data: bankSources }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
      }

      if (url.includes(`/rooms/${roomId}/payment-policy/applicable-rooms`)) {
        return Promise.resolve(paymentPolicyReply(targets.map((t) => roomPaymentWire(t))));
      }

      if (url.includes(`/rooms/${roomId}/payment-policy/applications`) && method === 'POST') {
        return Promise.resolve(paymentPolicyReply(applyResponse));
      }

      if (url.includes(`/rooms/${roomId}/payment-policy`)) {
        if (method === 'PUT') {
          return Promise.resolve(paymentPolicyReply(roomPaymentWire(saveResponse)));
        }
        return Promise.resolve(paymentPolicyReply(roomPaymentWire(roomPolicy)));
      }

      return Promise.reject(new Error('Unhandled URL: ' + url));
    });

    vi.stubGlobal('fetch', fetcher);
    return fetcher;
  }

  it('Luồng chính: Xem cấu hình phòng chưa thiết lập, bật cả 2 phương thức và lưu thành công', async () => {
    setupFetch({ roomPolicy: unconfiguredRoomPolicy, saveResponse: configuredRoomPolicy });

    render(
      <RoomPaymentPolicyPage
        route={defaultRoute}
        allowed={true}
        registerGuard={registerGuard}
        onNavigate={onNavigate}
        onManageFunds={onManageFunds}
        onSessionExpired={onSessionExpired}
        onForbidden={onForbidden}
        onMissing={onMissing}
      />
    );

    // Bước 1-2: Hiển thị phòng, chưa cấu hình, cả 2 switch tắt
    expect(await screen.findByText('Phòng 101 — Phòng 101')).toBeTruthy();
    expect(screen.getByText('Chưa cấu hình')).toBeTruthy();
    expect(screen.getByText('Phòng chưa có cấu hình thanh toán.')).toBeTruthy();

    const cashSwitch = screen.getByRole('switch', { name: 'Chấp nhận tiền mặt' }) as HTMLInputElement;
    const bankSwitch = screen.getByRole('switch', { name: 'Chấp nhận chuyển khoản' }) as HTMLInputElement;
    expect(cashSwitch.checked).toBe(false);
    expect(bankSwitch.checked).toBe(false);

    const cashSelect = screen.getByLabelText(/Nguồn tiền mặt mặc định/i) as HTMLSelectElement;
    const bankSelect = screen.getByLabelText(/Tài khoản ngân hàng mặc định/i) as HTMLSelectElement;
    expect(cashSelect.disabled).toBe(true);
    expect(bankSelect.disabled).toBe(true);

    // Bước 3: Bật cả hai phương thức
    fireEvent.click(cashSwitch);
    expect(cashSwitch.checked).toBe(true);
    expect(cashSelect.disabled).toBe(false);

    fireEvent.click(bankSwitch);
    expect(bankSwitch.checked).toBe(true);
    expect(bankSelect.disabled).toBe(false);

    // Bước 4-5: Chọn nguồn tiền mặt và ngân hàng
    fireEvent.change(cashSelect, { target: { value: cashSourceId } });
    expect(cashSelect.value).toBe(cashSourceId);

    fireEvent.change(bankSelect, { target: { value: bankSourceId } });
    expect(bankSelect.value).toBe(bankSourceId);

    // Bước 6-8: Lưu cấu hình
    const saveButton = screen.getByRole('button', { name: 'Lưu cấu hình' });
    fireEvent.click(saveButton);

    // Bước 8-9: Thông báo thành công và cập nhật baseline
    expect(await screen.findByText(m.saved)).toBeTruthy();
    const putCall = fetchCalls.find(c => c.method === 'PUT');
    expect(putCall).toBeDefined();
    expect(putCall?.body).toContain('"allowCash":true');
    expect(putCall?.body).toContain('"allowTransfer":true');
    expect(putCall?.body).toContain(`"cashDefaultId":"${cashSourceId}"`);
    expect(putCall?.body).toContain(`"bankDefaultId":"${bankSourceId}"`);

    // Xem lại cấu hình đã lưu
    expect(screen.getByText('Đã cấu hình')).toBeTruthy();
    expect(screen.getAllByText('Tiền mặt quản lý').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Vietcombank chính').length).toBeGreaterThan(0);
  });

  it('Luồng 3a: Cấu hình chỉ cho phép Tiền mặt (tắt chuyển khoản, xóa gán bankDefault)', async () => {
    setupFetch({ roomPolicy: unconfiguredRoomPolicy, saveResponse: configuredCashOnlyPolicy });

    render(
      <RoomPaymentPolicyPage
        route={defaultRoute}
        allowed={true}
        registerGuard={registerGuard}
        onNavigate={onNavigate}
        onManageFunds={onManageFunds}
        onSessionExpired={onSessionExpired}
        onForbidden={onForbidden}
        onMissing={onMissing}
      />
    );

    await screen.findByText('Chưa cấu hình');
    const cashSwitch = screen.getByRole('switch', { name: 'Chấp nhận tiền mặt' });
    fireEvent.click(cashSwitch);

    const cashSelect = screen.getByLabelText(/Nguồn tiền mặt mặc định/i);
    fireEvent.change(cashSelect, { target: { value: cashSourceId } });

    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));

    expect(await screen.findByText(m.saved)).toBeTruthy();
    const putCall = fetchCalls.find(c => c.method === 'PUT');
    expect(putCall?.body).toContain('"allowCash":true');
    expect(putCall?.body).toContain('"allowTransfer":false');
    expect(putCall?.body).toContain(`"cashDefaultId":"${cashSourceId}"`);
    expect(putCall?.body).toContain('"bankDefaultId":null');
  });

  it('Luồng 3b: Cấu hình chỉ cho phép Chuyển khoản (tắt tiền mặt, xóa gán cashDefault)', async () => {
    setupFetch({ roomPolicy: unconfiguredRoomPolicy, saveResponse: configuredBankOnlyPolicy });

    render(
      <RoomPaymentPolicyPage
        route={defaultRoute}
        allowed={true}
        registerGuard={registerGuard}
        onNavigate={onNavigate}
        onManageFunds={onManageFunds}
        onSessionExpired={onSessionExpired}
        onForbidden={onForbidden}
        onMissing={onMissing}
      />
    );

    await screen.findByText('Chưa cấu hình');
    const bankSwitch = screen.getByRole('switch', { name: 'Chấp nhận chuyển khoản' });
    fireEvent.click(bankSwitch);

    const bankSelect = screen.getByLabelText(/Tài khoản ngân hàng mặc định/i);
    fireEvent.change(bankSelect, { target: { value: bankSourceId } });

    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));

    expect(await screen.findByText(m.saved)).toBeTruthy();
    const putCall = fetchCalls.find(c => c.method === 'PUT');
    expect(putCall?.body).toContain('"allowCash":false');
    expect(putCall?.body).toContain('"allowTransfer":true');
    expect(putCall?.body).toContain('"cashDefaultId":null');
    expect(putCall?.body).toContain(`"bankDefaultId":"${bankSourceId}"`);
  });

  it('Luồng 3c: Áp dụng cấu hình cho các phòng khác trong cùng tòa nhà', async () => {
    setupFetch({ roomPolicy: configuredRoomPolicy });

    render(
      <RoomPaymentPolicyPage
        route={defaultRoute}
        allowed={true}
        registerGuard={registerGuard}
        onNavigate={onNavigate}
        onManageFunds={onManageFunds}
        onSessionExpired={onSessionExpired}
        onForbidden={onForbidden}
        onMissing={onMissing}
      />
    );

    await screen.findByText('Đã cấu hình');

    // Nhấn "Áp dụng cho các phòng khác trong tòa nhà"
    const applyButton = screen.getByRole('button', { name: 'Áp dụng cho các phòng khác trong tòa nhà' });
    fireEvent.click(applyButton);

    // Tải danh sách phòng đích
    expect(await screen.findByText('Áp dụng trong cùng tòa nhà')).toBeTruthy();
    expect(screen.getAllByText(/Phòng 102/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Phòng 103/).length).toBeGreaterThan(0);

    // Chọn phòng 102 và 103
    const check102 = screen.getByLabelText('Chọn phòng 102') as HTMLInputElement;
    fireEvent.click(check102);
    expect(check102.checked).toBe(true);
    const check103 = screen.getByLabelText('Chọn phòng 103') as HTMLInputElement;
    fireEvent.click(check103);
    expect(check103.checked).toBe(true);

    // Nhấn "Xác nhận áp dụng"
    const prepareButton = screen.getByRole('button', { name: 'Xác nhận áp dụng' });
    fireEvent.click(prepareButton);

    // Hộp thoại xác nhận xuất hiện kèm câu cảnh báo bắt buộc
    expect(screen.getByRole('heading', { name: 'Ghi đè cấu hình thanh toán?' })).toBeTruthy();
    expect(screen.getByText(m.confirm)).toBeTruthy();
    expect(screen.getByText('2 phòng được chọn')).toBeTruthy();

    // Nhấn "Áp dụng cấu hình" trong modal
    const finalApplyButton = screen.getByRole('button', { name: 'Áp dụng cấu hình' });
    fireEvent.click(finalApplyButton);

    // Thông báo kết quả và đối chiếu
    expect(await screen.findByText('Đã áp dụng cấu hình thanh toán cho 2 phòng.')).toBeTruthy();
    const postCall = fetchCalls.find(c => c.method === 'POST');
    expect(postCall).toBeDefined();
    expect(postCall?.body).toContain('"applyToAll":false');
    expect(postCall?.body).toContain(targetRoom1Id);
    expect(postCall?.body).toContain(targetRoom2Id);
  });

  it('Luồng 3c (Tất cả): Áp dụng cho tất cả phòng trong tòa nhà (omits roomIds)', async () => {
    setupFetch({ roomPolicy: configuredRoomPolicy });

    render(
      <RoomPaymentPolicyPage
        route={defaultRoute}
        allowed={true}
        registerGuard={registerGuard}
        onNavigate={onNavigate}
        onManageFunds={onManageFunds}
        onSessionExpired={onSessionExpired}
        onForbidden={onForbidden}
        onMissing={onMissing}
      />
    );

    await screen.findByText('Đã cấu hình');
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng cho các phòng khác trong tòa nhà' }));

    expect(await screen.findByText('Áp dụng trong cùng tòa nhà')).toBeTruthy();
    const selectAllCheckbox = screen.getByLabelText('Áp dụng cho tất cả phòng trong tòa nhà');
    fireEvent.click(selectAllCheckbox);

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận áp dụng' }));
    expect(screen.getByText('Tất cả phòng đích trong tòa nhà')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng cấu hình' }));
    await waitFor(() => {
      const postCall = fetchCalls.find(c => c.method === 'POST');
      expect(postCall).toBeDefined();
      expect(postCall?.body).toContain('"applyToAll":true');
      expect(postCall?.body).not.toContain('roomIds');
    });
  });

  it('Luồng 3c: Chặn mở áp dụng hàng loạt khi biểu mẫu đang dirty', async () => {
    setupFetch({ roomPolicy: configuredRoomPolicy });

    render(
      <RoomPaymentPolicyPage
        route={defaultRoute}
        allowed={true}
        registerGuard={registerGuard}
        onNavigate={onNavigate}
        onManageFunds={onManageFunds}
        onSessionExpired={onSessionExpired}
        onForbidden={onForbidden}
        onMissing={onMissing}
      />
    );

    await screen.findByText('Đã cấu hình');
    // Thay đổi switch tạo dirty
    const cashSwitch = screen.getByRole('switch', { name: 'Chấp nhận tiền mặt' });
    fireEvent.click(cashSwitch);

    const applyButton = screen.getByRole('button', { name: 'Áp dụng cho các phòng khác trong tòa nhà' });
    fireEvent.click(applyButton);

    expect(screen.getByText(m.dirtyApply)).toBeTruthy();
    expect(screen.queryByText('Áp dụng trong cùng tòa nhà')).toBeNull();
  });

  it('Luồng 3d: Hủy bỏ biểu mẫu quay về returnTo và không gọi API ghi', async () => {
    setupFetch({ roomPolicy: unconfiguredRoomPolicy });

    render(
      <RoomPaymentPolicyPage
        route={defaultRoute}
        allowed={true}
        registerGuard={registerGuard}
        onNavigate={onNavigate}
        onManageFunds={onManageFunds}
        onSessionExpired={onSessionExpired}
        onForbidden={onForbidden}
        onMissing={onMissing}
      />
    );

    await screen.findByText('Chưa cấu hình');
    const cancelButton = screen.getByRole('button', { name: 'Hủy bỏ' });
    fireEvent.click(cancelButton);

    expect(onNavigate).toHaveBeenCalledWith(defaultRoute.returnTo);
    expect(fetchCalls.some(c => c.method === 'PUT' || c.method === 'POST')).toBe(false);
  });

  it('Ngoại lệ 3a: Tắt cả hai phương thức hiển thị lỗi bắt buộc', async () => {
    setupFetch({ roomPolicy: configuredRoomPolicy });

    render(
      <RoomPaymentPolicyPage
        route={defaultRoute}
        allowed={true}
        registerGuard={registerGuard}
        onNavigate={onNavigate}
        onManageFunds={onManageFunds}
        onSessionExpired={onSessionExpired}
        onForbidden={onForbidden}
        onMissing={onMissing}
      />
    );

    await screen.findByText('Đã cấu hình');
    fireEvent.click(screen.getByRole('switch', { name: 'Chấp nhận tiền mặt' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Chấp nhận chuyển khoản' }));

    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));

    expect(screen.getByText(m.methods)).toBeTruthy();
    expect(fetchCalls.some(c => c.method === 'PUT')).toBe(false);
  });

  it('Ngoại lệ 6a: Bật phương thức nhưng chưa chọn nguồn hiển thị lỗi bắt buộc', async () => {
    setupFetch({ roomPolicy: unconfiguredRoomPolicy });

    render(
      <RoomPaymentPolicyPage
        route={defaultRoute}
        allowed={true}
        registerGuard={registerGuard}
        onNavigate={onNavigate}
        onManageFunds={onManageFunds}
        onSessionExpired={onSessionExpired}
        onForbidden={onForbidden}
        onMissing={onMissing}
      />
    );

    await screen.findByText('Chưa cấu hình');
    fireEvent.click(screen.getByRole('switch', { name: 'Chấp nhận tiền mặt' }));

    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));

    expect(screen.getByText(m.required)).toBeTruthy();
    expect(fetchCalls.some(c => c.method === 'PUT')).toBe(false);
  });

  it('Ngoại lệ 6b: Hiển thị nguồn ngừng hoạt động và từ chối lưu', async () => {
    setupFetch({
      roomPolicy: configuredWithInactivePolicy,
      bankSources: [uc40BankSource],
    });

    render(
      <RoomPaymentPolicyPage
        route={defaultRoute}
        allowed={true}
        registerGuard={registerGuard}
        onNavigate={onNavigate}
        onManageFunds={onManageFunds}
        onSessionExpired={onSessionExpired}
        onForbidden={onForbidden}
        onMissing={onMissing}
      />
    );

    await screen.findByText('Đã cấu hình');
    expect(screen.getByText('Techcombank cũ')).toBeTruthy();
    expect(screen.getByText('Ngừng hoạt động')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));
    expect(await screen.findByText(m.inactive)).toBeTruthy();
    expect(fetchCalls.some(c => c.method === 'PUT')).toBe(false);
  });

  it('Ngoại lệ 3c1: Không chọn phòng nào khi áp dụng hàng loạt báo lỗi', async () => {
    setupFetch({ roomPolicy: configuredRoomPolicy });

    render(
      <RoomPaymentPolicyPage
        route={defaultRoute}
        allowed={true}
        registerGuard={registerGuard}
        onNavigate={onNavigate}
        onManageFunds={onManageFunds}
        onSessionExpired={onSessionExpired}
        onForbidden={onForbidden}
        onMissing={onMissing}
      />
    );

    await screen.findByText('Đã cấu hình');
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng cho các phòng khác trong tòa nhà' }));

    expect(await screen.findByText('Áp dụng trong cùng tòa nhà')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận áp dụng' }));

    expect(screen.getByText(m.targets)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Ghi đè cấu hình thanh toán?' })).toBeNull();
  });

  it('Ngoại lệ 401: Phiên hết hạn kích hoạt onSessionExpired', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/csrf')) {
        return Promise.resolve(new Response(JSON.stringify({
          status: 200,
          message: 'OK',
          data: { headerName: 'X-CSRF-TOKEN', token: 'token' },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify({ status: 401, code: 'UNAUTHORIZED' }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
    }));

    render(
      <RoomPaymentPolicyPage
        route={defaultRoute}
        allowed={true}
        registerGuard={registerGuard}
        onNavigate={onNavigate}
        onManageFunds={onManageFunds}
        onSessionExpired={onSessionExpired}
        onForbidden={onForbidden}
        onMissing={onMissing}
      />
    );

    await waitFor(() => {
      expect(onSessionExpired).toHaveBeenCalledWith(m.session);
    });
  });

  it('Ngoại lệ 404: Không tìm thấy phòng kích hoạt onMissing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 404, code: 'ROOM_NOT_FOUND' }), { status: 404, headers: { 'Content-Type': 'application/json' } })));

    render(
      <RoomPaymentPolicyPage
        route={defaultRoute}
        allowed={true}
        registerGuard={registerGuard}
        onNavigate={onNavigate}
        onManageFunds={onManageFunds}
        onSessionExpired={onSessionExpired}
        onForbidden={onForbidden}
        onMissing={onMissing}
      />
    );

    await waitFor(() => {
      expect(onMissing).toHaveBeenCalledWith(m.notFound);
    });
  });
});
