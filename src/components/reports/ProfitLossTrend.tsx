import { useState } from 'react';
import type { ProfitLossReport } from '../../services/financeApi';
import { money, periodLabel } from './financePresentation';

type Point = ProfitLossReport['byPeriod'][number];

export function ProfitLossTrend({ points, monthly, open }: {
  points: Point[]; monthly: boolean; open: (point: Point) => void;
}) {
  const [selected, setSelected] = useState('');
  const point = points.find(item => item.bucket === selected) ?? points.at(-1);
  if (!point) return null;
  let min = 0n, max = 0n;
  for (const { totals } of points) {
    for (const amount of [totals.revenue, totals.expense, totals.profit]) {
      if (amount < min) min = amount;
      if (amount > max) max = amount;
    }
  }
  const range = max - min || 1n;
  const y = (amount: bigint) => 18 + Number((max - amount) * 100_000n / range) / 100_000 * 172;
  const step = 620 / points.length;
  const x = (index: number) => 104 + (index + 0.5) * step;
  const bar = Math.min(20, step * 0.25);
  const label = (item: Point) => periodLabel(item.bucket, monthly) + (item.partial ? ' (một phần)' : '');
  const ticks = [...new Set([max, 0n, min])];
  return <section className="finance-panel" aria-labelledby="profit-loss-trend">
    <h2 id="profit-loss-trend">Xu hướng kinh doanh</h2>
    <div className="finance-legend">
      <span className="finance-in">Doanh thu</span><span className="finance-out">Chi phí</span>
      <span className="finance-net">Kết quả kinh doanh</span>
    </div>
    <div className="finance-graph">
      <svg viewBox="0 0 748 224" aria-hidden="true">
        {ticks.map(tick => <g key={String(tick)}>
          <line className={tick === 0n ? 'finance-baseline' : 'finance-gridline'} x1="104" x2="724" y1={y(tick)} y2={y(tick)} />
          <text x="96" y={y(tick)} textAnchor="end" dominantBaseline="central">{money(tick)}</text>
        </g>)}
        {points.map((item, index) => <g key={item.bucket}>
          {[item.totals.revenue, item.totals.expense].map((amount, side) => <rect key={side}
            className={side ? 'finance-out' : 'finance-in'} x={x(index) + (side ? 1 : -bar - 1)}
            y={Math.min(y(0n), y(amount))} width={bar} height={Math.abs(y(0n) - y(amount))} />)}
          {(index % Math.max(1, Math.ceil(points.length / 7)) === 0) &&
            <text x={x(index)} y="215" textAnchor="middle">{periodLabel(item.bucket, monthly)}{item.partial ? '*' : ''}</text>}
        </g>)}
        <polyline className="finance-net" points={points.map((item, index) => x(index) + ',' + y(item.totals.profit)).join(' ')} />
        <circle className="finance-net-point" cx={x(points.indexOf(point))} cy={y(point.totals.profit)} r="4" />
        {points.map((item, index) => <rect key={item.bucket} className="finance-hit" x={104 + index * step}
          y="12" width={step} height="179" onPointerEnter={event => {
            if (event.pointerType !== 'touch') setSelected(item.bucket);
          }} onClick={() => setSelected(item.bucket)} />)}
      </svg>
    </div>
    <div className="finance-toolbar">
      <label>Kỳ đối chiếu <select value={point.bucket} onChange={event => setSelected(event.target.value)}>
        {points.map(item => <option key={item.bucket} value={item.bucket}>{label(item)}</option>)}
      </select></label>
      <button type="button" onClick={() => open(point)}>Xem giao dịch trong kỳ</button>
    </div>
    <p className="finance-inspection">Doanh thu {money(point.totals.revenue)}; chi phí {money(point.totals.expense)}; kết quả {money(point.totals.profit)}</p>
    {points.some(item => item.partial) && <p className="finance-note">* Kỳ chỉ bao gồm một phần của tháng.</p>}
  </section>;
}
