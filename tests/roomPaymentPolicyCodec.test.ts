import { describe, expect, it } from 'vitest';
import { LosslessNumber, parse, stringify } from 'lossless-json';
import {
  decodePaymentApplication,
  decodePaymentSource,
  decodePaymentTargets,
  decodeRoomPaymentPolicy,
  encodePaymentApplication,
  encodePaymentSave,
  parsePaymentJson,
} from '../src/services/roomPaymentPolicyCodec';
import {
  applicableTargets,
  bankSourceId,
  buildingId,
  cashSourceId,
  configuredBankOnlyPolicy,
  configuredCashOnlyPolicy,
  configuredRoomPolicy,
  configuredWithInactivePolicy,
  highVersion,
  otherBuildingId,
  roomId,
  roomPaymentWire,
  sampleApplication,
  targetRoom1Id,
  targetRoom2Id,
  unconfiguredRoomPolicy,
} from './fixtures/roomPaymentPolicy';

describe('UC42 Room Payment Policy Codec', () => {
  describe('decodeRoomPaymentPolicy', () => {
    it('decodes unconfigured room policy with policy=null and version=null', () => {
      const wire = roomPaymentWire(unconfiguredRoomPolicy);
      const decoded = decodeRoomPaymentPolicy(wire, roomId);
      expect(decoded.configured).toBe(false);
      expect(decoded.policy).toBeNull();
      expect(decoded.version).toBeNull();
      expect(decoded.roomId).toBe(roomId);
      expect(decoded.buildingId).toBe(buildingId);
    });

    it('decodes configured room policy with both CASH and BANK methods', () => {
      const wire = roomPaymentWire(configuredRoomPolicy);
      const decoded = decodeRoomPaymentPolicy(wire, roomId);
      expect(decoded.configured).toBe(true);
      expect(decoded.policy?.allowCash).toBe(true);
      expect(decoded.policy?.allowTransfer).toBe(true);
      expect(decoded.policy?.cashDefault?.id).toBe(cashSourceId);
      expect(decoded.policy?.bankDefault?.id).toBe(bankSourceId);
      expect(decoded.policy?.bankDefault?.bankDetails?.accountNumber).toBe('0071001234567');
      expect(decoded.version).toBe('0');
    });

    it('decodes configured room policy with only cash', () => {
      const wire = roomPaymentWire(configuredCashOnlyPolicy);
      const decoded = decodeRoomPaymentPolicy(wire, roomId);
      expect(decoded.configured).toBe(true);
      expect(decoded.policy?.allowCash).toBe(true);
      expect(decoded.policy?.allowTransfer).toBe(false);
      expect(decoded.policy?.cashDefault?.id).toBe(cashSourceId);
      expect(decoded.policy?.bankDefault).toBeNull();
      expect(decoded.version).toBe('1');
    });

    it('decodes configured room policy with only bank', () => {
      const wire = roomPaymentWire(configuredBankOnlyPolicy);
      const decoded = decodeRoomPaymentPolicy(wire, roomId);
      expect(decoded.configured).toBe(true);
      expect(decoded.policy?.allowCash).toBe(false);
      expect(decoded.policy?.allowTransfer).toBe(true);
      expect(decoded.policy?.cashDefault).toBeNull();
      expect(decoded.policy?.bankDefault?.id).toBe(bankSourceId);
      expect(decoded.version).toBe('2');
    });

    it('decodes configured room policy retaining inactive bank default', () => {
      const wire = roomPaymentWire(configuredWithInactivePolicy);
      const decoded = decodeRoomPaymentPolicy(wire, roomId);
      expect(decoded.configured).toBe(true);
      expect(decoded.policy?.bankDefault?.active).toBe(false);
      expect(decoded.policy?.bankDefault?.name).toBe('Techcombank cũ');
    });

    it('preserves 19-digit version without precision loss', () => {
      const wire = roomPaymentWire(configuredRoomPolicy, highVersion);
      const json = stringify(wire)!;
      const parsed = parsePaymentJson(json);
      const decoded = decodeRoomPaymentPolicy(parsed, roomId);
      expect(decoded.version).toBe(highVersion);
    });

    it('rejects unconfigured payload if policy or version is not null', () => {
      const wire = { ...roomPaymentWire(unconfiguredRoomPolicy), version: new LosslessNumber('1') };
      expect(() => decodeRoomPaymentPolicy(wire, roomId)).toThrow();
    });

    it('rejects configured payload if both methods are false', () => {
      const wire = {
        ...roomPaymentWire(configuredRoomPolicy),
        policy: { allowCash: false, allowTransfer: false, cashDefault: null, bankDefault: null },
      };
      expect(() => decodeRoomPaymentPolicy(wire, roomId)).toThrow();
    });

    it('rejects configured payload if roomId does not match expected roomId', () => {
      const wire = roomPaymentWire(configuredRoomPolicy);
      expect(() => decodeRoomPaymentPolicy(wire, targetRoom1Id)).toThrow();
    });
  });

  describe('decodePaymentSource', () => {
    it('decodes CASH source successfully', () => {
      const source = decodePaymentSource({
        id: cashSourceId,
        name: 'Tiền mặt',
        type: 'CASH',
        active: true,
        bankDetails: null,
      }, 'CASH');
      expect(source.id).toBe(cashSourceId);
      expect(source.type).toBe('CASH');
      expect(source.bankDetails).toBeNull();
    });

    it('decodes BANK source preserving leading zeros in account number', () => {
      const source = decodePaymentSource({
        id: bankSourceId,
        name: 'Vietcombank',
        type: 'BANK',
        active: true,
        bankDetails: {
          bankCode: 'VCB',
          accountNumber: '0071001234567',
          accountHolder: 'NGUYEN VAN A',
        },
      }, 'BANK');
      expect(source.bankDetails?.accountNumber).toBe('0071001234567');
      expect(typeof source.bankDetails?.accountNumber).toBe('string');
    });

    it('rejects CASH source if it has non-null bankDetails', () => {
      expect(() => decodePaymentSource({
        id: cashSourceId,
        name: 'Tiền mặt',
        type: 'CASH',
        active: true,
        bankDetails: { bankCode: 'VCB', accountNumber: '1234567', accountHolder: 'A' },
      }, 'CASH')).toThrow();
    });

    it('rejects BANK source if account number is invalid format or non-string', () => {
      expect(() => decodePaymentSource({
        id: bankSourceId,
        name: 'Bank',
        type: 'BANK',
        active: true,
        bankDetails: { bankCode: 'VCB', accountNumber: '123', accountHolder: 'A' }, // too short
      }, 'BANK')).toThrow();
    });
  });

  describe('decodePaymentTargets', () => {
    it('decodes targets belonging to the same building excluding source room', () => {
      const wire = applicableTargets.map(t => roomPaymentWire(t));
      const targets = decodePaymentTargets(wire, configuredRoomPolicy);
      expect(targets).toHaveLength(2);
      expect(targets[0].roomId).toBe(targetRoom1Id);
      expect(targets[1].roomId).toBe(targetRoom2Id);
    });

    it('rejects targets containing the source room itself', () => {
      const wire = [roomPaymentWire(configuredRoomPolicy)];
      expect(() => decodePaymentTargets(wire, configuredRoomPolicy)).toThrow();
    });

    it('rejects targets from a different building', () => {
      const diffBuildingTarget = { ...applicableTargets[0], buildingId: otherBuildingId };
      const wire = [roomPaymentWire(diffBuildingTarget)];
      expect(() => decodePaymentTargets(wire, configuredRoomPolicy)).toThrow();
    });

    it('rejects targets with duplicate room IDs', () => {
      const wire = [roomPaymentWire(applicableTargets[0]), roomPaymentWire(applicableTargets[0])];
      expect(() => decodePaymentTargets(wire, configuredRoomPolicy)).toThrow();
    });
  });

  describe('decodePaymentApplication', () => {
    it('decodes valid application result', () => {
      const app = decodePaymentApplication(sampleApplication, roomId, [targetRoom1Id, targetRoom2Id]);
      expect(app.count).toBe(2);
      expect(app.rooms).toHaveLength(2);
    });

    it('rejects application result if count does not match room array length', () => {
      const invalid = { count: 3, rooms: sampleApplication.rooms };
      expect(() => decodePaymentApplication(invalid, roomId, null)).toThrow();
    });

    it('rejects application result containing source room', () => {
      const invalid = { count: 1, rooms: [{ roomId, roomCode: '101', roomName: 'Phòng 101' }] };
      expect(() => decodePaymentApplication(invalid, roomId, null)).toThrow();
    });
  });

  describe('encodePaymentSave', () => {
    it('encodes new policy creation with null version', () => {
      const draft = {
        allowCash: true,
        allowTransfer: true,
        cashDefaultId: cashSourceId,
        bankDefaultId: bankSourceId,
      };
      const json = encodePaymentSave(draft, null);
      const parsed = parse(json) as Record<string, unknown>;
      expect(parsed.allowCash).toBe(true);
      expect(parsed.allowTransfer).toBe(true);
      expect(parsed.cashDefaultId).toBe(cashSourceId);
      expect(parsed.bankDefaultId).toBe(bankSourceId);
      expect(parsed.version).toBeNull();
    });

    it('encodes policy update with existing version as numeric JSON value', () => {
      const draft = {
        allowCash: true,
        allowTransfer: false,
        cashDefaultId: cashSourceId,
        bankDefaultId: null,
      };
      const json = encodePaymentSave(draft, '5');
      expect(json).toContain('"version":5');
      const parsed = parse(json) as Record<string, unknown>;
      expect(parsed.cashDefaultId).toBe(cashSourceId);
      expect(parsed.bankDefaultId).toBeNull();
    });

    it('encodes 19-digit version without loss of precision', () => {
      const draft = {
        allowCash: false,
        allowTransfer: true,
        cashDefaultId: null,
        bankDefaultId: bankSourceId,
      };
      const json = encodePaymentSave(draft, highVersion);
      expect(json).toContain(`"version":${highVersion}`);
      const parsed = parse(json) as { version: LosslessNumber };
      expect(parsed.version.toString()).toBe(highVersion);
    });

    it('rejects encoding if both methods are disabled', () => {
      const draft = {
        allowCash: false,
        allowTransfer: false,
        cashDefaultId: null,
        bankDefaultId: null,
      };
      expect(() => encodePaymentSave(draft, '0')).toThrow();
    });

    it('rejects encoding if enabled method is missing default ID', () => {
      const draft = {
        allowCash: true,
        allowTransfer: false,
        cashDefaultId: null,
        bankDefaultId: null,
      };
      expect(() => encodePaymentSave(draft, '0')).toThrow();
    });
  });

  describe('encodePaymentApplication', () => {
    it('encodes batch application to all rooms (omits roomIds)', () => {
      const json = encodePaymentApplication(configuredRoomPolicy, true, []);
      const parsed = parse(json) as Record<string, unknown>;
      expect(parsed.applyToAll).toBe(true);
      expect(parsed.roomIds).toBeUndefined();
      expect(parsed.confirmed).toBe(true);
      expect((parsed.sourcePolicyVersion as LosslessNumber).toString()).toBe('0');
    });

    it('encodes batch application to selected rooms with unique roomIds', () => {
      const json = encodePaymentApplication(configuredRoomPolicy, false, [targetRoom1Id, targetRoom2Id, targetRoom1Id]);
      const parsed = parse(json) as { applyToAll: boolean; roomIds: string[]; confirmed: boolean };
      expect(parsed.applyToAll).toBe(false);
      expect(parsed.roomIds).toEqual([targetRoom1Id, targetRoom2Id]);
      expect(parsed.confirmed).toBe(true);
    });

    it('rejects encoding if source room is not configured', () => {
      expect(() => encodePaymentApplication(unconfiguredRoomPolicy, true, [])).toThrow();
    });

    it('rejects encoding if applyToAll is false but roomIds is empty', () => {
      expect(() => encodePaymentApplication(configuredRoomPolicy, false, [])).toThrow();
    });

    it('rejects encoding if selected rooms include source room', () => {
      expect(() => encodePaymentApplication(configuredRoomPolicy, false, [roomId])).toThrow();
    });
  });
});
