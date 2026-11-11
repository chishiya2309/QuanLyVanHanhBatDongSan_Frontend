import React, { useEffect, useId, useRef, useState } from 'react';
import {
  type CreateVehicleInput,
  type UpdateVehicleInput,
  type VehicleFieldErrors,
  type VehicleFields,
  type VehicleResponse,
  type VehicleType,
  vehicleTypeLabels,
} from '../../types/customer';
import { validateVehicleForm } from '../../utils/customerValidation';

type VehicleFormDialogProps =
  | {
      action: 'create';
      vehicle?: null;
      customerVersion: string;
      pending: boolean;
      serverFieldErrors: VehicleFieldErrors;
      onClose: () => void;
      onSubmit: (input: CreateVehicleInput) => Promise<boolean>;
    }
  | {
      action: 'edit';
      vehicle: VehicleResponse;
      customerVersion: string;
      pending: boolean;
      serverFieldErrors: VehicleFieldErrors;
      onClose: () => void;
      onSubmit: (input: UpdateVehicleInput) => Promise<boolean>;
    };

export const VehicleFormDialog: React.FC<VehicleFormDialogProps> = (props) => {
  const { action, vehicle, customerVersion, pending, serverFieldErrors, onClose } = props;
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const isEdit = action === 'edit';

  const [fields, setFields] = useState<VehicleFields>({
    type: vehicle?.type || 'MOTORBIKE',
    plateNumber: vehicle?.plateNumber || '',
    note: vehicle?.note || '',
  });

  const [localErrors, setLocalErrors] = useState<VehicleFieldErrors>({});
  const errors = { ...localErrors, ...serverFieldErrors };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      dialog.showModal();
    }
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof VehicleFieldErrors]) {
      setLocalErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleTypeSelect = (type: VehicleType) => {
    setFields((prev) => ({ ...prev, type }));
    if (errors.type) {
      setLocalErrors((prev) => ({ ...prev, type: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateVehicleForm(fields);
    if (Object.keys(validationErrors).length > 0) {
      setLocalErrors(validationErrors);
      const firstErrorField = Object.keys(validationErrors)[0];
      document.getElementById(`vehicle-${firstErrorField}`)?.focus();
      return;
    }

    setLocalErrors({});
    if (props.action === 'edit' && props.vehicle) {
      await props.onSubmit({
        type: fields.type as VehicleType,
        plateNumber: fields.plateNumber,
        note: fields.note,
        version: props.vehicle.version,
        customerVersion,
      });
    } else if (props.action === 'create') {
      await props.onSubmit({
        type: fields.type as VehicleType,
        plateNumber: fields.plateNumber,
        note: fields.note,
        customerVersion,
      });
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="customer-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <form onSubmit={handleSubmit} noValidate>
        <h2 id={titleId}>{isEdit ? 'Chỉnh sửa phương tiện' : 'Thêm phương tiện mới'}</h2>
        <p>Biển số xe là bắt buộc đối với tất cả các loại phương tiện, bao gồm cả Xe đạp.</p>

        <fieldset disabled={pending}>
          <div className="customer-field">
            <label id="vehicle-type-label">
              Loại phương tiện <span aria-hidden="true" style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <div className="customer-radio-group" role="radiogroup" aria-labelledby="vehicle-type-label">
              {(['MOTORBIKE', 'CAR', 'BICYCLE', 'OTHER'] as const).map((t) => (
                <label key={t} className="customer-radio-option">
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={fields.type === t}
                    onChange={() => handleTypeSelect(t)}
                  />
                  <span>{vehicleTypeLabels[t]}</span>
                </label>
              ))}
            </div>
            {errors.type && (
              <p className="customer-field-error" role="alert">
                {errors.type}
              </p>
            )}
          </div>

          <div className="customer-field">
            <label htmlFor="vehicle-plateNumber">
              Biển số xe <span aria-hidden="true" style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              id="vehicle-plateNumber"
              name="plateNumber"
              type="text"
              required
              placeholder="VD: 59A1-123.45 hoặc XD-01"
              value={fields.plateNumber}
              onChange={handleChange}
              aria-invalid={Boolean(errors.plateNumber)}
              aria-describedby={errors.plateNumber ? 'vehicle-plateNumber-error' : undefined}
            />
            {errors.plateNumber && (
              <p id="vehicle-plateNumber-error" className="customer-field-error" role="alert">
                {errors.plateNumber}
              </p>
            )}
          </div>

          <div className="customer-field">
            <label htmlFor="vehicle-note">Ghi chú</label>
            <textarea
              id="vehicle-note"
              name="note"
              rows={2}
              placeholder="Mô tả đặc điểm xe, màu sắc..."
              value={fields.note}
              onChange={handleChange}
              aria-invalid={Boolean(errors.note)}
              aria-describedby={errors.note ? 'vehicle-note-error' : undefined}
            />
            {errors.note && (
              <p id="vehicle-note-error" className="customer-field-error" role="alert">
                {errors.note}
              </p>
            )}
          </div>
        </fieldset>

        <div className="customer-dialog-actions">
          <button type="button" className="customer-button" onClick={onClose} disabled={pending}>
            Hủy
          </button>
          <button type="submit" className="customer-button customer-button--primary" disabled={pending}>
            {pending ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Thêm phương tiện'}
          </button>
        </div>
      </form>
    </dialog>
  );
};
