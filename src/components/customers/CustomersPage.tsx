import './customers.css';
import { useId, useState } from 'react';
import { useCustomerDetail } from '../../hooks/useCustomerDetail';
import { useCustomers } from '../../hooks/useCustomers';
import {
  customerMessages as m,
  type CustomerResponse,
  type CustomerRoute,
  type VehicleResponse,
  identityTypeLabels,
} from '../../types/customer';
import { customerUrl } from '../../utils/customerNavigation';
import { formatDateDisplay } from '../../utils/customerValidation';
import { CustomerDetailView } from './CustomerDetailView';
import { CustomerFormDialog } from './CustomerFormDialog';
import { VehicleFormDialog } from './VehicleFormDialog';
import { CustomerAccountSection } from './CustomerAccountSection';
import type { NavigationGuardRegistration } from '../../hooks/useServiceCatalog';

export function CustomerForbidden({ onOverview }: { onOverview: () => void }) {
  return (
    <section className="customer-page">
      <h1>Quản lý khách thuê</h1>
      <p role="alert">{m.forbidden}</p>
      <button type="button" className="customer-button" onClick={onOverview}>
        Về tổng quan
      </button>
    </section>
  );
}

function SearchForm({
  initialQuery,
  onSearch,
}: {
  initialQuery: string;
  onSearch: (q: string) => void;
}) {
  const [draft, setDraft] = useState(initialQuery);
  const searchId = useId();

  return (
    <form
      className="customer-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(draft.trim());
      }}
    >
      <label htmlFor={searchId}>Tìm theo họ tên, số điện thoại hoặc số giấy tờ</label>
      <div>
        <input
          id={searchId}
          name="q"
          type="search"
          value={draft}
          placeholder="Nhập từ khóa tìm kiếm..."
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="customer-button">
          Tìm kiếm
        </button>
      </div>
    </form>
  );
}

