export interface HostAccountSummary {
  accountId: string;
  loginEmail: string;
  businessName: string | null;
  status: 'ACTIVE' | 'LOCKED';
  createdAt: string;
}
export interface HostAccountDetail extends HostAccountSummary {
  officeAddress: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
  logoUrl: string | null;
}
export interface HostAccountResponse<T> { status: 200; message: string; data: T; }
export type HostAccountAction = 'lock' | 'unlock';
export interface HostAccountRoute { accountId: string | null; }
export interface HostAccountConfirmation { account: HostAccountDetail; action: HostAccountAction; trigger: HTMLElement | null; }
export const HOST_ACCOUNTS_PATH = '/admin/host-accounts';
export const hostAccountMessages = {
  listSuccess: 'Lấy danh sách tài khoản Host thành công',
  detailSuccess: 'Lấy thông tin chi tiết Host thành công',
  empty: 'Chưa có tài khoản Host',
  lockSuccess: 'Khóa tài khoản Host thành công',
  unlockSuccess: 'Mở khóa tài khoản Host thành công',
  sessionInvalid: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại',
  forbidden: 'Bạn không có quyền thực hiện chức năng này',
  invalidData: 'Dữ liệu không hợp lệ',
  notFound: 'Không tìm thấy tài khoản Host',
  wrongRole: 'Tài khoản được chọn không thuộc đối tượng quản lý của chức năng này',
  profileMissing: 'Không thể xác định hồ sơ Host liên kết với tài khoản',
  alreadyLocked: 'Tài khoản Host đã bị khóa',
  alreadyActive: 'Tài khoản Host đang hoạt động',
  listFailure: 'Không thể tải danh sách tài khoản Host. Vui lòng thử lại sau',
  detailFailure: 'Không thể tải thông tin chi tiết Host. Vui lòng thử lại sau',
  lockFailure: 'Khóa tài khoản Host không thành công. Vui lòng thử lại sau',
  unlockFailure: 'Mở khóa tài khoản Host không thành công. Vui lòng thử lại sau',
  csrfInvalid: 'CSRF token bị thiếu hoặc không hợp lệ. Vui lòng lấy token mới và thử lại',
} as const;
