export type AssetState = 'GOOD' | 'DAMAGED' | 'REPAIRING' | 'RETIRED';
export type MoneyVnd = string;
export interface Asset {
  assetId: string; name: string; purchaseValue: MoneyVnd; condition: AssetState;
  note: string | null; createdAt: string; updatedAt: string; currentPlacement: AssetPlacement | null;
}
export interface AssetPage {
  content: Asset[]; page: number; size: number; totalElements: number;
  totalPages: number; first: boolean; last: boolean;
}
export interface AssetConditionRecord {
  recordId: string; assetId: string; condition: AssetState; recordedAt: string;
  recordedByAccountId: string; note: string | null;
}
export interface AssetPlacement {
  placementId: string; assetId: string; roomId: string; roomCode: string; roomName: string;
  fromAt: string; toAt: string | null; conditionAtStart: AssetState;
}
export interface AssetConditionHistoryItem extends AssetConditionRecord {
  placementId: string | null; roomId: string | null; roomCode: string | null; roomName: string | null;
}
export interface AssetHistory {
  assetId: string; locationHistory: AssetPlacement[]; conditionHistory: AssetConditionHistoryItem[];
}
export interface AssetPlacementRoom {
  id: string; code: string; name: string; areaName: string | null; buildingName: string | null; floorName: string | null;
}
export interface AssignAssetPlacementInput { roomId: string }
export interface TransferAssetInput extends AssignAssetPlacementInput { sourcePlacementId: string }
export type PlacementAction = 'assign' | 'transfer';
export interface CreateAssetInput { name: string; purchaseValue: MoneyVnd }
export interface UpdateAssetInput extends CreateAssetInput { note: string | null }
export interface RecordConditionInput { condition: AssetState; note: string | null }
export interface AssetQuery { q: string; page: number; size: number }
export interface AssetRoute extends AssetQuery {
  assetId: string | null; screen: 'list' | 'detail' | 'edit' | 'condition' | 'history'; create: boolean;
  placement: { action: PlacementAction; assetId: string } | null; invalidPlacement: boolean;
}
export type AssetField = 'name' | 'purchaseValue' | 'note' | 'condition' | 'roomId' | 'sourcePlacementId';
export type AssetFieldErrors = Partial<Record<AssetField, string>>;
export const assetStates: Record<AssetState, string> = {
  GOOD: 'Tốt', DAMAGED: 'Hư hỏng', REPAIRING: 'Đang sửa chữa', RETIRED: 'Ngừng sử dụng',
};
export const assetMessages = {
  listSuccess: 'Lấy danh sách tài sản thành công', detailSuccess: 'Lấy thông tin tài sản thành công',
  createSuccess: 'Thêm tài sản thành công', updateSuccess: 'Cập nhật tài sản thành công',
  conditionSuccess: 'Ghi nhận tình trạng tài sản thành công',
  assignSuccess: 'Gán tài sản vào phòng thành công', transferSuccess: 'Chuyển tài sản thành công',
  historySuccess: 'Lấy lịch sử tài sản thành công',
  assignFailure: 'Gán tài sản không thành công', transferFailure: 'Chuyển tài sản không thành công',
  historyFailure: 'Không thể tải lịch sử tài sản',
  roomNotFound: 'Không thể truy cập phòng được yêu cầu', roomRequired: 'Vui lòng chọn phòng đích',
  sourceRequired: 'Vui lòng xác định vị trí nguồn của tài sản',
  sameRoom: 'Tài sản đang được bố trí tại phòng đã chọn. Vui lòng chọn phòng khác',
  alreadyPlaced: 'Vị trí tài sản đã thay đổi. Vui lòng tải lại dữ liệu',
  sourceChanged: 'Dữ liệu bố trí đã thay đổi. Vui lòng tải lại dữ liệu',
  placementTimeInvalid: 'Không thể thực hiện bố trí tại thời điểm được xác định',
  roomListSuccess: 'Tra cứu danh sách phòng thành công', roomListEmpty: 'Không tìm thấy phòng phù hợp',
  roomListFailure: 'Không thể tải danh sách phòng. Vui lòng thử lại',
  placementSelectionInvalid: 'Vui lòng lựa chọn đầy đủ tài sản và phòng đích để thực hiện bố trí.',
  placementUncertain: 'Chưa xác định được kết quả bố trí. Dữ liệu có thể đã được lưu. Vui lòng tải lại và chủ động bắt đầu thao tác mới.',
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
