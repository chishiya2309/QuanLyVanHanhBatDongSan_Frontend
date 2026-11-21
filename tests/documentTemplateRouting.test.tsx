import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import App from '../src/App';
import { DocumentExportModal } from '../src/components/contracts/DocumentExportModal';
import { failure, ok } from './apiMock';

const template = {
  id: 'template1', name: 'Sample template', type: 'RENTAL_CONTRACT',
  typeDisplay: 'Rental contract', active: true, currentVersionNo: 1,
  versions: [],
};

function installApi(role = 'HOST') {
  const list = vi.fn((url: URL): Response =>
    ok(url.searchParams.get('type') === 'DEPOSIT_CONTRACT' ? [] : [template]),
  );
  const upload = vi.fn((body: FormData) => {
    expect(body.get('name')).toBe('sample');
    expect(body.get('file')).toBeInstanceOf(File);
    return ok(template);
  });
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), window.location.origin);
    switch (url.pathname.replace('/api/v1', '')) {
      case '/auth/me': return ok({ accountId: 'template-user', loginName: 'user', role, hostId: 'host' });
      case '/auth/refresh': return failure(401, 'Expired');
      case '/auth/csrf': return ok({ token: 'csrf', headerName: 'X-CSRF-TOKEN' });
      case '/document-templates': return list(url);
      case '/document-templates/template1': return ok(template);
      case '/document-templates/validate-file':
        return ok({ valid: true, detectedVariables: [], missingRequiredVariables: [], unsupportedVariables: [] });
      case '/document-templates/upload': return upload(init?.body as FormData);
      case '/deposit-contracts': return ok({ content: [], totalElements: 0, totalPages: 0 });
      default: throw new Error(`Unexpected test request: ${url.pathname}`);
    }
  });
  return { list, upload };
}

it('restores template filters and version history through direct links and browser navigation', async () => {
  const api = installApi();
  window.history.replaceState(null, '', '/templates?type=RENTAL_CONTRACT&active=false&keyword=test&detail=template1');
  render(<App />);
  const sidebar = within(await screen.findByRole('complementary', { name: 'Thanh điều hướng chính' }));
  const templatesMenu = sidebar.getByRole('button', { name: 'Mẫu biểu' });
  expect(templatesMenu.getAttribute('aria-current')).toBe('page');
  await screen.findByRole('heading', { name: /Lịch sử các phiên bản/ });
  expect(api.list.mock.calls.at(-1)?.[0].searchParams.get('active')).toBe('false');

  fireEvent.click(within(screen.getByRole('dialog')).getByText('Đóng', { selector: 'button' }));
  fireEvent.click(templatesMenu);
  await waitFor(() => expect(api.list.mock.calls.at(-1)?.[0].search).toBe('?type=DEPOSIT_CONTRACT'));
  fireEvent.click(screen.getByRole('button', { name: 'Tất cả biểu mẫu' }));
  await waitFor(() => expect(api.list.mock.calls.at(-1)?.[0].search).toBe(''));
  expect(window.location.search).toBe('?type=ALL');

  fireEvent.click(sidebar.getByRole('button', { name: 'Hợp đồng đặt cọc' }));
  await screen.findByRole('heading', { name: 'Hợp đồng đặt cọc' });
  expect(templatesMenu.getAttribute('aria-current')).toBeNull();
  window.history.back();
  await waitFor(() => expect(templatesMenu.getAttribute('aria-current')).toBe('page'));
  expect(window.location.search).toBe('?type=ALL');
  window.history.forward();
  await screen.findByRole('heading', { name: 'Hợp đồng đặt cọc' });
});

it('blocks non-Host accounts from loading template data', async () => {
  const api = installApi('CUSTOMER');
  window.history.replaceState(null, '', '/document-templates');
  render(<App />);
  await screen.findByText('Bạn không có quyền quản lý mẫu tài liệu.');
  expect(api.list).not.toHaveBeenCalled();
});

it('returns to login when the template session expires', async () => {
  const api = installApi();
  api.list.mockImplementation(() => failure(401, 'Expired'));
  window.history.replaceState(null, '', '/document-templates');
  render(<App />);
  await waitFor(() => expect(window.location.pathname).toBe('/'), { timeout: 3000 });
  expect(screen.queryByRole('button', { name: 'Mẫu biểu' })).toBeNull();
});

it('validates and uploads a template through the dashboard', async () => {
  const api = installApi();
  window.history.replaceState(null, '', '/document-templates');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Tải lên mẫu mới' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(dialog.querySelector('input[type=file]')!, {
    target: { files: [new File(['fixture'], 'sample.docx')] },
  });
  const submit = within(dialog).getByRole('button', { name: 'Lưu mẫu tài liệu' });
  await waitFor(() => expect(submit).toHaveProperty('disabled', false));
  fireEvent.click(submit);
  await waitFor(() => expect(api.upload).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

it.each([
  ['DEPOSIT', 'deposit-contracts/contract1', 'DEPOSIT_CONTRACT'],
  ['RENTAL', 'rental-contracts/contract1', 'RENTAL_CONTRACT'],
  ['HANDOVER', 'rental-contracts/contract1/handovers/report1', 'HANDOVER'],
] as const)('previews, exports and downloads a %s document', async (sourceType, endpoint, type) => {
  const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  try {
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), window.location.origin).pathname.replace('/api/v1', '');
      switch (path) {
        case '/auth/csrf': return ok({ token: 'csrf', headerName: 'X-CSRF-TOKEN' });
        case `/${endpoint}/export-options`:
          return ok({
            eligibleForExport: true, availableTemplates: [{
              templateId: 'template1', latestVersionId: 'version1', name: template.name,
              type, versionNo: 1, isDefault: true, fileType: 'DOCX', detectedVariables: [],
            }],
            defaultTemplateVersionId: 'version1',
            extractedData: { type, values: {}, tables: {} }, templateVariables: [],
          });
        case `/${endpoint}/exported-documents`: return ok([]);
        case `/${endpoint}/preview`:
          expect(JSON.parse(String(init?.body)).templateVersionId).toBe('version1');
          return ok({ previewToken: 'preview1' });
        case `/${endpoint}/export`:
          expect(JSON.parse(String(init?.body)).templateVersionId).toBe('version1');
          return ok({ id: 'document1', fileName: 'sample.pdf' });
        case '/documents/preview/preview1':
        case '/documents/document1/download':
          return new Response('fixture', { headers: { 'Content-Type': 'application/pdf' } });
        default: throw new Error(`Unexpected test request: ${path}`);
      }
    });
    vi.stubGlobal('fetch', request);
    render(<DocumentExportModal isOpen onClose={vi.fn()} sourceType={sourceType}
      sourceId="contract1" handoverReportId={sourceType === 'HANDOVER' ? 'report1' : undefined} />);
    const preview = screen.getByRole('button', { name: /Xem trước \(PDF\)/ });
    await waitFor(() => expect(preview).toHaveProperty('disabled', false));
    fireEvent.click(preview);
    await screen.findByRole('button', { name: /Quay lại soát xét/ });
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận & Xuất tài liệu/ }));
    await waitFor(() => expect(download).toHaveBeenCalledOnce());
  } finally {
    download.mockRestore();
  }
});
