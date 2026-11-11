import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useCatalogDialog } from '../../hooks/useCatalogDialog';
import type { NavigationGuardRegistration } from '../../hooks/useServiceCatalog';
import { catalogFilters, catalogMessages as m, chargeMethods, type CatalogAction, type CatalogFields, type CatalogNotice, type CatalogService } from '../../types/serviceCatalog';
import { catalogMoney, catalogState, formatCatalogMoney } from '../../utils/serviceCatalogValidation';
import { formatAssetTime } from '../../utils/assetValidation';

function FieldSummary({ fields }: { fields: CatalogFields }) {
  const price = catalogMoney(fields.defaultPrice);
  return <dl className="catalog-facts"><div><dt>Tên dịch vụ</dt><dd>{fields.name || 'Chưa nhập'}</dd></div><div><dt>Đơn vị</dt><dd>{fields.unit || 'Chưa nhập'}</dd></div>
    <div><dt>Phương pháp tính</dt><dd>{fields.method ? chargeMethods[fields.method] : 'Chưa chọn'}</dd></div>
    <div><dt>Đơn giá danh mục</dt><dd>{price !== null ? formatCatalogMoney(price) : fields.defaultPrice || 'Chưa thiết lập'}</dd></div></dl>;
}
function CurrentSummary({ item }: { item: CatalogService }) {
  return <><FieldSummary fields={{ name: item.name, unit: item.unit, method: item.method, defaultPrice: item.defaultPrice ?? '' }} /><p>Trạng thái: {catalogFilters[catalogState(item)]}</p></>;
}
export function CatalogDialog({ action, serviceId, opener, onClose, onFinished, onFailure, registerGuard, onSetup, enabled }: {
  action: CatalogAction; serviceId: string | null; opener: RefObject<HTMLElement | null>; onClose: () => void;
  onFinished: (message: string, kind?: CatalogNotice['kind']) => void; onFailure: (error: unknown) => boolean;
  registerGuard: NavigationGuardRegistration; onSetup: () => void; enabled: boolean;
}) {
  const controller = useCatalogDialog({ action, serviceId, onFinished, onFailure, registerGuard });
  const { snapshot, fields, pending, errors, error, loading, blocked, latest, previousDraft } = controller;
  const dialog = useRef<HTMLDialogElement>(null); const didFocus = useRef(false);
  const formAction = action === 'create' || action === 'edit'; const initializing = action === 'edit' && snapshot?.pricingStatus === 'UNCONFIGURED';
  const title = action === 'create' ? 'Thêm dịch vụ' : action === 'edit' ? initializing ? 'Thiết lập đơn giá' : 'Chỉnh sửa dịch vụ' : action === 'activate' ? 'Bật lại dịch vụ' : 'Tắt dịch vụ';
  const submitLabel = initializing ? 'Lưu và bật dịch vụ' : action === 'edit' ? 'Lưu thay đổi' : title;
  useEffect(() => {
    const node = dialog.current; const previous = opener.current || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    node?.showModal(); node?.querySelector<HTMLElement>('h2')?.focus();
    const overflow = document.body.style.overflowY; document.body.style.overflowY = 'hidden';
    return () => { node?.close(); document.body.style.overflowY = overflow;
      if (previous?.isConnected && previous !== document.body) previous.focus();
      if (!previous?.isConnected || previous === document.body || document.activeElement === document.body) document.getElementById('catalog-title')?.focus();
    };
  }, [opener]);
  useEffect(() => {
    if (!loading && !didFocus.current) { didFocus.current = true; dialog.current?.querySelector<HTMLElement>(formAction ? 'input:not(:disabled)' : '[data-catalog-cancel]')?.focus(); }
  }, [loading, formAction]);
  useEffect(() => { if (Object.values(errors).some(Boolean)) dialog.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [errors]);
  const ready = enabled && !loading && !pending && !blocked && (action === 'create' || snapshot !== null);
  const price = catalogMoney(fields.defaultPrice); const changedPrice = snapshot?.defaultPrice !== null && price !== null && snapshot?.defaultPrice !== price;
  return createPortal(<dialog ref={dialog} className="catalog-dialog" aria-labelledby="catalog-dialog-title" aria-busy={pending || loading}
    onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, a[href]') || [])
        .filter((node) => node.tabIndex >= 0 && node.getClientRects().length > 0);
      if (!controls.length) { event.preventDefault(); dialog.current?.querySelector<HTMLElement>('h2')?.focus(); return; }
      const first = controls[0], last = controls.at(-1)!;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current?.querySelector('h2'))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}
    onClick={(event) => {
      if (pending || event.target !== dialog.current) return;
      const box = dialog.current.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
    <h2 id="catalog-dialog-title" tabIndex={-1}>{title}</h2>
    {loading && <p role="status">Đang tải thông tin dịch vụ để xác nhận.</p>}
    {error && <div className="catalog-error" role="alert"><p>{error}</p>
      {!snapshot && !loading && <button type="button" className="catalog-button" onClick={controller.retry}>Thử lại</button>}
      {blocked && !latest && error.startsWith(m.stale) && <button type="button" className="catalog-button" onClick={() => { void controller.retryConflict(); }} disabled={pending || loading}>Tải lại dữ liệu mới</button>}
      {error === m.priceRequired && <button type="button" className="catalog-button" onClick={onSetup} disabled={pending}>Thiết lập giá</button>}
    </div>}
    {latest && <section className="catalog-conflict" aria-label="Đối chiếu dữ liệu xung đột"><h3>Thông tin hiện có</h3><CurrentSummary item={latest} />
      <h3>Bản nháp của bạn</h3><FieldSummary fields={fields} /><p>Kiểm tra thông tin mới trước khi chỉnh sửa và xác nhận lại.</p>
      <button type="button" className="catalog-button" onClick={controller.reviewLatest} disabled={pending}>Chỉnh sửa theo dữ liệu mới</button></section>}
    {previousDraft && <details className="catalog-draft"><summary>Xem bản nháp trước xung đột</summary><FieldSummary fields={previousDraft} /></details>}
    {formAction ? <form noValidate onSubmit={(event) => { event.preventDefault(); if (ready) void controller.submit(); }}>
      {initializing && <p className="catalog-help">Lưu đơn giá đầu tiên sẽ tạo giá danh mục và bật dịch vụ cho cấu hình mới. Bạn có thể chủ động nhập giá 0.</p>}
      <fieldset disabled={pending || loading || !enabled || blocked || action !== 'create' && !snapshot}>
        <legend className="visually-hidden">Thông tin dịch vụ</legend>
        {(['name', 'unit'] as const).map((key) => <div className="catalog-field" key={key}><label htmlFor={'catalog-' + key}>{key === 'name' ? 'Tên dịch vụ' : 'Đơn vị'} (bắt buộc)</label>
          <input id={'catalog-' + key} name={key} value={fields[key]} maxLength={key === 'name' ? 255 : 50} required aria-required="true" autoComplete="off"
            placeholder={key === 'unit' ? 'kWh, tháng, lần' : undefined} aria-invalid={!!errors[key]} aria-describedby={'catalog-' + key + '-help'}
            onChange={(event) => controller.change(key, event.target.value)} onBlur={() => controller.change(key, fields[key], true)} />
          <p id={'catalog-' + key + '-help'} className={errors[key] ? 'catalog-field-error' : 'catalog-help'}>{errors[key] || (key === 'name' ? 'Tối đa 255 ký tự.' : 'Tối đa 50 ký tự; nhập đơn vị bạn sử dụng.')}</p></div>)}
        <div className="catalog-field"><label htmlFor="catalog-method">Phương pháp tính{action === 'create' ? ' (bắt buộc)' : ''}</label>
          {action === 'create' ? <select id="catalog-method" name="method" value={fields.method} required aria-required="true" aria-invalid={!!errors.method} aria-describedby="catalog-method-help"
            onChange={(event) => controller.change('method', event.target.value)} onBlur={() => controller.change('method', fields.method, true)}>
            <option value="">Chọn phương pháp tính</option>{Object.entries(chargeMethods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            : <input id="catalog-method" name="method" value={fields.method ? chargeMethods[fields.method] : ''} readOnly aria-describedby="catalog-method-help" />}
          <p id="catalog-method-help" className={errors.method ? 'catalog-field-error' : 'catalog-help'}>{errors.method || (action === 'create' ? 'Mọi phương pháp, kể cả Tùy chỉnh, đều cần đơn giá danh mục.' : 'Phương pháp tính chỉ đọc tại danh mục dịch vụ.')}</p></div>
        <div className="catalog-field"><label htmlFor="catalog-defaultPrice">Đơn giá danh mục (VND) (bắt buộc)</label>
          <input id="catalog-defaultPrice" name="defaultPrice" type="text" inputMode="numeric" autoComplete="off" required aria-required="true" value={fields.defaultPrice}
            aria-invalid={!!errors.defaultPrice} aria-describedby="catalog-price-help" onChange={(event) => controller.change('defaultPrice', event.target.value)} onBlur={() => controller.change('defaultPrice', fields.defaultPrice, true)} />
          <p id="catalog-price-help" className={errors.defaultPrice ? 'catalog-field-error' : 'catalog-help'}>{errors.defaultPrice || (price !== null ? formatCatalogMoney(price) + ' — giá 0 hợp lệ khi bạn chủ động nhập.' : 'Nhập số nguyên VND; để trống không được hiểu là 0.')}</p></div>
      </fieldset>
      {snapshot && <p>Trạng thái hiện tại: <strong>{catalogFilters[catalogState(snapshot)]}</strong></p>}
      {snapshot?.effectiveFrom && <p className="catalog-help">Mốc hiệu lực giá danh mục: <time dateTime={snapshot.effectiveFrom}>{formatAssetTime(snapshot.effectiveFrom)}</time></p>}
      {action === 'edit' && !initializing && changedPrice && snapshot?.defaultPrice != null && <div className="catalog-price-change"><p>Đơn giá hiện có: <strong>{formatCatalogMoney(snapshot.defaultPrice)}</strong></p><p>Đơn giá mới: <strong>{formatCatalogMoney(price!)}</strong></p>
        <p>Giá của kỳ được xác định tại đầu chu kỳ hợp đồng gốc. Thay đổi giữa kỳ được áp dụng từ chu kỳ tiếp theo. Giá riêng tại tòa nhà hoặc phòng không bị ghi đè.</p></div>}
      {errors.version && <p role="alert">{errors.version}</p>}
      <div className="catalog-dialog-actions"><button type="button" className="catalog-button" data-catalog-cancel onClick={onClose} disabled={pending}>Hủy</button>
        <button type="submit" className="catalog-button catalog-button--primary" disabled={!ready}>{pending ? 'Đang lưu…' : submitLabel}</button></div>
    </form> : <>
      {snapshot && <><h3>{snapshot.name}</h3><CurrentSummary item={snapshot} /><p>{action === 'deactivate'
        ? 'Dịch vụ sẽ ngừng được chọn cho cấu hình mới. Các cấu hình phòng hiện hữu, lịch sử giá và dữ liệu đã phát sinh vẫn được giữ nguyên.'
        : 'Dịch vụ sẽ được phép chọn cho cấu hình mới. Thao tác này không tự thêm dịch vụ vào các phòng.'}</p></>}
      <div className="catalog-dialog-actions"><button type="button" className="catalog-button" data-catalog-cancel onClick={onClose} disabled={pending}>Hủy</button>
        <button type="button" className="catalog-button catalog-button--primary" onClick={() => { if (ready) void controller.submit(); }} disabled={!ready}>{pending ? 'Đang lưu…' : submitLabel}</button></div>
    </>}
    {!enabled && <p role="status">Đang đồng bộ danh mục. Hãy tải lại danh sách trước khi lưu.</p>}
  </dialog>, document.body);
}
