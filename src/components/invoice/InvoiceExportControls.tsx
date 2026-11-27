import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { AuthApiError } from '../../services/authErrors';
import { documentTemplateApi } from '../../services/documentTemplateApi';
import type { InvoiceRole } from '../../services/invoiceApi';
import {
  downloadInvoiceExport, exportInvoice, exportInvoiceBatch, fetchInvoiceExportFile, previewInvoice,
  type InvoiceBatchResult, type InvoiceExportFile, type InvoiceExportFormat,
} from '../../services/invoiceExportApi';
import type { DocumentTemplate } from '../../types/documentTemplate';
import { buildDocumentTemplateUrl } from '../../utils/documentTemplateNavigation';
import './invoiceExport.css';

const missingTemplate = 'Chưa thiết lập mẫu biểu hóa đơn hợp lệ. Vui lòng kiểm tra cấu hình mẫu biểu trước khi xuất';
const forbidden = 'Bạn không có quyền xuất hóa đơn này';
export const invoiceBatchExportLimit = 50;

function useExportOperation() {
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => active.current?.abort(), []);

  async function run(work: (signal: AbortSignal) => Promise<void>) {
    if (active.current) return;
    const request = new AbortController();
    active.current = request;
    setBusy(true);
    setError('');
    try {
      await work(request.signal);
    } catch (cause) {
      if (request.signal.aborted || (cause instanceof Error && cause.name === 'AbortError')) return;
      setError(cause instanceof AuthApiError && cause.status === 403
        ? forbidden
        : cause instanceof Error ? cause.message : 'Chưa thể xử lý yêu cầu xuất hóa đơn.');
    } finally {
      active.current = null;
      if (!request.signal.aborted) setBusy(false);
    }
  }

  return { busy, error, run };
}

function ExportError({ error, host }: { error: string; host: boolean }) {
  if (!error) return null;
  return (
    <p className="uc53-error" role="alert">
      {error}
      {host && error === missingTemplate && (
        <> <a href={buildDocumentTemplateUrl({ type: 'INVOICE' })}>Quản lý mẫu biểu</a></>
      )}
    </p>
  );
}

