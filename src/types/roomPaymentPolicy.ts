import type { BankDetails, FundingType } from './fundingSource';

export interface PaymentSource {
  id: string; name: string; type: FundingType; active: boolean; bankDetails: BankDetails | null;
}
export interface PaymentPolicy {
  allowCash: boolean; allowTransfer: boolean; cashDefault: PaymentSource | null; bankDefault: PaymentSource | null;
}
export interface RoomPaymentPolicy {
  roomId: string; roomCode: string; roomName: string; buildingId: string; buildingName: string;
  configured: boolean; policy: PaymentPolicy | null; version: string | null;
}
export interface PaymentDraft {
  allowCash: boolean; allowTransfer: boolean; cashDefaultId: string | null; bankDefaultId: string | null;
}
export interface PaymentPolicyRoute { roomId: string; returnTo: string }
export interface PaymentApplication { count: number; rooms: { roomId: string; roomCode: string; roomName: string }[] }
export type PaymentField = keyof PaymentDraft | 'roomIds' | 'confirmed' | 'version' | 'sourcePolicyVersion' | 'body' | 'sourceRoomId' | 'applyToAll';
export type PaymentErrors = Partial<Record<PaymentField, string>>;
export const paymentMessages = {
  title: 'Cấu hình thanh toán phòng',
  methods: 'Mỗi phòng phải cho phép ít nhất một phương thức thanh toán (Tiền mặt hoặc Chuyển khoản). Không thể tắt đồng thời cả hai phương thức.',
  required: 'Vui lòng chọn nguồn tiền mặc định tương ứng với phương thức thanh toán đã kích hoạt.',
  inactive: 'Nguồn tiền được chọn đang ngừng hoạt động. Vui lòng chọn một nguồn tiền đang hoạt động hoặc kích hoạt lại nguồn tiền trước khi gán cho phòng.',
  targets: 'Vui lòng chọn ít nhất một phòng để áp dụng cấu hình thanh toán.',
  read: 'Không thể tải cấu hình thanh toán. Vui lòng thử lại.',
  sources: 'Không thể tải danh sách nguồn tiền. Vui lòng tải lại trước khi lưu phương thức này.',
  targetRead: 'Không thể tải danh sách phòng đích. Vui lòng thử lại.',
  sourceInvalid: 'Nguồn tiền không còn hợp lệ. Vui lòng tải lại danh sách và chọn nguồn đang hoạt động.',
  sourceType: 'Nguồn tiền không đúng loại của phương thức thanh toán.',
  invalid: 'Vui lòng kiểm tra các trường được đánh dấu.',
  saved: 'Lưu cấu hình thanh toán thành công.',
  stale: 'Cấu hình thanh toán đã thay đổi. Vui lòng tải lại dữ liệu để đối chiếu trước khi tiếp tục.',
  uncertain: 'Chưa xác định kết quả thao tác. Dữ liệu có thể đã được lưu. Hãy tải lại và kiểm tra cấu hình hiện tại trước khi thực hiện thao tác khác.',
  storage: 'Không thể lưu hoặc truy xuất dữ liệu. Vui lòng thử lại sau.',
  csrf: 'Mã bảo vệ CSRF không hợp lệ hoặc chưa thể tải. Thông tin đang nhập được giữ lại. Vui lòng thử lại.',
  session: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
  forbidden: 'Bạn không có quyền thiết lập thanh toán theo phòng.',
  notFound: 'Không tìm thấy phòng hợp lệ trong phạm vi quản lý.',
  dirtyApply: 'Vui lòng lưu hoặc bỏ các thay đổi chưa lưu trước khi áp dụng cho phòng khác.',
  confirm: 'Thao tác sẽ ghi đè cấu hình thanh toán của các phòng đã chọn. Hóa đơn phát hành mới áp dụng chính sách mới; hóa đơn đã phát hành không bị ảnh hưởng.',
  invoice: 'Cấu hình này áp dụng cho hóa đơn phát hành mới. Hóa đơn đã phát hành giữ nguyên thông tin nhận thanh toán.',
} as const;
