import React from 'react';
import type { CashLedgerCatalog } from '../../hooks/useCashLedger';
import type {
  CashLedgerDirection,
  CashLedgerFilterState,
  CashLedgerOrigin,
  CashLedgerScopeType,
} from '../../types/cashLedger';
import { transactionCategories } from '../reports/financePresentation';

interface Props {
  filter: CashLedgerFilterState;
  catalog: CashLedgerCatalog;
  filterError: string | null;
  onChange: (next: CashLedgerFilterState) => void;
  onSubmit: () => void;
  onReset: () => void;
}

const ORIGIN_OPTIONS: { value: CashLedgerOrigin; label: string }[] = [
  { value: 'INVOICE_PAYMENT', label: 'Thanh toán hóa đơn' },
  { value: 'DEPOSIT_RECEIPT', label: 'Nhận tiền cọc' },
  { value: 'DEPOSIT_REFUND', label: 'Hoàn tiền cọc' },
  { value: 'MANUAL', label: 'Thu chi thủ công' },
  { value: 'REVERSAL', label: 'Đảo ngược / điều chỉnh' },
  { value: 'INTERNAL_TRANSFER', label: 'Chuyển quỹ nội bộ' },
];

export const CashLedgerFilters: React.FC<Props> = ({
  filter,
  catalog,
  filterError,
  onChange,
  onSubmit,
  onReset,
}) => {
  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  const selectedCategory = filter.categoryCodes[0] ?? '';
  const visibleBuildings = filter.areaId
    ? catalog.buildings.filter((b) => b.areaId === filter.areaId)
    : catalog.buildings;

  const handleScopeTypeChange = (scopeType: CashLedgerScopeType) => {
    if (scopeType === 'COMMON_EXPENSE' || scopeType === 'ALL') {
      onChange({
        ...filter,
        scopeType,
        areaId: undefined,
        buildingId: undefined,
        roomId: undefined,
      });
    } else {
      onChange({ ...filter, scopeType });
    }
  };

  return (
    <form className="cl-filter-panel" onSubmit={handleFormSubmit} aria-label="Bộ lọc sổ thu chi">
      <div className="cl-filter-grid">
        <div className="cl-field">
          <label className="cl-label" htmlFor="cl-from-date">Từ ngày (phát sinh)</label>
          <input
            id="cl-from-date"
            type="date"
            className="cl-input"
            value={filter.fromDate}
            onChange={(e) => onChange({ ...filter, fromDate: e.target.value })}
          />
        </div>

        <div className="cl-field">
          <label className="cl-label" htmlFor="cl-to-date">Đến ngày (phát sinh)</label>
          <input
            id="cl-to-date"
            type="date"
            className="cl-input"
            value={filter.toDate}
            onChange={(e) => onChange({ ...filter, toDate: e.target.value })}
          />
        </div>

        <div className="cl-field">
          <label className="cl-label" htmlFor="cl-direction">Hướng dòng tiền</label>
          <select
            id="cl-direction"
            className="cl-select"
            value={filter.direction ?? ''}
            onChange={(e) =>
              onChange({
                ...filter,
                direction: (e.target.value || undefined) as CashLedgerDirection | undefined,
              })
            }
          >
            <option value="">Tất cả (Thu &amp; Chi)</option>
            <option value="IN">Chỉ Thu (+)</option>
            <option value="OUT">Chỉ Chi (-)</option>
          </select>
        </div>

        <div className="cl-field">
          <label className="cl-label" htmlFor="cl-category">Danh mục thu chi</label>
          <select
            id="cl-category"
            className="cl-select"
            value={selectedCategory}
            onChange={(e) =>
              onChange({
                ...filter,
                categoryCodes: e.target.value ? [e.target.value] : [],
              })
            }
          >
            <option value="">Tất cả danh mục</option>
            {Object.entries(transactionCategories).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>

        <div className="cl-field">
          <label className="cl-label" htmlFor="cl-source">Nguồn tiền</label>
          <select
            id="cl-source"
            className="cl-select"
            value={filter.sourceId ?? ''}
            onChange={(e) => onChange({ ...filter, sourceId: e.target.value || undefined })}
          >
            <option value="">Tất cả nguồn tiền</option>
            {catalog.sources.map((src) => (
              <option key={src.id} value={src.id}>
                {src.name} ({src.type === 'BANK' ? 'Ngân hàng' : 'Tiền mặt'})
              </option>
            ))}
          </select>
        </div>

        <div className="cl-field">
          <label className="cl-label" htmlFor="cl-origin">Nguồn phát sinh</label>
          <select
            id="cl-origin"
            className="cl-select"
            value={filter.origin ?? ''}
            onChange={(e) =>
              onChange({
                ...filter,
                origin: (e.target.value || undefined) as CashLedgerOrigin | undefined,
              })
            }
          >
            <option value="">Tất cả nguồn phát sinh</option>
            {ORIGIN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="cl-field">
          <label className="cl-label" htmlFor="cl-profit">Ảnh hưởng lợi nhuận</label>
          <select
            id="cl-profit"
            className="cl-select"
            value={filter.affectsProfit === undefined ? '' : String(filter.affectsProfit)}
            onChange={(e) => {
              const val = e.target.value;
              onChange({
                ...filter,
                affectsProfit: val === '' ? undefined : val === 'true',
              });
            }}
          >
            <option value="">Tất cả</option>
            <option value="true">Tính vào lợi nhuận</option>
            <option value="false">Không tính vào lợi nhuận (Cọc / Chuyển quỹ)</option>
          </select>
        </div>

        <div className="cl-field">
          <label className="cl-label" htmlFor="cl-scope-type">Phạm vi áp dụng</label>
          <select
            id="cl-scope-type"
            className="cl-select"
            value={filter.scopeType ?? 'ALL'}
            onChange={(e) => handleScopeTypeChange(e.target.value as CashLedgerScopeType)}
          >
            <option value="ALL">Tất cả bất động sản</option>
            <option value="COMMON_EXPENSE">Chi phí chung</option>
            <option value="AREA">Theo khu vực / tòa nhà / phòng</option>
          </select>
        </div>

        {filter.scopeType !== 'COMMON_EXPENSE' && (
          <>
            <div className="cl-field">
              <label className="cl-label" htmlFor="cl-area">Khu vực</label>
              <select
                id="cl-area"
                className="cl-select"
                value={filter.areaId ?? ''}
                onChange={(e) =>
                  onChange({
                    ...filter,
                    scopeType: e.target.value ? 'AREA' : 'ALL',
                    areaId: e.target.value || undefined,
                    buildingId: undefined,
                    roomId: undefined,
                  })
                }
              >
                <option value="">Tất cả khu vực</option>
                {catalog.areas.map((area) => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
            </div>

            <div className="cl-field">
              <label className="cl-label" htmlFor="cl-building">Tòa nhà</label>
              <select
                id="cl-building"
                className="cl-select"
                value={filter.buildingId ?? ''}
                onChange={(e) =>
                  onChange({
                    ...filter,
                    scopeType: e.target.value ? 'BUILDING' : filter.areaId ? 'AREA' : 'ALL',
                    buildingId: e.target.value || undefined,
                    roomId: undefined,
                  })
                }
              >
                <option value="">Tất cả tòa nhà</option>
                {visibleBuildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="cl-field">
              <label className="cl-label" htmlFor="cl-room">Phòng cụ thể</label>
              <select
                id="cl-room"
                className="cl-select"
                value={filter.roomId ?? ''}
                disabled={!filter.buildingId}
                onChange={(e) =>
                  onChange({
                    ...filter,
                    scopeType: e.target.value ? 'ROOM' : filter.buildingId ? 'BUILDING' : 'ALL',
                    roomId: e.target.value || undefined,
                  })
                }
              >
                <option value="">{filter.buildingId ? 'Tất cả phòng' : 'Chọn tòa nhà trước'}</option>
                {catalog.rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.code}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {filterError && (
        <div className="cl-alert is-error" role="alert">
          {filterError}
        </div>
      )}

      <div className="cl-filter-actions">
        <div className="cl-filter-btn-group">
          <button type="submit" className="cl-btn is-primary">Lọc dữ liệu</button>
          <button type="button" className="cl-btn" onClick={onReset}>Đặt lại bộ lọc</button>
        </div>
      </div>
    </form>
  );
};
