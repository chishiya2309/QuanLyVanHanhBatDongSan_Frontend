import React, { useEffect, useState } from 'react';
import { useAdminAutoDraftJobs } from '../../hooks/useAutoDraftBilling';
import type { AutoDraftJobStatus } from '../../types/autoDraftBilling';
import '../invoice/autoDraftBilling.css';

const statusLabels: Record<AutoDraftJobStatus, string> = {
  RUNNING: 'Đang chạy',
  COMPLETED: 'Hoàn tất',
  SKIPPED_LOCKED: 'Bỏ qua (đang khóa)',
  FAILED: 'Thất bại',
};

function todayVietnamDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}

export const AutoDraftJobsForbidden: React.FC<{ onOverview: () => void }> = ({ onOverview }) => (
  <section className="uc55-admin-page" aria-labelledby="uc55-forbidden-title">
    <h1 id="uc55-forbidden-title">Tiến trình lập hóa đơn tự động</h1>
    <p role="alert">Bạn không có quyền truy cập chức năng quản trị tiến trình nền.</p>
    <button type="button" className="uc55-btn" onClick={onOverview}>
      Về tổng quan
    </button>
  </section>
);

export const AutoDraftJobsPage: React.FC = () => {
  const [runDate, setRunDate] = useState<string>(() => todayVietnamDate());
  const {
    logs,
    page,
    hasNext,
    loading,
    triggering,
    error,
    lastRunResult,
    loadLogs,
    triggerRun,
  } = useAdminAutoDraftJobs();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Tiến trình lập hóa đơn tự động | RentOps';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <section className="uc55-admin-page" aria-labelledby="uc55-admin-title">
      <header className="uc55-admin-header">
        <div>
          <h1 id="uc55-admin-title">Tiến trình lập hóa đơn nháp tự động</h1>
          <p className="uc55-admin-subtitle">
            Lịch chạy định kỳ lúc 01:00 AM (UTC+7), khóa chống chạy song song trên cụm máy chủ và cô lập giao dịch từng phòng.
          </p>
        </div>
      </header>

      <form
        className="uc55-trigger-bar"
        onSubmit={(event) => {
          event.preventDefault();
          void triggerRun(runDate);
        }}
      >
        <label className="uc55-field">
          <span>Ngày chạy (UTC+7)</span>
          <input
            type="date"
            name="runDate"
            value={runDate}
            onChange={(event) => setRunDate(event.target.value)}
            disabled={triggering}
          />
        </label>
        <button
          type="submit"
          className="uc55-btn uc55-btn--primary"
          disabled={triggering}
        >
          {triggering ? 'Đang thực thi...' : 'Chạy tiến trình ngay'}
        </button>
        <button
          type="button"
          className="uc55-btn uc55-btn--ghost"
          onClick={() => loadLogs(page)}
          disabled={loading}
        >
          Làm mới nhật ký
        </button>
      </form>

      {error && (
        <div className="uc55-alert uc55-alert--error" role="alert">
          <span>{error}</span>
        </div>
      )}

      {lastRunResult && (
        <div className="uc55-alert uc55-alert--info" role="status">
          <strong>Kết quả lần chạy vừa kích hoạt ({lastRunResult.runDate}):</strong>{' '}
          <span>
            {statusLabels[lastRunResult.status]} — Tạo mới {lastRunResult.createdCount} nháp, chờ chỉ số{' '}
            {lastRunResult.waitingMeterCount}, lỗi {lastRunResult.errorCount}, hết hạn {lastRunResult.expiredCount}.
          </span>
        </div>
      )}

      <div className="uc55-table-wrap" role="region" aria-label="Nhật ký thực thi tiến trình tự động" tabIndex={0}>
        <table className="uc55-table">
          <thead>
            <tr>
              <th scope="col">Ngày chạy</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Bắt đầu / Kết thúc</th>
              <th scope="col">Host / Hợp đồng</th>
              <th scope="col">Đã tạo</th>
              <th scope="col">Chờ chỉ số</th>
              <th scope="col">Lỗi / Hết hạn</th>
              <th scope="col">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {loading && logs.length === 0 && (
              <tr>
                <td colSpan={8} className="uc55-table-empty">
                  Đang tải nhật ký thực thi...
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={8} className="uc55-table-empty">
                  Chưa có bản ghi nhật ký chạy tiến trình nào.
                </td>
              </tr>
            )}
            {logs.map((row) => {
              const waitingRooms = row.details?.waitingMeterRooms ?? [];
              const errorRooms = row.details?.errorRooms ?? [];
              const expiredContracts = row.details?.expiredContracts ?? [];
              const hasDetails =
                waitingRooms.length > 0 ||
                errorRooms.length > 0 ||
                expiredContracts.length > 0 ||
                Boolean(row.details?.reason) ||
                Boolean(row.details?.error);

              return (
                <tr key={row.id}>
                  <td>{row.runDate}</td>
                  <td>
                    <span className="uc55-status-tag" data-status={row.status}>
                      {statusLabels[row.status]}
                    </span>
                  </td>
                  <td>
                    <div>{formatDateTime(row.startedAt)}</div>
                    <div className="uc55-muted">{formatDateTime(row.finishedAt)}</div>
                  </td>
                  <td>
                    {row.totalHostsScanned} Host / {row.totalContractsScanned} HĐ
                  </td>
                  <td>{row.createdCount}</td>
                  <td>{row.waitingMeterCount}</td>
                  <td>
                    {row.errorCount} lỗi / {row.expiredCount} hết hạn
                  </td>
                  <td>
                    {hasDetails ? (
                      <details className="uc55-details">
                        <summary>Xem chi tiết</summary>
                        <ul>
                          {row.details?.reason && <li>Lý do: {row.details.reason}</li>}
                          {row.details?.error && <li>Lỗi hệ thống: {row.details.error}</li>}
                          {waitingRooms.length > 0 && <li>Chờ chỉ số: {waitingRooms.join(', ')}</li>}
                          {errorRooms.length > 0 && <li>Phòng lỗi: {errorRooms.join(', ')}</li>}
                          {expiredContracts.length > 0 && <li>HĐ hết hạn: {expiredContracts.join(', ')}</li>}
                        </ul>
                      </details>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(page > 0 || hasNext) && (
        <div className="uc55-pagination">
          <button
            type="button"
            className="uc55-btn"
            disabled={page === 0 || loading}
            onClick={() => loadLogs(Math.max(0, page - 1))}
          >
            Trang trước
          </button>
          <span>Trang {page + 1}</span>
          <button
            type="button"
            className="uc55-btn"
            disabled={!hasNext || loading}
            onClick={() => loadLogs(page + 1)}
          >
            Trang sau
          </button>
        </div>
      )}
    </section>
  );
};
