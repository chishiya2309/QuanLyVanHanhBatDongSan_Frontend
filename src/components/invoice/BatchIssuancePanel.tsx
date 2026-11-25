import { useEffect, useRef, useState, type FormEvent } from 'react';
import { issueInvoiceBatch, previewBatchIssuance } from '../../services/invoiceIssuanceApi';
import type {
  BatchCategory,
  BatchIssuancePreviewItem,
  BatchIssuanceResult,
  BatchIssuanceReview,
  BatchIssueRequestPayload,
} from '../../types/invoiceIssuance';
import {
  formatNotificationStatusLabel,
  formatVndExact,
  isUncertainSubmissionError,
  mapIssuanceErrorGuidance,
} from '../../utils/invoiceIssuanceHelpers';
import { draftDate } from './invoiceDraftFormat';
import './invoiceIssuance.css';

const categoryMeta: Record<BatchCategory, { label: string; badgeClass: string }> = {
  ELIGIBLE: { label: 'Đủ điều kiện', badgeClass: 'uc50-badge uc50-badge--ready' },
  NEEDS_CONFIRMATION: { label: 'Cần xác nhận riêng', badgeClass: 'uc50-badge uc50-badge--warn' },
  INELIGIBLE: { label: 'Chưa đủ điều kiện', badgeClass: 'uc50-badge uc50-badge--danger' },
  ALREADY_ISSUED: { label: 'Đã phát hành trước đó', badgeClass: 'uc50-badge uc50-badge--info' },
};

const outcomeLabels = {
  ISSUED: 'Phát hành thành công',
  ALREADY_ISSUED: 'Đã phát hành trước đó',
  SKIPPED: 'Bỏ qua',
  FAILED: 'Thất bại',
} as const;

