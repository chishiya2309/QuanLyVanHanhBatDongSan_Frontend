import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useAssets } from '../../hooks/useAssets';
import { assetMessages as m, type Asset, type AssetQuery, type AssetRoute } from '../../types/assets';
import { assetUrl } from '../../utils/assetNavigation';
import { formatAssetMoney } from '../../utils/assetValidation';
import { AssetLink, AssetReadError, AssetSearch, AssetSize, AssetSkeleton, AssetTime, ConditionBadge, type AssetNavigate } from './AssetControls';
import { AssetForm, CreateAssetDialog } from './AssetForm';
import './assets.css';

function AssetActions({ asset, route, navigate, disabled }: { asset: Asset; route: AssetRoute; navigate: AssetNavigate; disabled: boolean }) {
  return <div className="asset-row-actions"><AssetLink href={assetUrl(route, asset.assetId)} navigate={navigate}>Xem chi tiết</AssetLink>
    <AssetLink href={assetUrl(route, asset.assetId, 'edit')} navigate={navigate} disabled={disabled}>Chỉnh sửa</AssetLink>
    <AssetLink href={assetUrl(route, asset.assetId, 'condition')} navigate={navigate} disabled={disabled}>Ghi nhận tình trạng</AssetLink>
  </div>;
}
function AssetData({ asset }: { asset: Asset }) {
  const row = (label: string, content: ReactNode) => <div><dt>{label}</dt><dd>{content}</dd></div>;
  return <dl className="asset-facts">
    {row('Tên tài sản', asset.name)}{row('Mã tài sản', <span className="asset-id">{asset.assetId}</span>)}
    {row('Giá trị', <span className="asset-money">{formatAssetMoney(asset.purchaseValue)}</span>)}{row('Tình trạng', <ConditionBadge condition={asset.condition} />)}
    {row('Ghi chú chung', <span className="asset-note">{asset.note ?? 'Chưa có ghi chú'}</span>)}
    {row('Ngày tạo', <AssetTime value={asset.createdAt} />)}{row('Cập nhật gần nhất', <AssetTime value={asset.updatedAt} />)}
  </dl>;
}
export function AssetsForbidden({ onOverview }: { onOverview: () => void }) {
  return <section className="assets-page"><h1>Quản lý tài sản</h1><p role="alert">{m.forbidden}</p><button className="asset-button" onClick={onOverview}>Về tổng quan</button></section>;
}
export function AssetsPage({ route, onNavigate, onSessionExpired, onForbidden, onCreatePendingChange }: { route: AssetRoute; onNavigate: AssetNavigate; onSessionExpired: () => void; onForbidden: () => void; onCreatePendingChange?: (pending: boolean) => void }) {
  const controller = useAssets(route, { onNavigate, onSessionExpired, onForbidden });
  const { list, detail, notice, pending, canMutate, mutationError } = controller;
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => { onCreatePendingChange?.(pending && route.create); return () => onCreatePendingChange?.(false); }, [pending, route.create, onCreatePendingChange]);
  const isList = route.screen === 'list';
  const changeQuery = useCallback((query: AssetQuery, replace: boolean) => onNavigate(assetUrl(query), replace), [onNavigate]);
  useLayoutEffect(() => { if (!document.querySelector('dialog[open]')) heading.current?.focus(); }, [route.screen, route.assetId]);
  const backToList = () => onNavigate(assetUrl(route));
  const openCreate = () => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; onNavigate(assetUrl(route, null, 'list', true)); };
  const closeCreate = () => { if (!pending) onNavigate(assetUrl(route), true); };
  const asset = detail.data;
  const title = isList ? 'Quản lý tài sản' : route.screen === 'edit' ? 'Chỉnh sửa tài sản' : route.screen === 'condition' ? 'Ghi nhận tình trạng' : 'Chi tiết tài sản';
  return <section className="assets-page" aria-labelledby="assets-title">
    <header className="asset-page-heading"><div><h1 id="assets-title" ref={heading} tabIndex={-1}>{title}</h1><p>{isList ? 'Tra cứu và cập nhật tài sản của bạn.' : 'Quản lý thông tin chung và tình trạng tài sản.'}</p></div>
      {isList ? <button className="asset-button asset-button--primary" data-create-asset onClick={openCreate} disabled={!canMutate || route.q.length > 200}>Thêm tài sản</button> : <AssetLink href={assetUrl(route)} navigate={onNavigate}>Quay lại danh sách</AssetLink>}
    </header>
    {notice && <div className={'asset-banner asset-banner--' + notice.kind} role={notice.kind === 'success' ? 'status' : 'alert'}>
      <p>{notice.message}</p>{notice.uncertain && <p>{m.repeatWarning}</p>}
      {notice.assetId && <AssetLink href={assetUrl({ ...route, page: 0 }, notice.assetId)} navigate={onNavigate}>Xem tài sản</AssetLink>}
      <button className="asset-button" onClick={controller.dismissNotice} aria-label="Đóng thông báo tài sản">Đóng</button>
    </div>}
    {isList ? <>
      <div className="asset-toolbar"><AssetSearch query={route} change={changeQuery} /><AssetSize size={route.size} change={(size) => changeQuery({ ...route, page: 0, size }, false)} /></div>
      {route.q.length > 200 ? <p role="alert" className="asset-field-error">{m.queryLong}</p> : <>
        {list.status === 'loading' && <AssetSkeleton />}
        {list.error && <AssetReadError message={list.error} retry={list.refresh} stale={list.stale} />}
        {list.data && <div aria-busy={list.status === 'loading'}>
          <div className="asset-results"><p>{list.data.totalElements.toLocaleString('vi-VN')} kết quả{list.stale ? ' — dữ liệu cũ' : ''}</p><button className="asset-button" onClick={list.refresh} disabled={pending || list.status === 'loading'}>Tải lại</button></div>
          {list.data.content.length ? <>
            <div className="asset-table-wrap"><table className="asset-table"><caption className="visually-hidden">Danh sách tài sản</caption><thead><tr><th scope="col">Tài sản</th><th scope="col">Giá trị</th><th scope="col">Tình trạng</th><th scope="col">Ghi chú chung</th><th scope="col">Cập nhật gần nhất</th><th scope="col">Thao tác</th></tr></thead><tbody>
              {list.data.content.map((item) => <tr key={item.assetId}><th scope="row"><span>{item.name}</span><span className="asset-id">{item.assetId}</span></th><td className="asset-money">{formatAssetMoney(item.purchaseValue)}</td><td><ConditionBadge condition={item.condition} /></td><td className="asset-note">{item.note ?? 'Chưa có ghi chú'}</td><td><AssetTime value={item.updatedAt} /></td><td><AssetActions asset={item} route={route} navigate={onNavigate} disabled={!canMutate} /></td></tr>)}
            </tbody></table></div>
            <ul className="asset-mobile-records" aria-label="Danh sách tài sản trên thiết bị nhỏ">{list.data.content.map((item) => <li key={item.assetId}><h2>{item.name}</h2><dl>
              <div><dt>Mã tài sản</dt><dd className="asset-id">{item.assetId}</dd></div><div><dt>Giá trị</dt><dd className="asset-money">{formatAssetMoney(item.purchaseValue)}</dd></div><div><dt>Tình trạng</dt><dd><ConditionBadge condition={item.condition} /></dd></div>
              <div><dt>Ghi chú chung</dt><dd className="asset-note">{item.note ?? 'Chưa có ghi chú'}</dd></div><div><dt>Cập nhật gần nhất</dt><dd><AssetTime value={item.updatedAt} /></dd></div>
            </dl><AssetActions asset={item} route={route} navigate={onNavigate} disabled={!canMutate} /></li>)}</ul>
          </> : list.status === 'ready' && (route.page === 0 || list.data.totalPages > route.page) && <div className="asset-empty"><h2>{route.q ? 'Không tìm thấy tài sản phù hợp' : 'Chưa có tài sản'}</h2><p>{route.q ? 'Thử từ khóa khác hoặc xóa tìm kiếm.' : 'Thêm tài sản đầu tiên để bắt đầu quản lý.'}</p><button className="asset-button" onClick={route.q ? () => changeQuery({ ...route, q: '', page: 0 }, true) : openCreate}>{route.q ? 'Xóa tìm kiếm' : 'Thêm tài sản'}</button></div>}
          {list.data.totalPages > 0 && <nav className="asset-pagination" aria-label="Phân trang tài sản"><button className="asset-button" disabled={list.data.first || list.status !== 'ready' || pending} onClick={() => changeQuery({ ...route, page: route.page - 1 }, false)}>Trang trước</button><p>Trang {route.page + 1} / {list.data.totalPages}</p><button className="asset-button" disabled={list.data.last || list.status !== 'ready' || pending} onClick={() => changeQuery({ ...route, page: route.page + 1 }, false)}>Trang sau</button></nav>}
        </div>}
      </>}
      {route.create && <CreateAssetDialog opener={opener} pending={pending} enabled={canMutate} error={mutationError} syncError={route.q.length > 200 ? m.queryLong : list.error} syncing={route.q.length <= 200 && list.status === 'loading'} onRetry={list.refresh} onClose={closeCreate} onSave={(input) => { void controller.mutate({ kind: 'create', input }); }} />}
    </> : <>
      {detail.status === 'loading' && <AssetSkeleton detail />}
      {detail.error && <AssetReadError message={detail.error} retry={detail.refresh} stale={detail.stale} />}
      {asset && <div className="asset-panel" aria-busy={detail.status === 'loading'}>
        {route.screen === 'detail' ? <><AssetData asset={asset} /><div className="asset-form-actions"><AssetLink href={assetUrl(route, asset.assetId, 'edit')} navigate={onNavigate} primary disabled={!canMutate}>Chỉnh sửa</AssetLink><AssetLink href={assetUrl(route, asset.assetId, 'condition')} navigate={onNavigate} disabled={!canMutate}>Ghi nhận tình trạng</AssetLink></div></> : <>
          <div className="asset-form-identity"><h2>{asset.name}</h2><p className="asset-id">{asset.assetId}</p>{route.screen === 'condition' && <p>Tình trạng hiện tại: <ConditionBadge condition={asset.condition} /></p>}</div>
          {detail.status === 'ready' && !detail.stale && (route.screen === 'edit' ? <>
            <AssetLink href={assetUrl(route, asset.assetId, 'condition')} navigate={onNavigate} disabled={pending}>Ghi nhận tình trạng</AssetLink>
            <AssetForm key={asset.assetId + '/edit'} mode="edit" asset={asset} pending={pending} enabled={canMutate} error={mutationError} onCancel={() => onNavigate(assetUrl(route, asset.assetId))} onSave={(input) => { void controller.mutate({ kind: 'edit', id: asset.assetId, input }); }} />
          </> : <AssetForm key={asset.assetId + '/condition'} mode="condition" asset={asset} pending={pending} enabled={canMutate} error={mutationError} onCancel={() => onNavigate(assetUrl(route, asset.assetId))} onSave={(input) => { void controller.mutate({ kind: 'condition', id: asset.assetId, input }); }} />)}
        </>}
      </div>}
      {!asset && detail.status === 'error' && <button className="asset-button" onClick={backToList}>Quay lại danh sách</button>}
    </>}
  </section>;
}
