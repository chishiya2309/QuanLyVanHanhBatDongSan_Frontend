import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LosslessNumber, stringify } from 'lossless-json';
import App from '../../src/App';
import '../../src/index.css';
import {
  applicableTargets,
  bankSource,
  buildingId,
  cashSource,
  configuredRoomPolicy,
  configuredWithInactivePolicy,
  inactiveBankSource,
  roomId,
  roomPaymentWire,
  sampleApplication,
  unconfiguredRoomPolicy,
} from './roomPaymentPolicy';

const uc40Cash = {
  ...cashSource,
  hasTransactions: false,
  canEditBankDetails: false,
  version: new LosslessNumber('0'),
};

const uc40Bank = {
  ...bankSource,
  hasTransactions: false,
  canEditBankDetails: true,
  version: new LosslessNumber('0'),
};

const params = new URLSearchParams(location.search);
const state = params.get('state') || 'default';
const role = params.get('role') || 'HOST';

let currentPolicy = structuredClone(
  state === 'configured'
    ? configuredRoomPolicy
    : state === 'inactive'
    ? configuredWithInactivePolicy
    : unconfiguredRoomPolicy
);

sessionStorage.removeItem('uc42-preview-calls');
sessionStorage.setItem('uc42-preview-calls', '[]');

window.fetch = async (input, init = {}) => {
  const url = new URL(String(input), location.origin);
  const path = url.pathname;
  const method = init.method || 'GET';
  const calls = JSON.parse(sessionStorage.getItem('uc42-preview-calls') || '[]');
  calls.push({ method, path, body: init.body });
  sessionStorage.setItem('uc42-preview-calls', JSON.stringify(calls));

  const jsonReply = (data: unknown, status = 200, message = 'Success') =>
    new Response(stringify({ status, message, data }), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });

  if (path.endsWith('/auth/me')) {
    return jsonReply({
      accountId: 'preview-uc42-host',
      loginName: 'Chủ nhà UC42',
      role,
      hostId: roomId,
      customerId: null,
    });
  }

  if (path.endsWith('/auth/csrf')) {
    return jsonReply({ headerName: 'X-CSRF-TOKEN', token: 'fixture-csrf-uc42' });
  }

  if (path.includes('/funding-sources')) {
    const type = url.searchParams.get('type');
    if (type === 'CASH') return jsonReply([uc40Cash]);
    if (type === 'BANK') return jsonReply([uc40Bank]);
  }

  if (path.endsWith('/applicable-rooms')) {
    if (state === 'empty-targets') return jsonReply([]);
    return jsonReply(applicableTargets.map(t => roomPaymentWire(t)));
  }

  if (path.endsWith('/applications') && method === 'POST') {
    return jsonReply(sampleApplication);
  }

  if (path.includes(`/rooms/${roomId}/payment-policy`)) {
    if (method === 'PUT') {
      const parsedBody = JSON.parse(String(init.body));
      currentPolicy = {
        ...currentPolicy,
        configured: true,
        policy: {
          allowCash: Boolean(parsedBody.allowCash),
          allowTransfer: Boolean(parsedBody.allowTransfer),
          cashDefault: parsedBody.allowCash ? cashSource : null,
          bankDefault: parsedBody.allowTransfer ? bankSource : null,
        },
        version: String(Number(currentPolicy.version || 0) + 1),
      };
      return jsonReply(roomPaymentWire(currentPolicy));
    }
    return jsonReply(roomPaymentWire(currentPolicy));
  }

  return new Response(JSON.stringify({ status: 404, message: 'Not found' }), { status: 404 });
};

history.replaceState(
  null,
  '',
  params.get('entry') === 'room'
    ? '/rooms?view=table&keyword=101&roomId=' + roomId + '&action=detail'
    : '/rooms/' + roomId + '/payment-policy?returnTo=' + encodeURIComponent('/rooms?view=table&buildingId=' + buildingId + '&roomId=' + roomId),
);

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
