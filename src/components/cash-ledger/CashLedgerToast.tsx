import React, { useEffect, useState } from 'react';

export interface ToastNotification {
  id: string;
  tone: 'success' | 'error' | 'warning';
  title: string;
  detail?: string;
}

interface Props {
  toast: ToastNotification | null;
  durationMs?: number;
  onDismiss: () => void;
}

export const CashLedgerToast: React.FC<Props> = ({ toast, durationMs = 5000, onDismiss }) => {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!toast || paused) return;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [toast, durationMs, paused, onDismiss]);

  if (!toast) return null;

  const isError = toast.tone === 'error';

  return (
    <div
      className={`cl-toast is-${toast.tone}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="cl-toast-icon" aria-hidden="true">
        {toast.tone === 'success' ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6.5 10.2L8.9 12.6L13.7 7.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 6.2V10.6M10 13.4V13.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        )}
      </div>

      <div className="cl-toast-body">
        <p className="cl-toast-title">{toast.title}</p>
        {toast.detail && <p className="cl-toast-detail">{toast.detail}</p>}
      </div>

      <button
        type="button"
        className="cl-toast-close"
        onClick={onDismiss}
        aria-label="Đóng thông báo"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
};
