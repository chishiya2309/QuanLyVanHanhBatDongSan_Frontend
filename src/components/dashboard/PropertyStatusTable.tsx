import React, { useState } from 'react';
import type { RoomAttentionItem, RoomAttentionStatus } from '../../types/dashboard';

interface PropertyStatusTableProps {
  rooms: RoomAttentionItem[];
}

export const PropertyStatusTable: React.FC<PropertyStatusTableProps> = ({ rooms }) => {
  const [activeFilter, setActiveFilter] = useState<'ALL' | RoomAttentionStatus>('ALL');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  };

  const filteredRooms = activeFilter === 'ALL'
    ? rooms
    : rooms.filter((r) => r.status === activeFilter);

  const getCount = (status: 'ALL' | RoomAttentionStatus) => {
    if (status === 'ALL') return rooms.length;
    return rooms.filter((r) => r.status === status).length;
  };

  const handleRowAction = (room: RoomAttentionItem) => {
    let action = 'Xem thông tin';
    if (room.status === 'OVERDUE') action = 'Gửi thông báo đòi nợ';
    else if (room.status === 'MAINTENANCE') action = 'Cập nhật tiến độ thợ sửa';
    else if (room.status === 'VACANT') action = 'Đăng tin tìm khách';
    else if (room.status === 'EXPIRING') action = 'Gia hạn hợp đồng';

    setActionNotice(`Đã chọn: "${action}" cho phòng ${room.roomNumber}`);
    setTimeout(() => setActionNotice(null), 2500);
  };

  return (
    <section className="table-panel" aria-label="Bảng theo dõi trạng thái phòng">
      <div className="dash-panel-header">
        <div className="panel-title-group">
          <h3>Trạng thái phòng cần lưu ý</h3>
          <p>Danh sách các phòng đang trống, chậm đóng tiền, bảo trì hoặc sắp đáo hạn hợp đồng</p>
        </div>
        {actionNotice && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--color-success)',
              fontWeight: 600,
            }}
          >
            ✓ {actionNotice}
          </span>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="table-filter-tabs" role="tablist">
        <button
          type="button"
          className={`filter-tab-btn ${activeFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => setActiveFilter('ALL')}
          role="tab"
          aria-selected={activeFilter === 'ALL'}
        >
          <span>Tất cả</span>
          <span className="tab-count">({getCount('ALL')})</span>
        </button>

        <button
          type="button"
          className={`filter-tab-btn ${activeFilter === 'VACANT' ? 'is-active' : ''}`}
          onClick={() => setActiveFilter('VACANT')}
          role="tab"
          aria-selected={activeFilter === 'VACANT'}
        >
          <span>Đang trống</span>
          <span className="tab-count">({getCount('VACANT')})</span>
        </button>

        <button
          type="button"
          className={`filter-tab-btn ${activeFilter === 'OVERDUE' ? 'is-active' : ''}`}
          onClick={() => setActiveFilter('OVERDUE')}
          role="tab"
          aria-selected={activeFilter === 'OVERDUE'}
        >
          <span>Chậm nộp tiền</span>
          <span className="tab-count">({getCount('OVERDUE')})</span>
        </button>

        <button
          type="button"
          className={`filter-tab-btn ${activeFilter === 'MAINTENANCE' ? 'is-active' : ''}`}
          onClick={() => setActiveFilter('MAINTENANCE')}
          role="tab"
          aria-selected={activeFilter === 'MAINTENANCE'}
        >
          <span>Đang báo hỏng</span>
          <span className="tab-count">({getCount('MAINTENANCE')})</span>
        </button>

        <button
          type="button"
          className={`filter-tab-btn ${activeFilter === 'EXPIRING' ? 'is-active' : ''}`}
          onClick={() => setActiveFilter('EXPIRING')}
          role="tab"
          aria-selected={activeFilter === 'EXPIRING'}
        >
          <span>Sắp hết hạn HĐ</span>
          <span className="tab-count">({getCount('EXPIRING')})</span>
        </button>
      </div>

      {/* Data Table */}
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th scope="col">Phòng &amp; Tòa nhà</th>
              <th scope="col">Khách thuê hiện tại</th>
              <th scope="col">Trạng thái</th>
              <th scope="col" className="num-col">Giá thuê / tháng</th>
              <th scope="col">Ghi chú vận hành</th>
              <th scope="col" className="num-col">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredRooms.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-muted)' }}>
                  Không có phòng nào trong trạng thái này.
                </td>
              </tr>
            ) : (
              filteredRooms.map((room) => {
                let statusClass = 'vacant';
                if (room.status === 'OVERDUE') statusClass = 'overdue';
                else if (room.status === 'MAINTENANCE') statusClass = 'maintenance';
                else if (room.status === 'EXPIRING') statusClass = 'expiring';

                return (
                  <tr key={room.id}>
                    {/* Phòng */}
                    <td>
                      <div className="room-identity">
                        <span className="room-code">{room.roomNumber}</span>
                        <span className="room-property-name">
                          Tầng {room.floor} • {room.propertyName}
                        </span>
                      </div>
                    </td>

                    {/* Khách thuê */}
                    <td>
                      {room.tenantName ? (
                        <div className="tenant-identity">
                          <span className="tenant-name">{room.tenantName}</span>
                          <span className="tenant-phone">{room.tenantPhone}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-muted)' }}>— (Chưa có khách)</span>
                      )}
                    </td>

                    {/* Trạng thái */}
                    <td>
                      <span className={`status-pill ${statusClass}`}>
                        {room.statusLabel}
                      </span>
                    </td>

                    {/* Giá thuê */}
                    <td className="num-col">
                      <span className="rent-amount">{formatVND(room.monthlyRent)}</span>
                    </td>

                    {/* Ghi chú */}
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                        {room.status === 'OVERDUE' && `Trễ nộp ${room.overdueDays} ngày`}
                        {room.status === 'EXPIRING' && `Còn ${room.daysUntilExpiry} ngày hết hạn`}
                        {room.issueNote && room.issueNote}
                      </span>
                    </td>

                    {/* Thao tác */}
                    <td className="num-col">
                      <button
                        type="button"
                        className="action-row-btn"
                        onClick={() => handleRowAction(room)}
                      >
                        {room.status === 'OVERDUE'
                          ? 'Nhắc phí'
                          : room.status === 'MAINTENANCE'
                          ? 'Bảo trì'
                          : room.status === 'EXPIRING'
                          ? 'Gia hạn'
                          : 'Chi tiết'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
