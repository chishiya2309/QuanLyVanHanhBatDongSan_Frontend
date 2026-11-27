import { describe, expect, it } from 'vitest';
import { resolveAuthDocumentTitle, resolveDashboardDocumentTitle } from '../src/utils/documentTitle';

describe('documentTitle', () => {
  it('resolves auth and recovery titles', () => {
    expect(resolveAuthDocumentTitle(null, 'login', 'ready')).toBe('Đăng nhập | RentOps');
    expect(resolveAuthDocumentTitle(null, 'register', 'ready')).toBe('Đăng ký tài khoản Host | RentOps');
    expect(resolveAuthDocumentTitle('/forgot-password', 'login', 'ready')).toBe('Quên mật khẩu | RentOps');
    expect(resolveAuthDocumentTitle(null, 'login', 'checking')).toBe('Đang tải phiên làm việc | RentOps');
  });

  it('resolves dashboard titles for each route and role', () => {
    expect(resolveDashboardDocumentTitle({ pathname: '/', role: 'HOST' })).toBe('Tổng quan | RentOps');
    expect(resolveDashboardDocumentTitle({ pathname: '/rooms', role: 'HOST', roomsActive: true })).toBe('Mặt bằng & Phòng | RentOps');
    expect(resolveDashboardDocumentTitle({ pathname: '/assets', role: 'HOST', assetActive: true })).toBe('Tài sản | RentOps');
    expect(resolveDashboardDocumentTitle({ pathname: '/invoices/host', role: 'HOST' })).toBe('Quản lý hóa đơn | RentOps');
    expect(resolveDashboardDocumentTitle({ pathname: '/invoices/customer', role: 'CUSTOMER' })).toBe('Hóa đơn của tôi | RentOps');
    expect(resolveDashboardDocumentTitle({ pathname: '/reports/finance', role: 'HOST', occupancyActive: true, occupancyKind: 'finance' })).toBe('Thu chi & Dòng tiền | RentOps');
    expect(resolveDashboardDocumentTitle({ pathname: '/admin/auto-draft-jobs', role: 'ADMIN' })).toBe('Tiến trình lập hóa đơn tự động | RentOps');
  });
});
