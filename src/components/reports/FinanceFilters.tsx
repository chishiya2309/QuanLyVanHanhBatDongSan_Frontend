import { useState, type FormEvent } from 'react';
import type { FundingSource } from '../../types/fundingSource';
import type { Area, Building, Room } from '../../types/properties';
import { validFinanceDates, type FinanceFilter } from '../../utils/financeNavigation';
import { transactionCategories } from './financePresentation';

export type FinanceCatalog = { areas: Area[]; buildings: Building[]; sources: FundingSource[] };
type Option = { id: string; name: string };

function FilterSelect({ label, value, options, onChange, disabled }: {
  label: string; value?: string; options: Option[]; onChange: (value?: string) => void; disabled?: boolean;
}) {
  return <label className="finance-field">{label}
    <select value={value ?? ''} disabled={disabled} onChange={event => onChange(event.target.value || undefined)}>
      <option value="">Tất cả</option>
      {value && !options.some(option => option.id === value) && <option value={value}>Đã chọn ({value})</option>}
      {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select>
  </label>;
}

export function FinanceFilters({ applied, defaultFrom, defaultTo, catalog, roomsByBuilding, onApply, onBuilding }: {
  applied: FinanceFilter; defaultFrom?: string; defaultTo?: string; catalog: FinanceCatalog;
  roomsByBuilding: Record<string, Room[]>; onApply: (filter: FinanceFilter) => void; onBuilding: (id?: string) => void;
}) {
  const [draft, setDraft] = useState(applied);
  const [error, setError] = useState(false);
  const [editingDates, setEditingDates] = useState(Boolean(applied.fromDate || applied.toDate));
  const buildings = catalog.buildings.filter(building => !draft.areaId || building.areaId === draft.areaId);
  const inheritedBuilding = catalog.buildings.find(building => building.id === draft.buildingId);
  const rooms = draft.buildingId ? roomsByBuilding[draft.buildingId] ?? [] : [];
  const categories = { ...Object.fromEntries(draft.transactionCategory.map(code => [code, code])), ...transactionCategories };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(!validFinanceDates(draft));
    if (validFinanceDates(draft)) onApply(draft);
  }

  return <form className="finance-filters" onSubmit={submit} aria-label="Bộ lọc thu chi">
    <div className="finance-filter-grid">
      <label className="finance-field">Từ ngày
        <input type="date" value={(editingDates ? draft.fromDate : defaultFrom) ?? ''} aria-invalid={error}
          aria-describedby={error ? 'finance-date-error' : undefined} onChange={event => {
            setEditingDates(true);
            setDraft({ ...draft, fromDate: event.target.value || undefined, toDate: editingDates ? draft.toDate : defaultTo });
          }} />
      </label>
      <label className="finance-field">Đến ngày
        <input type="date" value={(editingDates ? draft.toDate : defaultTo) ?? ''} aria-invalid={error}
          aria-describedby={error ? 'finance-date-error' : undefined} onChange={event => {
            setEditingDates(true);
            setDraft({ ...draft, toDate: event.target.value || undefined, fromDate: editingDates ? draft.fromDate : defaultFrom });
          }} />
      </label>
      <FilterSelect label="Khu vực" value={draft.areaId} options={catalog.areas} onChange={areaId => {
        const compatible = !areaId || inheritedBuilding?.areaId === areaId;
        setDraft({ ...draft, areaId, buildingId: compatible ? draft.buildingId : undefined, roomId: compatible ? draft.roomId : undefined });
      }} />
      <FilterSelect label="Tòa nhà" value={draft.buildingId} options={buildings} onChange={buildingId => {
        setDraft({ ...draft, buildingId, roomId: undefined });
        onBuilding(buildingId);
      }} />
      <FilterSelect label="Phòng" value={draft.roomId} options={rooms} disabled={!draft.buildingId && !draft.roomId} onChange={roomId => setDraft({ ...draft, roomId })} />
      <FilterSelect label="Nguồn tiền" value={draft.sourceId} options={catalog.sources} onChange={sourceId => setDraft({ ...draft, sourceId })} />
    </div>
    <div className="finance-toolbar">
      <details className="finance-categories">
        <summary>Danh mục giao dịch{draft.transactionCategory.length ? ' (' + draft.transactionCategory.length + ')' : ''}</summary>
        <div className="finance-category-options" role="group" aria-label="Chọn danh mục">
          {Object.entries(categories).map(([code, label]) => <label key={code}>
            <input type="checkbox" checked={draft.transactionCategory.includes(code)} onChange={event =>
              setDraft({ ...draft, transactionCategory: event.target.checked ? [...draft.transactionCategory, code]
                : draft.transactionCategory.filter(category => category !== code) })} /> {label}
          </label>)}
        </div>
      </details>
      <button type="submit" className="finance-primary">Áp dụng</button>
      <button type="button" onClick={() => {
        setDraft({ transactionCategory: [] });
        setEditingDates(false);
        setError(false);
        onApply({ transactionCategory: [] });
      }}>Đặt lại</button>
    </div>
    {error && <p id="finance-date-error" role="alert">Chọn đủ hai ngày và kiểm tra ngày bắt đầu không sau ngày kết thúc.</p>}
  </form>;
}

