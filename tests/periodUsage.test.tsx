import React, { useCallback, useRef, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PeriodUsagePage, UsageForbidden } from '../src/components/usage/PeriodUsagePage';
import { parsePeriodUsageRoute, periodUsageUrl } from '../src/utils/periodUsageNavigation';
import type { PeriodUsageRoute, UsageContext } from '../src/types/periodUsage';

const mockBuildingId = '11111111-1111-4111-8111-111111111111';
const mockRoomId = '22222222-2222-4222-8222-222222222222';
const mockPeriodId = '33333333-3333-4333-8333-333333333333';
const mockRoomServiceId = '44444444-4444-4444-8444-444444444444';

const sampleContext: UsageContext = {
  periodId: mockPeriodId,
  roomId: mockRoomId,
  roomCode: 'P.102',
  buildingId: mockBuildingId,
  buildingName: 'Tòa Nhà Thảo Điền',
  fromDate: '2026-05-01',
  toDate: '2026-05-31',
  cycleStart: '2026-05-01',
  cycleEnd: '2026-05-31',
  periodStatus: 'OPEN',
  invoiceStatus: 'NONE',
  canRecord: true,
  concurrencyVersion: 'etag-abc-123',
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
  customServices: [
    {
      roomServiceId: '55555555-5555-4555-8555-555555555555',
      serviceName: 'Dọn phòng đặc biệt',
      unit: 'lần',
      isRecorded: false,
      recordedAmount: null
    }
  ],
  existingUsages: [],
  existingAdjustments: []
};

function setupHarness(initialRoute: PeriodUsageRoute, fetchOverride?: typeof window.fetch) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const expired = vi.fn();

  const defaultFetch = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = String(input);
    const method = init?.method || 'GET';
    const body = init?.body ? String(init.body) : undefined;
    calls.push({ url: urlStr, method, body });

    if (urlStr.includes('/auth/csrf')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { token: 'mock-csrf', headerName: 'X-CSRF-TOKEN' } })
      });
    }

    if (urlStr.includes('/properties') || urlStr.includes('/buildings')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({
          status: 200,
          message: 'OK',
          data: [{ id: mockBuildingId, name: 'Tòa Nhà Thảo Điền' }]
        }))
      });
    }

    if (urlStr.includes('/usage-context')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({
          status: 200,
          message: 'Tải bối cảnh thành công',
          data: sampleContext
        }))
      });
    }

    if (urlStr.includes('/service-usages/quantity')) {
      return Promise.resolve({
        ok: true,
        status: 201,
        text: () => Promise.resolve(JSON.stringify({
          status: 201,
          message: 'Ghi nhận số lượng thành công',
          data: {
            id: '66666666-6666-4666-8666-666666666666',
            periodId: mockPeriodId,
            roomServiceId: mockRoomServiceId,
            serviceName: 'Nước đóng bình',
            quantity: '3.5',
            manualAmount: null,
            recordedAt: '2026-05-15T10:00:00Z'
          }
        }))
      });
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ status: 200, message: 'OK', data: [] }))
    });
  });

  vi.stubGlobal('fetch', fetchOverride || defaultFetch);

  function Harness() {
    const [route, setRoute] = useState(initialRoute);
    const guard = useRef<(() => boolean) | null>(null);
    const registerGuard = useCallback((next: (() => boolean) | null) => { guard.current = next; }, []);

    return (
      <PeriodUsagePage
        route={route}
        registerGuard={registerGuard}
        onSessionExpired={expired}
        onNavigate={(url) => {
          if (guard.current?.() === false) return;
          const target = new URL(url, 'http://localhost');
          setRoute(parsePeriodUsageRoute(target.pathname, target.search)!);
        }}
      />
    );
  }

  const result = render(<Harness />);
  return { ...result, calls, expired };
}

