import type { FormFieldErrors, RegisterHostFormData } from '../types/auth';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const PHONE_REGEX = /^(?:\+[1-9]\d{1,14}|0[35789]\d{8})$/;

export function validateRegisterHost(data: RegisterHostFormData): {
  isValid: boolean;
  errors: FormFieldErrors;
} {
  const errors: FormFieldErrors = {};

  // 1. Kiểm tra trường bắt buộc (Ưu tiên cao nhất)
  if (!data.fullName || data.fullName.trim() === '') {
    errors.fullName = 'Vui lòng nhập họ và tên';
  }

  if (!data.email || data.email.trim() === '') {
    errors.email = 'Vui lòng nhập email';
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    // 2. Kiểm tra định dạng email (Luồng 3b-5b)
    errors.email = 'Email không đúng định dạng';
  }

  if (!data.phoneNumber || data.phoneNumber.trim() === '') {
    errors.phoneNumber = 'Vui lòng nhập số điện thoại';
  } else if (!PHONE_REGEX.test(data.phoneNumber.trim())) {
    // 3. Kiểm tra định dạng số điện thoại E.164 (Luồng 3c-5c)
    errors.phoneNumber = 'Số điện thoại không hợp lệ';
  }

  if (!data.password || data.password === '') {
    errors.password = 'Vui lòng nhập mật khẩu';
  } else if (data.password.length < 8) {
    // 4. Kiểm tra độ dài mật khẩu tối thiểu (Luồng 3d-5d)
    errors.password = 'Mật khẩu phải có tối thiểu 8 ký tự';
  }

  if (!data.confirmPassword || data.confirmPassword === '') {
    errors.confirmPassword = 'Vui lòng nhập xác nhận mật khẩu';
  } else if (data.password && data.confirmPassword !== data.password) {
    // 5. Kiểm tra xác nhận mật khẩu trùng khớp (Luồng 3e-5e)
    errors.confirmPassword = 'Xác nhận mật khẩu không trùng khớp';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
