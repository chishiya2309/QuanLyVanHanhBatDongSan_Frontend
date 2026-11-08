import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { NavigationGuardRegistration } from '../../hooks/useServiceCatalog';
import { useServicePolicy } from '../../hooks/useServicePolicy';
import {
  catalogFilters,
  chargeMethods,
  type CatalogFilter,
  type CatalogService,
  type ChargeMethod,
} from '../../types/serviceCatalog';
import type { ServicePolicyRoute } from '../../types/servicePolicy';
import {
  catalogSearchText,
  catalogState,
  formatCatalogMoney,
} from '../../utils/serviceCatalogValidation';
import { catalogUrl } from '../../utils/serviceCatalogNavigation';
import { servicePolicyUrl } from '../../utils/servicePolicyNavigation';
import { calculatePolicyDiff } from '../../utils/servicePolicyValidation';
import { listCatalogServices } from '../../services/serviceCatalogApi';
import './servicePolicy.css';

interface ServicePolicyPageProps {
  route: ServicePolicyRoute;
  onNavigate: (url: string, replace?: boolean) => void;
  onSessionExpired: () => void;
  onForbidden: () => void;
  registerGuard: NavigationGuardRegistration;
}

export function ServicePolicyPage({
  route,
  onNavigate,
  onSessionExpired,
  onForbidden,
  registerGuard,
}: ServicePolicyPageProps) {
  const {
    loading,
    snapshot,
    latestSnapshot,
    draft,
    error,
    notice,
    fieldErrors,
    saving,
    buildingsLoading,
    buildingsList,
    buildingsError,
    setMethod,
    setDefaultPrice,
    setProrate,
    setExistingBuildingFlag,
    addNewBuilding,
    removeNewBuilding,
    setNewBuildingFlag,
    applyLatestSnapshot,
    retryLoadBuildings,
    refreshPolicy,
    submit,
    dismissNotice,
    dismissError,
  } = useServicePolicy({
    route,
    onNavigate,
    onSessionExpired,
    onForbidden,
    registerGuard,
  });

  // Services list for service selector
  const [servicesList, setServicesList] = useState<CatalogService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [showPicker, setShowPicker] = useState(!route.serviceId);

  // Search filter for available buildings to add
  const [buildingSearch, setBuildingSearch] = useState('');

  useLayoutEffect(() => {
    document.getElementById('policy-title')?.focus();
  }, [route.serviceId]);

  useEffect(() => {
    if (!route.serviceId || showPicker) {
      let active = true;
      void (async () => {
        await Promise.resolve();
        if (!active) return;
        setServicesLoading(true);
        try {
          const items = await listCatalogServices();
          if (active) {
            setServicesList(items);
            setServicesLoading(false);
          }
        } catch {
          if (active) setServicesLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }
  }, [route.serviceId, showPicker]);

  const backToCatalogUrl = useMemo(
    () => catalogUrl({ q: route.q, state: route.state as CatalogFilter }),
    [route.q, route.state],
  );

  const diff = useMemo(() => {
    if (!snapshot || !draft) return { hasChanges: false, summary: [] };
    return calculatePolicyDiff(snapshot, draft);
  }, [snapshot, draft]);

  // Filtered available buildings
  const configuredBuildingIds = useMemo(() => {
    if (!snapshot) return new Set<string>();
    return new Set(snapshot.buildingConfigurations.map((c) => c.buildingId));
  }, [snapshot]);

  const filteredBuildings = useMemo(() => {
    const q = catalogSearchText(buildingSearch);
    return buildingsList.filter((b) => {
      if (!q) return true;
      const text = catalogSearchText(`${b.name} ${b.areaName} ${b.address}`);
      return text.includes(q);
    });
  }, [buildingsList, buildingSearch]);

  const filteredServices = useMemo(() => {
    const q = catalogSearchText(serviceSearch);
    return servicesList.filter((s) => {
      if (!q) return true;
      return catalogSearchText(`${s.name} ${s.unit}`).includes(q);
    });
  }, [servicesList, serviceSearch]);

  const handleSelectService = (targetId: string) => {
    setShowPicker(false);
    onNavigate(servicePolicyUrl({ serviceId: targetId, q: route.q, state: route.state }));
  };

  return (
    <section className="policy-page" aria-labelledby="policy-title">
      <header className="policy-header">
        <a
          href={backToCatalogUrl}
          className="policy-back-link"
          onClick={(e) => {
            e.preventDefault();
            onNavigate(backToCatalogUrl);
          }}
        >
          ← Quay về Danh mục dịch vụ
        </a>

        <div className="policy-title-row">
          <div>
            <h1 id="policy-title" tabIndex={-1}>
              Thiết lập chính sách dịch vụ
            </h1>
            {snapshot && (
              <div className="policy-service-badge-bar">
                <strong>{snapshot.service.name}</strong>
                <span>• {snapshot.service.unit}</span>
                {snapshot.service.systemCode && (
                  <span className="catalog-system-label">Hệ thống ({snapshot.service.systemCode})</span>
                )}
                <span className={`catalog-badge catalog-badge--${catalogState(snapshot.service)}`}>
                  {catalogFilters[catalogState(snapshot.service)]}
                </span>
                <span className="policy-field-help">Phiên bản: {snapshot.service.version}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="policy-button"
            onClick={() => setShowPicker((open) => !open)}
            aria-expanded={showPicker}
          >
            {showPicker ? 'Đóng chọn dịch vụ' : 'Đổi dịch vụ khác'}
          </button>
        </div>
      </header>

      {/* Notice & Error Banners */}
      {notice && (
        <div className="policy-banner" role="status">
          <p>{notice.message}</p>
          <button type="button" className="policy-button" onClick={dismissNotice}>
            Đóng
          </button>
        </div>
      )}

      {error && (
        <div className="policy-error" role="alert">
          <p>{error}</p>
          {error.includes('Chưa xác định') && (
            <p>Dữ liệu có thể đã được lưu. Vui lòng kiểm tra lại trước khi thực hiện thao tác mới.</p>
          )}
          <div className="policy-banner-actions">
            <button type="button" className="policy-button" onClick={refreshPolicy}>
              Tải lại chính sách
            </button>
            <button type="button" className="policy-button" onClick={dismissError}>
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* 409 Conflict Resolution Banner */}
      {latestSnapshot && (
        <div className="policy-error" role="alert">
          <p>
            <strong>Phát hiện thay đổi mới trên hệ thống:</strong> Dữ liệu chính sách vừa được cập nhật bởi một thao tác khác.
          </p>
          <p>Bản nháp hiện tại của bạn vẫn được giữ nguyên để đối chiếu. Hãy kiểm tra và chọn áp dụng dữ liệu mới khi sẵn sàng.</p>
          <div className="policy-banner-actions">
            <button
              type="button"
              className="policy-button policy-button--primary"
              onClick={applyLatestSnapshot}
            >
              Bắt đầu chỉnh sửa theo dữ liệu mới
            </button>
          </div>
        </div>
      )}

      {/* Service Picker Dropdown / Search Section */}
      {showPicker && (
        <section className="policy-section" aria-label="Chọn dịch vụ cần thiết lập chính sách">
          <div className="policy-section-header">
            <h2>Chọn dịch vụ cần thiết lập chính sách</h2>
            <p className="policy-section-desc">Chọn dịch vụ từ danh mục để bắt đầu xem và cấu hình chính sách.</p>
          </div>

          <div className="policy-search-box">
            <input
              type="search"
              placeholder="Tìm theo tên dịch vụ hoặc đơn vị..."
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              aria-label="Tìm kiếm dịch vụ để thiết lập chính sách"
            />
          </div>

          {servicesLoading && <p role="status">Đang tải danh sách dịch vụ…</p>}

          <div className="policy-service-picker">
            {filteredServices.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`policy-button ${item.id === route.serviceId ? 'policy-button--primary' : ''}`}
                onClick={() => handleSelectService(item.id)}
                style={{ justifyContent: 'space-between', width: '100%' }}
              >
                <span>
                  <strong>{item.name}</strong> ({item.unit}) — {chargeMethods[item.method]}
                </span>
                <span style={{ fontSize: 'var(--text-xs)' }}>
                  {item.defaultPrice === null ? 'Chưa có giá' : formatCatalogMoney(item.defaultPrice)}
                </span>
              </button>
            ))}
            {!servicesLoading && filteredServices.length === 0 && (
              <p className="policy-field-help">Không tìm thấy dịch vụ phù hợp.</p>
            )}
          </div>
        </section>
      )}

      {/* Main Content when serviceId is specified */}
      {!route.serviceId && !showPicker && (
        <section className="policy-section">
          <h2>Chưa chọn dịch vụ</h2>
          <p className="policy-section-desc">Vui lòng chọn một dịch vụ từ danh mục để bắt đầu thiết lập chính sách.</p>
          <button
            type="button"
            className="policy-button policy-button--primary"
            onClick={() => setShowPicker(true)}
          >
            Mở danh sách dịch vụ
          </button>
        </section>
      )}

      {loading && (
        <div className="policy-section" role="status">
          <p>Đang tải thông tin chính sách dịch vụ…</p>
        </div>
      )}

      {snapshot && draft && (
        <>
          {/* Section 1: Phương pháp tính & Đơn giá */}
          <section className="policy-section" aria-labelledby="policy-calc-title">
            <div className="policy-section-header">
              <h2 id="policy-calc-title">1. Phương pháp tính &amp; Đơn giá danh mục</h2>
              <p className="policy-section-desc">
                Thiết lập phương pháp xác định mức phí và đơn giá mặc định toàn hệ thống cho dịch vụ này.
              </p>
            </div>

            <div className="policy-grid-2">
              {/* Charge Method */}
              <fieldset className="policy-field">
                <legend id="policy-method-label">
                  Phương pháp tính {snapshot.methodChangeAllowed ? '' : '(Đã khóa)'}
                </legend>
                {!snapshot.methodChangeAllowed && (
                  <div className="policy-warn-box" role="note">
                    Dịch vụ đã phát sinh sử dụng hoặc hóa đơn nên không được đổi phương pháp. Nếu cần đổi bản chất
                    cách tính, vui lòng tạo dịch vụ mới tại Danh mục dịch vụ.
                  </div>
                )}
                <div
                  className="policy-radio-group"
                  role="radiogroup"
                  aria-labelledby="policy-method-label"
                >
                  {(Object.keys(chargeMethods) as ChargeMethod[]).map((methodKey) => (
                    <label key={methodKey} className="policy-radio-option">
                      <input
                        type="radio"
                        name="chargeMethod"
                        value={methodKey}
                        checked={draft.method === methodKey}
                        disabled={!snapshot.methodChangeAllowed || saving}
                        onChange={() => setMethod(methodKey)}
                      />
                      <span>
                        <strong>{chargeMethods[methodKey]}</strong> ({methodKey})
                      </span>
                    </label>
                  ))}
                </div>
                {fieldErrors.method && (
                  <p className="policy-field-error" role="alert">
                    {fieldErrors.method}
                  </p>
                )}
              </fieldset>

              {/* Default Price */}
              <div className="policy-field">
                <label htmlFor="policy-defaultPrice">Đơn giá danh mục (VND)</label>
                <input
                  id="policy-defaultPrice"
                  name="defaultPrice"
                  type="text"
                  inputMode="numeric"
                  value={draft.defaultPrice}
                  disabled={saving}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d]/g, '');
                    setDefaultPrice(val);
                  }}
                  aria-invalid={Boolean(fieldErrors.defaultPrice)}
                  aria-describedby="policy-price-help policy-price-diff"
                  placeholder="Nhập đơn giá (VND)"
                />
                <p id="policy-price-help" className="policy-field-help">
                  Giá 0 VND là dịch vụ miễn phí. Chỉ hỗ trợ số nguyên không âm (tối đa 19 chữ số).
                </p>
                <div id="policy-price-diff" className="policy-field-help">
                  <span>Giá hiện tại: </span>
                  <strong>
                    {snapshot.service.defaultPrice === null
                      ? 'Chưa thiết lập'
                      : formatCatalogMoney(snapshot.service.defaultPrice)}
                  </strong>
                  {draft.defaultPrice.trim() !== '' &&
                    draft.defaultPrice.trim() !== (snapshot.service.defaultPrice ?? '') && (
                      <span>
                        {' '}
                        → Dự kiến:{' '}
                        <strong style={{ color: 'var(--color-accent-primary)' }}>
                          {formatCatalogMoney(draft.defaultPrice.trim())}
                        </strong>
                      </span>
                    )}
                </div>
                {fieldErrors.defaultPrice && (
                  <p className="policy-field-error" role="alert">
                    {fieldErrors.defaultPrice}
                  </p>
                )}
                <div className="policy-warn-box" style={{ marginTop: 'var(--space-sm)' }}>
                  Giá và điều kiện của kỳ được xác định tại đầu chu kỳ hợp đồng gốc. Thay đổi giữa kỳ được áp
                  dụng từ chu kỳ tiếp theo. Giá riêng tại tòa nhà hoặc phòng không bị ghi đè.
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Chính sách ngày lẻ (FIXED only) */}
          {draft.method === 'FIXED' ? (
            <section className="policy-section" aria-labelledby="policy-prorate-title">
              <div className="policy-section-header">
                <h2 id="policy-prorate-title">2. Chính sách ngày lẻ (Dịch vụ Cố định)</h2>
                <p className="policy-section-desc">
                  Xác định có tính toán tỉ lệ theo số ngày sử dụng thực tế khi khách thuê nhận/trả phòng giữa chu kỳ hay không.
                </p>
              </div>

              <fieldset className="policy-field">
                <legend id="policy-prorate-legend">Áp dụng tính tiền ngày lẻ</legend>
                <div
                  className="policy-radio-group"
                  role="radiogroup"
                  aria-labelledby="policy-prorate-legend"
                >
                  <label className="policy-radio-option">
                    <input
                      type="radio"
                      name="proratePolicy"
                      value="true"
                      checked={draft.prorate === true}
                      disabled={saving}
                      onChange={() => setProrate(true)}
                    />
                    <span>
                      <strong>Có tính ngày lẻ (true)</strong> — Phí được chia theo số ngày thực tế trong chu kỳ.
                    </span>
                  </label>
                  <label className="policy-radio-option">
                    <input
                      type="radio"
                      name="proratePolicy"
                      value="false"
                      checked={draft.prorate === false}
                      disabled={saving}
                      onChange={() => setProrate(false)}
                    />
                    <span>
                      <strong>Không tính ngày lẻ (false)</strong> — Thu trọn gói cả kỳ hợp đồng dù vào/ra giữa kỳ.
                    </span>
                  </label>
                </div>
                {fieldErrors.prorate && (
                  <p className="policy-field-error" role="alert">
                    {fieldErrors.prorate}
                  </p>
                )}
                <p className="policy-field-help">
                  Trạng thái đã lưu trên hệ thống:{' '}
                  <strong>
                    {snapshot.prorate === null ? 'Chưa thiết lập' : snapshot.prorate ? 'Có tính ngày lẻ' : 'Không tính ngày lẻ'}
                  </strong>
                </p>
              </fieldset>
            </section>
          ) : draft.prorate !== null ? (
            <div className="policy-warn-box" role="note">
              Phương pháp đang chọn là <strong>{chargeMethods[draft.method]}</strong> (không phải Cố định). Chính
              sách ngày lẻ không áp dụng cho phương pháp này và sẽ không được gửi khi lưu; bản nháp cờ ngày lẻ vẫn
              được giữ lại nếu bạn chuyển lại Cố định.
            </div>
          ) : null}

          {/* Section 3: Tòa nhà đã cấu hình */}
          <section className="policy-section" aria-labelledby="policy-buildings-title">
            <div className="policy-section-header">
              <h2 id="policy-buildings-title">3. Các tòa nhà đã cấu hình áp dụng</h2>
              <p className="policy-section-desc">
                Danh sách tòa nhà hiện đã liên kết với dịch vụ này. Bạn có thể bật/tắt lựa chọn tự động áp dụng
                cho các phòng mới được tạo sau này.
              </p>
            </div>

            <div className="policy-warn-box">
              Lựa chọn này chỉ áp dụng cho phòng được tạo sau khi lưu. Các phòng hiện hữu không thay đổi. Dịch vụ
              chỉ được tự áp dụng khi dịch vụ và cấu hình đủ điều kiện.
            </div>

            {snapshot.buildingConfigurations.length > 0 ? (
              <div className="policy-table-wrapper">
                <table className="policy-table">
                  <caption className="visually-hidden">Danh sách tòa nhà đã cấu hình dịch vụ</caption>
                  <thead>
                    <tr>
                      <th scope="col">Tòa nhà</th>
                      <th scope="col">Đơn giá tại cấu hình</th>
                      <th scope="col">Ngày lẻ cấu hình</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Tự áp dụng cho phòng mới</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.buildingConfigurations.map((config) => {
                      const currentFlag = draft.existingBuildingFlags[config.buildingId] ?? config.defaultForNewRoom;
                      return (
                        <tr key={config.configurationId}>
                          <th scope="row">
                            <strong>{config.buildingName}</strong>
                          </th>
                          <td data-label="Đơn giá tại cấu hình" className="policy-money">
                            {config.unitPrice === null ? (
                              <span className="policy-field-help">Kế thừa danh mục</span>
                            ) : config.unitPrice === '0' ? (
                              <span>0 ₫ (riêng)</span>
                            ) : (
                              formatCatalogMoney(config.unitPrice)
                            )}
                          </td>
                          <td data-label="Ngày lẻ cấu hình">
                            {config.prorate === null ? (
                              <span className="policy-field-help">Kế thừa</span>
                            ) : config.prorate ? (
                              'Có'
                            ) : (
                              'Không'
                            )}
                          </td>
                          <td data-label="Trạng thái">
                            <span
                              className={`catalog-badge catalog-badge--${config.enabled ? 'active' : 'inactive'}`}
                            >
                              {config.enabled ? 'Đang áp dụng' : 'Tắt tại tòa nhà'}
                            </span>
                          </td>
                          <td data-label="Tự áp dụng cho phòng mới">
                            <div className="policy-flag-control">
                              <label className="policy-radio-option" style={{ minHeight: '36px', padding: '4px 8px' }}>
                                <input
                                  type="radio"
                                  name={`existingFlag_${config.buildingId}`}
                                  value="true"
                                  checked={currentFlag === true}
                                  disabled={saving}
                                  onChange={() => setExistingBuildingFlag(config.buildingId, true)}
                                />
                                <span>Có</span>
                              </label>
                              <label className="policy-radio-option" style={{ minHeight: '36px', padding: '4px 8px' }}>
                                <input
                                  type="radio"
                                  name={`existingFlag_${config.buildingId}`}
                                  value="false"
                                  checked={currentFlag === false}
                                  disabled={saving}
                                  onChange={() => setExistingBuildingFlag(config.buildingId, false)}
                                />
                                <span>Không</span>
                              </label>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="policy-field-help" style={{ padding: 'var(--space-md) 0' }}>
                Chưa có tòa nhà áp dụng. Hãy chọn thêm tòa nhà ở danh sách bên dưới để bắt đầu liên kết.
              </p>
            )}
          </section>

          {/* Section 4: Thêm tòa nhà áp dụng */}
          <section className="policy-section" aria-labelledby="policy-add-building-title">
            <div className="policy-section-header">
              <h2 id="policy-add-building-title">4. Thêm tòa nhà áp dụng mới</h2>
              <p className="policy-section-desc">
                Chọn thêm các tòa nhà thuộc quyền quản lý của bạn để áp dụng dịch vụ này. Mỗi tòa nhà mới chọn cần
                chỉ định rõ cờ tự áp dụng cho phòng mới.
              </p>
            </div>

            {!snapshot.service.active && (
              <div className="policy-warn-box" role="alert">
                Dịch vụ đang ở trạng thái <strong>Đã tắt</strong>. Cần bật dịch vụ qua Danh mục dịch vụ trước khi
                tạo cấu hình áp dụng mới. (Các thay đổi trên cấu hình hiện hữu vẫn được phép lưu).
              </div>
            )}

            {fieldErrors.buildings && (
              <p className="policy-field-error" role="alert">
                {fieldErrors.buildings}
              </p>
            )}

            {/* List of newly selected buildings awaiting save */}
            {draft.newBuildings.size > 0 && (
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <h3>Các tòa nhà mới chọn ({draft.newBuildings.size})</h3>
                {Array.from(draft.newBuildings.entries()).map(([bId, item]) => (
                  <div key={bId} className="policy-new-building-row">
                    <div>
                      <strong>{item.building.name}</strong>
                      {item.building.areaName && <span> — {item.building.areaName}</span>}
                      {item.building.address && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                          {item.building.address}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                      <fieldset
                        style={{ border: 0, margin: 0, padding: 0 }}
                        aria-invalid={Boolean(fieldErrors[`newBuilding_${bId}`])}
                      >
                        <legend style={{ fontSize: 'var(--text-xs)', fontWeight: 500, marginBottom: '4px' }}>
                          Mặc định cho phòng mới? <span style={{ color: 'var(--color-error)' }}>*</span>
                        </legend>
                        <div className="policy-flag-control">
                          <label className="policy-radio-option" style={{ minHeight: '36px', padding: '4px 8px' }}>
                            <input
                              type="radio"
                              name={`newFlag_${bId}`}
                              value="true"
                              checked={item.defaultForNewRoom === true}
                              disabled={saving}
                              onChange={() => setNewBuildingFlag(bId, true)}
                            />
                            <span>Có</span>
                          </label>
                          <label className="policy-radio-option" style={{ minHeight: '36px', padding: '4px 8px' }}>
                            <input
                              type="radio"
                              name={`newFlag_${bId}`}
                              value="false"
                              checked={item.defaultForNewRoom === false}
                              disabled={saving}
                              onChange={() => setNewBuildingFlag(bId, false)}
                            />
                            <span>Không</span>
                          </label>
                        </div>
                        {fieldErrors[`newBuilding_${bId}`] && (
                          <p className="policy-field-error" role="alert" style={{ margin: '2px 0 0' }}>
                            {fieldErrors[`newBuilding_${bId}`]}
                          </p>
                        )}
                      </fieldset>

                      <button
                        type="button"
                        className="policy-button"
                        style={{ minHeight: '36px', padding: '4px 8px' }}
                        onClick={() => removeNewBuilding(bId)}
                        disabled={saving}
                        aria-label={`Bỏ chọn tòa nhà ${item.building.name}`}
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Building search & lookup selection */}
            <div className="policy-search-box">
              <input
                type="search"
                placeholder="Tìm kiếm tòa nhà theo tên, khu vực, địa chỉ..."
                value={buildingSearch}
                onChange={(e) => setBuildingSearch(e.target.value)}
                disabled={saving || !snapshot.service.active}
                aria-label="Tìm kiếm tòa nhà để thêm vào chính sách"
              />
            </div>

            {buildingsLoading && <p role="status">Đang tải danh sách tòa nhà…</p>}
            {buildingsError && (
              <div className="policy-error" role="alert">
                <p>{buildingsError}</p>
                <button type="button" className="policy-button" onClick={retryLoadBuildings}>
                  Thử lại
                </button>
              </div>
            )}

            {!buildingsLoading && !buildingsError && (
              <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-input)', padding: 'var(--space-xs)' }}>
                {filteredBuildings.map((building) => {
                  const alreadyConfigured = configuredBuildingIds.has(building.id);
                  const isSelected = draft.newBuildings.has(building.id);

                  return (
                    <label
                      key={building.id}
                      className="policy-radio-option"
                      style={{
                        marginBottom: '4px',
                        justifyContent: 'space-between',
                        cursor: alreadyConfigured || !snapshot.service.active ? 'not-allowed' : 'pointer',
                        opacity: alreadyConfigured ? 0.7 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                        <input
                          type="checkbox"
                          checked={alreadyConfigured || isSelected}
                          disabled={alreadyConfigured || !snapshot.service.active || saving}
                          onChange={(e) => {
                            if (e.target.checked) {
                              addNewBuilding(building);
                            } else {
                              removeNewBuilding(building.id);
                            }
                          }}
                        />
                        <div>
                          <strong>{building.name}</strong>
                          {building.areaName && <span style={{ color: 'var(--color-muted)' }}> ({building.areaName})</span>}
                          {building.address && (
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                              {building.address}
                            </div>
                          )}
                        </div>
                      </div>

                      {alreadyConfigured ? (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>Đã cấu hình</span>
                      ) : (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent-primary)' }}>
                          {isSelected ? 'Đã chọn' : '+ Chọn áp dụng'}
                        </span>
                      )}
                    </label>
                  );
                })}
                {filteredBuildings.length === 0 && (
                  <p className="policy-field-help" style={{ padding: 'var(--space-sm)' }}>
                    Không tìm thấy tòa nhà nào phù hợp.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Section 5: Tóm tắt & Nút lưu */}
          <section className="policy-summary-box" aria-label="Tóm tắt thay đổi và xác nhận lưu">
            <h2>Xác nhận thiết lập chính sách</h2>
            {diff.hasChanges ? (
              <>
                <p>Các nội dung sẽ được cập nhật đồng thời trong một lần xác nhận:</p>
                <ul className="policy-summary-list">
                  {diff.summary.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="policy-field-help">Chưa có thay đổi nào so với chính sách hiện tại.</p>
            )}

            <div className="policy-actions">
              <button
                type="button"
                className="policy-button policy-button--primary"
                onClick={submit}
                disabled={saving || !diff.hasChanges}
              >
                {saving ? 'Đang lưu chính sách…' : 'Lưu chính sách'}
              </button>

              <button
                type="button"
                className="policy-button"
                onClick={() => onNavigate(backToCatalogUrl)}
                disabled={saving}
              >
                Hủy bỏ
              </button>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
