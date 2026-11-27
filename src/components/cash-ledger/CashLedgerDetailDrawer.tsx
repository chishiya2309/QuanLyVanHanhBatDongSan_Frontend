import React, { useEffect, useState } from 'react';
import { fetchAttachmentBlob } from '../../services/cashLedgerApi';
import type { CashLedgerAttachmentItem, CashLedgerDetail } from '../../types/cashLedger';
import { money, timestampLabel } from '../reports/financePresentation';

interface Props {
  open: boolean;
  detail: CashLedgerDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSelectRelatedEntry: (entryId: string) => void;
  onOpenInvoice?: (invoiceId: string) => void;
}

const ORIGIN_LABELS: Record<string, string> = {
  INVOICE_PAYMENT: 'Thanh toán hóa đơn',
  DEPOSIT_RECEIPT: 'Nhận tiền cọc',
  DEPOSIT_REFUND: 'Hoàn tiền cọc',
  MANUAL: 'Thu chi thủ công',
  REVERSAL: 'Đảo ngược / điều chỉnh',
  INTERNAL_TRANSFER: 'Chuyển quỹ nội bộ',
};

export const CashLedgerDetailDrawer: React.FC<Props> = ({
  open,
  detail,
  loading,
  error,
  onClose,
  onSelectRelatedEntry,
  onOpenInvoice,
}) => {
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (lightboxImage) setLightboxImage(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, lightboxImage, onClose]);

  useEffect(() => {
    if (!open || !detail || detail.attachments.length === 0) {
      return;
    }
    const controller = new AbortController();
    const createdUrls: string[] = [];

    const loadThumbnails = async () => {
      const next: Record<string, string> = {};
      for (const att of detail.attachments) {
        if (!att.contentType.startsWith('image/')) continue;
        try {
          const { objectUrl } = await fetchAttachmentBlob(detail.id, att.id, true, controller.signal);
          if (controller.signal.aborted) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          createdUrls.push(objectUrl);
          next[att.id] = objectUrl;
        } catch {
          // Thumbnail fallback handled gracefully
        }
      }
      if (!controller.signal.aborted) {
        setThumbUrls(next);
      }
    };

    void loadThumbnails();
    return () => {
      controller.abort();
      for (const url of createdUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [open, detail]);

  if (!open) return null;

  const handleDownload = async (att: CashLedgerAttachmentItem) => {
    if (!detail) return;
    setDownloadError(null);
    try {
      const { objectUrl } = await fetchAttachmentBlob(detail.id, att.id, false);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = att.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Không thể tải tệp chứng từ.');
    }
  };

  return (
    <div
      className="cl-drawer-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="cl-drawer" role="dialog" aria-modal="true" aria-label="Chi tiết giao dịch thu chi">
        <header className="cl-drawer-header">
          <h2 className="cl-drawer-title">
            {detail ? `Chứng từ ${detail.voucherCode}` : 'Chi tiết giao dịch'}
          </h2>
          <button type="button" className="cl-drawer-close" onClick={onClose}>
            Đóng
          </button>
        </header>

        <div className="cl-drawer-body">
          {loading && <p>Đang tải chi tiết giao dịch...</p>}
          {error && <div className="cl-alert is-error" role="alert">{error}</div>}

          {!loading && !error && detail && (
            <>
              {detail.profitWarning && (
                <div className="cl-alert is-warn" role="status">
                  {detail.profitWarning}
                </div>
              )}

              {(detail.isReversal || detail.isReversed) && (
                <div className="cl-alert is-warn" role="status">
                  {detail.isReversal
                    ? 'Bút toán đảo ngược/điều chỉnh'
                    : 'Giao dịch gốc này đã bị đảo ngược'}
                  {detail.reversalReason ? ` — Lý do: ${detail.reversalReason}` : ''}
                </div>
              )}

              <dl className="cl-detail-list">
                <dt>Mã chứng từ</dt>
                <dd>{detail.voucherCode}</dd>

                <dt>Ngày phát sinh thực tế</dt>
                <dd>{timestampLabel(detail.occurredAt)}</dd>

                <dt>Ngày ghi sổ</dt>
                <dd>{timestampLabel(detail.recordedAt)}</dd>

                <dt>Hướng dòng tiền</dt>
                <dd>
                  <span className={`cl-badge ${detail.direction === 'IN' ? 'is-in' : 'is-out'}`}>
                    {detail.direction === 'IN' ? 'Thu (+)' : 'Chi (-)'}
                  </span>
                </dd>

                <dt>Số tiền</dt>
                <dd>
                  <span className={`cl-money ${detail.direction === 'IN' ? 'is-in' : 'is-out'}`}>
                    {detail.direction === 'IN' ? '+' : '-'}
                    {money(detail.amount)}
                  </span>
                </dd>

                <dt>Danh mục</dt>
                <dd>{detail.categoryName ?? detail.categoryCode ?? 'Chưa phân loại'}</dd>

                <dt>Nguồn tiền</dt>
                <dd>
                  {detail.sourceName ?? detail.sourceId ?? '—'}
                  {detail.sourceType ? ` (${detail.sourceType === 'BANK' ? 'Ngân hàng' : 'Tiền mặt'})` : ''}
                </dd>

                <dt>Phạm vi áp dụng</dt>
                <dd>{detail.scopeLabel}</dd>

                <dt>Tính vào lợi nhuận</dt>
                <dd>{detail.affectsProfit ? 'Có tính vào lợi nhuận' : 'Không tính vào lợi nhuận'}</dd>

                <dt>Nguồn phát sinh</dt>
                <dd>{ORIGIN_LABELS[detail.origin] ?? detail.origin}</dd>

                {detail.origin === 'INTERNAL_TRANSFER' && (
                  <>
                    <dt>Nguồn tiền đi</dt>
                    <dd>{detail.fromSourceName ?? detail.fromSourceId ?? '—'}</dd>
                    <dt>Nguồn tiền đến</dt>
                    <dd>{detail.toSourceName ?? detail.toSourceId ?? '—'}</dd>
                  </>
                )}

                {detail.invoiceNumber && (
                  <>
                    <dt>Số hiệu hóa đơn gốc</dt>
                    <dd>{detail.invoiceNumber}</dd>
                  </>
                )}

                {detail.depositId && (
                  <>
                    <dt>Mã hợp đồng cọc</dt>
                    <dd>{detail.depositId}</dd>
                  </>
                )}

                {detail.settlementId && (
                  <>
                    <dt>Mã hồ sơ thanh lý</dt>
                    <dd>{detail.settlementId}</dd>
                  </>
                )}

                <dt>Ghi chú</dt>
                <dd>{detail.note || 'Không có ghi chú'}</dd>
              </dl>

              <div className="cl-detail-actions">
                {detail.invoiceId && onOpenInvoice && (
                  <button
                    type="button"
                    className="cl-link-btn"
                    onClick={() => onOpenInvoice(detail.invoiceId!)}
                  >
                    Xem hóa đơn liên quan
                  </button>
                )}

                {detail.originalEntryId && (
                  <button
                    type="button"
                    className="cl-link-btn"
                    onClick={() => onSelectRelatedEntry(detail.originalEntryId!)}
                  >
                    Đối chiếu bản ghi gốc
                  </button>
                )}

                {detail.reversalEntryId && (
                  <button
                    type="button"
                    className="cl-link-btn"
                    onClick={() => onSelectRelatedEntry(detail.reversalEntryId!)}
                  >
                    Xem bút toán đảo ngược
                  </button>
                )}
              </div>

              <div>
                <h3 className="cl-label">Chứng từ đính kèm ({detail.attachments.length})</h3>
                {downloadError && <div className="cl-alert is-error" role="alert">{downloadError}</div>}
                {detail.attachments.length === 0 ? (
                  <p className="cl-stat-hint">Không có tệp chứng từ đính kèm.</p>
                ) : (
                  <div className="cl-attachments-grid">
                    {detail.attachments.map((att) => {
                      const thumbUrl = thumbUrls[att.id];
                      return (
                        <div key={att.id} className="cl-attachment-item">
                          {thumbUrl ? (
                            <button
                              type="button"
                              className="cl-attachment-thumb"
                              onClick={() => setLightboxImage({ url: thumbUrl, name: att.fileName })}
                              aria-label={`Xem kích thước đầy đủ ${att.fileName}`}
                            >
                              <img src={thumbUrl} alt={att.fileName} className="cl-attachment-thumb" />
                            </button>
                          ) : (
                            <div className="cl-attachment-thumb" style={{ display: 'grid', placeItems: 'center' }}>
                              <span className="cl-stat-hint">Tệp đính kèm</span>
                            </div>
                          )}
                          <span className="cl-attachment-name" title={att.fileName}>{att.fileName}</span>
                          <button
                            type="button"
                            className="cl-btn"
                            onClick={() => void handleDownload(att)}
                          >
                            Tải chứng từ
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>

      {lightboxImage && (
        <div
          className="cl-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={lightboxImage.name}
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightboxImage(null);
          }}
        >
          <div className="cl-lightbox-content">
            <img src={lightboxImage.url} alt={lightboxImage.name} className="cl-lightbox-img" />
            <button type="button" className="cl-btn" onClick={() => setLightboxImage(null)}>
              Đóng ảnh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
