import { isLosslessNumber, LosslessNumber, parse, stringify } from 'lossless-json';
import type {
  CreateCustomerInput,
  CreateVehicleInput,
  CustomerPageResponse,
  CustomerResponse,
  CustomerVehiclesResponse,
  IdentityType,
  UpdateCustomerInput,
  UpdateVehicleInput,
  VehicleResponse,
} from '../types/customer';
import { isUuid } from '../utils/customerNavigation';
import { isIdentityType, isVehicleType, isValidIsoDate } from '../utils/customerValidation';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseCustomerJson = (text: string): unknown => parse(text);

export function safeVersion(value: unknown): string | null {
  const text = isLosslessNumber(value)
    ? value.toString()
    : typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
      ? String(value)
      : typeof value === 'string' && /^\d+$/.test(value)
        ? value
        : null;
  if (!text || !/^\d+$/.test(text)) return null;
  return text;
}

export function safeInteger(value: unknown): number | null {
  const text = isLosslessNumber(value) ? value.toString() : typeof value === 'number' ? String(value) : '';
  if (!/^\d+$/.test(text)) return null;
  const result = Number(text);
  return Number.isSafeInteger(result) && result >= 0 ? result : null;
}

export function decodeCustomerResponse(value: unknown): CustomerResponse {
  if (!isRecord(value)) throw new Error('Invalid customer record');
  if (!isUuid(value.id)) throw new Error('Invalid customer ID');
  if (typeof value.fullName !== 'string' || !value.fullName.trim() || value.fullName.length > 255) {
    throw new Error('Invalid fullName');
  }

  const phone = value.phone === null ? null : typeof value.phone === 'string' ? value.phone : undefined;
  if (phone === undefined) throw new Error('Invalid phone');

  const email = value.email === null ? null : typeof value.email === 'string' ? value.email : undefined;
  if (email === undefined) throw new Error('Invalid email');

  let identityType: IdentityType | null = null;
  if (value.identityType !== null) {
    if (!isIdentityType(value.identityType)) throw new Error('Invalid identityType');
    identityType = value.identityType;
  }

  const identityNo = value.identityNo === null ? null : typeof value.identityNo === 'string' ? value.identityNo : undefined;
  if (identityNo === undefined) throw new Error('Invalid identityNo');

  let birthDate: string | null = null;
  if (value.birthDate !== null) {
    if (typeof value.birthDate !== 'string' || !isValidIsoDate(value.birthDate)) {
      throw new Error('Invalid birthDate');
    }
    birthDate = value.birthDate;
  }

  const address = value.address === null ? null : typeof value.address === 'string' ? value.address : undefined;
  if (address === undefined) throw new Error('Invalid address');

  const note = value.note === null ? null : typeof value.note === 'string' ? value.note : undefined;
  if (note === undefined) throw new Error('Invalid note');

  const version = safeVersion(value.version);
  if (version === null) throw new Error('Invalid version');

  return {
    id: value.id,
    fullName: value.fullName,
    phone,
    email,
    identityType,
    identityNo,
    birthDate,
    address,
    note,
    version,
  };
}

export function decodeCustomerPageResponse(value: unknown): CustomerPageResponse {
  if (!isRecord(value)) throw new Error('Invalid customer page');
  if (!Array.isArray(value.content)) throw new Error('Invalid customer page content');

  const content = value.content.map(decodeCustomerResponse);
  const page = safeInteger(value.page);
  const size = safeInteger(value.size);
  const totalElements = safeInteger(value.totalElements);
  const totalPages = safeInteger(value.totalPages);

  if (
    page === null ||
    size === null ||
    totalElements === null ||
    totalPages === null ||
    typeof value.first !== 'boolean' ||
    typeof value.last !== 'boolean'
  ) {
    throw new Error('Invalid page metadata');
  }

  return {
    content,
    page,
    size,
    totalElements,
    totalPages,
    first: value.first,
    last: value.last,
  };
}

