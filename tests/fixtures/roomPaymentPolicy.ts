import { LosslessNumber, stringify } from 'lossless-json';
import type { PaymentApplication, PaymentSource, RoomPaymentPolicy } from '../../src/types/roomPaymentPolicy';

export const roomId = '00000000-0000-0000-0000-000000000101';
export const buildingId = '00000000-0000-0000-0000-000000000201';
export const otherBuildingId = '00000000-0000-0000-0000-000000000299';
export const cashSourceId = '00000000-0000-0000-0000-000000000301';
export const bankSourceId = '00000000-0000-0000-0000-000000000302';
export const inactiveBankSourceId = '00000000-0000-0000-0000-000000000303';
export const targetRoom1Id = '00000000-0000-0000-0000-000000000102';
export const targetRoom2Id = '00000000-0000-0000-0000-000000000103';
export const version = '0';
export const highVersion = '9223372036854775807';

export const cashSource: PaymentSource = {
  id: cashSourceId,
  name: 'Tiền mặt quản lý',
  type: 'CASH',
  active: true,
  bankDetails: null,
};

export const bankSource: PaymentSource = {
  id: bankSourceId,
  name: 'Vietcombank chính',
  type: 'BANK',
  active: true,
  bankDetails: {
    bankCode: 'VCB',
    accountNumber: '0071001234567',
    accountHolder: 'NGUYEN VAN A',
  },
};

export const inactiveBankSource: PaymentSource = {
  id: inactiveBankSourceId,
  name: 'Techcombank cũ',
  type: 'BANK',
  active: false,
  bankDetails: {
    bankCode: 'TCB',
    accountNumber: '19031234567890',
    accountHolder: 'NGUYEN VAN A',
  },
};

export const unconfiguredRoomPolicy: RoomPaymentPolicy = {
  roomId,
  roomCode: '101',
  roomName: 'Phòng 101',
  buildingId,
  buildingName: 'Tòa nhà Sunrise',
  configured: false,
  policy: null,
  version: null,
};

export const configuredRoomPolicy: RoomPaymentPolicy = {
  roomId,
  roomCode: '101',
  roomName: 'Phòng 101',
  buildingId,
  buildingName: 'Tòa nhà Sunrise',
  configured: true,
  policy: {
    allowCash: true,
    allowTransfer: true,
    cashDefault: cashSource,
    bankDefault: bankSource,
  },
  version: '0',
};

export const configuredCashOnlyPolicy: RoomPaymentPolicy = {
  roomId,
  roomCode: '101',
  roomName: 'Phòng 101',
  buildingId,
  buildingName: 'Tòa nhà Sunrise',
  configured: true,
  policy: {
    allowCash: true,
    allowTransfer: false,
    cashDefault: cashSource,
    bankDefault: null,
  },
  version: '1',
};

export const configuredBankOnlyPolicy: RoomPaymentPolicy = {
  roomId,
  roomCode: '101',
  roomName: 'Phòng 101',
  buildingId,
  buildingName: 'Tòa nhà Sunrise',
  configured: true,
  policy: {
    allowCash: false,
    allowTransfer: true,
    cashDefault: null,
    bankDefault: bankSource,
  },
  version: '2',
};

export const configuredWithInactivePolicy: RoomPaymentPolicy = {
  roomId,
  roomCode: '101',
  roomName: 'Phòng 101',
  buildingId,
  buildingName: 'Tòa nhà Sunrise',
  configured: true,
  policy: {
    allowCash: true,
    allowTransfer: true,
    cashDefault: cashSource,
    bankDefault: inactiveBankSource,
  },
  version: '3',
};

export const applicableTargets: RoomPaymentPolicy[] = [
  {
    roomId: targetRoom1Id,
    roomCode: '102',
    roomName: 'Phòng 102',
    buildingId,
    buildingName: 'Tòa nhà Sunrise',
    configured: true,
    policy: {
      allowCash: true,
      allowTransfer: false,
      cashDefault: cashSource,
      bankDefault: null,
    },
    version: '0',
  },
  {
    roomId: targetRoom2Id,
    roomCode: '103',
    roomName: 'Phòng 103',
    buildingId,
    buildingName: 'Tòa nhà Sunrise',
    configured: false,
    policy: null,
    version: null,
  },
];

export const sampleApplication: PaymentApplication = {
  count: 2,
  rooms: [
    { roomId: targetRoom1Id, roomCode: '102', roomName: 'Phòng 102' },
    { roomId: targetRoom2Id, roomCode: '103', roomName: 'Phòng 103' },
  ],
};

export function roomPaymentWire(policy: RoomPaymentPolicy, rawVersion?: string | number | null) {
  const ver = rawVersion !== undefined
    ? (rawVersion === null ? null : typeof rawVersion === 'number' ? rawVersion : new LosslessNumber(rawVersion))
    : (policy.version === null ? null : new LosslessNumber(policy.version));
  return {
    roomId: policy.roomId,
    roomCode: policy.roomCode,
    roomName: policy.roomName,
    buildingId: policy.buildingId,
    buildingName: policy.buildingName,
    configured: policy.configured,
    policy: policy.policy
      ? {
          allowCash: policy.policy.allowCash,
          allowTransfer: policy.policy.allowTransfer,
          cashDefault: policy.policy.cashDefault
            ? {
                id: policy.policy.cashDefault.id,
                name: policy.policy.cashDefault.name,
                type: policy.policy.cashDefault.type,
                active: policy.policy.cashDefault.active,
                bankDetails: policy.policy.cashDefault.bankDetails,
              }
            : null,
          bankDefault: policy.policy.bankDefault
            ? {
                id: policy.policy.bankDefault.id,
                name: policy.policy.bankDefault.name,
                type: policy.policy.bankDefault.type,
                active: policy.policy.bankDefault.active,
                bankDetails: policy.policy.bankDefault.bankDetails,
              }
            : null,
        }
      : null,
    version: ver,
  };
}

export function paymentPolicyReply(data: unknown, status = 200, message = 'Success') {
  const body = stringify({ status, message, data });
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
