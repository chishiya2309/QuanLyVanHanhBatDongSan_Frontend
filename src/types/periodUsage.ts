export type PeriodUsageTab = 'quantity' | 'custom' | 'fee' | 'discount';

export interface PeriodUsageRoute {
  buildingId: string;
  roomId: string;
  periodId: string;
  tab: PeriodUsageTab;
  invalid: boolean;
  returnTo?: string;
}

export interface QuantityServiceItem {
  roomServiceId: string;
  serviceName: string;
  unit: string;
  defaultQuantity: string | null;
  isRecorded: boolean;
  recordedQuantity: string | null;
}

export interface CustomServiceItem {
  roomServiceId: string;
  serviceName: string;
  unit: string;
  isRecorded: boolean;
  recordedAmount: number | null;
}

export interface ServiceUsageItem {
  id: string;
  periodId: string;
  roomServiceId: string;
  serviceName: string;
  method: string;
  quantity: string | null;
  manualAmount: number | null;
  recordedAt: string;
}

export interface AdjustmentItem {
  id: string;
  periodId: string;
  type: 'FEE' | 'DISCOUNT';
  description: string;
  amount: number;
  recordedAt: string;
}

export interface UsageContext {
  periodId: string;
  roomId: string;
  roomCode: string;
  buildingId: string;
  buildingName: string;
  fromDate: string;
  toDate: string;
  cycleStart: string;
  cycleEnd: string;
  periodStatus: 'OPEN' | 'SEALED';
  invoiceStatus: string;
  canRecord: boolean;
  concurrencyVersion: string;
  quantityServices: QuantityServiceItem[];
  customServices: CustomServiceItem[];
  existingUsages: ServiceUsageItem[];
  existingAdjustments: AdjustmentItem[];
}

export interface SavedUsageResponse {
  id: string;
  periodId: string;
  roomServiceId: string;
  serviceName: string;
  quantity: string | null;
  manualAmount: number | null;
  recordedAt: string;
}

export interface SavedAdjustmentResponse {
  id: string;
  periodId: string;
  type: 'FEE' | 'DISCOUNT';
  description: string;
  amount: number;
  recordedAt: string;
}

export interface RecordQuantityPayload {
  periodId: string;
  roomServiceId: string;
  quantity: string;
  concurrencyVersion?: string;
}

export interface RecordCustomFeePayload {
  periodId: string;
  roomServiceId: string;
  amount: number;
  concurrencyVersion?: string;
}

export interface AddFeeAdjustmentPayload {
  periodId: string;
  description: string;
  amount: number;
  concurrencyVersion?: string;
}

export interface AddDiscountAdjustmentPayload {
  periodId: string;
  description: string;
  amount: number;
  concurrencyVersion?: string;
}

export const periodUsageMessages = {
  forbidden: 'Chỉ Host mới có quyền truy cập chức năng này.',
  sessionInvalid: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
  notFound: 'Không tìm thấy dữ liệu trong phạm vi quản lý của bạn.',
  readFailure: 'Không thể tải dữ liệu bối cảnh kỳ và dịch vụ. Vui lòng thử lại sau.',
  saveSuccessQuantity: 'Ghi nhận số lượng dịch vụ thành công.',
  saveSuccessCustom: 'Ghi nhận phí dịch vụ thực tế thành công.',
  saveSuccessFee: 'Thêm phí phát sinh thành công.',
  saveSuccessDiscount: 'Thêm khoản giảm trừ thành công.',
  uncertain: 'Chưa xác định được kết quả lưu do kết nối gián đoạn. Vui lòng tải lại bối cảnh để kiểm tra.',
  lockedPeriod: 'Kỳ tính tiền đã khóa (SEALED) hoặc hóa đơn đã phát hành (ISSUED). Dữ liệu chỉ được xem, không cho phép ghi mới.',
  duplicateExists: 'Cặp kỳ–dịch vụ này đã được ghi nhận trước đó. Không cho phép ghi đè hoặc sửa.',
  duplicateFeeSource: 'Khoản chi phí thực tế này đã được ghi nhận trước đó từ nguồn khác. Một khoản phí chỉ có một nguồn duy nhất.',
  staleContext: 'Dữ liệu bối cảnh đã thay đổi bởi một thao tác khác. Vui lòng tải lại dữ liệu trước khi gửi lại.',
  invalidQuantity: 'Vui lòng nhập số lượng hợp lệ (số không âm). Ô trống không tự động coi là 0.',
  invalidAmount: 'Vui lòng nhập số tiền VND không âm và không có phần lẻ.',
  emptyDescription: 'Vui lòng nhập nội dung cho khoản điều chỉnh để nhận biết thực tế.'
};
