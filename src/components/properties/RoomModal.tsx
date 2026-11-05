import React, { useState, useEffect } from 'react';
import type { Floor, RoomDetail, CreateRoomInput, UpdateRoomInput } from '../../types/properties';

interface RoomModalProps {
  isOpen: boolean;
  buildingId: string;
  buildingName?: string;
  floors: Floor[];
  roomDetail: RoomDetail | null; // null = create mode
  isPending: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
  onClose: () => void;
  onSubmit: (input: CreateRoomInput | UpdateRoomInput) => void;
  onOpenAddFloor: () => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  buildingName,
  floors,
  roomDetail,
  isPending,
  error,
  fieldErrors,
  onClose,
  onSubmit,
  onOpenAddFloor,
}) => {
  const [floorId, setFloorId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [area, setArea] = useState<number | ''>(28);
  const [defaultRent, setDefaultRent] = useState<number | ''>(4500000);
  const [defaultDeposit, setDefaultDeposit] = useState<number | ''>(4500000);

  // Determine if basic fields (code, name, area) are locked
  const isLocked = roomDetail ? !roomDetail.canEditBasicInfo : false;

  useEffect(() => {
    if (roomDetail) {
      setFloorId(roomDetail.floorId || '');
      setCode(roomDetail.code || '');
      setName(roomDetail.name || '');
      setArea(roomDetail.area || 28);
      setDefaultRent(roomDetail.defaultRent || 0);
      setDefaultDeposit(roomDetail.defaultDeposit || 0);
    } else {
      setFloorId(floors[0]?.id || '');
      setCode('');
      setName('');
      setArea(28);
      setDefaultRent(4500000);
      setDefaultDeposit(4500000);
    }
  }, [roomDetail, floors, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (defaultRent === '' || defaultDeposit === '') return;

    if (roomDetail) {
      // Edit mode
      const input: UpdateRoomInput = {
        defaultRent: Number(defaultRent),
        defaultDeposit: Number(defaultDeposit),
      };
      if (!isLocked) {
        input.code = code.trim();
        input.name = name.trim();
        input.area = area !== '' ? Number(area) : undefined;
      }
      onSubmit(input);
    } else {
      // Create mode
      if (!floorId || !code.trim() || !name.trim() || area === '') return;
      onSubmit({
        floorId,
        code: code.trim(),
        name: name.trim(),
        area: Number(area),
        defaultRent: Number(defaultRent),
        defaultDeposit: Number(defaultDeposit),
      });
    }
  };

  return (
    <div className="prop-drawer-backdrop" onClick={onClose}>
      <dialog
        open
        className="prop-dialog"
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="room-modal-title"
      >
        <div className="prop-dialog-header">
          <div>
            <h2 id="room-modal-title">{roomDetail ? `Cập nhật phòng: ${roomDetail.code}` : 'Khai báo phòng mới'}</h2>
            {buildingName && <p className="prop-help" style={{ margin: 0 }}>Tòa nhà: {buildingName}</p>}
          </div>
          <button type="button" className="prop-btn prop-btn--outline prop-btn--sm" onClick={onClose} disabled={isPending}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="prop-dialog-body">
            {error && (
              <div className="prop-banner prop-banner--error" role="alert">
                <p>{error}</p>
              </div>
            )}

            {/* Lock warning banner for UC14 */}
            {isLocked && (
              <div className="prop-banner prop-banner--warn" role="alert">
                <p>
                  <strong>Khóa trường cốt lõi (Ngoại lệ 10d):</strong> Phòng đang có hợp đồng thuê hoặc giữ chỗ còn hiệu lực.
                  Hệ thống đã khóa mã phòng, tên và diện tích. Bạn chỉ được phép cập nhật giá thuê và tiền cọc mặc định.
                </p>
              </div>
            )}

            {/* Floor selector (only in create mode) */}
            {!roomDetail && (
              <div className="prop-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="room-floor">Tầng trực thuộc (*)</label>
                  <button
                    type="button"
                    className="prop-link-action"
                    onClick={onOpenAddFloor}
                    style={{ fontSize: 'var(--text-xs)' }}
                  >
                    + Thêm tầng mới
                  </button>
                </div>
                {floors.length === 0 ? (
                  <div className="prop-banner prop-banner--warn">
                    <p>Tòa nhà chưa có tầng nào. Vui lòng thêm tầng trước khi khai báo phòng.</p>
                  </div>
                ) : (
                  <select
                    id="room-floor"
                    className="prop-select"
                    value={floorId}
                    onChange={(e) => setFloorId(e.target.value)}
                    required
                    disabled={isPending}
                  >
                    <option value="">-- Chọn tầng --</option>
                    {floors.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} (Cấp {f.level})
                      </option>
                    ))}
                  </select>
                )}
                {fieldErrors.floorId && <p className="prop-field-error">{fieldErrors.floorId}</p>}
              </div>
            )}

            {/* Room Code */}
            <div className="prop-field">
              <label htmlFor="room-code">
                Mã phòng (*) {isLocked && <span title="Đã khóa do có hợp đồng">🔒 (Đã khóa)</span>}
              </label>
              <input
                id="room-code"
                className="prop-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="VD: P101, A202, Studio-1..."
                required={!isLocked}
                disabled={isPending || isLocked}
                autoFocus={!isLocked}
              />
              {fieldErrors.code && <p className="prop-field-error">{fieldErrors.code}</p>}
            </div>

            {/* Room Name */}
            <div className="prop-field">
              <label htmlFor="room-name">
                Tên phòng (*) {isLocked && <span title="Đã khóa do có hợp đồng">🔒 (Đã khóa)</span>}
              </label>
              <input
                id="room-name"
                className="prop-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Phòng Studio Ban Công 101..."
                required={!isLocked}
                disabled={isPending || isLocked}
              />
              {fieldErrors.name && <p className="prop-field-error">{fieldErrors.name}</p>}
            </div>

            {/* Room Area */}
            <div className="prop-field">
              <label htmlFor="room-area">
                Diện tích phòng (m²) (*) {isLocked && <span title="Đã khóa do có hợp đồng">🔒 (Đã khóa)</span>}
              </label>
              <input
                id="room-area"
                type="number"
                step="any"
                min="0.01"
                className="prop-input"
                value={area}
                onChange={(e) => setArea(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="VD: 28.5"
                required={!isLocked}
                disabled={isPending || isLocked}
              />
              {fieldErrors.area && <p className="prop-field-error">{fieldErrors.area}</p>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              {/* Default Rent */}
              <div className="prop-field">
                <label htmlFor="room-rent">Giá thuê mặc định (VNĐ/tháng) (*)</label>
                <input
                  id="room-rent"
                  type="number"
                  step="any"
                  min="0"
                  className="prop-input"
                  value={defaultRent}
                  onChange={(e) => setDefaultRent(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="VD: 5000000"
                  required
                  disabled={isPending}
                />
                {fieldErrors.defaultRent && <p className="prop-field-error">{fieldErrors.defaultRent}</p>}
              </div>

              {/* Default Deposit */}
              <div className="prop-field">
                <label htmlFor="room-deposit">Tiền cọc mặc định (VNĐ) (*)</label>
                <input
                  id="room-deposit"
                  type="number"
                  step="any"
                  min="0"
                  className="prop-input"
                  value={defaultDeposit}
                  onChange={(e) => setDefaultDeposit(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="VD: 5000000"
                  required
                  disabled={isPending}
                />
                {fieldErrors.defaultDeposit && <p className="prop-field-error">{fieldErrors.defaultDeposit}</p>}
              </div>
            </div>

            {!roomDetail && (
              <p className="prop-help">
                Phòng mới tạo sẽ mặc định ở trạng thái <strong>Đang trống (VACANT)</strong>.
              </p>
            )}
          </div>

          <div className="prop-dialog-footer">
            <button type="button" className="prop-btn" onClick={onClose} disabled={isPending}>
              Hủy
            </button>
            <button
              type="submit"
              className="prop-btn prop-btn--primary"
              disabled={isPending || (!roomDetail && (!floorId || !code.trim() || !name.trim() || area === ''))}
            >
              {isPending ? 'Đang lưu...' : roomDetail ? 'Lưu thay đổi' : 'Khai báo phòng'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
};

