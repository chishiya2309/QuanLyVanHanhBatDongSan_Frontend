import type { AccountRole } from '../types/auth';
import { isAutoDraftJobsPath } from '../types/autoDraftBilling';
import { isBillingSchedulePath } from './billingScheduleNavigation';
import { isInvoicePath } from '../services/invoiceApi';

export interface DashboardTitleContext {
  pathname: string;
  role: AccountRole;
  templateActive?: boolean;
  fundingActive?: boolean;
  rentalProfileActive?: boolean;
  provisionalActive?: boolean;
  periodUsageActive?: boolean;
  meterActive?: boolean;
  customerActive?: boolean;
  policyActive?: boolean;
  catalogActive?: boolean;
  contractActive?: boolean;
  rentalContractActive?: boolean;
  propertiesActive?: boolean;
  occupancyKind?: string | null;
  occupancyActive?: boolean;
  roomsActive?: boolean;
  assetActive?: boolean;
  hostActive?: boolean;
}

const APP_BRAND = 'RentOps';

export function resolveAuthDocumentTitle(
  recoveryPath: string | null,
  view: 'login' | 'register' | 'dashboard',
  authCheck: 'checking' | 'ready' | 'error',
): string {
  if (recoveryPath === '/forgot-password') return `Quên mật khẩu | ${APP_BRAND}`;
  if (recoveryPath === '/reset-password') return `Đặt lại mật khẩu | ${APP_BRAND}`;
  if (authCheck === 'checking') return `Đang tải phiên làm việc | ${APP_BRAND}`;
  if (view === 'register') return `Đăng ký tài khoản Host | ${APP_BRAND}`;
  return `Đăng nhập | ${APP_BRAND}`;
}

export function resolveDashboardDocumentTitle(ctx: DashboardTitleContext): string {
  if (isAutoDraftJobsPath(ctx.pathname)) return `Tiến trình lập hóa đơn tự động | ${APP_BRAND}`;
  if (isBillingSchedulePath(ctx.pathname)) return `Lịch lập hóa đơn | ${APP_BRAND}`;
  if (isInvoicePath(ctx.pathname)) {
    return `${ctx.role === 'CUSTOMER' ? 'Hóa đơn của tôi' : 'Quản lý hóa đơn'} | ${APP_BRAND}`;
  }
  if (ctx.templateActive) return `Mẫu biểu | ${APP_BRAND}`;
  if (ctx.fundingActive) return `Quản lý nguồn tiền | ${APP_BRAND}`;
  if (ctx.rentalProfileActive) return `Hồ sơ thuê trọ | ${APP_BRAND}`;
  if (ctx.provisionalActive) return `Tạm tính dịch vụ | ${APP_BRAND}`;
  if (ctx.periodUsageActive) return `Số lượng, phí & giảm trừ | ${APP_BRAND}`;
  if (ctx.meterActive) return `Ghi và kiểm tra chỉ số | ${APP_BRAND}`;
  if (ctx.customerActive) return `Khách thuê | ${APP_BRAND}`;
  if (ctx.policyActive) return `Chính sách thanh toán | ${APP_BRAND}`;
  if (ctx.catalogActive) return `Danh mục dịch vụ | ${APP_BRAND}`;
  if (ctx.contractActive) return `Hợp đồng đặt cọc | ${APP_BRAND}`;
  if (ctx.rentalContractActive) return `Hợp đồng thuê | ${APP_BRAND}`;
  if (ctx.propertiesActive) return `Cơ sở & Tòa nhà | ${APP_BRAND}`;
  if (ctx.occupancyActive) {
    switch (ctx.occupancyKind) {
      case 'finance':
      case 'cash-ledger':
        return `Thu chi & Dòng tiền | ${APP_BRAND}`;
      case 'expense-breakdown':
        return `Cơ cấu chi phí | ${APP_BRAND}`;
      case 'profit-loss':
        return `Doanh thu & Lời lỗ | ${APP_BRAND}`;
      case 'expiring-leases':
        return `Phòng sắp trống | ${APP_BRAND}`;
      case 'occupancy-analysis':
        return `Tỷ lệ lấp đầy | ${APP_BRAND}`;
      default:
        return `Phân tích phòng trống | ${APP_BRAND}`;
    }
  }
  if (ctx.roomsActive) return `Mặt bằng & Phòng | ${APP_BRAND}`;
  if (ctx.assetActive) return `Tài sản | ${APP_BRAND}`;
  if (ctx.hostActive) return `Tài khoản Host | ${APP_BRAND}`;
  return `Tổng quan | ${APP_BRAND}`;
}
