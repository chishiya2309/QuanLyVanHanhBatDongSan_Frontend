import React, { useState, useEffect, useCallback } from 'react';
import type {
  Area,
  Building,
  Floor,
  BuildingOverview,
  RoomSearchItem,
  RoomDetail,
  RoomsRoute,
  CreateFloorInput,
  UpdateFloorInput,
  CreateRoomInput,
  UpdateRoomInput,
  RoomFilterParams,
} from '../../types/properties';
import {
  getAreas,
  getBuildings,
  getFloors,
  createFloor,
  updateFloor,
  createRoom,
  getRoomDetail,
  updateRoom,
  searchRooms,
  getBuildingOverview,
  PropertyApiError,
} from '../../services/propertiesApi';
import { BuildingOverviewMatrix } from './BuildingOverviewMatrix';
import { RoomSearchTable } from './RoomSearchTable';
import { FloorModal } from './FloorModal';
import { RoomModal } from './RoomModal';
import { RoomDetailDrawer } from './RoomDetailDrawer';
import './properties.css';

interface RoomsPageProps {
  route: RoomsRoute;
  onNavigate: (url: string) => void;
  onSessionExpired: () => void;
}

export const RoomsPage: React.FC<RoomsPageProps> = ({
  route,
  onNavigate,
  onSessionExpired,
}) => {
  const [viewMode, setViewMode] = useState<'matrix' | 'table'>(route.view || 'matrix');

  // Hierarchy Data
  const [areas, setAreas] = useState<Area[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(route.buildingId || '');
  const [floors, setFloors] = useState<Floor[]>([]);

  // Overview Data (for Matrix View)
  const [overview, setOverview] = useState<BuildingOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(route.view === 'matrix' && Boolean(route.buildingId));

  // Search Results (for Table View)
  const [searchResults, setSearchResults] = useState<RoomSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(route.view === 'table');
  const [filterParams, setFilterParams] = useState<RoomFilterParams>({
    buildingId: route.buildingId || undefined,
  });

  // Banners & Notifications
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  // Modals & Drawers
  const [floorModalOpen, setFloorModalOpen] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);

  const [roomModalOpen, setRoomModalOpen] = useState(route.action === 'create');
  const [selectedRoomDetail, setSelectedRoomDetail] = useState<RoomDetail | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(
    (route.action === 'detail' || route.action === 'history') && !!route.roomId
  );
  const [drawerRoomId, setDrawerRoomId] = useState<string | null>(route.roomId || null);
  const [drawerInitialTab, setDrawerInitialTab] = useState<'detail' | 'history'>(
    route.action === 'history' ? 'history' : 'detail'
  );

  const [modalPending, setModalPending] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalFieldErrors, setModalFieldErrors] = useState<Record<string, string>>({});

  // 1. Load initial Buildings and Areas
  useEffect(() => {
    let isMounted = true;
    Promise.all([getAreas(), getBuildings()])
      .then(([areasRes, buildingsRes]) => {
        if (!isMounted) return;
        setAreas(areasRes);
        setBuildings(buildingsRes);
        if (!selectedBuildingId && buildingsRes.length > 0) {
          setOverviewLoading(true);
          setSelectedBuildingId(buildingsRes[0].id);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err instanceof PropertyApiError && err.status === 401) {
          onSessionExpired();
          return;
        }
        setBanner({ kind: 'error', message: 'Không thể tải danh sách tòa nhà' });
      });

    return () => {
      isMounted = false;
    };
  }, [onSessionExpired, selectedBuildingId]);

  // 2. Load Floors when selectedBuildingId changes
  const loadFloors = useCallback(async (bId: string) => {
    if (!bId) return;
    try {
      const floorsRes = await getFloors(bId);
      setFloors(floorsRes);
    } catch (err) {
      if (err instanceof PropertyApiError && err.status === 401) {
        onSessionExpired();
        return;
      }
    }
  }, [onSessionExpired]);

  useEffect(() => {
    if (!selectedBuildingId) return;
    let active = true;
    getFloors(selectedBuildingId)
      .then((data) => { if (active) setFloors(data); })
      .catch((err: unknown) => {
        if (active && err instanceof PropertyApiError && err.status === 401) onSessionExpired();
      });
    return () => { active = false; };
  }, [selectedBuildingId, onSessionExpired]);

  // 3. Load Matrix Overview
  const loadOverview = useCallback(async (bId: string) => {
    if (!bId) return;
    setOverviewLoading(true);
    try {
      const ovRes = await getBuildingOverview(bId);
      setOverview(ovRes);
    } catch (err) {
      if (err instanceof PropertyApiError && err.status === 401) {
        onSessionExpired();
        return;
      }
      setBanner({ kind: 'error', message: err instanceof Error ? err.message : 'Lỗi khi tải sơ đồ tầng' });
    } finally {
      setOverviewLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    if (viewMode !== 'matrix' || !selectedBuildingId) return;
    let active = true;
    getBuildingOverview(selectedBuildingId)
      .then((data) => { if (active) setOverview(data); })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof PropertyApiError && err.status === 401) {
          onSessionExpired();
          return;
        }
        setBanner({ kind: 'error', message: err instanceof Error ? err.message : 'Lỗi khi tải sơ đồ tầng' });
      })
      .finally(() => { if (active) setOverviewLoading(false); });
    return () => { active = false; };
  }, [viewMode, selectedBuildingId, onSessionExpired]);

  // 4. Load Search Table Results
  const executeSearch = useCallback(async (params: RoomFilterParams) => {
    setSearchLoading(true);
    try {
      const results = await searchRooms(params);
      setSearchResults(results);
    } catch (err) {
      if (err instanceof PropertyApiError && err.status === 401) {
        onSessionExpired();
        return;
      }
      setBanner({ kind: 'error', message: err instanceof Error ? err.message : 'Lỗi khi tra cứu danh sách phòng' });
    } finally {
      setSearchLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    if (viewMode !== 'table') return;
    let active = true;
    searchRooms(filterParams)
      .then((data) => { if (active) setSearchResults(data); })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof PropertyApiError && err.status === 401) {
          onSessionExpired();
          return;
        }
        setBanner({ kind: 'error', message: err instanceof Error ? err.message : 'Lỗi khi tra cứu danh sách phòng' });
      })
      .finally(() => { if (active) setSearchLoading(false); });
    return () => { active = false; };
  }, [viewMode, filterParams, onSessionExpired]);

  // Change view mode
  const handleSwitchView = (mode: 'matrix' | 'table') => {
    if (mode === viewMode) return;
    if (mode === 'matrix') setOverviewLoading(Boolean(selectedBuildingId));
    else setSearchLoading(true);
    setViewMode(mode);
    onNavigate(`/rooms?view=${mode}${selectedBuildingId ? `&buildingId=${selectedBuildingId}` : ''}`);
  };

  // Change selected building in Matrix
  const handleSelectBuilding = (bId: string) => {
    if (bId === selectedBuildingId) return;
    setOverviewLoading(Boolean(bId));
    setOverview(null);
    setFloors([]);
    setSelectedBuildingId(bId);
    onNavigate(`/rooms?view=matrix&buildingId=${bId}`);
  };

  // ==========================================
  // Floor Handlers (UC13, UC14)
  // ==========================================
  const handleOpenAddFloor = () => {
    setSelectedFloor(null);
    setModalError(null);
    setModalFieldErrors({});
    setFloorModalOpen(true);
  };

  const handleOpenEditFloor = (floor: Floor) => {
    setSelectedFloor(floor);
    setModalError(null);
    setModalFieldErrors({});
    setFloorModalOpen(true);
  };

  const handleSubmitFloor = async (input: CreateFloorInput | UpdateFloorInput) => {
    if (!selectedBuildingId) return;
    setModalPending(true);
    setModalError(null);
    setModalFieldErrors({});
    try {
      if (selectedFloor) {
        await updateFloor(selectedBuildingId, selectedFloor.id, input as UpdateFloorInput);
        setBanner({ kind: 'success', message: 'Cập nhật tầng thành công' });
      } else {
        await createFloor(selectedBuildingId, input as CreateFloorInput);
        setBanner({ kind: 'success', message: 'Thêm tầng thành công' });
      }
      setFloorModalOpen(false);
      await Promise.all([loadFloors(selectedBuildingId), loadOverview(selectedBuildingId)]);
    } catch (err) {
      if (err instanceof PropertyApiError) {
        if (err.status === 401) {
          onSessionExpired();
          return;
        }
        setModalError(err.message);
        setModalFieldErrors(err.fieldErrors);
      } else {
        setModalError('Lỗi khi lưu thông tin tầng. Vui lòng thử lại sau');
      }
    } finally {
      setModalPending(false);
    }
  };

  // ==========================================
  // Room Handlers (UC13, UC14, UC15)
  // ==========================================
  const handleOpenAddRoom = (floorId?: string) => {
    setSelectedRoomDetail(null);
    setModalError(null);
    setModalFieldErrors({});
    if (floorId) {
      // Pre-select floor if supplied
      // Floor selection handled via RoomModal
    }
    setRoomModalOpen(true);
  };

  const handleSelectRoomAction = async (roomId: string, action: 'detail' | 'history' | 'edit') => {
    if (action === 'detail' || action === 'history') {
      setDrawerRoomId(roomId);
      setDrawerInitialTab(action === 'history' ? 'history' : 'detail');
      setDrawerOpen(true);
    } else if (action === 'edit') {
      try {
        const detail = await getRoomDetail(roomId, selectedBuildingId || undefined);
        setSelectedRoomDetail(detail);
        setModalError(null);
        setModalFieldErrors({});
        setRoomModalOpen(true);
      } catch (err) {
        if (err instanceof PropertyApiError && err.status === 401) {
          onSessionExpired();
          return;
        }
        setBanner({ kind: 'error', message: 'Không thể tải thông tin phòng để chỉnh sửa' });
      }
    }
  };

  const handleSubmitRoom = async (input: CreateRoomInput | UpdateRoomInput) => {
    setModalPending(true);
    setModalError(null);
    setModalFieldErrors({});
    try {
      if (selectedRoomDetail) {
        // UC14 Cập nhật phòng
        await updateRoom(selectedRoomDetail.id, input as UpdateRoomInput, selectedRoomDetail.buildingId);
        setBanner({ kind: 'success', message: 'Cập nhật phòng thành công' });
      } else {
        // UC13 Khai báo phòng
        const createInput = input as CreateRoomInput;
        await createRoom(selectedBuildingId, createInput);
        setBanner({ kind: 'success', message: 'Khai báo phòng thành công' });
      }
      setRoomModalOpen(false);

      if (viewMode === 'matrix' && selectedBuildingId) {
        await loadOverview(selectedBuildingId);
      } else if (viewMode === 'table') {
        await executeSearch(filterParams);
      }
    } catch (err) {
      if (err instanceof PropertyApiError) {
        if (err.status === 401) {
          onSessionExpired();
          return;
        }
        setModalError(err.message);
        setModalFieldErrors(err.fieldErrors);
      } else {
        setModalError('Lỗi khi lưu phòng. Vui lòng thử lại sau');
      }
    } finally {
      setModalPending(false);
    }
  };

  const selectedBuildingObj = buildings.find((b) => b.id === selectedBuildingId);

  return (
    <section className="rooms-page" aria-labelledby="rooms-title">
      <header className="prop-page-heading">
        <div>
          <h1 id="rooms-title">Quản lý Mặt bằng &amp; Phòng</h1>
          <p>Theo dõi trực quan sơ đồ tầng, khai báo phòng mới và tra cứu đa tiêu chí</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          {selectedBuildingId && (
            <button type="button" className="prop-btn prop-btn--outline" onClick={handleOpenAddFloor}>
              + Thêm tầng
            </button>
          )}
          <button
            type="button"
            className="prop-btn prop-btn--primary"
            onClick={() => handleOpenAddRoom()}
            disabled={!selectedBuildingId}
          >
            + Khai báo phòng
          </button>
        </div>
      </header>

      {/* View Switcher and Building Picker */}
      <div className="prop-toolbar" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="prop-toolbar-group">
          {viewMode === 'matrix' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <label htmlFor="select-building" style={{ fontWeight: 600 }}>
                Tòa nhà:
              </label>
              <select
                id="select-building"
                className="prop-select"
                value={selectedBuildingId}
                onChange={(e) => handleSelectBuilding(e.target.value)}
                style={{ minWidth: '220px' }}
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.areaName})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="prop-segmented">
          <button
            type="button"
            className={`prop-segmented-btn ${viewMode === 'matrix' ? 'is-active' : ''}`}
            onClick={() => handleSwitchView('matrix')}
          >
            Sơ đồ tầng
          </button>
          <button
            type="button"
            className={`prop-segmented-btn ${viewMode === 'table' ? 'is-active' : ''}`}
            onClick={() => handleSwitchView('table')}
          >
            Danh sách tra cứu
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {banner && (
        <div className={`prop-banner prop-banner--${banner.kind}`} role="status">
          <p>{banner.message}</p>
          <button type="button" className="prop-btn prop-btn--sm" onClick={() => setBanner(null)}>
            Đóng
          </button>
        </div>
      )}

      {/* VIEW 1: SƠ ĐỒ MA TRẬN TẦNG (UC15 Luồng A) */}
      {viewMode === 'matrix' && (
        <BuildingOverviewMatrix
          overview={overview}
          loading={overviewLoading}
          onOpenAddFloor={handleOpenAddFloor}
          onOpenEditFloor={handleOpenEditFloor}
          onOpenAddRoom={handleOpenAddRoom}
          onSelectRoom={handleSelectRoomAction}
        />
      )}

      {/* VIEW 2: BẢNG TRA CỨU ĐA TIÊU CHÍ (UC15 Luồng chính) */}
      {viewMode === 'table' && (
        <RoomSearchTable
          rooms={searchResults}
          loading={searchLoading}
          areas={areas}
          buildings={buildings}
          floors={floors}
          filterParams={filterParams}
          onFilterChange={(params) => { setSearchLoading(true); setFilterParams(params); }}
          onApplyFilter={() => executeSearch(filterParams)}
          onResetFilter={() => {
            const emptyParams = {};
            setSearchLoading(true);
            setFilterParams(emptyParams);
          }}
          onSelectRoom={handleSelectRoomAction}
        />
      )}

      {/* Modal Thêm / Sửa Tầng (UC13) */}
      <FloorModal
        isOpen={floorModalOpen}
        buildingId={selectedBuildingId}
        floor={selectedFloor}
        isPending={modalPending}
        error={modalError}
        fieldErrors={modalFieldErrors}
        onClose={() => setFloorModalOpen(false)}
        onSubmit={handleSubmitFloor}
      />

      {/* Modal Khai báo / Cập nhật Phòng (UC13, UC14) */}
      <RoomModal
        isOpen={roomModalOpen}
        buildingId={selectedBuildingId}
        buildingName={selectedBuildingObj?.name}
        floors={floors}
        roomDetail={selectedRoomDetail}
        isPending={modalPending}
        error={modalError}
        fieldErrors={modalFieldErrors}
        onClose={() => setRoomModalOpen(false)}
        onSubmit={handleSubmitRoom}
        onOpenAddFloor={handleOpenAddFloor}
      />

      {/* Drawer Chi tiết & Lịch sử Phòng (UC15) */}
      <RoomDetailDrawer
        isOpen={drawerOpen}
        roomId={drawerRoomId}
        buildingId={selectedBuildingId}
        initialTab={drawerInitialTab}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerRoomId(null);
        }}
        onEditRoom={(room) => {
          setSelectedRoomDetail(room);
          setModalError(null);
          setModalFieldErrors({});
          setRoomModalOpen(true);
        }}
        onSessionExpired={onSessionExpired}
      />
    </section>
  );
};

