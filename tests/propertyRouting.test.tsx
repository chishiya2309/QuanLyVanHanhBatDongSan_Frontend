import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { hostAccountMessages } from '../src/types/hostAccounts';
import { deferred, failure, ok } from './apiMock';

const user = { accountId: 'routing-host', loginName: 'host', role: 'HOST', hostId: 'host', customerId: null };
const routes = [
  { url: '/properties?tab=buildings', heading: 'Cơ sở & Bất động sản', menu: 'Cơ sở & Tòa nhà', selectedButton: /Danh sách tòa nhà/ },
  { url: '/rooms?view=table', heading: 'Quản lý Mặt bằng & Phòng', menu: 'Mặt bằng & Phòng', selectedButton: /Danh sách tra cứu/ },
];

function install() {
  const me = vi.fn(async (): Promise<Response> => ok(user));
  const refresh = vi.fn(async (): Promise<Response> => failure(401, 'Expired'));
  const propertyData = vi.fn(async (): Promise<Response> => ok([]));
  const fetch = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(String(input), window.location.origin);
    if (url.pathname.endsWith('/auth/me')) return me();
    if (url.pathname.endsWith('/auth/refresh')) return refresh();
    if (url.pathname.endsWith('/auth/csrf')) return ok({ token: 'routing', headerName: 'X-CSRF-TOKEN' });
    if (['/api/v1/areas', '/api/v1/buildings', '/api/v1/buildings/active-areas', '/api/v1/rooms/search'].includes(url.pathname)) return propertyData();
    throw new Error('Unexpected test request ' + url.pathname);
  });
  vi.stubGlobal('fetch', fetch);
  return { me, refresh, propertyData };
}

beforeEach(() => window.history.replaceState(null, '', '/'));

describe('property and room routing in the application', () => {
  it.each(routes)('restores $url only after authentication and preserves query selection', async ({ url, heading, menu, selectedButton }) => {
    const api = install();
    const gate = deferred<Response>();
    api.me.mockReturnValueOnce(gate.promise);
    window.history.replaceState(null, '', url);
    render(<App />);
    expect(screen.getByText('Đang kiểm tra phiên đăng nhập')).toBeTruthy();
    expect(api.propertyData).not.toHaveBeenCalled();

    await act(async () => gate.resolve(ok(user)));
    await screen.findByRole('heading', { name: heading });
    expect(screen.getByRole('button', { name: menu }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: selectedButton }).classList.contains('is-active')).toBe(true);
    expect(window.location.pathname + window.location.search).toBe(url);
    await waitFor(() => expect(api.propertyData).toHaveBeenCalled());
  });

  it.each(routes)('returns to login when the session has expired at $url', async ({ url }) => {
    const api = install();
    api.me.mockImplementation(async () => failure(401, 'Expired'));
    window.history.replaceState(null, '', url);
    render(<App />);

    await screen.findByRole('heading', { name: 'Đăng nhập tài khoản' });
    expect(screen.getByText(hostAccountMessages.sessionInvalid)).toBeTruthy();
    expect(window.location.pathname + window.location.search).toBe('/');
    expect(api.refresh).toHaveBeenCalledOnce();
    expect(api.propertyData).not.toHaveBeenCalled();
  });

  it.each(routes)('checks the session when history returns from password recovery to $url', async ({ url, heading }) => {
    const api = install();
    window.history.replaceState(null, '', '/forgot-password');
    render(<App />);
    expect(api.me).not.toHaveBeenCalled();

    act(() => {
      window.history.pushState(null, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await screen.findByRole('heading', { name: heading });
    expect(api.me).toHaveBeenCalledOnce();
    expect(window.location.pathname + window.location.search).toBe(url);
  });

  it('switches pages through the sidebar, page controls and history without rechecking the session', async () => {
    const api = install();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cơ sở & Tòa nhà' }));
    await screen.findByRole('heading', { name: routes[0].heading });
    fireEvent.click(screen.getByRole('button', { name: /Danh sách tòa nhà/ }));
    expect(window.location.pathname + window.location.search).toBe('/properties?tab=buildings');

    fireEvent.click(screen.getByRole('button', { name: 'Mặt bằng & Phòng' }));
    await screen.findByRole('heading', { name: routes[1].heading });
    expect(screen.queryByRole('heading', { name: routes[0].heading })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Danh sách tra cứu' }));
    expect(window.location.pathname + window.location.search).toBe('/rooms?view=table');

    act(() => {
      window.history.pushState(null, '', routes[0].url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await screen.findByRole('heading', { name: routes[0].heading });
    expect(screen.queryByRole('heading', { name: routes[1].heading })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Tổng quan' }));
    await screen.findByRole('heading', { name: 'Chào buổi sáng, host' });
    expect(window.location.pathname).toBe('/');
    expect(screen.queryByRole('heading', { name: routes[0].heading })).toBeNull();
    expect(api.me).toHaveBeenCalledOnce();
  });
});
