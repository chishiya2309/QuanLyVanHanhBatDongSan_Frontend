import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import '../../src/index.css';
import { meterUrl } from '../../src/utils/meterNavigation';
import { fixtureRoute, meterFixtureFetch, savedItem } from './meterReadings';

// Fixtures are installed exclusively by this test entry, never by production code.
const params = new URLSearchParams(location.search), state = params.get('state') || 'full';
sessionStorage.setItem('uc37-preview-calls', '[]');
const fixture = meterFixtureFetch({ mode: state, delay: state === 'loading' ? 2000 : undefined, onCall: (path, method, body) => {
  const calls = JSON.parse(sessionStorage.getItem('uc37-preview-calls') || '[]');
  calls.push({ path, method, body }); sessionStorage.setItem('uc37-preview-calls', JSON.stringify(calls));
} });
window.fetch = fixture.fetcher;
const route = { ...fixtureRoute, view: params.get('view') === 'progress' ? 'progress' as const : params.get('view') === 'single' ? 'single' as const : 'batch' as const,
  readingId: params.get('entry') === 'detail' ? savedItem.readingId : null };
if (params.get('entry') === 'search') { route.periodIds = []; route.fromDate = ''; route.toDate = ''; }
window.history.replaceState(null, '', meterUrl(route));
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
