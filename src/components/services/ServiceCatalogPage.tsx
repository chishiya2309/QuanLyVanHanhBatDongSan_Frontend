import { useLayoutEffect, useRef, useState } from 'react';
import { useServiceCatalog, type CatalogNavigate, type NavigationGuardRegistration } from '../../hooks/useServiceCatalog';
import { catalogFilters, catalogMessages as m, chargeMethods, type CatalogAction, type CatalogRoute, type CatalogService } from '../../types/serviceCatalog';
import { catalogSearchText, catalogState, formatCatalogMoney } from '../../utils/serviceCatalogValidation';
import { catalogUrl } from '../../utils/serviceCatalogNavigation';
import { servicePolicyUrl } from '../../utils/servicePolicyNavigation';
import { CatalogDialog } from './CatalogDialog';
import './serviceCatalog.css';

export function CatalogForbidden({ onOverview }: { onOverview: () => void }) {
  return <section className="catalog-page"><h1>Danh mục dịch vụ</h1><p role="alert">{m.forbidden}</p><button type="button" className="catalog-button" onClick={onOverview}>Về tổng quan</button></section>;
}
function Search({ route, onNavigate }: { route: CatalogRoute; onNavigate: CatalogNavigate }) {
  const [input, setInput] = useState({ applied: route.q, draft: route.q });
  if (input.applied !== route.q) setInput({ applied: route.q, draft: input.draft.trim() === route.q ? input.draft : route.q });
  const draft = input.draft;
  return <form className="catalog-search" role="search" onSubmit={(event) => { event.preventDefault(); onNavigate(catalogUrl({ ...route, q: draft.trim() })); }}>
    <label htmlFor="catalog-search">Tìm theo tên hoặc đơn vị</label><div><input id="catalog-search" name="q" type="search" value={draft} onChange={(event) => setInput((old) => ({ ...old, draft: event.target.value }))} />
      <button type="submit" className="catalog-button">Tìm kiếm</button></div></form>;
}
export function ServiceCatalogPage({ route, onNavigate, onSessionExpired, onForbidden, registerGuard }: {
  route: CatalogRoute; onNavigate: CatalogNavigate; onSessionExpired: () => void; onForbidden: () => void; registerGuard: NavigationGuardRegistration;
}) {
  const { list, notice, dismiss, fail, finished } = useServiceCatalog(route, onNavigate, onSessionExpired, onForbidden);
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => { document.getElementById('catalog-title')?.focus(); }, []);
  const open = (action: CatalogAction, item?: CatalogService) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    onNavigate(catalogUrl(route, action, item?.id));
  };
  const enabled = list.status === 'ready' && !list.stale;
  const filtered = (list.data || []).filter((item) => (route.state === 'all' || catalogState(item) === route.state) && catalogSearchText(item.name + ' ' + item.unit).includes(catalogSearchText(route.q)));
  const actions = (item: CatalogService) => <div className="catalog-row-actions"><button type="button" className="catalog-button" disabled={!enabled} onClick={() => open('edit', item)}>{item.pricingStatus === 'UNCONFIGURED' ? 'Thiết lập giá' : 'Chỉnh sửa'}</button>
    {item.pricingStatus === 'CONFIGURED' && <button type="button" className="catalog-button" disabled={!enabled} onClick={() => open(item.active ? 'deactivate' : 'activate', item)}>{item.active ? 'Tắt dịch vụ' : 'Bật lại'}</button>}
    <button type="button" className="catalog-button" disabled={!enabled} onClick={() => onNavigate(servicePolicyUrl({ serviceId: item.id, q: route.q, state: route.state }))}>Thiết lập chính sách</button></div>;
  return <section className="catalog-page" aria-labelledby="catalog-title">
    <header className="catalog-heading"><div><h1 id="catalog-title" tabIndex={-1}>Danh mục dịch vụ</h1><p>Quản lý dịch vụ, đơn giá danh mục và khả năng sử dụng cho cấu hình mới.</p></div>
      <button type="button" className="catalog-button catalog-button--primary" onClick={() => open('create')} disabled={!enabled}>Thêm dịch vụ</button></header>
    {notice && <div className={'catalog-banner' + (notice.kind === 'error' ? ' catalog-banner--error' : '')} role={notice.kind === 'success' ? 'status' : 'alert'}><p>{notice.message}</p>
      {notice.message === m.uncertain && <p>Kiểm tra danh mục trước khi bắt đầu thao tác mới.</p>}<button type="button" className="catalog-button" onClick={dismiss} aria-label="Đóng thông báo danh mục">Đóng</button></div>}
    <div className="catalog-toolbar"><Search route={route} onNavigate={onNavigate} />
      <div className="catalog-filter"><label htmlFor="catalog-state">Trạng thái dịch vụ</label><select id="catalog-state" value={route.state} onChange={(event) => onNavigate(catalogUrl({ ...route, state: event.target.value as CatalogRoute['state'] }))}>
        {Object.entries(catalogFilters).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
    {list.status === 'loading' && <div className="catalog-skeleton" role="status" aria-label="Đang tải danh mục dịch vụ"><span>Đang tải danh mục dịch vụ…</span><div /><div /><div /></div>}
    {list.error && <div className="catalog-error" role="alert"><p>{list.error}{list.stale ? '. Đang hiển thị dữ liệu cũ; các thao tác được khóa.' : ''}</p><button type="button" className="catalog-button" onClick={list.refresh}>Thử lại</button></div>}
    {list.data && <div aria-busy={list.status === 'loading'}><div className="catalog-results"><p role="status" aria-live="polite" aria-atomic="true">{filtered.length.toLocaleString('vi-VN')} kết quả{list.stale ? ' — dữ liệu cũ' : ''}</p><button type="button" className="catalog-button" disabled={list.status === 'loading'} onClick={list.refresh}>Tải lại</button></div>
      {filtered.length ? <table className="catalog-table"><caption className="visually-hidden">Danh mục dịch vụ của Host</caption><thead><tr>{['Dịch vụ', 'Đơn vị', 'Phương pháp tính', 'Đơn giá danh mục', 'Trạng thái', 'Thao tác'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{filtered.map((item) => <tr key={item.id}><th scope="row"><span className="catalog-service-name">{item.name}</span>{item.systemCode && <span className="catalog-system-label">Có sẵn</span>}</th>
          <td data-label="Đơn vị">{item.unit}</td><td data-label="Phương pháp tính">{chargeMethods[item.method]}</td>
          <td data-label="Đơn giá danh mục" className="catalog-money">{item.defaultPrice === null ? <span className="catalog-help">Chưa thiết lập</span> : formatCatalogMoney(item.defaultPrice)}</td>
          <td data-label="Trạng thái"><span className={'catalog-badge catalog-badge--' + catalogState(item)}>{catalogFilters[catalogState(item)]}</span></td><td data-label="Thao tác">{actions(item)}</td></tr>)}</tbody></table>
        : list.status === 'ready' && <div className="catalog-empty"><h2>{list.data.length ? 'Không tìm thấy dịch vụ phù hợp' : 'Danh mục chưa có dữ liệu'}</h2><p>{list.data.length ? 'Thử từ khóa khác hoặc xóa bộ lọc.' : 'Thêm dịch vụ để bắt đầu quản lý danh mục.'}</p>
          <button type="button" className="catalog-button" onClick={list.data.length ? () => onNavigate('/services') : () => open('create')}>{list.data.length ? 'Xóa bộ lọc' : 'Thêm dịch vụ đầu tiên'}</button></div>}
    </div>}
    {route.action && <CatalogDialog key={route.action + '/' + route.serviceId} action={route.action} serviceId={route.serviceId} opener={opener} enabled={enabled}
      onClose={() => onNavigate(catalogUrl(route), true)} onFinished={finished} onFailure={fail} registerGuard={registerGuard}
      onSetup={() => onNavigate(catalogUrl(route, 'edit', route.serviceId), true)} />}
  </section>;
}