export function CustomersPage({
  route,
  onNavigate,
  onSessionExpired,
  onForbidden,
  registerGuard,
}: {
  route: CustomerRoute;
  onNavigate: (url: string, replace?: boolean) => void;
  onSessionExpired: (message?: string) => void;
  onForbidden: () => void;
  registerGuard?: NavigationGuardRegistration;
}) {
  const isDetail = route.view === 'detail' && Boolean(route.customerId);
  const [boundaryNotice, setBoundaryNotice] = useState<string | null>(null);

  const listHook = useCustomers(route, {
    onNavigate,
    onSessionExpired,
    onForbidden,
  });

  const detailHook = useCustomerDetail(route, {
    onNavigate,
    onSessionExpired,
    onForbidden,
    onUnavailable: (message) => { registerGuard?.(null); setBoundaryNotice(message); },
  });

  const activeNotice = boundaryNotice ? { kind: 'error', message: boundaryNotice } : isDetail ? detailHook.notice || listHook.notice : listHook.notice;
  const dismissNotice = () => { setBoundaryNotice(null); detailHook.dismissNotice(); listHook.dismissNotice(); };

  const editingVehicle =
    isDetail && route.vehicleAction === 'edit' && route.vehicleId
      ? detailHook.vehicles.find((v) => v.id === route.vehicleId) || null
      : null;

  return (
    <section className="customer-page" aria-labelledby="customers-page-title">
      {activeNotice && (
        <div
          className={`customer-banner${activeNotice.kind === 'error' ? ' customer-banner--error' : ''}`}
          role={activeNotice.kind === 'success' ? 'status' : 'alert'}
        >
          <p>{activeNotice.message}</p>
          <button type="button" className="customer-button" onClick={dismissNotice} aria-label="Đóng thông báo">
            Đóng
          </button>
        </div>
      )}

      {isDetail && detailHook.customer?.id === route.customerId ? (
        <>
        {detailHook.customerError && <div role="alert" className="customer-error"><p>{detailHook.customerError}</p>
          <button type="button" className="customer-button" onClick={detailHook.refreshCustomer}>Thử lại</button></div>}
        {detailHook.snapshotRefreshing && <p role="status">Đang đồng bộ hồ sơ khách thuê…</p>}
        <CustomerDetailView
          customer={detailHook.customer}
          vehicles={detailHook.vehicles}
          loadingVehicles={detailHook.loadingVehicles}
          vehiclesError={detailHook.vehiclesError}
          onBack={() => onNavigate(customerUrl({ q: route.q, page: route.page, size: route.size }))}
          onEditCustomer={() => onNavigate(customerUrl(route, { customerId: route.customerId, action: 'edit' }))}
          onAddVehicle={() => onNavigate(customerUrl(route, { customerId: route.customerId, vehicleAction: 'create' }))}
          onEditVehicle={(vehicle: VehicleResponse) =>
            onNavigate(
              customerUrl(route, {
                customerId: route.customerId,
                vehicleAction: 'edit',
                vehicleId: vehicle.id,
              })
            )
          }
          onRetryVehicles={detailHook.refreshVehicles}
          actionsDisabled={detailHook.snapshotRefreshing}
          accountSection={<CustomerAccountSection key={detailHook.customer.id} customer={detailHook.customer} route={route}
            registerGuard={registerGuard} onNavigate={onNavigate} onSessionExpired={onSessionExpired} onForbidden={onForbidden}
            onProfileRefresh={detailHook.refreshAfterAccount} onUnavailable={setBoundaryNotice} />}
        />
        </>
      ) : isDetail ? (
        <div className="customer-results">
          {detailHook.customerError ? <div role="alert"><p>{detailHook.customerError}</p>
            <button type="button" className="customer-button" onClick={detailHook.refreshCustomer}>Thử lại</button></div>
            : <p role="status">Đang tải thông tin khách thuê…</p>}
        </div>
      ) : (
        <>
          <header className="customer-heading">
            <div>
              <h1 id="customers-page-title">Quản lý khách thuê</h1>
              <p>Quản lý hồ sơ khách thuê đại diện và phương tiện trong phạm vi quản lý của Host.</p>
            </div>
            <button
              type="button"
              className="customer-button customer-button--primary"
              onClick={() => onNavigate(customerUrl(route, { action: 'create' }))}
            >
              + Thêm khách thuê
            </button>
          </header>

          <div className="customer-toolbar">
            <SearchForm
              initialQuery={route.q}
              onSearch={(q) => onNavigate(customerUrl({ q, page: 0, size: route.size }))}
            />
          </div>

          {listHook.loading && (
            <div className="customer-results" role="status">
              <p>Đang tải danh sách khách thuê…</p>
            </div>
          )}

          {listHook.error && (
            <div className="customer-error" role="alert">
              <p>{listHook.error}</p>
              <button type="button" className="customer-button" onClick={listHook.refresh}>
                Thử lại
              </button>
            </div>
          )}

          {!listHook.loading && !listHook.error && listHook.data && (
            <>
              <div className="customer-results">
                <p role="status" aria-live="polite">
                  {listHook.data.totalElements.toLocaleString('vi-VN')} khách thuê
                </p>
                <button type="button" className="customer-button" onClick={listHook.refresh}>
                  Tải lại
                </button>
              </div>

              {listHook.data.content.length === 0 ? (
                <div className="customer-empty">
                  <h2>{route.q ? 'Không tìm thấy khách thuê phù hợp' : 'Chưa có khách thuê nào'}</h2>
                  <p>
                    {route.q
                      ? 'Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.'
                      : 'Bắt đầu bằng việc thêm hồ sơ khách thuê đại diện đầu tiên.'}
                  </p>
                  <button
                    type="button"
                    className="customer-button customer-button--primary"
                    onClick={
                      route.q
                        ? () => onNavigate(customerUrl({ q: '', page: 0, size: route.size }))
                        : () => onNavigate(customerUrl(route, { action: 'create' }))
                    }
                  >
                    {route.q ? 'Xóa tìm kiếm' : 'Thêm khách thuê đầu tiên'}
                  </button>
                </div>
              ) : (
                <>
                  <table className="customer-table">
                    <caption className="visually-hidden">Danh sách khách thuê của Host</caption>
                    <thead>
                      <tr>
                        <th scope="col">Họ và tên</th>
                        <th scope="col">Số điện thoại</th>
                        <th scope="col">Email</th>
                        <th scope="col">Giấy tờ tùy thân</th>
                        <th scope="col">Ngày sinh</th>
                        <th scope="col">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listHook.data.content.map((item: CustomerResponse) => (
                        <tr key={item.id}>
                          <th scope="row">
                            <strong>{item.fullName}</strong>
                          </th>
                          <td>{item.phone || '—'}</td>
                          <td>{item.email || '—'}</td>
                          <td>
                            {item.identityType && item.identityNo ? (
                              <>
                                <span className="customer-badge">{identityTypeLabels[item.identityType]}</span>{' '}
                                <span>{item.identityNo}</span>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>{formatDateDisplay(item.birthDate)}</td>
                          <td>
                            <div className="customer-row-actions">
                              <button
                                type="button"
                                className="customer-button"
                                onClick={() =>
                                  onNavigate(customerUrl(route, { customerId: item.id }))
                                }
                              >
                                Chi tiết &amp; Phương tiện
                              </button>
                              <button
                                type="button"
                                className="customer-button"
                                onClick={() =>
                                  onNavigate(
                                    customerUrl(route, {
                                      customerId: item.id,
                                      action: 'edit',
                                    })
                                  )
                                }
                              >
                                Sửa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="customer-pagination">
                    <div>
                      Trang {listHook.data.page + 1} / {Math.max(1, listHook.data.totalPages)}
                    </div>
                    <div className="customer-pagination-controls">
                      <button
                        type="button"
                        className="customer-button"
                        disabled={listHook.data.first || listHook.loading}
                        onClick={() =>
                          onNavigate(
                            customerUrl({
                              q: route.q,
                              page: Math.max(0, route.page - 1),
                              size: route.size,
                            })
                          )
                        }
                      >
                        ← Trang trước
                      </button>
                      <button
                        type="button"
                        className="customer-button"
                        disabled={listHook.data.last || listHook.loading}
                        onClick={() =>
                          onNavigate(
                            customerUrl({
                              q: route.q,
                              page: route.page + 1,
                              size: route.size,
                            })
                          )
                        }
                      >
                        Trang sau →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Customer Create Form Dialog */}
      {!route.invalid && !isDetail && route.action === 'create' && (
        <CustomerFormDialog
          action="create"
          pending={listHook.pending}
          serverFieldErrors={listHook.fieldErrors}
          onClose={() => onNavigate(customerUrl(route, { action: null }), true)}
          onSubmit={listHook.submitCreate}
        />
      )}

      {/* Customer Edit Form Dialog */}
      {!route.invalid && !detailHook.snapshotRefreshing && isDetail && route.action === 'edit' && detailHook.customer?.id === route.customerId && (
        <CustomerFormDialog
          action="edit"
          customer={detailHook.customer}
          pending={detailHook.pending}
          serverFieldErrors={detailHook.customerFieldErrors}
          onClose={() => onNavigate(customerUrl(route, { customerId: route.customerId, action: null }), true)}
          onSubmit={detailHook.submitUpdateCustomer}
        />
      )}

      {/* Vehicle Add Form Dialog */}
      {!route.invalid && !detailHook.snapshotRefreshing && isDetail && route.vehicleAction === 'create' && detailHook.customer?.id === route.customerId && (
        <VehicleFormDialog
          action="create"
          customerVersion={detailHook.customer.version}
          pending={detailHook.pending}
          serverFieldErrors={detailHook.vehicleFieldErrors}
          onClose={() =>
            onNavigate(
              customerUrl(route, {
                customerId: route.customerId,
                vehicleAction: null,
                vehicleId: null,
              }),
              true
            )
          }
          onSubmit={detailHook.submitAddVehicle}
        />
      )}

      {/* Vehicle Edit Form Dialog */}
      {!route.invalid && !detailHook.snapshotRefreshing && isDetail && route.vehicleAction === 'edit' && editingVehicle && detailHook.customer?.id === route.customerId && (
        <VehicleFormDialog
          action="edit"
          vehicle={editingVehicle}
          customerVersion={detailHook.customer.version}
          pending={detailHook.pending}
          serverFieldErrors={detailHook.vehicleFieldErrors}
          onClose={() =>
            onNavigate(
              customerUrl(route, {
                customerId: route.customerId,
                vehicleAction: null,
                vehicleId: null,
              }),
              true
            )
          }
          onSubmit={(input) => detailHook.submitUpdateVehicle(editingVehicle.id, input)}
        />
      )}
    </section>
  );
}
