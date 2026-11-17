import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyRoomPaymentPolicy,
  getPaymentTargets,
  getRoomPaymentPolicy,
  saveRoomPaymentPolicy,
} from '../src/services/roomPaymentPolicyApi';
import { clearCsrfCache } from '../src/services/csrfClient';
import { invalidateSession, rememberSession } from '../src/services/sessionClient';
import {
  applicableTargets,
  bankSourceId,
  cashSourceId,
  configuredRoomPolicy,
  paymentPolicyReply,
  roomId,
  roomPaymentWire,
  sampleApplication,
  targetRoom1Id,
  targetRoom2Id,
  unconfiguredRoomPolicy,
} from './fixtures/roomPaymentPolicy';

describe('UC42 Room Payment Policy API Client', () => {
  const hostUser = {
    accountId: 'host-1',
    loginName: 'host1',
    role: 'HOST' as const,
    hostId: 'host-uuid-1',
    customerId: null,
  };

  beforeEach(() => {
    rememberSession(hostUser);
    clearCsrfCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    invalidateSession();
    clearCsrfCache();
  });

  describe('getRoomPaymentPolicy', () => {
    it('fetches room payment policy with credentials: include and no-store', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(paymentPolicyReply(roomPaymentWire(configuredRoomPolicy)));
      vi.stubGlobal('fetch', fetchSpy);

      const policy = await getRoomPaymentPolicy(roomId);
      expect(policy.configured).toBe(true);
      expect(policy.roomId).toBe(roomId);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toContain(`/api/v1/rooms/${roomId}/payment-policy`);
      expect(init.credentials).toBe('include');
      expect(init.cache).toBe('no-store');
      expect(init.headers?.Accept).toBe('application/json');
    });

    it('handles 404 Room Not Found', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        status: 404,
        code: 'ROOM_NOT_FOUND',
        message: 'Không tìm thấy phòng',
      }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
      vi.stubGlobal('fetch', fetchSpy);

      await expect(getRoomPaymentPolicy(roomId)).rejects.toMatchObject({
        status: 404,
        code: 'ROOM_NOT_FOUND',
        phase: 'read',
      });
    });

    it('handles 401 Session Invalid', async () => {
      const fetchSpy = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/auth/csrf')) {
          return Promise.resolve(new Response(JSON.stringify({
            status: 200,
            message: 'OK',
            data: { headerName: 'X-CSRF-TOKEN', token: 'token' },
          }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        if (url.endsWith('/auth/me') || url.endsWith('/auth/refresh') || url.includes('/payment-policy')) {
          return Promise.resolve(new Response(JSON.stringify({
            status: 401,
            code: 'UNAUTHORIZED',
          }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
        }
        return Promise.reject(new Error('Unexpected fetch call: ' + url));
      });
      vi.stubGlobal('fetch', fetchSpy);

      await expect(getRoomPaymentPolicy(roomId)).rejects.toMatchObject({
        status: 401,
        code: 'SESSION_INVALID',
      });
    });

    it('handles 403 Forbidden', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        status: 403,
        code: 'FORBIDDEN',
      }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
      vi.stubGlobal('fetch', fetchSpy);

      await expect(getRoomPaymentPolicy(roomId)).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
      });
    });

    it('aborts request on AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();
      const fetchSpy = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
      vi.stubGlobal('fetch', fetchSpy);

      await expect(getRoomPaymentPolicy(roomId, controller.signal)).rejects.toThrow();
    });
  });

  describe('saveRoomPaymentPolicy (PUT)', () => {
    it('obtains CSRF token and issues PUT request with X-CSRF-TOKEN and payload', async () => {
      const calls: { url: string; method?: string; headers?: Record<string, string>; body?: string }[] = [];
      const fetchSpy = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, method: init?.method, headers: init?.headers as Record<string, string>, body: init?.body as string });
        if (url.endsWith('/auth/csrf')) {
          return Promise.resolve(new Response(JSON.stringify({
            status: 200,
            message: 'OK',
            data: { headerName: 'X-CSRF-TOKEN', token: 'csrf-secret-123' },
          }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        if (url.includes(`/rooms/${roomId}/payment-policy`) && init?.method === 'PUT') {
          return Promise.resolve(paymentPolicyReply(roomPaymentWire(configuredRoomPolicy)));
        }
        return Promise.reject(new Error('Unexpected fetch call: ' + url));
      });
      vi.stubGlobal('fetch', fetchSpy);

      const draft = {
        allowCash: true,
        allowTransfer: true,
        cashDefaultId: cashSourceId,
        bankDefaultId: bankSourceId,
      };

      const result = await saveRoomPaymentPolicy(unconfiguredRoomPolicy, draft);
      expect(result.configured).toBe(true);

      const putCall = calls.find(c => c.method === 'PUT');
      expect(putCall).toBeDefined();
      expect(putCall?.headers?.['X-CSRF-TOKEN']).toBe('csrf-secret-123');
      expect(putCall?.headers?.['Content-Type']).toBe('application/json');
      expect(putCall?.body).toContain('"allowCash":true');
      expect(putCall?.body).toContain('"allowTransfer":true');
      expect(putCall?.body).toContain('"version":null');
    });

    it('handles 400 validation error with fieldErrors', async () => {
      const fetchSpy = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/auth/csrf')) {
          return Promise.resolve(new Response(JSON.stringify({
            status: 200,
            message: 'OK',
            data: { headerName: 'X-CSRF-TOKEN', token: 'token' },
          }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return Promise.resolve(new Response(JSON.stringify({
          status: 400,
          code: 'PAYMENT_POLICY_INVALID_DATA',
          message: 'Dữ liệu không hợp lệ',
          fieldErrors: { cashDefaultId: 'Nguồn tiền ngừng hoạt động' },
        }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
      });
      vi.stubGlobal('fetch', fetchSpy);

      const draft = {
        allowCash: true,
        allowTransfer: false,
        cashDefaultId: cashSourceId,
        bankDefaultId: null,
      };

      await expect(saveRoomPaymentPolicy(configuredRoomPolicy, draft)).rejects.toMatchObject({
        status: 400,
        fieldErrors: { cashDefaultId: 'Nguồn tiền ngừng hoạt động' },
        phase: 'write',
      });
    });

    it('handles 409 conflict when policy version is stale', async () => {
      const fetchSpy = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/auth/csrf')) {
          return Promise.resolve(new Response(JSON.stringify({
            status: 200,
            message: 'OK',
            data: { headerName: 'X-CSRF-TOKEN', token: 'token' },
          }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return Promise.resolve(new Response(JSON.stringify({
          status: 409,
          code: 'PAYMENT_POLICY_VERSION_STALE',
          message: 'Cấu hình thanh toán đã thay đổi.',
        }), { status: 409, headers: { 'Content-Type': 'application/json' } }));
      });
      vi.stubGlobal('fetch', fetchSpy);

      const draft = {
        allowCash: true,
        allowTransfer: false,
        cashDefaultId: cashSourceId,
        bankDefaultId: null,
      };

      await expect(saveRoomPaymentPolicy(configuredRoomPolicy, draft)).rejects.toMatchObject({
        status: 409,
        phase: 'write',
      });
    });

    it('handles 403 CSRF error and sets phase to write and code CSRF_INVALID', async () => {
      const fetchSpy = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/auth/csrf')) {
          return Promise.resolve(new Response(JSON.stringify({
            status: 200,
            message: 'OK',
            data: { headerName: 'X-CSRF-TOKEN', token: 'token' },
          }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return Promise.resolve(new Response(JSON.stringify({
          status: 403,
          code: 'CSRF_INVALID',
          message: 'Invalid CSRF token',
        }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
      });
      vi.stubGlobal('fetch', fetchSpy);

      const draft = {
        allowCash: true,
        allowTransfer: false,
        cashDefaultId: cashSourceId,
        bankDefaultId: null,
      };

      await expect(saveRoomPaymentPolicy(configuredRoomPolicy, draft)).rejects.toMatchObject({
        status: 403,
        code: 'CSRF_INVALID',
      });
    });

    it('classifies unparseable 500 error during mutation as uncertain', async () => {
      const fetchSpy = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/auth/csrf')) {
          return Promise.resolve(new Response(JSON.stringify({
            status: 200,
            message: 'OK',
            data: { headerName: 'X-CSRF-TOKEN', token: 'token' },
          }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return Promise.resolve(new Response('Internal Server Error 500 HTML', { status: 500 }));
      });
      vi.stubGlobal('fetch', fetchSpy);

      const draft = {
        allowCash: true,
        allowTransfer: false,
        cashDefaultId: cashSourceId,
        bankDefaultId: null,
      };

      await expect(saveRoomPaymentPolicy(configuredRoomPolicy, draft)).rejects.toMatchObject({
        status: 500,
        phase: 'uncertain',
      });
    });
  });

  describe('getPaymentTargets', () => {
    it('fetches applicable rooms for the source room', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(paymentPolicyReply(applicableTargets.map(t => roomPaymentWire(t))));
      vi.stubGlobal('fetch', fetchSpy);

      const targets = await getPaymentTargets(configuredRoomPolicy);
      expect(targets).toHaveLength(2);
      expect(targets[0].roomId).toBe(targetRoom1Id);
      expect(targets[1].roomId).toBe(targetRoom2Id);
    });
  });

  describe('applyRoomPaymentPolicy (POST)', () => {
    it('sends POST /applications with applyToAll=false and selected roomIds', async () => {
      const calls: { url: string; method?: string; body?: string }[] = [];
      const fetchSpy = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, method: init?.method, body: init?.body as string });
        if (url.endsWith('/auth/csrf')) {
          return Promise.resolve(new Response(JSON.stringify({
            status: 200,
            message: 'OK',
            data: { headerName: 'X-CSRF-TOKEN', token: 'token' },
          }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        if (url.includes('/applications') && init?.method === 'POST') {
          return Promise.resolve(paymentPolicyReply(sampleApplication));
        }
        return Promise.reject(new Error('Unexpected fetch call: ' + url));
      });
      vi.stubGlobal('fetch', fetchSpy);

      const res = await applyRoomPaymentPolicy(configuredRoomPolicy, false, [targetRoom1Id, targetRoom2Id]);
      expect(res.count).toBe(2);
      expect(res.rooms).toHaveLength(2);

      const postCall = calls.find(c => c.method === 'POST');
      expect(postCall).toBeDefined();
      expect(postCall?.body).toContain('"applyToAll":false');
      expect(postCall?.body).toContain(targetRoom1Id);
      expect(postCall?.body).toContain('"confirmed":true');
      expect(postCall?.body).toContain('"sourcePolicyVersion":0');
    });

    it('sends POST /applications with applyToAll=true (omitting roomIds)', async () => {
      const calls: { url: string; method?: string; body?: string }[] = [];
      const fetchSpy = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, method: init?.method, body: init?.body as string });
        if (url.endsWith('/auth/csrf')) {
          return Promise.resolve(new Response(JSON.stringify({
            status: 200,
            message: 'OK',
            data: { headerName: 'X-CSRF-TOKEN', token: 'token' },
          }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        if (url.includes('/applications') && init?.method === 'POST') {
          return Promise.resolve(paymentPolicyReply(sampleApplication));
        }
        return Promise.reject(new Error('Unexpected fetch call: ' + url));
      });
      vi.stubGlobal('fetch', fetchSpy);

      const res = await applyRoomPaymentPolicy(configuredRoomPolicy, true, []);
      expect(res.count).toBe(2);

      const postCall = calls.find(c => c.method === 'POST');
      expect(postCall?.body).toContain('"applyToAll":true');
      expect(postCall?.body).not.toContain('roomIds');
    });
  });
});
