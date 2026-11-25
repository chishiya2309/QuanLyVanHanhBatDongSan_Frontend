import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InvoicePage } from '../src/components/invoice/InvoicePage';
import { AuthApiError } from '../src/services/authErrors';
import { documentTemplateApi } from '../src/services/documentTemplateApi';
import { invoiceRequest } from '../src/services/invoiceApi';
import { authenticatedFetch } from '../src/services/sessionClient';

vi.mock('../src/services/invoiceApi', async importOriginal => ({
  ...await importOriginal<typeof import('../src/services/invoiceApi')>(),
  invoiceRequest: vi.fn(),
}));
vi.mock('../src/services/sessionClient', async importOriginal => ({
  ...await importOriginal<typeof import('../src/services/sessionClient')>(),
  authenticatedFetch: vi.fn(),
}));
vi.mock('../src/services/documentTemplateApi', () => ({
  documentTemplateApi: { getTemplates: vi.fn(), getTemplateDetail: vi.fn() },
}));

const invoice = (id: number, lifecycle = 'ISSUED') => ({
  id: String(id), number: 'HD' + id, lifecycle, room_code: 'P101', building_name: 'Tòa A',
  rental_status: 'TERMINATED', from_date: '2026-11-01', to_date: '2026-12-01',
  total: '2000000', paid_amount: '2000000', remaining: '0', payment_status: 'PAID',
});
const file = {
  downloadUrl: '/api/v1/invoices/host/exported-documents/1/download',
  fileName: 'Hóa đơn.pdf', reusedFromCache: true,
};
const issuedDetail = { invoice: invoice(1), lines: [], payments: [], transfer: { status: 'PAID' } };

function setupFile() {
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:mock-invoice');
    static revokeObjectURL = vi.fn();
  });
  vi.mocked(authenticatedFetch).mockResolvedValue(new Response('mock bytes', { headers: { 'Content-Type': 'application/pdf' } }));
  return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

it.each(['host', 'customer'] as const)('downloads a reused PDF from the %s detail', async role => {
  const click = setupFile();
  vi.mocked(invoiceRequest).mockImplementation(async path => path.endsWith('/export')
    ? { ...file, downloadUrl: file.downloadUrl.replace('/host/', '/' + role + '/') } as never
    : issuedDetail as never);
  render(<InvoicePage accountRole={role.toUpperCase()} pathname={'/invoices/' + role + '/1'} search="" />);
  const button = await screen.findByRole('button', { name: role === 'host' ? 'Xuất hóa đơn (PDF)' : 'Tải hóa đơn (PDF)' });
  if (role === 'customer') {
    expect(screen.getByText('Hợp đồng đã kết thúc')).toBeTruthy();
    expect(screen.queryByText('Tùy chọn xuất')).toBeNull();
    expect(screen.queryByText('Xem trước bản in')).toBeNull();
  }
  fireEvent.click(button);
  fireEvent.click(button);
  expect(await screen.findByText('Đã xuất hóa đơn và bắt đầu tải tệp.')).toBeTruthy();
  expect(vi.mocked(invoiceRequest).mock.calls.filter(([path]) => path.endsWith('/export'))).toEqual([
    ['/invoices/' + role + '/1/export', expect.any(AbortSignal), undefined, undefined, 'POST'],
  ]);
  expect(click).toHaveBeenCalledOnce();
  expect(click.mock.contexts[0].download).toBe('Hóa đơn.pdf');
});

