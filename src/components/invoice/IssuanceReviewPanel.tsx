import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getIssuanceReview, getIssuanceStatus, issueInvoice } from '../../services/invoiceIssuanceApi';
import type {
  ConfirmedPaymentMode,
  IssuanceResult,
  IssuanceReview,
  IssueRequestPayload,
} from '../../types/invoiceIssuance';
import {
  formatChannelList,
  formatRentalStatusLabel,
  formatVndExact,
  isUncertainSubmissionError,
  mapIssuanceErrorGuidance,
  type IssuanceErrorGuidance,
} from '../../utils/invoiceIssuanceHelpers';
import { paymentPolicyUrl } from '../../utils/roomPaymentPolicyNavigation';
import { draftDate } from './invoiceDraftFormat';
import { LineBasis } from './DraftEditor';
import './invoiceIssuance.css';

export function IssuanceReviewPanel<TIssued extends { issuance?: IssuanceResult }>({
  invoiceId,
  onCancel,
  onIssued,
  onAlreadyIssued,
}: {
  invoiceId: string;
  onCancel: () => void;
  onIssued: (detail: TIssued) => void;
  onAlreadyIssued: (result?: IssuanceResult) => void;
}) {
  const [review, setReview] = useState<IssuanceReview>();
  const [loadError, setLoadError] = useState<IssuanceErrorGuidance>();
  const [submitError, setSubmitError] = useState<IssuanceErrorGuidance>();
  const [submitting, setSubmitting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [uncertain, setUncertain] = useState(false);

  const [confirmPastDue, setConfirmPastDue] = useState(false);
  const [pastDueReason, setPastDueReason] = useState('');
  const [pastDueReasonError, setPastDueReasonError] = useState('');
  const [confirmCashOnly, setConfirmCashOnly] = useState(false);
  const [paymentModeError, setPaymentModeError] = useState('');
  const [sendNotification, setSendNotification] = useState(true);
  const [reloadSeq, setReloadSeq] = useState(0);

  const sendingRef = useRef(false);
  const attemptRef = useRef<{ key: string; payload: IssueRequestPayload } | null>(null);
  const reasonInputRef = useRef<HTMLTextAreaElement>(null);

  const returnTo = `/invoices/host/${encodeURIComponent(invoiceId)}`;

  function triggerReload() {
    attemptRef.current = null;
    setReview(undefined);
    setLoadError(undefined);
    setSubmitError(undefined);
    setUncertain(false);
    setReloadSeq(v => v + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    getIssuanceReview(invoiceId, controller.signal).then(
      data => {
        if (controller.signal.aborted) return;
        setReview(data);
        setLoadError(undefined);
        setSendNotification(data.defaultSendNotification);
        setConfirmPastDue(data.pastDueConfirmed);
        setConfirmCashOnly(false);
        setPastDueReason('');
        setPastDueReasonError('');
        setPaymentModeError('');
      },
      err => {
        if (controller.signal.aborted) return;
        setReview(undefined);
        setLoadError(mapIssuanceErrorGuidance(err, { invoiceId }));
      },
    );
    return () => controller.abort();
  }, [invoiceId, reloadSeq]);

  async function handleConfirmSubmit(event: FormEvent) {
    event.preventDefault();
    if (sendingRef.current || checkingStatus || !review || !review.canIssue) return;

    if (!uncertain) {
      let invalid = false;
      setPastDueReasonError('');
      setPaymentModeError('');

      const needsPastDueConfirmation = review.pastDue && !review.pastDueConfirmed;
      if (needsPastDueConfirmation && !confirmPastDue) {
        setPastDueReasonError('Vui lòng xác nhận phát hành với ngày đến hạn đã qua hoặc quay lại UC48 sửa hạn.');
        invalid = true;
      } else if (needsPastDueConfirmation && confirmPastDue && !pastDueReason.trim()) {
        setPastDueReasonError('Vui lòng nhập lý do xác nhận phát hành quá hạn.');
        reasonInputRef.current?.focus();
        invalid = true;
      }

      if (review.transferUnavailable && review.canConfirmCashOnly && !confirmCashOnly) {
        setPaymentModeError('Hãy cập nhật tài khoản ngân hàng (UC42) hoặc xác nhận phát hành chỉ với tiền mặt.');
        invalid = true;
      }

      if (invalid) return;

      const confirmedPaymentMode: ConfirmedPaymentMode =
        review.transferUnavailable && review.canConfirmCashOnly && confirmCashOnly
          ? 'CASH_ONLY_OVERRIDE'
          : 'POLICY_DEFAULT';

      attemptRef.current = {
        key: crypto.randomUUID(),
        payload: {
          dueDate: review.dueDate,
          confirmPastDue: review.pastDueConfirmed || confirmPastDue,
          version: review.version,
          sourceFingerprint: review.sourceFingerprint,
          pastDueReason: confirmPastDue && pastDueReason.trim() ? pastDueReason.trim() : null,
          sendNotification,
          confirmedPaymentMode,
        },
      };
    }

    const command = attemptRef.current;
    if (!command) return;

    sendingRef.current = true;
    setSubmitting(true);
    setSubmitError(undefined);

    try {
      const response = await issueInvoice<TIssued>(invoiceId, command.payload, command.key);
      setUncertain(false);
      attemptRef.current = null;
      onIssued(response);
    } catch (err) {
      if (isUncertainSubmissionError(err)) {
        setUncertain(true);
        setSubmitError({
          message: 'Kết nối bị gián đoạn khi phát hành hóa đơn. Hệ thống giữ nguyên yêu cầu để bạn kiểm tra trạng thái thực tế hoặc thử lại an toàn.',
        });
      } else {
        setUncertain(false);
        attemptRef.current = null;
        const guidance = mapIssuanceErrorGuidance(err, { invoiceId, roomId: review.room.roomId });
        setSubmitError(guidance);
      }
    } finally {
      sendingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleCheckActualStatus() {
    if (checkingStatus || submitting) return;
    setCheckingStatus(true);
    setSubmitError(undefined);
    try {
      const result = await getIssuanceStatus(invoiceId);
      setUncertain(false);
      attemptRef.current = null;
      onAlreadyIssued(result);
    } catch (err) {
      const guidance = mapIssuanceErrorGuidance(err, { invoiceId, roomId: review?.room.roomId });
      setUncertain(false);
      setSubmitError({
        message: 'Hóa đơn chưa được ghi nhận phát hành chính thức: ' + guidance.message,
        needsReloadReview: true,
      });
    } finally {
      setCheckingStatus(false);
    }
  }

  if (!review && !loadError) {
    return (
      <section className="uc50-panel" aria-label="Rà soát phát hành hóa đơn">
        <div className="pc-skeleton" role="status">
          <p>Đang kiểm tra điều kiện phát hành và tải bản rà soát UC50…</p>
          <div />
          <div />
        </div>
      </section>
    );
  }

  if (loadError || !review) {
    return (
      <section className="uc50-panel" aria-label="Không thể rà soát phát hành">
        <div className="uc50-banner uc50-banner--error" role="alert">
          <strong>Chưa thể mở giao diện phát hành hóa đơn</strong>
          <p>{loadError?.message ?? 'Không tìm thấy dữ liệu rà soát.'}</p>
        </div>
        <div className="uc50-actions">
          <button type="button" className="uc50-btn uc50-btn--primary" onClick={triggerReload}>
            Tải lại kiểm tra
          </button>
          {loadError?.fixRoute && (
            <a className="uc50-btn" href={loadError.fixRoute.href}>{loadError.fixRoute.label}</a>
          )}
          <button type="button" className="uc50-btn" onClick={onCancel}>Quay lại chi tiết nháp</button>
        </div>
      </section>
    );
  }

  const isZeroInvoice = review.total === '0';
  const needsPastDueConfirm = review.pastDue && !review.pastDueConfirmed;
  const isRentalNonActive = review.contract.rentalStatus !== 'ACTIVE';

  return (
    <section className="uc50-panel" aria-label="Rà soát và xác nhận phát hành hóa đơn">
      <header className="uc50-header">
        <div>
          <h2>Rà soát phát hành hóa đơn</h2>
          <p>
            Số hiệu dự kiến: <span className="uc50-code">{review.projectedNumber}</span>, phiên bản{' '}
            <span className="uc50-num">v{review.version}</span>
          </p>
        </div>
        <span className={review.canIssue ? 'uc50-badge uc50-badge--ready' : 'uc50-badge uc50-badge--danger'}>
          {review.canIssue ? 'Đủ điều kiện phát hành' : 'Chưa đủ điều kiện phát hành'}
        </span>
      </header>

      {!review.canIssue && (
        <div className="uc50-banner uc50-banner--error" role="alert">
          <strong>Hóa đơn chưa thể phát hành</strong>
          {review.blockingMessage && <p>{review.blockingMessage}</p>}
          {!!review.blockingIssues.length && (
            <ul className="uc50-issue-list">
              {review.blockingIssues.map((issue, idx) => (
                <li key={`${issue.code}-${idx}`}>{issue.message}</li>
              ))}
            </ul>
          )}
          <div className="uc50-actions">
            <button type="button" className="uc50-btn" onClick={onCancel}>Quay lại UC48 xử lý nháp</button>
            <a className="uc50-btn" href={paymentPolicyUrl(review.room.roomId, returnTo)}>Cấu hình thanh toán phòng (UC42)</a>
          </div>
        </div>
      )}

      {isRentalNonActive && (
        <div className="uc50-banner uc50-banner--info" role="status">
          <strong>Hóa đơn kỳ cuối / hợp đồng đã kết thúc</strong>
          <p>
            Hợp đồng <span className="uc50-code">{review.contract.contractNumber}</span> hiện ở trạng thái{' '}
            <strong>{formatRentalStatusLabel(review.contract.rentalStatus)}</strong>. Hóa đơn vẫn được phát hành cho đúng khách thuê{' '}
            <strong>{review.customer.fullName}</strong> theo kỳ tính tiền này.
          </p>
        </div>
      )}

      <section className="uc50-section" aria-label="Thông tin chứng từ và các bên">
        <h3>Thông tin phòng, hợp đồng và khách thuê</h3>
        <dl className="uc50-facts">
          <div>
            <dt>Đơn vị cho thuê (Host)</dt>
            <dd>{review.host.businessName}</dd>
          </div>
          <div>
            <dt>Bất động sản và phòng</dt>
            <dd>{review.room.code}, {review.building.name}</dd>
          </div>
          <div>
            <dt>Hợp đồng thuê</dt>
            <dd>
              <span className="uc50-code">{review.contract.contractNumber}</span> ({formatRentalStatusLabel(review.contract.rentalStatus)})
            </dd>
          </div>
          <div>
            <dt>Khách thuê đại diện</dt>
            <dd>{review.customer.fullName}{review.customer.phone ? ` (${review.customer.phone})` : ''}</dd>
          </div>
          <div>
            <dt>Kỳ tính tiền</dt>
            <dd>{draftDate(review.period.fromDate)} đến {draftDate(review.period.toDate)}</dd>
          </div>
          <div>
            <dt>Ngày đến hạn thanh toán</dt>
            <dd>
              {draftDate(review.dueDate)}{' '}
              {review.pastDue && <span className="uc50-badge uc50-badge--warn">Đã qua hạn</span>}
            </dd>
          </div>
        </dl>
      </section>

      <section className="uc50-section" aria-label="Chi tiết các dòng chi phí">
        <h3>Chi tiết dòng chi phí (từ kết quả UC49 đã xác nhận)</h3>
        <div className="invoice-table" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>Khoản phí và căn cứ tính</th>
                <th>Số lượng / tỷ lệ</th>
                <th>Đơn giá</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {review.lines.map(item => (
                <tr key={item.key}>
                  <th scope="row">
                    {item.value.name}
                    <LineBasis line={item.value} />
                  </th>
                  <td className="uc50-num">{item.value.quantity ?? '—'}</td>
                  <td className="uc50-num">{formatVndExact(item.value.unitPrice)}</td>
                  <td className="uc50-num">{formatVndExact(item.value.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="uc50-totals">
          <div>
            <dt>Tổng trước giảm trừ</dt>
            <dd>{formatVndExact(review.subtotalBeforeDiscounts)}</dd>
          </div>
          <div>
            <dt>Phụ thu</dt>
            <dd>{formatVndExact(review.surchargeTotal)}</dd>
          </div>
          <div>
            <dt>Giảm trừ {review.rentWaived ? '(có miễn tiền thuê)' : ''}</dt>
            <dd>{formatVndExact(review.discountTotal)}</dd>
          </div>
          <div className="uc50-total-highlight">
            <dt>Tổng giá trị hóa đơn</dt>
            <dd>{formatVndExact(review.total)}</dd>
          </div>
          <div>
            <dt>Đã thanh toán hợp lệ</dt>
            <dd>{formatVndExact(review.paidAmount)}</dd>
          </div>
          <div className="uc50-total-highlight">
            <dt>Dự kiến còn phải thu</dt>
            <dd>{formatVndExact(review.expectedRemaining)}</dd>
          </div>
        </dl>

        {isZeroInvoice && (
          <div className="uc50-banner uc50-banner--success" role="status">
            <strong>Hóa đơn 0 đồng: Không cần thanh toán</strong>
            <p>
              Sau khi phát hành, hệ thống tự động ghi nhận hoàn thành nghĩa vụ thanh toán (PAID), còn phải trả 0 đồng, không sinh mã QR chuyển khoản hay nhắc nợ.
            </p>
          </div>
        )}
      </section>

      {!isZeroInvoice && (
        <section className="uc50-section" aria-label="Phương thức thanh toán áp dụng">
          <h3>Phương thức thanh toán và nhận tiền</h3>
          {review.paymentInstructions ? (
            <dl className="uc50-facts">
              <div>
                <dt>Tiền mặt</dt>
                <dd>
                  {review.paymentInstructions.allowCash && review.paymentInstructions.cashRecipient
                    ? `Cho phép (${review.paymentInstructions.cashRecipient.name})`
                    : 'Không áp dụng'}
                </dd>
              </div>
              <div>
                <dt>Chuyển khoản ngân hàng</dt>
                <dd>
                  {review.paymentInstructions.allowTransfer && review.paymentInstructions.bankRecipient
                    ? `${review.paymentInstructions.bankRecipient.bankName}, STK ${review.paymentInstructions.bankRecipient.accountNumber} (${review.paymentInstructions.bankRecipient.accountHolder})`
                    : review.transferUnavailable
                      ? 'Chưa khả dụng (tài khoản nhận chưa hợp lệ hoặc ngừng hoạt động)'
                      : 'Không áp dụng'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="uc50-muted">Chưa xác định hướng dẫn thanh toán khả dụng theo UC42.</p>
          )}
        </section>
      )}

      {review.canIssue && (
        <form onSubmit={handleConfirmSubmit} className="uc50-section" noValidate>
          <h3>Xác nhận nghiệp vụ và tùy chọn thông báo</h3>

          {needsPastDueConfirm && (
            <div className="uc50-confirm-group">
              <div className="uc50-banner uc50-banner--warn" role="status">
                <strong>Cảnh báo: Ngày đến hạn thanh toán đã qua ({draftDate(review.dueDate)})</strong>
                <p>
                  Hóa đơn có thể được đánh dấu quá hạn ngay sau khi phát hành nếu vẫn còn số tiền phải thu. Bạn có thể quay lại UC48 đổi hạn hoặc xác nhận giữ nguyên ngày đến hạn kèm lý do.
                </p>
              </div>
              <label className="uc50-check-label">
                <input
                  type="checkbox"
                  disabled={submitting || uncertain}
                  checked={confirmPastDue}
                  onChange={e => {
                    setConfirmPastDue(e.target.checked);
                    setPastDueReasonError('');
                  }}
                />
                Xác nhận phát hành với ngày đến hạn đã qua
              </label>
              <div className="uc50-field">
                <label htmlFor="uc50-past-due-reason">Lý do giữ ngày đến hạn đã qua (bắt buộc khi xác nhận)</label>
                <textarea
                  ref={reasonInputRef}
                  id="uc50-past-due-reason"
                  maxLength={500}
                  disabled={submitting || uncertain || !confirmPastDue}
                  value={pastDueReason}
                  placeholder="Ví dụ: Lập muộn nhưng đã thỏa thuận hạn thanh toán với khách thuê"
                  aria-required={confirmPastDue}
                  aria-invalid={Boolean(pastDueReasonError)}
                  aria-describedby={pastDueReasonError ? 'uc50-past-due-error' : undefined}
                  onChange={e => {
                    setPastDueReason(e.target.value);
                    setPastDueReasonError('');
                  }}
                />
                <span id="uc50-past-due-error" className={pastDueReasonError ? 'uc50-helper uc50-helper--error' : 'uc50-helper'}>
                  {pastDueReasonError || 'Tối đa 500 ký tự.'}
                </span>
              </div>
            </div>
          )}

          {review.transferUnavailable && review.canConfirmCashOnly && (
            <div className="uc50-confirm-group">
              <div className="uc50-banner uc50-banner--warn" role="status">
                <strong>Phương thức chuyển khoản hiện không khả dụng</strong>
                <p>
                  Tài khoản ngân hàng mặc định của phòng chưa hợp lệ hoặc đã ngừng hoạt động. Hệ thống không tự động sửa cấu hình phòng; bạn cần chọn cập nhật tại UC42 hoặc xác nhận phát hành hóa đơn này chỉ với tiền mặt.
                </p>
                <div className="uc50-actions">
                  <a className="uc50-btn" href={paymentPolicyUrl(review.room.roomId, returnTo)}>
                    Cập nhật tài khoản nhận tiền (UC42)
                  </a>
                </div>
              </div>
              <label className="uc50-check-label">
                <input
                  type="checkbox"
                  disabled={submitting || uncertain}
                  checked={confirmCashOnly}
                  onChange={e => {
                    setConfirmCashOnly(e.target.checked);
                    setPaymentModeError('');
                  }}
                />
                Xác nhận phát hành hóa đơn này chỉ với phương thức tiền mặt
              </label>
              {paymentModeError && (
                <p role="alert" className="uc50-helper uc50-helper--error">{paymentModeError}</p>
              )}
            </div>
          )}

          <div className="uc50-confirm-group">
            <label className="uc50-check-label">
              <input
                type="checkbox"
                disabled={submitting || uncertain}
                checked={sendNotification}
                onChange={e => setSendNotification(e.target.checked)}
              />
              Gửi thông báo hóa đơn mới đến khách thuê sau khi phát hành (UC61)
            </label>
            <p className="uc50-muted">
              Kênh khả dụng của khách thuê: <strong>{formatChannelList(review.availableNotificationChannels)}</strong>.
              {!review.availableNotificationChannels.length &&
                ' Khách thuê chưa có tài khoản ứng dụng hay email; phát hành vẫn thành công và bạn có thể sao chép thông tin gửi thủ công.'}
            </p>
          </div>

          <div className="uc50-banner uc50-banner--info" role="note">
            <strong>Lưu ý bất biến</strong>
            <p>{review.immutabilityNotice}</p>
          </div>

          {submitError && (
            <div className="uc50-banner uc50-banner--error" role="alert">
              <p>{submitError.message}</p>
              <div className="uc50-actions">
                {submitError.needsReloadReview && (
                  <button type="button" className="uc50-btn" onClick={triggerReload}>
                    Tải lại bản rà soát mới nhất
                  </button>
                )}
                {submitError.fixRoute && (
                  <a className="uc50-btn" href={submitError.fixRoute.href}>{submitError.fixRoute.label}</a>
                )}
              </div>
            </div>
          )}

          <div className="uc50-actions">
            {uncertain ? (
              <>
                <button
                  type="button"
                  className="uc50-btn uc50-btn--primary"
                  disabled={checkingStatus || submitting}
                  onClick={() => void handleCheckActualStatus()}
                >
                  {checkingStatus ? 'Đang kiểm tra trạng thái…' : 'Kiểm tra trạng thái thực tế'}
                </button>
                <button type="submit" className="uc50-btn" disabled={submitting || checkingStatus}>
                  {submitting ? 'Đang gửi lại…' : 'Thử lại cùng yêu cầu'}
                </button>
              </>
            ) : (
              <>
                <button type="submit" className="uc50-btn uc50-btn--primary" disabled={submitting}>
                  {submitting ? 'Đang phát hành…' : 'Xác nhận phát hành'}
                </button>
                <button type="button" className="uc50-btn" disabled={submitting} onClick={onCancel}>
                  Hủy bỏ
                </button>
              </>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
