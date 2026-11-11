import type { CatalogService, CatalogVersion, ChargeMethod, MoneyVnd } from './serviceCatalog';

export type { CatalogService, CatalogVersion, ChargeMethod, MoneyVnd };

export interface BuildingServicePolicy {
  configurationId: string;
  buildingId: string;
  buildingName: string;
  defaultForNewRoom: boolean;
  unitPrice: MoneyVnd | null;
  prorate: boolean | null;
  enabled: boolean;
  currentPriceRevisionId: string;
  effectiveFrom: string;
}

export interface ServicePolicy {
  service: CatalogService;
  prorate: boolean | null;
  methodChangeAllowed: boolean;
  buildingConfigurations: BuildingServicePolicy[];
}

export interface BuildingSelectionInput {
  buildingId: string;
  defaultForNewRoom?: boolean;
}

export interface UpdateServicePolicyInput {
  version: CatalogVersion;
  method?: ChargeMethod;
  defaultPrice?: MoneyVnd;
  prorate?: boolean;
  buildings?: BuildingSelectionInput[];
}

export interface BuildingLookupItem {
  id: string;
  name: string;
  areaName: string;
  address: string;
  active: boolean;
}

export interface ServicePolicyRoute {
  serviceId: string | null;
  q: string;
  state: string;
  invalid: boolean;
}

export interface ServicePolicyNotice {
  kind: 'success' | 'error';
  message: string;
}

export type PolicyFieldErrors = Record<string, string>;

export const servicePolicyMessages = {
  getSuccess: 'Lấy chính sách dịch vụ thành công',
  saveSuccess: 'Thiết lập chính sách dịch vụ thành công',
  getFailure: 'Không thể tải chính sách dịch vụ',
  saveFailure: 'Thiết lập chính sách dịch vụ không thành công',
  stale: 'Chính sách dịch vụ đã thay đổi. Vui lòng tải lại dữ liệu',
  methodLocked: 'Dịch vụ đã phát sinh sử dụng hoặc hóa đơn. Vui lòng tạo dịch vụ mới để thay đổi phương pháp tính',
  prorateNotFixed: 'Chính sách ngày lẻ chỉ áp dụng cho dịch vụ Cố định',
  inactive: 'Vui lòng bật dịch vụ trước khi tạo cấu hình áp dụng mới',
  priceRequired: 'Vui lòng thiết lập đơn giá danh mục trước',
  timeConflict: 'Không thể lưu chính sách tại thời điểm được xác định',
  buildingNotFound: 'Không thể truy cập tòa nhà được yêu cầu',
  roomServiceNotFound: 'Không thể truy cập cấu hình dịch vụ phòng được yêu cầu',
  notFound: 'Không thể truy cập dịch vụ được yêu cầu',
  buildingsFailure: 'Không thể tải danh sách tòa nhà',
  noChanges: 'Chưa có thay đổi để lưu',
  invalid: 'Dữ liệu không hợp lệ',
  sessionInvalid: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại',
  forbidden: 'Bạn không có quyền thực hiện chức năng này',
  csrfInvalid: 'CSRF token bị thiếu hoặc không hợp lệ. Vui lòng lấy token mới và thử lại',
  csrfFailure: 'Chưa thể lấy mã bảo vệ. Vui lòng thử lại.',
  uncertain: 'Chưa xác định được kết quả. Dữ liệu có thể đã được lưu.',
  invalidRoute: 'Thao tác không hợp lệ. Vui lòng chọn lại dịch vụ từ danh sách.',
} as const;
