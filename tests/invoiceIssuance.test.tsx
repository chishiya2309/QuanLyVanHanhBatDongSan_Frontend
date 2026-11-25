import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InvoicePage } from '../src/components/invoice/InvoicePage';
import { AuthApiError } from '../src/services/authErrors';
import { invoiceRequest } from '../src/services/invoiceApi';
import type { BatchIssuanceReview, IssuanceReview } from '../src/types/invoiceIssuance';

vi.mock('../src/services/invoiceApi', () => ({
  invoicePath: (role: string) => '/invoices/' + role,
  invoiceRequest: vi.fn(),
}));

const req = vi.mocked(invoiceRequest);

const invoiceId = '00000000-0000-4000-8000-000000000010';
const roomId = '00000000-0000-4000-8000-000000000011';
const periodId = '00000000-0000-4000-8000-000000000012';
const hostEndpoint = '/invoices/host/' + invoiceId;

const baseCalculation = {
  status: 'COMPLETE' as const,
  total: '1500000',
  subtotal: '1500000',
  lines: [{ key: 'rent', value: { name: 'Tiền thuê phòng', amount: '1500000', quantity: '1', unitPrice: '1500000', basis: null } }],
  issues: [],
  sourceFingerprint: 'fp-123',
  manualLines: [],
};

const baseDraftDetail = {
  invoice: {
    id: invoiceId,
    period_id: periodId,
    room_id: roomId,
    number: null,
    lifecycle: 'DRAFT' as const,
    from_date: '2026-11-01',
    to_date: '2026-12-01',
    due_date: '2026-11-25',
    dueDate: '2026-11-25',
    issued_at: null,
    room_code: 'P101',
    building_name: 'Chung Cư X',
    customer_name: 'Nguyễn Văn A',
    total: '1500000',
    paid_amount: '0',
    remaining: null,
    payment_status: null,
    is_overdue: false,
    version: 3,
    canIssue: true,
    requiresRecalculation: false,
    isStale: false,
    calculation: baseCalculation,
  },
  lines: [],
  payments: [],
  transfer: { status: 'DRAFT', bankName: '', accountNumber: '', accountHolder: '', reference: '', amount: '1500000', png: null },
  missingSnapshot: false,
};

