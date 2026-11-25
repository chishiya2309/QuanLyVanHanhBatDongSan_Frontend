// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvoicePage } from '../src/components/invoice/InvoicePage';
import * as invoiceQueryApi from '../src/services/invoiceQueryApi';
import type { InvoiceDetailResponse, InvoicePageResponse } from '../src/types/invoiceQuery';

vi.mock('../src/services/invoiceQueryApi', async () => {
  const actual = await vi.importActual<typeof import('../src/services/invoiceQueryApi')>(
    '../src/services/invoiceQueryApi',
  );
  return {
    ...actual,
    fetchInvoiceList: vi.fn(),
    fetchInvoiceLocations: vi.fn(),
    fetchInvoiceDetail: vi.fn(),
  };
});

const mockedList = vi.mocked(invoiceQueryApi.fetchInvoiceList);
const mockedLocations = vi.mocked(invoiceQueryApi.fetchInvoiceLocations);
const mockedDetail = vi.mocked(invoiceQueryApi.fetchInvoiceDetail);

describe('UC52 InvoiceQuery Frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedLocations.mockResolvedValue([
      { building_id: 'b1', building_name: 'Tòa Alpha', room_id: 'r1', room_code: 'P101' },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Host summary strip, customer column, overdue days and remaining debt', async () => {
    const page: InvoicePageResponse = {
      page: 0,
      hasNext: true,
      summary: {
        totalReceivable: '10000000',
        totalPaid: '2500000',
        totalRemaining: '7500000',
        overdueCount: 2,
        issuedCount: 5,
      },
      items: [
        {
          id: 'inv-1',
          number: 'INV-202611-0001',
          lifecycle: 'ISSUED',
          from_date: '2026-11-01',
          to_date: '2026-12-01',
          due_date: '2026-11-10',
          issued_at: '2026-11-01T08:00:00Z',
          room_code: 'P101',
          building_name: 'Tòa Alpha',
          customer_name: 'Nguyễn Văn A',
          total: '2000000',
          paid_amount: '500000',
          remaining: '1500000',
          payment_status: 'PARTIALLY_PAID',
          is_overdue: true,
          overdue_days: 5,
        },
      ],
    };
    mockedList.mockResolvedValue(page);

    render(<InvoicePage accountRole="HOST" pathname="/invoices/host" search="" />);

    expect(await screen.findByText('INV-202611-0001')).toBeTruthy();
    expect(screen.getByText('Tổng phải thu')).toBeTruthy();
    expect(screen.getByText('5 hóa đơn đã phát hành')).toBeTruthy();
    expect(screen.getByText('2 hóa đơn')).toBeTruthy();
    expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
    expect(screen.getByText('Quá hạn 5 ngày')).toBeTruthy();
  });

  it('renders Customer empty state 1b without filter reset and 4a with filter reset', async () => {
    mockedList.mockResolvedValueOnce({
      page: 0,
      hasNext: false,
      summary: null,
      emptyMessage: 'Bạn chưa có hóa đơn nào được phát hành',
      items: [],
    });

    const { rerender } = render(<InvoicePage accountRole="CUSTOMER" pathname="/invoices/customer" search="" />);

    expect(await screen.findByText('Bạn chưa có hóa đơn nào được phát hành')).toBeTruthy();
    expect(screen.getByLabelText('Chỉ hiện hóa đơn còn nợ')).toBeTruthy();

    mockedList.mockResolvedValueOnce({
      page: 0,
      hasNext: false,
      summary: null,
      emptyMessage: 'Không tìm thấy hóa đơn nào phù hợp với điều kiện tìm kiếm',
      items: [],
    });

    rerender(<InvoicePage accountRole="CUSTOMER" pathname="/invoices/customer" search="?debtOnly=true" />);
    expect(await screen.findByText('Không tìm thấy hóa đơn nào phù hợp với điều kiện tìm kiếm')).toBeTruthy();
    expect(screen.getAllByText('Đặt lại bộ lọc').length).toBeGreaterThanOrEqual(2);
  });

  it('renders Customer terminated contract badge in list', async () => {
    mockedList.mockResolvedValue({
      page: 0,
      hasNext: false,
      summary: null,
      items: [
        {
          id: 'inv-term',
          number: 'INV-TERM-01',
          lifecycle: 'ISSUED',
          from_date: '2026-09-01',
          to_date: '2026-10-01',
          due_date: '2026-10-05',
          issued_at: '2026-09-01T08:00:00Z',
          room_code: 'P101',
          building_name: 'Tòa Alpha',
          customer_name: 'Nguyễn Văn A',
          rental_status: 'TERMINATED',
          total: '1800000',
          paid_amount: '1800000',
          remaining: '0',
          payment_status: 'PAID',
          is_overdue: false,
          overdue_days: 0,
        },
      ],
    });

    render(<InvoicePage accountRole="CUSTOMER" pathname="/invoices/customer" search="" />);
    expect(await screen.findByText('INV-TERM-01')).toBeTruthy();
    expect(screen.getByText('Hợp đồng đã kết thúc')).toBeTruthy();
  });

  it('renders 3-block detail with VOIDED cancel_reason, pendingTransfers, VietQR READY and PDF print', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const detail: InvoiceDetailResponse = {
      missingSnapshot: false,
      invoice: {
        id: 'inv-1',
        number: 'INV-202611-0001',
        lifecycle: 'ISSUED',
        from_date: '2026-11-01',
        to_date: '2026-12-01',
        due_date: '2026-11-10',
        issued_at: '2026-11-01T08:00:00Z',
        payment_reference: 'REFREADY',
        room_code: 'P101',
        building_name: 'Tòa Alpha',
        customer_name: 'Nguyễn Văn A',
        contract_number: 'HDT-001',
        rental_status: 'ACTIVE',
        total: '2000000',
        paid_amount: '500000',
        remaining: '1500000',
        payment_status: 'PARTIALLY_PAID',
        is_overdue: true,
        overdue_days: 5,
        pending_transfer_notice: 'Đang có giao dịch chuyển khoản chờ chủ nhà đối soát.',
      },
      lines: [
        {
          name: 'Tiền phòng',
          quantity: '1',
          unitPrice: '2000000',
          amount: '2000000',
          basis: 'Cố định',
        },
      ],
      payments: [
        {
          id: 'pay-1',
          paid_at: '2026-11-05T09:00:00Z',
          amount: '500000',
          method: 'CASH',
          status: 'CONFIRMED',
          receipt_id: 'rcpt-1',
          note: 'Đợt 1',
        },
        {
          id: 'pay-2',
          paid_at: '2026-11-04T09:00:00Z',
          amount: '500000',
          method: 'CASH',
          status: 'VOIDED',
          receipt_id: null,
          cancel_reason: 'Nhập nhầm số tiền',
        },
      ],
      pendingTransfers: [
        {
          id: 'pt-1',
          amount: '1500000',
          occurred_at: '2026-11-14T10:00:00Z',
          status: 'NEEDS_REVIEW',
          content: 'REFREADY',
          source_name: 'MB Bank',
        },
      ],
      transfer: {
        status: 'READY',
        bankName: 'MB',
        accountNumber: '0123456789',
        accountHolder: 'NGUYEN VAN CHU',
        reference: 'REFREADY',
        amount: '1500000',
        png: 'iVBORw0KGgo=',
        instructionMessage: 'Quét mã QR hoặc chuyển khoản thủ công theo thông tin thụ hưởng và nội dung bên dưới.',
      },
    };
    mockedDetail.mockResolvedValue(detail);

    const user = userEvent.setup();
    render(<InvoicePage accountRole="CUSTOMER" pathname="/invoices/customer/inv-1" search="" />);

    expect(await screen.findByText('HDT-001')).toBeTruthy();
    expect(screen.getByText('Quá hạn 5 ngày')).toBeTruthy();
    expect(screen.getByText('Đang có giao dịch chuyển khoản chờ chủ nhà đối soát.')).toBeTruthy();
    expect(screen.getByText('Lý do hủy: Nhập nhầm số tiền')).toBeTruthy();
    expect(screen.getByText('Giao dịch chuyển khoản chờ đối soát')).toBeTruthy();
    expect(screen.getByText('Chờ chủ nhà đối soát')).toBeTruthy();
    expect(screen.getByAltText('VietQR chuyển khoản cho hóa đơn')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'In / Xuất hóa đơn PDF' }));
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it('renders QR_UNAVAILABLE fallback with manual transfer details, E1c missingSnapshot and 403 error', async () => {
    mockedDetail.mockResolvedValueOnce({
      missingSnapshot: true,
      invoice: {
        id: 'inv-noqr',
        number: 'INV-NOQR',
        lifecycle: 'ISSUED',
        from_date: '2026-11-01',
        to_date: '2026-12-01',
        due_date: '2026-11-25',
        issued_at: '2026-11-01T08:00:00Z',
        room_code: 'P101',
        building_name: 'Tòa Alpha',
        customer_name: 'Nguyễn Văn A',
        total: '1000000',
        paid_amount: '0',
        remaining: '1000000',
        payment_status: 'UNPAID',
        is_overdue: false,
      },
      lines: [],
      payments: [],
      pendingTransfers: [],
      transfer: {
        status: 'QR_UNAVAILABLE',
        bankName: 'UNKNOWN',
        accountNumber: '99887766',
        accountHolder: 'CHU NHA',
        reference: 'REFNOQR',
        amount: '1000000',
        png: null,
        instructionMessage: 'Không thể tạo ảnh mã QR lúc này, vui lòng chuyển khoản thủ công theo thông tin bên dưới.',
      },
    });

    const { rerender } = render(<InvoicePage accountRole="HOST" pathname="/invoices/host/inv-noqr" search="" />);

    expect(
      await screen.findByText(
        'Chứng từ đã phát hành thiếu dữ liệu lưu trữ. Hệ thống không tự ý tính lại để tránh sai lệch công nợ.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Chưa ghi nhận đợt thanh toán nào cho hóa đơn này')).toBeTruthy();
    expect(
      screen.getByText('Không thể tạo ảnh mã QR lúc này, vui lòng chuyển khoản thủ công theo thông tin bên dưới.'),
    ).toBeTruthy();
    expect(screen.getByText('99887766')).toBeTruthy();

    mockedDetail.mockRejectedValueOnce(new Error('Bạn không có quyền truy cập vào hóa đơn này.'));
    rerender(<InvoicePage accountRole="CUSTOMER" pathname="/invoices/customer/inv-other" search="" />);

    await waitFor(() => {
      expect(screen.getByText('Bạn không có quyền truy cập vào hóa đơn này.')).toBeTruthy();
    });
  });
});
