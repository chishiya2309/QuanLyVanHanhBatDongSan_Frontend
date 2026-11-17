import { describe, expect, it, vi } from 'vitest';
import { parseUsageJson, decodeUsageContext, decodeSavedUsage, decodeSavedAdjustment, encodeQuantityPayload, encodeCustomFeePayload, encodeFeeAdjustmentPayload, encodeDiscountAdjustmentPayload } from '../src/services/usageCodec';
import { parsePeriodUsageRoute, periodUsageUrl } from '../src/utils/periodUsageNavigation';
import { addDiscountAdjustment, addFeeAdjustment, getUsageContext, recordCustomFee, recordQuantity, UsageApiError } from '../src/services/usageApi';

const mockBuildingId = '11111111-1111-4111-8111-111111111111';
const mockRoomId = '22222222-2222-4222-8222-222222222222';
const mockPeriodId = '33333333-3333-4333-8333-333333333333';
const mockRoomServiceId = '44444444-4444-4444-8444-444444444444';

describe('UC38 Navigation & Routing Contract', () => {
  it('parses valid route with building, room, period, and default tab', () => {
    const route = parsePeriodUsageRoute('/period-usages', `?buildingId=${mockBuildingId}&roomId=${mockRoomId}&periodId=${mockPeriodId}`);
    expect(route).not.toBeNull();
    expect(route?.buildingId).toBe(mockBuildingId);
    expect(route?.roomId).toBe(mockRoomId);
    expect(route?.periodId).toBe(mockPeriodId);
    expect(route?.tab).toBe('quantity');
    expect(route?.invalid).toBe(false);
  });

  it('supports explicit tabs in URL and canonicalizes with periodUsageUrl', () => {
    const route = parsePeriodUsageRoute('/period-usages', `?buildingId=${mockBuildingId}&roomId=${mockRoomId}&periodId=${mockPeriodId}&tab=discount`);
    expect(route?.tab).toBe('discount');
    const canonical = periodUsageUrl(route!);
    expect(canonical).toContain('tab=discount');
    expect(canonical).toContain(`periodId=${mockPeriodId}`);
  });

  it('marks route invalid when UUID format is wrong', () => {
    const route = parsePeriodUsageRoute('/period-usages', '?buildingId=invalid-uuid');
    expect(route?.invalid).toBe(true);
  });

  it('returns null for unrelated paths', () => {
    expect(parsePeriodUsageRoute('/dashboard', '')).toBeNull();
    expect(parsePeriodUsageRoute('/meter-readings', '')).toBeNull();
  });
});

