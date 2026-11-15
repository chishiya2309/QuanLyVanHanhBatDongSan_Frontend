export type ProvisionalRole = 'HOST' | 'CUSTOMER';
export type ItemStatus = 'CALCULATED' | 'MISSING_DATA';
export type SummaryStatus = 'FULL' | 'PARTIAL' | 'INSUFFICIENT_DATA' | 'EMPTY';
export type ChargeMethod = 'METERED' | 'FIXED' | 'QUANTITY' | 'CUSTOM';
export interface ProvisionalRoute { role: ProvisionalRole; roomId: string; periodId: string; invalid: boolean }
export interface PeriodHeader {
  periodId: string; roomId: string; roomCode: string; buildingName: string;
  fromDate: string; toDate: string; cycleStart: string; cycleEnd: string;
  periodStatus: 'OPEN'; invoiceStatus: 'DRAFT' | null;
}
export interface ChargeItem {
  itemType: 'SERVICE' | 'FEE' | 'DISCOUNT'; itemCode: string; itemName: string; unit: string;
  serviceId: string | null; roomServiceId: string | null; adjustmentId: string | null;
  chargeMethod: ChargeMethod;
  startIndex: string | null; endIndex: string | null; consumption: string | null; quantity: string | null;
  manualAmount: string | null; unitPrice: string | null; prorateFactor: string | null;
  basisDate: string | null; pricingSource: 'ROOM' | 'BUILDING' | 'CATALOG' | null;
  amount: string | null; status: ItemStatus; missingReason: string | null;
}
export interface PeriodSummary {
  status: SummaryStatus; displayLabel: string; totalAmount: string | null;
  calculatedItemsCount: number; missingItemsCount: number;
}
export interface ProvisionalDetail extends PeriodHeader {
  rentalContractId: string; tenancyId: string; tenancyFromDate: string; tenancyToDate: string | null;
  items: ChargeItem[]; summary: PeriodSummary; concurrencyToken: string; isStale: boolean;
}
export interface ProvisionalPeriods { periods: PeriodHeader[]; code?: string; message: string }
export type DetailResult = { kind: 'data'; detail: ProvisionalDetail; etag: string }
  | { kind: 'not-modified'; etag: string | null };
export const provisionalMessages = {
  title: 'Xem tạm tính dịch vụ',
  intro: 'Dịch vụ, phí phát sinh và giảm trừ theo từng kỳ.',
  choose: 'Chọn phòng và kỳ để xem tạm tính',
  readFailure: 'Không thể tải dữ liệu tạm tính. Vui lòng thử lại sau.',
  reloadFailure: 'Chưa thể tải lại dữ liệu mới nhất. Kết quả hiển thị có thể chưa được cập nhật.',
  session: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
  denied: 'Không tìm thấy dữ liệu trong phạm vi được phép của bạn.',
  context: 'Vui lòng chọn đầy đủ phòng và kỳ cần xem tạm tính.',
  invalid: 'Không thể xem ngữ cảnh được yêu cầu. Vui lòng tải lại danh sách và chọn đúng phòng, kỳ.',
  source: 'Dữ liệu nguồn ghi nhận không hợp lệ để tính toán chính xác.',
  closed: 'Kỳ này đã chốt hoặc hóa đơn đã được phát hành. Không còn thuộc phạm vi xem tạm tính.',
  moved: 'Phạm vi xem tạm tính đã thay đổi. Lượt thuê trước đó đã kết thúc.',
  concurrency: 'Dữ liệu nguồn đã thay đổi trong lúc xem. Vui lòng tải lại.',
  noTenancy: 'Không có lượt thuê đang diễn ra để xem tạm tính',
  noPeriods: 'Không có kỳ tạm tính phù hợp',
  noCharges: 'Không có khoản dịch vụ/phí trong kỳ đã chọn',
} as const;
