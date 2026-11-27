import React from 'react';
import { useCashLedger } from '../../hooks/useCashLedger';
import { returnToFinance, type FinanceRoute } from '../../utils/financeNavigation';
import { CashLedgerDetailDrawer } from './CashLedgerDetailDrawer';
import { CashLedgerFilters } from './CashLedgerFilters';
import { CashLedgerSummaryCards } from './CashLedgerSummaryCards';
import { CashLedgerTable } from './CashLedgerTable';
import './cashLedger.css';

interface Props {
  route: FinanceRoute;
  onNavigate: (url: string) => void;
  onSessionExpired: (message?: string) => void;
  onOpenInvoice?: (invoiceId: string) => void;
}

export const CashLedgerPage: React.FC<Props> = ({
  route,
  onNavigate,
  onSessionExpired,
  onOpenInvoice,
}) => {
  const {
    draftFilter,
    setDraftFilter,
    appliedFilter,
    setPage,
    setSize,
    data,
    loading,
    error,
    forbidden,
    filterError,
    catalog,
    selectedEntryId,
    detail,
    detailLoading,
    detailError,
    applyFilters,
    resetFilters,
    openDetail,
    closeDetail,
  } = useCashLedger(route, onSessionExpired);

  const hasDrillDownBack = Boolean(route.reportSearch || route.profitLossSearch || route.expenseBreakdownSearch);

  if (forbidden) {
    return (
      <section className="cl-page">
        <div className="cl-alert is-error" role="alert">
          {forbidden}
        </div>
      </section>
    );
  }

  return (
    <section className="cl-page" aria-label="Sổ thu chi">
      <header className="cl-header">
        <div className="cl-header-text">
          <h1 className="cl-title">Sổ thu chi</h1>
          <p className="cl-subtitle">
            Theo dõi, lọc đa tiêu chí các giao dịch Thu &amp; Chi, dòng tiền ròng và lợi nhuận tạm tính trong kỳ.
          </p>
        </div>

        {hasDrillDownBack && (
          <button
            type="button"
            className="cl-back-link"
            onClick={() => onNavigate(returnToFinance(route))}
          >
            Quay lại báo cáo
          </button>
        )}
      </header>

      {data && (
        <CashLedgerSummaryCards
          summary={data.summary}
          hasSpecificSource={Boolean(appliedFilter.sourceId)}
        />
      )}

      <CashLedgerFilters
        filter={draftFilter}
        catalog={catalog}
        filterError={filterError}
        onChange={setDraftFilter}
        onSubmit={applyFilters}
        onReset={resetFilters}
      />

      {error && (
        <div className="cl-alert is-error" role="alert">
          {error}
        </div>
      )}

      <CashLedgerTable
        data={data}
        loading={loading}
        selectedEntryId={selectedEntryId}
        onSelectEntry={openDetail}
        onPageChange={setPage}
        onSizeChange={(nextSize) => {
          setSize(nextSize);
          setPage(0);
        }}
        onResetFilters={resetFilters}
      />

      <CashLedgerDetailDrawer
        open={selectedEntryId !== null}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onClose={closeDetail}
        onSelectRelatedEntry={openDetail}
        onOpenInvoice={onOpenInvoice}
      />
    </section>
  );
};
