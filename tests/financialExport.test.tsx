import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FinancialExportButton } from '../src/components/reports/FinancialExportDialog';
import { decodeFinancialExport, type FinancialExportConfig } from '../src/services/financialExportApi';
import { invalidateSession } from '../src/services/sessionClient';
import { deferred, failure, ok } from './apiMock';

const filter = { fromDate: '2026-10-01', toDate: '2026-10-20', transactionCategory: [] };
const config: FinancialExportConfig = { type: 'CASH_FLOW', format: 'XLSX', includeTransactions: false, filter };
const scope = { filter, comparisonFrom: null, comparisonTo: null };
const boundary = 'uc76-preview';
const contentType = 'multipart/mixed; boundary="' + boundary + '"';
const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const encoder = new TextEncoder();
const fileBytes = new Uint8Array([80, 75, 0, 255, ...encoder.encode('\r\n--uc76-preview--suffix'), 147]);
const cashFlow = { filter, totalIn: '9223372036854775807', totalOut: 0, cashFlow: '9223372036854775807',
  transferIn: 0, transferOut: 0, granularity: 'MONTH', byDay: [], byMonth: [], byArea: [], byBuilding: [],
  byRoom: [], byCategory: [], bySource: [], composition: [], emptyMessage: null };
const snapshot = { scope, capturedAt: '2026-10-21T00:00:00Z', dataPolicy: 'LATEST_AT_EXPORT', cashFlow };

function multipart(mime = xlsx, includeFile = true) {
  const json = JSON.stringify(snapshot).replaceAll('"9223372036854775807"', '9223372036854775807');
  const head = encoder.encode('--' + boundary + '\r\nContent-Type: application/json\r\n'
    + 'Content-Disposition: inline; name="snapshot"\r\n\r\n' + json
    + (includeFile ? '\r\n--' + boundary + '\r\nContent-Type: ' + mime + '\r\n'
      + 'Content-Disposition: attachment; name="file"; filename="fallback.xlsx"; filename*=UTF-8\'\'B%C3%A1o-c%C3%A1o.xlsx\r\n\r\n' : ''));
  const tail = encoder.encode('\r\n--' + boundary + '--\r\n');
  return new Uint8Array([...head, ...(includeFile ? fileBytes : []), ...tail]).buffer;
}

const preview = (token: string, changes: string[] = []) => ok({ scope, changes, confirmationToken: token });
const dialog = () => within(screen.getByRole('dialog'));
const submit = () => dialog().getByRole<HTMLButtonElement>('button', { name: 'Tải báo cáo' });
function setup(prepare: (request: FinancialExportConfig) => Response | Promise<Response>,
  create: () => Response | Promise<Response> = () => new Response(multipart(), { headers: { 'Content-Type': contentType } })) {
  const calls = vi.fn(create);
  const previews = vi.fn(prepare);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), window.location.origin).pathname;
    if (path.endsWith('/auth/csrf')) return ok({ token: 'csrf', headerName: 'X-CSRF-TOKEN' });
    if (path.endsWith('/export/preview')) return previews(JSON.parse(String(init?.body)));
    if (path.endsWith('/export')) return calls(init);
    return failure(401, 'Phiên đã hết hạn');
  }));
  const onSnapshot = vi.fn();
  render(<FinancialExportButton type="CASH_FLOW" filter={filter} onSnapshot={onSnapshot} onSessionExpired={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Xuất báo cáo' }));
  return { calls, previews, onSnapshot };
}
beforeEach(() => {
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:uc76');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { invalidateSession(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('preserves exact numbers, the UTF-8 filename and all file bytes', async () => {
  const result = decodeFinancialExport(contentType, multipart(), config);
  expect(result.filename).toBe('Báo-cáo.xlsx');
  expect(result.snapshot.cashFlow?.cashFlow).toBe(9223372036854775807n);
  expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(fileBytes);
  expect(() => decodeFinancialExport(contentType, multipart('application/pdf'), config)).toThrow();
  expect(() => decodeFinancialExport(contentType, multipart(xlsx, false), config)).toThrow();
});

it('previews the current report, sends a single request and downloads the same file manually', async () => {
  const pending = deferred<Response>();
  const { calls, onSnapshot } = setup(() => preview('token-current'), () => pending.promise);
  await waitFor(() => expect(submit().disabled).toBe(false));
  fireEvent.click(submit());
  fireEvent.submit(submit().closest('form')!);
  await waitFor(() => expect(calls).toHaveBeenCalledTimes(1));
  expect(JSON.parse(String((calls.mock.calls[0] as unknown as RequestInit[])[0].body))).toEqual({
    configuration: config, confirmationToken: 'token-current',
  });
  await act(async () => pending.resolve(new Response(multipart(), { headers: { 'Content-Type': contentType } })));
  await dialog().findByText('Báo cáo tài chính đã được tạo thành công.');
  expect(onSnapshot).toHaveBeenCalledOnce();
  expect(dialog().getByRole('link', { name: 'Tải tệp' }).getAttribute('download')).toBe('Báo-cáo.xlsx');
  expect(calls).toHaveBeenCalledTimes(1);
  fireEvent.click(dialog().getByRole('button', { name: 'Đóng' }));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:uc76');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Xuất báo cáo' }));
});