it('exports a PDF from the Host list and keeps the draft issuance action separate', async () => {
  setupFile();
  vi.mocked(invoiceRequest).mockImplementation(async path => {
    if (path.endsWith('/export')) return file as never;
    if (path.endsWith('/locations')) return [] as never;
    return { items: [invoice(1), invoice(2, 'DRAFT')], page: 0, hasNext: false } as never;
  });
  render(<InvoicePage accountRole="HOST" pathname="/invoices/host" search="" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Xuất hóa đơn (PDF)' }));
  await screen.findByText('Đã xuất hóa đơn và bắt đầu tải tệp.');
  expect(screen.getByRole('link', { name: 'Rà soát và phát hành' }).getAttribute('href')).toContain('/2?action=issue');
  expect(invoiceRequest).toHaveBeenCalledWith('/invoices/host/1/export', expect.any(AbortSignal), undefined, undefined, 'POST');
});

it('sends the current active invoice template version for DOCX and retries only the file GET', async () => {
  const click = setupFile();
  vi.mocked(authenticatedFetch).mockResolvedValueOnce(Response.json({ message: 'Tệp tạm thời không tải được' }, { status: 500 }));
  const template = { id: 'template', name: 'Mẫu song ngữ', type: 'INVOICE' as const, active: true, currentVersionNo: 2 };
  vi.mocked(documentTemplateApi.getTemplates).mockResolvedValue([template] as never);
  vi.mocked(documentTemplateApi.getTemplateDetail).mockResolvedValue({
    ...template, versions: [{ id: 'old', versionNo: 1 }, { id: 'current', versionNo: 2 }],
  } as never);
  vi.mocked(invoiceRequest).mockImplementation(async path => path.endsWith('/export')
    ? { ...file, fileName: 'Hóa đơn.docx' } as never
    : issuedDetail as never);
  render(<InvoicePage accountRole="HOST" pathname="/invoices/host/1" search="" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Tùy chọn xuất' }));
  await screen.findByRole('option', { name: 'Mẫu song ngữ' });
  fireEvent.change(screen.getByLabelText('Mẫu biểu'), { target: { value: 'template' } });
  fireEvent.change(screen.getByLabelText('Định dạng'), { target: { value: 'DOCX' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xuất hóa đơn', exact: true }));
  const retry = await screen.findByRole('button', { name: 'Thử tải lại tệp đã xuất' });
  expect(screen.getByRole('alert').textContent).toContain('đã được xuất nhưng chưa tải được tệp');
  fireEvent.click(retry);
  await screen.findByText('Đã xuất hóa đơn và bắt đầu tải tệp.');
  expect(vi.mocked(invoiceRequest).mock.calls.filter(([path]) => path.endsWith('/export'))).toEqual([
    ['/invoices/host/1/export', expect.any(AbortSignal), { format: 'DOCX', templateVersionId: 'current' }, undefined, 'POST'],
  ]);
  expect(click).toHaveBeenCalledOnce();
});

it('renders the temporary draft PDF in a dialog without requesting an official export', async () => {
  setupFile();
  vi.mocked(invoiceRequest).mockImplementation(async path => path.endsWith('/preview')
    ? { previewUrl: '/api/v1/invoices/host/preview/token' } as never
    : { invoice: invoice(1, 'DRAFT'), lines: [], payments: [] } as never);
  render(<InvoicePage accountRole="HOST" pathname="/invoices/host/1" search="" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Xem trước bản in' }));
  expect((await screen.findByTitle('PDF hóa đơn bản nháp')).getAttribute('src')).toBe('blob:mock-invoice');
  expect(screen.getByRole('link', { name: 'Mở PDF trong tab mới' })).toBeTruthy();
  expect(vi.mocked(invoiceRequest).mock.calls.some(([path]) => path.endsWith('/export'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-invoice');
});

it('keeps up to 50 issued selections across pages and downloads a partial ZIP with its errors visible', async () => {
  const click = setupFile();
  vi.mocked(invoiceRequest).mockImplementation(async (path, _signal, body) => {
    if (path.endsWith('/export/batch')) return {
      ...file, fileName: 'HoaDon.zip', downloadUrl: '/api/v1/invoices/host/export/batch/download?key=mock',
      successCount: 49, failedCount: 1, failures: [{ invoiceId: '1', invoiceNumber: null, reason: 'Lỗi mẫu' }],
    } as never;
    if (path.endsWith('/locations')) return [] as never;
    expect(body).toBeUndefined();
    const index = Number(new URL(path, location.origin).searchParams.get('page') || 0);
    return { items: [
      ...Array.from({ length: 19 }, (_, offset) => invoice(index * 19 + offset + 1)),
      invoice(999, 'DRAFT'),
    ], page: index, hasNext: index < 2 } as never;
  });
  render(<InvoicePage accountRole="HOST" pathname="/invoices/host" search="" />);
  for (const page of [0, 1, 2]) {
    const boxes = await screen.findAllByRole('checkbox', { name: /^Chọn xuất hóa đơn HD/ });
    for (const box of boxes.slice(0, page === 2 ? 12 : 19)) fireEvent.click(box);
    if (page < 2) fireEvent.click(screen.getByRole('link', { name: 'Trang sau' }));
  }
  expect(screen.queryByRole('checkbox', { name: 'Chọn xuất hóa đơn HD999' })).toBeNull();
  expect((screen.getByRole('checkbox', { name: 'Chọn xuất hóa đơn HD51' }) as HTMLInputElement).disabled).toBe(true);
  const open = screen.getByRole('button', { name: 'Xuất hóa đơn hàng loạt' });
  fireEvent.click(open);
  let dialog = screen.getByRole('dialog');
  expect(within(dialog).getAllByRole('listitem')).toHaveLength(50);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
  expect(vi.mocked(invoiceRequest).mock.calls.some(([path]) => path.endsWith('/export/batch'))).toBe(false);
  fireEvent.click(open);
  dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận xuất hàng loạt' }));
  await screen.findByText('Thành công: 49. Thất bại: 1.');
  expect(invoiceRequest).toHaveBeenCalledWith('/invoices/host/export/batch', expect.any(AbortSignal), {
    invoiceIds: Array.from({ length: 50 }, (_, index) => String(index + 1)),
  });
  expect(screen.getByText('HD1 – P101: Lỗi mẫu')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Tải tệp ZIP' }));
  await screen.findByText('Đã bắt đầu tải tệp ZIP.');
  expect(click).toHaveBeenCalledOnce();
  expect(authenticatedFetch).toHaveBeenCalledWith(expect.stringContaining('/batch/download?key=mock'), expect.anything(), expect.anything());
}, 15_000);

it.each([
  ['host', 403, 'Bạn không có quyền xuất hóa đơn này'],
  ['customer', 404, 'Hóa đơn không tồn tại hoặc chưa được phát hành'],
  ['host', 404, 'Chưa thiết lập mẫu biểu hóa đơn hợp lệ. Vui lòng kiểm tra cấu hình mẫu biểu trước khi xuất'],
  ['host', 422, 'Không thể kết xuất tài liệu do mẫu biểu bị lỗi cấu trúc hoặc thiếu dữ liệu hóa đơn. Vui lòng kiểm tra lại mẫu biểu'],
] as const)('shows the %s export error for HTTP %s', async (role, status, message) => {
  vi.mocked(invoiceRequest).mockImplementation(async path => {
    if (path.endsWith('/export')) throw new AuthApiError(status, message);
    return issuedDetail as never;
  });
  render(<InvoicePage accountRole={role.toUpperCase()} pathname={'/invoices/' + role + '/1'} search="" />);
  fireEvent.click(await screen.findByRole('button', { name: role === 'host' ? 'Xuất hóa đơn (PDF)' : 'Tải hóa đơn (PDF)' }));
  expect((await screen.findByRole('alert')).textContent).toContain(message);
  expect(Boolean(screen.queryByRole('link', { name: 'Quản lý mẫu biểu' }))).toBe(role === 'host' && status === 404);
});

it('shows the server error and no ZIP if every invoice in the batch fails', async () => {
  const message = 'Không có hóa đơn hợp lệ nào được kết xuất thành công trong lô.';
  vi.mocked(invoiceRequest).mockImplementation(async path => {
    if (path.endsWith('/export/batch')) throw new AuthApiError(422, message);
    if (path.endsWith('/locations')) return [] as never;
    return { items: [invoice(1), invoice(2)], page: 0, hasNext: false } as never;
  });
  render(<InvoicePage accountRole="HOST" pathname="/invoices/host" search="" />);
  for (const box of await screen.findAllByRole('checkbox', { name: /^Chọn xuất hóa đơn HD/ })) fireEvent.click(box);
  fireEvent.click(screen.getByRole('button', { name: 'Xuất hóa đơn hàng loạt' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất hàng loạt' }));
  expect((await screen.findByRole('alert')).textContent).toBe(message);
  expect(screen.queryByRole('button', { name: 'Tải tệp ZIP' })).toBeNull();
});
