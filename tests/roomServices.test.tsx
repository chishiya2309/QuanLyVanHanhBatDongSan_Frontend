import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { RoomServicesPage } from '../src/components/services/RoomServicesPage';
import { roomServiceMessages as m } from '../src/types/roomServices';
import { deferred } from './apiMock';
import {
  addedService,
  candidate,
  inheritedService,
  otherRoomId,
  privateService,
  roomId,
  roomServiceReply,
  roomServicesFixture,
  version,
} from './fixtures/roomServices';

const user = {
  accountId: 'uc36-host',
  loginName: 'host',
  role: 'HOST',
  hostId: 'host',
  customerId: null,
};
beforeEach(() => window.history.replaceState(null, '', '/rooms/' + roomId + '/services'));
function install() {
  let data = structuredClone(roomServicesFixture);
  const list = vi.fn(async (): Promise<Response> => roomServiceReply(data));
  const choices = vi.fn(
    async (): Promise<Response> => roomServiceReply({ roomId, services: [candidate] }),
  );
  const write = vi.fn(async (init: RequestInit, path: string): Promise<Response> => {
    const body = JSON.parse(String(init.body));
    const id = path.split('/').at(-2);
    if (init.method === 'POST') {
      const item = addedService();
      data.services.push(item);
      return roomServiceReply(item, 201, 'Thêm dịch vụ riêng thành công');
    }
    const item = data.services.find((item) => item.serviceId === id)!;
    if (init.method === 'PATCH') item.enabled = body.enabled;
    if (init.method === 'PUT') {
      item.roomPrice = String(body.unitPrice);
      item.unitPrice = item.roomPrice;
      item.priceSource = 'ROOM';
    }
    item.version = 'b'.repeat(64);
    return roomServiceReply(item);
  });
  const me = vi.fn(async (): Promise<Response> => roomServiceReply(user));
  const fetch = vi.fn(
    async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
      const path = new URL(String(input), window.location.origin).pathname;
      if (path.endsWith('/auth/csrf'))
        return roomServiceReply({ token: 'uc36-token', headerName: 'X-CSRF-TOKEN' });
      if (path.endsWith('/auth/me')) return me();
      if (path.endsWith('/auth/refresh')) return roomServiceReply(null, 401, m.sessionInvalid);
      if (path.endsWith('/services/available')) return choices();
      if (/\/rooms\/[^/]+\/services(?:\/.*)?$/.test(path))
        return init.method && init.method !== 'GET' ? write(init, path) : list();
      if (path.endsWith('/rooms/' + roomId + '/history'))
        return roomServiceReply({ roomId, roomCode: '101', tenancyHistory: [], stateHistory: [] });
      if (path.endsWith('/rooms/' + roomId) || path.endsWith('/rooms/' + roomId + '/detail'))
        return roomServiceReply({
          id: roomId,
          code: '101',
          name: 'Phòng 101',
          buildingId: roomServicesFixture.buildingId,
          buildingName: 'Tòa A',
          status: 'VACANT',
          defaultRent: 1000000,
          defaultDeposit: 1000000,
        });
      if (path.endsWith('/areas') || path.endsWith('/buildings') || path.endsWith('/rooms/search'))
        return roomServiceReply([]);
      throw new Error('Unexpected request: ' + path);
    },
  );
  vi.stubGlobal('fetch', fetch);
  return {
    list,
    choices,
    write,
    fetch,
    me,
    data,
    setData: (next: typeof data) => {
      data = next;
    },
  };
}
function page() {
  const expired = vi.fn(),
    navigate = vi.fn();
  let guard: (() => boolean) | null = null;
  const register = vi.fn((next: (() => boolean) | null) => {
    guard = next;
  });
  const view = render(
    <StrictMode>
      <RoomServicesPage
        route={{ roomId, returnTo: '/rooms?view=table' }}
        onNavigate={navigate}
        onSessionExpired={expired}
        registerGuard={register}
      />
    </StrictMode>,
  );
  return { ...view, expired, navigate, register, guard: () => guard?.() };
}
async function loaded() {
  await screen.findByRole('button', { name: 'Thiết lập giá riêng Điện' });
}
function editInternet() {
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật giá riêng Internet' }));
}
function row(name: string) {
  return screen.getByRole('rowheader', { name }).closest('tr')!;
}

