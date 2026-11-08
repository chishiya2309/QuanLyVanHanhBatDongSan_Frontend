export type ChargeMethod = 'METERED' | 'FIXED' | 'QUANTITY' | 'CUSTOM';
export type PricingStatus = 'UNCONFIGURED' | 'CONFIGURED';
export type CatalogSystemCode = 'ELECTRICITY' | 'WATER' | null;
export type MoneyVnd = string;
export type CatalogVersion = string;
export interface CatalogService {
  id: string; systemCode: CatalogSystemCode; name: string; unit: string; method: ChargeMethod;
  active: boolean; pricingStatus: PricingStatus; defaultPrice: MoneyVnd | null;
  currentPriceRevisionId: string | null; effectiveFrom: string | null; version: CatalogVersion;
}
export interface CatalogFields { name: string; unit: string; method: ChargeMethod | ''; defaultPrice: string }
export type CatalogFieldErrors = Partial<Record<keyof CatalogFields | 'version', string>>;
export type CatalogAction = 'create' | 'edit' | 'activate' | 'deactivate';
export type CatalogFilter = 'all' | 'active' | 'inactive' | 'unconfigured';
export interface CatalogRoute { q: string; state: CatalogFilter; action: CatalogAction | null; serviceId: string | null; invalid: boolean }
export interface CatalogNotice { kind: 'success' | 'error'; message: string }
export const chargeMethods: Record<ChargeMethod, string> = { METERED: 'Theo đồng hồ', FIXED: 'Cố định', QUANTITY: 'Theo số lượng', CUSTOM: 'Tùy chỉnh' };
export const catalogFilters: Record<CatalogFilter, string> = { all: 'Tất cả', active: 'Đang bật', inactive: 'Đã tắt', unconfigured: 'Chưa thiết lập giá' };
export const catalogMessages = {
  listSuccess: 'Lấy danh mục dịch vụ thành công', detailSuccess: 'Lấy thông tin dịch vụ thành công',
  createSuccess: 'Thêm dịch vụ thành công', updateSuccess: 'Cập nhật dịch vụ thành công',
  activateSuccess: 'Bật lại dịch vụ thành công', deactivateSuccess: 'Tắt dịch vụ thành công',
  sessionInvalid: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại', forbidden: 'Bạn không có quyền thực hiện chức năng này',
  notFound: 'Không thể truy cập dịch vụ được yêu cầu', invalid: 'Dữ liệu không hợp lệ',
  stale: 'Dữ liệu dịch vụ đã thay đổi. Vui lòng tải lại dữ liệu', statusConflict: 'Trạng thái dịch vụ không còn phù hợp. Vui lòng tải lại dữ liệu',
  priceRequired: 'Vui lòng thiết lập đơn giá trước khi bật dịch vụ', priceConflict: 'Không thể cập nhật đơn giá tại thời điểm được xác định',
  listFailure: 'Không thể tải danh mục dịch vụ', detailFailure: 'Không thể tải thông tin dịch vụ',
  createFailure: 'Thêm dịch vụ không thành công', updateFailure: 'Cập nhật dịch vụ không thành công', statusFailure: 'Thay đổi trạng thái dịch vụ không thành công',
  csrfInvalid: 'CSRF token bị thiếu hoặc không hợp lệ. Vui lòng lấy token mới và thử lại',
  csrfFailure: 'Chưa thể lấy mã bảo vệ. Vui lòng thử lại.',
  uncertain: 'Chưa xác định được kết quả. Dữ liệu có thể đã được lưu.',
  invalidRoute: 'Thao tác không hợp lệ. Vui lòng chọn lại dịch vụ từ danh sách.',
} as const;