export function decodeVehicleResponse(value: unknown): VehicleResponse {
  if (!isRecord(value)) throw new Error('Invalid vehicle record');
  if (!isUuid(value.id)) throw new Error('Invalid vehicle ID');
  if (!isUuid(value.customerId)) throw new Error('Invalid customer ID in vehicle');
  if (!isVehicleType(value.type)) throw new Error('Invalid vehicle type');
  if (typeof value.plateNumber !== 'string' || !value.plateNumber.trim() || value.plateNumber.length > 255) {
    throw new Error('Invalid plateNumber');
  }

  const note = value.note === null ? null : typeof value.note === 'string' ? value.note : undefined;
  if (note === undefined) throw new Error('Invalid note in vehicle');

  const version = safeVersion(value.version);
  if (version === null) throw new Error('Invalid vehicle version');

  const customerVersion = safeVersion(value.customerVersion);
  if (customerVersion === null) throw new Error('Invalid customerVersion in vehicle');

  return {
    id: value.id,
    customerId: value.customerId,
    type: value.type,
    plateNumber: value.plateNumber,
    note,
    version,
    customerVersion,
  };
}

export function decodeCustomerVehiclesResponse(value: unknown): CustomerVehiclesResponse {
  if (!isRecord(value)) throw new Error('Invalid customer vehicles response');
  if (!isUuid(value.customerId)) throw new Error('Invalid customer ID');
  const customerVersion = safeVersion(value.customerVersion);
  if (customerVersion === null) throw new Error('Invalid customerVersion');
  if (!Array.isArray(value.vehicles)) throw new Error('Invalid vehicles array');

  const vehicles = value.vehicles.map(decodeVehicleResponse);
  return {
    customerId: value.customerId,
    customerVersion,
    vehicles,
  };
}

export function encodeCreateCustomerBody(input: CreateCustomerInput): string {
  const body: Record<string, unknown> = {
    fullName: input.fullName.trim(),
  };

  if (input.phone !== undefined && input.phone !== null && input.phone.trim()) {
    body.phone = input.phone.trim();
  }
  if (input.email !== undefined && input.email !== null && input.email.trim()) {
    body.email = input.email.trim();
  }
  if (input.identityType && isIdentityType(input.identityType)) {
    body.identityType = input.identityType;
  }
  if (input.identityNo !== undefined && input.identityNo !== null && input.identityNo.trim()) {
    body.identityNo = input.identityNo.trim().toUpperCase();
  }
  if (input.birthDate !== undefined && input.birthDate !== null && input.birthDate.trim()) {
    body.birthDate = input.birthDate.trim();
  }
  if (input.address !== undefined && input.address !== null && input.address.trim()) {
    body.address = input.address.trim();
  }
  if (input.note !== undefined && input.note !== null && input.note.trim()) {
    body.note = input.note.trim();
  }

  return stringify(body) || '{}';
}

export function encodeUpdateCustomerBody(input: UpdateCustomerInput): string {
  const body: Record<string, unknown> = {
    fullName: input.fullName.trim(),
    version: new LosslessNumber(input.version),
  };

  body.phone = input.phone && input.phone.trim() ? input.phone.trim() : null;
  body.email = input.email && input.email.trim() ? input.email.trim() : null;
  body.identityType = input.identityType && isIdentityType(input.identityType) ? input.identityType : null;
  body.identityNo = input.identityNo && input.identityNo.trim() ? input.identityNo.trim().toUpperCase() : null;
  body.birthDate = input.birthDate && input.birthDate.trim() ? input.birthDate.trim() : null;
  body.address = input.address && input.address.trim() ? input.address.trim() : null;
  body.note = input.note && input.note.trim() ? input.note.trim() : null;

  return stringify(body) || '{}';
}

export function encodeCreateVehicleBody(input: CreateVehicleInput): string {
  const body: Record<string, unknown> = {
    type: input.type,
    plateNumber: input.plateNumber.trim(),
    customerVersion: new LosslessNumber(input.customerVersion),
  };
  if (input.note !== undefined && input.note !== null && input.note.trim()) {
    body.note = input.note.trim();
  }
  return stringify(body) || '{}';
}

export function encodeUpdateVehicleBody(input: UpdateVehicleInput): string {
  const body: Record<string, unknown> = {
    type: input.type,
    plateNumber: input.plateNumber.trim(),
    version: new LosslessNumber(input.version),
    customerVersion: new LosslessNumber(input.customerVersion),
  };
  body.note = input.note && input.note.trim() ? input.note.trim() : null;
  return stringify(body) || '{}';
}
