import React, { useState } from 'react';
import { useCashLedger } from '../../hooks/useCashLedger';
import { returnToFinance, type FinanceRoute } from '../../utils/financeNavigation';
import { CashLedgerDetailDrawer } from './CashLedgerDetailDrawer';
import { CashLedgerFilters } from './CashLedgerFilters';
import { CashLedgerSummaryCards } from './CashLedgerSummaryCards';
import { CashLedgerTable } from './CashLedgerTable';
import { CashLedgerToast, type ToastNotification } from './CashLedgerToast';
import { ManualCashDrawer } from './ManualCashDrawer';
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
    reload,
  } = useCashLedger(route, onSessionExpired);

  const [manualOpen, setManualOpen] = useState(false);
  const [toast, setToast] = useState<ToastNotification | null>(null);

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

        <div className="cl-header-actions">
          {hasDrillDownBack && (
            <button
              type="button"
              className="cl-back-link"
              onClick={() => onNavigate(returnToFinance(route))}
            >
              Quay lại báo cáo
            </button>
          )}
          <button
            type="button"
            className="cl-btn cl-btn-primary"
            onClick={() => setManualOpen(true)}
          >
            Thêm giao dịch thu chi
          </button>
        </div>
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

      <ManualCashDrawer
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSuccess={(confirmation) => {
          setManualOpen(false);
          setToast({
            id: confirmation.entryId,
            tone: 'success',
            title:
              confirmation.direction === 'IN'
                ? 'Ghi nhận giao dịch thu tiền thành công.'
                : 'Ghi nhận giao dịch chi tiền thành công.',
            detail: confirmation.reversalHint,
          });
          reload();
        }}
        onSessionExpired={onSessionExpired}
      />

      <CashLedgerToast toast={toast} onDismiss={() => setToast(null)} />
    </section>
  );
};
