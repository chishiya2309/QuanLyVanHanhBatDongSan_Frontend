import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import '../../src/index.css';
import { servicePolicyMessages as m } from '../../src/types/servicePolicy';
import { catalogMessages } from '../../src/types/serviceCatalog';
import {
  electricityPolicy,
  fixtureBuildings,
  internetPolicy,
  lockedMethodPolicy,
  policyReply,
  policyWire,
} from './servicePolicy';
import {
  catalogFixtures,
  catalogReply,
  catalogWire,
  electricityId,
  internetId,
} from './serviceCatalog';

const params = new URLSearchParams(location.search);
const screen = params.get('screen') || 'detail';
const state = params.get('viewState') || 'full';

const currentPolicy = screen === 'locked' ? { ...lockedMethodPolicy } : screen === 'electricity' ? { ...electricityPolicy } : { ...internetPolicy };

window.fetch = async (input, init = {}) => {
  const url = new URL(String(input), location.origin);
  const method = init.method || 'GET';

  if (url.pathname.endsWith('/auth/me')) {
    return catalogReply({
      accountId: 'preview-policy-host',
      loginName: 'Chủ nhà UC20',
      role: 'HOST',
      hostId: electricityId,
      customerId: null,
    }, 'OK');
  }

  if (url.pathname.endsWith('/auth/csrf')) {
    return catalogReply({ headerName: 'X-CSRF-TOKEN', token: 'preview-csrf' }, 'OK');
  }

  if (url.pathname === '/api/v1/buildings' || url.pathname.endsWith('/buildings')) {
    if (state === 'buildingsError') {
      return catalogReply(null, m.buildingsFailure, 500);
    }
    return catalogReply(fixtureBuildings, 'OK');
  }

  if (url.pathname === '/api/v1/services' || url.pathname.endsWith('/services')) {
    return catalogReply(catalogFixtures.map(catalogWire), catalogMessages.listSuccess);
  }

  if (url.pathname.includes('/services') && url.pathname.endsWith('/policy')) {
    if (state === 'loading') {
      return new Promise<Response>(() => undefined);
    }
    if (state === 'error') {
      return catalogReply(null, m.getFailure, 500);
    }

    if (method === 'PATCH') {
      return policyReply(policyWire(currentPolicy), m.saveSuccess);
    }

    return policyReply(policyWire(currentPolicy), m.getSuccess);
  }

  return catalogReply(null, 'Preview endpoint unavailable', 404);
};

const initialPath = screen === 'picker'
  ? '/services/policy'
  : screen === 'electricity'
  ? `/services/${electricityId}/policy`
  : `/services/${internetId}/policy`;

history.replaceState(null, '', initialPath);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
