import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useAssetPlacement } from '../../hooks/useAssetPlacement';
import type { PlacementAction } from '../../types/assets';
import { AssetReadError, AssetTime, ConditionBadge } from './AssetControls';

export function AssetPlacementDialog({ assetId, action, opener, onClose, onFinished, onFailure }: {
  assetId: string; action: PlacementAction; opener: RefObject<HTMLElement | null>; onClose: () => void;
  onFinished: (message: string, uncertain?: boolean, toList?: boolean) => void; onFailure: (error: unknown) => boolean;
}) {
  const controller = useAssetPlacement({ assetId, action, onFinished, onFailure });
  const { asset, rooms, availableRooms, roomId, pending, enabled, error, fieldError } = controller;
  const dialog = useRef<HTMLDialogElement>(null);
  const select = useRef<HTMLSelectElement>(null);
  const initialFocus = useRef(false);
  useEffect(() => {
    const element = dialog.current;
    const previous = opener.current || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    element?.showModal(); element?.querySelector<HTMLElement>('h2')?.focus();
    const overflow = document.body.style.overflowY; document.body.style.overflowY = 'hidden';
    return () => {
      element?.close(); document.body.style.overflowY = overflow;
      if (previous?.isConnected && previous !== document.body) previous.focus();
      if (!previous || previous === document.body || document.activeElement !== previous) document.querySelector<HTMLElement>('#assets-title')?.focus();
    };
  }, [opener]);
  useEffect(() => {
    if (enabled && !initialFocus.current) { initialFocus.current = true; select.current?.focus(); }
    if (fieldError) select.current?.focus();
  }, [enabled, fieldError]);
  const data = asset.data;
  const source = data?.currentPlacement;
  const target = availableRooms.find((room) => room.id === roomId);
  const label = action === 'assign' ? 'Gán tài sản vào phòng' : 'Chuyển tài sản sang phòng khác';
  return createPortal(<dialog ref={dialog} className="asset-dialog asset-placement-dialog" aria-labelledby="asset-placement-title" aria-busy={pending}
    onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}
    onClick={(event) => {
      if (pending || event.target !== dialog.current) return;
      const rect = dialog.current.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}
    onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),a[href]') || []);
      if (!controls.length) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === controls[0] || document.activeElement?.tagName === 'H2')) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }}>
    <div className="asset-dialog-body"><h2 id="asset-placement-title" tabIndex={-1}>{label}</h2>
      {asset.status === 'loading' && <p role="status">Đang tải thông tin tài sản để xác nhận.</p>}
      {asset.error && <AssetReadError message={asset.error} retry={asset.refresh} stale={asset.stale} />}
      {data && <div className="asset-placement-identity"><h3>{data.name}</h3><p className="asset-id">{data.assetId}</p>
        <p>Tình trạng hiện tại: <ConditionBadge condition={data.condition} /></p>
        <p>Phòng hiện tại: {source ? `${source.roomCode}: ${source.roomName}` : 'Chưa bố trí'}</p>
        {source && <p>Bắt đầu bố trí: <AssetTime value={source.fromAt} precise /></p>}
      </div>}
      {rooms.status === 'loading' && <p role="status">Đang tải danh sách phòng.</p>}
      {rooms.error && <AssetReadError message={rooms.error} retry={rooms.refresh} stale={rooms.stale} />}
      {rooms.status === 'ready' && asset.status === 'ready' && availableRooms.length === 0 && <p role="status" className="asset-placement-empty">Không có phòng đích phù hợp để thực hiện thao tác. Bạn vẫn có thể xem lịch sử tài sản.</p>}
      <form className="asset-form" noValidate onSubmit={(event) => { event.preventDefault(); void controller.submit(); }}>
        {error && <div role="alert" className="asset-banner asset-banner--error"><p>{error}</p></div>}
        <div className="asset-field"><label htmlFor="asset-roomId">Phòng đích <span aria-hidden="true">*</span></label>
          <select ref={select} id="asset-roomId" value={roomId} onChange={(event) => controller.selectRoom(event.target.value)} required
            disabled={!enabled} aria-invalid={!!fieldError} aria-describedby={fieldError ? 'asset-roomId-error' : undefined}>
            <option value="">Chọn phòng</option>{availableRooms.map((room) => <option key={room.id} value={room.id}>{[room.areaName, room.buildingName, room.floorName, `${room.code}: ${room.name}`].filter(Boolean).join(' / ')}</option>)}
          </select>
          {fieldError && <p className="asset-field-error" id="asset-roomId-error" role="alert">{fieldError}</p>}
        </div>
        {target && <div className="asset-placement-summary"><p>Tài sản: <strong>{data?.name}</strong></p><p>{action === 'transfer' ? `Từ phòng ${source?.roomCode}: ${source?.roomName} sang phòng ` : 'Gán vào phòng '}<strong>{target.code}: {target.name}</strong></p></div>}
        <div className="asset-form-actions"><button type="submit" className="asset-button asset-button--primary" disabled={!enabled}>{pending ? 'Đang lưu…' : action === 'assign' ? 'Xác nhận gán' : 'Xác nhận chuyển'}</button>
          <button type="button" className="asset-button" onClick={onClose} disabled={pending}>Hủy</button></div>
      </form>
    </div>
  </dialog>, document.body);
}
