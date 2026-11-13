import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { deferred, failure, ok } from './apiMock';
import { customerMessages } from '../src/types/customer';
import { catalogMessages } from '../src/types/serviceCatalog';

const user = { accountId: 'deposit-host', loginName: 'host', role: 'HOST', hostId: 'host', customerId: null };

function sidebar() {
  return within(screen.getByRole('complementary', { name: 'Thanh điều hướng chính' }));
}

function install() {
  const me = vi.fn(async (): Promise<Response> => ok(user));
  const refresh = vi.fn(async (): Promise<Response> => failure(401, 'Expired'));
  const contractsData = vi.fn(async (): Promise<Response> => ok({
    content: [],
    pageNumber: 0,
    pageSize: 10,
    totalElements: 0,
    totalPages: 0,
    last: true,
  }));
  const availableRooms = vi.fn(async (): Promise<Response> => ok([]));
  const availableCustomers = vi.fn(async (): Promise<Response> => ok([]));
  const rentalContractsData = vi.fn(async (): Promise<Response> => ok({
    content: [], pageNumber: 0, pageSize: 15, totalElements: 0, totalPages: 0, last: true,
  }));

  const fetch = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(String(input), window.location.origin);
    if (url.pathname.endsWith('/auth/me')) return me();
    if (url.pathname.endsWith('/auth/refresh')) return refresh();
    if (url.pathname.endsWith('/auth/csrf')) return ok({ token: 'csrf-token', headerName: 'X-CSRF-TOKEN' });
    if (url.pathname === '/api/v1/deposit-contracts') return contractsData();
    if (url.pathname === '/api/v1/rental-contracts') return rentalContractsData();
    if (url.pathname === '/api/v1/deposit-contracts/available-rooms') return availableRooms();
    if (url.pathname === '/api/v1/deposit-contracts/available-customers') return availableCustomers();
    if (url.pathname === '/api/v1/customers') return new Response(JSON.stringify({
      status: 200,
      message: customerMessages.listSuccess,
      data: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true },
    }), { status: 200 });
    if (url.pathname === '/api/v1/services') return new Response(JSON.stringify({
      status: 200, message: catalogMessages.listSuccess, data: [],
    }), { status: 200 });
    if (url.pathname === '/api/v1/buildings') return ok([]);
    throw new Error('Unexpected test request ' + url.pathname);
  });
  vi.stubGlobal('fetch', fetch);
  return { me, refresh, contractsData, rentalContractsData, availableRooms, availableCustomers };
}

beforeEach(() => window.history.replaceState(null, '', '/'));

