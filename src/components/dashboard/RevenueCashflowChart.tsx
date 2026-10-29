import React, { useState } from 'react';
import type { RevenueMonthlyPoint } from '../../types/dashboard';

interface RevenueCashflowChartProps {
  data: RevenueMonthlyPoint[];
}

export const RevenueCashflowChart: React.FC<RevenueCashflowChartProps> = ({ data }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Maximum value for scaling (e.g. 180.000.000)
  const maxRevenue = 180000000;
  const chartHeight = 160;
  const chartWidth = 520;
  const paddingLeft = 40;
  const paddingBottom = 26;
  const availableWidth = chartWidth - paddingLeft;
  const availableHeight = chartHeight - paddingBottom;

  const formatShortVND = (val: number) => {
    return `${(val / 1000000).toFixed(0)}Tr`;
  };

  const formatFullVND = (val: number) => {
    return new Intl.NumberFormat('vi-VN').format(val) + ' ₫';
  };

  // Grid steps: 0, 60Tr, 120Tr, 180Tr
  const gridSteps = [0, 60000000, 120000000, 180000000];

  const groupWidth = availableWidth / data.length;
  const barWidth = 14;

  return (
    <div className="dash-panel" style={{ flex: 1.8 }}>
      <div className="dash-panel-header">
        <div className="panel-title-group">
          <h3>Dòng tiền &amp; Doanh thu 6 tháng gần nhất</h3>
          <p>So sánh số tiền thực thu so với chỉ tiêu dự toán</p>
        </div>

        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-dot expected" aria-hidden="true" />
            <span>Kế hoạch</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot actual" aria-hidden="true" />
            <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Thực thu</span>
          </div>
        </div>
      </div>

      <div className="chart-container">
        <div className="svg-chart-wrapper">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
            className="svg-chart"
            aria-label="Biểu đồ doanh thu 6 tháng"
          >
            {/* Gridlines */}
            {gridSteps.map((val) => {
              const y = availableHeight - (val / maxRevenue) * availableHeight + 6;
              return (
                <g key={val}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={chartWidth}
                    y2={y}
                    stroke="var(--color-rule)"
                    strokeWidth="1"
                    strokeDasharray={val === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="var(--color-muted)"
                    fontFamily="var(--font-outlier, monospace)"
                  >
                    {formatShortVND(val)}
                  </text>
                </g>
              );
            })}

            {/* Bars for Each Month */}
            {data.map((item, index) => {
              const groupCenterX = paddingLeft + index * groupWidth + groupWidth / 2;
              const expectedHeight = (item.expected / maxRevenue) * availableHeight;
              const actualHeight = (item.actual / maxRevenue) * availableHeight;

              const expectedY = availableHeight - expectedHeight + 6;
              const actualY = availableHeight - actualHeight + 6;

              const expectedX = groupCenterX - barWidth - 2;
              const actualX = groupCenterX + 2;

              const isHovered = hoveredIdx === index;

              return (
                <g
                  key={item.month}
                  onMouseEnter={() => setHoveredIdx(index)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Hover highlight background */}
                  {isHovered && (
                    <rect
                      x={paddingLeft + index * groupWidth + 4}
                      y={4}
                      width={groupWidth - 8}
                      height={availableHeight + 4}
                      fill="var(--color-paper-2)"
                      rx="4"
                    />
                  )}

                  {/* Expected Bar (Muted background) */}
                  <rect
                    x={expectedX}
                    y={expectedY}
                    width={barWidth}
                    height={Math.max(2, expectedHeight)}
                    rx="2"
                    fill="var(--color-paper-3)"
                  />

                  {/* Actual Bar (Primary Accent) */}
                  <rect
                    x={actualX}
                    y={actualY}
                    width={barWidth}
                    height={Math.max(2, actualHeight)}
                    rx="2"
                    fill={isHovered ? 'var(--color-accent-hover)' : 'var(--color-accent-primary)'}
                  />

                  {/* Month Label */}
                  <text
                    x={groupCenterX}
                    y={chartHeight - 4}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight={isHovered ? '600' : '400'}
                    fill={isHovered ? 'var(--color-ink)' : 'var(--color-muted)'}
                  >
                    {item.month}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hover Inspection Info Banner */}
        <div
          style={{
            height: '24px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 4px',
            color: 'var(--color-muted)',
          }}
        >
          {hoveredIdx !== null ? (
            <>
              <span>
                Tháng <strong>{data[hoveredIdx].month}</strong>: Thực thu{' '}
                <strong style={{ color: 'var(--color-accent-primary)' }}>
                  {formatFullVND(data[hoveredIdx].actual)}
                </strong>{' '}
                (Đạt {((data[hoveredIdx].actual / data[hoveredIdx].expected) * 100).toFixed(1)}% chỉ tiêu)
              </span>
              <span>Dự toán: {formatFullVND(data[hoveredIdx].expected)}</span>
            </>
          ) : (
            <span>* Di chuột vào từng tháng để kiểm tra chi tiết số tiền thu nộp.</span>
          )}
        </div>
      </div>
    </div>
  );
};
