export type AssetState = 'GOOD' | 'DAMAGED' | 'REPAIRING' | 'RETIRED';
export type MoneyVnd = string;
export interface Asset {
  assetId: string; name: string; purchaseValue: MoneyVnd; condition: AssetState;
  note: string | null; createdAt: string; updatedAt: string;
}
export interface AssetPage {
  content: Asset[]; page: number; size: number; totalElements: number;
  totalPages: number; first: boolean; last: boolean;
}
export interface AssetConditionRecord {
  recordId: string; assetId: string; condition: AssetState; recordedAt: string;
  recordedByAccountId: string; note: string | null;
}
export interface CreateAssetInput { name: string; purchaseValue: MoneyVnd }
export interface UpdateAssetInput extends CreateAssetInput { note: string | null }
export interface RecordConditionInput { condition: AssetState; note: string | null }
export interface AssetQuery { q: string; page: number; size: number }
export interface AssetRoute extends AssetQuery {
  assetId: string | null; screen: 'list' | 'detail' | 'edit' | 'condition'; create: boolean;
}
export type AssetField = 'name' | 'purchaseValue' | 'note' | 'condition';
export type AssetFieldErrors = Partial<Record<AssetField, string>>;
export const assetStates: Record<AssetState, string> = {
  GOOD: 'Tốt', DAMAGED: 'Hư hỏng', REPAIRING: 'Đang sửa chữa', RETIRED: 'Ngừng sử dụng',
};
export const assetMessages = {
  listSuccess: 'Lấy danh sách tài sản thành công', detailSuccess: 'Lấy thông tin tài sản thành công',
  createSuccess: 'Thêm tài sản thành công', updateSuccess: 'Cập nhật tài sản thành công',
  conditionSuccess: 'Ghi nhận tình trạng tài sản thành công',
  sessionInvalid: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại',
  forbidden: 'Bạn không có quyền thực hiện chức năng này',
  notFound: 'Không thể truy cập tài sản được yêu cầu',
  csrfInvalid: 'CSRF token bị thiếu hoặc không hợp lệ. Vui lòng lấy token mới và thử lại',
  nameRequired: 'Vui lòng nhập tên tài sản', nameLong: 'Tên tài sản không được vượt quá 255 ký tự',
  valueInvalid: 'Vui lòng nhập giá trị tài sản hợp lệ',
  conditionInvalid: 'Vui lòng chọn tình trạng tài sản hợp lệ',
  noteLong: 'Ghi chú không được vượt quá 2000 ký tự', queryLong: 'Từ khóa không được vượt quá 200 ký tự',
  invalid: 'Dữ liệu không hợp lệ',
  listFailure: 'Không thể tải danh sách tài sản. Vui lòng thử lại sau',
  detailFailure: 'Không thể tải thông tin tài sản. Vui lòng thử lại sau',
  saveFailure: 'Không thể hoàn tất thao tác. Vui lòng thử lại sau',
  csrfFailure: 'Không thể lấy token bảo mật. Chưa gửi thao tác lưu. Vui lòng thử lại',
  uncertain: 'Chưa xác định được kết quả lưu. Dữ liệu có thể đã được lưu.',
  repeatWarning: 'Tải lại chỉ cho biết dữ liệu hiện tại. Nếu bắt đầu lại thao tác, bạn có thể tạo thêm tài sản hoặc bản ghi tình trạng.',
} as const;
