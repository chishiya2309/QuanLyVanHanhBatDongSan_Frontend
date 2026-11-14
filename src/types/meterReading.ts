export type MeterView = 'single' | 'batch' | 'progress';
export interface MeterRoute {
  view: MeterView; fromDate: string; toDate: string; buildingId: string;
  roomIds: string[]; periodIds: string[]; page: number; periodPage: number;
  readingId: string | null; invalid: boolean;
}
export interface MeterScope { periodIds: string[]; buildingId?: string; roomIds?: string[] }
export interface MeterPage<T> { items: T[]; total: number; page: number; size: number }
export interface BillingPeriod {
  id: string; tenancyId: string; roomId: string; roomCode: string; buildingId: string;
  fromDate: string; toDate: string; cycleStart: string; cycleEnd: string; status: 'OPEN' | 'SEALED';
}
export interface MeterItem {
  requirementId: string; periodId: string; roomServiceId: string; roomId: string; roomCode: string;
  buildingId: string; buildingName: string; serviceName: string; unit: string;
  fromDate: string; toDate: string; cycleStart: string; cycleEnd: string; periodStatus: 'OPEN' | 'SEALED';
  readingId: string | null; startIndex: string | null; endIndex: string | null; consumption: string | null;
  startSource: 'PREVIOUS_READING' | 'HANDOVER' | 'HOST_CONFIRMED' | null; sourceId: string | null;
  initialStartAllowed: boolean; canCreate: boolean; canUpdate: boolean; blockedReason: string | null; version: string;
}
export interface MeterProgress {
  required: number; completed: number; pending: number; pendingRoomIds: string[];
  pendingRooms: { roomId: string; roomCode: string; buildingId: string; missingRequirementIds: string[] }[];
}
export interface MeterCreate { periodId: string; roomServiceId: string; endIndex: string; version: string; startIndex?: string }
export interface MeterCorrect { endIndex: string; version: string }
export type MeterResultState = 'SAVED' | 'FAILED' | 'UNKNOWN' | 'NOT_PROCESSED';
export interface MeterResult {
  index: number; periodId: string; roomServiceId: string; state: MeterResultState;
  saved: MeterItem | null; status: number | null; code: string | null; message: string | null;
}
export interface MeterBatch {
  outcome: 'ALL_SAVED' | 'PARTIALLY_SAVED' | 'NONE_SAVED' | 'INTERRUPTED'; saved: number; failed: number; results: MeterResult[];
}
export interface MeterDraft {
  item: MeterItem; end: string; start: string; confirmed: boolean; selected: boolean;
  reviewRequired: boolean; fields: Record<string, string>;
}
export const meterKey = (item: { periodId: string; roomServiceId: string }) => item.periodId + ':' + item.roomServiceId;
export const meterMessages = {
  empty: 'Không có dữ liệu cần ghi chỉ số trong phạm vi đã chọn',
  readFailure: 'Không thể tải dữ liệu chỉ số. Vui lòng thử lại.',
  sessionInvalid: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
  forbidden: 'Bạn không có quyền truy cập chức năng hoặc phạm vi này.',
  notFound: 'Không tìm thấy dữ liệu hoặc dữ liệu không còn thuộc phạm vi truy cập.',
  uncertain: 'Chưa xác định đầy đủ kết quả lưu. Tải lại để đối chiếu trước khi gửi tiếp.',
  stale: 'Dữ liệu đã thay đổi. Tải lại và kiểm tra trước khi lưu.',
  savedReload: 'Kết quả lưu đã được xác nhận, nhưng chưa tải lại đầy đủ dữ liệu hoặc tiến độ. Vui lòng tải lại.',
};
export const meterBlockLabels: Record<string, string> = {
  PERIOD_LOCKED: 'Kỳ đã khóa, chỉ được xem.', INVOICE_ISSUED: 'Hóa đơn đã phát hành, chỉ được xem.',
  PREVIOUS_READING_MISSING: 'Thiếu chỉ số hợp lệ của kỳ trước. Cần hoàn tất kỳ trước để nối chuỗi.',
  MISSING_BASELINE: 'Chưa có nguồn chỉ số đầu hợp lệ.',
  AMBIGUOUS_BASELINE: 'Có nhiều nguồn bàn giao. Cần kiểm tra lại dữ liệu nguồn.',
  INVALID_BASELINE: 'Nguồn bàn giao không hợp lệ. Cần kiểm tra lại dữ liệu nguồn.',
};
export const meterSourceLabels = { PREVIOUS_READING: 'Kế thừa kỳ trước', HANDOVER: 'Bàn giao nhận phòng', HOST_CONFIRMED: 'Host xác nhận ban đầu' };
