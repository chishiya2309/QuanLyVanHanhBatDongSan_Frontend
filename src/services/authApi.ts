import type {
  ApiErrorResponse,
  AuthenticatedUserResponse,
  LoginRequest,
  RegisterHostRequest,
  RegisterHostResponse,
} from '../types/auth';
import { changePasswordFields, changePasswordMessages as m, type ChangePasswordRequest, type ChangePasswordResponse } from '../types/changePassword';
import { normalizePhoneNumber } from '../utils/phoneNumber';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export { AuthApiError } from './authErrors';
export { getCsrfToken, clearCsrfCache } from './csrfClient';
import { AuthApiError } from './authErrors';
import { cachedCsrfToken, getCsrfToken, clearCsrfCache } from './csrfClient';
import { authenticatedFetch, announceSession, establishSession, invalidateSession, sessionGuard, SessionRefreshError, withSessionLock } from './sessionClient';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function changePassword(request: ChangePasswordRequest, shouldSend = () => true): Promise<ChangePasswordResponse> {
  const active = sessionGuard(shouldSend);
  try {
    const csrf = await getCsrfToken().catch((error: unknown) => {
      if (error instanceof AuthApiError && error.status === 401) throw new SessionRefreshError();
      throw error;
    });
    if (!csrf || typeof csrf.token !== 'string' || !csrf.token || typeof csrf.headerName !== 'string' || !csrf.headerName) {
      throw new AuthApiError(0, m.failure);
    }
    const response = await authenticatedFetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', [csrf.headerName]: csrf.token },
      body: JSON.stringify({
        currentPassword: request.currentPassword,
        newPassword: request.newPassword,
        confirmPassword: request.confirmPassword,
      }),
    }, { shouldSend: active });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const fields: Record<string, string> = {};
      if (response.status === 400 && isRecord(body) && isRecord(body.fieldErrors)) {
        for (const field of changePasswordFields) {
          const message = body.fieldErrors[field];
          if (typeof message === 'string' && message.trim()) fields[field] = message;
        }
      }
      const serverMessage = isRecord(body) && typeof body.message === 'string' && body.message.trim() ? body.message : null;
      const message = response.status === 401 ? m.sessionInvalid
        : response.status === 400 ? serverMessage || m.invalidData
        : response.status === 403 ? serverMessage || m.failure : m.failure;
      throw new AuthApiError(response.status, message, fields);
    }
    if (response.status !== 200 || !isRecord(body) || body.status !== 200 || body.data !== null || body.message !== m.success) {
      throw new AuthApiError(response.status, m.failure);
    }
    invalidateSession();
    announceSession(null);
    return { status: 200, message: body.message, data: null };
  } catch (error) {
    if (error instanceof SessionRefreshError || (error instanceof Error && error.name === 'AbortError')) throw error;
    if (error instanceof AuthApiError) {
      if (error.status === 401 || (error.status === 403 && error.message === m.csrfInvalid)) clearCsrfCache();
      const message = error.status === 401 ? m.sessionInvalid
        : error.status === 400 || error.status === 403 ? error.message : m.failure;
      throw new AuthApiError(error.status, message, error.fieldErrors);
    }
    throw new AuthApiError(0, m.failure);
  }
}

/**
 * Thực hiện yêu cầu Đăng nhập hệ thống (UC02)
 */
