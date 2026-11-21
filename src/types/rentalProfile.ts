export const rentalProfilePath = '/portal/rental-profile';
export const rentalProfileTitle = 'Xem hồ sơ và phòng đang thuê';

export function isRentalProfilePath(path: string): boolean {
  return path.replace(/\/$/, '') === rentalProfilePath;
}

export const rentalProfileMessages = {
  session: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  forbidden: 'Bạn không có quyền truy cập chức năng này.',
  notFound: 'Không tìm thấy thông tin hồ sơ',
  profileFailure: 'Không thể tải hồ sơ cá nhân',
  empty: 'Chưa có phòng đang thuê',
  roomFailure: 'Không thể tải thông tin phòng',
  invalidLink: 'Không thể xác định đầy đủ thông tin phòng',
} as const;

export interface RentalProfile {
  fullName: string;
  phone: string | null;
  email: string | null;
  identityType: string | null;
  identityNo: string | null;
  birthDate: string | null;
  address: string | null;
}

export interface RentedRoom {
  code: string;
  name: string;
  area: number | null;
  floor: string;
  buildingName: string;
  buildingAddress: string | null;
}

export type RentalProfileData = { profile: RentalProfile; roomsMessage: string | null } & (
  | { roomsStatus: 'LOADED' | 'EMPTY'; rooms: RentedRoom[] }
  | { roomsStatus: 'LOAD_FAILED' | 'INVALID_LINK'; rooms: null }
);
