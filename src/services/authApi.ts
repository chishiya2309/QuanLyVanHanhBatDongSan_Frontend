import type {
  ApiErrorResponse,
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