it('discards an outdated preview and requires approval before sending a new scope', async () => {
  const outdated = deferred<Response>();
  const { previews } = setup(request => request.type === 'CASH_FLOW'
    ? outdated.promise : preview('next', ['Báo cáo sẽ sử dụng toàn bộ nguồn tiền.']));
  fireEvent.change(dialog().getByLabelText('Loại báo cáo'), { target: { value: 'COMBINED' } });
  await dialog().findByText('Báo cáo sẽ sử dụng toàn bộ nguồn tiền.');
  await act(async () => outdated.resolve(preview('old')));
  expect(submit().disabled).toBe(true);
  fireEvent.click(dialog().getByLabelText('Tôi xác nhận phạm vi xuất đã thay đổi'));
  expect(submit().disabled).toBe(false);
  fireEvent.change(dialog().getByLabelText('Định dạng'), { target: { value: 'PDF' } });
  await waitFor(() => expect(previews.mock.lastCall?.[0].format).toBe('PDF'));
  expect(dialog().queryByLabelText('Bao gồm giao dịch cấu thành')).toBeNull();
  expect(submit().disabled).toBe(true);
});

it('re-previews expired confirmation and waits for another explicit submit', async () => {
  const { calls, previews } = setup(() => preview('token'),
    () => failure(400, 'Vui lòng xem trước và xác nhận lại phạm vi xuất báo cáo.'));
  await waitFor(() => expect(submit().disabled).toBe(false));
  fireEvent.click(submit());
  await dialog().findByRole('alert');
  await waitFor(() => expect(previews).toHaveBeenCalledTimes(2));
  expect(calls).toHaveBeenCalledTimes(1);
});

it('retains configuration and provides backend guidance when the export exceeds a limit', async () => {
  const { onSnapshot } = setup(() => preview('token'), () => failure(422, 'Thu hẹp kỳ hoặc bỏ tùy chọn xuất chi tiết.'));
  await waitFor(() => expect(submit().disabled).toBe(false));
  fireEvent.click(dialog().getByLabelText('Bao gồm giao dịch cấu thành'));
  await waitFor(() => expect(submit().disabled).toBe(false));
  fireEvent.click(submit());
  await dialog().findByText('Thu hẹp kỳ hoặc bỏ tùy chọn xuất chi tiết.');
  expect(dialog().getByLabelText<HTMLInputElement>('Bao gồm giao dịch cấu thành').checked).toBe(true);
  expect(dialog().queryByRole('link', { name: 'Tải tệp' })).toBeNull();
  expect(onSnapshot).not.toHaveBeenCalled();
});

it('closes on session invalidation and discards an outstanding result', async () => {
  const pending = deferred<Response>();
  const { calls, onSnapshot } = setup(() => preview('token'), () => pending.promise);
  await waitFor(() => expect(submit().disabled).toBe(false));
  fireEvent.click(submit());
  await waitFor(() => expect(calls).toHaveBeenCalledOnce());
  act(() => invalidateSession());
  expect(screen.queryByRole('dialog')).toBeNull();
  await act(async () => pending.resolve(new Response(multipart(), { headers: { 'Content-Type': contentType } })));
  expect(onSnapshot).not.toHaveBeenCalled();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
