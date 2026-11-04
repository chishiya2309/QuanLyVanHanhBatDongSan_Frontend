import { AuthApiError } from './authErrors';

const base = import.meta.env.VITE_API_URL || '/api/v1';
type CsrfToken = { token: string; headerName: string };
let cached: CsrfToken | null = null;
let generation = 0;

export function clearCsrfCache(): void { cached = null; generation++; }
export function cachedCsrfToken(): CsrfToken | null { return cached; }

export async function getCsrfToken(): Promise<CsrfToken> {
  const version = generation;
  try {
    const response = await fetch(`${base}/auth/csrf`, {
      method: 'GET', credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new AuthApiError(response.status, 'Không thể lấy CSRF token. Vui lòng thử lại sau');
    const { data } = await response.json();
    if (!data || typeof data.token !== 'string' || !data.token.trim() || /[\r\n]/.test(data.token)
      || typeof data.headerName !== 'string' || !/^[!#$%&'*+.^_`|~\da-z-]+$/i.test(data.headerName)
      || ['accept', 'content-type', 'cookie', 'authorization', 'host'].includes(data.headerName.toLowerCase())) {
      throw new AuthApiError(0, 'Không thể lấy CSRF token. Vui lòng thử lại sau');
    }
    if (version === generation) cached = data;
    return data;
  } catch (error) {
    if (error instanceof AuthApiError) throw error;
    throw new AuthApiError(0, 'Lỗi kết nối mạng khi lấy CSRF token');
  }
}
