import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { AuthApiError } from '../../services/authErrors';
import { exportReport } from '../../services/reportExportApi';
import type { ReportDateRange, ReportFormat } from '../../services/reportExportApi';
import { onSessionInvalidated, sessionGuard } from '../../services/sessionClient';
import { validExpiryDates } from '../../utils/expiringLeaseNavigation';
import { validateTrendRange } from '../../utils/occupancyAnalysisNavigation';
import './report-export.css';

type Source = {
  kind: 'occupancy' | 'expiring-leases' | 'occupancy-analysis';
  areaId?: string;
  buildingId?: string;
  fromDate?: string;
  toDate?: string;
};

type Catalog = {
  areas: readonly { id: string; name: string }[];
  buildings: readonly { id: string; name: string; areaId: string }[];
};

type Props = {
  source: Source;
  catalog?: Catalog | null;
  catalogFailed: boolean;
  onRetryCatalog: () => void;
  onSessionExpired: () => void;
};

const businessCalendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

function inheritedRange(source: Source, kind: Source['kind'], today: string): ReportDateRange | null {
  const { fromDate, toDate } = source;
  if (source.kind !== kind || !fromDate || !toDate) return null;
  const valid = kind === 'expiring-leases'
    ? validExpiryDates(fromDate, toDate)
    : validateTrendRange(fromDate, toDate, today);
  return valid ? { fromDate, toDate } : null;
}

function invalidTrendRange(range: ReportDateRange | null, today: string): boolean {
  return Boolean(range && (!range.fromDate || !range.toDate
    || !validateTrendRange(range.fromDate, range.toDate, today)));
}

function errorMessage(error: unknown, format: ReportFormat) {
  if (error instanceof AuthApiError) {
    switch (error.status) {
      case 0: return error.message || 'Không thể kết nối để xuất báo cáo. Vui lòng thử lại.';
      case 400: return 'Bộ lọc xuất báo cáo không hợp lệ. Vui lòng kiểm tra và thử lại.';
      case 403:
      case 404: return 'Bạn không có quyền xuất dữ liệu báo cáo được yêu cầu.';
      case 422: return error.message || (format === 'PDF'
        ? 'Dữ liệu vượt quá giới hạn xuất PDF. Vui lòng thu hẹp phạm vi hoặc chọn định dạng Excel.'
        : 'Dữ liệu vượt quá giới hạn xuất Excel. Vui lòng thu hẹp phạm vi.');
      case 503: return error.message || 'Không thể xuất báo cáo bất động sản lúc này. Vui lòng thử lại sau.';
      default: return 'Không thể xuất báo cáo bất động sản lúc này. Vui lòng thử lại sau.';
    }
  }
  return error instanceof Error && !(error instanceof TypeError)
    ? error.message : 'Không thể tạo hoặc tải tệp báo cáo. Vui lòng thử lại.';
}

function RangeFields({ title, defaultText, range, onChange, error, maximum }: {
  title: string;
  defaultText: string;
  range: ReportDateRange | null;
  onChange: (range: ReportDateRange | null) => void;
  error: string;
  maximum?: string;
}) {
  const id = useId();
  return <fieldset className="report-export-group">
    <legend>{title}</legend>
    <label>Chế độ
      <select value={range ? 'custom' : 'default'} onChange={event => onChange(
        event.target.value === 'custom' ? { fromDate: '', toDate: '' } : null)}>
        <option value="default">Mặc định</option>
        <option value="custom">Tùy chỉnh</option>
      </select>
    </label>
    {range ? <div className="report-export-pair">
      <label>Từ ngày
        <input type="date" value={range.fromDate} max={maximum} aria-invalid={Boolean(error)}
          aria-describedby={error ? id : undefined}
          onChange={event => onChange({ ...range, fromDate: event.target.value })} />
      </label>
      <label>Đến ngày
        <input type="date" value={range.toDate} max={maximum} aria-invalid={Boolean(error)}
          aria-describedby={error ? id : undefined}
          onChange={event => onChange({ ...range, toDate: event.target.value })} />
      </label>
    </div> : <p>{defaultText}</p>}
    {error && <p id={id} role="alert" className="report-export-error">{error}</p>}
  </fieldset>;
}

