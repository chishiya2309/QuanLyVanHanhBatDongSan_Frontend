import './sessionSplash.css';

export function SessionSplash() {
  return (
    <main className="session-splash" aria-label="RentOps">
      <div className="session-splash-brand" aria-hidden="true">
        <svg className="session-splash-icon" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M9 22v-4h6v4" />
          <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
        </svg>
        <p className="session-splash-wordmark">RentOps</p>
      </div>
      <p className="visually-hidden" role="status">Đang kiểm tra phiên đăng nhập</p>
    </main>
  );
}
