import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { AuthApiError } from '../../services/authErrors';
import { exportFinancialReport, previewFinancialExport, type FinancialExportConfig,
  type FinancialFilter, type FinancialPreview, type FinancialReportType, type FinancialSnapshot } from '../../services/financialExportApi';
import { onSessionInvalidated, sessionGuard } from '../../services/sessionClient';
import { dateLabel, money, transactionCategories } from './financePresentation';
import { sameFinancialScope } from './financialExportPresentation';
import './report-export.css';
import './financial-export.css';

type SourceType = Exclude<FinancialReportType, 'COMBINED'>;
type Props = {
  type: SourceType; routeKey?: string; filter?: FinancialFilter; unavailable?: string; labels?: Record<string, string>;
  comparison?: readonly [string, string];
  onSessionExpired: () => void; onSnapshot: (snapshot: FinancialSnapshot) => void;
};
const types: Record<FinancialReportType, string> = {
  CASH_FLOW: 'Thu chi và dòng tiền', PROFIT_LOSS: 'Doanh thu, chi phí và lời lỗ',
  EXPENSE_BREAKDOWN: 'Cơ cấu chi phí', COMBINED: 'Tài chính tổng hợp',
};
export function FinancialExportButton(props: Props) {
  return <FinancialExportTrigger key={JSON.stringify([props.type, props.routeKey, props.filter])} {...props} />;
}

function FinancialExportTrigger(props: Props) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const unavailableId = useId();
  return <div className="financial-export-entry">
    <button type="button" className="report-export-trigger" ref={opener} disabled={!props.filter}
      aria-describedby={!props.filter ? unavailableId : undefined} onClick={() => setOpen(true)}>Xuất báo cáo</button>
    {!props.filter && <small id={unavailableId}>{props.unavailable ?? 'Có thể xuất sau khi báo cáo tải xong.'}</small>}
    {open && props.filter && <FinancialExportDialog {...props} filter={props.filter} onClose={() => {
      setOpen(false);
      opener.current?.focus();
    }} />}
  </div>;
}

function FinancialExportDialog({ type, filter, comparison, labels = {}, onSnapshot, onSessionExpired, onClose }: Props & {
  filter: FinancialFilter; onClose: () => void;
}) {
  const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const first = useRef<HTMLSelectElement>(null);
  const running = useRef<AbortController | null>(null);
  const fileUrl = useRef<string | null>(null);
  const [selection, setSelection] = useState<Pick<FinancialExportConfig, 'type' | 'format' | 'includeTransactions'>>(
    { type, format: 'XLSX', includeTransactions: false });
  const [attempt, setAttempt] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<{ key: string; data?: FinancialPreview; error?: string }>();
  const [error, setError] = useState('');
  const [file, setFile] = useState<{ url: string; filename: string; snapshot: FinancialSnapshot; active: () => boolean }>();
  const key = JSON.stringify([selection, attempt]);
  const current = preview?.key === key ? preview : undefined;
  const expired = useEffectEvent(onSessionExpired);
  const sessionEnded = useEffectEvent(onClose);
  const getPreview = useEffectEvent((signal: AbortSignal) => previewFinancialExport({ ...selection, filter }, signal));

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    first.current?.focus();
    const unsubscribe = onSessionInvalidated(() => {
      running.current?.abort();
      releaseFile();
      element?.close();
      sessionEnded();
    });
    return () => {
      unsubscribe();
      element?.close();
      running.current?.abort();
      releaseFile();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void getPreview(controller.signal).then(data => {
      if (!controller.signal.aborted) setPreview({ key, data });
    }).catch((failure: unknown) => {
      if (failure instanceof AuthApiError && failure.status === 401) expired();
      if (!controller.signal.aborted) setPreview({ key, error: failureMessage(failure) });
    });
    return () => controller.abort();
  }, [key]);

  function releaseFile() {
    if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
    fileUrl.current = null;
  }

  function resetResult() {
    setConfirmed(false);
    setError('');
    releaseFile();
    setFile(undefined);
  }

  function change(next: typeof selection) {
    resetResult();
    setSelection(next);
    setAttempt(value => value + 1);
  }

  function retryPreview() {
    resetResult();
    setAttempt(value => value + 1);
  }

  const approved = current?.data && (!current.data.changes.length || confirmed);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current || !approved || !current?.data) return;
    const controller = new AbortController();
    const active = sessionGuard(() => !controller.signal.aborted);
    running.current = controller;
    setPending(true);
    setError('');
    releaseFile();
    setFile(undefined);
    try {
      const result = await exportFinancialReport({ ...selection, filter }, current.data.confirmationToken, controller.signal);
      if (!active()) return;
      const url = URL.createObjectURL(result.blob);
      fileUrl.current = url;
      setFile({ filename: result.filename, snapshot: result.snapshot, url, active });
      onSnapshot(result.snapshot);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      try { link.click(); } catch { /* The manual download remains available. */ }
    } catch (failure) {
      if (failure instanceof AuthApiError && failure.status === 401) {
        onSessionExpired();
      } else if (active()) {
        if (failure instanceof AuthApiError && failure.status === 400
          && failure.message === 'Vui lòng xem trước và xác nhận lại phạm vi xuất báo cáo.') {
          retryPreview();
        }
        setError(failureMessage(failure));
      }
    } finally {
      if (running.current === controller) {
        running.current = null;
        if (!controller.signal.aborted) setPending(false);
      }
    }
  }

  const match = file && sameFinancialScope(filter, file.snapshot.scope.filter, type) && hasReport(file.snapshot, type)
    && (!comparison || (comparison[0] === file.snapshot.scope.comparisonFrom && comparison[1] === file.snapshot.scope.comparisonTo));
  function close() {
    dialog.current?.close();
    onClose();
  }
  return <dialog ref={dialog} className="report-export-dialog financial-export-dialog" aria-labelledby={title}
    onCancel={event => { event.preventDefault(); close(); }}>
    <form onSubmit={submit}>
      <header><h2 id={title}>Xuất báo cáo tài chính</h2>
        <p>Tệp dùng dữ liệu mới nhất tại thời điểm xuất.</p></header>
      <fieldset className="report-export-fields" disabled={pending}>
        <legend>Cấu hình</legend>
        <div className="report-export-pair">
          <label>Loại báo cáo
            <select ref={first} value={selection.type} onChange={event => change({ ...selection, type: event.target.value as FinancialReportType })}>
              {Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Định dạng
            <select value={selection.format} onChange={event => {
              const format = event.target.value === 'PDF' ? 'PDF' : 'XLSX';
              change({ ...selection, format, includeTransactions: format === 'XLSX' && selection.includeTransactions });
            }}>
              <option value="XLSX">Excel (.xlsx)</option>
              <option value="PDF">PDF (.pdf)</option>
            </select>
          </label>
        </div>
        {selection.format === 'XLSX'
          ? <label className="financial-export-check"><input type="checkbox" checked={selection.includeTransactions}
              onChange={event => change({ ...selection, includeTransactions: event.target.checked })} /> Bao gồm giao dịch cấu thành</label>
          : <p>Chọn Excel để tải kèm giao dịch cấu thành.</p>}
      </fieldset>
      <fieldset className="report-export-group" disabled={pending}>
        <legend>Phạm vi xuất</legend>
        {!current && <p role="status">Đang kiểm tra phạm vi…</p>}
        {current?.error && <><p role="alert" className="report-export-error">{current.error}</p>
          <button type="button" onClick={retryPreview}>Thử lại xem trước</button></>}
        {current?.data && <>
          <ScopeSummary scope={current.data.scope} labels={labels} showFunds={selection.type === 'CASH_FLOW' || selection.type === 'COMBINED'} />
          {current.data.changes.length > 0 && <div className="financial-export-warning">
            <ul>{current.data.changes.map(message => <li key={message}>{message}</li>)}</ul>
            <label className="financial-export-check"><input type="checkbox" checked={confirmed}
              onChange={event => setConfirmed(event.target.checked)} /> Tôi xác nhận phạm vi xuất đã thay đổi</label>
          </div>}
        </>}
      </fieldset>
      {error && <p role="alert" className="report-export-error">{error}</p>}
      {pending && <p role="status">Đang tạo báo cáo tài chính…</p>}
      {file && <>
        <p role="status" className="report-export-success">Báo cáo tài chính đã được tạo thành công.</p>
        {!match && <SnapshotSummary snapshot={file.snapshot} />}
      </>}
      <footer>
        <button type="button" onClick={close}>Đóng</button>
        {file && <a href={file.url} download={file.filename} onClick={event => {
          if (!file.active()) event.preventDefault();
        }}>Tải tệp</a>}
        <button type="submit" className="report-export-primary" disabled={!approved || pending}>Tải báo cáo</button>
      </footer>
    </form>
  </dialog>;
}

