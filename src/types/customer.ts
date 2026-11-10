import type { CustomerAccountAction } from './customerAccount';

export type IdentityType = 'CCCD' | 'PASSPORT';
export type VehicleType = 'MOTORBIKE' | 'CAR' | 'BICYCLE' | 'OTHER';

export interface CustomerResponse {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  identityType: IdentityType | null;
  identityNo: string | null;
  birthDate: string | null;
  address: string | null;
  note: string | null;
  version: string;
}

export interface VehicleResponse {
  id: string;
  customerId: string;
  type: VehicleType;
  plateNumber: string;
  note: string | null;
  version: string;
  customerVersion: string;
}

export interface CustomerVehiclesResponse {
  customerId: string;
  customerVersion: string;
  vehicles: VehicleResponse[];
}

export interface CustomerPageResponse {
  content: CustomerResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface CustomerFields {
  fullName: string;
  phone: string;
  email: string;
  identityType: IdentityType | '';
  identityNo: string;
  birthDate: string;
  address: string;
  note: string;
}

export interface VehicleFields {
  type: VehicleType | '';
  plateNumber: string;
  note: string;
}

export type CustomerField = 'fullName' | 'phone' | 'email' | 'identityType' | 'identityNo' | 'birthDate' | 'address' | 'note' | 'version';
export type CustomerFieldErrors = Partial<Record<CustomerField, string>>;

export type VehicleField = 'type' | 'plateNumber' | 'note' | 'version' | 'customerVersion';
export type VehicleFieldErrors = Partial<Record<VehicleField, string>>;

export interface CreateCustomerInput {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  identityType?: IdentityType | null;
  identityNo?: string | null;
  birthDate?: string | null;
  address?: string | null;
  note?: string | null;
}

export interface UpdateCustomerInput extends CreateCustomerInput {
  version: string;
}

export interface CreateVehicleInput {
  type: VehicleType;
  plateNumber: string;
  note?: string | null;
  customerVersion: string;
}

export interface UpdateVehicleInput {
  type: VehicleType;
  plateNumber: string;
  note?: string | null;
  version: string;
  customerVersion: string;
}

export interface CustomerRoute {
  view: 'list' | 'detail';
  customerId: string | null;
  action: 'create' | 'edit' | null;
  vehicleAction: 'create' | 'edit' | null;
  accountAction: CustomerAccountAction;
  vehicleId: string | null;
  page: number;
  size: number;
  q: string;
  invalid: boolean;
}

export interface CustomerNotice {
  kind: 'success' | 'error';
  message: string;
  fieldErrors?: CustomerFieldErrors | VehicleFieldErrors;
}

export const vehicleTypeLabels: Record<VehicleType, string> = {
  MOTORBIKE: 'Xe máy',
  CAR: 'Ô tô',
  BICYCLE: 'Xe đạp',
  OTHER: 'Loại khác',
};

export const identityTypeLabels: Record<IdentityType, string> = {
  CCCD: 'CCCD',
  PASSPORT: 'Hộ chiếu',
};

export const customerMessages = {
  sessionInvalid: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại',
  forbidden: 'Bạn không có quyền thực hiện chức năng này',
  invalidData: 'Dữ liệu không hợp lệ',
  notFound: 'Không tìm thấy Customer phù hợp hoặc bạn không có quyền quản lý',
  vehicleNotFound: 'Không thể truy cập phương tiện được yêu cầu',
  identityDuplicate: 'Giấy tờ đã được sử dụng bởi Customer khác trong phạm vi quản lý',
  stale: 'Hồ sơ Customer đã thay đổi. Vui lòng tải lại dữ liệu',
  vehicleStale: 'Thông tin phương tiện đã thay đổi. Vui lòng tải lại dữ liệu',
  listSuccess: 'Lấy danh sách Customer thành công',
  detailSuccess: 'Lấy thông tin Customer thành công',
  createSuccess: 'Thêm Customer thành công',
  updateSuccess: 'Cập nhật Customer thành công',
  vehiclesSuccess: 'Lấy danh sách phương tiện thành công',
  vehicleSuccess: 'Lấy thông tin phương tiện thành công',
  vehicleCreateSuccess: 'Thêm phương tiện thành công',
  vehicleUpdateSuccess: 'Cập nhật phương tiện thành công',
  listFailure: 'Không thể tải danh sách Customer',
  detailFailure: 'Không thể tải thông tin Customer. Vui lòng thử lại sau',
  createFailure: 'Thêm Customer không thành công',
  updateFailure: 'Cập nhật Customer không thành công',
  vehiclesFailure: 'Không thể tải danh sách phương tiện',
  vehicleFailure: 'Không thể tải thông tin phương tiện',
  vehicleCreateFailure: 'Thêm phương tiện không thành công',
  vehicleUpdateFailure: 'Cập nhật phương tiện không thành công',
  uncertain: 'Chưa xác định được kết quả. Dữ liệu có thể đã được lưu.',
  csrfInvalid: 'CSRF token bị thiếu hoặc không hợp lệ. Vui lòng thử lại',
} as const;
