import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import '../../src/index.css';
import { parseFundingRoute } from '../../src/utils/fundingNavigation';
import { fsFixture, type FsCall } from './fundingSources';
declare global { interface Window { __uc40Calls: FsCall[] } }
const params = new URLSearchParams(location.search), mode = params.get('state') || 'full';
// Screenshot tools wait for network-idle, while fixture API calls are in-memory.
// Keep a test-only static request heartbeat until the real App's session splash
// and source loading finish. This does not bypass authentication or UI states.
if (params.get('capture') === 'ready') {
  const staticFetch = window.fetch.bind(window), deadline = performance.now() + 15000;
  const ready = async () => {
    await staticFetch('/tests/fixtures/funding-sources-preview.html?capture-ping', { cache: 'no-store' }).catch(() => undefined);
    if (!document.querySelector('.fs-table') && performance.now() < deadline) window.setTimeout(() => void ready(), 100);
  };
  void ready();
}
const role = params.get('role') === 'CUSTOMER' ? 'CUSTOMER' : params.get('role') === 'ADMIN' ? 'ADMIN' : 'HOST';
window.__uc40Calls = [];
const fixture = fsFixture({ mode, role, onCall: c => window.__uc40Calls.push(c) });
window.fetch = fixture.fetcher;
if (!parseFundingRoute(location.pathname, location.search)) history.replaceState(null, '', '/funding-sources');
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
