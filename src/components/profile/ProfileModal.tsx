import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ProfileController } from '../../hooks/useProfile';
import type { ProfileEditableField, ProfileFormErrors } from '../../types/profile';
import { profileBirthDate, profileIdentityType, profileRoleLabels } from '../../utils/profilePresentation';
import { ProfileAvatar } from './ProfileAvatar';
import './profile.css';

interface ProfileModalProps {
  isOpen: boolean;
  controller: ProfileController;
  onClose: () => void;
  onOpenChangePassword?: () => void;
  focusChangePassword?: boolean;
}

function Icon({ name }: { name: 'close' | 'lock' | 'edit' | 'upload' | 'alert' | 'check' }) {
  const paths = {
    close: <path d="m6 6 12 12M6 18 18 6" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    edit: <><path d="m16 3 5 5L9 20l-6 1 1-6L16 3ZM13 6l5 5" /></>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></>,
    alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 3v1" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function ReadField({ label, value, readOnly, wide }: { label: string; value?: ReactNode; readOnly?: boolean; wide?: boolean }) {
  return <div className={`profile-detail${wide ? ' profile-detail--wide' : ''}`}>
    <dt>{label}{readOnly && <span className="profile-readonly">Chỉ xem</span>}</dt>
    <dd>{value || <span className="profile-muted">Chưa cập nhật</span>}</dd>
  </div>;
}

function EditField({ field, label, value, required, type = 'text', autoComplete, errors, disabled, onChange }: {
  field: ProfileEditableField; label: string; value: string; required?: boolean; type?: 'text' | 'tel';
  autoComplete: string; errors: ProfileFormErrors; disabled: boolean; onChange: (field: ProfileEditableField, value: string) => void;
}) {
  const id = `profile-${field}`;
  return <div className="profile-field">
    <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
    <input id={id} name={field} className="profile-input" type={type} autoComplete={autoComplete}
      maxLength={field === 'fullName' || field === 'businessName' ? 255 : undefined}
      value={value} onChange={(event) => onChange(field, event.target.value)} required={required}
      aria-required={required || undefined} aria-invalid={!!errors[field]} aria-describedby={`${id}-help`} disabled={disabled} />
    <p className={`profile-help${errors[field] ? ' profile-help--error' : ''}`} id={`${id}-help`}>
      {errors[field] || (type === 'tel' ? 'Định dạng quốc tế, ví dụ +84901234567' : '')}
    </p>
  </div>;
}

export function ProfileModal({ isOpen, controller: c, onClose, onOpenChangePassword, focusChangePassword = false }: ProfileModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const wasEditing = useRef(false);
  const wasConfirming = useRef(false);
  const isSaving = c.status === 'saving';
  const profile = c.profile;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflowY;
    document.body.style.overflowY = 'hidden';
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>(focusChangePassword ? '#profile-change-password' : '.profile-icon-button')?.focus();
    return () => {
      dialog.close();
      document.body.style.overflowY = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [isOpen, focusChangePassword]);

  useEffect(() => {
    if (!isOpen) return;
    if (confirmDiscard) { wasConfirming.current = true; continueRef.current?.focus(); return; }
    if (c.isEditing && (!wasEditing.current || wasConfirming.current)) dialogRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
    else if (!c.isEditing && wasEditing.current) titleRef.current?.focus();
    wasEditing.current = c.isEditing;
    wasConfirming.current = false;
  }, [isOpen, c.isEditing, confirmDiscard]);

  useEffect(() => {
    if (!isOpen || confirmDiscard || isSaving) return;
    const order: (keyof ProfileFormErrors)[] = ['fullName', 'businessName', 'phoneNumber', 'officeAddress', 'logo'];
    const first = order.find((field) => c.fieldErrors[field]);
    const element = first ? dialogRef.current?.querySelector<HTMLElement>(`#profile-${first}`)
      : c.generalErrorMessage ? dialogRef.current?.querySelector<HTMLElement>('.profile-alert--error') : null;
    element?.focus();
    element?.scrollIntoView?.({ block: 'nearest' });
  }, [c.fieldErrors, c.generalErrorMessage, isOpen, confirmDiscard, isSaving]);

  if (!isOpen) return null;

  const finishClose = () => {
    setConfirmDiscard(false);
    c.cancelEditing();
    onClose();
  };
  const requestClose = () => {
    if (isSaving) return;
    if (c.isDirty) setConfirmDiscard(true);
    else finishClose();
  };
  const showContent = profile && !c.loadFailed && c.status !== 'loading';
  const name = profile?.role === 'HOST' ? profile.businessName : profile?.fullName || '';

  return createPortal(
    <dialog ref={dialogRef} className="profile-dialog" aria-labelledby="profile-title" aria-describedby="profile-description"
      aria-modal="true" onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          if (confirmDiscard) setConfirmDiscard(false); else requestClose();
          return;
        }
        if (event.key !== 'Tab') return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled):not([tabindex="-1"]), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
        )].filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); titleRef.current?.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) {
          event.preventDefault(); first.focus();
        }
      }} onCancel={(event) => {
        event.preventDefault();
        if (confirmDiscard) setConfirmDiscard(false); else requestClose();
      }} onClick={(event) => {
        if (event.target !== event.currentTarget || confirmDiscard) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) requestClose();
      }}>
      <header className="profile-header">
        <div className="profile-heading">
          <h2 id="profile-title" ref={titleRef} tabIndex={-1}>{confirmDiscard ? 'Bỏ thay đổi chưa lưu?' : 'Hồ sơ cá nhân'}</h2>
          <p id="profile-description">{confirmDiscard ? 'Thay đổi của bạn chưa được lưu vào hồ sơ.' : 'Thông tin tài khoản và liên hệ của bạn.'}</p>
        </div>
        {!confirmDiscard && <button type="button" className="profile-icon-button" onClick={requestClose} disabled={isSaving} aria-label="Đóng cửa sổ hồ sơ"><Icon name="close" /></button>}
      </header>

      {confirmDiscard ? <footer className="profile-footer profile-footer--confirm">
        <button ref={continueRef} type="button" className="profile-button profile-button--secondary" onClick={() => setConfirmDiscard(false)}>Tiếp tục chỉnh sửa</button>
        <button type="button" className="profile-button profile-button--primary" onClick={finishClose}>Bỏ thay đổi</button>
      </footer> : <form className="profile-form" noValidate onSubmit={(event) => { event.preventDefault(); void c.handleSubmit(); }} aria-busy={isSaving}>
        <div className="profile-body">
          {c.generalErrorMessage && <div className="profile-alert profile-alert--error" role="alert" tabIndex={-1}><Icon name="alert" /><span>{c.generalErrorMessage}</span></div>}
          {c.successMessage && <div className="profile-alert profile-alert--success" role="status"><Icon name="check" /><span>{c.successMessage}</span></div>}

          {(c.status === 'loading' || (c.status === 'idle' && !profile)) && <div className="profile-loading" role="status" aria-label="Đang tải hồ sơ">
            <div className="profile-skeleton profile-skeleton--identity" /><div className="profile-skeleton-grid">{[0, 1, 2, 3].map((item) => <div className="profile-skeleton" key={item} />)}</div>
            <span className="visually-hidden">Đang tải hồ sơ</span>
          </div>}

          {showContent && <>
            <div className="profile-identity">
              {profile.role !== 'CUSTOMER' && <ProfileAvatar name={name} src={profile.role === 'HOST' ? c.removeLogo ? null : c.logoPreviewUrl || profile.logoUrl : null}
                onImageError={c.logoPreviewUrl ? c.handleLogoPreviewError : undefined} />}
              <div className="profile-identity-copy"><span className="profile-role">{profileRoleLabels[profile.role]}</span>
                <p className="profile-identity-name">{name}</p>
                {profile.role === 'CUSTOMER' && <p className="profile-muted">Chế độ xem</p>}
              </div>
            </div>

            {c.isEditing && c.formData ? <>
              <p className="profile-required-note">Dấu * là thông tin bắt buộc.</p>
              <div className="profile-edit-grid">
                {c.formData.role === 'ADMIN' ? <EditField field="fullName" label="Họ và tên" value={c.formData.fullName} required autoComplete="name" errors={c.fieldErrors} disabled={isSaving} onChange={c.handleFieldChange} />
                  : <EditField field="businessName" label="Tên đơn vị quản lý" value={c.formData.businessName} required autoComplete="organization" errors={c.fieldErrors} disabled={isSaving} onChange={c.handleFieldChange} />}
                <EditField field="phoneNumber" label="Số điện thoại" value={c.formData.phoneNumber} required={c.formData.role === 'HOST'} type="tel" autoComplete="tel" errors={c.fieldErrors} disabled={isSaving} onChange={c.handleFieldChange} />
                <div className="profile-field profile-field--wide">
                  <label htmlFor="profile-email">Email <span className="profile-readonly">Chỉ xem</span></label>
                  <div className="profile-locked-input"><input className="profile-input" id="profile-email" type="email" autoComplete="email" value={profile.email} disabled aria-describedby="profile-email-help" /><Icon name="lock" /></div>
                  <p className="profile-help" id="profile-email-help">Email không được phép thay đổi</p>
                </div>
                {c.formData.role === 'HOST' && <div className="profile-field profile-field--wide">
                  <label htmlFor="profile-officeAddress">Địa chỉ văn phòng</label>
                  <textarea id="profile-officeAddress" name="officeAddress" className="profile-input profile-textarea" autoComplete="address-line1" value={c.formData.officeAddress} disabled={isSaving}
                    aria-invalid={!!c.fieldErrors.officeAddress} aria-describedby="profile-officeAddress-help" onChange={(event) => c.handleFieldChange('officeAddress', event.target.value)} />
                  <p className="profile-help profile-help--error" id="profile-officeAddress-help">{c.fieldErrors.officeAddress}</p>
                </div>}
              </div>
              {c.formData.role === 'HOST' && <section className="profile-logo-tools" aria-labelledby="profile-logo-title">
                <h3 id="profile-logo-title">Logo thương hiệu</h3>
                <p className="profile-logo-description">{c.removeLogo ? 'Logo sẽ được xóa khi bạn lưu thay đổi.' : c.logoFile ? c.logoFile.name : 'PNG, JPG tối đa 5 MiB'}</p>
                <div className="profile-logo-actions">
                  <input ref={fileRef} className="visually-hidden" id="profile-logo-file" type="file" accept="image/png,image/jpeg" tabIndex={-1} disabled={isSaving}
                    aria-label="Tệp logo thương hiệu" onChange={(event) => { const file = event.target.files?.[0]; if (file) c.handleLogoSelect(file); event.target.value = ''; }} />
                  <button id="profile-logo" type="button" className="profile-button profile-button--secondary" disabled={isSaving} aria-invalid={!!c.fieldErrors.logo} aria-describedby="profile-logo-help" onClick={() => fileRef.current?.click()}><Icon name="upload" />Chọn ảnh mới</button>
                  {(profile.role === 'HOST' && (profile.logoUrl || c.logoFile || c.removeLogo)) && <button type="button" className="profile-button profile-button--quiet" disabled={isSaving} aria-pressed={c.removeLogo} onClick={c.handleRemoveLogoToggle}>{c.removeLogo ? 'Hoàn tác xóa' : 'Xóa logo'}</button>}
                </div>
                <p id="profile-logo-help" className={`profile-help${c.fieldErrors.logo ? ' profile-help--error' : ''}`}>{c.fieldErrors.logo}</p>
              </section>}
            </> : <dl className="profile-details-grid">
              <ReadField label={profile.role === 'HOST' ? 'Tên đơn vị quản lý' : 'Họ và tên'} value={name} />
              <ReadField label="Số điện thoại" value={profile.phoneNumber} />
              <ReadField label="Email" value={profile.email} readOnly wide />
              {profile.role === 'HOST' && <ReadField label="Địa chỉ văn phòng" value={profile.officeAddress} wide />}
              {profile.role === 'CUSTOMER' && <>
                <ReadField label="Loại giấy tờ" value={profileIdentityType(profile.identityType)} />
                <ReadField label="Số giấy tờ" value={profile.identityNo} />
                <ReadField label="Ngày sinh" value={profileBirthDate(profile.birthDate)} />
                <ReadField label="Địa chỉ liên hệ" value={profile.address} wide />
              </>}
            </dl>}
          </>}
        </div>
        <footer className="profile-footer">
          {showContent && !c.isEditing && onOpenChangePassword && <button id="profile-change-password" type="button" className="profile-button profile-button--secondary" onClick={onOpenChangePassword}><Icon name="lock" />Đổi mật khẩu</button>}
          {c.loadFailed ? <button type="button" className="profile-button profile-button--primary" onClick={() => void c.fetchProfile()}>Thử lại</button>
            : showContent && (c.isEditing ? <>
              <button type="button" className="profile-button profile-button--secondary" onClick={c.cancelEditing} disabled={isSaving}>Hủy bỏ</button>
              <button type="submit" className="profile-button profile-button--primary" disabled={isSaving} aria-busy={isSaving}>{isSaving && <span className="profile-spinner" aria-hidden="true" />}{isSaving ? 'Đang lưu thay đổi' : 'Lưu thay đổi'}</button>
            </> : profile.role !== 'CUSTOMER' ? <button type="button" className="profile-button profile-button--primary" onClick={c.startEditing}><Icon name="edit" />Chỉnh sửa hồ sơ</button>
              : <button type="button" className="profile-button profile-button--secondary" onClick={finishClose}>Đóng hồ sơ</button>)}
        </footer>
      </form>}
    </dialog>, document.body,
  );
}
