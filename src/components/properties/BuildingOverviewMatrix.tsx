import React from 'react';
import type { BuildingOverview, Floor, RoomOverviewItem } from '../../types/properties';

interface BuildingOverviewMatrixProps {
  overview: BuildingOverview | null;
  loading: boolean;
  onOpenAddFloor: () => void;
  onOpenEditFloor: (floor: Floor) => void;
  onOpenAddRoom: (floorId?: string) => void;
  onSelectRoom: (roomId: string, action: 'detail' | 'history' | 'edit') => void;
}

export const BuildingOverviewMatrix: React.FC<BuildingOverviewMatrixProps> = ({
  overview,
  loading,
  onOpenAddFloor,
  onOpenEditFloor,
  onOpenAddRoom,
  onSelectRoom,
}) => {
  if (loading) {
    return <p style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>Đang tải sơ đồ tầng và phòng...</p>;
  }

  if (!overview || overview.floors.length === 0) {
    return (
      <div className="prop-empty">
        <h3>Tòa nhà chưa có tầng nào</h3>
        <p>Bắt đầu xây dựng sơ đồ mặt bằng bằng cách thêm tầng đầu tiên cho tòa nhà này.</p>
        <button type="button" className="prop-btn prop-btn--primary" onClick={onOpenAddFloor}>
          + Thêm tầng đầu tiên
        </button>
      </div>
    );
  }

  const renderBadge = (item: RoomOverviewItem) => {
    switch (item.status) {
      case 'OCCUPIED':
        return <span className="prop-badge prop-badge--occupied">Đang thuê {item.isMaintenance ? '· Bảo trì' : ''}</span>;
      case 'RESERVED':
        return <span className="prop-badge prop-badge--reserved">Đang cọc {item.isMaintenance ? '· Bảo trì' : ''}</span>;
      case 'MAINTENANCE':
        return <span className="prop-badge prop-badge--maint">Bảo trì</span>;
      case 'VACANT':
      default:
        return <span className="prop-badge prop-badge--vacant">Đang trống</span>;
    }
  };

  return (
    <div className="matrix-container">
      {overview.floors.map((floor) => {
        const total = floor.rooms.length;
        const occupied = floor.rooms.filter((r) => r.status === 'OCCUPIED' || r.status === 'RESERVED').length;
        const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;

        // Dummy floor object for edit floor modal
        const floorObj: Floor = {
          id: floor.floorId,
          buildingId: overview.buildingId,
          name: floor.floorName,
          level: floor.floorLevel,
          roomCount: floor.rooms.length,
          createdAt: '',
          updatedAt: '',
        };

        return (
          <section key={floor.floorId} className="floor-card" aria-label={`Tầng ${floor.floorName}`}>
            <header className="floor-header">
              <div className="floor-header-title">
                <h3>
                  {floor.floorName} (Cấp {floor.floorLevel})
                </h3>
                <span className="floor-occupancy">
                  {total} phòng · {occupied} đã ở/cọc ({rate}%)
                </span>
              </div>
              <div className="floor-actions">
                <button
                  type="button"
                  className="prop-btn prop-btn--sm prop-btn--outline"
                  onClick={() => onOpenEditFloor(floorObj)}
                >
                  Sửa tầng
                </button>
                <button
                  type="button"
                  className="prop-btn prop-btn--sm prop-btn--primary"
                  onClick={() => onOpenAddRoom(floor.floorId)}
                >
                  + Thêm phòng
                </button>
              </div>
            </header>

            {floor.rooms.length === 0 ? (
              <div style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--color-muted)' }}>
                <p>Tầng này chưa có phòng nào.</p>
                <button
                  type="button"
                  className="prop-link-action"
                  onClick={() => onOpenAddRoom(floor.floorId)}
                >
                  + Khai báo phòng vào tầng này
                </button>
              </div>
            ) : (
              <div className="floor-rooms-grid">
                {floor.rooms.map((room) => (
                  <article
                    key={room.id}
                    className="room-card"
                    onClick={() => onSelectRoom(room.id, 'detail')}
                    title="Nhấn để xem chi tiết phòng"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="room-card-code">{room.code}</span>
                      {renderBadge(room)}
                    </div>
                    <div className="room-card-name">{room.name}</div>
                    <div className="room-card-footer" onClick={(e) => e.stopPropagation()}>
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
                        onClick={() => onSelectRoom(room.id, 'edit')}
                      >
                        Sửa
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