function failureMessage(failure: unknown) {
  return failure instanceof Error && failure.message ? failure.message : 'Không thể xuất báo cáo tài chính. Vui lòng thử lại.';
}

function hasReport(snapshot: FinancialSnapshot, type: SourceType) {
  if (type === 'CASH_FLOW') return Boolean(snapshot.cashFlow);
  if (type === 'PROFIT_LOSS') return Boolean(snapshot.profitLoss);
  return Boolean(snapshot.expenseBreakdown);
}

function ScopeSummary({ scope, labels, showFunds }: { scope: FinancialPreview['scope']; labels: Record<string, string>; showFunds: boolean }) {
  const { filter, comparisonFrom, comparisonTo } = scope;
  const name = (id?: string) => id ? labels[id] ?? id : 'Tất cả trong phạm vi quản lý';
  const rows = [
    ['Kỳ báo cáo', dateLabel(filter.fromDate) + ' – ' + dateLabel(filter.toDate)],
    ...(comparisonFrom && comparisonTo ? [['Kỳ đối chiếu', dateLabel(comparisonFrom) + ' – ' + dateLabel(comparisonTo)]] : []),
    ['Khu vực', name(filter.areaId)], ['Tòa nhà', name(filter.buildingId)],
    ['Phòng', name(filter.roomId)], ...(showFunds ? [['Nguồn tiền', name(filter.sourceId)]] : []),
    ...(filter.transactionCategory?.length ? [['Danh mục', filter.transactionCategory.map(key => transactionCategories[key] ?? key).join(', ')]] : []),
  ];
  return <dl className="financial-export-summary">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function SnapshotSummary({ snapshot }: { snapshot: FinancialSnapshot }) {
  return <section aria-label="Số liệu trong tệp">
    <h3>Số liệu trong tệp</h3>
    <dl className="financial-export-summary">
      {snapshot.cashFlow && <div><dt>Dòng tiền ròng</dt><dd>{money(snapshot.cashFlow.cashFlow)}</dd></div>}
      {snapshot.profitLoss && <div><dt>Lợi nhuận quản trị</dt><dd>{money(snapshot.profitLoss.profit)}</dd></div>}
      {snapshot.expenseBreakdown && <div><dt>Chi phí thuần</dt><dd>{money(snapshot.expenseBreakdown.current.totalNetExpense)}</dd></div>}
    </dl>
  </section>;
}
