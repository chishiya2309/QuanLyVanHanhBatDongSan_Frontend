import React, { useEffect, useId, useRef, useState } from 'react';
import type { CreateCustomerInput, CustomerFieldErrors, CustomerFields, CustomerResponse, UpdateCustomerInput } from '../../types/customer';
import { validateCustomerForm } from '../../utils/customerValidation';

type CustomerFormDialogProps =
  | {
      action: 'create';
      customer?: null;
      pending: boolean;
      serverFieldErrors: CustomerFieldErrors;
      onClose: () => void;
      onSubmit: (input: CreateCustomerInput) => Promise<boolean>;
    }
  | {
      action: 'edit';
      customer: CustomerResponse;
      pending: boolean;
      serverFieldErrors: CustomerFieldErrors;
      onClose: () => void;
      onSubmit: (input: UpdateCustomerInput) => Promise<boolean>;
    };

export const CustomerFormDialog: React.FC<CustomerFormDialogProps> = (props) => {
  const { action, customer, pending, serverFieldErrors, onClose } = props;
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const isEdit = action === 'edit';

  const [fields, setFields] = useState<CustomerFields>({
    fullName: customer?.fullName || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    identityType: customer?.identityType || '',
    identityNo: customer?.identityNo || '',
    birthDate: customer?.birthDate || '',
    address: customer?.address || '',
    note: customer?.note || '',
  });

  const [localErrors, setLocalErrors] = useState<CustomerFieldErrors>({});
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
    if (errors[name as keyof CustomerFieldErrors]) {
      setLocalErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateCustomerForm(fields);
    if (Object.keys(validationErrors).length > 0) {
      setLocalErrors(validationErrors);
      const firstErrorField = Object.keys(validationErrors)[0];
      document.getElementById(`customer-${firstErrorField}`)?.focus();
      return;
    }

    setLocalErrors({});
    if (props.action === 'edit' && props.customer) {
      await props.onSubmit({
        fullName: fields.fullName,
        phone: fields.phone,
        email: fields.email,
        identityType: fields.identityType || null,
        identityNo: fields.identityNo,
        birthDate: fields.birthDate || null,
        address: fields.address,
        note: fields.note,
        version: props.customer.version,
      });
    } else if (props.action === 'create') {
      await props.onSubmit({
        fullName: fields.fullName,
        phone: fields.phone,
        email: fields.email,
        identityType: fields.identityType || null,
        identityNo: fields.identityNo,
        birthDate: fields.birthDate || null,
        address: fields.address,
        note: fields.note,
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
        <h2 id={titleId}>{isEdit ? 'Chỉnh sửa hồ sơ khách thuê' : 'Thêm khách thuê mới'}</h2>
        <p>Hồ sơ khách thuê đại diện có thể lưu độc lập với tài khoản đăng nhập, phòng và hợp đồng.</p>

        <fieldset disabled={pending}>
          <div className="customer-field">
            <label htmlFor="customer-fullName">
              Họ và tên <span aria-hidden="true" style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              id="customer-fullName"
              name="fullName"
              type="text"
              required
              value={fields.fullName}
              onChange={handleChange}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? 'customer-fullName-error' : undefined}
            />
            {errors.fullName && (
              <p id="customer-fullName-error" className="customer-field-error" role="alert">
                {errors.fullName}
              </p>
            )}
          </div>

          <div className="customer-field">
            <label htmlFor="customer-phone">Số điện thoại</label>
            <input
              id="customer-phone"
              name="phone"
              type="tel"
              value={fields.phone}
              onChange={handleChange}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'customer-phone-error' : undefined}
            />
            {errors.phone && (
              <p id="customer-phone-error" className="customer-field-error" role="alert">
                {errors.phone}
              </p>
            )}
          </div>

          <div className="customer-field">
            <label htmlFor="customer-email">Email</label>
            <input
              id="customer-email"
              name="email"
              type="email"
              value={fields.email}
              onChange={handleChange}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'customer-email-error' : undefined}
            />
            {errors.email && (
              <p id="customer-email-error" className="customer-field-error" role="alert">
                {errors.email}
              </p>
            )}
          </div>

          <div className="customer-field">
            <label htmlFor="customer-identityType">Loại giấy tờ tùy thân</label>
            <select
              id="customer-identityType"
              name="identityType"
              value={fields.identityType}
              onChange={handleChange}
              aria-invalid={Boolean(errors.identityType)}
              aria-describedby={errors.identityType ? 'customer-identityType-error' : undefined}
            >
              <option value="">-- Không khai báo --</option>
              <option value="CCCD">CCCD</option>
              <option value="PASSPORT">Hộ chiếu</option>
            </select>
            {errors.identityType && (
              <p id="customer-identityType-error" className="customer-field-error" role="alert">
                {errors.identityType}
              </p>
            )}
          </div>

          <div className="customer-field">
            <label htmlFor="customer-identityNo">Số giấy tờ</label>
            <input
              id="customer-identityNo"
              name="identityNo"
              type="text"
              value={fields.identityNo}
              onChange={handleChange}
              aria-invalid={Boolean(errors.identityNo)}
              aria-describedby={errors.identityNo ? 'customer-identityNo-error' : undefined}
            />
            {errors.identityNo && (
              <p id="customer-identityNo-error" className="customer-field-error" role="alert">
                {errors.identityNo}
              </p>
            )}
          </div>

          <div className="customer-field">
            <label htmlFor="customer-birthDate">Ngày sinh</label>
            <input
              id="customer-birthDate"
              name="birthDate"
              type="date"
              value={fields.birthDate}
              onChange={handleChange}
              aria-invalid={Boolean(errors.birthDate)}
              aria-describedby={errors.birthDate ? 'customer-birthDate-error' : undefined}
            />
            {errors.birthDate && (
              <p id="customer-birthDate-error" className="customer-field-error" role="alert">
                {errors.birthDate}
              </p>
            )}
          </div>

          <div className="customer-field">
            <label htmlFor="customer-address">Địa chỉ liên hệ</label>
            <input
              id="customer-address"
              name="address"
              type="text"
              value={fields.address}
              onChange={handleChange}
              aria-invalid={Boolean(errors.address)}
              aria-describedby={errors.address ? 'customer-address-error' : undefined}
            />
            {errors.address && (
              <p id="customer-address-error" className="customer-field-error" role="alert">
                {errors.address}
              </p>
            )}
          </div>

          <div className="customer-field">
            <label htmlFor="customer-note">Ghi chú</label>
            <textarea
              id="customer-note"
              name="note"
              rows={3}
              value={fields.note}
              onChange={handleChange}
              aria-invalid={Boolean(errors.note)}
              aria-describedby={errors.note ? 'customer-note-error' : undefined}
            />
            {errors.note && (
              <p id="customer-note-error" className="customer-field-error" role="alert">
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
            {pending ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Tạo hồ sơ'}
          </button>
        </div>
      </form>
    </dialog>
  );
};
