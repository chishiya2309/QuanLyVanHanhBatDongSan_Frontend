export type CustomerAccountStatus = 'ACTIVE' | 'LOCKED';
export type CustomerAccountAction = 'provision' | 'lock' | 'unlock' | null;

export interface CustomerAccountResponse {
  customerId: string;
  hasAccount: boolean;
  accountId: string | null;
  loginName: string | null;
  role: 'CUSTOMER' | null;
  status: CustomerAccountStatus | null;
  createdAt: string | null;
  customerVersion: string;
}

export interface ProvisionCustomerAccountFields {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ProvisionCustomerAccountInput extends ProvisionCustomerAccountFields {
  customerVersion: string;
}

export type CustomerAccountFieldErrors = Partial<Record<keyof ProvisionCustomerAccountInput, string>>;

export const customerAccountMessages = {
  sessionInvalid: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại',
  forbidden: 'Bạn không có quyền thực hiện chức năng này',
  notFound: 'Không tìm thấy Customer phù hợp hoặc bạn không có quyền quản lý',
  invalidData: 'Dữ liệu không hợp lệ',
  emailRequired: 'Vui lòng nhập email đăng nhập',
  passwordRequired: 'Vui lòng nhập mật khẩu ban đầu',
  confirmationRequired: 'Vui lòng nhập xác nhận mật khẩu',
  emailInvalid: 'Email đăng nhập không đúng định dạng',
  passwordShort: 'Mật khẩu phải có tối thiểu 8 ký tự',
  passwordLong: 'Mật khẩu không được vượt quá 72 byte UTF-8',
  confirmationMismatch: 'Xác nhận mật khẩu không trùng khớp',
  alreadyHasAccount: 'Customer đã được cấp tài khoản',
  emailDuplicate: 'Email đăng nhập đã tồn tại',
  stale: 'Hồ sơ vừa được thay đổi, vui lòng tải lại',
  noAccount: 'Customer chưa được cấp tài khoản',
  alreadyLocked: 'Tài khoản Customer đã bị khóa',
  alreadyActive: 'Tài khoản Customer đang hoạt động',
  wrongRole: 'Tài khoản không thuộc đối tượng quản lý của chức năng này',
  detailSuccess: 'Lấy thông tin tài khoản Customer thành công',
  provisionSuccess: 'Cấp tài khoản Customer thành công',
  lockSuccess: 'Khóa tài khoản Customer thành công',
  unlockSuccess: 'Mở khóa tài khoản Customer thành công',
  detailFailure: 'Không thể tải thông tin Customer. Vui lòng thử lại sau',
  provisionFailure: 'Cấp tài khoản Customer không thành công. Vui lòng thử lại sau',
  lockFailure: 'Khóa tài khoản Customer không thành công. Vui lòng thử lại sau',
  unlockFailure: 'Mở khóa tài khoản Customer không thành công. Vui lòng thử lại sau',
  csrfInvalid: 'CSRF token bị thiếu hoặc không hợp lệ. Vui lòng thử lại',
  uncertain: 'Chưa xác định được kết quả thao tác. Vui lòng tải lại trạng thái tài khoản để kiểm tra',
  invalidRoute: 'Thao tác tài khoản không hợp lệ. Vui lòng chọn lại thao tác.',
} as const;
