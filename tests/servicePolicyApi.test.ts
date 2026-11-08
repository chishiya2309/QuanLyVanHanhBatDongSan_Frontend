import { describe, expect, it, vi } from 'vitest';
import { LosslessNumber, parse } from 'lossless-json';
import {
  decodeBuildingLookupList,
  decodeBuildingServicePolicy,
  decodeServicePolicy,
  encodeUpdateServicePolicyBody,
} from '../src/services/servicePolicyCodec';
import {
  getServicePolicy,
  lookupHostBuildings,
  updateServicePolicy,
} from '../src/services/servicePolicyApi';
import { servicePolicyMessages as m } from '../src/types/servicePolicy';
import {
  building1,
  buildingConfig1,
  buildingConfig2,
  config1Id,
  fixtureBuildings,
  internetPolicy,
  policyReply,
  policyWire,
} from './fixtures/servicePolicy';
import { internetId } from './fixtures/serviceCatalog';
import { failure, ok } from './apiMock';

describe('UC20 Service Policy Codec and Lossless Serialization', () => {
  it('decodes a valid building configuration preserving null as inheritance', () => {
    const raw = {
      configurationId: config1Id,
      buildingId: building1.id,
      buildingName: 'Landmark',
      defaultForNewRoom: true,
      unitPrice: null,
      prorate: null,
      enabled: true,
      currentPriceRevisionId: buildingConfig1.currentPriceRevisionId,
      effectiveFrom: '2026-11-06T07:00:00Z',
    };
    const decoded = decodeBuildingServicePolicy(raw);
    expect(decoded.unitPrice).toBeNull();
    expect(decoded.prorate).toBeNull();
    expect(decoded.defaultForNewRoom).toBe(true);
    expect(decoded.enabled).toBe(true);
  });

  it('decodes explicit 0 unitPrice and false prorate without converting to null', () => {
    const raw = {
      configurationId: config1Id,
      buildingId: building1.id,
      buildingName: 'Landmark',
      defaultForNewRoom: false,
      unitPrice: new LosslessNumber('0'),
      prorate: false,
      enabled: false,
      currentPriceRevisionId: buildingConfig1.currentPriceRevisionId,
      effectiveFrom: '2026-11-06T07:00:00Z',
    };
    const decoded = decodeBuildingServicePolicy(raw);
    expect(decoded.unitPrice).toBe('0');
    expect(decoded.prorate).toBe(false);
    expect(decoded.enabled).toBe(false);
  });

  it('rejects invalid or duplicate building configurations', () => {
    expect(() => decodeBuildingServicePolicy({ invalid: true })).toThrow();
    expect(() =>
      decodeServicePolicy({
        service: policyWire(internetPolicy).service,
        methodChangeAllowed: true,
        prorate: true,
        buildingConfigurations: [buildingConfig1, buildingConfig1], // Duplicate!
      }),
    ).toThrow(/Duplicate building configuration/);
  });

  it('decodes building lookup list and detects duplicate building IDs', () => {
    const list = decodeBuildingLookupList(fixtureBuildings);
    expect(list).toHaveLength(3);
    expect(() => decodeBuildingLookupList([building1, building1])).toThrow(/Duplicate building/);
  });

  it('encodes strict PATCH presence: no nulls, only supplied fields, lossless numbers', () => {
    const body = encodeUpdateServicePolicyBody({
      version: '9007199254740993',
      defaultPrice: '9999999999999999999',
    });
    expect(body).not.toContain('null');
    expect(body).not.toContain('method');
    expect(body).not.toContain('prorate');
    expect(body).not.toContain('buildings');
    expect(body).toContain('"version":9007199254740993');
    expect(body).toContain('"defaultPrice":9999999999999999999');

    const parsed = parse(body) as Record<string, unknown>;
    expect(parsed.version).toBeInstanceOf(LosslessNumber);
    expect(parsed.defaultPrice).toBeInstanceOf(LosslessNumber);
  });

  it('encodes buildings array with exact buildingId and defaultForNewRoom', () => {
    const body = encodeUpdateServicePolicyBody({
      version: '3',
      method: 'FIXED',
      prorate: true,
      buildings: [
        { buildingId: building1.id, defaultForNewRoom: true },
        { buildingId: buildingConfig2.buildingId, defaultForNewRoom: false },
      ],
    });
    expect(body).not.toContain('null');
    const parsed = parse(body) as Record<string, unknown>;
    expect(parsed.method).toBe('FIXED');
    expect(parsed.prorate).toBe(true);
    expect(Array.isArray(parsed.buildings)).toBe(true);
    expect(parsed.buildings).toHaveLength(2);
  });
});

describe('UC20 Service Policy API Client', () => {
  it('fetches service policy snapshot successfully via GET', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(policyReply(policyWire(internetPolicy)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getServicePolicy(internetId);
    expect(result.service.id).toBe(internetId);
    expect(result.methodChangeAllowed).toBe(true);
    expect(result.buildingConfigurations).toHaveLength(2);
  });

  it('handles 404 service not found on GET and PATCH', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(failure(404, m.notFound));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getServicePolicy(internetId)).rejects.toMatchObject({
      status: 404,
      message: m.notFound,
    });
  });

  it('handles 404 building not found message distinction', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/csrf')) return ok({ headerName: 'X-CSRF-TOKEN', token: 'token' });
      return failure(404, m.buildingNotFound);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      updateServicePolicy(internetId, {
        version: '1',
        buildings: [{ buildingId: building1.id, defaultForNewRoom: true }],
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: m.buildingNotFound,
    });
  });

  it('handles 409 conflict types accurately without faking retry', async () => {
    const conflicts = [
      m.stale,
      m.methodLocked,
      m.prorateNotFixed,
      m.inactive,
      m.priceRequired,
      m.timeConflict,
    ];

    for (const conflictMsg of conflicts) {
      const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/auth/csrf')) return ok({ headerName: 'X-CSRF-TOKEN', token: 'token' });
        return failure(409, conflictMsg);
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        updateServicePolicy(internetId, { version: '1', method: 'QUANTITY' }),
      ).rejects.toMatchObject({
        status: 409,
        message: conflictMsg,
      });
    }
  });

  it('parses 400 validation error with indexed building field errors', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/csrf')) return ok({ headerName: 'X-CSRF-TOKEN', token: 'token' });
      return failure(400, m.invalid, {
        'buildings[0].defaultForNewRoom': 'Vui lòng chọn mặc định cho phòng mới',
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      updateServicePolicy(internetId, {
        version: '1',
        buildings: [{ buildingId: building1.id }],
      }),
    ).rejects.toMatchObject({
      status: 400,
      fieldErrors: {
        'buildings[0].defaultForNewRoom': 'Vui lòng chọn mặc định cho phòng mới',
      },
    });
  });

  it('marks network failures on write as phase uncertain', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/csrf')) return ok({ headerName: 'X-CSRF-TOKEN', token: 'token' });
      throw new Error('Network offline');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      updateServicePolicy(internetId, { version: '1', defaultPrice: '50000' }),
    ).rejects.toMatchObject({
      status: 0,
      phase: 'uncertain',
      message: m.uncertain,
    });
  });

  it('fetches host buildings lookup successfully', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok(fixtureBuildings));
    vi.stubGlobal('fetch', fetchMock);

    const buildings = await lookupHostBuildings();
    expect(buildings).toHaveLength(3);
    expect(buildings[0].name).toBe('Tòa nhà Landmark');
  });
});
