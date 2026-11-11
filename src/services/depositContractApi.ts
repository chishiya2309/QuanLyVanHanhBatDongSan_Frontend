import { AuthApiError, clearCsrfCache, getCsrfToken } from './authApi';
import type {
  AvailableCustomerForDeposit,
  AvailableRoomForDeposit,
  CreateDepositContractInput,
  DepositContract,
  DepositContractFilter,
  PageResponse,
  QuickCreateCustomerInput,
  UpdateDepositContractInput,
} from '../types/depositContract';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');

export class DepositContractApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'DepositContractApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const status = response.status;
    let message = 'Đã có lỗi xảy ra. Vui lòng thử lại';
    const fieldErrors: Record<string, string> = {};

    if (json && typeof json === 'object') {
      if (typeof json.message === 'string') {
        message = json.message;
      }
      if (json.fieldErrors && typeof json.fieldErrors === 'object') {
        for (const [k, v] of Object.entries(json.fieldErrors)) {
          if (typeof v === 'string') fieldErrors[k] = v;
        }
      }
    }

    if (status === 401) {
      message = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại';
    } else if (status === 403 && message.includes('CSRF')) {
      clearCsrfCache();
    }

    throw new DepositContractApiError(status, message, fieldErrors);
  }

  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }
  return json as unknown as T;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
  });
  return handleResponse<T>(response);
}

async function mutate<T>(path: string, method: 'POST' | 'PUT', body?: unknown): Promise<T> {
  let headerName: string;
  let token: string;

  try {
    const csrf = await getCsrfToken();
    headerName = csrf.headerName;
    token = csrf.token;
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) {
      throw new DepositContractApiError(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại');
    }
    throw error;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      [headerName]: token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return handleResponse<T>(response);
}

export async function getDepositContracts(filter: DepositContractFilter = {}): Promise<PageResponse<DepositContract>> {
  const params = new URLSearchParams();
  if (filter.keyword) params.set('keyword', filter.keyword);
  if (filter.status) params.set('status', filter.status);
  if (filter.roomId) params.set('roomId', filter.roomId);
  if (filter.page !== undefined) params.set('page', String(filter.page));
  if (filter.size !== undefined) params.set('size', String(filter.size));

  const query = params.toString();
  return request<PageResponse<DepositContract>>(`/deposit-contracts${query ? `?${query}` : ''}`);
}

export async function getDepositContractDetail(id: string): Promise<DepositContract> {
  return request<DepositContract>(`/deposit-contracts/${id}`);
}

export async function getAvailableRoomsForDeposit(): Promise<AvailableRoomForDeposit[]> {
  return request<AvailableRoomForDeposit[]>('/deposit-contracts/available-rooms');
}

export async function getAvailableCustomersForDeposit(): Promise<AvailableCustomerForDeposit[]> {
  return request<AvailableCustomerForDeposit[]>('/deposit-contracts/available-customers');
}

export async function createDepositContract(input: CreateDepositContractInput): Promise<DepositContract> {
  return mutate<DepositContract>('/deposit-contracts', 'POST', input);
}

export async function updateDepositContract(id: string, input: UpdateDepositContractInput): Promise<DepositContract> {
  return mutate<DepositContract>(`/deposit-contracts/${id}`, 'PUT', input);
}

export async function quickCreateCustomer(input: QuickCreateCustomerInput): Promise<AvailableCustomerForDeposit> {
  return mutate<AvailableCustomerForDeposit>('/deposit-contracts/quick-customer', 'POST', input);
}

export async function cancelDepositContract(id: string, reason: string): Promise<DepositContract> {
  return mutate<DepositContract>(`/deposit-contracts/${id}/cancel`, 'POST', { reason });
}

