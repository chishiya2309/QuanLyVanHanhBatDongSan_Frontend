import { clearCsrfCache, getCsrfToken } from './authApi';
import type {
  DocumentTemplate,
  DocumentTemplateDetail,
  TemplateVersion,
  TemplateVariable,
  ValidationResult,
  TemplateType,
} from '../types/documentTemplate';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');

export class DocumentTemplateApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'DocumentTemplateApiError';
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

    throw new DocumentTemplateApiError(status, message, fieldErrors);
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
  };

  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (headerName && token) {
    headers[headerName] = token;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  return handleResponse<T>(response);
}

export const documentTemplateApi = {
  getTemplates: (params?: { type?: TemplateType; active?: boolean; keyword?: string }) => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.active !== undefined) query.set('active', String(params.active));
    if (params?.keyword) query.set('keyword', params.keyword);

    const qs = query.toString();
    return request<DocumentTemplate[]>(`/document-templates${qs ? `?${qs}` : ''}`);
  },

  getTemplateDetail: (id: string) => {
    return request<DocumentTemplateDetail>(`/document-templates/${id}`);
  },

  uploadTemplate: (formData: FormData) => {
    return mutate<DocumentTemplateDetail>('/document-templates/upload', 'POST', formData);
  },

  replaceVersion: (id: string, formData: FormData) => {
    return mutate<TemplateVersion>(`/document-templates/${id}/versions`, 'POST', formData);
  },

  updateTemplateInfo: (id: string, data: { name: string; description?: string; type: TemplateType }) => {
    return mutate<DocumentTemplateDetail>(`/document-templates/${id}`, 'PUT', data);
  },

  setDefault: (id: string) => {
    return mutate<DocumentTemplateDetail>(`/document-templates/${id}/default`, 'PATCH');
  },

  deactivate: (id: string) => {
    return mutate<DocumentTemplateDetail>(`/document-templates/${id}/deactivate`, 'PATCH');
  },
  deactivateTemplate: (id: string) => {
    return mutate<DocumentTemplateDetail>(`/document-templates/${id}/deactivate`, 'PATCH');
  },

  activate: (id: string) => {
    return mutate<DocumentTemplateDetail>(`/document-templates/${id}/activate`, 'PATCH');
  },
  activateTemplate: (id: string) => {
    return mutate<DocumentTemplateDetail>(`/document-templates/${id}/activate`, 'PATCH');
  },

  getSupportedVariables: (type: TemplateType) => {
    return request<TemplateVariable[]>(`/document-templates/supported-variables?type=${type}`);
  },

  validateFile: (formData: FormData) => {
    return mutate<ValidationResult>('/document-templates/validate-file', 'POST', formData);
  },

  downloadTemplate: async (id: string, versionNo?: number) => {
    const path = `/document-templates/${id}/download${versionNo ? `?versionNo=${versionNo}` : ''}`;
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new DocumentTemplateApiError(response.status, 'Không thể tải file mẫu về máy');
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition');
    let filename = 'template_download';
    if (disposition) {
      const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
      if (match && match[1]) {
        filename = decodeURIComponent(match[1].replace(/['"]/g, ''));
      }
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
