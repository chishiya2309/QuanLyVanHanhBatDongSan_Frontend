export const recoveryMessages = {
  emailRequired: 'Vui lòng nhập email',
  emailInvalid: 'Email không đúng định dạng',
  accepted: 'Yêu cầu đã được tiếp nhận. Nếu tài khoản đủ điều kiện và yêu cầu được xử lý thành công, bạn sẽ nhận được hướng dẫn khôi phục qua email.',
  linkValid: 'Liên kết khôi phục hợp lệ',
  linkInvalid: 'Liên kết khôi phục không hợp lệ hoặc không còn hiệu lực. Vui lòng gửi yêu cầu khôi phục mới',
  newRequired: 'Vui lòng nhập mật khẩu mới',
  confirmRequired: 'Vui lòng nhập xác nhận mật khẩu mới',
  minLength: 'Mật khẩu phải có tối thiểu 8 ký tự',
  maxBytes: 'Mật khẩu không được vượt quá 72 byte UTF-8',
  mismatch: 'Xác nhận mật khẩu không trùng khớp',
  requestInvalid: 'Yêu cầu khôi phục không còn hiệu lực. Vui lòng gửi yêu cầu khôi phục mới',
  failure: 'Khôi phục mật khẩu không thành công. Vui lòng thử lại sau',
  success: 'Khôi phục mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới',
  csrfInvalid: 'CSRF token bị thiếu hoặc không hợp lệ. Vui lòng lấy token mới và thử lại',
  invalidData: 'Dữ liệu không hợp lệ',
} as const;

export interface ForgotPasswordRequest { email: string; }
export interface ResetPasswordFormData { newPassword: string; confirmPassword: string; }
export interface ResetPasswordRequest extends ResetPasswordFormData { token: string; }
export type ResetPasswordField = keyof ResetPasswordFormData;
export type RecoveryField = 'email' | ResetPasswordField;
export type RecoveryFieldErrors = Partial<Record<RecoveryField, string>>;
export interface RecoveryResponse { status: 200; message: string; data: null; }
export interface RecoveryEntry { path: '/forgot-password' | '/reset-password' | null; token: string | null; }
