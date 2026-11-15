import { isLosslessNumber, LosslessNumber, parse, stringify } from 'lossless-json';
import { isRecord, safeInteger } from './assetCodec';
import { isAssetId } from '../utils/assetNavigation';
import { catalogVersion } from '../utils/serviceCatalogValidation';
import type { AffectedRoom, BankDetails, DeactivationImpact, FundingSource, SupportedBank } from '../types/fundingSource';
const fail = (): never => { throw new Error('Invalid funding response'); };
export const parseFundingJson = (text: string): unknown => parse(text);
const text = (v: unknown, max = 255): v is string => typeof v === 'string' && !!v.trim() && [...v].length <= max;
export function decodeFundingSource(v: unknown): FundingSource {
  if (!isRecord(v) || !isAssetId(v.id) || !text(v.name, 100) || !['CASH', 'BANK'].includes(String(v.type)) ||
    typeof v.active !== 'boolean' || typeof v.hasTransactions !== 'boolean' || typeof v.canEditBankDetails !== 'boolean') return fail();
  const version = isLosslessNumber(v.version) ? catalogVersion(v.version.toString()) : null;
  if (version === null || v.canEditBankDetails !== (v.type === 'BANK' && !v.hasTransactions)) return fail();
  let bankDetails: BankDetails | null = null;
  if (v.type === 'BANK') {
    const b = v.bankDetails;
    if (!isRecord(b) || !text(b.bankCode, 30) || typeof b.accountNumber !== 'string' || !/^[0-9]{6,25}$/.test(b.accountNumber) || !text(b.accountHolder)) return fail();
    bankDetails = { bankCode: b.bankCode, accountNumber: b.accountNumber, accountHolder: b.accountHolder };
  } else if (v.bankDetails !== null) return fail();
  return { id: v.id, name: v.name, type: v.type as FundingSource['type'], active: v.active, hasTransactions: v.hasTransactions, canEditBankDetails: v.canEditBankDetails, bankDetails, version };
}
export function decodeFundingList(v: unknown): FundingSource[] {
  if (!Array.isArray(v)) return fail(); const rows = v.map(decodeFundingSource);
  if (new Set(rows.map(r => r.id)).size !== rows.length) return fail(); return rows;
}
export function decodeBanks(v: unknown): SupportedBank[] {
  if (!Array.isArray(v)) return fail();
  const banks = v.map(b => { if (!isRecord(b) || !text(b.bankCode, 30) || !text(b.name)) return fail(); return { bankCode: b.bankCode, name: b.name }; });
  if (new Set(banks.map(b => b.bankCode)).size !== banks.length) return fail(); return banks;
}
export function decodeImpact(v: unknown): DeactivationImpact {
  if (!isRecord(v) || !isAssetId(v.sourceId) || typeof v.active !== 'boolean' || !text(v.warning, 2000) ||
    typeof v.confirmationToken !== 'string' || !/^[a-f0-9]{64}$/.test(v.confirmationToken) || !Array.isArray(v.affectedRooms)) return fail();
  const version = isLosslessNumber(v.version) ? catalogVersion(v.version.toString()) : null, totalRooms = safeInteger(v.totalRooms);
  if (version === null || totalRooms === null || totalRooms < 0) return fail();
  const rooms: AffectedRoom[] = v.affectedRooms.map(r => {
    if (!isRecord(r) || !isAssetId(r.roomId) || !text(r.roomCode) || !text(r.roomName) || !text(r.buildingName) || !['CASH', 'BANK'].includes(String(r.defaultRole))) return fail();
    return { roomId: r.roomId, roomCode: r.roomCode, roomName: r.roomName, buildingName: r.buildingName, defaultRole: r.defaultRole as AffectedRoom['defaultRole'] };
  });
  if (rooms.length !== totalRooms || new Set(rooms.map(r => r.roomId)).size !== rooms.length) return fail();
  return { sourceId: v.sourceId, active: v.active, version, affectedRooms: rooms, totalRooms, warning: v.warning, confirmationToken: v.confirmationToken };
}
export function encodeFundingBody(fields: Record<string, unknown>): string {
  const body = { ...fields };
  if (Object.hasOwn(body, 'version')) {
    const version = typeof body.version === 'string' ? catalogVersion(body.version) : null;
    if (version === null) return fail(); body.version = new LosslessNumber(version);
  }
  return stringify(body)!;
}
