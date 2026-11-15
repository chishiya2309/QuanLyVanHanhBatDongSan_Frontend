import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import '../../src/index.css';
import { parseProvisionalRoute, provisionalUrl } from '../../src/utils/provisionalChargeNavigation';
import { pcFixture, pcRoute } from './provisionalCharges';
import type { PcCall } from './provisionalCharges';

declare global {
  interface Window {
    __uc39Preview?: { state?: string; role?: 'HOST' | 'CUSTOMER' | 'ADMIN'; entry?: string };
    __uc39Calls: PcCall[];
  }
}
// This entry is reachable only through the test HTML. Production imports no fixture.
const params = new URLSearchParams(location.search), config = window.__uc39Preview;
const direct = parseProvisionalRoute(location.pathname, location.search);
const state = config?.state || params.get('state') || 'full';
const role = config?.role || (params.get('role') === 'CUSTOMER' || direct?.role === 'CUSTOMER' ? 'CUSTOMER' : params.get('role') === 'ADMIN' ? 'ADMIN' : 'HOST');
const entry = config?.entry || params.get('entry') || 'detail';
window.__uc39Calls = [];
const fixture = pcFixture({ mode: state, role, onCall: call => window.__uc39Calls.push(call) });
window.fetch = async (input, init) => {
  if (state === 'race' && String(input).endsWith('/' + pcRoute.periodId)) await new Promise(resolve => setTimeout(resolve, 1200));
  return fixture.fetcher(input, init);
};
if (!direct) window.history.replaceState(null, '', provisionalUrl({ ...pcRoute, role: role === 'CUSTOMER' ? 'CUSTOMER' : 'HOST',
  roomId: entry === 'search' ? '' : pcRoute.roomId, periodId: entry === 'search' ? '' : entry === 'invalid' ? 'bad' : pcRoute.periodId }));
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