export async function login(
  request: LoginRequest
): Promise<AuthenticatedUserResponse> {
  return establishSession(async () => {
    const url = `${API_BASE_URL}/auth/login`;

    try {
      // Đảm bảo có CSRF token trước khi gửi POST
      const csrf = cachedCsrfToken() || (await getCsrfToken());

      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          [csrf.headerName]: csrf.token,
        },
        body: JSON.stringify({
          loginName: request.loginName.trim().toLowerCase(),
          password: request.password, // Mật khẩu giữ nguyên vẹn
        }),
      });

      // Reset CSRF cache vì máy chủ tạo phiên và đổi CSRF token mới
      clearCsrfCache();

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorData = data as ApiErrorResponse | null;
        const status = response.status;
        let message = errorData?.message;

        if (!message) {
          if (status === 400) message = 'Thông tin đăng nhập không hợp lệ';
          else if (status === 401) message = 'Tên đăng nhập hoặc mật khẩu không chính xác';
          else if (status === 403) message = 'Tài khoản đã bị khóa';
          else if (status === 500) message = 'Đăng nhập không thành công. Vui lòng thử lại sau';
          else message = 'Đã có lỗi xảy ra. Vui lòng thử lại sau';
        }

        const fieldErrors = errorData?.fieldErrors || {};
        throw new AuthApiError(status, message, fieldErrors);
      }

      return (data as { data: AuthenticatedUserResponse }).data;
    } catch (error) {
      if (error instanceof AuthApiError) {
        throw error;
      }

      // Ngoại lệ lỗi mạng hoặc không kết nối được máy chủ
      throw new AuthApiError(
        0,
        'Đăng nhập không thành công. Vui lòng thử lại sau',
        {}
      );
    }
  });
}

/**
 * Bắt đầu luồng đăng nhập bằng Google OAuth2
 */
export function initiateGoogleLogin(): void {
  window.location.href = `${API_BASE_URL}/auth/google`;
}

/**
 * Lấy thông tin phiên người dùng hiện tại từ cookie HttpOnly
 */
export async function getCurrentUser(options: { refresh?: boolean; signal?: AbortSignal } = {}): Promise<AuthenticatedUserResponse> {
  const url = `${API_BASE_URL}/auth/me`;

  try {
    const init: RequestInit = {
      method: 'GET', signal: options.signal, cache: 'no-store',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    };
    const response = options.refresh === false ? await fetch(url, init) : await authenticatedFetch(url, init, { trackNavigation: false });

    if (!response.ok) {
      const status = response.status;
      throw new AuthApiError(status, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }

    const data = await response.json();
    return (data as { data: AuthenticatedUserResponse }).data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    if (error instanceof AuthApiError) {
      throw error;
    }
    throw new AuthApiError(0, 'Không thể kết nối đến máy chủ');
  }
}

/**
 * Đăng xuất phiên hiện tại
 */
export async function logout(): Promise<void> {
  invalidateSession();
  announceSession(null);
  return withSessionLock(async () => {
    const url = `${API_BASE_URL}/auth/logout`;

    try {
      const csrf = cachedCsrfToken() || (await getCsrfToken().catch(() => null));
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (csrf) {
        headers[csrf.headerName] = csrf.token;
      }

      await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } finally {
      clearCsrfCache();
    }
  });
}

/**
 * Đăng ký tài khoản Host (UC01)
 */
export async function registerHost(
  request: RegisterHostRequest
): Promise<RegisterHostResponse> {
  const url = `${API_BASE_URL}/auth/register-host`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fullName: request.fullName.trim(),
        email: request.email.trim().toLowerCase(),
        phoneNumber: normalizePhoneNumber(request.phoneNumber),
        password: request.password,
        confirmPassword: request.confirmPassword,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorData = data as ApiErrorResponse | null;
      const status = response.status;
      const message =
        errorData?.message ||
        (status === 500
          ? 'Đăng ký không thành công. Vui lòng thử lại sau'
          : 'Đã có lỗi xảy ra. Vui lòng thử lại sau');
      const fieldErrors = errorData?.fieldErrors || {};

      throw new AuthApiError(status, message, fieldErrors);
    }

    return data as RegisterHostResponse;
  } catch (error) {
    if (error instanceof AuthApiError) {
      throw error;
    }

    // Ngoại lệ lỗi mạng hoặc không kết nối được server
    throw new AuthApiError(
      0,
      'Đăng ký không thành công. Vui lòng thử lại sau',
      {}
    );
  }
}