describe('UC36 service page', () => {
  it('shows room, separate provenance, actual disabled price and only private toggles', async () => {
    install();
    page();
    await loaded();
    expect(screen.getByText('Mã phòng: 101')).toBeTruthy();
    expect(within(row('Điện')).queryByRole('switch')).toBeNull();
    expect(within(row('Điện')).getByText('Kế thừa từ tòa nhà')).toBeTruthy();
    expect(within(row('Internet')).getByText('120.000 ₫')).toBeTruthy();
    expect(
      (screen.getByRole('switch', { name: 'Áp dụng Internet' }) as HTMLInputElement).checked,
    ).toBe(false);
  });
  it('renders loading, empty and read error without inventing services', async () => {
    const api = install(),
      gate = deferred<Response>();
    api.list.mockReturnValueOnce(gate.promise);
    page();
    expect(screen.getByRole('status', { name: 'Đang tải cấu hình dịch vụ' })).toBeTruthy();
    await act(async () => gate.resolve(roomServiceReply({ ...roomServicesFixture, services: [] })));
    await screen.findByRole('heading', { name: m.empty });
    expect(api.write).not.toHaveBeenCalled();
  });
  it('retries an initial failed GET without showing an empty state', async () => {
    const api = install();
    api.list.mockResolvedValueOnce(roomServiceReply(null, 500, m.getFailure));
    page();
    await screen.findByText(m.getFailure);
    expect(screen.queryByText(m.empty)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại danh sách' }));
    await loaded();
    expect(api.write).not.toHaveBeenCalled();
  });
  it('validates selection, cancels without a write, and adds using candidate version', async () => {
    const api = install();
    page();
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dịch vụ riêng' }));
    await screen.findByLabelText('Dịch vụ');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu dịch vụ' }));
    expect(screen.getByText(m.serviceRequired)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Dịch vụ'), { target: { value: candidate.serviceId } });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(api.write).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dịch vụ riêng' }));
    await screen.findByLabelText('Dịch vụ');
    fireEvent.change(screen.getByLabelText('Dịch vụ'), { target: { value: candidate.serviceId } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu dịch vụ' }));
    await screen.findByRole('rowheader', { name: 'Vệ sinh' });
    expect(JSON.parse(String(api.write.mock.calls[0][0].body))).toEqual({
      serviceId: candidate.serviceId,
      version: candidate.version,
    });
    expect(api.write).toHaveBeenCalledOnce();
    expect(api.list).toHaveBeenCalledTimes(2);
  });
  it('distinguishes empty choices from a failed lookup and supports retry', async () => {
    const api = install();
    api.choices
      .mockResolvedValueOnce(roomServiceReply(null, 500, 'Unavailable'))
      .mockResolvedValueOnce(roomServiceReply({ roomId, services: [] }));
    page();
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dịch vụ riêng' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại lựa chọn' }));
    await screen.findByText(m.noneAvailable);
    expect(
      (screen.getByRole('button', { name: 'Lưu dịch vụ' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(api.write).not.toHaveBeenCalled();
  });
  it('waits for confirmation, locks duplicate writes and retains price/row on toggle', async () => {
    const api = install(),
      gate = deferred<Response>();
    api.write.mockReturnValueOnce(gate.promise);
    page();
    await loaded();
    const toggle = screen.getByRole('switch', { name: 'Áp dụng Internet' }) as HTMLInputElement;
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
    expect(toggle.disabled).toBe(true);
    await waitFor(() => expect(api.write).toHaveBeenCalledOnce());
    expect(JSON.parse(String(api.write.mock.calls[0][0].body))).toEqual({ enabled: true, version });
    api.data.services[1].enabled = true;
    await act(async () => gate.resolve(roomServiceReply({ ...privateService, enabled: true })));
    await waitFor(() => expect(toggle.checked).toBe(true));
    expect(within(row('Internet')).getByText('120.000 ₫')).toBeTruthy();
    expect(screen.getByText(/Cấu hình dịch vụ đã được lưu/)).toBeTruthy();
  });
  it('reports backend no-op status as a success', async () => {
    const api = install();
    api.write.mockResolvedValueOnce(
      roomServiceReply(
        { ...privateService, enabled: true },
        200,
        'Dịch vụ đã ở trạng thái được yêu cầu',
      ),
    );
    page();
    await loaded();
    fireEvent.click(screen.getByRole('switch', { name: 'Áp dụng Internet' }));
    await screen.findByText(/Dịch vụ đã ở trạng thái được yêu cầu/);
  });
  it.each(['', '-1', '1.5', '1e3', 'abc', '99999999999999999999'])(
    'rejects price %j and preserves the draft',
    async (value) => {
      const api = install();
      page();
      await loaded();
      editInternet();
      fireEvent.change(screen.getByLabelText('Đơn giá riêng (VND)'), { target: { value } });
      fireEvent.click(screen.getByRole('button', { name: 'Lưu giá riêng' }));
      expect(screen.getByText(m.priceInvalid)).toBeTruthy();
      expect(api.write).not.toHaveBeenCalled();
      expect((screen.getByLabelText('Đơn giá riêng (VND)') as HTMLInputElement).value).toBe(value);
      expect(document.activeElement).toBe(screen.getByLabelText('Đơn giá riêng (VND)'));
    },
  );
  it('sets zero on inherited service without enabling a private toggle', async () => {
    const api = install();
    page();
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Thiết lập giá riêng Điện' }));
    expect(screen.getByText('Giá kế thừa')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Đơn giá riêng (VND)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu giá riêng' }));
    await screen.findByRole('button', { name: 'Cập nhật giá riêng Điện' });
    expect(within(row('Điện')).getByText('0 ₫')).toBeTruthy();
    expect(within(row('Điện')).queryByRole('switch')).toBeNull();
    expect(JSON.parse(String(api.write.mock.calls[0][0].body))).toEqual({ unitPrice: 0, version });
  });
  it('edits a disabled private service and cancels back to the opener without writing', async () => {
    const api = install();
    page();
    await loaded();
    const button = screen.getByRole('button', { name: 'Cập nhật giá riêng Internet' });
    editInternet();
    fireEvent.change(screen.getByLabelText('Đơn giá riêng (VND)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(api.write).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button);
  });
  it('preserves the draft and old saved state on confirmed failure, allowing manual retry', async () => {
    const api = install();
    api.write.mockResolvedValueOnce(roomServiceReply(null, 500, m.saveFailure));
    page();
    await loaded();
    editInternet();
    fireEvent.change(screen.getByLabelText('Đơn giá riêng (VND)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu giá riêng' }));
    await screen.findByText(m.saveFailure);
    expect((screen.getByLabelText('Đơn giá riêng (VND)') as HTMLInputElement).value).toBe('0');
    expect(within(row('Internet')).getByText('120.000 ₫')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu giá riêng' }));
    await screen.findByText(/Cấu hình dịch vụ đã được lưu/);
    expect(api.write).toHaveBeenCalledTimes(2);
  });
  it('attaches server field errors and keeps CSRF 403 editable', async () => {
    const api = install();
    api.write.mockResolvedValueOnce(
      roomServiceReply(null, 400, m.invalid, { unitPrice: m.priceInvalid }),
    );
    page();
    await loaded();
    editInternet();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu giá riêng' }));
    await screen.findByText(m.priceInvalid);
    api.write.mockResolvedValueOnce(roomServiceReply(null, 403, m.csrfInvalid));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu giá riêng' }));
    await screen.findByText(m.csrfInvalid);
    expect((screen.getByLabelText('Đơn giá riêng (VND)') as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByRole('rowheader', { name: 'Internet' })).toBeTruthy();
  });
  it.each(['network', 'invalid-response'])(
    'blocks writes after %s, requires GET and explicit review, never replays',
    async (mode) => {
      const api = install();
      api.write.mockImplementationOnce(async () => {
        if (mode === 'network') throw new TypeError('offline');
        return roomServiceReply({ ...privateService, serviceId: inheritedService.serviceId });
      });
      page();
      await loaded();
      editInternet();
      fireEvent.change(screen.getByLabelText('Đơn giá riêng (VND)'), { target: { value: '0' } });
      fireEvent.click(screen.getByRole('button', { name: 'Lưu giá riêng' }));
      await screen.findByText(m.uncertain);
      expect(
        (screen.getByRole('button', { name: 'Lưu giá riêng' }) as HTMLButtonElement).disabled,
      ).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: 'Tải lại danh sách' }));
      await screen.findByText(/Đã tải lại cấu hình hiện tại/);
      expect(api.write).toHaveBeenCalledOnce();
      expect(
        (screen.getByRole('button', { name: 'Lưu giá riêng' }) as HTMLButtonElement).disabled,
      ).toBe(true);
      expect((screen.getByLabelText('Đơn giá riêng (VND)') as HTMLInputElement).value).toBe('0');
    },
  );
  it('keeps confirmed saved item when GET fails and retries only GET', async () => {
    const api = install();
    api.list
      .mockResolvedValueOnce(roomServiceReply(roomServicesFixture))
      .mockResolvedValueOnce(roomServiceReply(null, 500, m.getFailure));
    page();
    await loaded();
    editInternet();
    fireEvent.change(screen.getByLabelText('Đơn giá riêng (VND)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu giá riêng' }));
    await screen.findByText(m.savedReloadFailure);
    expect(within(row('Internet')).getByText('0 ₫')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Thêm dịch vụ riêng' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại danh sách' }));
    await waitFor(() => expect(screen.queryByText(m.savedReloadFailure)).toBeNull());
    expect(api.write).toHaveBeenCalledOnce();
  });
  it.each([m.stale, m.history, m.privateOnly])(
    'blocks %s without refreshing/replaying automatically',
    async (message) => {
      const api = install();
      api.write.mockResolvedValueOnce(roomServiceReply(null, 409, message));
      page();
      await loaded();
      editInternet();
      fireEvent.click(screen.getByRole('button', { name: 'Lưu giá riêng' }));
      await waitFor(() => expect(screen.getAllByText(message).length).toBeGreaterThan(0));
      expect(api.list).toHaveBeenCalledOnce();
      expect(api.write).toHaveBeenCalledOnce();
      expect(
        (screen.getByRole('button', { name: 'Lưu giá riêng' }) as HTMLButtonElement).disabled,
      ).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: 'Tải lại danh sách' }));
      await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
      expect(api.write).toHaveBeenCalledOnce();
    },
  );
  it.each([m.duplicate, m.ineligible])('refreshes the correct region for %s', async (message) => {
    const api = install();
    api.write.mockResolvedValueOnce(roomServiceReply(null, 409, message));
    page();
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dịch vụ riêng' }));
    await screen.findByLabelText('Dịch vụ');
    fireEvent.change(screen.getByLabelText('Dịch vụ'), { target: { value: candidate.serviceId } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu dịch vụ' }));
    await screen.findByText(message);
    await waitFor(() =>
      expect(message === m.duplicate ? api.list : api.choices).toHaveBeenCalledTimes(2),
    );
    expect(api.write).toHaveBeenCalledOnce();
  });
  it.each([403, 404])(
    'removes inaccessible data after HTTP %s and stops writes',
    async (status) => {
      const api = install();
      api.write.mockResolvedValueOnce(roomServiceReply(null, status, 'Denied'));
      page();
      await loaded();
      fireEvent.click(screen.getByRole('switch', { name: 'Áp dụng Internet' }));
      await screen.findByText(status === 404 ? m.notFound : m.forbidden);
      expect(screen.queryByRole('rowheader', { name: 'Internet' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Tải lại danh sách' })).toBeNull();
    },
  );
  it('protects a dirty draft and refuses navigation while a write is pending', async () => {
    const api = install(),
      gate = deferred<Response>();
    api.write.mockReturnValueOnce(gate.promise);
    const ui = page();
    await loaded();
    editInternet();
    fireEvent.change(screen.getByLabelText('Đơn giá riêng (VND)'), { target: { value: '0' } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(ui.guard()).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu giá riêng' }));
    expect(ui.guard()).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    await act(async () => gate.resolve(roomServiceReply(null, 500, m.saveFailure)));
  });
  it('drops a late response after changing rooms', async () => {
    const api = install(),
      gate = deferred<Response>();
    api.list.mockReturnValueOnce(gate.promise);
    const ui = page();
    await waitFor(() => expect(api.list).toHaveBeenCalledOnce());
    window.history.replaceState(null, '', '/rooms/' + otherRoomId + '/services');
    api.list.mockResolvedValueOnce(
      roomServiceReply({ ...roomServicesFixture, roomId: otherRoomId, roomName: 'Phòng 202' }),
    );
    ui.rerender(
      <RoomServicesPage
        key={otherRoomId}
        route={{ roomId: otherRoomId, returnTo: '/rooms' }}
        registerGuard={ui.register}
        onNavigate={ui.navigate}
        onSessionExpired={ui.expired}
      />,
    );
    await screen.findByText('Phòng 202');
    await act(async () => gate.resolve(roomServiceReply(roomServicesFixture)));
    expect(screen.queryByText('Phòng 101')).toBeNull();
  });
});

describe('UC36 application routing and access', () => {
  it('authenticates a direct URL, highlights Rooms, preserves reload/back/forward and safe return context', async () => {
    const api = install();
    const target =
      '/rooms/' +
      roomId +
      '/services?returnTo=' +
      encodeURIComponent('/rooms?view=table&keyword=101&roomId=' + roomId + '&action=detail');
    window.history.replaceState(null, '', target);
    const view = render(<App />);
    await loaded();
    expect(
      screen.getByRole('button', { name: 'Mặt bằng & Phòng' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(api.me).toHaveBeenCalledOnce();
    view.unmount();
    render(<App />);
    await loaded();
    expect(window.location.pathname + window.location.search).toBe(target);
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại phòng đã chọn' }));
    await screen.findByRole('heading', { name: 'Quản lý Mặt bằng & Phòng' });
    expect(
      (screen.getByPlaceholderText('Tìm theo mã hoặc tên phòng...') as HTMLInputElement).value,
    ).toBe('101');
    fireEvent.click(await screen.findByRole('button', { name: 'Cấu hình dịch vụ' }));
    await loaded();
    act(() => {
      window.history.pushState(null, '', '/rooms?view=table');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await screen.findByRole('heading', { name: 'Quản lý Mặt bằng & Phòng' });
    act(() => {
      window.history.pushState(null, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await loaded();
  });
  it.each(['ADMIN', 'CUSTOMER'])(
    'blocks %s direct access before reading room data',
    async (role) => {
      const api = install();
      api.me.mockResolvedValue(roomServiceReply({ ...user, role }));
      render(<App />);
      await screen.findByText(m.forbidden);
      expect(api.list).not.toHaveBeenCalled();
    },
  );
  it('ends an expired session without replaying a draft after login', async () => {
    const api = install();
    render(<App />);
    await loaded();
    editInternet();
    api.write.mockResolvedValueOnce(roomServiceReply(null, 401, m.sessionInvalid));
    api.me.mockResolvedValue(roomServiceReply(null, 401, m.sessionInvalid));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu giá riêng' }));
    await screen.findByRole('heading', { name: 'Đăng nhập tài khoản' });
    expect(api.write).toHaveBeenCalledOnce();
  });
});
