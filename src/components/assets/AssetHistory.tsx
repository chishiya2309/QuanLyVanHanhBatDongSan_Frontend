import type { ReactNode } from 'react';
import type { AssetHistory as History } from '../../types/assets';
import type { AssetResource } from '../../hooks/useAssetResource';
import { AssetReadError, AssetTime, ConditionBadge } from './AssetControls';

export function AssetHistory({ resource }: { resource: AssetResource<History> }) {
  const { data, status, error, stale, refresh } = resource;
  const locations = data?.locationHistory.map((item) => ({ id: item.placementId, fields: [
    ['Phòng', `${item.roomCode} — ${item.roomName}`], ['Thời điểm bắt đầu', <AssetTime value={item.fromAt} precise />],
    ['Thời điểm kết thúc', item.toAt === null ? 'Chưa kết thúc' : <AssetTime value={item.toAt} precise />],
    ['Tình trạng khi bắt đầu bố trí', <ConditionBadge condition={item.conditionAtStart} />],
  ] as [string, ReactNode][] }));
  const conditions = data?.conditionHistory.map((item) => ({ id: item.recordId, fields: [
    ['Thời điểm ghi nhận', <AssetTime value={item.recordedAt} precise />], ['Tình trạng', <ConditionBadge condition={item.condition} />],
    ['Người ghi nhận', <span className="asset-id">{item.recordedByAccountId}</span>],
    ['Ghi chú kiểm tra', <span className="asset-note">{item.note ?? 'Chưa có ghi chú kiểm tra'}</span>],
    ['Phòng tại thời điểm ghi nhận', item.placementId === null ? 'Không có phòng bố trí tại thời điểm ghi nhận' : `${item.roomCode} — ${item.roomName}`],
  ] as [string, ReactNode][] }));
  return <div className="asset-history" aria-busy={status === 'loading'}>
    {status === 'loading' && <p role="status">Đang tải lịch sử tài sản.</p>}
    {error && <AssetReadError message={error} retry={refresh} stale={stale} />}
    {data && <><div className="asset-results"><p>{stale ? 'Dữ liệu lịch sử đã cũ' : 'Lịch sử được sắp xếp từ mới đến cũ.'}</p><button className="asset-button" onClick={refresh} disabled={status === 'loading'}>Tải lại lịch sử</button></div>
      <HistorySection title="Lịch sử vị trí" empty="Chưa có lịch sử vị trí" rows={locations || []} />
      <HistorySection title="Lịch sử tình trạng" empty="Chưa có lịch sử tình trạng" rows={conditions || []} />
    </>}
  </div>;
}
function HistorySection({ title, empty, rows }: { title: string; empty: string; rows: { id: string; fields: [string, ReactNode][] }[] }) {
  return <section className="asset-history-section" aria-label={title}><h2>{title}</h2>
    {rows.length === 0 ? <p className="asset-empty">{empty}</p> : <>
      <div className="asset-history-table-wrap"><table className="asset-history-table"><caption className="visually-hidden">{title}</caption>
        <thead><tr>{rows[0].fields.map(([label]) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>{row.fields.map(([label, value]) => <td key={label}>{value}</td>)}</tr>)}</tbody>
      </table></div>
      <ol className="asset-history-records" aria-label={title}>{rows.map((row) => <li key={row.id}><dl>{row.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></li>)}</ol>
    </>}
  </section>;
}
