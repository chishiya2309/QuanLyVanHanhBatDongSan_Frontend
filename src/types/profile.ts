export interface AdminProfileResponse {
  role: 'ADMIN';
  fullName: string;
  phoneNumber?: string | null;
  email: string;
}

export interface HostProfileResponse {
  role: 'HOST';
  businessName: string;
  phoneNumber: string;
  email: string;
  officeAddress?: string | null;
  logoUrl?: string | null;
}

export interface CustomerProfileResponse {
  role: 'CUSTOMER';
  fullName: string;
  phoneNumber?: string | null;
  email: string;
  identityType?: string | null;
  identityNo?: string | null;
  birthDate?: string | null;
  address?: string | null;
}

export type PersonalProfileResponse = AdminProfileResponse | HostProfileResponse | CustomerProfileResponse;

export interface AdminProfileUpdateRequest {
  fullName: string;
  phoneNumber?: string | null;
}

export interface HostProfileUpdateRequest {
  businessName: string;
  phoneNumber: string;
  officeAddress?: string | null;
  removeLogo: boolean;
}

export type ProfileFormData =
  | { role: 'ADMIN'; fullName: string; phoneNumber: string }
  | { role: 'HOST'; businessName: string; phoneNumber: string; officeAddress: string };

export type ProfileEditableField = 'fullName' | 'businessName' | 'phoneNumber' | 'officeAddress';
export type ProfileFormErrors = Partial<Record<ProfileEditableField | 'logo' | 'email' | 'general', string>>;
export type ProfileStatus = 'idle' | 'loading' | 'saving' | 'success' | 'error';

export const profileMessages = {
  success: 'Cập nhật hồ sơ thành công',
  sessionInvalid: 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại',
  notFound: 'Không tìm thấy thông tin hồ sơ',
  forbidden: 'Bạn không có quyền cập nhật hồ sơ này',
  emailProtected: 'Email không được phép thay đổi',
  fieldProtected: 'Thông tin này không được phép thay đổi',
  nameRequired: 'Vui lòng nhập họ và tên',
  hostNameRequired: 'Vui lòng nhập tên chủ cho thuê/đơn vị quản lý',
  phoneRequired: 'Vui lòng nhập số điện thoại',
  phoneInvalid: 'Số điện thoại không hợp lệ',
  phoneDuplicate: 'Số điện thoại đã được đăng ký',
  imageFailure: 'Không thể cập nhật hình ảnh. Vui lòng chọn ảnh khác',
  saveFailure: 'Cập nhật hồ sơ không thành công. Vui lòng thử lại sau',
  loadFailure: 'Không thể tải hồ sơ. Vui lòng thử lại',
} as const;