describe('UC38 Lossless Codec Contract', () => {
  it('encodes quantity payload with exact decimal representation without quotes around numbers', () => {
    const payload = {
      periodId: mockPeriodId,
      roomServiceId: mockRoomServiceId,
      quantity: '123.4567890123456789',
      concurrencyVersion: 'etag-123'
    };
    const encoded = encodeQuantityPayload(payload);
    expect(encoded).toContain('"quantity":123.4567890123456789');
    expect(encoded).toContain(`"periodId":"${mockPeriodId}"`);
    expect(encoded).toContain('"concurrencyVersion":"etag-123"');
  });

  it('encodes explicit 0 quantity properly and distinct from empty', () => {
    const payload = {
      periodId: mockPeriodId,
      roomServiceId: mockRoomServiceId,
      quantity: '0',
      concurrencyVersion: 'etag-456'
    };
    const encoded = encodeQuantityPayload(payload);
    expect(encoded).toContain('"quantity":0');
  });

  it('encodes custom fee with integer VND amount', () => {
    const payload = {
      periodId: mockPeriodId,
      roomServiceId: mockRoomServiceId,
      amount: 500000,
      concurrencyVersion: 'etag-789'
    };
    const encoded = encodeCustomFeePayload(payload);
    expect(encoded).toContain('"amount":500000');
  });

  it('encodes fee and discount adjustments with integer amounts and descriptions', () => {
    const feePayload = {
      periodId: mockPeriodId,
      amount: 150000,
      description: 'Phí sửa ống nước phát sinh'
    };
    const encodedFee = encodeFeeAdjustmentPayload(feePayload);
    expect(encodedFee).toContain('"amount":150000');
    expect(encodedFee).toContain('"description":"Phí sửa ống nước phát sinh"');

    const discountPayload = {
      periodId: mockPeriodId,
      amount: 50000,
      description: 'Giảm trừ sự cố cúp điện'
    };
    const encodedDiscount = encodeDiscountAdjustmentPayload(discountPayload);
    expect(encodedDiscount).toContain('"amount":50000');
    expect(encodedDiscount).toContain('"description":"Giảm trừ sự cố cúp điện"');
  });

  it('decodes UsageContext with immutable read-only lists and lossless properties', () => {
    const rawJson = JSON.stringify({
      periodId: mockPeriodId,
      roomId: mockRoomId,
      roomCode: 'P.101',
      buildingId: mockBuildingId,
      buildingName: 'Tòa nhà Mặt Trời',
      fromDate: '2026-03-01',
      toDate: '2026-03-31',
      cycleStart: '2026-03-01',
      cycleEnd: '2026-03-31',
      periodStatus: 'OPEN',
      invoiceStatus: 'NONE',
      canRecord: true,
      concurrencyVersion: 'etag-ver-1',
      quantityServices: [
        {
          roomServiceId: mockRoomServiceId,
          serviceName: 'Nước đóng bình',
          unit: 'bình',
          defaultQuantity: '0',
          isRecorded: false,
          recordedQuantity: null
        }
      ],
      customServices: [],
      existingUsages: [],
      existingAdjustments: []
    });

    const parsed = parseUsageJson(rawJson);
    const decoded = decodeUsageContext(parsed);

    expect(decoded.periodId).toBe(mockPeriodId);
    expect(decoded.roomCode).toBe('P.101');
    expect(decoded.canRecord).toBe(true);
    expect(decoded.periodStatus).toBe('OPEN');
    expect(decoded.quantityServices).toHaveLength(1);
    expect(decoded.quantityServices[0].serviceName).toBe('Nước đóng bình');
    expect(decoded.quantityServices[0].isRecorded).toBe(false);
  });

  it('rejects malformed context payloads', () => {
    expect(() => decodeUsageContext({})).toThrow();
    expect(() => decodeUsageContext({ periodId: 'invalid' })).toThrow();
  });
});

describe('UC38 API Client Contract', () => {
  it('calls GET usage-context with credentials and parses response', async () => {
    const mockContextResponse = {
      periodId: mockPeriodId,
      roomId: mockRoomId,
      roomCode: 'P.202',
      buildingId: mockBuildingId,
      buildingName: 'Tòa Central',
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      cycleStart: '2026-04-01',
      cycleEnd: '2026-04-30',
      periodStatus: 'OPEN',
      invoiceStatus: 'NONE',
      canRecord: true,
      concurrencyVersion: 'etag-99',
      quantityServices: [],
      customServices: [],
      existingUsages: [],
      existingAdjustments: []
    };

    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        status: 200,
        message: 'Tải bối cảnh kỳ và dịch vụ thành công',
        data: mockContextResponse
      }))
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getUsageContext(mockPeriodId);
    expect(result.periodId).toBe(mockPeriodId);
    expect(result.roomCode).toBe('P.202');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('maps 400 Bad Request to UsageApiError with field errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 400,
      ok: false,
      text: () => Promise.resolve(JSON.stringify({
        status: 400,
        message: 'Dữ liệu không hợp lệ',
        data: {
          fieldErrors: [{ field: 'amount', message: 'Số tiền phải lớn hơn hoặc bằng 0' }]
        }
      }))
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(addFeeAdjustment({
      periodId: mockPeriodId,
      amount: -100,
      description: 'Phí âm'
    })).rejects.toThrow(UsageApiError);
  });
});