export function BatchIssuancePanel({
  invoiceIds,
  search,
  onClose,
  onCompleted,
}: {
  invoiceIds: string[];
  search: string;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [targetIds, setTargetIds] = useState<string[]>(invoiceIds);
  const [reloadSeq, setReloadSeq] = useState(0);
  const [preview, setPreview] = useState<BatchIssuanceReview>();
  const [selectedForIssue, setSelectedForIssue] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');

  const [confirmPastDue, setConfirmPastDue] = useState(false);
  const [pastDueReason, setPastDueReason] = useState('');
  const [confirmCashOnly, setConfirmCashOnly] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [validationError, setValidationError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchIssuanceResult>();
  const [retryFailedIds, setRetryFailedIds] = useState<string[]>([]);

  const sendingRef = useRef(false);
  const attemptRef = useRef<{ key: string; payload: BatchIssueRequestPayload } | null>(null);

  function restartPreview(nextIds: string[]) {
    attemptRef.current = null;
    setPreview(undefined);
    setLoadError('');
    setValidationError('');
    setBatchResult(undefined);
    setUncertain(false);
    setTargetIds(nextIds);
    setReloadSeq(v => v + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    previewBatchIssuance(targetIds, controller.signal).then(
      data => {
        if (controller.signal.aborted) return;
        setPreview(data);
        setLoadError('');
        setSendNotification(data.defaultSendNotification);
        setSelectedForIssue(
          data.items
            .filter(item => item.category === 'ELIGIBLE' || item.category === 'NEEDS_CONFIRMATION')
            .map(item => item.invoiceId),
        );
        setConfirmPastDue(false);
        setPastDueReason('');
        setConfirmCashOnly(false);
      },
      err => {
        if (controller.signal.aborted) return;
        setPreview(undefined);
        setLoadError(mapIssuanceErrorGuidance(err, { invoiceId: targetIds[0] ?? '' }).message);
      },
    );
    return () => controller.abort();
  }, [targetIds, reloadSeq]);

  const selectedPreviewItems: BatchIssuancePreviewItem[] = preview
    ? preview.items.filter(item => selectedForIssue.includes(item.invoiceId))
    : [];
  const hasPastDueInSelection = selectedPreviewItems.some(item => item.pastDue);
  const hasCashOverrideInSelection = selectedPreviewItems.some(
    item => item.transferUnavailable && item.canConfirmCashOnly,
  );

  async function handleExecute(event: FormEvent) {
    event.preventDefault();
    if (sendingRef.current || !preview || !selectedPreviewItems.length) return;

    if (!uncertain) {
      setValidationError('');
      if (hasPastDueInSelection && !confirmPastDue) {
        setValidationError('Danh sách chọn có hóa đơn quá hạn thanh toán. Hãy tick xác nhận hoặc bỏ chọn hóa đơn đó.');
        return;
      }
      if (hasPastDueInSelection && confirmPastDue && !pastDueReason.trim()) {
        setValidationError('Vui lòng nhập lý do xác nhận phát hành quá hạn cho các hóa đơn đã qua hạn.');
        return;
      }
      if (hasCashOverrideInSelection && !confirmCashOnly) {
        setValidationError('Danh sách chọn có phòng mất kết nối chuyển khoản. Hãy xác nhận chỉ thu tiền mặt hoặc bỏ chọn hóa đơn đó.');
        return;
      }

      attemptRef.current = {
        key: crypto.randomUUID(),
        payload: {
          invoiceIds: selectedPreviewItems.map(item => item.invoiceId),
          confirmPastDue: hasPastDueInSelection && confirmPastDue,
          pastDueReason: hasPastDueInSelection && confirmPastDue ? pastDueReason.trim() : null,
          sendNotification,
          confirmedPaymentMode:
            hasCashOverrideInSelection && confirmCashOnly ? 'CASH_ONLY_OVERRIDE' : 'POLICY_DEFAULT',
          items: selectedPreviewItems.map(item => ({
            invoiceId: item.invoiceId,
            dueDate: item.dueDate,
            confirmPastDue: item.pastDue ? confirmPastDue : false,
            version: item.version,
            sourceFingerprint: item.sourceFingerprint,
            pastDueReason: item.pastDue && confirmPastDue ? pastDueReason.trim() : null,
            confirmedPaymentMode:
              item.transferUnavailable && item.canConfirmCashOnly && confirmCashOnly
                ? 'CASH_ONLY_OVERRIDE'
                : 'POLICY_DEFAULT',
          })),
        },
      };
    }

    const command = attemptRef.current;
    if (!command) return;

    sendingRef.current = true;
    setSubmitting(true);
    setValidationError('');

    try {
      const res = await issueInvoiceBatch(command.payload, command.key);
      setBatchResult(res);
      setRetryFailedIds(res.items.filter(item => item.outcome === 'FAILED').map(item => item.invoiceId));
      setUncertain(false);
      attemptRef.current = null;
      onCompleted();
    } catch (err) {
      if (isUncertainSubmissionError(err)) {
        setUncertain(true);
        setValidationError(
          'Mất kết nối hoặc quá thời gian khi phát hành hàng loạt. Bấm "Thử lại cùng lô yêu cầu" để không phát hành trùng lặp.',
        );
      } else {
        setUncertain(false);
        attemptRef.current = null;
        setValidationError(mapIssuanceErrorGuidance(err, { invoiceId: targetIds[0] ?? '' }).message);
      }
    } finally {
      sendingRef.current = false;
      setSubmitting(false);
    }
  }

  function detailHref(id: string) {
    return `/invoices/host/${encodeURIComponent(id)}${search || ''}`;
  }

  if (!preview && !loadError) {
    return (
      <section className="uc50-panel" aria-label="Xem trước phát hành hàng loạt">
        <div className="pc-skeleton" role="status">
          <p>Đang kiểm tra điều kiện phát hành cho {targetIds.length} hóa đơn…</p>
          <div />
          <div />
        </div>
      </section>
    );
  }

  if (loadError || !preview) {
    return (
      <section className="uc50-panel" aria-label="Lỗi tải danh sách phát hành hàng loạt">
        <div className="uc50-banner uc50-banner--error" role="alert">
          <strong>Chưa thể xem trước lô phát hành</strong>
          <p>{loadError || 'Không thể tải danh sách hóa đơn.'}</p>
        </div>
        <div className="uc50-actions">
          <button type="button" className="uc50-btn uc50-btn--primary" onClick={() => restartPreview(targetIds)}>
            Thử lại
          </button>
          <button type="button" className="uc50-btn" onClick={onClose}>Đóng</button>
        </div>
      </section>
    );
  }

  if (batchResult) {
    const failedItems = batchResult.items.filter(item => item.outcome === 'FAILED');
    return (
      <section className="uc50-panel" aria-label="Kết quả phát hành hàng loạt">
        <header className="uc50-header">
          <div>
            <h2>Báo cáo phát hành hàng loạt</h2>
            <p>Đã xử lý độc lập từng hóa đơn. Hóa đơn lỗi không làm hoàn tác các hóa đơn đã phát hành thành công.</p>
          </div>
          <button type="button" className="uc50-btn" onClick={onClose}>Về danh sách hóa đơn</button>
        </header>

        <dl className="uc50-totals">
          <div>
            <dt>Tổng yêu cầu</dt>
            <dd>{batchResult.totalRequested}</dd>
          </div>
          <div>
            <dt>Phát hành thành công</dt>
            <dd>{batchResult.counts.ISSUED ?? 0}</dd>
          </div>
          <div>
            <dt>Tổng tiền đã phát hành</dt>
            <dd>{formatVndExact(batchResult.totalIssuedAmount)}</dd>
          </div>
          <div>
            <dt>Đã phát hành trước đó</dt>
            <dd>{batchResult.counts.ALREADY_ISSUED ?? 0}</dd>
          </div>
          <div>
            <dt>Bỏ qua</dt>
            <dd>{batchResult.counts.SKIPPED ?? 0}</dd>
          </div>
          <div>
            <dt>Thất bại</dt>
            <dd>{batchResult.counts.FAILED ?? 0}</dd>
          </div>
        </dl>

        <div className="invoice-table" tabIndex={0}>
          <table>
            <thead>
              <tr>
                {!!failedItems.length && <th>Thử lại</th>}
                <th>Số hóa đơn / ID</th>
                <th>Kết quả phát hành</th>
                <th>Tổng tiền / Còn lại</th>
                <th>Trạng thái thông báo (UC61)</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {batchResult.items.map(item => (
                <tr key={item.invoiceId}>
                  {!!failedItems.length && (
                    <td className="uc50-select-cell">
                      {item.outcome === 'FAILED' && (
                        <input
                          type="checkbox"
                          aria-label={`Chọn thử lại ${item.invoiceId}`}
                          checked={retryFailedIds.includes(item.invoiceId)}
                          onChange={e =>
                            setRetryFailedIds(ids =>
                              e.target.checked ? [...new Set([...ids, item.invoiceId])] : ids.filter(x => x !== item.invoiceId),
                            )
                          }
                        />
                      )}
                    </td>
                  )}
                  <td>
                    <a href={detailHref(item.invoiceId)} className="uc50-code">
                      {item.invoiceNumber ?? item.invoiceId}
                    </a>
                    {item.paymentReference && (
                      <div className="uc50-muted">Mã thanh toán: <span className="uc50-code">{item.paymentReference}</span></div>
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        item.outcome === 'ISSUED'
                          ? 'uc50-badge uc50-badge--ready'
                          : item.outcome === 'FAILED'
                            ? 'uc50-badge uc50-badge--danger'
                            : 'uc50-badge uc50-badge--info'
                      }
                    >
                      {outcomeLabels[item.outcome]}
                    </span>
                  </td>
                  <td className="uc50-num">
                    {formatVndExact(item.total)} / {formatVndExact(item.remaining)}
                  </td>
                  <td>{item.notificationStatus ? formatNotificationStatusLabel(item.notificationStatus) : '—'}</td>
                  <td>{item.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="uc50-actions">
          {!!failedItems.length && (
            <button
              type="button"
              className="uc50-btn uc50-btn--primary"
              disabled={!retryFailedIds.length}
              onClick={() => restartPreview(retryFailedIds)}
            >
              Rà soát lại {retryFailedIds.length} hóa đơn thất bại
            </button>
          )}
          <button type="button" className="uc50-btn" onClick={onClose}>Hoàn tất</button>
        </div>
      </section>
    );
  }

  return (
    <section className="uc50-panel" aria-label="Rà soát phát hành hóa đơn hàng loạt">
      <header className="uc50-header">
        <div>
          <h2>Phát hành hóa đơn hàng loạt</h2>
          <p>
            Đã chọn <span className="uc50-num">{preview.totalSelected}</span> hóa đơn. Hãy rà soát phân loại trước khi xác nhận.
          </p>
        </div>
        <button type="button" className="uc50-btn" disabled={submitting} onClick={onClose}>
          Hủy và quay lại danh sách
        </button>
      </header>

      <dl className="uc50-totals">
        <div>
          <dt>Đủ điều kiện</dt>
          <dd>{preview.counts.ELIGIBLE ?? 0}</dd>
        </div>
        <div>
          <dt>Cần xác nhận riêng</dt>
          <dd>{preview.counts.NEEDS_CONFIRMATION ?? 0}</dd>
        </div>
        <div>
          <dt>Chưa đủ điều kiện</dt>
          <dd>{preview.counts.INELIGIBLE ?? 0}</dd>
        </div>
        <div>
          <dt>Đã phát hành trước đó</dt>
          <dd>{preview.counts.ALREADY_ISSUED ?? 0}</dd>
        </div>
        <div>
          <dt>Tổng tiền đủ điều kiện</dt>
          <dd>{formatVndExact(preview.totalEligibleAmount)}</dd>
        </div>
        <div>
          <dt>Dự kiến còn phải thu</dt>
          <dd>{formatVndExact(preview.totalExpectedRemaining)}</dd>
        </div>
      </dl>

      <div className="invoice-table" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>Phát hành</th>
              <th>Phòng / Khách thuê</th>
              <th>Kỳ / Hạn</th>
              <th>Tổng tiền / Còn thu</th>
              <th>Phân loại</th>
              <th>Vấn đề và hướng dẫn</th>
            </tr>
          </thead>
          <tbody>
            {preview.items.map(item => {
              const selectable = item.category === 'ELIGIBLE' || item.category === 'NEEDS_CONFIRMATION';
              const meta = categoryMeta[item.category];
              return (
                <tr key={item.invoiceId}>
                  <td className="uc50-select-cell">
                    <input
                      type="checkbox"
                      aria-label={`Chọn phát hành ${item.roomCode ?? item.invoiceId}`}
                      disabled={!selectable || submitting || uncertain}
                      checked={selectable && selectedForIssue.includes(item.invoiceId)}
                      onChange={e =>
                        setSelectedForIssue(ids =>
                          e.target.checked ? [...new Set([...ids, item.invoiceId])] : ids.filter(x => x !== item.invoiceId),
                        )
                      }
                    />
                  </td>
                  <td>
                    <a href={detailHref(item.invoiceId)}>
                      {item.roomCode ?? item.invoiceId}{item.buildingName ? ` (${item.buildingName})` : ''}
                    </a>
                    {item.customerName && <div className="uc50-muted">{item.customerName}</div>}
                  </td>
                  <td>
                    <div>{draftDate(item.fromDate)} đến {draftDate(item.toDate)}</div>
                    <div className="uc50-muted">Hạn: {draftDate(item.dueDate)}</div>
                  </td>
                  <td className="uc50-num">
                    <div>{formatVndExact(item.total)}</div>
                    <div className="uc50-muted">Còn thu: {formatVndExact(item.expectedRemaining)}</div>
                  </td>
                  <td>
                    <span className={meta.badgeClass}>{meta.label}</span>
                  </td>
                  <td>
                    <div>{item.message}</div>
                    {!!item.blockingIssues.length && (
                      <ul className="uc50-issue-list">
                        {item.blockingIssues.map((issue, idx) => (
                          <li key={idx}>{issue.message}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleExecute} className="uc50-section" noValidate>
        {hasPastDueInSelection && (
          <div className="uc50-confirm-group">
            <label className="uc50-check-label">
              <input
                type="checkbox"
                disabled={submitting || uncertain}
                checked={confirmPastDue}
                onChange={e => {
                  setConfirmPastDue(e.target.checked);
                  setValidationError('');
                }}
              />
              Xác nhận phát hành các hóa đơn có ngày đến hạn đã qua trong danh sách chọn
            </label>
            <div className="uc50-field">
              <label htmlFor="uc50-batch-past-due-reason">Lý do phát hành quá hạn cho lô</label>
              <input
                id="uc50-batch-past-due-reason"
                type="text"
                maxLength={500}
                disabled={submitting || uncertain || !confirmPastDue}
                value={pastDueReason}
                placeholder="Ví dụ: Đã thông báo lịch thu tiền cho khách trước đó"
                onChange={e => {
                  setPastDueReason(e.target.value);
                  setValidationError('');
                }}
              />
            </div>
          </div>
        )}

        {hasCashOverrideInSelection && (
          <div className="uc50-confirm-group">
            <label className="uc50-check-label">
              <input
                type="checkbox"
                disabled={submitting || uncertain}
                checked={confirmCashOnly}
                onChange={e => {
                  setConfirmCashOnly(e.target.checked);
                  setValidationError('');
                }}
              />
              Xác nhận phát hành chỉ với tiền mặt cho các phòng đang lỗi tài khoản chuyển khoản
            </label>
          </div>
        )}

        <label className="uc50-check-label">
          <input
            type="checkbox"
            disabled={submitting || uncertain}
            checked={sendNotification}
            onChange={e => setSendNotification(e.target.checked)}
          />
          Gửi thông báo hóa đơn mới (UC61) cho các hóa đơn phát hành thành công
        </label>

        {validationError && (
          <div className="uc50-banner uc50-banner--error" role="alert">
            <p>{validationError}</p>
          </div>
        )}

        <div className="uc50-actions">
          <button
            type="submit"
            className="uc50-btn uc50-btn--primary"
            disabled={!selectedForIssue.length || submitting}
          >
            {submitting
              ? 'Đang phát hành lô hóa đơn…'
              : uncertain
                ? 'Thử lại cùng lô yêu cầu'
                : `Xác nhận phát hành ${selectedForIssue.length} hóa đơn`}
          </button>
          <button type="button" className="uc50-btn" disabled={submitting || uncertain} onClick={onClose}>
            Hủy bỏ
          </button>
        </div>
      </form>
    </section>
  );
}
