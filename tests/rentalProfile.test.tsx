import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { RentalProfilePage } from '../src/components/rentalProfile/RentalProfilePage';
import { rentalProfileMessages as m, rentalProfilePath, rentalProfileTitle } from '../src/types/rentalProfile';
import { deferred, failure, ok } from './apiMock';
import { customerProfile } from './fixtures/profiles';
import { empty, invalidLink, loaded, profile, roomFailure } from './fixtures/rentalProfile.mjs';

function install(read: () => Promise<Response>, role = 'CUSTOMER', sessionExpired = false) {
  const rental = vi.fn(read);
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith('/customers/me/rental-profile')) {
      expect(init).toMatchObject({ credentials: 'include', cache: 'no-store', method: 'GET' });
      return rental();
    }
    if (path.endsWith('/auth/me')) return sessionExpired ? failure(401, 'Expired')
      : ok({ accountId: 'tenant', loginName: 'tester', role, hostId: null, customerId: null });
    if (path.endsWith('/profile')) return ok(customerProfile);
    if (path.endsWith('/auth/csrf')) return ok({ token: 'csrf', headerName: 'X-CSRF-TOKEN' });
    if (path.endsWith('/auth/refresh')) return failure(401, 'Expired');
    throw new Error(`Unexpected path: ${path}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { rental, fetchMock };
}

describe('UC23', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'));

  it('loads every room and formats present and missing profile values', async () => {
    install(async () => ok(loaded));
    render(<RentalProfilePage allowed onSessionExpired={vi.fn()} />);
    expect((screen.getByRole('status')).textContent).toContain('Đang tải');
    await screen.findByText(profile.fullName);
    expect(screen.getByText('15/05/1995')).toBeTruthy();
    expect(screen.getByText('Hộ chiếu')).toBeTruthy();
    expect(screen.getByText('Chưa cập nhật')).toBeTruthy();
    expect((screen.getByRole('table')).textContent).toContain('24,5 m²');
    expect((screen.getByRole('table')).textContent).toContain('B202');
  });

  it.each([[empty, m.empty], [roomFailure, m.roomFailure], [invalidLink, m.invalidLink]])('keeps profile in room state %#', async (data, message) => {
    install(async () => ok(data));
    render(<RentalProfilePage allowed onSessionExpired={vi.fn()} />);
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByText(profile.fullName)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it.each([[403, m.forbidden], [404, m.notFound], [500, m.profileFailure]])('handles HTTP %s without showing data', async (status, message) => {
    install(async () => failure(status, 'fixture'));
    render(<RentalProfilePage allowed onSessionExpired={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toContain(message);
    expect(screen.queryByText(profile.fullName)).toBeNull();
  });

  it('treats a malformed room payload as a load error and recovers on retry', async () => {
    const { rental } = install(async () => ok(loaded));
    rental.mockResolvedValueOnce(ok({ ...loaded, rooms: [] }));
    render(<RentalProfilePage allowed onSessionExpired={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toContain(m.profileFailure);
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect((await screen.findByRole('table')).textContent).toContain('A101');
  });

  it.each([200, 401, 403])('retains profile while retrying rooms, then applies HTTP %s', async (status) => {
    const { rental } = install(async () => ok(roomFailure), 'CUSTOMER', status === 401);
    const waiting = deferred<Response>();
    rental.mockImplementationOnce(async () => ok(roomFailure)).mockReturnValueOnce(waiting.promise);
    const onSessionExpired = vi.fn();
    render(<RentalProfilePage allowed onSessionExpired={onSessionExpired} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    expect(screen.getByText(profile.fullName)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Thử lại' }).disabled).toBe(true);
    await act(async () => waiting.resolve(status === 200 ? ok(loaded) : failure(status, 'fixture')));
    if (status === 200) expect((await screen.findByRole('table')).textContent).toContain('A101');
    else {
      expect(screen.queryByText(profile.fullName)).toBeNull();
      if (status === 401) expect(onSessionExpired).toHaveBeenCalledOnce();
      else expect((screen.getByRole('alert')).textContent).toContain(m.forbidden);
    }
  });

  it('rejects direct entry for Host before fetching rental data', async () => {
    const { rental } = install(async () => ok(loaded), 'HOST');
    window.history.replaceState(null, '', rentalProfilePath);
    render(<App />);
    expect(await screen.findByText(m.forbidden)).toBeTruthy();
    expect(rental).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: rentalProfileTitle })).toBeNull();
  });

  it.each([null, 'new-account'])('opens from menu and discards a response after session changes to %s', async (accountId) => {
    const waiting = deferred<Response>();
    const { rental } = install(() => waiting.promise);
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: rentalProfileTitle }));
    expect(location.pathname).toBe(rentalProfilePath);
    expect(rental).toHaveBeenCalledOnce();
    await act(async () => window.dispatchEvent(new StorageEvent('storage', {
      key: 'rentops-session-change', newValue: JSON.stringify({ accountId }),
    })));
    await act(async () => waiting.resolve(ok(loaded)));
    expect(screen.queryByText(profile.fullName)).toBeNull();
    expect(location.pathname).toBe('/');
  });
});
