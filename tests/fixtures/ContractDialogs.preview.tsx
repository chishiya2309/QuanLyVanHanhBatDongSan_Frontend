import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import { ConvertDepositToRentalModal } from '../../src/components/contracts/ConvertDepositToRentalModal';
import { DepositContractModal } from '../../src/components/contracts/DepositContractModal';
import { CancelDepositModal } from '../../src/components/contracts/CancelDepositModal';
import type { DepositContract } from '../../src/types/depositContract';
import '../../src/index.css';

const contract: DepositContract = {
  id: '11111111-1111-4111-8111-111111111111', contractNumber: 'HDC-20261113-P101', status: 'RESERVED',
  customerId: '22222222-2222-4222-8222-222222222222', customerName: 'Khách thuê mẫu', customerPhone: '0900000000',
  roomId: '33333333-3333-4333-8333-333333333333', roomCode: 'P101', roomName: 'Phòng giá rẻ sinh viên',
  buildingName: 'Tòa nhà mẫu', floorLevel: 1, amountRequired: 4500000,
  reservedFrom: '2026-11-13', moveInDate: '2026-11-18', createdAt: '2026-11-13T00:00:00Z', updatedAt: '2026-11-13T00:00:00Z',
};
const dialog = new URLSearchParams(location.search).get('dialog') || 'convert';
const reply = (data: unknown) => new Response(JSON.stringify({ status: 200, message: 'OK', data }), {
  status: 200, headers: { 'Content-Type': 'application/json' },
});
// Synthetic read-only preview; mutations never reach the backend.
window.fetch = async (input, init) => {
  if (init?.method && init.method !== 'GET') return new Response(JSON.stringify({ status: 503, message: 'Chế độ kiểm tra giao diện' }), { status: 503 });
  const path = new URL(String(input), location.origin).pathname;
  if (path.endsWith('/auth/me')) return reply({ accountId: 'preview-host', loginName: 'Host kiểm thử', role: 'HOST', hostId: 'preview-host', customerId: null });
  if (path === '/api/v1/deposit-contracts') return reply({ content: [contract], number: 0, size: 15, totalElements: 1, totalPages: 1, first: true, last: true, empty: false });
  if (path.endsWith('/available-customers')) return reply([{ id: contract.customerId, fullName: contract.customerName, phone: contract.customerPhone }]);
  if (path.endsWith('/available-rooms')) return reply([{ id: contract.roomId, code: contract.roomCode, name: contract.roomName, buildingId: 'building', buildingName: contract.buildingName, floorId: 'floor', floorLevel: 1, area: 20, defaultRent: 4500000, defaultDeposit: 4500000, status: 'VACANT' }]);
  return new Response('{}', { status: 404 });
};
history.replaceState(null, '', '/deposit-contracts');
export function Preview() {
  const [open, setOpen] = useState(true);
  const close = () => setOpen(false);
  return <><App />{dialog === 'create'
    ? <DepositContractModal isOpen={open} contractToEdit={null} onClose={close} onSuccess={close} />
    : dialog === 'cancel'
      ? <CancelDepositModal isOpen={open} contract={contract} onClose={close} onSuccess={close} />
      : <ConvertDepositToRentalModal isOpen={open} contract={contract} onClose={close} onSuccess={close} />}</>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Preview /></StrictMode>);
