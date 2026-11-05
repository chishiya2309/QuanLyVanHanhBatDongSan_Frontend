import React, { useState, useEffect } from 'react';
import type {
  Area,
  Building,
  CreateAreaInput,
  UpdateAreaInput,
  CreateBuildingInput,
  UpdateBuildingInput,
  ChangeBuildingAreaInput,
} from '../../types/properties';

// ==========================================
// 1. Modal Thêm / Sửa Khu vực (UC10)
// ==========================================
interface AreaModalProps {
  isOpen: boolean;
  area: Area | null; // null = create mode
  isPending: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
  onClose: () => void;
  onSubmit: (input: CreateAreaInput | UpdateAreaInput) => void;
}

export const AreaModal: React.FC<AreaModalProps> = ({
  isOpen,
  area,
  isPending,
  error,
  fieldErrors,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (area) {
      setName(area.name);
      setDescription(area.description || '');
    } else {
      setName('');
      setDescription('');
    }
  }, [area, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
    });
  };

  return (
    <div className="prop-drawer-backdrop" onClick={onClose}>
      <dialog
        open
        className="prop-dialog"
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="area-modal-title"
      >
        <div className="prop-dialog-header">
          <h2 id="area-modal-title">{area ? 'Cập nhật khu vực' : 'Thêm khu vực mới'}</h2>
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

            <div className="prop-field">
              <label htmlFor="area-name">Tên khu vực (*)</label>
              <input
                id="area-name"
                className="prop-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Khu vực Quận 9, Khu phức hợp Sala..."
                required
                disabled={isPending}
                autoFocus
              />
              {fieldErrors.name && <p className="prop-field-error">{fieldErrors.name}</p>}
            </div>

            <div className="prop-field">
              <label htmlFor="area-desc">Mô tả khu vực (tùy chọn)</label>
              <textarea
                id="area-desc"
                className="prop-input"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Nhập mô tả vị trí hoặc ghi chú đặc trưng của khu vực..."
                disabled={isPending}
              />
              {fieldErrors.description && <p className="prop-field-error">{fieldErrors.description}</p>}
            </div>
          </div>

          <div className="prop-dialog-footer">
            <button type="button" className="prop-btn" onClick={onClose} disabled={isPending}>
              Hủy
            </button>
            <button type="submit" className="prop-btn prop-btn--primary" disabled={isPending || !name.trim()}>
              {isPending ? 'Đang lưu...' : area ? 'Lưu thay đổi' : 'Thêm khu vực'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
};

// ==========================================
// 2. Modal Xác nhận Ngừng hoạt động Khu vực (UC10)
// ==========================================
interface AreaDeactivateModalProps {
  isOpen: boolean;
  area: Area | null;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const AreaDeactivateModal: React.FC<AreaDeactivateModalProps> = ({
  isOpen,
  area,
  isPending,
  error,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !area) return null;

  return (
    <div className="prop-drawer-backdrop" onClick={onClose}>
      <dialog
        open
        className="prop-dialog"
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="area-deactivate-title"
      >
        <div className="prop-dialog-header">
          <h2 id="area-deactivate-title">Xác nhận ngừng hoạt động khu vực</h2>
          <button type="button" className="prop-btn prop-btn--outline prop-btn--sm" onClick={onClose} disabled={isPending}>
            ✕
          </button>
        </div>

        <div className="prop-dialog-body">
          {error && (
            <div className="prop-banner prop-banner--error" role="alert">
              <p>{error}</p>
            </div>
          )}
          <p>
            Bạn có chắc chắn muốn ngừng hoạt động khu vực <strong>{area.name}</strong> không?
          </p>
          <div className="prop-banner prop-banner--warn">
            <p>
              <strong>Lưu ý:</strong> Khi ngừng hoạt động khu vực, các tòa nhà hiện tại vẫn được giữ nguyên trạng thái,
              nhưng bạn sẽ không thể tạo thêm tòa nhà mới thuộc khu vực này.
            </p>
          </div>
        </div>

        <div className="prop-dialog-footer">
          <button type="button" className="prop-btn" onClick={onClose} disabled={isPending}>
            Hủy
          </button>
          <button
            type="button"
            className="prop-btn prop-btn--danger"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Đang xử lý...' : 'Xác nhận ngừng hoạt động'}
          </button>
        </div>
      </dialog>
    </div>
  );
};

// ==========================================
// 3. Modal Tạo / Sửa Tòa nhà (UC11, UC12)
// ==========================================
interface BuildingModalProps {
  isOpen: boolean;
  building: Building | null; // null = create mode
  activeAreas: Area[];
  isPending: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
  onClose: () => void;
  onSubmit: (input: CreateBuildingInput | UpdateBuildingInput) => void;
}

export const BuildingModal: React.FC<BuildingModalProps> = ({
  isOpen,
  building,
  activeAreas,
  isPending,
  error,
  fieldErrors,
  onClose,
  onSubmit,
}) => {
  const [areaId, setAreaId] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (building) {
      setAreaId(building.areaId);
      setName(building.name);
      setAddress(building.address);
    } else {
      setAreaId(activeAreas[0]?.id || '');
      setName('');
      setAddress('');
    }
  }, [building, activeAreas, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (building) {
      onSubmit({ name: name.trim(), address: address.trim() });
    } else {
      onSubmit({ areaId, name: name.trim(), address: address.trim() });
    }
  };

  return (
    <div className="prop-drawer-backdrop" onClick={onClose}>
      <dialog
        open
        className="prop-dialog"
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="building-modal-title"
      >
        <div className="prop-dialog-header">
          <h2 id="building-modal-title">{building ? 'Cập nhật thông tin tòa nhà' : 'Tạo tòa nhà mới'}</h2>
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

            {!building && (
              <div className="prop-field">
                <label htmlFor="building-area">Khu vực trực thuộc (*)</label>
                {activeAreas.length === 0 ? (
                  <div className="prop-banner prop-banner--warn">
                    <p>Chưa có khu vực đang hoạt động nào. Vui lòng kích hoạt hoặc tạo khu vực mới trước.</p>
                  </div>
                ) : (
                  <select
                    id="building-area"
                    className="prop-select"
                    value={areaId}
                    onChange={(e) => setAreaId(e.target.value)}
                    required
                    disabled={isPending}
                  >
                    <option value="">-- Chọn khu vực hoạt động --</option>
                    {activeAreas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
                {fieldErrors.areaId && <p className="prop-field-error">{fieldErrors.areaId}</p>}
              </div>
            )}

            <div className="prop-field">
              <label htmlFor="building-name">Tên tòa nhà (*)</label>
              <input
                id="building-name"
                className="prop-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Tòa tháp Landmark A Premium..."
                required
                disabled={isPending}
                autoFocus
              />
              {fieldErrors.name && <p className="prop-field-error">{fieldErrors.name}</p>}
            </div>

            <div className="prop-field">
              <label htmlFor="building-addr">Địa chỉ tòa nhà (*)</label>
              <input
                id="building-addr"
                className="prop-input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="VD: 123 Đường Võ Văn Ngân, TP. Thủ Đức..."
                required
                disabled={isPending}
              />
              {fieldErrors.address && <p className="prop-field-error">{fieldErrors.address}</p>}
            </div>
          </div>

          <div className="prop-dialog-footer">
            <button type="button" className="prop-btn" onClick={onClose} disabled={isPending}>
              Hủy
            </button>
            <button
              type="submit"
              className="prop-btn prop-btn--primary"
              disabled={isPending || !name.trim() || !address.trim() || (!building && !areaId)}
            >
              {isPending ? 'Đang lưu...' : building ? 'Lưu thay đổi' : 'Tạo tòa nhà'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
};

// ==========================================
// 4. Modal Chuyển Khu vực Trực thuộc (UC12 Luồng A)
// ==========================================
interface ChangeBuildingAreaModalProps {
  isOpen: boolean;
  building: Building | null;
  activeAreas: Area[];
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: ChangeBuildingAreaInput) => void;
}

export const ChangeBuildingAreaModal: React.FC<ChangeBuildingAreaModalProps> = ({
  isOpen,
  building,
  activeAreas,
  isPending,
  error,
  onClose,
  onSubmit,
}) => {
  const [targetAreaId, setTargetAreaId] = useState('');

  // Lọc ra các khu vực khác khu vực hiện tại
  const availableAreas = activeAreas.filter((a) => a.id !== building?.areaId && a.active);

  useEffect(() => {
    setTargetAreaId(availableAreas[0]?.id || '');
  }, [building, activeAreas, isOpen]);

  if (!isOpen || !building) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetAreaId) {
      onSubmit({ targetAreaId });
    }
  };

  return (
    <div className="prop-drawer-backdrop" onClick={onClose}>
      <dialog
        open
        className="prop-dialog"
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="change-area-title"
      >
        <div className="prop-dialog-header">
          <h2 id="change-area-title">Chuyển khu vực trực thuộc</h2>
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

            <p>
              Tòa nhà đang chọn: <strong>{building.name}</strong>
            </p>
            <p>
              Khu vực hiện tại: <span className="prop-badge prop-badge--active">{building.areaName}</span>
            </p>

            <div className="prop-field" style={{ marginTop: '16px' }}>
              <label htmlFor="target-area">Khu vực chuyển đến (*)</label>
              {availableAreas.length === 0 ? (
                <div className="prop-banner prop-banner--warn">
                  <p>Không có khu vực nào khác đang hoạt động để chuyển đến.</p>
                </div>
              ) : (
                <select
                  id="target-area"
                  className="prop-select"
                  value={targetAreaId}
                  onChange={(e) => setTargetAreaId(e.target.value)}
                  required
                  disabled={isPending}
                >
                  <option value="">-- Chọn khu vực đích --</option>
                  {availableAreas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="prop-dialog-footer">
            <button type="button" className="prop-btn" onClick={onClose} disabled={isPending}>
              Hủy
            </button>
            <button
              type="submit"
              className="prop-btn prop-btn--primary"
              disabled={isPending || !targetAreaId || availableAreas.length === 0}
            >
              {isPending ? 'Đang chuyển...' : 'Xác nhận chuyển khu vực'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
};

// ==========================================
// 5. Modal Xác nhận Ngừng hoạt động Tòa nhà (UC12)
// ==========================================
interface BuildingDeactivateModalProps {
  isOpen: boolean;
  building: Building | null;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const BuildingDeactivateModal: React.FC<BuildingDeactivateModalProps> = ({
  isOpen,
  building,
  isPending,
  error,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !building) return null;

  return (
    <div className="prop-drawer-backdrop" onClick={onClose}>
      <dialog
        open
        className="prop-dialog"
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="building-deactivate-title"
      >
        <div className="prop-dialog-header">
          <h2 id="building-deactivate-title">Xác nhận ngừng hoạt động tòa nhà</h2>
          <button type="button" className="prop-btn prop-btn--outline prop-btn--sm" onClick={onClose} disabled={isPending}>
            ✕
          </button>
        </div>

        <div className="prop-dialog-body">
          {error && (
            <div className="prop-banner prop-banner--error" role="alert">
              <p>{error}</p>
            </div>
          )}
          <p>
            Bạn có chắc chắn muốn ngừng hoạt động tòa nhà <strong>{building.name}</strong> không?
          </p>
          <div className="prop-banner prop-banner--warn">
            <p>
              <strong>Lưu ý:</strong> Khi tòa nhà ngừng hoạt động, dữ liệu về tầng, phòng và các hợp đồng vẫn được bảo toàn
              để tra cứu lịch sử.
            </p>
          </div>
        </div>

        <div className="prop-dialog-footer">
          <button type="button" className="prop-btn" onClick={onClose} disabled={isPending}>
            Hủy
          </button>
          <button
            type="button"
            className="prop-btn prop-btn--danger"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Đang xử lý...' : 'Xác nhận ngừng hoạt động'}
          </button>
        </div>
      </dialog>
    </div>
  );
};

