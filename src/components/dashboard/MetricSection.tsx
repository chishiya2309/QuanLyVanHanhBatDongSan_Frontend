import React from 'react';
import type { OverviewMetrics } from '../../types/dashboard';

interface MetricSectionProps {
  metrics: OverviewMetrics;
}

export const MetricSection: React.FC<MetricSectionProps> = ({ metrics }) => {
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount);
  };

  return (
    <section className="kpis-strip" aria-label="Các chỉ số hoạt động then chốt">
      {/* 1. Tỷ lệ lấp đầy */}
      <div className="kpi-cell">
        <span className="kpi-label">Tỷ lệ lấp đầy phòng</span>
        <div className="kpi-value-row">
          <span className="kpi-number">{metrics.occupancyRate}</span>
          <span className="kpi-unit">%</span>
        </div>
        <p className="kpi-subtext">
          {metrics.occupiedRooms} / {metrics.totalRooms} phòng có khách
        </p>
      </div>

      {/* 2. Tổng doanh thu tháng này */}
      <div className="kpi-cell">
        <span className="kpi-label">Doanh thu thực thu tháng này</span>
        <div className="kpi-value-row">
          <span className="kpi-number">{formatVND(metrics.monthlyRevenueActual)}</span>
          <span className="kpi-unit">₫</span>
        </div>
        <p className="kpi-subtext has-growth">
          +{metrics.revenueGrowthMoM}% so với tháng trước (Dự kiến: {formatVND(metrics.monthlyRevenueExpected)} ₫)
        </p>
      </div>

      {/* 3. Sự cố & Bảo trì chờ xử lý */}
      <div className="kpi-cell">
        <span className="kpi-label">Sự cố chờ giải quyết</span>
        <div className="kpi-value-row">
          <span className="kpi-number">{metrics.pendingIssuesCount}</span>
          <span className="kpi-unit">yêu cầu</span>
        </div>
        <p className={`kpi-subtext ${metrics.urgentIssuesCount > 0 ? 'has-alert' : ''}`}>
          {metrics.urgentIssuesCount > 0
            ? `${metrics.urgentIssuesCount} trường hợp cần xử lý khẩn cấp`
            : 'Không có sự cố nghiêm trọng'}
        </p>
      </div>

      {/* 4. Hợp đồng sắp hết hạn */}
      <div className="kpi-cell">
        <span className="kpi-label">Hợp đồng sắp hết hạn</span>
        <div className="kpi-value-row">
          <span className="kpi-number">{metrics.expiringContractsCount}</span>
          <span className="kpi-unit">hợp đồng</span>
        </div>
        <p className="kpi-subtext">
          Đáo hạn trong vòng {metrics.expiringDaysWindow} ngày tới
        </p>
      </div>
    </section>
  );
};
