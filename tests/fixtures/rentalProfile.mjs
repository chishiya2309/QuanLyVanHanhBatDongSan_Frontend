export const profile = {
  fullName: 'Nguyễn Minh An', phone: '0901234567', email: 'minh.an@example.test',
  identityType: 'PASSPORT', identityNo: 'P1234567', birthDate: '1995-05-15', address: null,
};

export const rooms = [
  { code: 'A101', name: 'Phòng hướng sân', area: 24.5, floor: 'Tầng 1', buildingName: 'Tòa A',
    buildingAddress: '12 Nguyễn Trãi, phường Bến Thành, Thành phố Hồ Chí Minh' },
  { code: 'B202', name: 'Phòng góc', area: 30, floor: 'Tầng 2', buildingName: 'Tòa B',
    buildingAddress: '125 Nguyễn Thị Minh Khai, phường Xuân Hòa, Thành phố Hồ Chí Minh' },
];

export const loaded = { profile, rooms, roomsStatus: 'LOADED', roomsMessage: null };
export const empty = { profile, rooms: [], roomsStatus: 'EMPTY', roomsMessage: 'Chưa có phòng đang thuê' };
export const roomFailure = { profile, rooms: null, roomsStatus: 'LOAD_FAILED', roomsMessage: 'Không thể tải thông tin phòng' };
export const invalidLink = { profile, rooms: null, roomsStatus: 'INVALID_LINK', roomsMessage: 'Không thể xác định đầy đủ thông tin phòng' };
