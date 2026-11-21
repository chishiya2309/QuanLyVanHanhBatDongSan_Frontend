import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InvoicePage } from '../src/components/invoice/InvoicePage';
import { invoiceRequest } from '../src/services/invoiceApi';

vi.mock('../src/services/invoiceApi', () => ({
  invoicePath: (role: string) => '/invoices/' + role,
  invoiceRequest: vi.fn(),
}));

const invoice = {
  id: 'example', number: 'HD001', lifecycle: 'ISSUED', from_date: '2026-11-01', to_date: '2026-12-01',
  due_date: '2026-11-30', room_code: 'P101', building_name: 'Tòa A', total: '3500000',
  paid_amount: '1000000', remaining: '2500000', payment_status: 'PARTIALLY_PAID', is_overdue: false,
};
const transfer = {
  status: 'READY', bankName: 'MB', accountNumber: '0123456789', accountHolder: 'NGUYEN VAN A',
  reference: 'AB123', amount: '2500000', png: 'cG5n',
};
const detail = { invoice, lines: [], payments: [], transfer, missingSnapshot: false };

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('blocks a Customer from requesting the Host route', () => {
  render(<InvoicePage accountRole="CUSTOMER" pathname="/invoices/host/example" search="" />);
  expect(screen.getByRole('alert').textContent).toContain('không có quyền');
  expect(invoiceRequest).not.toHaveBeenCalled();
});

it('shows and downloads the QR for the remaining amount with copyable transfer fields', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  try {
    vi.mocked(invoiceRequest).mockResolvedValue(detail);
    render(<InvoicePage accountRole="CUSTOMER" pathname="/invoices/customer/example" search="" />);
    const image = await screen.findByRole('img', { name: /VietQR/ });
    expect(image.getAttribute('src')).toBe('data:image/png;base64,cG5n');
    expect(screen.getByRole('link', { name: 'Tải ảnh QR' }).getAttribute('download')).toBe('HD001-VietQR.png');
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép số tiền' }));
    await screen.findByText('Đã sao chép vào bộ nhớ tạm.');
    expect(writeText).toHaveBeenCalledWith('2500000');
    fireEvent.error(image);
    expect(screen.queryByRole('link', { name: 'Tải ảnh QR' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Sao chép nội dung' })).toBeTruthy();
  } finally {
    if (previous) Object.defineProperty(navigator, 'clipboard', previous);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

it('records a cash payment from the Host list and prints the confirmed receipt', async () => {
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  const show = vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  const close = vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false; });
  vi.mocked(invoiceRequest).mockImplementation(async path => {
    if (path.endsWith('/cash-payment-context')) return {
      invoiceNumber: 'HD001', roomCode: 'P101', total: '3500000', paidAmount: '1000000', remaining: '2500000',
      defaultFundingSourceId: 'cash', paidAt: '2025-01-01T01:30:00Z',
    } as never;
    if (path.startsWith('/funding-sources')) return [{ id: 'cash', name: 'Quỹ mặc định' }] as never;
    if (path.endsWith('/cash-payments')) return { paymentId: 'payment', cashEntryId: 'entry',
      amount: '2500000', paidAt: '2025-01-01T01:30:00Z', paidAmount: '3500000', remaining: '0', paymentStatus: 'PAID' } as never;
    if (path.endsWith('/locations')) return [] as never;
    return { items: [invoice], page: 0, hasNext: false } as never;
  });
  try {
    render(<InvoicePage accountRole="HOST" pathname="/invoices/host" search="" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận thanh toán tiền mặt' }));
    expect((await screen.findByLabelText('Số tiền thanh toán (VND)') as HTMLInputElement).value).toBe('2500000');
    expect((screen.getByLabelText('Ngày giờ thanh toán (giờ Việt Nam)') as HTMLInputElement).value).toBe('2025-01-01T08:30');
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thanh toán' }));
    });
    expect(screen.getByRole('status').textContent).toContain('Ghi nhận thanh toán thành công');
    fireEvent.click(screen.getByRole('button', { name: 'In/Xuất phiếu thu' }));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText('Ghi nhận thanh toán thành công')).toBeNull();
    expect(screen.getByRole('button', { name: 'In/Xuất phiếu thu' })).toBeTruthy();
    expect(print).toHaveBeenCalledOnce();
    expect(invoiceRequest).toHaveBeenCalledWith('/invoices/host/example/cash-payments', undefined,
      expect.objectContaining({ fundingSourceId: 'cash', paidAt: '2025-01-01T01:30:00.000Z' }), expect.any(String));
  } finally { vi.useRealTimers(); print.mockRestore(); show.mockRestore(); close.mockRestore(); }
});

it('retries the identical cash command from detail when the first response is lost', async () => {
  const show = vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  const close = vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false; });
  let sent = 0;
  vi.mocked(invoiceRequest).mockImplementation(async path => {
    if (path.endsWith('/cash-payment-context')) return {
      invoiceNumber: 'HD001', roomCode: 'P101', total: '3500000', paidAmount: '1000000', remaining: '2500000',
      defaultFundingSourceId: null, paidAt: '2025-01-01T01:30:00Z',
    } as never;
    if (path.startsWith('/funding-sources')) return [{ id: 'other', name: 'Quỹ khác' }] as never;
    if (path.endsWith('/cash-payments')) {
      if (++sent === 1) throw new TypeError('Connection lost');
      return { paymentId: 'payment', cashEntryId: 'entry', amount: '1000000',
        paidAt: '2025-01-01T01:30:00Z', paidAmount: '2000000', remaining: '1500000', paymentStatus: 'PARTIALLY_PAID' } as never;
    }
    if (sent === 2) return new Promise(() => {});
    return detail as never;
  });
  try {
    render(<InvoicePage accountRole="HOST" pathname="/invoices/host/example" search="" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận thanh toán tiền mặt' }));
    const amount = await screen.findByLabelText('Số tiền thanh toán (VND)');
    fireEvent.change(amount, { target: { value: '1000000' } });
    fireEvent.change(screen.getByLabelText('Nguồn tiền mặt'), { target: { value: 'other' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thanh toán' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại cùng yêu cầu' }));
    await screen.findByText(/Đã ghi nhận thanh toán tiền mặt/);
    const writes = vi.mocked(invoiceRequest).mock.calls.filter(([path]) => path.endsWith('/cash-payments'));
    expect(writes).toHaveLength(2);
    expect(writes[0]).toEqual(writes[1]);
    expect(screen.getByText('entry')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'In/Xuất phiếu thu' })).toBeNull();
  } finally { show.mockRestore(); close.mockRestore(); }
});
