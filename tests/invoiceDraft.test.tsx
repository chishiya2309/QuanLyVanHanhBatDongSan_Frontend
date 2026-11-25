import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InvoicePage } from '../src/components/invoice/InvoicePage';
import { invoiceRequest } from '../src/services/invoiceApi';
import { AuthApiError } from '../src/services/authErrors';

vi.mock('../src/services/invoiceApi', () => ({
  invoicePath: (role: string) => '/invoices/' + role,
  invoiceRequest: vi.fn(),
}));
const request = vi.mocked(invoiceRequest);
const id = '00000000-0000-4000-8000-000000000001';
const reading = '00000000-0000-4000-8000-000000000002';
const service = '00000000-0000-4000-8000-000000000003';
const period = '00000000-0000-4000-8000-000000000004';
const endpoint = '/invoices/host/' + id;
const line = { key: 'service:' + service, value: {name:'Điện', amount:'0', quantity:'0', unitPrice:'100',
  basis:{roomServiceId:service, meterReadingPath:'/api/v1/billing-periods/' + period, reading:{id:reading},
    segments:[{event:'INITIAL', startIndex:'9007199254740993', endIndex:'9007199254740994'},
      {event:'RESET', startIndex:'9', endIndex:'9', reason:'Thay thiết bị'}]}} };
const calculation = {status:'COMPLETE', total:'0', subtotal:null, lines:[line], issues:[], sourceFingerprint:'fresh',
  manualLines:[{id:'manual-1', name:'Phí thứ nhất', kind:'FEE', amount:'10'}, {id:'manual-2', name:'Phí thứ hai', kind:'FEE', amount:'20'}]};
const base = {invoice:{id, period_id:period, lifecycle:'DRAFT', room_code:'P101', building_name:'Tòa A', version:4,
  dueDate:'2020-01-01', canIssue:false, requiresRecalculation:false, calculation}, lines:[], payments:[]};
const mount = () => render(<InvoicePage accountRole="HOST" pathname={endpoint} search="?view=schedule"/>);
const respond = (detail: unknown = base) => request.mockImplementation(async path => {
  if (path.endsWith('/recalculation')) return {version:4, calculation, changes:[{key:line.key, after:line}], totalDelta:null} as never;
  return detail as never;
});
afterEach(() => {cleanup(); vi.resetAllMocks();});

it('opens an exact multi-segment source and distinguishes a zero total', async () => {
  respond();
  mount();
  await screen.findByText(/Tổng hóa đơn: 0/);
  expect(screen.getByRole('button', {name:'Phát hành hóa đơn'}).hasAttribute('disabled')).toBe(true);
  const source = screen.getByRole('link', {name:'Mở dữ liệu nguồn'});
  const url = new URL(source.getAttribute('href')!, 'https://example.test');
  expect(url.pathname).toBe('/meter-readings/' + reading);
  expect(url.searchParams.get('roomServiceId')).toBe(service);
  expect(url.searchParams.get('returnTo')).toBe(endpoint + '?view=schedule');
  expect(screen.getByText(/9007199254740993.*tiêu thụ 1/)).toBeTruthy();
});

it('holds a legacy draft until preview is explicitly confirmed', async () => {
  respond({...base, invoice:{...base.invoice, calculation:null, requiresRecalculation:true}});
  mount();
  fireEvent.click(await screen.findByRole('button',{name:'Xem trước tính lại'}));
  await screen.findByText('Chưa có căn cứ xác định chênh lệch tổng.');
  expect(request.mock.calls.filter(call => call[2])).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:'Hủy xem trước'}));
  expect(request.mock.calls.filter(call => call[2])).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:'Xem trước tính lại'}));
  fireEvent.click(await screen.findByRole('button',{name:'Xác nhận cập nhật nháp'}));
  await waitFor(() => expect(request).toHaveBeenCalledWith(endpoint + '/draft/recalculation', undefined, {version:4,sourceFingerprint:'fresh'}));
});

