export type FundingType = 'CASH' | 'BANK';
export interface BankDetails { bankCode: string; accountNumber: string; accountHolder: string }
export interface FundingSource {
  id: string; name: string; type: FundingType; bankDetails: BankDetails | null; active: boolean;
  hasTransactions: boolean; version: string; canEditBankDetails: boolean;
}
export interface SupportedBank { bankCode: string; name: string }
export interface AffectedRoom { roomId: string; roomCode: string; roomName: string; buildingName: string; defaultRole: FundingType }
export interface DeactivationImpact {
  sourceId: string; active: boolean; version: string; affectedRooms: AffectedRoom[]; totalRooms: number; warning: string; confirmationToken: string;
}
export type FundingAction = 'create-cash' | 'create-bank' | 'edit' | 'activate' | 'deactivate';
export interface FundingRoute { type: FundingType | ''; active: 'true' | 'false' | ''; action: FundingAction | null; sourceId: string | null; invalid: boolean }
export interface FundingFields { name: string; bankCode: string; accountNumber: string; accountHolder: string }
export type FundingField = keyof FundingFields | 'version' | 'confirmationToken';
export type FundingErrors = Partial<Record<FundingField, string>>;
export interface FundingNotice { kind: 'success' | 'error'; message: string }
export const fundingLabels: Record<FundingType, string> = { CASH: 'Tiền mặt', BANK: 'Tài khoản ngân hàng' };
export const fundingTitles: Record<FundingAction, string> = {
  'create-cash': 'Thêm nguồn tiền mặt', 'create-bank': 'Thêm tài khoản ngân hàng', edit: 'Chỉnh sửa nguồn tiền', activate: 'Kích hoạt lại nguồn tiền', deactivate: 'Ngừng hoạt động nguồn tiền',
};
export const fundingMessages = {
  title: 'Quản lý nguồn tiền', forbidden: 'Bạn không có quyền quản lý nguồn tiền', session: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
  listFailure: 'Không thể tải danh sách nguồn tiền. Vui lòng thử lại.', detailFailure: 'Không thể tải thông tin nguồn tiền. Vui lòng thử lại.',
  bankFailure: 'Không thể tải danh mục ngân hàng. Bạn vẫn có thể thêm tiền mặt hoặc đổi tên nguồn tiền.',
  impactFailure: 'Không thể kiểm tra các phòng bị ảnh hưởng. Vui lòng tải lại trước khi xác nhận.',
  invalid: 'Vui lòng kiểm tra các trường được đánh dấu.', notFound: 'Không tìm thấy nguồn tiền hợp lệ.',
  createSuccess: 'Tạo nguồn tiền thành công', updateSuccess: 'Cập nhật nguồn tiền thành công', activateSuccess: 'Kích hoạt nguồn tiền thành công', deactivateSuccess: 'Ngừng hoạt động nguồn tiền thành công',
  saveFailure: 'Không thể lưu nguồn tiền. Thông tin đang nhập được giữ lại. Vui lòng thử lại.',
  duplicateName: 'Tên nguồn tiền đã tồn tại trong tài khoản của bạn.', duplicateAccount: 'Tài khoản ngân hàng này đã được khai báo tại một nguồn tiền khác.',
  bankLocked: 'Nguồn tiền đã phát sinh giao dịch, không thể thay đổi thông tin tài khoản để bảo toàn lịch sử kế toán. Vui lòng tạo nguồn tiền mới nếu muốn đổi số tài khoản.',
  stale: 'Nguồn tiền đã thay đổi. Vui lòng xem lại dữ liệu mới trước khi tiếp tục.',
  impactChanged: 'Các phòng bị ảnh hưởng đã thay đổi. Vui lòng xem danh sách mới và xác nhận lại.',
  uncertain: 'Chưa xác định kết quả thao tác. Dữ liệu có thể đã được lưu. Hãy kiểm tra lại trước khi thực hiện thao tác khác.',
  csrf: 'Chưa thể xác nhận mã bảo vệ CSRF. Thông tin đang nhập được giữ lại. Vui lòng thử lại.',
  invalidRoute: 'Thao tác hoặc bộ lọc không hợp lệ. Vui lòng chọn lại từ danh sách.',
} as const;
