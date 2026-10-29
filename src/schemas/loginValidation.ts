import type { LoginFieldErrors } from '../types/auth';

export interface ValidationResult {
  isValid: boolean;
  errors: LoginFieldErrors;
}

/**
 * Kiểm tra hợp lệ dữ liệu Form Đăng nhập (UC02)
 * Ưu tiên kiểm tra rỗng trước, không cắt khoảng trắng ở mật khẩu.
 */
export function validateLoginForm(data: {
  loginName: string;
  password: string;
}): ValidationResult {
  const errors: LoginFieldErrors = {};

  // 1. Kiểm tra trường bắt buộc Tên đăng nhập
  if (!data.loginName || !data.loginName.trim()) {
    errors.loginName = 'Vui lòng nhập tên đăng nhập';
  }

  // 2. Kiểm tra trường bắt buộc Mật khẩu (Giữ nguyên không trim)
  if (!data.password) {
    errors.password = 'Vui lòng nhập mật khẩu';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Kiểm tra hợp lệ dữ liệu Form Xác nhận liên kết tài khoản Google
 */
export function validateGoogleLinkForm(data: {
  loginName: string;
  password: string;
}): ValidationResult {
  return validateLoginForm(data);
}
