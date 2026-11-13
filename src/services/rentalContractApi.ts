import { AuthApiError, clearCsrfCache, getCsrfToken } from './authApi';
import type {
  ConvertDepositToRentalInput,
  CreateRentalContractInput,
  UpdateActiveRentalContractInput,
  RentalContractFilterInput,
  RentalContract,
  AvailableRoomForRental,
  AvailableCustomerForRental,
  ExpiringRentalContract,
  PageResponse,
} from '../types/rentalContract';

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
  // Lập hợp đồng thuê trực tiếp (UC27 - Luồng chính)
  createRentalContract: (input: CreateRentalContractInput): Promise<RentalContract> => {
    return mutate<RentalContract>('/rental-contracts', 'POST', input);
  },

  // Cập nhật hợp đồng thuê đang hiệu lực (UC27 - Luồng thay thế 2)
  updateActiveRentalContract: (id: string, input: UpdateActiveRentalContractInput): Promise<RentalContract> => {
    return mutate<RentalContract>(`/rental-contracts/${encodeURIComponent(id)}`, 'PUT', input);
  },

  // Cập nhật hợp đồng thuê ở trạng thái Nháp (UC27 - Luồng thay thế 1)
  updateDraftRentalContract: (id: string, input: CreateRentalContractInput): Promise<RentalContract> => {
    return mutate<RentalContract>(`/rental-contracts/${encodeURIComponent(id)}/draft`, 'PUT', input);
  },

  // Chuyển đặt cọc thành hợp đồng thuê (UC26)
  convertDepositToRental: (depositId: string, input: ConvertDepositToRentalInput): Promise<RentalContract> => {
    return mutate<RentalContract>(`/rental-contracts/convert-from-deposit/${encodeURIComponent(depositId)}`, 'POST', input);
  },

  // Lấy chi tiết hợp đồng thuê
  getRentalContractDetail: (id: string): Promise<RentalContract> => {
    return request<RentalContract>(`/rental-contracts/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
  },

  // Tìm kiếm và phân trang hợp đồng thuê (UC28)
  searchRentalContracts: (params: RentalContractFilterInput = {}): Promise<PageResponse<RentalContract>> => {
    const query = new URLSearchParams();
    if (params.keyword?.trim()) query.set('keyword', params.keyword.trim());
    if (params.status) query.set('status', params.status);
    if (params.areaId) query.set('areaId', params.areaId);
    if (params.buildingId) query.set('buildingId', params.buildingId);
    if (params.roomId) query.set('roomId', params.roomId);
    if (params.startDateFrom) query.set('startDateFrom', params.startDateFrom);
    if (params.startDateTo) query.set('startDateTo', params.startDateTo);
    if (params.endDateFrom) query.set('endDateFrom', params.endDateFrom);
    if (params.endDateTo) query.set('endDateTo', params.endDateTo);
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.size !== undefined) query.set('size', String(params.size));

    const qs = query.toString();
    return request<PageResponse<RentalContract>>(`/rental-contracts${qs ? `?${qs}` : ''}`, {
      method: 'GET',
    });
  },

  // Theo dõi hợp đồng thuê sắp hết hạn (UC28)
  getExpiringRentalContracts: (
    days = 30,
    page = 0,
    size = 20
  ): Promise<PageResponse<ExpiringRentalContract>> => {
    const query = new URLSearchParams({
      days: String(days),
      page: String(page),
      size: String(size),
    });
    return request<PageResponse<ExpiringRentalContract>>(`/rental-contracts/expiring?${query.toString()}`, {
      method: 'GET',
    });
  },

  // Đếm số lượng hợp đồng sắp hết hạn (UC28)
  countExpiringRentalContracts: (days = 30): Promise<number> => {
    return request<number>(`/rental-contracts/expiring-count?days=${days}`, {
      method: 'GET',
    });
  },

  // Customer xem hợp đồng thuê của chính mình (UC28)
  getMyRentalContracts: (page = 0, size = 10): Promise<PageResponse<RentalContract>> => {
    const query = new URLSearchParams({
      page: String(page),
      size: String(size),
    });
    return request<PageResponse<RentalContract>>(`/rental-contracts/my-contracts?${query.toString()}`, {
      method: 'GET',
    });
  },

  // Lấy danh sách phòng khả dụng (VACANT)
  getAvailableRooms: (): Promise<AvailableRoomForRental[]> => {
    return request<AvailableRoomForRental[]>('/rental-contracts/available-rooms', {
      method: 'GET',
    });
  },

  // Lấy danh sách khách thuê của Host
  getAvailableCustomers: (): Promise<AvailableCustomerForRental[]> => {
    return request<AvailableCustomerForRental[]>('/rental-contracts/available-customers', {
      method: 'GET',
    });
  },
};
