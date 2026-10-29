import type {
  ApiErrorResponse,
  AuthenticatedUserResponse,
  LoginRequest,
  RegisterHostRequest,
  RegisterHostResponse,
} from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export class AuthApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

let cachedCsrf: { token: string; headerName: string } | null = null;

/**
 * Lấy CSRF token từ Backend và lưu vào bộ nhớ tạm
 */
export async function getCsrfToken(): Promise<{ token: string; headerName: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new AuthApiError(response.status, 'Không thể lấy CSRF token. Vui lòng thử lại sau');
    }

    const resData = await response.json();
    cachedCsrf = resData.data;
    return cachedCsrf!;
  } catch (err) {
    if (err instanceof AuthApiError) throw err;
    throw new AuthApiError(0, 'Lỗi kết nối mạng khi lấy CSRF token');
  }
}

/**
 * Xóa cache CSRF để buộc lấy token mới sau khi đăng nhập / đăng xuất
 */
export function clearCsrfCache(): void {
  cachedCsrf = null;
}

/**
 * Thực hiện yêu cầu Đăng nhập hệ thống (UC02)
 */
export async function login(
  request: LoginRequest
): Promise<AuthenticatedUserResponse> {
  const url = `${API_BASE_URL}/auth/login`;

  try {
    // Đảm bảo có CSRF token trước khi gửi POST
    const csrf = cachedCsrf || (await getCsrfToken());

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
}

/**
 * Bắt đầu luồng đăng nhập bằng Google OAuth2
 */
export function initiateGoogleLogin(): void {
  window.location.href = `${API_BASE_URL}/auth/google`;
}

/**
 * Xác nhận liên kết tài khoản Google với tài khoản RentOps hiện có
 */
export async function linkGoogleAccount(
  request: LoginRequest
): Promise<AuthenticatedUserResponse> {
  const url = `${API_BASE_URL}/auth/google/link`;

  try {
    const csrf = cachedCsrf || (await getCsrfToken());

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
        else if (status === 409) message = 'Không thể liên kết tài khoản Google này';
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

    throw new AuthApiError(
      0,
      'Đăng nhập không thành công. Vui lòng thử lại sau',
      {}
    );
  }
}

/**
 * Lấy thông tin phiên người dùng hiện tại từ cookie HttpOnly
 */
export async function getCurrentUser(): Promise<AuthenticatedUserResponse> {
  const url = `${API_BASE_URL}/auth/me`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const status = response.status;
      throw new AuthApiError(status, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }

    const data = await response.json();
    return (data as { data: AuthenticatedUserResponse }).data;
  } catch (error) {
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
  const url = `${API_BASE_URL}/auth/logout`;

  try {
    const csrf = cachedCsrf || (await getCsrfToken().catch(() => null));
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
        phoneNumber: request.phoneNumber.trim(),
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
