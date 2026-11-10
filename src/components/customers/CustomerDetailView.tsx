import React from 'react';
import { type CustomerResponse, type VehicleResponse, identityTypeLabels, vehicleTypeLabels } from '../../types/customer';
import { formatDateDisplay } from '../../utils/customerValidation';

interface CustomerDetailViewProps {
  customer: CustomerResponse;
  vehicles: VehicleResponse[];
  loadingVehicles: boolean;
  vehiclesError: string | null;
  onBack: () => void;
  onEditCustomer: () => void;
  onAddVehicle: () => void;
  onEditVehicle: (vehicle: VehicleResponse) => void;
  onRetryVehicles: () => void;
  accountSection?: React.ReactNode;
  actionsDisabled?: boolean;
}

export const CustomerDetailView: React.FC<CustomerDetailViewProps> = ({
  customer,
  vehicles,
  loadingVehicles,
  vehiclesError,
  onBack,
  onEditCustomer,
  onAddVehicle,
  onEditVehicle,
  onRetryVehicles,
  accountSection,
  actionsDisabled = false,
}) => {
  return (
    <div className="customer-detail">
      <div className="customer-detail-header">
        <div>
          <button type="button" className="customer-button" onClick={onBack} aria-label="Quay lại danh sách khách thuê">
            ← Quay lại danh sách
          </button>
          <h1 id="customers-page-title" style={{ marginTop: 'var(--space-sm)' }}>{customer.fullName}</h1>
          <p style={{ color: 'var(--color-muted)', margin: 'var(--space-2xs) 0 0' }}>
            Mã định danh: <code>{customer.id}</code> · Version hồ sơ: <code>{customer.version}</code>
          </p>
        </div>
        <button type="button" className="customer-button customer-button--primary" disabled={actionsDisabled} onClick={onEditCustomer}>
          Chỉnh sửa hồ sơ
        </button>
      </div>

      <div className="customer-profile-card">
        <h2>Thông tin khách thuê</h2>
        <dl className="customer-grid">
          <div className="customer-fact">
            <dt>Họ và tên</dt>
            <dd>{customer.fullName}</dd>
          </div>
          <div className="customer-fact">
            <dt>Số điện thoại</dt>
            <dd>{customer.phone || '—'}</dd>
          </div>
          <div className="customer-fact">
            <dt>Email liên hệ</dt>
            <dd>{customer.email || '—'}</dd>
          </div>
          <div className="customer-fact">
            <dt>Giấy tờ tùy thân</dt>
            <dd>
              {customer.identityType && customer.identityNo ? (
                <>
                  <span className="customer-badge">{identityTypeLabels[customer.identityType]}</span>{' '}
                  <strong>{customer.identityNo}</strong>
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="customer-fact">
            <dt>Ngày sinh</dt>
            <dd>{formatDateDisplay(customer.birthDate)}</dd>
          </div>
          <div className="customer-fact">
            <dt>Địa chỉ liên hệ</dt>
            <dd>{customer.address || '—'}</dd>
          </div>
          <div className="customer-fact" style={{ gridColumn: '1 / -1' }}>
            <dt>Ghi chú hồ sơ</dt>
            <dd style={{ fontWeight: 400, color: customer.note ? 'inherit' : 'var(--color-muted)' }}>
              {customer.note || 'Không có ghi chú'}
            </dd>
          </div>
        </dl>
      </div>

      {accountSection}

      <div className="customer-vehicles-section">
        <div className="customer-vehicles-header">
          <div>
            <h2>Danh sách phương tiện</h2>
            <p style={{ color: 'var(--color-muted)', margin: 0 }}>
              Quản lý xe máy, ô tô, xe đạp hoặc phương tiện khác đã đăng ký của khách thuê này.
            </p>
          </div>
          <button type="button" className="customer-button" disabled={actionsDisabled} onClick={onAddVehicle}>
            + Thêm phương tiện
          </button>
        </div>

        {loadingVehicles && (
          <div className="customer-results" role="status">
            <p>Đang tải danh sách phương tiện…</p>
          </div>
        )}

        {vehiclesError && (
          <div className="customer-error" role="alert">
            <p>{vehiclesError}</p>
            <button type="button" className="customer-button" onClick={onRetryVehicles}>
              Thử lại
            </button>
          </div>
        )}

        {!loadingVehicles && !vehiclesError && vehicles.length === 0 && (
          <div className="customer-empty">
            <h2>Khách thuê chưa đăng ký phương tiện nào</h2>
            <p>Customer này chưa có xe được quản lý trong hệ thống.</p>
            <button type="button" className="customer-button customer-button--primary" disabled={actionsDisabled} onClick={onAddVehicle}>
              Thêm phương tiện ngay
            </button>
          </div>
        )}

        {!loadingVehicles && !vehiclesError && vehicles.length > 0 && (
          <table className="customer-table">
            <caption className="visually-hidden">Danh sách phương tiện của {customer.fullName}</caption>
            <thead>
              <tr>
                <th scope="col">Loại phương tiện</th>
                <th scope="col">Biển số</th>
                <th scope="col">Ghi chú</th>
                <th scope="col">Version xe</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <th scope="row">
                    <span className="customer-badge">{vehicleTypeLabels[v.type]}</span>
                  </th>
                  <td>
                    <strong>{v.plateNumber}</strong>
                  </td>
                  <td>{v.note || '—'}</td>
                  <td>
                    <code>{v.version}</code>
                  </td>
                  <td>
                    <button type="button" className="customer-button" disabled={actionsDisabled} onClick={() => onEditVehicle(v)}>
                      Chỉnh sửa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
