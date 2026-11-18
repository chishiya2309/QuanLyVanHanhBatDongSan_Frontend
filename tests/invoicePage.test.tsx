import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
