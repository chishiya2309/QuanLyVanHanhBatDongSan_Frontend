import { clearCsrfCache, getCsrfToken } from './authApi';
import type {
  DocumentExportOptions,
  ExportDocumentRequest,
  PreviewDocumentRequest,
  ExportedDocumentItem,
  DocumentPreviewResponse,
} from '../types/documentExport';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');

export class DocumentExportApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'DocumentExportApiError';
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
    // Non-JSON
  }

  if (!response.ok) {
    const status = response.status;
    let message = 'Đã có lỗi xảy ra khi xử lý tài liệu.';
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

    throw new DocumentExportApiError(status, message, fieldErrors);
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
    console.warn('Cannot fetch CSRF token:', error);
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (headerName && token) {
    headers[headerName] = token;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return handleResponse<T>(response);
}

export const documentExportApi = {
  // Rental Contracts
  getRentalExportOptions: (contractId: string) => {
    return request<DocumentExportOptions>(`/rental-contracts/${contractId}/export-options`);
  },
  exportRentalContract: (contractId: string, req: ExportDocumentRequest) => {
    return mutate<ExportedDocumentItem>(`/rental-contracts/${contractId}/export`, 'POST', req);
  },
  previewRentalContract: (contractId: string, req: PreviewDocumentRequest) => {
    return mutate<DocumentPreviewResponse>(`/rental-contracts/${contractId}/preview`, 'POST', req);
  },
  getRentalExportHistory: (contractId: string) => {
    return request<ExportedDocumentItem[]>(`/rental-contracts/${contractId}/exported-documents`);
  },

  // Deposit Contracts
  getDepositExportOptions: (contractId: string) => {
    return request<DocumentExportOptions>(`/deposit-contracts/${contractId}/export-options`);
  },
  exportDepositContract: (contractId: string, req: ExportDocumentRequest) => {
    return mutate<ExportedDocumentItem>(`/deposit-contracts/${contractId}/export`, 'POST', req);
  },
  previewDepositContract: (contractId: string, req: PreviewDocumentRequest) => {
    return mutate<DocumentPreviewResponse>(`/deposit-contracts/${contractId}/preview`, 'POST', req);
  },
  getDepositExportHistory: (contractId: string) => {
    return request<ExportedDocumentItem[]>(`/deposit-contracts/${contractId}/exported-documents`);
  },

  // Handover Reports
  getHandoverExportOptions: (contractId: string, reportId: string) => {
    return request<DocumentExportOptions>(`/rental-contracts/${contractId}/handovers/${reportId}/export-options`);
  },
  exportHandover: (contractId: string, reportId: string, req: ExportDocumentRequest) => {
    return mutate<ExportedDocumentItem>(`/rental-contracts/${contractId}/handovers/${reportId}/export`, 'POST', req);
  },
  previewHandover: (contractId: string, reportId: string, req: PreviewDocumentRequest) => {
    return mutate<DocumentPreviewResponse>(`/rental-contracts/${contractId}/handovers/${reportId}/preview`, 'POST', req);
  },
  getHandoverExportHistory: (contractId: string, reportId: string) => {
    return request<ExportedDocumentItem[]>(`/rental-contracts/${contractId}/handovers/${reportId}/exported-documents`);
  },

  // Fetch Preview Binary Blob (for inline iframe)
  fetchPreviewBlob: async (previewToken: string): Promise<Blob> => {
    const response = await fetch(`${API_BASE_URL}/documents/preview/${previewToken}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new DocumentExportApiError(response.status, 'Bản xem trước đã hết hạn hoặc không khả dụng.');
    }
    return response.blob();
  },

  // Download exported document file
  downloadExportedDocument: async (documentId: string, suggestedFileName: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/download`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new DocumentExportApiError(response.status, 'Không thể tải file tài liệu.');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedFileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
