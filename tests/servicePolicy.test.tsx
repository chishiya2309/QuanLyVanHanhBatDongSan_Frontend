import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import {
  servicePolicyMessages as m,
  type BuildingLookupItem,
  type ChargeMethod,
  type ServicePolicy,
} from '../src/types/servicePolicy';
import { catalogMessages } from '../src/types/serviceCatalog';
import { parsePolicyJson } from '../src/services/servicePolicyCodec';
import { isRecord } from '../src/services/assetCodec';
import {
  building3,
  buildingConfig2,
  electricityPolicy,
  fixtureBuildings,
  internetPolicy,
  lockedMethodPolicy,
  policyReply,
  policyWire,
} from './fixtures/servicePolicy';
import {
  catalogFixtures,
  catalogReply,
  catalogWire,
  electricityId,
  internetId,
  revisionId,
} from './fixtures/serviceCatalog';
import { deferred, failure, ok } from './apiMock';

function install(role = 'HOST', initialPolicy: ServicePolicy = internetPolicy) {
  let currentPolicy: ServicePolicy = JSON.parse(JSON.stringify(initialPolicy));
  let buildings = [...fixtureBuildings];
  const catalog = [...catalogFixtures];

  const me = vi.fn(async (): Promise<Response> =>
    ok({
      accountId: 'policy-host',
      loginName: 'Chủ nhà UC20',
      role,
      hostId: electricityId,
      customerId: null,
    }),
  );

  const csrf = vi.fn(async () => ok({ headerName: 'X-CSRF-TOKEN', token: 'uc20-csrf' }));

  const getCatalog = vi.fn(async (): Promise<Response> => catalogReply(catalog.map(catalogWire), catalogMessages.listSuccess));

  const getPolicy = vi.fn(async (id: string): Promise<Response> => {
    if (id === currentPolicy.service.id) {
      return policyReply(policyWire(currentPolicy));
    }
    if (id === electricityPolicy.service.id) {
      return policyReply(policyWire(electricityPolicy));
    }
    return failure(404, m.notFound);
  });

  const patchPolicy = vi.fn(async (url: URL, init: RequestInit): Promise<Response> => {
    const data = parsePolicyJson(String(init.body));
    if (!isRecord(data)) throw new Error('Invalid test body');

    const isConfigured = data.defaultPrice !== undefined || currentPolicy.service.pricingStatus === 'CONFIGURED';
    const updated: ServicePolicy = {
      ...currentPolicy,
      service: {
        ...currentPolicy.service,
        method: typeof data.method === 'string' ? (data.method as ChargeMethod) : currentPolicy.service.method,
        defaultPrice: data.defaultPrice !== undefined ? String(data.defaultPrice) : currentPolicy.service.defaultPrice,
        version: String(BigInt(currentPolicy.service.version) + 1n),
        pricingStatus: isConfigured ? 'CONFIGURED' : 'UNCONFIGURED',
        currentPriceRevisionId: isConfigured ? (currentPolicy.service.currentPriceRevisionId || revisionId) : null,
        effectiveFrom: isConfigured ? (currentPolicy.service.effectiveFrom || '2026-11-08T00:00:00.000000Z') : null,
        // UC20 first price keeps active=false!
        active: currentPolicy.service.active,
      },
      prorate: data.prorate !== undefined ? (data.prorate as boolean) : currentPolicy.prorate,
      buildingConfigurations: [...currentPolicy.buildingConfigurations],
    };

    if (Array.isArray(data.buildings)) {
      for (const raw of data.buildings) {
        if (!isRecord(raw) || typeof raw.buildingId !== 'string') continue;
        const item = { buildingId: raw.buildingId, defaultForNewRoom: Boolean(raw.defaultForNewRoom) };
        const existing = updated.buildingConfigurations.find((c) => c.buildingId === item.buildingId);
        if (existing) {
          if (item.defaultForNewRoom !== undefined) {
            existing.defaultForNewRoom = item.defaultForNewRoom;
          }
        } else {
          const bInfo = buildings.find((b) => b.id === item.buildingId);
          updated.buildingConfigurations.push({
            configurationId: item.buildingId.replace(/^[0-9a-f]{8}/, '99999999'),
            buildingId: item.buildingId,
            buildingName: bInfo ? bInfo.name : 'Tòa nhà mới',
            defaultForNewRoom: item.defaultForNewRoom,
            unitPrice: null,
            prorate: null,
            enabled: true,
            currentPriceRevisionId: revisionId,
            effectiveFrom: '2026-11-08T00:00:00.000000Z',
          });
        }
      }
    }

    currentPolicy = updated;
    return policyReply(policyWire(updated), m.saveSuccess);
  });

  const getBuildings = vi.fn(async (): Promise<Response> => ok(buildings));

  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input), 'http://localhost');
    const method = init.method || 'GET';

    if (url.pathname.endsWith('/auth/me')) return me();
    if (url.pathname.endsWith('/auth/refresh')) return failure(401, 'Expired');
    if (url.pathname.endsWith('/auth/csrf')) return csrf();
    if (url.pathname === '/api/v1/buildings' && method === 'GET') return getBuildings();
    if (url.pathname === '/api/v1/services' && method === 'GET') return getCatalog();

    if (url.pathname.startsWith('/api/v1/services/') && url.pathname.endsWith('/policy')) {
      if (method === 'PATCH') return patchPolicy(url, init);
      if (method === 'GET') {
        const id = url.pathname.split('/')[4];
        return getPolicy(id);
      }
    }

    return failure(404, 'Unexpected test endpoint');
  });

  vi.stubGlobal('fetch', fetch);
  return {
    me,
    csrf,
    getPolicy,
    patchPolicy,
    getBuildings,
    fetch,
    getCurrentPolicy: () => currentPolicy,
    setCurrentPolicy: (p: ServicePolicy) => {
      currentPolicy = p;
    },
    setBuildings: (b: BuildingLookupItem[]) => {
      buildings = b;
    },
  };
}

