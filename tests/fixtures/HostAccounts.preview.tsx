import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import '../../src/index.css';
import { hostAccountMessages as m, HOST_ACCOUNTS_PATH } from '../../src/types/hostAccounts';
import type { HostAccountDetail } from '../../src/types/hostAccounts';

// Synthetic records and intercepted responses exist only in this preview entry.
const query = new URLSearchParams(location.search);
const screen = query.get('screen') || 'list'; const state = query.get('state') || 'full';
const id = '11111111-1111-4111-8111-111111111111';
const rows: HostAccountDetail[] = [
  { accountId: id, loginEmail: 'anbinh@example.test', businessName: 'Nhà An Bình', status: 'ACTIVE', createdAt: '2026-10-30T08:00:00Z', officeAddress: '12 Nguyễn Văn Thủ, TP. Hồ Chí Minh', businessPhone: '0901234567', businessEmail: 'kinhdoanh.anbinh@example.test', logoUrl: null },
  { accountId: '22222222-2222-4222-8222-222222222222', loginEmail: 'minhphat@example.test', businessName: 'Căn hộ Minh Phát', status: 'LOCKED', createdAt: '2026-10-29T09:30:00Z', officeAddress: null, businessPhone: null, businessEmail: null, logoUrl: null },
  { accountId: '33333333-3333-4333-8333-333333333333', loginEmail: 'host.chuaxacdinh@example.test', businessName: null, status: 'ACTIVE', createdAt: '2026-10-28T10:00:00Z', officeAddress: null, businessPhone: null, businessEmail: null, logoUrl: null },
];
const response = (status: number, message: string, data: unknown = null) => new Response(JSON.stringify({ status, message, data }), { status });
window.fetch = async (input, init) => {
  const url = String(input);
  if (url.endsWith('/auth/me')) return response(200, 'ok', { accountId: 'preview-admin', loginName: 'Quản trị viên', role: 'ADMIN', hostId: null, customerId: null });
  if (url.endsWith('/auth/csrf')) return response(200, 'ok', { token: 'preview-only', headerName: 'X-CSRF-TOKEN' });
  if (url.includes('/admin/host-accounts')) {
    if (state === 'loading') return new Promise<Response>(() => undefined);
    if (state === 'error') return response(500, m.listFailure);
    if (state === 'forbidden') return response(403, m.forbidden);
    const account = rows.find((row) => url.includes(row.accountId));
    if (init?.method === 'PATCH' && account) { account.status = url.endsWith('/unlock') ? 'ACTIVE' : 'LOCKED'; return response(200, account.status === 'ACTIVE' ? m.unlockSuccess : m.lockSuccess); }
    if (account) return response(200, m.detailSuccess, account);
    return response(200, m.listSuccess, state === 'empty' ? [] : rows);
  }
  return response(404, 'Preview does not provide this endpoint');
};
history.replaceState(null, '', HOST_ACCOUNTS_PATH + (screen === 'detail' ? '/' + id : ''));
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
