import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import '../../src/index.css';
import { catalogMessages as m } from '../../src/types/serviceCatalog';
import { catalogFixtures, catalogReply, catalogWire, electricityId, internet, internetId } from './serviceCatalog';

// Synthetic responses are restricted to this preview entry, never production.
const params = new URLSearchParams(location.search); const screen = params.get('screen') || 'list'; const state = params.get('viewState') || 'full';
const rows = [...catalogFixtures, { ...internet, id: '66666666-6666-4666-8666-666666666666', name: 'Vệ sinh khu vực chung', defaultPrice: '9999999999999999999', active: false }];
window.fetch = async (input) => {
  const url = new URL(String(input), location.origin);
  if (url.pathname.endsWith('/auth/me')) return catalogReply({ accountId: 'preview-host', loginName: 'Chủ nhà', role: 'HOST', hostId: electricityId, customerId: null }, 'OK');
  if (url.pathname.includes('/services')) {
    if (state === 'loading') return new Promise<Response>(() => undefined);
    const list = url.pathname.endsWith('/services');
    if (state === 'error') return catalogReply(null, list ? m.listFailure : m.detailFailure, 500);
    return catalogReply(list ? (state === 'empty' ? [] : rows.map(catalogWire)) : catalogWire(screen === 'setup' ? catalogFixtures[0] : internet), list ? m.listSuccess : m.detailSuccess);
  }
  return catalogReply(null, 'Preview endpoint unavailable', 404);
};
history.replaceState(null, '', '/services' + (screen === 'list' ? '' : screen === 'create' ? '?action=create' : '?action=' + (screen === 'setup' ? 'edit' : screen) + '&serviceId=' + (screen === 'setup' ? electricityId : internetId)));
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