function ExportDialog({ title, onClose, children, preview = false, busy = false, opener }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  preview?: boolean;
  busy?: boolean;
  opener?: RefObject<HTMLButtonElement | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = opener?.current ?? document.activeElement;
    element?.showModal();
    return () => {
      if (element?.open) element.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [opener]);
  return (
    <dialog ref={dialog} className={preview ? 'uc53-dialog uc53-dialog--preview' : 'uc53-dialog'}
      aria-labelledby={titleId}
      onCancel={event => { if (busy) event.preventDefault(); }}
      onClose={event => { if (!event.currentTarget.open) onClose(); }}>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}

export function IssuedInvoiceExport({ role, id }: { role: InvoiceRole; id: string }) {
  const { busy, error, run } = useExportOperation();
  const [retry, setRetry] = useState<InvoiceExportFile>();
  const [success, setSuccess] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [templates, setTemplates] = useState<DocumentTemplate[]>();
  const [templateError, setTemplateError] = useState('');
  const [format, setFormat] = useState<InvoiceExportFormat>('PDF');
  const [templateId, setTemplateId] = useState('');

  useEffect(() => {
    if (!optionsOpen) return;
    let current = true;
    documentTemplateApi.getTemplates({ type: 'INVOICE', active: true }).then(
      items => { if (current) setTemplates(items.filter(item => item.type === 'INVOICE' && item.active)); },
      cause => { if (current) setTemplateError(cause instanceof Error ? cause.message : 'Chưa tải được danh sách mẫu.'); },
    );
    return () => { current = false; };
  }, [optionsOpen]);

  async function download(file: InvoiceExportFile, signal: AbortSignal) {
    setRetry(file);
    await downloadInvoiceExport(file, signal);
    setRetry(undefined);
    setSuccess(true);
  }

  function start(useOptions: boolean) {
    void run(async signal => {
      setRetry(undefined);
      setSuccess(false);
      let templateVersionId: string | undefined;
      if (useOptions && templateId) {
        const template = await documentTemplateApi.getTemplateDetail(templateId);
        if (signal.aborted) return;
        templateVersionId = template.versions.find(version => version.versionNo === template.currentVersionNo)?.id;
        if (!template.active || template.type !== 'INVOICE' || !templateVersionId) throw new Error(missingTemplate);
      }
      const result = await exportInvoice(role, id, signal, useOptions ? { format, templateVersionId } : undefined);
      await download(result, signal);
    });
  }

  function closeOptions() {
    setOptionsOpen(false);
  }

  const feedback = (
    <>
      {busy && <p role="status">Đang xử lý yêu cầu xuất hóa đơn…</p>}
      {success && !busy && <p role="status">Đã xuất hóa đơn và bắt đầu tải tệp.</p>}
      <ExportError error={retry && error ? `Hóa đơn đã được xuất nhưng chưa tải được tệp. ${error}` : error}
        host={role === 'host'} />
      {retry && !busy && (
        <button type="button" className="uc50-btn" onClick={() => void run(signal => download(retry, signal))}>
          Thử tải lại tệp đã xuất
        </button>
      )}
    </>
  );

  return (
    <div className="uc53-controls uc52-no-print">
      <div className="invoice-actions">
        <button type="button" className="uc50-btn uc50-btn--primary" disabled={busy} onClick={() => start(false)}>
          {role === 'host' ? 'Xuất hóa đơn (PDF)' : 'Tải hóa đơn (PDF)'}
        </button>
        {role === 'host' && (
          <button type="button" className="uc50-btn" disabled={busy} onClick={() => {
            setTemplates(undefined);
            setTemplateError('');
            setTemplateId('');
            setFormat('PDF');
            setOptionsOpen(true);
          }}>Tùy chọn xuất</button>
        )}
      </div>
      {!optionsOpen && feedback}
      {optionsOpen && (
        <ExportDialog title="Tùy chọn xuất hóa đơn" onClose={closeOptions}>
          <form onSubmit={event => { event.preventDefault(); start(true); }}>
            <label>
              Định dạng
              <select value={format} disabled={busy} onChange={event => setFormat(event.target.value === 'DOCX' ? 'DOCX' : 'PDF')}>
                <option value="PDF">PDF</option>
                <option value="DOCX">DOCX</option>
              </select>
            </label>
            <label>
              Mẫu biểu
              <select value={templateId} disabled={busy || !templates} onChange={event => setTemplateId(event.target.value)}>
                <option value="">Mẫu mặc định</option>
                {templates?.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
            </label>
            {!templates && !templateError && <p role="status">Đang tải mẫu biểu…</p>}
            <ExportError error={templateError} host />
            {feedback}
            <div className="invoice-actions">
              <button type="button" className="uc50-btn" onClick={closeOptions}>Đóng</button>
              <button type="submit" className="uc50-btn uc50-btn--primary" disabled={busy}>Xuất hóa đơn</button>
            </div>
          </form>
        </ExportDialog>
      )}
    </div>
  );
}

export function DraftInvoicePreview({ id }: { id: string }) {
  const { busy, error, run } = useExportOperation();
  const opener = useRef<HTMLButtonElement>(null);
  const [pdf, setPdf] = useState('');
  useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf); }, [pdf]);

  return (
    <div className="uc53-controls uc52-no-print">
      <button ref={opener} type="button" className="uc50-btn" disabled={busy} onClick={() => void run(async signal => {
        const preview = await previewInvoice(id, signal);
        const blob = await fetchInvoiceExportFile(preview.previewUrl, signal);
        if (blob.type !== 'application/pdf') throw new Error('Tệp xem trước không đúng định dạng PDF.');
        setPdf(URL.createObjectURL(blob));
      })}>Xem trước bản in</button>
      {busy && <p role="status">Đang tạo bản xem trước…</p>}
      <ExportError error={error} host />
      {pdf && (
        <ExportDialog title="Xem trước bản in hóa đơn nháp" onClose={() => setPdf('')} preview opener={opener}>
          <iframe title="PDF hóa đơn bản nháp" src={pdf} />
          <div className="invoice-actions">
            <a href={pdf} target="_blank" rel="noopener noreferrer">Mở PDF trong tab mới</a>
            <button type="button" className="uc50-btn" onClick={() => setPdf('')}>Đóng</button>
          </div>
        </ExportDialog>
      )}
    </div>
  );
}

