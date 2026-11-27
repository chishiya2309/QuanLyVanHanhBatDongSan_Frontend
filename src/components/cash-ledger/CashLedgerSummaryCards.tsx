import React from 'react';
import type { CashLedgerSummary } from '../../types/cashLedger';
import { money } from '../reports/financePresentation';

interface Props {
  summary: CashLedgerSummary;
  hasSpecificSource: boolean;
}

export const CashLedgerSummaryCards: React.FC<Props> = ({ summary, hasSpecificSource }) => {
  const netClass = summary.netCashFlow > 0n ? 'is-income' : summary.netCashFlow < 0n ? 'is-expense' : '';
  const profitClass = summary.estimatedProfit > 0n ? 'is-income' : summary.estimatedProfit < 0n ? 'is-expense' : '';

  return (
    <section className="cl-summary-section" aria-label="Tổng hợp tài chính sổ thu chi">
      <div className="cl-summary-grid">
        <div className="cl-stat-card">
          <span className="cl-stat-label">Tổng thu</span>
          <p className="cl-stat-value is-income">{money(summary.totalIncome)}</p>
          <span className="cl-stat-hint">Tổng tiền thu trong kỳ lọc</span>
        </div>

        <div className="cl-stat-card">
          <span className="cl-stat-label">Tổng chi</span>
          <p className="cl-stat-value is-expense">{money(summary.totalExpense)}</p>
          <span className="cl-stat-hint">Tổng tiền chi trong kỳ lọc</span>
        </div>

        <div className="cl-stat-card">
          <span className="cl-stat-label">Dòng tiền ròng</span>
          <p className={`cl-stat-value ${netClass}`}>
            {summary.netCashFlow > 0n ? '+' : ''}
            {money(summary.netCashFlow)}
          </p>
          <span className="cl-stat-hint">Tổng thu trừ Tổng chi</span>
        </div>

        <div className="cl-stat-card">
          <span className="cl-stat-label">Lợi nhuận tạm tính</span>
          <p className={`cl-stat-value ${profitClass}`}>
            {summary.estimatedProfit > 0n ? '+' : ''}
            {money(summary.estimatedProfit)}
          </p>
          <span className="cl-stat-hint">Chỉ tính giao dịch ảnh hưởng lợi nhuận</span>
        </div>
      </div>

      <p className="cl-rule-note">
        {hasSpecificSource
          ? 'Đang lọc theo một nguồn tiền cụ thể: Tổng thu và Tổng chi bao gồm cả biến động chuyển quỹ nội bộ của nguồn tiền này. Tiền cọc và chuyển quỹ nội bộ không tính vào Lợi nhuận tạm tính.'
          : 'Đang xem toàn bộ sổ quỹ: Các giao dịch chuyển quỹ nội bộ giữa các ví/tài khoản được loại trừ khỏi Tổng thu và Tổng chi. Tiền cọc ký quỹ không tính vào Lợi nhuận tạm tính.'}
      </p>
    </section>
  );
};
