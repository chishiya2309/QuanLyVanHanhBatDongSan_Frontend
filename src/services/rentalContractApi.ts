import { AuthApiError, clearCsrfCache, getCsrfToken } from './authApi';
import type { ConvertDepositToRentalInput, RentalContract } from '../types/rentalContract';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');

export class RentalContractApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'RentalContractApiError';
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

    throw new RentalContractApiError(status, message, fieldErrors);
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

async function mutate<T>(path: string, method: string, body?: unknown): Promise<T> {
  let headerName: string | undefined;
  let token: string | undefined;

  try {
    const csrf = await getCsrfToken();
    headerName = csrf.headerName;
    token = csrf.token;
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) {
      throw new RentalContractApiError(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại');
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (headerName && token) {
    headers[headerName] = token;
  }

  return request<T>(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export const rentalContractApi = {
  convertDepositToRental: (depositId: string, input: ConvertDepositToRentalInput): Promise<RentalContract> => {
    return mutate<RentalContract>(`/rental-contracts/convert-from-deposit/${encodeURIComponent(depositId)}`, 'POST', input);
  },

  getRentalContractDetail: (id: string): Promise<RentalContract> => {
    return request<RentalContract>(`/rental-contracts/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
  },
};
