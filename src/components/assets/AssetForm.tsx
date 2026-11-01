import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { assetMessages as m, assetStates, type Asset, type AssetFieldErrors, type CreateAssetInput, type RecordConditionInput, type UpdateAssetInput } from '../../types/assets';
import { isAssetState, normalizeMoney, validateAssetFields } from '../../utils/assetValidation';
import { ConditionBadge } from './AssetControls';

interface FormError { message: string; fields: AssetFieldErrors }
type FormProps = { pending: boolean; enabled: boolean; error: FormError | null; onCancel: () => void } & (
  { mode: 'create'; asset?: never; onSave: (input: CreateAssetInput) => void } |
  { mode: 'edit'; asset: Asset; onSave: (input: UpdateAssetInput) => void } |
  { mode: 'condition'; asset: Asset; onSave: (input: RecordConditionInput) => void }
);
export function AssetForm(props: FormProps) {
  const { pending, enabled, mode, error } = props;
  const [name, setName] = useState(props.asset?.name || '');
  const [value, setValue] = useState(props.asset?.purchaseValue ?? '');
  const [note, setNote] = useState(mode === 'edit' ? props.asset.note || '' : '');
  const [condition, setCondition] = useState('');
  const [localErrors, setLocalErrors] = useState<AssetFieldErrors>({});
  const form = useRef<HTMLFormElement>(null);
  const errors = { ...localErrors, ...error?.fields };
  useEffect(() => { if (!pending && (error || Object.keys(localErrors).length)) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [error, localErrors, pending]);
  const fieldError = (field: keyof AssetFieldErrors) => errors[field] ? <p className="asset-field-error" id={'asset-' + field + '-error'}>{errors[field]}</p> : null;
  return <form ref={form} className="asset-form" noValidate onSubmit={(event) => {
    event.preventDefault(); if (pending || !enabled) return;
    const fields: AssetFieldErrors = mode === 'condition' ? {
      ...(!isAssetState(condition) ? { condition: m.conditionInvalid } : {}), ...(note.trim().length > 2000 ? { note: m.noteLong } : {}),
    } : validateAssetFields(name, value, mode === 'edit' ? note : undefined);
    setLocalErrors(fields);
    if (Object.keys(fields).length) return;
    if (mode === 'condition') { if (isAssetState(condition)) props.onSave({ condition, note: note.trim() || null }); }
    else {
      const purchaseValue = normalizeMoney(value); if (purchaseValue === null) return;
      if (props.mode === 'create') props.onSave({ name: name.trim(), purchaseValue });
      else if (props.mode === 'edit') props.onSave({ name: name.trim(), purchaseValue, note: note.trim() || null });
    }
  }}>
    {error && <div role="alert" className="asset-banner asset-banner--error"><p>{error.message}</p></div>}
    {Object.keys(localErrors).length > 0 && <p role="alert" className="asset-field-error">Vui lòng kiểm tra các trường được đánh dấu.</p>}
    {mode !== 'condition' ? <>
      <div className="asset-field"><label htmlFor="asset-name">Tên tài sản <span aria-hidden="true">*</span></label>
        <input id="asset-name" name="name" value={name} onChange={(event) => { setName(event.target.value); setLocalErrors({}); }} required disabled={pending} aria-invalid={!!errors.name} aria-describedby="asset-name-error" autoComplete="off" />{fieldError('name')}
      </div>
      <div className="asset-field"><label htmlFor="asset-purchaseValue">Giá trị tài sản (VND) <span aria-hidden="true">*</span></label>
        <input id="asset-purchaseValue" name="purchaseValue" type="text" inputMode="numeric" value={value} onChange={(event) => { setValue(event.target.value); setLocalErrors({}); }} required disabled={pending} aria-invalid={!!errors.purchaseValue} aria-describedby="asset-value-help asset-purchaseValue-error" autoComplete="off" />
        <p className="asset-help" id="asset-value-help">Nhập số nguyên từ 0 đến 9999999999999999999, không dấu phân cách, phần lẻ hoặc ký hiệu số mũ.</p>{fieldError('purchaseValue')}
      </div>
    </> : <div className="asset-field"><label htmlFor="asset-condition">Tình trạng ghi nhận <span aria-hidden="true">*</span></label>
      <select id="asset-condition" value={condition} onChange={(event) => { setCondition(event.target.value); setLocalErrors({}); }} required disabled={pending} aria-invalid={!!errors.condition} aria-describedby="asset-condition-error">
        <option value="">Chọn tình trạng</option>{Object.entries(assetStates).map(([state, label]) => <option key={state} value={state}>{label}</option>)}
      </select>{fieldError('condition')}
    </div>}
    {mode !== 'create' && <div className="asset-field"><label htmlFor="asset-note">{mode === 'edit' ? 'Ghi chú chung' : 'Ghi chú kiểm tra (tùy chọn)'}</label>
      <textarea id="asset-note" name="note" value={note} rows={5} onChange={(event) => { setNote(event.target.value); setLocalErrors({}); }} disabled={pending} aria-invalid={!!errors.note} aria-describedby="asset-note-help asset-note-error" />
      <p className="asset-help" id="asset-note-help">{mode === 'condition' ? 'Ghi chú này thuộc lần kiểm tra, không thay đổi ghi chú chung. ' : ''}Tối đa 2.000 ký tự.</p>{fieldError('note')}
    </div>}
    {mode === 'edit' && <div className="asset-readonly"><span>Tình trạng hiện tại</span><ConditionBadge condition={props.asset.condition} /><p className="asset-help">Thay đổi tình trạng bằng chức năng “Ghi nhận tình trạng”.</p></div>}
    <div className="asset-form-actions"><button type="submit" className="asset-button asset-button--primary" disabled={pending || !enabled}>{pending ? 'Đang lưu…' : mode === 'condition' ? 'Lưu ghi nhận' : 'Lưu'}</button>
      <button type="button" className="asset-button" onClick={props.onCancel} disabled={pending}>Hủy</button>
    </div>
  </form>;
}

export function CreateAssetDialog({ pending, enabled, error, onClose, onSave, opener, syncError, syncing, onRetry }: {
  pending: boolean; enabled: boolean; error: FormError | null; onClose: () => void; onSave: (input: CreateAssetInput) => void; opener: RefObject<HTMLElement | null>;
  syncError: string | null; syncing: boolean; onRetry: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const element = dialog.current;
    previousFocus.current = opener.current || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    element?.showModal(); element?.querySelector<HTMLInputElement>('#asset-name')?.focus();
    const overflow = document.body.style.overflowY; document.body.style.overflowY = 'hidden';
    return () => {
      element?.close(); document.body.style.overflowY = overflow;
      const target = previousFocus.current;
      if (target?.isConnected) target.focus(); else document.querySelector<HTMLElement>('[data-create-asset]')?.focus();
    };
  }, [opener]);
  return createPortal(<dialog ref={dialog} className="asset-dialog" aria-labelledby="asset-create-title" aria-busy={pending} onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}
    onClick={(event) => { if (!pending && event.target === dialog.current) { const rect = dialog.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}
    onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]') || []);
      if (!controls.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }}>
    <div className="asset-dialog-body"><h2 id="asset-create-title">Thêm tài sản</h2><p className="asset-help">Các trường có dấu * là bắt buộc.</p>
      {syncing && <p role="status">Đang tải danh sách tài sản để đồng bộ.</p>}
      {syncError && <div className="asset-banner asset-banner--error" role="alert"><p>{syncError}</p><button type="button" className="asset-button" onClick={onRetry}>Thử lại</button></div>}
      <AssetForm mode="create" pending={pending} enabled={enabled} error={error} onCancel={onClose} onSave={onSave} />
    </div>
  </dialog>, document.body);
}
