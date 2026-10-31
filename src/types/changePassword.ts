export interface ChangePasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type ChangePasswordRequest = ChangePasswordFormData;
export type ChangePasswordField = keyof ChangePasswordFormData;
export type ChangePasswordFieldErrors = Partial<Record<ChangePasswordField, string>>;
export type ChangePasswordStatus = 'idle' | 'submitting' | 'success' | 'error' | 'forbidden';

export interface ChangePasswordResponse {
  status: 200;
  message: string;
  data: null;
}

export interface AuthNotice {
  kind: 'success' | 'error';
  message: string;
}

export const changePasswordFields: ChangePasswordField[] = ['currentPassword', 'newPassword', 'confirmPassword'];

export const changePasswordMessages = {
  currentRequired: 'Vui lòng nhập mật khẩu hiện tại',
  newRequired: 'Vui lòng nhập mật khẩu mới',
  confirmRequired: 'Vui lòng nhập xác nhận mật khẩu mới',
  currentIncorrect: 'Mật khẩu hiện tại không chính xác',
  minLength: 'Mật khẩu phải có tối thiểu 8 ký tự',
  maxBytes: 'Mật khẩu không được vượt quá 72 byte UTF-8',
  mismatch: 'Xác nhận mật khẩu không trùng khớp',
  sessionInvalid: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại',
  forbidden: 'Tài khoản không được phép thực hiện chức năng Đổi mật khẩu',
  csrfInvalid: 'CSRF token bị thiếu hoặc không hợp lệ. Vui lòng lấy token mới và thử lại',
  failure: 'Đổi mật khẩu không thành công. Vui lòng thử lại sau',
  invalidData: 'Dữ liệu đổi mật khẩu không hợp lệ',
  success: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới',
} as const;
