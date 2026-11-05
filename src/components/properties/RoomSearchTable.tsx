import React from 'react';
import type { Area, Building, Floor, RoomSearchItem, RoomFilterParams } from '../../types/properties';

interface RoomSearchTableProps {
  rooms: RoomSearchItem[];
  loading: boolean;
  areas: Area[];
  buildings: Building[];
  floors: Floor[];
  filterParams: RoomFilterParams;
  onFilterChange: (params: RoomFilterParams) => void;
  onApplyFilter: () => void;
  onResetFilter: () => void;
  onSelectRoom: (roomId: string, action: 'detail' | 'history' | 'edit') => void;
}

export const RoomSearchTable: React.FC<RoomSearchTableProps> = ({
  rooms,
  loading,
  areas,
  buildings,
  floors,
  filterParams,
  onFilterChange,
  onApplyFilter,
  onResetFilter,
  onSelectRoom,
}) => {
  const renderBadge = (status: string, isMaintenance: boolean) => {
    switch (status) {
      case 'OCCUPIED':
        return <span className="prop-badge prop-badge--occupied">Đang thuê {isMaintenance ? '· Bảo trì' : ''}</span>;
      case 'RESERVED':
        return <span className="prop-badge prop-badge--reserved">Đang cọc {isMaintenance ? '· Bảo trì' : ''}</span>;
      case 'MAINTENANCE':
        return <span className="prop-badge prop-badge--maint">Bảo trì</span>;
      case 'VACANT':
      default:
        return <span className="prop-badge prop-badge--vacant">Đang trống</span>;
    }
  };

  return (
    <div>
      {/* Multi-criteria filter toolbar */}
      <div className="prop-toolbar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-sm)' }}>
          <input
            className="prop-input"
            placeholder="Tìm theo mã hoặc tên phòng..."
            value={filterParams.keyword || ''}
            onChange={(e) => onFilterChange({ ...filterParams, keyword: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApplyFilter();
            }}
          />

          <select
            className="prop-select"
            value={filterParams.areaId || ''}
            onChange={(e) => onFilterChange({ ...filterParams, areaId: e.target.value || undefined, buildingId: undefined, floorId: undefined })}
          >
            <option value="">Tất cả khu vực</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <select
            className="prop-select"
            value={filterParams.buildingId || ''}
            onChange={(e) => onFilterChange({ ...filterParams, buildingId: e.target.value || undefined, floorId: undefined })}
          >
            <option value="">Tất cả tòa nhà</option>
            {buildings
              .filter((b) => !filterParams.areaId || b.areaId === filterParams.areaId)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>

          <select
            className="prop-select"
            value={filterParams.floorId || ''}
            onChange={(e) => onFilterChange({ ...filterParams, floorId: e.target.value || undefined })}
          >
            <option value="">Tất cả tầng</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} (Cấp {f.level})
              </option>
            ))}
          </select>

          <select
            className="prop-select"
            value={filterParams.status || ''}
            onChange={(e) => onFilterChange({ ...filterParams, status: e.target.value || undefined })}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="VACANT">Đang trống (VACANT)</option>
            <option value="OCCUPIED">Đang thuê (OCCUPIED)</option>
            <option value="RESERVED">Đang cọc (RESERVED)</option>
            <option value="MAINTENANCE">Bảo trì (MAINTENANCE)</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
          <button type="button" className="prop-btn" onClick={onResetFilter}>
            Xóa bộ lọc
          </button>
          <button type="button" className="prop-btn prop-btn--primary" onClick={onApplyFilter} disabled={loading}>
            {loading ? 'Đang tìm...' : 'Áp dụng / Tìm kiếm'}
          </button>
        </div>
      </div>

      {/* Results Table */}
      {loading ? (
        <p style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>Đang tra cứu danh sách phòng...</p>
      ) : rooms.length === 0 ? (
        <div className="prop-empty">
          <h3>Không tìm thấy phòng phù hợp</h3>
          <p>Thử điều chỉnh lại từ khóa hoặc xóa bớt tiêu chí lọc.</p>
          <button type="button" className="prop-btn" onClick={onResetFilter}>
            Xóa bộ lọc
          </button>
        </div>
      ) : (
        <div className="prop-table-wrap">
          <table className="prop-table">
            <thead>
              <tr>
                <th>Mã phòng</th>
                <th>Tên phòng</th>
                <th>Vị trí phân cấp</th>
                <th>Diện tích</th>
                <th>Giá thuê mặc định</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td>
                    <strong>{room.code}</strong>
                  </td>
                  <td>{room.name}</td>
                  <td style={{ color: 'var(--color-muted)', fontSize: 'var(--text-xs)' }}>
                    {room.buildingName} &gt; {room.floorName} ({room.areaName})
                  </td>
                  <td>{room.area} m²</td>
                  <td>
                    <strong>{room.defaultRent?.toLocaleString('vi-VN')} đ</strong>
                    <div style={{ color: 'var(--color-muted)', fontSize: 'var(--text-xs)' }}>
                      Cọc: {room.defaultDeposit?.toLocaleString('vi-VN')} đ
                    </div>
                  </td>
                  <td>{renderBadge(room.status, room.isMaintenance)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="prop-link-action"
                        onClick={() => onSelectRoom(room.id, 'detail')}
                      >
                        Chi tiết
                      </button>
                      <button
                        type="button"
                        className="prop-link-action"
                        onClick={() => onSelectRoom(room.id, 'history')}
                      >
                        Lịch sử
                      </button>
                      <button
                        type="button"
                        className="prop-link-action"
                        onClick={() => onSelectRoom(room.id, 'edit')}
                      >
                        Sửa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

