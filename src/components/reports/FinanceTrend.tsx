import { useState } from 'react';
import type { FinancePoint } from '../../services/financeApi';
import { money, periodLabel } from './financePresentation';

export function FinanceTrend({ points, monthly, link, open }: {
  points: FinancePoint[]; monthly: boolean; link: (point: FinancePoint) => string; open: (url: string) => void;
}) {
  const [active, setActive] = useState<number>();
  const max = points.reduce((value, point) => [value, point.totalIn, point.totalOut, point.cashFlow]
    .reduce((largest, item) => item > largest ? item : largest), 0n);
  const min = points.reduce((value, point) => point.cashFlow < value ? point.cashFlow : value, 0n);
  const range = max - min || 1n;
  const left = 128, right = 738, top = 20, bottom = 226;
  const band = (right - left) / points.length;
  const y = (amount: bigint) => top + Number((max - amount) * 100_000n / range) / 100_000 * (bottom - top);
  const x = (index: number) => left + (index + 0.5) * band;
  const bar = Math.min(19, band * 0.27);
  const labelStride = Math.max(1, Math.ceil(points.length / 8));
  const point = points[active ?? -1];

  return <section className="finance-panel" aria-labelledby="finance-trend-title">
    <h2 id="finance-trend-title">Xu hướng dòng tiền</h2>
    <div className="finance-legend">
      <span className="finance-in">Thực thu</span><span className="finance-out">Thực chi</span><span className="finance-net">Dòng tiền ròng</span>
    </div>
    <div className="finance-graph" aria-hidden="true">
      <svg viewBox="0 0 760 257" onPointerLeave={event => { if (event.pointerType !== 'touch') setActive(undefined); }}>
        {[...new Set([max, max / 2n, 0n, min])].map(tick => <g key={String(tick)}>
          <line className={tick === 0n ? 'finance-baseline' : 'finance-gridline'} x1={left} x2={right} y1={y(tick)} y2={y(tick)} />
          <text x={left - 9} y={y(tick)} textAnchor="end" dominantBaseline="central">{money(tick)}</text>
        </g>)}
        {points.map((item, index) => <g key={item.at}>
          <rect className="finance-in" x={x(index) - bar - 1} y={y(item.totalIn)} width={bar} height={Math.max(0, y(0n) - y(item.totalIn))} />
          <rect className="finance-out" x={x(index) + 1} y={y(item.totalOut)} width={bar} height={Math.max(0, y(0n) - y(item.totalOut))} />
          {(index % labelStride === 0 || index === points.length - 1) &&
            <text x={x(index)} y={bottom + 19} textAnchor="middle">{periodLabel(item.at, monthly)}</text>}
        </g>)}
        <polyline className="finance-net" points={points.map((item, index) => x(index) + ',' + y(item.cashFlow)).join(' ')} />
        {points.length === 1 && <circle className="finance-net-point" cx={x(0)} cy={y(points[0].cashFlow)} r="3" />}
        {points.map((item, index) => <rect key={item.at} className="finance-hit" x={left + index * band} y={top}
          width={band} height={bottom - top} onPointerEnter={event => { if (event.pointerType !== 'touch') setActive(index); }}
          onClick={event => {
            if ('pointerType' in event.nativeEvent && event.nativeEvent.pointerType === 'touch' && active !== index) {
              setActive(index);
            } else {
              open(link(item));
            }
          }} />)}
      </svg>
    </div>
    {point && <p className="finance-inspection">{periodLabel(point.at, monthly)} | Thu {money(point.totalIn)} | Chi {money(point.totalOut)} | Ròng {money(point.cashFlow)}</p>}
    <details className="finance-trend-data">
      <summary>Dữ liệu theo {monthly ? 'tháng' : 'ngày'}</summary>
      <div className="finance-table-scroll">
        <table>
          <thead><tr><th scope="col">Kỳ</th><th scope="col">Thực thu</th><th scope="col">Thực chi</th><th scope="col">Dòng tiền ròng</th></tr></thead>
          <tbody>{points.map(item => <tr key={item.at}>
            <th scope="row"><a href={link(item)} onFocus={() => setActive(points.indexOf(item))} onBlur={() => setActive(undefined)}
              onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); open(link(item)); } }}>
              {periodLabel(item.at, monthly)}</a></th>
            <td>{money(item.totalIn)}</td><td>{money(item.totalOut)}</td><td>{money(item.cashFlow)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}