export function ReportExportButton(props: Props) {
  return <ReportExportTrigger key={JSON.stringify(props.source)} {...props} />;
}

function ReportExportTrigger(props: Props) {
  const opener = useRef<HTMLButtonElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  return <>
    <button type="button" ref={opener} className="report-export-trigger"
      onClick={() => setSource({ ...props.source })}>Xuất báo cáo tổng hợp</button>
    {source && <ReportExportDialog {...props} source={source}
      onClose={() => { setSource(null); opener.current?.focus(); }} />}
  </>;
}

function ReportExportDialog({ source, catalog, catalogFailed, onRetryCatalog, onSessionExpired, onClose }: Props & {
  onClose: () => void;
}) {
  const title = useId();
  const description = useId();
  const scopeError = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const formatInput = useRef<HTMLSelectElement>(null);
  const request = useRef<AbortController | null>(null);
  const fileUrl = useRef<string | null>(null);
  const [format, setFormat] = useState<ReportFormat>('XLSX');
  const [areaId, setArea] = useState(source.areaId ?? '');
  const [buildingId, setBuilding] = useState(source.buildingId ?? '');
  const [expiry, setExpiry] = useState(() => inheritedRange(source, 'expiring-leases', businessCalendar.format(new Date())));
  const [trend, setTrend] = useState(() => inheritedRange(source, 'occupancy-analysis', businessCalendar.format(new Date())));
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<{ url: string; filename: string; active: () => boolean } | null>(null);

  function releaseFile() {
    if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
    fileUrl.current = null;
  }

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    formatInput.current?.focus();
    return () => {
      element?.close();
      request.current?.abort();
      releaseFile();
    };
  }, []);

  useEffect(() => onSessionInvalidated(() => {
    request.current?.abort();
    releaseFile();
    dialog.current?.close();
    onClose();
  }), [onClose]);

  function close() {
    request.current?.abort();
    releaseFile();
    dialog.current?.close();
    onClose();
  }

  const today = businessCalendar.format(new Date());
  const buildings = catalog?.buildings.filter(building => !areaId || building.areaId === areaId) ?? [];
  const badArea = Boolean(areaId && catalog && !catalog.areas.some(area => area.id === areaId));
  const badBuilding = Boolean(buildingId && catalog && !buildings.some(building => building.id === buildingId));
  const unverified = Boolean((areaId || buildingId) && !catalog);
  const expiryInvalid = expiry && (!expiry.fromDate || !expiry.toDate || !validExpiryDates(expiry.fromDate, expiry.toDate));
  const trendInvalid = invalidTrendRange(trend, today);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    setAttempted(true);
    if (unverified || badArea || badBuilding || expiryInvalid
      || invalidTrendRange(trend, businessCalendar.format(new Date()))) return;

    const controller = new AbortController();
    const active = sessionGuard(() => !controller.signal.aborted && request.current === controller);
    const fileActive = sessionGuard(() => !controller.signal.aborted);
    request.current = controller;
    releaseFile();
    setFile(null);
    setPending(true);
    setError('');
    try {
      const result = await exportReport({
        format,
        ...(areaId && { areaId }),
        ...(buildingId && { buildingId }),
        ...(expiry && { expiryRange: expiry }),
        ...(trend && { trendRange: trend }),
      }, controller.signal);
      if (!active()) return;
      const url = URL.createObjectURL(result.blob);
      fileUrl.current = url;
      setFile({ url, filename: result.filename, active: fileActive });
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      try { link.click(); } catch { /* The manual link remains available. */ }
    } catch (failure) {
      // A terminal 401 invalidates the session before authenticatedFetch rejects.
      if (failure instanceof AuthApiError && failure.status === 401) {
        onSessionExpired();
        return;
      }
      if (active() && !(failure instanceof Error && failure.name === 'AbortError')) {
        setError(errorMessage(failure, format));
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        if (!controller.signal.aborted) setPending(false);
      }
    }
  }

  function preventStaleDownload(event: MouseEvent<HTMLAnchorElement>) {
    if (file?.active()) return;
    event.preventDefault();
    releaseFile();
    setFile(null);
  }

  return <dialog ref={dialog} className="report-export-dialog" aria-labelledby={title}
    aria-describedby={description} onCancel={event => { event.preventDefault(); close(); }}>
    <form onSubmit={submit} noValidate>
      <header>
        <h2 id={title}>Xuất báo cáo tổng hợp</h2>
        <p id={description}>Gồm phòng trống, hợp đồng sắp hết hạn và tỷ lệ lấp đầy.</p>
      </header>
      <fieldset className="report-export-fields" disabled={pending}>
        <label>Định dạng
          <select ref={formatInput} value={format} onChange={event => setFormat(event.target.value === 'PDF' ? 'PDF' : 'XLSX')}>
            <option value="XLSX">Excel (.xlsx)</option>
            <option value="PDF">PDF (.pdf)</option>
          </select>
        </label>
        <fieldset className="report-export-group">
          <legend>Phạm vi</legend>
          <div className="report-export-pair">
            <label>Khu vực
              <select value={areaId} disabled={!catalog} aria-invalid={badArea}
                aria-describedby={badArea ? scopeError : undefined} onChange={event => {
                  const next = event.target.value;
                  setArea(next);
                  if (next && !catalog?.buildings.some(item => item.id === buildingId && item.areaId === next)) setBuilding('');
                }}>
                <option value="">Tất cả khu vực</option>
                {areaId && (!catalog || badArea) && <option value={areaId}>Khu vực đã chọn</option>}
                {catalog?.areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select>
            </label>
            <label>Tòa nhà
              <select value={buildingId} disabled={!catalog} aria-invalid={badBuilding}
                aria-describedby={badBuilding ? scopeError : undefined} onChange={event => setBuilding(event.target.value)}>
                <option value="">Tất cả tòa nhà</option>
                {buildingId && (!catalog || badBuilding) && <option value={buildingId}>Tòa nhà đã chọn</option>}
                {buildings.map(building => <option key={building.id} value={building.id}>{building.name}</option>)}
              </select>
            </label>
          </div>
          {!catalog && <p role="status">{catalogFailed ? 'Không thể tải danh mục khu vực và tòa nhà.' : 'Đang tải danh mục…'}
            {catalogFailed && <> <button type="button" onClick={onRetryCatalog}>Tải lại danh mục</button></>}
          </p>}
          {(badArea || badBuilding) && <p id={scopeError} role="alert" className="report-export-error">
            Phạm vi đã chọn không khả dụng. Vui lòng chọn lại khu vực hoặc tòa nhà.
          </p>}
        </fieldset>
        <RangeFields title="Ngày hết hạn hợp đồng" defaultText="Theo cài đặt theo dõi hợp đồng của bạn."
          range={expiry} onChange={setExpiry}
          error={attempted && expiryInvalid ? 'Nhập đủ hai ngày theo thứ tự, cách nhau tối đa 366 ngày.' : ''} />
        <RangeFields title="Xu hướng tỷ lệ lấp đầy" defaultText="Từ đầu năm đến ngày nghiệp vụ."
          range={trend} onChange={setTrend} maximum={today}
          error={attempted && trendInvalid ? 'Nhập đủ hai ngày theo thứ tự, cách nhau tối đa 366 ngày. Ngày kết thúc không được vượt ngày nghiệp vụ.' : ''} />
      </fieldset>
      <div role="status" aria-live="polite">
        {pending && <p>Đang tạo báo cáo…</p>}
        {file && <p className="report-export-success">Đã tạo báo cáo thành công. Tệp đã sẵn sàng để tải xuống.</p>}
      </div>
      {error && <p role="alert" className="report-export-error">{error}</p>}
      <footer>
        {file && <a href={file.url} download={file.filename} onClick={preventStaleDownload}>Tải thủ công</a>}
        <button type="button" onClick={close}>Đóng</button>
        <button className="report-export-primary" type="submit" disabled={pending || unverified || badArea || badBuilding}>
          Tải báo cáo
        </button>
      </footer>
    </form>
  </dialog>;
}
