import React, { useState, useEffect } from 'react';
import type { Floor, CreateFloorInput, UpdateFloorInput } from '../../types/properties';

interface FloorModalProps {
  isOpen: boolean;
  buildingId: string;
  floor: Floor | null; // null = create mode
  isPending: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
  onClose: () => void;
  onSubmit: (input: CreateFloorInput | UpdateFloorInput) => void;
}

export const FloorModal: React.FC<FloorModalProps> = ({
  isOpen,
  floor,
  isPending,
  error,
  fieldErrors,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [level, setLevel] = useState<number | ''>(1);

  useEffect(() => {
    if (floor) {
      setName(floor.name);
      setLevel(floor.level);
    } else {
      setName('');
      setLevel(1);
    }
  }, [floor, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (level === '') return;
    onSubmit({
      name: name.trim(),
      level: Number(level),
    });
  };

  return (
    <div className="prop-drawer-backdrop" onClick={onClose}>
      <dialog
        open
        className="prop-dialog"
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="floor-modal-title"
      >
        <div className="prop-dialog-header">
          <h2 id="floor-modal-title">{floor ? 'Cập nhật tầng' : 'Thêm tầng mới'}</h2>
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
              <label htmlFor="floor-name">Tên tầng (*)</label>
              <input
                id="floor-name"
                className="prop-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Tầng Trệt, Tầng 1, Tầng Lửng..."
                required
                disabled={isPending}
                autoFocus
              />
              {fieldErrors.name && <p className="prop-field-error">{fieldErrors.name}</p>}
            </div>

            <div className="prop-field">
              <label htmlFor="floor-level">Cấp tầng (Level số nguyên) (*)</label>
              <input
                id="floor-level"
                type="number"
                className="prop-input"
                value={level}
                onChange={(e) => setLevel(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="VD: -1 (Hầm), 1, 2, 3..."
                required
                disabled={isPending}
              />
              <p className="prop-help">Cấp tầng dùng để sắp xếp thứ tự hiển thị trong tòa nhà.</p>
              {fieldErrors.level && <p className="prop-field-error">{fieldErrors.level}</p>}
            </div>
          </div>

          <div className="prop-dialog-footer">
            <button type="button" className="prop-btn" onClick={onClose} disabled={isPending}>
              Hủy
            </button>
            <button
              type="submit"
              className="prop-btn prop-btn--primary"
              disabled={isPending || !name.trim() || level === ''}
            >
              {isPending ? 'Đang lưu...' : floor ? 'Lưu thay đổi' : 'Thêm tầng'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
};

