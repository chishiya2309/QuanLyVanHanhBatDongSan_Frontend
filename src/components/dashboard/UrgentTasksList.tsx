import React, { useState } from 'react';
import type { UrgentAlertItem } from '../../types/dashboard';

interface UrgentTasksListProps {
  alerts: UrgentAlertItem[];
}

export const UrgentTasksList: React.FC<UrgentTasksListProps> = ({ alerts }) => {
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const handleAction = (alert: UrgentAlertItem) => {
    setFeedbackMsg(`Đã kích hoạt: "${alert.actionText}" cho ${alert.roomNumber}`);
    setResolvedIds((prev) => [...prev, alert.id]);

    setTimeout(() => {
      setFeedbackMsg(null);
    }, 2500);
  };

  const getSeverityLabel = (severity: UrgentAlertItem['severity']) => {
    switch (severity) {
      case 'critical':
        return 'Khẩn cấp';
      case 'warning':
        return 'Cần xử lý';
      case 'info':
        return 'Thông tin';
    }
  };

  return (
    <div className="dash-panel" style={{ flex: 1.2 }}>
      <div className="dash-panel-header">
        <div className="panel-title-group">
          <h3>Cảnh báo &amp; Việc khẩn cấp</h3>
          <p>Yêu cầu từ khách thuê và sự cố tòa nhà</p>
        </div>
        <button type="button" className="panel-action-link">
          Xem tất cả ({alerts.length})
        </button>
      </div>

      {feedbackMsg && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: '10px',
            background: 'var(--color-status-success-wash)',
            border: '1px solid var(--color-success)',
            borderRadius: '4px',
            fontSize: '12px',
            color: 'var(--color-success)',
            fontWeight: 500,
          }}
        >
          {feedbackMsg}
        </div>
      )}

      <div className="urgent-list">
        {alerts.map((item) => {
          const isResolved = resolvedIds.includes(item.id);

          return (
            <div
              key={item.id}
              className="urgent-item"
              style={{
                opacity: isResolved ? 0.5 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              <div className="urgent-item-header">
                <span className="urgent-room-tag">
                  {item.roomNumber} • {item.propertyName}
                </span>
                <span className={`urgent-severity-pill ${item.severity}`}>
                  {getSeverityLabel(item.severity)}
                </span>
              </div>

              <h4 className="urgent-title">{item.title}</h4>
              <p className="urgent-desc">{item.description}</p>

              <div className="urgent-footer">
                <span className="urgent-time">{item.daysDiffText}</span>
                <button
                  type="button"
                  className="urgent-btn"
                  onClick={() => handleAction(item)}
                  disabled={isResolved}
                >
                  {isResolved ? '✓ Đã gửi xử lý' : item.actionText}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
