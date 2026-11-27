import React, { useEffect, useRef } from 'react';
import { money } from '../reports/financePresentation';
import { useManualCashForm } from '../../hooks/useManualCashForm';
import type { ManualCashConfirmation, ManualPaymentMethod } from '../../types/cashLedger';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (confirmation: ManualCashConfirmation) => void;
  onSessionExpired: (message?: string) => void;
}

const METHOD_LABELS: Record<ManualPaymentMethod, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản ngân hàng',
  PAYOS: 'PayOS',
  OTHER: 'Khác',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ManualCashDrawer: React.FC<Props> = ({
  open,
  onClose,
  onSuccess,
  onSessionExpired,
}) => {
  const form = useManualCashForm(open, onClose, onSuccess, onSessionExpired);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (form.overdraftWarning) {
          form.setOverdraftWarning(null);
        } else {
          form.cancelAndClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, form]);

  if (!open) return null;

  const parsedAmount = Number(form.amountInput.replaceAll(',', '').trim());
  const previewMoney =
    Number.isFinite(parsedAmount) && parsedAmount > 0 ? money(BigInt(Math.round(parsedAmount))) : null;

  const maxDateTime = (() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  return (
    <div
      className="cl-drawer-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) form.cancelAndClose();
      }}
    >
      <aside
        className="cl-drawer cl-manual-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cl-manual-drawer-title"
      >
        <header className="cl-drawer-header">
          <div>
            <h2 id="cl-manual-drawer-title" className="cl-drawer-title">
              Thêm giao dịch thu chi thủ công
            </h2>
            <p className="cl-drawer-subtitle">
              Ghi nhận khoản thu hoặc chi ngoài luồng hóa đơn vào sổ quỹ.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="cl-drawer-close"
            onClick={form.cancelAndClose}
            aria-label="Đóng biểu mẫu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="cl-drawer-body">
          {form.initLoading && <p className="cl-muted-note">Đang tải danh mục và nguồn tiền...</p>}

          {form.initError && (
            <div className="cl-alert is-error" role="alert">
              {form.initError}
            </div>
          )}

          {!form.initLoading && !form.initError && (
            <form
              className="cl-manual-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void form.submit(false);
              }}
            >
              {/* Direction segmented toggle */}
              <div className="cl-field">
                <span className="cl-label">Hướng dòng tiền</span>
                <div className="cl-segmented" role="group" aria-label="Hướng dòng tiền">
                  <button
                    type="button"
                    className={`cl-segment-btn ${form.direction === 'OUT' ? 'is-active is-out' : ''}`}
                    onClick={() => form.setDirection('OUT')}
                  >
                    Chi tiền
                  </button>
                  <button
                    type="button"
                    className={`cl-segment-btn ${form.direction === 'IN' ? 'is-active is-in' : ''}`}
                    onClick={() => form.setDirection('IN')}
                  >
                    Thu tiền
                  </button>
                </div>
              </div>

              {/* Category + Profit inheritance badge */}
              <div className="cl-field">
                <label htmlFor="manual-category" className="cl-label">
                  Danh mục thu chi
                </label>
                <select
                  id="manual-category"
                  className={`cl-select ${form.fieldErrors.category ? 'is-invalid' : ''}`}
                  value={form.category}
                  onChange={(e) => form.setCategory(e.target.value)}
                >
                  <option value="">-- Chọn danh mục --</option>
                  {form.filteredCategories.map((cat) => (
                    <option key={cat.code} value={cat.code}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {form.selectedCategory && (
                  <p className={`cl-profit-hint ${form.selectedCategory.affectsProfit ? 'is-included' : 'is-excluded'}`}>
                    {form.selectedCategory.affectsProfit
                      ? 'Có tính vào lợi nhuận kinh doanh'
                      : 'Không tính vào lợi nhuận kinh doanh'}
                  </p>
                )}
                {form.fieldErrors.category && (
                  <p className="cl-field-error" role="alert">
                    {form.fieldErrors.category}
                  </p>
                )}
              </div>

              {/* Amount + OccurredAt */}
              <div className="cl-manual-row">
                <div className="cl-field">
                  <label htmlFor="manual-amount" className="cl-label">
                    Số tiền (VND)
                  </label>
                  <input
                    id="manual-amount"
                    type="number"
                    min="1"
                    step="1000"
                    inputMode="numeric"
                    placeholder="Ví dụ: 350000"
                    className={`cl-input cl-mono ${form.fieldErrors.amount ? 'is-invalid' : ''}`}
                    value={form.amountInput}
                    onChange={(e) => form.setAmountInput(e.target.value)}
                  />
                  {previewMoney && <p className="cl-muted-note">Hiển thị: {previewMoney}</p>}
                  {form.fieldErrors.amount && (
                    <p className="cl-field-error" role="alert">
                      {form.fieldErrors.amount}
                    </p>
                  )}
                </div>

                <div className="cl-field">
                  <label htmlFor="manual-occurred-at" className="cl-label">
                    Ngày giờ phát sinh thực tế
                  </label>
                  <input
                    id="manual-occurred-at"
                    type="datetime-local"
                    max={maxDateTime}
                    className={`cl-input ${form.fieldErrors.occurredAt ? 'is-invalid' : ''}`}
                    value={form.occurredAt}
                    onChange={(e) => form.setOccurredAt(e.target.value)}
                  />
                  {form.fieldErrors.occurredAt && (
                    <p className="cl-field-error" role="alert">
                      {form.fieldErrors.occurredAt}
                    </p>
                  )}
                </div>
              </div>

              {/* Funding source + Payment method */}
              <div className="cl-manual-row">
                <div className="cl-field">
                  <label htmlFor="manual-source" className="cl-label">
                    Nguồn tiền thanh toán
                  </label>
                  <select
                    id="manual-source"
                    className={`cl-select ${form.fieldErrors.sourceId ? 'is-invalid' : ''}`}
                    value={form.sourceId}
                    onChange={(e) => form.setSourceId(e.target.value)}
                  >
                    <option value="">-- Chọn nguồn tiền --</option>
                    {form.fundingSources.map((src) => (
                      <option key={src.id} value={src.id}>
                        {src.name} ({src.type === 'CASH' ? 'Tiền mặt' : 'Ngân hàng'})
                      </option>
                    ))}
                  </select>
                  {form.selectedSource && (
                    <p className="cl-muted-note">
                      Số dư khả dụng: <strong className="cl-mono">{money(form.selectedSource.availableBalance)}</strong>
                    </p>
                  )}
                  {form.fieldErrors.sourceId && (
                    <p className="cl-field-error" role="alert">
                      {form.fieldErrors.sourceId}
                    </p>
                  )}
                </div>

                <div className="cl-field">
                  <label htmlFor="manual-method" className="cl-label">
                    Phương thức thanh toán
                  </label>
                  <select
                    id="manual-method"
                    className="cl-select"
                    value={form.method}
                    onChange={(e) => form.setMethod(e.target.value as ManualPaymentMethod)}
                  >
                    {form.compatibleMethods.map((m) => (
                      <option key={m} value={m}>
                        {METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Property Scope */}
              <fieldset className="cl-scope-fieldset">
                <legend className="cl-label">Phạm vi bất động sản liên kết (tùy chọn)</legend>
                <p className="cl-muted-note">
                  Để trống toàn bộ nếu đây là chi phí/thu nhập quản lý chung của Host.
                </p>
                <div className="cl-scope-grid">
                  <select
                    aria-label="Khu vực"
                    className="cl-select"
                    value={form.areaId}
                    onChange={(e) => form.setAreaId(e.target.value)}
                  >
                    <option value="">Toàn hệ thống (Chi phí chung)</option>
                    {form.areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Tòa nhà"
                    className="cl-select"
                    value={form.buildingId}
                    disabled={!form.areaId}
                    onChange={(e) => form.setBuildingId(e.target.value)}
                  >
                    <option value="">-- Tất cả tòa nhà trong khu vực --</option>
                    {form.buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Phòng"
                    className="cl-select"
                    value={form.roomId}
                    disabled={!form.buildingId}
                    onChange={(e) => form.setRoomId(e.target.value)}
                  >
                    <option value="">-- Toàn tòa nhà --</option>
                    {form.rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} - {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </fieldset>

              {/* Note */}
              <div className="cl-field">
                <label htmlFor="manual-note" className="cl-label">
                  Ghi chú nội dung
                </label>
                <textarea
                  id="manual-note"
                  rows={2}
                  maxLength={500}
                  className="cl-textarea"
                  placeholder="Ví dụ: Thay thế vòi sen và sửa khóa cửa phòng"
                  value={form.note}
                  onChange={(e) => form.setNote(e.target.value)}
                />
              </div>

              {/* Attachments */}
              <div className="cl-field">
                <span className="cl-label">Chứng từ đính kèm (JPEG, PNG, PDF dưới 10 MB)</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  className="cl-sr-only"
                  onChange={(e) => {
                    if (e.target.files) {
                      void form.uploadFiles(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  className="cl-dropzone"
                  disabled={form.uploadingFiles}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M10 13V4M10 4L6.5 7.5M10 4L13.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 13.5V15C4 15.8284 4.67157 16.5 5.5 16.5H14.5C15.3284 16.5 16 15.8284 16 15V13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span>
                    {form.uploadingFiles ? 'Đang tải chứng từ...' : 'Chọn tệp ảnh hoặc PDF từ thiết bị'}
                  </span>
                </button>

                {form.fieldErrors.attachments && (
                  <p className="cl-field-error" role="alert">
                    {form.fieldErrors.attachments}
                  </p>
                )}

                {form.attachments.length > 0 && (
                  <div className="cl-attachments-grid">
                    {form.attachments.map((att) => (
                      <div key={att.tempId} className="cl-attachment-item">
                        {att.objectUrl ? (
                          <img src={att.objectUrl} alt={att.fileName} className="cl-attachment-thumb" />
                        ) : (
                          <div className="cl-attachment-pdf" aria-hidden="true">
                            PDF
                          </div>
                        )}
                        <span className="cl-attachment-name" title={att.fileName}>
                          {att.fileName}
                        </span>
                        <div className="cl-attachment-meta">
                          <span className="cl-muted-note">{formatFileSize(att.fileSize)}</span>
                          <button
                            type="button"
                            className="cl-remove-file-btn"
                            onClick={() => form.removeAttachment(att.tempId)}
                            aria-label={`Xóa tệp ${att.fileName}`}
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {form.submitError && (
                <div className="cl-alert is-error" role="alert">
                  {form.submitError}
                </div>
              )}

              <footer className="cl-manual-footer">
                <button
                  type="button"
                  className="cl-btn cl-btn-secondary"
                  onClick={form.cancelAndClose}
                  disabled={form.submitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="cl-btn cl-btn-primary"
                  disabled={form.submitting || form.uploadingFiles}
                >
                  {form.submitting ? 'Đang lưu...' : 'Lưu giao dịch'}
                </button>
              </footer>
            </form>
          )}
        </div>

        {/* Overdraft confirmation modal (7a) */}
        {form.overdraftWarning && (
          <div className="cl-overdraft-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="cl-overdraft-title">
            <div className="cl-overdraft-dialog">
              <h3 id="cl-overdraft-title" className="cl-overdraft-title">
                Cảnh báo chi vượt số dư nguồn tiền
              </h3>
              <p className="cl-overdraft-message">{form.overdraftWarning}</p>
              <div className="cl-overdraft-actions">
                <button
                  type="button"
                  className="cl-btn cl-btn-secondary"
                  onClick={() => form.setOverdraftWarning(null)}
                  disabled={form.submitting}
                >
                  Quay lại điều chỉnh
                </button>
                <button
                  type="button"
                  className="cl-btn cl-btn-primary"
                  onClick={() => void form.submit(true)}
                  disabled={form.submitting}
                >
                  {form.submitting ? 'Đang ghi nhận...' : 'Xác nhận tiếp tục'}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
