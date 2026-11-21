import { AuthApiError } from './authErrors';
import { authenticatedFetch } from './sessionClient';
import { rentalProfileMessages, type RentalProfile, type RentalProfileData, type RentedRoom } from '../types/rentalProfile';

const base = import.meta.env.VITE_API_URL || '/api/v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isProfile(value: unknown): value is RentalProfile {
  return isRecord(value) && typeof value.fullName === 'string'
    && ['phone', 'email', 'identityType', 'identityNo', 'birthDate', 'address'].every((field) => nullableString(value[field]));
}

function isRoom(value: unknown): value is RentedRoom {
  return isRecord(value)
    && ['code', 'name', 'floor', 'buildingName'].every((field) => typeof value[field] === 'string')
    && nullableString(value.buildingAddress)
    && (value.area === null || (typeof value.area === 'number' && Number.isFinite(value.area)));
}

function isRentalProfileData(value: unknown): value is RentalProfileData {
  if (!isRecord(value) || !isProfile(value.profile) || !nullableString(value.roomsMessage)) return false;
  switch (value.roomsStatus) {
    case 'LOADED': return Array.isArray(value.rooms) && value.rooms.length > 0 && value.rooms.every(isRoom);
    case 'EMPTY': return Array.isArray(value.rooms) && value.rooms.length === 0;
    case 'LOAD_FAILED':
    case 'INVALID_LINK': return value.rooms === null;
    default: return false;
  }
}

export async function getRentalProfile(signal: AbortSignal): Promise<RentalProfileData> {
  const response = await authenticatedFetch(`${base}/customers/me/rental-profile`, {
    method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' }, signal,
  });
  if (!response.ok) throw new AuthApiError(response.status, rentalProfileMessages.profileFailure);
  const body: unknown = await response.json();
  if (!isRecord(body) || body.status !== 200 || !isRentalProfileData(body.data)) {
    throw new Error(rentalProfileMessages.profileFailure);
  }
  return body.data;
}