it('keeps other manual lines by submitting only changed or removed IDs', async () => {
  respond();
  mount();
  fireEvent.click(await screen.findByRole('button',{name:'Chỉnh sửa nháp'}));
  fireEvent.click(screen.getByRole('button',{name:'Sửa Phí thứ nhất'}));
  fireEvent.change(screen.getByLabelText('Tên khoản phí'), {target:{value:'Phí đã sửa'}});
  fireEvent.change(screen.getByLabelText('Lý do điều chỉnh'), {target:{value:'Đã rà soát'}});
  fireEvent.click(screen.getByRole('checkbox',{name:'Xác nhận hạn thanh toán đã qua'}));
  fireEvent.click(screen.getByRole('button',{name:'Lưu thay đổi'}));
  await waitFor(() => expect(request).toHaveBeenCalledWith(endpoint + '/draft', undefined, expect.objectContaining({
    version:4, confirmPastDue:true, manualLines:[expect.objectContaining({id:'manual-1',name:'Phí đã sửa'})], removeManualLineIds:[],
  }), undefined, 'PATCH'));
});

it('requires explicit deletion confirmation and discards a conflicting preview', async () => {
  respond();
  mount();
  fireEvent.click(await screen.findByRole('button',{name:'Xóa nháp'}));
  expect(request.mock.calls.some(call => call[4] === 'DELETE')).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'Giữ hóa đơn nháp'}));
  fireEvent.click(screen.getByRole('button',{name:'Xem trước tính lại'}));
  const confirm = await screen.findByRole('button',{name:'Xác nhận cập nhật nháp'});
  request.mockRejectedValueOnce(new AuthApiError(409,'Dữ liệu nguồn đã thay đổi.'));
  fireEvent.click(confirm);
  await screen.findByRole('alert');
  expect(screen.queryByRole('button',{name:'Xác nhận cập nhật nháp'})).toBeNull();
});

it('previews selected periods and retains successful outcomes when retrying only failures', async () => {
  const other = '00000000-0000-4000-8000-000000000005';
  const row = {period_id:period, room_code:'P101', building_id:id, room_id:id, building_name:'Tòa A',
    from_date:'2026-11-01',to_date:'2026-12-01',scheduledBillingDate:'2026-11-30',scheduleStatus:'DUE',status:'OPEN'};
  let submits = 0;
  request.mockImplementation(async (path, _signal, body) => {
    if (path.endsWith('/batch/preview')) return (body as {periodIds:string[]}).periodIds.map(periodId => ({periodId, issues:[]})) as never;
    if (path.endsWith('/batch')) return { items: ++submits === 1 ?
      [{periodId:period,invoiceId:id,status:'READY'},{periodId:other,status:'FAILED',message:'Lỗi kỳ'}] :
      [{periodId:other,invoiceId:reading,status:'READY'}] } as never;
    return [row,{...row,period_id:other,room_code:'P102'}] as never;
  });
  render(<InvoicePage accountRole="HOST" pathname="/invoices/host" search="?view=schedule"/>);
  fireEvent.click(await screen.findByRole('checkbox',{name:/Chọn P101/}));
  fireEvent.click(screen.getByRole('checkbox',{name:/Chọn P102/}));
  fireEvent.click(screen.getByRole('button',{name:'Xem trước lập hàng loạt'}));
  fireEvent.click(await screen.findByRole('button',{name:'Xác nhận lập hàng loạt'}));
  const panel = await screen.findByRole('region',{name:'Kết quả lập hàng loạt'});
  fireEvent.click(within(panel).getByRole('checkbox',{name:/Thử lại kỳ/}));
  fireEvent.click(within(panel).getByRole('button',{name:'Xem trước các kỳ thử lại'}));
  fireEvent.click(await screen.findByRole('button',{name:'Xác nhận lập hàng loạt'}));
  await within(panel).findByText('Sẵn sàng (2)');
  expect(request.mock.calls.filter(call => call[0].endsWith('/batch')).map(call => call[2])).toEqual([{periodIds:[period,other]},{periodIds:[other]}]);
});
