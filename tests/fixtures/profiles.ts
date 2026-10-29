import type { AdminProfileResponse, CustomerProfileResponse, HostProfileResponse } from '../../src/types/profile';

export const adminProfile: AdminProfileResponse = {
  role: 'ADMIN', fullName: 'Nguyễn Văn Admin', phoneNumber: '+84901234567', email: 'admin@rentops.vn',
};
export const hostProfile: HostProfileResponse = {
  role: 'HOST', businessName: 'RentOps Real Estate Corp', phoneNumber: '+84987654321',
  email: 'host@rentops.vn', officeAddress: '123 Võ Văn Ngân, TP. Thủ Đức, TP.HCM', logoUrl: null,
};
export const customerProfile: CustomerProfileResponse = {
  role: 'CUSTOMER', fullName: 'Trần Thị Khách', phoneNumber: '+84912345678', email: 'khachthue@gmail.com',
  identityType: 'PASSPORT', identityNo: '079090001234', birthDate: '1995-05-15', address: '456 Lê Duẩn, Quận 1, TP.HCM',
};