export interface InvoiceExportSelection {
  id: string;
  label: string;
}

export function InvoiceBatchExport({ selected, onClear }: {
  selected: InvoiceExportSelection[];
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="uc53-controls uc52-no-print" aria-label="Xuất hóa đơn hàng loạt">
      <div className="invoice-actions">
        <span>Đã chọn {selected.length}/{invoiceBatchExportLimit} hóa đơn để xuất</span>
        <button type="button" className="uc50-btn" disabled={!selected.length} onClick={() => setOpen(true)}>
          Xuất hóa đơn hàng loạt
        </button>
        {selected.length > 0 && <button type="button" className="uc50-btn" onClick={onClear}>Bỏ chọn hóa đơn xuất</button>}
      </div>
      <p>{selected.length === invoiceBatchExportLimit ? 'Đã đạt giới hạn 50 hóa đơn mỗi lô.' : 'Chỉ chọn được hóa đơn đã phát hành.'}</p>
      {open && <BatchExportDialog selected={selected} onClose={() => setOpen(false)} />}
    </section>
  );
}

function BatchExportDialog({ selected, onClose }: { selected: InvoiceExportSelection[]; onClose: () => void }) {
  const { busy, error, run } = useExportOperation();
  const [result, setResult] = useState<InvoiceBatchResult>();
  const [downloaded, setDownloaded] = useState(false);
  const labels = new Map(selected.map(item => [item.id, item.label]));
  return (
    <ExportDialog title={result ? 'Kết quả xuất hóa đơn' : 'Xác nhận xuất hóa đơn hàng loạt'} onClose={onClose} busy={busy}>
      {result ? (
        <>
          <p role="status">Thành công: {result.successCount}. Thất bại: {result.failedCount}.</p>
          {result.failures.length > 0 && (
            <ul className="uc53-list" aria-label="Hóa đơn xuất lỗi">
              {result.failures.map(item => (
                <li key={item.invoiceId}>{item.invoiceNumber || labels.get(item.invoiceId) || item.invoiceId}: {item.reason}</li>
              ))}
            </ul>
          )}
          {downloaded && <p role="status">Đã bắt đầu tải tệp ZIP.</p>}
        </>
      ) : (
        <ul className="uc53-list" aria-label="Hóa đơn sẽ xuất">
          {selected.map(item => <li key={item.id}>{item.label}</li>)}
        </ul>
      )}
      {busy && <p role="status">{result ? 'Đang tải tệp ZIP…' : 'Đang xuất hóa đơn…'}</p>}
      <ExportError error={error} host />
      <div className="invoice-actions">
        <button type="button" className="uc50-btn" disabled={busy} onClick={onClose}>{result ? 'Đóng' : 'Hủy'}</button>
        {result ? (
          <button type="button" className="uc50-btn uc50-btn--primary" disabled={busy} onClick={() => void run(async signal => {
            setDownloaded(false);
            await downloadInvoiceExport(result, signal);
            setDownloaded(true);
          })}>Tải tệp ZIP</button>
        ) : (
          <button type="button" className="uc50-btn uc50-btn--primary" disabled={busy} onClick={() => void run(async signal => {
            setResult(await exportInvoiceBatch(selected.map(item => item.id), signal));
          })}>Xác nhận xuất hàng loạt</button>
        )}
      </div>
    </ExportDialog>
  );
}
