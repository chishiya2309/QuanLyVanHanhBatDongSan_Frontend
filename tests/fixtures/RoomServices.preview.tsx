import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { isLosslessNumber, parse } from 'lossless-json';
import App from '../../src/App';
import '../../src/index.css';
import { roomServiceMessages as m } from '../../src/types/roomServices';
import {
  addedService,
  candidate,
  inheritedService,
  privateService,
  roomId,
  roomServiceReply,
  roomServicesFixture,
} from './roomServices';

// Only this development/test entry installs fixtures; production imports no preview modules.
const params = new URLSearchParams(location.search),
  mode = params.get('state') || 'full';
const data = structuredClone(roomServicesFixture);
const role = params.get('role') || 'HOST';
if (mode === 'empty') data.services = [];
if (mode === 'long')
  data.services = [
    {
      ...inheritedService,
      name: 'Điện sinh hoạt khu nhà phía Đông với tên dịch vụ rất dài',
      roomPrice: '9999999999999999999',
      unitPrice: '9999999999999999999',
      priceSource: 'ROOM',
    },
    privateService,
  ];
let writes = 0;
sessionStorage.removeItem('uc36-preview-recovered');
sessionStorage.setItem('uc36-preview-calls', '[]');
window.fetch = async (input, init = {}) => {
  const path = new URL(String(input), location.origin).pathname,
    method = init.method || 'GET';
  const calls = JSON.parse(sessionStorage.getItem('uc36-preview-calls') || '[]');
  calls.push({ method, path, body: init.body });
  sessionStorage.setItem('uc36-preview-calls', JSON.stringify(calls));
  if (path.endsWith('/auth/me'))
    return roomServiceReply({
      accountId: 'preview-uc36-host',
      loginName: 'Chủ nhà UC36',
      role,
      hostId: roomId,
      customerId: null,
    });
  if (path.endsWith('/auth/csrf'))
    return roomServiceReply({ headerName: 'X-CSRF-TOKEN', token: 'fixture-uc36' });
  if (path.endsWith('/rooms/' + roomId + '/detail'))
    return roomServiceReply({
      id: roomId,
      code: '101',
      name: 'Phòng 101',
      buildingId: data.buildingId,
      buildingName: data.buildingName,
      status: 'VACANT',
      defaultRent: 1000000,
      defaultDeposit: 1000000,
    });
  if (path.endsWith('/rooms/' + roomId + '/history'))
    return roomServiceReply({ roomId, roomCode: '101', tenancyHistory: [], stateHistory: [] });
  if (path.endsWith('/areas') || path.endsWith('/buildings') || path.endsWith('/rooms/search'))
    return roomServiceReply([]);
  if (path.endsWith('/services/available')) {
    if (mode === 'choices-error' && !sessionStorage.getItem('uc36-preview-recovered'))
      return roomServiceReply(null, 500, m.availableFailure);
    return roomServiceReply({ roomId, services: mode === 'choices-empty' ? [] : [candidate] });
  }
  if (path.includes('/rooms/') && path.includes('/services')) {
    if (method !== 'GET') {
      writes++;
      if (mode === 'uncertain') throw new TypeError('Synthetic lost response');
      if (mode === 'stale') return roomServiceReply(null, 409, m.stale);
      if (mode === 'history') return roomServiceReply(null, 409, m.history);
      if (mode === 'save-error') return roomServiceReply(null, 500, m.saveFailure);
      const body = parse(String(init.body)) as Record<string, unknown>;
      if (method === 'POST') {
        const item = addedService();
        data.services.push(item);
        return roomServiceReply(item, 201, 'Thêm dịch vụ riêng thành công');
      }
      const item = data.services.find((item) => item.serviceId === path.split('/').at(-2));
      if (!item) return roomServiceReply(null, 404, m.notFound);
      if (method === 'PATCH') item.enabled = body.enabled as boolean;
      if (method === 'PUT' && isLosslessNumber(body.unitPrice)) {
        item.roomPrice = body.unitPrice.toString();
        item.unitPrice = item.roomPrice;
        item.priceSource = 'ROOM';
      }
      item.version = 'b'.repeat(64);
      return roomServiceReply(item, 200, 'Cấu hình dịch vụ đã được lưu');
    }
    if (mode === 'loading') return new Promise<Response>(() => undefined);
    if (
      mode === 'error' ||
      (mode === 'saved-get-error' && writes && !sessionStorage.getItem('uc36-preview-recovered'))
    )
      return roomServiceReply(null, 500, m.getFailure);
    return roomServiceReply(data);
  }
  return roomServiceReply(null, 404, 'Preview endpoint unavailable');
};
history.replaceState(
  null,
  '',
  params.get('entry') === 'room'
    ? '/rooms?view=table&keyword=101&roomId=' + roomId + '&action=detail'
    : '/rooms/' + roomId + '/services',
);
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