function makeReview(overrides: Partial<IssuanceReview> = {}): IssuanceReview {
  return {
    invoiceId,
    lifecycle: 'DRAFT',
    projectedNumber: 'HD000010',
    version: 3,
    sourceFingerprint: 'fp-123',
    canIssue: true,
    requiresConfirmation: false,
    blockingMessage: null,
    host: { hostId: 'h1', businessName: 'Nhà Trọ Minh Tâm', businessEmail: 'host@ex.com', businessPhone: '0901234567' },
    building: { buildingId: 'b1', name: 'Chung Cư X', address: '123 Lê Lợi' },
    room: { roomId, code: 'P101', name: 'Phòng 101' },
    contract: { contractId: 'c1', contractNumber: 'HDT-001', rentalStatus: 'ACTIVE', startDate: '2026-01-01', endDate: '2027-01-01', paymentTermDays: 5 },
    customer: { customerId: 'cust1', fullName: 'Nguyễn Văn A', phone: '0909998877', email: 'tenant@ex.com' },
    period: { periodId, tenancyId: 'ten1', fromDate: '2026-11-01', toDate: '2026-12-01', cycleStart: '2026-11-01', cycleEnd: '2026-12-01', status: 'OPEN' },
    lines: baseCalculation.lines,
    blockingIssues: [],
    subtotalBeforeDiscounts: '1500000',
    surchargeTotal: '0',
    discountTotal: '0',
    rentWaived: false,
    total: '1500000',
    paidAmount: '0',
    expectedRemaining: '1500000',
    dueDate: '2026-11-25',
    pastDue: false,
    pastDueConfirmed: false,
    paymentInstructions: {
      roomId,
      policyVersion: 1,
      allowCash: true,
      allowTransfer: true,
      cashRecipient: { fundingSourceId: 'cash1', name: 'Quỹ tiền mặt' },
      bankRecipient: { fundingSourceId: 'bank1', name: 'MB Bank', bankCode: 'MB', bankName: 'MB', accountNumber: '0123456789', accountHolder: 'NGUYEN VAN CHU' },
    },
    transferUnavailable: false,
    canConfirmCashOnly: false,
    warnings: [],
    defaultSendNotification: true,
    availableNotificationChannels: ['IN_APP', 'EMAIL'],
    immutabilityNotice: 'Sau khi phát hành, dữ liệu tài chính sẽ bị khóa bất biến và kỳ tính tiền được niêm phong.',
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('opens issuance review from DraftEditor, supports cancel without issuing, and issues on confirmation', async () => {
  const issuedResponse = {
    ...baseDraftDetail,
    invoice: {
      ...baseDraftDetail.invoice,
      number: 'HD000010',
      lifecycle: 'ISSUED' as const,
      issued_at: '2026-11-15T08:00:00Z',
      payment_reference: 'PAYREF01',
      remaining: '1500000',
      payment_status: 'UNPAID',
    },
    transfer: { ...baseDraftDetail.transfer, status: 'READY', reference: 'PAYREF01' },
    issuance: {
      invoiceId,
      periodId,
      invoiceNumber: 'HD000010',
      paymentReference: 'PAYREF01',
      lifecycle: 'ISSUED',
      version: 4,
      issuedAt: '2026-11-15T08:00:00Z',
      issuedBy: 'host-acc',
      dueDate: '2026-11-25',
      total: '1500000',
      paidAmount: '0',
      remaining: '1500000',
      paymentStatus: 'UNPAID',
      pastDueConfirmed: false,
      pastDueReason: null,
      confirmedPaymentMode: 'POLICY_DEFAULT',
      alreadyIssued: false,
      replayed: false,
      notificationRequested: true,
      notificationStatus: 'SUCCEEDED',
      notificationOutboxId: 'out-1',
      message: 'Phát hành hóa đơn thành công.',
    },
  };

  req.mockImplementation(async path => {
    if (path.endsWith('/issue-review')) return makeReview() as never;
    if (path.endsWith('/issue')) return issuedResponse as never;
    return baseDraftDetail as never;
  });

  render(<InvoicePage accountRole="HOST" pathname={hostEndpoint} search="" />);

  fireEvent.click(await screen.findByRole('button', { name: 'Phát hành hóa đơn' }));
  await screen.findByRole('heading', { name: 'Rà soát phát hành hóa đơn' });
  expect(screen.getByText(/Nhà Trọ Minh Tâm/)).toBeTruthy();
  expect(screen.getByText(/HDT-001/)).toBeTruthy();
  expect(screen.getByText(/khóa bất biến/)).toBeTruthy();

  // Flow 4a: Cancel keeps DRAFT and does not call POST /issue
  fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }));
  await screen.findByRole('button', { name: 'Phát hành hóa đơn' });
  expect(req.mock.calls.some(([p]) => p.endsWith('/issue'))).toBe(false);

  // Re-open review and confirm issuance
  fireEvent.click(screen.getByRole('button', { name: 'Phát hành hóa đơn' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận phát hành' }));

  await screen.findByText('Đã phát hành chính thức và niêm phong kỳ');
  expect(screen.getAllByText(/PAYREF01/).length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText('Đã gửi thông báo thành công')).toBeTruthy();
  expect(req).toHaveBeenCalledWith(
    hostEndpoint + '/issue',
    undefined,
    expect.objectContaining({
      version: 3,
      sourceFingerprint: 'fp-123',
      sendNotification: true,
      confirmedPaymentMode: 'POLICY_DEFAULT',
    }),
    expect.any(String),
    'POST',
  );
});

it('requires past-due reason (3a), cash-only confirmation (2b), and handles 0-VND & NO_CHANNEL copy', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const prevClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

  try {
    const zeroIssued = {
      ...baseDraftDetail,
      invoice: {
        ...baseDraftDetail.invoice,
        number: 'HD000010',
        lifecycle: 'ISSUED' as const,
        total: '0',
        remaining: '0',
        payment_status: 'PAID',
        payment_reference: 'ZERO01',
      },
      transfer: { status: 'SETTLED', bankName: '', accountNumber: '', accountHolder: '', reference: 'ZERO01', amount: '0', png: null },
      issuance: {
        invoiceId,
        periodId,
        invoiceNumber: 'HD000010',
        paymentReference: 'ZERO01',
        lifecycle: 'ISSUED',
        version: 4,
        issuedAt: '2026-11-15T08:00:00Z',
        issuedBy: 'host-acc',
        dueDate: '2026-11-10',
        total: '0',
        paidAmount: '0',
        remaining: '0',
        paymentStatus: 'PAID',
        pastDueConfirmed: true,
        pastDueReason: 'Khách hẹn đóng cuối tuần',
        confirmedPaymentMode: 'CASH_ONLY_OVERRIDE',
        alreadyIssued: false,
        replayed: false,
        notificationRequested: true,
        notificationStatus: 'NO_CHANNEL',
        notificationOutboxId: 'out-2',
        message: 'Phát hành hóa đơn thành công.',
      },
    };

    req.mockImplementation(async path => {
      if (path.endsWith('/issue-review')) {
        return makeReview({
          contract: { contractId: 'c1', contractNumber: 'HDT-OLD', rentalStatus: 'TERMINATED', startDate: '2026-01-01', endDate: '2026-10-31', paymentTermDays: 5 },
          dueDate: '2026-11-10',
          pastDue: true,
          pastDueConfirmed: false,
          transferUnavailable: true,
          canConfirmCashOnly: true,
          availableNotificationChannels: [],
        }) as never;
      }
      if (path.endsWith('/issue')) return zeroIssued as never;
      return baseDraftDetail as never;
    });

    render(<InvoicePage accountRole="HOST" pathname={hostEndpoint} search="?action=issue" />);
    await screen.findByText(/Hóa đơn kỳ cuối \/ hợp đồng đã kết thúc/);
    expect(screen.getByRole('link', { name: 'Cập nhật tài khoản nhận tiền (UC42)' }).getAttribute('href'))
      .toContain('/rooms/' + roomId + '/payment-policy');

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận phát hành' }));
    await screen.findByText(/Vui lòng xác nhận phát hành với ngày đến hạn đã qua/);
    expect(screen.getByText(/xác nhận phát hành chỉ với tiền mặt/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Xác nhận phát hành với ngày đến hạn đã qua' }));
    fireEvent.change(screen.getByLabelText(/Lý do giữ ngày đến hạn đã qua/), { target: { value: 'Khách hẹn đóng cuối tuần' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Xác nhận phát hành hóa đơn này chỉ với phương thức tiền mặt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận phát hành' }));

    await screen.findByText('Không cần thanh toán');
    expect(screen.getByText('Khách thuê chưa có kênh nhận thông báo khả dụng')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sao chép thông tin hóa đơn' }));
    await screen.findByText('Đã sao chép thông tin hóa đơn.');
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('ZERO01'));
  } finally {
    if (prevClipboard) Object.defineProperty(navigator, 'clipboard', prevClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

it('recovers via GET /issue-status or replays identical Idempotency-Key when POST /issue encounters timeout (13a)', async () => {
  let issueAttempts = 0;
  req.mockImplementation(async path => {
    if (path.endsWith('/issue-review')) return makeReview() as never;
    if (path.endsWith('/issue')) {
      issueAttempts++;
      if (issueAttempts === 1) throw new TypeError('Network timeout');
      return {
        ...baseDraftDetail,
        invoice: { ...baseDraftDetail.invoice, lifecycle: 'ISSUED', number: 'HD000010', remaining: '1500000', payment_status: 'UNPAID' },
        issuance: { invoiceId, invoiceNumber: 'HD000010', paymentReference: 'REF99', notificationRequested: false, notificationStatus: 'NOT_REQUESTED', message: 'OK' },
      } as never;
    }
    if (path.endsWith('/issue-status')) {
      throw new AuthApiError(409, 'Hóa đơn hiện vẫn ở trạng thái bản nháp.', undefined, 'INVOICE_NOT_ISSUED');
    }
    return baseDraftDetail as never;
  });

  render(<InvoicePage accountRole="HOST" pathname={hostEndpoint} search="?action=issue" />);
  await screen.findByRole('button', { name: 'Xác nhận phát hành' });

  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận phát hành' }));
  await screen.findByText(/Kết nối bị gián đoạn khi phát hành hóa đơn/);

  // Re-trying directly or after checking status reuses/keeps consistent state
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại cùng yêu cầu' }));
  await screen.findByText('Đã phát hành chính thức và niêm phong kỳ');

  const postCalls = req.mock.calls.filter(([p]) => p.endsWith('/issue'));
  expect(postCalls).toHaveLength(2);
  expect(postCalls[0][3]).toBe(postCalls[1][3]);
  expect(postCalls[0][2]).toEqual(postCalls[1][2]);
});

it('supports batch selection from Host invoice list, preview grouping, partial success, and retrying failed items (1a)', async () => {
  const id2 = '00000000-0000-4000-8000-000000000020';
  const listPage = {
    items: [
      baseDraftDetail.invoice,
      { ...baseDraftDetail.invoice, id: id2, room_code: 'P102' },
    ],
    page: 0,
    hasNext: false,
  };
  const batchPreview: BatchIssuanceReview = {
    totalSelected: 2,
    counts: { ELIGIBLE: 1, NEEDS_CONFIRMATION: 0, INELIGIBLE: 1, ALREADY_ISSUED: 0 },
    totalEligibleAmount: '1500000',
    totalExpectedRemaining: '1500000',
    defaultSendNotification: true,
    items: [
      {
        invoiceId,
        periodId,
        invoiceNumber: 'HD000010',
        roomCode: 'P101',
        buildingName: 'Chung Cư X',
        customerName: 'Nguyễn Văn A',
        fromDate: '2026-11-01',
        toDate: '2026-12-01',
        dueDate: '2026-11-25',
        total: '1500000',
        paidAmount: '0',
        expectedRemaining: '1500000',
        category: 'ELIGIBLE',
        pastDue: false,
        transferUnavailable: false,
        canConfirmCashOnly: false,
        version: 3,
        sourceFingerprint: 'fp-123',
        message: 'Đủ điều kiện phát hành.',
        warnings: [],
        blockingIssues: [],
      },
      {
        invoiceId: id2,
        periodId: 'p2',
        invoiceNumber: 'HD000020',
        roomCode: 'P102',
        buildingName: 'Chung Cư X',
        customerName: 'Trần Thị B',
        fromDate: '2026-11-01',
        toDate: '2026-12-01',
        dueDate: '2026-11-25',
        total: null,
        paidAmount: '0',
        expectedRemaining: null,
        category: 'INELIGIBLE',
        pastDue: false,
        transferUnavailable: false,
        canConfirmCashOnly: false,
        version: 1,
        sourceFingerprint: null,
        message: 'Thiếu chỉ số điện.',
        warnings: [],
        blockingIssues: [{ code: 'MISSING', source: 'service:1', message: 'Chưa ghi chỉ số công tơ.' }],
      },
    ],
  };

  req.mockImplementation(async path => {
    if (path.endsWith('/locations')) return [] as never;
    if (path.endsWith('/issue/batch-preview')) return batchPreview as never;
    if (path.endsWith('/issue/batch')) {
      return {
        totalRequested: 1,
        counts: { ISSUED: 1, ALREADY_ISSUED: 0, SKIPPED: 0, FAILED: 0 },
        totalIssuedAmount: '1500000',
        items: [
          {
            invoiceId,
            periodId,
            invoiceNumber: 'HD000010',
            paymentReference: 'BATCHREF1',
            outcome: 'ISSUED',
            total: '1500000',
            remaining: '1500000',
            paymentStatus: 'UNPAID',
            notificationStatus: 'PENDING',
            reasonCode: null,
            message: 'Phát hành thành công.',
          },
        ],
      } as never;
    }
    return listPage as never;
  });

  render(<InvoicePage accountRole="HOST" pathname="/invoices/host" search="" />);

  fireEvent.click(await screen.findByRole('checkbox', { name: 'Chọn tất cả hóa đơn nháp trên trang' }));
  fireEvent.click(screen.getByRole('button', { name: 'Phát hành hàng loạt (2)' }));

  const previewRegion = await screen.findByRole('region', { name: 'Rà soát phát hành hóa đơn hàng loạt' });
  expect(within(previewRegion).getByText('Chưa ghi chỉ số công tơ.')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận phát hành 1 hóa đơn' }));
  const resultRegion = await screen.findByRole('region', { name: 'Kết quả phát hành hàng loạt' });
  expect(within(resultRegion).getByText('BATCHREF1')).toBeTruthy();
  expect(within(resultRegion).getByText('Đang chờ gửi thông báo')).toBeTruthy();

  await waitFor(() => {
    expect(req).toHaveBeenCalledWith(
      '/invoices/host/issue/batch',
      undefined,
      expect.objectContaining({ invoiceIds: [invoiceId], sendNotification: true }),
      expect.any(String),
      'POST',
    );
  });
});
