import { LosslessNumber, stringify } from 'lossless-json';
import type { CustomerAccountResponse, ProvisionCustomerAccountInput } from '../types/customerAccount';
import { isUuid } from '../utils/customerNavigation';
import { isRecord, safeVersion } from './customerCodec';

export class CustomerAccountIntegrityError extends Error {
  constructor() { super('Invalid Customer account relationship'); this.name = 'CustomerAccountIntegrityError'; }
}

export function accountVersion(value: unknown): string {
  const version = safeVersion(value);
  if (version === null || BigInt(version) > 9223372036854775807n) throw new Error('Invalid customer version');
  return version;
}

export function decodeCustomerAccount(value: unknown, customerId: string): CustomerAccountResponse {
  if (!isRecord(value) || !isUuid(value.customerId) || value.customerId !== customerId || typeof value.hasAccount !== 'boolean') {
    throw new CustomerAccountIntegrityError();
  }
  const customerVersion = accountVersion(value.customerVersion);
  if (!value.hasAccount) {
    if (['accountId', 'loginName', 'role', 'status', 'createdAt'].some((key) => value[key] !== null)) throw new CustomerAccountIntegrityError();
    return { customerId, hasAccount: false, accountId: null, loginName: null, role: null, status: null, createdAt: null, customerVersion };
  }
  if (value.role !== 'CUSTOMER' || !isUuid(value.accountId)) throw new CustomerAccountIntegrityError();
  if (typeof value.loginName !== 'string' || !value.loginName.trim() || value.loginName.length > 255 ||
      value.status !== 'ACTIVE' && value.status !== 'LOCKED' || typeof value.createdAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value.createdAt) ||
      !Number.isFinite(Date.parse(value.createdAt))) throw new Error('Invalid Customer account response');
  return { customerId, hasAccount: true, accountId: value.accountId, loginName: value.loginName,
    role: 'CUSTOMER', status: value.status, createdAt: value.createdAt, customerVersion };
}

export function encodeProvisionCustomerAccount(input: ProvisionCustomerAccountInput): string {
  const allowed = ['email', 'password', 'confirmPassword', 'customerVersion'];
  if (Object.keys(input).some((key) => !allowed.includes(key)) ||
      !['email', 'password', 'confirmPassword'].every((key) => typeof input[key as keyof ProvisionCustomerAccountInput] === 'string')) {
    throw new Error('Invalid provision request fields');
  }
  return stringify({ email: input.email.trim(), password: input.password, confirmPassword: input.confirmPassword,
    customerVersion: new LosslessNumber(accountVersion(input.customerVersion)) })!;
}