const goto = (url: string) => {
  history.pushState(null, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

beforeEach(() => {
  history.replaceState(null, '', `/services/${internetId}/policy`);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('UC20 Role Authorization & Session Security', () => {
  it.each(['ADMIN', 'CUSTOMER'])('denies %s without calling policy or building endpoints', async (role) => {
    const api = install(role);
    render(<App />);

    await screen.findByText(catalogMessages.forbidden);
    expect(api.getPolicy).not.toHaveBeenCalled();
    expect(api.getBuildings).not.toHaveBeenCalled();
    expect(screen.queryByText('Thiết lập chính sách dịch vụ')).toBeNull();
  });

  it('waits for session and role verification before calling policy endpoint', async () => {
    const api = install('HOST');
    const gate = deferred<Response>();
    api.me.mockReturnValueOnce(gate.promise);

    render(<App />);
    expect(screen.getByText('Đang kiểm tra phiên đăng nhập')).toBeTruthy();
    expect(api.getPolicy).not.toHaveBeenCalled();

    await act(async () =>
      gate.resolve(
        ok({
          accountId: 'host-1',
          loginName: 'Host',
          role: 'HOST',
          hostId: electricityId,
          customerId: null,
        }),
      ),
    );

    await screen.findByText('Thiết lập chính sách dịch vụ');
    expect(api.getPolicy).toHaveBeenCalled();
  });

  it('redirects to login with session error when session expires on GET', async () => {
    const api = install('HOST');
    api.getPolicy.mockImplementationOnce(async () => failure(401, 'Expired'));
    api.me.mockImplementation(async () => failure(401, 'Expired'));

    render(<App />);
    await screen.findByText(m.sessionInvalid);
    expect(location.pathname).toBe('/');
  });
});

describe('UC20 Navigation, History & Preserved Query Context', () => {
  it('opens from UC19 catalog with preserved q and state', async () => {
    history.replaceState(null, '', '/services?q=Internet&state=active');
    install('HOST');
    render(<App />);

    await screen.findByText('Internet');
    const policyBtn = await screen.findByRole('button', { name: 'Thiết lập chính sách' });
    fireEvent.click(policyBtn);

    await screen.findByRole('rowheader', { name: 'Tòa nhà Landmark' });
    expect(location.pathname).toBe(`/services/${internetId}/policy`);
    expect(new URLSearchParams(location.search).get('q')).toBe('Internet');
    expect(new URLSearchParams(location.search).get('state')).toBe('active');

    // Click "Quay về Danh mục dịch vụ"
    const backLink = screen.getByRole('link', { name: /Quay về Danh mục dịch vụ/i });
    fireEvent.click(backLink);

    await screen.findByText('Internet');
    expect(location.pathname).toBe('/services');
    expect(new URLSearchParams(location.search).get('q')).toBe('Internet');
    expect(new URLSearchParams(location.search).get('state')).toBe('active');
  });

  it('normalizes invalid UUID route to service selection without sending mutation', async () => {
    history.replaceState(null, '', '/services/invalid-uuid/policy?q=test');
    const api = install('HOST');
    render(<App />);

    await screen.findByText(m.invalidRoute);
    expect(location.pathname).toBe('/services/policy');
    expect(new URLSearchParams(location.search).get('q')).toBe('test');
    expect(api.patchPolicy).not.toHaveBeenCalled();
  });

  it('warns on unsaved changes when navigating away or switching service', async () => {
    install('HOST');
    render(<App />);

    const priceInput = await screen.findByRole('textbox', { name: /Đơn giá danh mục/i });

    // Make a change
    fireEvent.change(priceInput, { target: { value: '250000' } });

    // Try to navigate away
    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockReturnValueOnce(false); // Reject navigation

    act(() => goto('/services'));
    expect(confirmSpy).toHaveBeenCalledWith('Bỏ các thay đổi chưa lưu?');
    // Guard prevented navigation, still on policy page
    expect(screen.getByText('Thiết lập chính sách dịch vụ')).toBeTruthy();
  });
});

describe('UC20 Core Features, Strict Presence & Atomic PATCH', () => {
  it('loads policy and displays inherited prices/prorate as read-only', async () => {
    install('HOST');
    render(<App />);

    await screen.findByRole('rowheader', { name: 'Tòa nhà Landmark' });
    expect(screen.getByText('Kế thừa danh mục')).toBeTruthy();
    expect(screen.getByText('Kế thừa')).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'Tòa nhà Sunrise' })).toBeTruthy();
    expect(screen.getByText(/120\.000\s*₫/)).toBeTruthy();
  });

  it('saves combined atomic PATCH with method, price, prorate and buildings', async () => {
    const api = install('HOST');
    render(<App />);

    await screen.findByRole('rowheader', { name: 'Tòa nhà Landmark' });

    // 1. Change price
    const priceInput = screen.getByRole('textbox', { name: /Đơn giá danh mục/i });
    fireEvent.change(priceInput, { target: { value: '150000' } });

    // 2. Change prorate
    const prorateFalseRadio = screen.getByRole('radio', { name: /Không tính ngày lẻ/i });
    fireEvent.click(prorateFalseRadio);

    // 3. Change existing building flag (Sunrise)
    const sunriseFlagNo = document.querySelector(`input[name="existingFlag_${buildingConfig2.buildingId}"][value="false"]`) as HTMLInputElement;
    fireEvent.click(sunriseFlagNo);

    // 4. Add new building
    const addBuildingCheckbox = screen.getByRole('checkbox', { name: /Chung cư Blue Sky/i });
    fireEvent.click(addBuildingCheckbox);

    // Set new building flag
    const newFlagRadio = document.querySelector(`input[name="newFlag_${building3.id}"][value="true"]`) as HTMLInputElement;
    fireEvent.click(newFlagRadio);

    // Click Save
    const saveButton = screen.getByRole('button', { name: 'Lưu chính sách' });
    fireEvent.click(saveButton);

    await screen.findByText(m.saveSuccess);

    expect(api.patchPolicy).toHaveBeenCalledTimes(1);
    const lastCall = api.patchPolicy.mock.calls[0];
    const body = parsePolicyJson(String(lastCall[1].body)) as Record<string, unknown>;

    expect(body.version).toBeDefined();
    expect(body.defaultPrice).toBeDefined();
    expect(body.prorate).toBe(false);
    expect(Array.isArray(body.buildings)).toBe(true);
    expect(body.name).toBeUndefined(); // Strict presence!
    expect(body.unit).toBeUndefined();
    expect(body.active).toBeUndefined();
  });

  it('submits method change only when only method is modified', async () => {
    const api = install('HOST');
    render(<App />);

    await screen.findByRole('rowheader', { name: 'Tòa nhà Landmark' });

    const meteredRadio = screen.getByRole('radio', { name: /Theo đồng hồ/i });
    fireEvent.click(meteredRadio);

    const saveButton = screen.getByRole('button', { name: 'Lưu chính sách' });
    fireEvent.click(saveButton);

    await screen.findByText(m.saveSuccess);

    const body = parsePolicyJson(String(api.patchPolicy.mock.calls[0][1].body)) as Record<string, unknown>;
    expect(body.version).toBeDefined();
    expect(body.method).toBe('METERED');
    expect(body.defaultPrice).toBeUndefined();
    expect(body.prorate).toBeUndefined(); // Excluded when method is not FIXED!
    expect(body.buildings).toBeUndefined();
  });

  it('keeps active=false when UC20 sets first price for unconfigured service', async () => {
    history.replaceState(null, '', `/services/${electricityId}/policy`);
    const api = install('HOST', electricityPolicy);
    render(<App />);

    const priceInput = await screen.findByRole('textbox', { name: /Đơn giá danh mục/i });
    expect(screen.getByText('Chưa thiết lập')).toBeTruthy();

    fireEvent.change(priceInput, { target: { value: '3500' } });

    const saveButton = screen.getByRole('button', { name: 'Lưu chính sách' });
    fireEvent.click(saveButton);

    await screen.findByText(m.saveSuccess);

    const updated = api.getCurrentPolicy();
    expect(updated.service.pricingStatus).toBe('CONFIGURED');
    expect(updated.service.active).toBe(false); // Retains inactive!
  });

  it('locks charge method and explains reason when methodChangeAllowed is false', async () => {
    install('HOST', lockedMethodPolicy);
    render(<App />);

    await screen.findByText(/Dịch vụ đã phát sinh sử dụng hoặc hóa đơn/);

    const fixedRadio = screen.getByRole('radio', { name: /Cố định/i }) as HTMLInputElement;
    expect(fixedRadio.disabled).toBe(true);
  });

  it('handles 409 stale conflict: retains draft and allows manual refresh via latest data', async () => {
    const api = install('HOST');
    render(<App />);

    const priceInput = await screen.findByRole('textbox', { name: /Đơn giá danh mục/i });
    fireEvent.change(priceInput, { target: { value: '180000' } });

    // Mock 409 Stale on PATCH
    api.patchPolicy.mockImplementationOnce(async () => failure(409, m.stale));

    const saveButton = screen.getByRole('button', { name: 'Lưu chính sách' });
    fireEvent.click(saveButton);

    await screen.findByText(m.stale);
    // Draft value is preserved for review
    expect((priceInput as HTMLInputElement).value).toBe('180000');

    // Click "Bắt đầu chỉnh sửa theo dữ liệu mới"
    const applyLatestBtn = await screen.findByRole('button', {
      name: 'Bắt đầu chỉnh sửa theo dữ liệu mới',
    });
    fireEvent.click(applyLatestBtn);

    // Clears conflict error and draft reset to baseline
    expect(screen.queryByText(m.stale)).toBeNull();
  });
});
