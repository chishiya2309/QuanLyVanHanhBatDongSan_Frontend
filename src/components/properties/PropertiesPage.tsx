import React, { useState, useEffect, useCallback } from 'react';
import type {
  Area,
  Building,
  CreateAreaInput,
  UpdateAreaInput,
  CreateBuildingInput,
  UpdateBuildingInput,
  ChangeBuildingAreaInput,
  PropertiesRoute,
} from '../../types/properties';
import {
  getAreas,
  createArea,
  updateArea,
  deactivateArea,
  activateArea,
  getActiveAreas,
  getBuildings,
  createBuilding,
  updateBuilding,
  changeBuildingArea,
  deactivateBuilding,
  activateBuilding,
  PropertyApiError,
} from '../../services/propertiesApi';
import {
  AreaModal,
  AreaDeactivateModal,
  BuildingModal,
  ChangeBuildingAreaModal,
  BuildingDeactivateModal,
} from './PropertiesModals';
import './properties.css';

interface PropertiesPageProps {
  route: PropertiesRoute;
  onNavigate: (url: string) => void;
  onNavigateRooms: (buildingId: string) => void;
  onSessionExpired: () => void;
}

export const PropertiesPage: React.FC<PropertiesPageProps> = ({
  route,
  onNavigate,
  onNavigateRooms,
  onSessionExpired,
}) => {
  const currentTab = route.tab;

  // Data states
  const [areas, setAreas] = useState<Area[]>([]);
  const [activeAreas, setActiveAreas] = useState<Area[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  // Search & Filter
  const [areaKeyword, setAreaKeyword] = useState('');
  const [areaStatusFilter, setAreaStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [buildingKeyword, setBuildingKeyword] = useState('');
  const [buildingAreaFilter, setBuildingAreaFilter] = useState<string>('ALL');
  const [buildingStatusFilter, setBuildingStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal states
  const [areaModalOpen, setAreaModalOpen] = useState(Boolean(route.create && currentTab === 'areas'));
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [deactivateAreaTarget, setDeactivateAreaTarget] = useState<Area | null>(null);

  const [buildingModalOpen, setBuildingModalOpen] = useState(Boolean(route.create && currentTab === 'buildings'));
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [changeAreaTarget, setChangeAreaTarget] = useState<Building | null>(null);
  const [deactivateBuildingTarget, setDeactivateBuildingTarget] = useState<Building | null>(null);

  const [modalPending, setModalPending] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalFieldErrors, setModalFieldErrors] = useState<Record<string, string>>({});

  // Fetch initial data
  const loadData = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    try {
      const [areasRes, buildingsRes, activeAreasRes] = await Promise.all([
        getAreas(),
        getBuildings(),
        getActiveAreas(),
      ]);
      setAreas(areasRes);
      setBuildings(buildingsRes);
      setActiveAreas(activeAreasRes);
    } catch (err) {
      if (err instanceof PropertyApiError && err.status === 401) {
        onSessionExpired();
        return;
      }
      setBanner({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Không thể tải dữ liệu cơ sở và bất động sản',
      });
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Tab change
  const handleTabChange = (tab: 'areas' | 'buildings') => {
    onNavigate(`/properties?tab=${tab}`);
  };

  // ==========================================
  // Area Handlers (UC10)
  // ==========================================
  const handleOpenAddArea = () => {
    setSelectedArea(null);
    setModalError(null);
    setModalFieldErrors({});
    setAreaModalOpen(true);
  };

  const handleOpenEditArea = (area: Area) => {
    setSelectedArea(area);
    setModalError(null);
    setModalFieldErrors({});
    setAreaModalOpen(true);
  };

  const handleSubmitArea = async (input: CreateAreaInput | UpdateAreaInput) => {
    setModalPending(true);
    setModalError(null);
    setModalFieldErrors({});
    try {
      if (selectedArea) {
        await updateArea(selectedArea.id, input);
        setBanner({ kind: 'success', message: 'Cập nhật khu vực thành công' });
      } else {
        await createArea(input);
        setBanner({ kind: 'success', message: 'Thêm khu vực thành công' });
      }
      setAreaModalOpen(false);
      await loadData();
    } catch (err) {
      if (err instanceof PropertyApiError) {
        if (err.status === 401) {
          onSessionExpired();
          return;
        }
        setModalError(err.message);
        setModalFieldErrors(err.fieldErrors);
      } else {
        setModalError('Lỗi khi lưu khu vực. Vui lòng thử lại sau');
      }
    } finally {
      setModalPending(false);
    }
  };

  const handleConfirmDeactivateArea = async () => {
    if (!deactivateAreaTarget) return;
    setModalPending(true);
    setModalError(null);
    try {
      await deactivateArea(deactivateAreaTarget.id);
      setBanner({ kind: 'success', message: 'Ngừng hoạt động khu vực thành công' });
      setDeactivateAreaTarget(null);
      await loadData();
    } catch (err) {
      if (err instanceof PropertyApiError && err.status === 401) {
        onSessionExpired();
        return;
      }
      setModalError(err instanceof Error ? err.message : 'Lỗi khi ngừng hoạt động khu vực');
    } finally {
      setModalPending(false);
    }
  };

  const handleActivateArea = async (area: Area) => {
    try {
      await activateArea(area.id);
      setBanner({ kind: 'success', message: 'Kích hoạt khu vực thành công' });
      await loadData();
    } catch (err) {
      if (err instanceof PropertyApiError && err.status === 401) {
        onSessionExpired();
        return;
      }
      setBanner({ kind: 'error', message: err instanceof Error ? err.message : 'Lỗi khi kích hoạt khu vực' });
    }
  };

  // ==========================================
  // Building Handlers (UC11, UC12)
  // ==========================================
  const handleOpenAddBuilding = () => {
    setSelectedBuilding(null);
    setModalError(null);
    setModalFieldErrors({});
    setBuildingModalOpen(true);
  };

  const handleOpenEditBuilding = (b: Building) => {
    setSelectedBuilding(b);
    setModalError(null);
    setModalFieldErrors({});
    setBuildingModalOpen(true);
  };

  const handleSubmitBuilding = async (input: CreateBuildingInput | UpdateBuildingInput) => {
    setModalPending(true);
    setModalError(null);
    setModalFieldErrors({});
    try {
      if (selectedBuilding) {
        await updateBuilding(selectedBuilding.id, input as UpdateBuildingInput);
        setBanner({ kind: 'success', message: 'Cập nhật thông tin tòa nhà thành công' });
      } else {
        await createBuilding(input as CreateBuildingInput);
        setBanner({ kind: 'success', message: 'Tạo tòa nhà thành công' });
      }
      setBuildingModalOpen(false);
      await loadData();
    } catch (err) {
      if (err instanceof PropertyApiError) {
        if (err.status === 401) {
          onSessionExpired();
          return;
        }
        setModalError(err.message);
        setModalFieldErrors(err.fieldErrors);
      } else {
        setModalError('Lỗi khi lưu tòa nhà. Vui lòng thử lại sau');
      }
    } finally {
      setModalPending(false);
    }
  };

  const handleSubmitChangeArea = async (input: ChangeBuildingAreaInput) => {
    if (!changeAreaTarget) return;
    setModalPending(true);
    setModalError(null);
    try {
      await changeBuildingArea(changeAreaTarget.id, input);
      setBanner({ kind: 'success', message: 'Chuyển khu vực trực thuộc thành công' });
      setChangeAreaTarget(null);
      await loadData();
    } catch (err) {
      if (err instanceof PropertyApiError && err.status === 401) {
        onSessionExpired();
        return;
      }
      setModalError(err instanceof Error ? err.message : 'Lỗi khi chuyển khu vực');
    } finally {
      setModalPending(false);
    }
  };

  const handleConfirmDeactivateBuilding = async () => {
    if (!deactivateBuildingTarget) return;
    setModalPending(true);
    setModalError(null);
    try {
      await deactivateBuilding(deactivateBuildingTarget.id);
      setBanner({ kind: 'success', message: 'Ngừng hoạt động tòa nhà thành công' });
      setDeactivateBuildingTarget(null);
      await loadData();
    } catch (err) {
      if (err instanceof PropertyApiError && err.status === 401) {
        onSessionExpired();
        return;
      }
      setModalError(err instanceof Error ? err.message : 'Lỗi khi ngừng hoạt động tòa nhà');
    } finally {
      setModalPending(false);
    }
  };

  const handleActivateBuilding = async (b: Building) => {
    try {
      await activateBuilding(b.id);
      setBanner({ kind: 'success', message: 'Kích hoạt lại tòa nhà thành công' });
      await loadData();
    } catch (err) {
      if (err instanceof PropertyApiError && err.status === 401) {
        onSessionExpired();
        return;
      }
      setBanner({ kind: 'error', message: err instanceof Error ? err.message : 'Lỗi khi kích hoạt tòa nhà' });
    }
  };

  // Filtered lists
  const filteredAreas = areas.filter((a) => {
    const matchesKw = a.name.toLowerCase().includes(areaKeyword.toLowerCase()) ||
      (a.description && a.description.toLowerCase().includes(areaKeyword.toLowerCase()));
    const matchesStatus = areaStatusFilter === 'ALL' ? true : areaStatusFilter === 'ACTIVE' ? a.active : !a.active;
    return matchesKw && matchesStatus;
  });

  const filteredBuildings = buildings.filter((b) => {
    const matchesKw = b.name.toLowerCase().includes(buildingKeyword.toLowerCase()) ||
      b.address.toLowerCase().includes(buildingKeyword.toLowerCase());
    const matchesArea = buildingAreaFilter === 'ALL' ? true : b.areaId === buildingAreaFilter;
    const matchesStatus = buildingStatusFilter === 'ALL' ? true : buildingStatusFilter === 'ACTIVE' ? b.active : !b.active;
    return matchesKw && matchesArea && matchesStatus;
  });

  return (
    <section className="properties-page" aria-labelledby="properties-title">
      <header className="prop-page-heading">
        <div>
          <h1 id="properties-title">Cơ sở &amp; Bất động sản</h1>
          <p>Quản lý danh mục khu vực quản lý và mạng lưới các tòa nhà trực thuộc</p>
        </div>
        <div>
          {currentTab === 'areas' ? (
            <button type="button" className="prop-btn prop-btn--primary" onClick={handleOpenAddArea}>
              + Thêm khu vực mới
            </button>
          ) : (
            <button type="button" className="prop-btn prop-btn--primary" onClick={handleOpenAddBuilding}>
              + Tạo tòa nhà mới
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <nav className="prop-tabs" aria-label="Phân hệ cơ sở">
        <button
          type="button"
          className={`prop-tab-btn ${currentTab === 'areas' ? 'is-active' : ''}`}
          onClick={() => handleTabChange('areas')}
        >
          Khu vực quản lý ({areas.length})
        </button>
        <button
          type="button"
          className={`prop-tab-btn ${currentTab === 'buildings' ? 'is-active' : ''}`}
          onClick={() => handleTabChange('buildings')}
        >
          Danh sách tòa nhà ({buildings.length})
        </button>
      </nav>

      {/* Notice Banner */}
      {banner && (
        <div className={`prop-banner prop-banner--${banner.kind}`} role="status">
          <p>{banner.message}</p>
          <button type="button" className="prop-btn prop-btn--sm" onClick={() => setBanner(null)}>
            Đóng
          </button>
        </div>
      )}

      {/* TAB 1: KHU VỰC (UC10) */}
      {currentTab === 'areas' && (
        <>
          <div className="prop-toolbar">
            <div className="prop-toolbar-group">
              <input
                className="prop-input"
                style={{ minWidth: '240px' }}
                placeholder="Tìm kiếm theo tên hoặc mô tả khu vực..."
                value={areaKeyword}
                onChange={(e) => setAreaKeyword(e.target.value)}
              />
              <select
                className="prop-select"
                value={areaStatusFilter}
                onChange={(e) => setAreaStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Ngừng hoạt động</option>
              </select>
            </div>
            <button type="button" className="prop-btn prop-btn--outline" onClick={loadData} disabled={loading}>
              Tải lại
            </button>
          </div>

          {loading ? (
            <p>Đang tải danh sách khu vực...</p>
          ) : filteredAreas.length === 0 ? (
            <div className="prop-empty">
              <h3>{areaKeyword ? 'Không tìm thấy khu vực phù hợp' : 'Chưa có khu vực nào'}</h3>
              <p>{areaKeyword ? 'Hãy thử đổi từ khóa tìm kiếm.' : 'Thêm khu vực đầu tiên để bắt đầu quản lý tòa nhà.'}</p>
              {!areaKeyword && (
                <button type="button" className="prop-btn prop-btn--primary" onClick={handleOpenAddArea}>
                  + Thêm khu vực mới
                </button>
              )}
            </div>
          ) : (
            <div className="prop-table-wrap">
              <table className="prop-table">
                <thead>
                  <tr>
                    <th>Tên khu vực</th>
                    <th>Mô tả</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAreas.map((area) => (
                    <tr key={area.id}>
                      <td>
                        <strong>{area.name}</strong>
                      </td>
                      <td style={{ color: 'var(--color-muted)' }}>{area.description || 'Chưa có mô tả'}</td>
                      <td>
                        <span className={`prop-badge ${area.active ? 'prop-badge--active' : 'prop-badge--inactive'}`}>
                          {area.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="prop-link-action"
                            onClick={() => handleOpenEditArea(area)}
                          >
                            Sửa
                          </button>
                          {area.active ? (
                            <button
                              type="button"
                              className="prop-link-action prop-link-action--danger"
                              onClick={() => {
                                setModalError(null);
                                setDeactivateAreaTarget(area);
                              }}
                            >
                              Ngừng HĐ
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="prop-link-action prop-link-action--success"
                              onClick={() => handleActivateArea(area)}
                            >
                              Kích hoạt lại
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* TAB 2: TÒA NHÀ (UC11, UC12) */}
      {currentTab === 'buildings' && (
        <>
          <div className="prop-toolbar">
            <div className="prop-toolbar-group">
              <input
                className="prop-input"
                style={{ minWidth: '240px' }}
                placeholder="Tìm tên hoặc địa chỉ tòa nhà..."
                value={buildingKeyword}
                onChange={(e) => setBuildingKeyword(e.target.value)}
              />
              <select
                className="prop-select"
                value={buildingAreaFilter}
                onChange={(e) => setBuildingAreaFilter(e.target.value)}
              >
                <option value="ALL">Tất cả khu vực</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                className="prop-select"
                value={buildingStatusFilter}
                onChange={(e) => setBuildingStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Ngừng hoạt động</option>
              </select>
            </div>
            <button type="button" className="prop-btn prop-btn--outline" onClick={loadData} disabled={loading}>
              Tải lại
            </button>
          </div>

          {loading ? (
            <p>Đang tải danh sách tòa nhà...</p>
          ) : filteredBuildings.length === 0 ? (
            <div className="prop-empty">
              <h3>{buildingKeyword ? 'Không tìm thấy tòa nhà phù hợp' : 'Chưa có tòa nhà nào'}</h3>
              <p>{buildingKeyword ? 'Hãy thử đổi từ khóa tìm kiếm.' : 'Tạo tòa nhà đầu tiên để quản lý các tầng và phòng.'}</p>
              {!buildingKeyword && (
                <button type="button" className="prop-btn prop-btn--primary" onClick={handleOpenAddBuilding}>
                  + Tạo tòa nhà mới
                </button>
              )}
            </div>
          ) : (
            <div className="prop-table-wrap">
              <table className="prop-table">
                <thead>
                  <tr>
                    <th>Tên tòa nhà</th>
                    <th>Khu vực trực thuộc</th>
                    <th>Địa chỉ</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBuildings.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong>{b.name}</strong>
                      </td>
                      <td>
                        <span className="prop-badge prop-badge--active">{b.areaName}</span>
                      </td>
                      <td style={{ color: 'var(--color-muted)' }}>{b.address}</td>
                      <td>
                        <span className={`prop-badge ${b.active ? 'prop-badge--active' : 'prop-badge--inactive'}`}>
                          {b.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="prop-btn prop-btn--sm prop-btn--outline"
                            onClick={() => onNavigateRooms(b.id)}
                            title="Xem sơ đồ tầng và phòng"
                          >
                            Sơ đồ phòng
                          </button>
                          <button
                            type="button"
                            className="prop-link-action"
                            onClick={() => handleOpenEditBuilding(b)}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="prop-link-action"
                            onClick={() => {
                              setModalError(null);
                              setChangeAreaTarget(b);
                            }}
                          >
                            Đổi KV
                          </button>
                          {b.active ? (
                            <button
                              type="button"
                              className="prop-link-action prop-link-action--danger"
                              onClick={() => {
                                setModalError(null);
                                setDeactivateBuildingTarget(b);
                              }}
                            >
                              Ngừng HĐ
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="prop-link-action prop-link-action--success"
                              onClick={() => handleActivateBuilding(b)}
                            >
                              Kích hoạt
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* All Dialogs & Modals */}
      <AreaModal
        isOpen={areaModalOpen}
        area={selectedArea}
        isPending={modalPending}
        error={modalError}
        fieldErrors={modalFieldErrors}
        onClose={() => setAreaModalOpen(false)}
        onSubmit={handleSubmitArea}
      />

      <AreaDeactivateModal
        isOpen={deactivateAreaTarget !== null}
        area={deactivateAreaTarget}
        isPending={modalPending}
        error={modalError}
        onClose={() => setDeactivateAreaTarget(null)}
        onConfirm={handleConfirmDeactivateArea}
      />

      <BuildingModal
        isOpen={buildingModalOpen}
        building={selectedBuilding}
        activeAreas={activeAreas}
        isPending={modalPending}
        error={modalError}
        fieldErrors={modalFieldErrors}
        onClose={() => setBuildingModalOpen(false)}
        onSubmit={handleSubmitBuilding}
      />

      <ChangeBuildingAreaModal
        isOpen={changeAreaTarget !== null}
        building={changeAreaTarget}
        activeAreas={activeAreas}
        isPending={modalPending}
        error={modalError}
        onClose={() => setChangeAreaTarget(null)}
        onSubmit={handleSubmitChangeArea}
      />

      <BuildingDeactivateModal
        isOpen={deactivateBuildingTarget !== null}
        building={deactivateBuildingTarget}
        isPending={modalPending}
        error={modalError}
        onClose={() => setDeactivateBuildingTarget(null)}
        onConfirm={handleConfirmDeactivateBuilding}
      />
    </section>
  );
};
