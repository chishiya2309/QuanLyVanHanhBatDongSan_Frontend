import type { ChargeMethod } from './serviceCatalog';

export type ServiceSource = 'BUILDING_INHERITED' | 'ROOM_PRIVATE';
export type PriceSource = 'ROOM' | 'BUILDING' | 'CATALOG';
export interface RoomServiceCandidate {
  serviceId: string;
  name: string;
  unit: string;
  method: ChargeMethod;
  unitPrice: string;
  priceSource: PriceSource;
  version: string;
}
export interface RoomServiceItem extends RoomServiceCandidate {
  configurationId: string;
  serviceSource: ServiceSource;
  enabled: boolean;
  roomPrice: string | null;
  buildingPrice: string | null;
  catalogPrice: string;
  inheritedPrice: string;
  appliedAt: string;
  effectiveFrom: string;
}
export interface RoomServices {
  roomId: string;
  roomCode: string;
  roomName: string;
  buildingId: string;
  buildingName: string;
  services: RoomServiceItem[];
}
export interface AvailableRoomServices {
  roomId: string;
  services: RoomServiceCandidate[];
}
export interface RoomServicesRoute {
  roomId: string;
  returnTo: string;
}
export type RoomServiceWrite =
  | { kind: 'add'; serviceId: string; version: string }
  | { kind: 'status'; item: RoomServiceItem; enabled: boolean }
  | { kind: 'price'; item: RoomServiceItem; unitPrice: string };
export const serviceSourceLabels: Record<ServiceSource, string> = {
  BUILDING_INHERITED: 'Kế thừa từ tòa nhà',
  ROOM_PRIVATE: 'Dịch vụ riêng của phòng',
};
export const priceSourceLabels: Record<PriceSource, string> = {
  ROOM: 'Giá riêng của phòng',
  BUILDING: 'Giá tòa nhà',
  CATALOG: 'Giá danh mục',
};
export const roomServiceMessages = {
  empty: 'Phòng chưa có dịch vụ',
  noneAvailable: 'Không có dịch vụ phù hợp để thêm cho phòng',
  getFailure: 'Không thể tải cấu hình dịch vụ. Vui lòng thử lại',
  availableFailure: 'Không thể tải dịch vụ có thể thêm. Vui lòng thử lại',
  saveFailure: 'Không thể lưu cấu hình dịch vụ. Vui lòng thử lại',
  savedReloadFailure: 'Cấu hình đã được lưu, nhưng chưa thể tải lại danh sách. Vui lòng tải lại',
  uncertain:
    'Chưa xác định được kết quả lưu. Vui lòng tải lại danh sách để kiểm tra trước khi tiếp tục',
  notFound: 'Không thể truy cập đối tượng được yêu cầu',
  forbidden: 'Bạn không có quyền cấu hình dịch vụ của phòng',
  sessionInvalid: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại',
  csrfInvalid: 'CSRF token bị thiếu hoặc không hợp lệ. Vui lòng lấy token mới và thử lại',
  csrfFailure: 'Không thể lấy token bảo mật. Vui lòng thử lại',
  invalid: 'Dữ liệu không hợp lệ',
  duplicate: 'Dịch vụ đã tồn tại tại phòng. Vui lòng tải lại danh sách',
  ineligible: 'Dịch vụ chưa đủ điều kiện áp dụng',
  privateOnly: 'Chỉ hỗ trợ bật/tắt dịch vụ riêng tại phòng',
  stale: 'Dữ liệu đã thay đổi. Vui lòng tải lại',
  history: 'Dữ liệu cấu hình chưa đầy đủ hoặc không nhất quán',
  priceInvalid: 'Vui lòng nhập đơn giá VND không âm và không có phần lẻ',
  serviceRequired: 'Vui lòng chọn dịch vụ',
  cycle: 'Thay đổi giữa kỳ áp dụng từ chu kỳ kế tiếp.',
} as const;
