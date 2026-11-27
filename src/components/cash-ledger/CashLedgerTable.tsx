import React from 'react';
import type { CashLedgerEntryItem, CashLedgerPageData } from '../../types/cashLedger';
import { money, timestampLabel } from '../reports/financePresentation';

interface Props {
  data: CashLedgerPageData | null;
  loading: boolean;
  selectedEntryId: string | null;
  onSelectEntry: (entryId: string) => void;
  onPageChange: (nextPage: number) => void;
  onSizeChange: (nextSize: number) => void;
  onResetFilters: () => void;
}

const ORIGIN_LABELS: Record<string, string> = {
  INVOICE_PAYMENT: 'Thanh toán hóa đơn',
  DEPOSIT_RECEIPT: 'Nhận tiền cọc',
  DEPOSIT_REFUND: 'Hoàn tiền cọc',
  MANUAL: 'Thu chi thủ công',
  REVERSAL: 'Đảo ngược / điều chỉnh',
  INTERNAL_TRANSFER: 'Chuyển quỹ nội bộ',
};

function renderScope(item: CashLedgerEntryItem): string {
  if (item.scopeLabel) return item.scopeLabel;
  if (item.roomCode) return `Phòng ${item.roomCode}`;
  if (item.buildingName) return `Tòa nhà ${item.buildingName}`;
  if (item.areaName) return `Khu vực ${item.areaName}`;
  return 'Chi phí chung';
}

export const CashLedgerTable: React.FC<Props> = ({
  data,
  loading,
  selectedEntryId,
  onSelectEntry,
  onPageChange,
  onSizeChange,
  onResetFilters,
}) => {
  if (loading && !data) {
    return (
      <section className="cl-table-panel" aria-busy="true">
        <div className="cl-empty-box">Đang tải dữ liệu sổ thu chi...</div>
      </section>
    );
  }

  if (!data || data.items.length === 0) {
    const isNoData = data?.emptyState === 'NO_DATA';
    return (
      <section className="cl-table-panel">
        <div className="cl-empty-box">
          <p>{data?.emptyMessage ?? 'Chưa có giao dịch thu chi nào được ghi nhận trong sổ quỹ'}</p>
          {!isNoData && (
            <button type="button" className="cl-btn" onClick={onResetFilters}>
              Đặt lại điều kiện lọc
            </button>
          )}
        </div>
      </section>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.totalElements / data.size));

  return (
    <section className="cl-table-panel" aria-label="Danh sách giao dịch thu chi">
      <div className="cl-table-scroll">
        <table className="cl-table">
          <thead>
            <tr>
              <th scope="col">Ngày phát sinh</th>
              <th scope="col">Hướng</th>
              <th scope="col">Số tiền</th>
              <th scope="col">Danh mục</th>
              <th scope="col">Nguồn tiền</th>
              <th scope="col">Phạm vi áp dụng</th>
              <th scope="col">Nguồn phát sinh</th>
              <th scope="col">Chứng từ</th>
              <th scope="col">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => {
              const isIn = item.direction === 'IN';
              const isSelected = selectedEntryId === item.id;
              return (
                <tr key={item.id} className={isSelected ? 'is-selected' : undefined}>
                  <td>{timestampLabel(item.occurredAt)}</td>
                  <td>
                    <span className={`cl-badge ${isIn ? 'is-in' : 'is-out'}`}>
                      {isIn ? 'Thu +' : 'Chi -'}
                    </span>
                  </td>
                  <td>
                    <span className={`cl-money ${isIn ? 'is-in' : 'is-out'}`}>
                      {isIn ? '+' : '-'}
                      {money(item.amount)}
                    </span>
                  </td>
                  <td>{item.categoryName ?? item.category ?? 'Chưa phân loại'}</td>
                  <td>
                    <span>{item.sourceName ?? item.sourceId}</span>
                    {item.sourceType && (
                      <span className="cl-stat-hint">
                        {' '}
                        ({item.sourceType === 'BANK' ? 'Ngân hàng' : 'Tiền mặt'})
                      </span>
                    )}
                  </td>
                  <td>{renderScope(item)}</td>
                  <td>
                    <div className="cl-origin-cell">
                      <span>{ORIGIN_LABELS[item.origin] ?? item.origin}</span>
                      {item.isReversal && <span className="cl-badge is-reversal">Bút toán đảo ngược</span>}
                      {item.isReversed && <span className="cl-badge is-neutral">Đã bị đảo ngược</span>}
                    </div>
                  </td>
                  <td>
                    {item.hasAttachments ? (
                      <span className="cl-att-indicator" title="Có chứng từ đính kèm">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        <span>{item.attachmentCount}</span>
                      </span>
                    ) : (
                      <span className="cl-stat-hint">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="cl-row-btn"
                      onClick={() => onSelectEntry(item.id)}
                    >
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="cl-pagination">
        <span className="cl-stat-hint">
          Tổng cộng {data.totalElements} giao dịch (Trang {data.page + 1} / {totalPages})
        </span>

        <div className="cl-pagination-controls">
          <label className="cl-label" htmlFor="cl-page-size">Hiển thị</label>
          <select
            id="cl-page-size"
            className="cl-select"
            style={{ width: 'auto' }}
            value={data.size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
          >
            <option value={20}>20 dòng</option>
            <option value={50}>50 dòng</option>
            <option value={100}>100 dòng</option>
          </select>

          <button
            type="button"
            className="cl-btn"
            disabled={data.page <= 0 || loading}
            onClick={() => onPageChange(data.page - 1)}
          >
            Trang trước
          </button>
          <button
            type="button"
            className="cl-btn"
            disabled={data.page + 1 >= totalPages || loading}
            onClick={() => onPageChange(data.page + 1)}
          >
            Trang sau
          </button>
        </div>
      </div>
    </section>
  );
};
