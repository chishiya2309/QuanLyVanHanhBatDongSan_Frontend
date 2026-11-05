import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { assetMessages as m, assetStates, type AssetQuery, type AssetState } from '../../types/assets';
import { assetPageSizes } from '../../utils/assetNavigation';
import { formatAssetTime } from '../../utils/assetValidation';

export type AssetNavigate = (url: string, replace?: boolean) => void;
export function AssetLink({ href, navigate, children, primary = false, disabled = false }: { href: string; navigate: AssetNavigate; children: ReactNode; primary?: boolean; disabled?: boolean }) {
  const className = 'asset-button' + (primary ? ' asset-button--primary' : '');
  if (disabled) return <span className={className} aria-disabled="true">{children}</span>;
  return <a className={className} href={href} onClick={(event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(href); }
  }}>{children}</a>;
}
export function ConditionBadge({ condition }: { condition: AssetState }) {
  return <span className={'asset-badge asset-badge--' + condition.toLowerCase()}>{assetStates[condition]}</span>;
}
export function AssetTime({ value, precise = false }: { value: string; precise?: boolean }) { return <time dateTime={value}>{formatAssetTime(value, precise)}</time>; }
export function AssetSkeleton({ detail = false }: { detail?: boolean }) {
  return <div role="status" aria-label={detail ? 'Đang tải thông tin tài sản' : 'Đang tải danh sách tài sản'} className="asset-skeleton">
    <span className="visually-hidden">{detail ? 'Đang tải thông tin tài sản' : 'Đang tải danh sách tài sản'}</span>
    {Array.from({ length: detail ? 6 : 5 }, (_, index) => <div key={index} className="asset-skeleton-row"><span /><span /><span /></div>)}
  </div>;
}
export function AssetReadError({ message, retry, stale }: { message: string; retry: () => void; stale: boolean }) {
  return <div className="asset-banner asset-banner--error" role="alert"><p>{message}</p>
    {stale && <p>Dữ liệu đang hiển thị đã cũ. Vui lòng tải lại trước khi tiếp tục thao tác.</p>}
    <button className="asset-button" onClick={retry}>Thử lại</button>
  </div>;
}
export function AssetSearch({ query, change }: { query: AssetQuery; change: (value: AssetQuery, replace: boolean) => void }) {
  const [input, setInput] = useState({ applied: query.q, draft: query.q });
  if (input.applied !== query.q) setInput({ applied: query.q, draft: input.draft.trim() === query.q ? input.draft : query.q });
  const draft = input.draft;
  const setDraft = (value: string) => setInput((previous) => ({ ...previous, draft: value }));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invalid = draft.trim().length > 200;
  useEffect(() => {
    if (invalid || draft.trim() === query.q) return;
    timer.current = setTimeout(() => { timer.current = null; change({ ...query, q: draft.trim(), page: 0 }, true); }, 300);
    return () => { if (timer.current !== null) clearTimeout(timer.current); };
  }, [draft, invalid, query, change]);
  return <form className="asset-search" role="search" onSubmit={(event) => {
    event.preventDefault(); if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; }
    if (!invalid) change({ ...query, q: draft.trim(), page: 0 }, true);
  }}>
    <label htmlFor="asset-search">Tìm theo tên hoặc ghi chú</label>
    <div className="asset-search-controls"><input type="search" id="asset-search" value={draft} onChange={(event) => setDraft(event.target.value)} aria-invalid={invalid} aria-describedby="asset-search-help" autoComplete="off" />
      <button className="asset-button" type="submit">Tìm kiếm</button>
      {(query.q || draft) && <button className="asset-button" type="button" onClick={() => { if (timer.current !== null) clearTimeout(timer.current); setDraft(''); change({ ...query, q: '', page: 0 }, true); }}>Xóa tìm kiếm</button>}
    </div>
    <p className={invalid ? 'asset-field-error' : 'asset-help'} id="asset-search-help" role={invalid ? 'alert' : undefined}>{invalid ? m.queryLong : 'Tìm trong toàn bộ tài sản của bạn. Tối đa 200 ký tự.'}</p>
  </form>;
}
export function AssetSize({ size, change }: { size: number; change: (size: number) => void }) {
  return <label className="asset-size">Số tài sản mỗi trang<select value={size} onChange={(event) => change(Number(event.target.value))}>
    {assetPageSizes.map((value) => <option key={value} value={value}>{value}</option>)}
  </select></label>;
}
