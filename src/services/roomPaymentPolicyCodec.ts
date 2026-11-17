import { isLosslessNumber, LosslessNumber, parse, stringify } from 'lossless-json';
import { isRecord, safeInteger } from './assetCodec';
import { isAssetId } from '../utils/assetNavigation';
import { catalogVersion } from '../utils/serviceCatalogValidation';
import type { PaymentApplication, PaymentDraft, PaymentSource, RoomPaymentPolicy } from '../types/roomPaymentPolicy';

export const parsePaymentJson = (text: string): unknown => parse(text);
const fail = (): never => { throw new Error('Invalid room payment policy response'); };
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
function version(v: unknown): string {
  const result = isLosslessNumber(v) ? catalogVersion(v.toString()) : null;
  return result ?? fail();
}
export function decodePaymentSource(v: unknown, type: 'CASH' | 'BANK'): PaymentSource {
  if (!isRecord(v) || !isAssetId(v.id) || !text(v.name) || v.type !== type || typeof v.active !== 'boolean') return fail();
  let bankDetails: PaymentSource['bankDetails'] = null;
  if (type === 'BANK') {
    const b = v.bankDetails;
    if (!isRecord(b) || !text(b.bankCode) || !text(b.accountHolder) || typeof b.accountNumber !== 'string' || !/^[0-9]{6,25}$/.test(b.accountNumber)) return fail();
    bankDetails = { bankCode: b.bankCode, accountHolder: b.accountHolder, accountNumber: b.accountNumber };
  } else if (v.bankDetails !== null) return fail();
  return { id: v.id, name: v.name, type, active: v.active, bankDetails };
}
export function decodeRoomPaymentPolicy(v: unknown, roomId?: string): RoomPaymentPolicy {
  if (!isRecord(v) || !isAssetId(v.roomId) || roomId !== undefined && roomId !== v.roomId || !isAssetId(v.buildingId)
      || !text(v.roomCode) || !text(v.roomName) || !text(v.buildingName) || typeof v.configured !== 'boolean') return fail();
  let policy: RoomPaymentPolicy['policy'] = null, policyVersion: string | null = null;
  if (!v.configured) {
    if (v.policy !== null || v.version !== null) return fail();
  } else {
    const p = v.policy;
    if (!isRecord(p) || typeof p.allowCash !== 'boolean' || typeof p.allowTransfer !== 'boolean' || !p.allowCash && !p.allowTransfer) return fail();
    if (!p.allowCash && p.cashDefault !== null || !p.allowTransfer && p.bankDefault !== null) return fail();
    policy = { allowCash: p.allowCash, allowTransfer: p.allowTransfer,
      cashDefault: p.allowCash ? decodePaymentSource(p.cashDefault, 'CASH') : null,
      bankDefault: p.allowTransfer ? decodePaymentSource(p.bankDefault, 'BANK') : null };
    policyVersion = version(v.version);
  }
  return { roomId: v.roomId, roomCode: v.roomCode, roomName: v.roomName, buildingId: v.buildingId,
    buildingName: v.buildingName, configured: v.configured, policy, version: policyVersion };
}
export function decodePaymentTargets(v: unknown, source: RoomPaymentPolicy): RoomPaymentPolicy[] {
  if (!Array.isArray(v)) return fail();
  const rows = v.map(item => decodeRoomPaymentPolicy(item));
  if (rows.some(r => r.roomId === source.roomId || r.buildingId !== source.buildingId) || new Set(rows.map(r => r.roomId)).size !== rows.length) return fail();
  return rows;
}
export function decodePaymentApplication(v: unknown, source: string, selected: string[] | null): PaymentApplication {
  if (!isRecord(v) || !Array.isArray(v.rooms)) return fail();
  const count = safeInteger(v.count);
  if (count === null || count < 0 || count !== v.rooms.length) return fail();
  const rooms = v.rooms.map(r => {
    if (!isRecord(r) || !isAssetId(r.roomId) || r.roomId === source || !text(r.roomCode) || !text(r.roomName)) return fail();
    return { roomId: r.roomId, roomCode: r.roomCode, roomName: r.roomName };
  });
  if (new Set(rooms.map(r => r.roomId)).size !== rooms.length || selected && (rooms.length !== selected.length || rooms.some(r => !selected.includes(r.roomId)))) return fail();
  return { count, rooms };
}
function wireVersion(value: string | null): LosslessNumber | null {
  if (value === null) return null;
  const result = catalogVersion(value);
  return result === null ? fail() : new LosslessNumber(result);
}
export function encodePaymentSave(draft: PaymentDraft, current: string | null): string {
  if (typeof draft.allowCash !== 'boolean' || typeof draft.allowTransfer !== 'boolean' || !draft.allowCash && !draft.allowTransfer) return fail();
  if (draft.allowCash && !isAssetId(draft.cashDefaultId) || draft.allowTransfer && !isAssetId(draft.bankDefaultId)) return fail();
  return stringify({ allowCash: draft.allowCash, allowTransfer: draft.allowTransfer,
    cashDefaultId: draft.allowCash ? draft.cashDefaultId : null, bankDefaultId: draft.allowTransfer ? draft.bankDefaultId : null, version: wireVersion(current) })!;
}
export function encodePaymentApplication(source: RoomPaymentPolicy, all: boolean, ids: string[]): string {
  if (!source.configured || source.version === null || typeof all !== 'boolean') return fail();
  const unique = [...new Set(ids)];
  if (all && unique.length || !all && !unique.length || unique.some(id => !isAssetId(id) || id === source.roomId)) return fail();
  return stringify({ applyToAll: all, ...(!all ? { roomIds: unique } : {}), sourcePolicyVersion: wireVersion(source.version), confirmed: true })!;
}