describe('deposit contract routing and interaction in the application', () => {
  it.each([
    { path: '/deposit-contracts', heading: 'Hợp đồng đặt cọc' },
    { path: '/rental-contracts', heading: 'Hợp đồng thuê' },
  ])('restores $path only after authentication', async ({ path, heading }) => {
    const api = install();
    const gate = deferred<Response>();
    api.me.mockReturnValueOnce(gate.promise);
    window.history.replaceState(null, '', path);
    render(<App />);

    expect(screen.getByText('Đang kiểm tra phiên đăng nhập')).toBeTruthy();
    expect(api.contractsData).not.toHaveBeenCalled();
    expect(api.rentalContractsData).not.toHaveBeenCalled();

    await act(async () => gate.resolve(ok(user)));
    await screen.findByRole('heading', { name: heading });
    expect(sidebar().getByRole('button', { name: heading }).getAttribute('aria-current')).toBe('page');
    expect(window.location.pathname).toBe(path);
    await waitFor(() => expect(path === '/deposit-contracts' ? api.contractsData : api.rentalContractsData).toHaveBeenCalled());
  });

  it('switches to deposit contracts page via sidebar click', async () => {
    install();
    render(<App />);

    const sidebarBtn = await screen.findByRole('button', { name: 'Hợp đồng đặt cọc' });
    fireEvent.click(sidebarBtn);

    await screen.findByRole('heading', { name: 'Hợp đồng đặt cọc' });
    expect(window.location.pathname).toBe('/deposit-contracts');
    expect(sidebarBtn.getAttribute('aria-current')).toBe('page');
  });

  it.each([
    { path: '/customers', heading: 'Quản lý khách thuê', menu: 'Khách thuê', returnHeading: 'Quản lý khách thuê' },
    { path: '/services', heading: 'Danh mục dịch vụ', menu: 'Danh mục dịch vụ', returnHeading: 'Danh mục dịch vụ' },
    { path: '/services/policy', heading: 'Thiết lập chính sách dịch vụ', menu: 'Danh mục dịch vụ', returnHeading: 'Danh mục dịch vụ' },
    { path: '/rental-contracts', heading: 'Hợp đồng thuê', menu: 'Hợp đồng thuê', returnHeading: 'Hợp đồng thuê' },
  ])('switches from $path to deposit contracts and back with only one active menu', async ({ path, heading, menu, returnHeading }) => {
    const api = install();
    window.history.replaceState(null, '', path);
    render(<App />);
    await screen.findByRole('heading', { name: heading });

    fireEvent.click(sidebar().getByRole('button', { name: 'Hợp đồng đặt cọc' }));
    await screen.findByRole('heading', { name: 'Hợp đồng đặt cọc' });
    expect(screen.queryByRole('heading', { name: heading })).toBeNull();
    expect(window.location.pathname).toBe('/deposit-contracts');
    expect(sidebar().getAllByRole('button', { current: 'page' })).toHaveLength(1);
    await waitFor(() => expect(api.contractsData).toHaveBeenCalled());

    fireEvent.click(sidebar().getByRole('button', { name: menu }));
    await screen.findByRole('heading', { name: returnHeading });
    expect(screen.queryByRole('heading', { name: 'Hợp đồng đặt cọc' })).toBeNull();
    expect(sidebar().getByRole('button', { name: 'Hợp đồng đặt cọc' }).getAttribute('aria-current')).toBeNull();
    expect(sidebar().getAllByRole('button', { current: 'page' })).toHaveLength(1);

    fireEvent.click(sidebar().getByRole('button', { name: 'Hợp đồng đặt cọc' }));
    await screen.findByRole('heading', { name: 'Hợp đồng đặt cọc' });
    expect(api.me).toHaveBeenCalledOnce();
  });

  it.each([
    { path: '/customers', heading: 'Quản lý khách thuê', menu: 'Khách thuê' },
    { path: '/services', heading: 'Danh mục dịch vụ', menu: 'Danh mục dịch vụ' },
  ])('switches from $path to rental contracts and back', async ({ path, heading, menu }) => {
    const api = install();
    window.history.replaceState(null, '', path);
    render(<App />);
    await screen.findByRole('heading', { name: heading });

    fireEvent.click(sidebar().getByRole('button', { name: 'Hợp đồng thuê' }));
    await screen.findByRole('heading', { name: 'Hợp đồng thuê' });
    expect(screen.queryByRole('heading', { name: heading })).toBeNull();
    expect(window.location.pathname).toBe('/rental-contracts');
    expect(sidebar().getAllByRole('button', { current: 'page' })).toHaveLength(1);
    await waitFor(() => expect(api.rentalContractsData).toHaveBeenCalled());

    fireEvent.click(sidebar().getByRole('button', { name: menu }));
    await screen.findByRole('heading', { name: heading });
    expect(screen.queryByRole('heading', { name: 'Hợp đồng thuê' })).toBeNull();
    expect(window.location.pathname).toBe(path);
    expect(sidebar().getAllByRole('button', { current: 'page' })).toHaveLength(1);
    expect(api.me).toHaveBeenCalledOnce();
  });

  it('switches contract tabs and restores contract routes from browser history', async () => {
    const api = install();
    window.history.replaceState(null, '', '/deposit-contracts');
    render(<App />);
    await screen.findByRole('heading', { name: 'Hợp đồng đặt cọc' });

    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Hợp đồng thuê' }));
    await screen.findByRole('heading', { name: 'Hợp đồng thuê' });
    expect(window.location.pathname).toBe('/rental-contracts');

    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Hợp đồng đặt cọc' }));
    await screen.findByRole('heading', { name: 'Hợp đồng đặt cọc' });
    expect(window.location.pathname).toBe('/deposit-contracts');

    act(() => {
      window.history.replaceState(null, '', '/rental-contracts');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await screen.findByRole('heading', { name: 'Hợp đồng thuê' });
    expect(sidebar().getByRole('button', { name: 'Hợp đồng thuê' }).getAttribute('aria-current')).toBe('page');
    expect(sidebar().getAllByRole('button', { current: 'page' })).toHaveLength(1);
    expect(api.me).toHaveBeenCalledOnce();
  });

  it('opens and closes the create deposit contract modal', async () => {
    install();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Hợp đồng đặt cọc' }));
    await screen.findByRole('heading', { name: 'Hợp đồng đặt cọc' });

    const createBtn = screen.getByRole('button', { name: /Tạo hợp đồng đặt cọc/i });
    fireEvent.click(createBtn);

    await screen.findByRole('heading', { name: 'Tạo hợp đồng đặt cọc mới' });
    expect(screen.getByLabelText(/Khách thuê đại diện/i)).toBeTruthy();
    expect(screen.getByLabelText(/Phòng đặt cọc/i)).toBeTruthy();

    const closeBtn = screen.getByRole('button', { name: 'Đóng' });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('heading', { name: 'Tạo hợp đồng đặt cọc mới' })).toBeNull();
  });

  it('toggles quick customer creation inside the modal', async () => {
    install();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Hợp đồng đặt cọc' }));
    await screen.findByRole('heading', { name: 'Hợp đồng đặt cọc' });

    fireEvent.click(screen.getByRole('button', { name: /Tạo hợp đồng đặt cọc/i }));
    await screen.findByRole('heading', { name: 'Tạo hợp đồng đặt cọc mới' });

    const addCustBtn = screen.getByRole('button', { name: /\+ Thêm khách mới/i });
    fireEvent.click(addCustBtn);

    expect(screen.getByText('Thêm nhanh khách thuê mới')).toBeTruthy();
    expect(screen.getByLabelText(/Họ và tên \(\*\)/i)).toBeTruthy();
    expect(screen.getByLabelText(/Số điện thoại/i)).toBeTruthy();
    expect(screen.getByLabelText(/Số CCCD \/ CMND/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Hủy thêm khách' }));
    expect(screen.queryByText('Thêm nhanh khách thuê mới')).toBeNull();
  });
});

