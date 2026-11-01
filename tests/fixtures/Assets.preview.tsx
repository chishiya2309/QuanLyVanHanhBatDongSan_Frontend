import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import '../../src/index.css';
import { assetMessages as m, type Asset } from '../../src/types/assets';
import { assetFixture, assetId, assetPageReply, assetReply, assetWire, secondAssetId } from './assets';

// Test-only entry: renders the real App, shell and UC17 against synthetic responses.
const params = new URLSearchParams(window.location.search);
const screen = params.get('screen') || 'list'; const state = params.get('state') || 'full';
const rows: Asset[] = [assetFixture,
  { ...assetFixture, assetId: secondAssetId, name: 'Tủ lạnh Panasonic', purchaseValue: '0', condition: 'REPAIRING', note: null },
  { ...assetFixture, assetId: '33333333-3333-4333-8333-333333333333', name: 'Máy giặt Electrolux', purchaseValue: '9999999999999999999', condition: 'DAMAGED', note: 'Cần kiểm tra đường cấp nước trước lần sử dụng tiếp theo.' },
  { ...assetFixture, assetId: '44444444-4444-4444-8444-444444444444', name: 'Quạt đứng', purchaseValue: '450000', condition: 'RETIRED', note: 'Đã ngừng sử dụng.' },
];
window.fetch = async (input) => {
  const url = new URL(String(input), location.origin);
  if (url.pathname.endsWith('/auth/me')) return assetReply({ accountId: 'preview-host', loginName: 'Chủ nhà', role: 'HOST', hostId: assetId, customerId: null }, 'OK');
  if (url.pathname.includes('/assets')) {
    if (state === 'loading') return new Promise<Response>(() => undefined);
    if (state === 'error') return assetReply(null, url.pathname.endsWith('/assets') ? m.listFailure : m.detailFailure, 500);
    if (url.pathname.endsWith('/assets')) return assetPageReply({ q: '', page: 0, size: 20 }, state === 'empty' ? [] : rows);
    return assetReply(assetWire(assetFixture));
  }
  return assetReply(null, 'Preview does not provide this endpoint', 404);
};
const suffix = screen === 'list' || screen === 'create' ? '' : '/' + assetId + (screen === 'detail' ? '' : '/' + screen);
history.replaceState(null, '', '/assets' + suffix + '?page=0&size=20' + (screen === 'create' ? '&create=1' : ''));
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