describe('UC38 Frontend Component Integration', () => {
  it('renders UsageForbidden correctly when unauthorized', async () => {
    const backMock = vi.fn();
    render(<UsageForbidden onBack={backMock} />);
    expect(screen.getByText('Ghi nhận số lượng, phí và giảm trừ theo kỳ')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Chỉ Host mới có quyền truy cập chức năng này.');
    const backBtn = screen.getByRole('button', { name: 'Về trang tổng quan' });
    await userEvent.click(backBtn);
    expect(backMock).toHaveBeenCalledTimes(1);
  });

  it('renders workbench with empty state when period is not yet selected', async () => {
    const initialRoute: PeriodUsageRoute = {
      buildingId: '',
      roomId: '',
      periodId: '',
      tab: 'quantity',
      invalid: false
    };

    setupHarness(initialRoute);
    expect(await screen.findByText('Vui lòng chọn tòa nhà, phòng và nhập ID kỳ tính phí cần ghi nhận.')).toBeTruthy();
  });

  it('loads and renders usage context for selected period with all tabs accessible', async () => {
    const initialRoute: PeriodUsageRoute = {
      buildingId: mockBuildingId,
      roomId: mockRoomId,
      periodId: mockPeriodId,
      tab: 'quantity',
      invalid: false
    };

    setupHarness(initialRoute);

    // Context details displayed in header
    expect(await screen.findByText(/Tòa Nhà Thảo Điền - Phòng P\.102/)).toBeTruthy();
    expect(await screen.findByText(/01\/05\/2026/)).toBeTruthy();

    // Verify tabs are available
    expect(screen.getByRole('tab', { name: /Dịch vụ số lượng/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Dịch vụ nhập phí/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Phí phát sinh/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Khoản giảm trừ/ })).toBeTruthy();

    // In quantity tab, table shows unrecorded service
    expect(screen.getByText('Nước đóng bình')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lưu số lượng' })).toBeTruthy();
  });

  it('requires explicit confirmation checkbox when inputting zero quantity', async () => {
    const initialRoute: PeriodUsageRoute = {
      buildingId: mockBuildingId,
      roomId: mockRoomId,
      periodId: mockPeriodId,
      tab: 'quantity',
      invalid: false
    };

    setupHarness(initialRoute);

    await screen.findByText('Nước đóng bình');
    const input = screen.getByLabelText(/Số lượng sử dụng/i);

    // Type 0
    await userEvent.clear(input);
    await userEvent.type(input, '0');

    // Confirmation message appears
    expect(await screen.findByText('Xác nhận số lượng sử dụng là 0')).toBeTruthy();
    const checkbox = screen.getByRole('checkbox', { name: 'Xác nhận số lượng sử dụng là 0' }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    // Submit button should be disabled when 0 is not confirmed
    const saveButton = screen.getByRole('button', { name: 'Lưu số lượng' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    // Check the box
    await userEvent.click(checkbox);
    expect(saveButton.disabled).toBe(false);
  });

  it('records valid positive quantity and updates row to read-only badge', async () => {
    const initialRoute: PeriodUsageRoute = {
      buildingId: mockBuildingId,
      roomId: mockRoomId,
      periodId: mockPeriodId,
      tab: 'quantity',
      invalid: false
    };

    const { calls } = setupHarness(initialRoute);

    await screen.findByText('Nước đóng bình');
    const input = screen.getByLabelText(/Số lượng sử dụng/i);

    // Type 3.5
    await userEvent.clear(input);
    await userEvent.type(input, '3.5');

    const saveButton = screen.getByRole('button', { name: 'Lưu số lượng' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);

    await userEvent.click(saveButton);

    // Wait for success notice
    expect(await screen.findByText('Ghi nhận số lượng dịch vụ thành công.')).toBeTruthy();

    // Verify POST payload contains exact quantity
    const postCall = calls.find((c) => c.url.includes('/service-usages/quantity') && c.method === 'POST');
    expect(postCall).toBeTruthy();
    expect(postCall?.body).toContain('"quantity":3.5');
  });

  it('renders locked banner and disables all actions when period is SEALED', async () => {
    const sealedContext: UsageContext = {
      ...sampleContext,
      periodStatus: 'SEALED',
      canRecord: false
    };

    const sealedFetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes('/usage-context')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({
            status: 200,
            message: 'OK',
            data: sealedContext
          }))
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ status: 200, message: 'OK', data: [] }))
      });
    });

    const initialRoute: PeriodUsageRoute = {
      buildingId: mockBuildingId,
      roomId: mockRoomId,
      periodId: mockPeriodId,
      tab: 'quantity',
      invalid: false
    };

    setupHarness(initialRoute, sealedFetch);

    // Locked banner is displayed
    expect(await screen.findByText(/Kỳ tính tiền đã khóa \(SEALED\)/)).toBeTruthy();

    // Action button disabled
    const saveButton = screen.getByRole('button', { name: 'Lưu số lượng' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });
});
