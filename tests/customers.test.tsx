import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerDetailView } from '../src/components/customers/CustomerDetailView';
import { CustomerForbidden, CustomersPage } from '../src/components/customers/CustomersPage';
import type { CustomerResponse, CustomerRoute, VehicleResponse } from '../src/types/customer';

const mockCustomer: CustomerResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'Nguyễn Văn An',
  phone: '0901234567',
  email: 'an@example.com',
  identityType: 'CCCD',
  identityNo: '079090123456',
  birthDate: '1995-10-15',
  address: 'TP. Hồ Chí Minh',
  note: 'Ghi chú mẫu',
  version: '0',
};

const mockVehicle: VehicleResponse = {
  id: '22222222-2222-4222-8222-222222222222',
  customerId: '11111111-1111-4111-8111-111111111111',
  type: 'MOTORBIKE',
  plateNumber: '59A1-123.45',
  note: 'Vision đỏ',
  version: '0',
  customerVersion: '0',
};

describe('CustomersPage & CustomerDetailView Components', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders CustomerForbidden with message and action button', () => {
    const onOverview = vi.fn();
    render(<CustomerForbidden onOverview={onOverview} />);

    expect(screen.getByText('Quản lý khách thuê')).toBeDefined();
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Bạn không có quyền thực hiện chức năng này')).toBeDefined();

    fireEvent.click(screen.getByText('Về tổng quan'));
    expect(onOverview).toHaveBeenCalledTimes(1);
  });

  it('renders CustomerDetailView with profile facts and vehicle list', () => {
    const onBack = vi.fn();
    const onEditCustomer = vi.fn();
    const onAddVehicle = vi.fn();
    const onEditVehicle = vi.fn();
    const onRetryVehicles = vi.fn();

    render(
      <CustomerDetailView
        customer={mockCustomer}
        vehicles={[mockVehicle]}
        loadingVehicles={false}
        vehiclesError={null}
        onBack={onBack}
        onEditCustomer={onEditCustomer}
        onAddVehicle={onAddVehicle}
        onEditVehicle={onEditVehicle}
        onRetryVehicles={onRetryVehicles}
      />
    );

    expect(screen.getAllByText('Nguyễn Văn An')).toHaveLength(2);
    expect(screen.getByText('0901234567')).toBeDefined();
    expect(screen.getByText('079090123456')).toBeDefined();
    expect(screen.getByText('15/10/1995')).toBeDefined();
    expect(screen.getByText('59A1-123.45')).toBeDefined();
    expect(screen.getByText('Xe máy')).toBeDefined();

    fireEvent.click(screen.getByText('Chỉnh sửa hồ sơ'));
    expect(onEditCustomer).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('+ Thêm phương tiện'));
    expect(onAddVehicle).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Chỉnh sửa'));
    expect(onEditVehicle).toHaveBeenCalledWith(mockVehicle);

    fireEvent.click(screen.getByText('← Quay lại danh sách'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders empty vehicle state when customer has no vehicles', () => {
    const onAddVehicle = vi.fn();

    render(
      <CustomerDetailView
        customer={mockCustomer}
        vehicles={[]}
        loadingVehicles={false}
        vehiclesError={null}
        onBack={vi.fn()}
        onEditCustomer={vi.fn()}
        onAddVehicle={onAddVehicle}
        onEditVehicle={vi.fn()}
        onRetryVehicles={vi.fn()}
      />
    );

    expect(screen.getByText('Khách thuê chưa đăng ký phương tiện nào')).toBeDefined();
    const addNowButton = screen.getByText('Thêm phương tiện ngay');
    expect(addNowButton).toBeDefined();

    fireEvent.click(addNowButton);
    expect(onAddVehicle).toHaveBeenCalledTimes(1);
  });

  it('renders search bar and header on CustomersPage list view', () => {
    const route: CustomerRoute = {
      view: 'list',
      customerId: null,
      action: null,
      vehicleAction: null,
      accountAction: null,
      vehicleId: null,
      page: 0,
      size: 20,
      q: '',
      invalid: false,
    };

    render(
      <CustomersPage
        route={route}
        onNavigate={vi.fn()}
        onSessionExpired={vi.fn()}
        onForbidden={vi.fn()}
      />
    );

    expect(screen.getByText('Quản lý khách thuê')).toBeDefined();
    expect(screen.getByText('+ Thêm khách thuê')).toBeDefined();
    expect(screen.getByPlaceholderText('Nhập từ khóa tìm kiếm...')).toBeDefined();
  });
});
