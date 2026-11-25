import { useState } from 'react';
import { compact, money, moneyRounded, MONTHS, MONTHS_GENITIVE, MONTHS_SHORT } from '../format';
import type { Period, Summary, Transaction } from '../types';

const W = 640;
const H = 210;
const LEFT = 38;
const BOTTOM = 22;
const TOP = 10;

/** Axis maximum split into four round steps (1, 2, 2.5, 5 × 10ⁿ each). */
function niceMax(value: number) {
  if (value <= 0) return 1000;
  const raw = value / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((factor) => factor * power >= raw)! * power;
  return step * 4;
}

function Grid({ max, y }: { max: number; y: (value: number) => number }) {
  return <>{[0, 1, 2, 3, 4].map((step) => {
    const value = (max / 4) * step;
    return <g key={step}>
      <line className="grid" x1={LEFT} x2={W} y1={y(value)} y2={y(value)} />
      <text x={LEFT - 6} y={y(value) + 3.5} textAnchor="end">{compact(value)}</text>
    </g>;
  })}</>;
}

type Tip = { title: string; income: number; expense: number; note?: string };

/** Invisible full-height columns that pick the hovered (or tapped) slot. */
function HoverBands({ count, band, active, onHover }: { count: number; band: number; active: number | null; onHover: (index: number | null) => void }) {
  return <g>
    {active !== null && <rect className="hover-band" x={LEFT + active * band} y={TOP} width={band} height={H - TOP - BOTTOM} />}
    {Array.from({ length: count }, (_, index) => <rect key={index} className="hit" x={LEFT + index * band} y={0} width={band} height={H}
      onPointerEnter={() => onHover(index)} onPointerDown={() => onHover(index)} />)}
  </g>;
}

function ChartTip({ index, band, tip }: { index: number; band: number; tip: Tip }) {
  const center = ((LEFT + (index + 0.5) * band) / W) * 100;
  const balance = tip.income - tip.expense;
  return <div className={`chart-tip${center > 70 ? ' left' : center < 25 ? ' right' : ''}`} style={{ left: `${center}%` }} role="status">
    <b>{tip.title}</b>
    <span><i className="sw pos" />Доход<em className="num">{money(tip.income)}</em></span>
    <span><i className="sw ink" />Расход<em className="num">{money(tip.expense)}</em></span>
    {(tip.income > 0 || tip.expense > 0) && <span className="tip-total">Сальдо<em className={`num ${balance >= 0 ? 'pos' : 'neg'}`}>{money(balance, true)}</em></span>}
    {tip.note && <small>{tip.note}</small>}
  </div>;
}

/** Spending per day of a month: past days, today, days ahead and the average pace so far. */
export function DailyChart({ transactions, period, summary }: { transactions: Transaction[]; period: Period; summary: Summary }) {
  const month = period.month ?? 1;
  const days = summary.daysInMonth || new Date(period.year, month, 0).getDate();
  const [active, setActive] = useState<number | null>(null);
  const perDay = Array.from({ length: days }, () => 0);
  const incomePerDay = Array.from({ length: days }, () => 0);
  transactions.forEach((item) => {
    const index = Number(item.transactionDate.slice(8, 10)) - 1;
    if (item.type === 'EXPENSE') perDay[index] += item.amount; else incomePerDay[index] += item.amount;
  });
  const passed = summary.forecastAvailable ? summary.calculationDays : days;
  const average = passed ? summary.expense / passed : 0;
  const max = niceMax(Math.max(...perDay, average));
  const y = (value: number) => TOP + (H - TOP - BOTTOM) * (1 - value / max);
  const band = (W - LEFT) / days;
  const label = `Расходы по дням: ${MONTHS[month - 1]} ${period.year}`;

  return <figure className="chart-wrap">
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onPointerLeave={() => setActive(null)}>
      <Grid max={max} y={y} />
      {perDay.map((value, index) => {
        const day = index + 1;
        const x = LEFT + index * band + band * 0.18;
        const width = band * 0.64;
        const future = summary.forecastAvailable && day > passed;
        const today = summary.forecastAvailable && day === passed;
        const height = future ? 3 : value > 0 ? Math.max(2, H - BOTTOM - y(value)) : 0;
        return <g key={day}>
          <rect className={`bar${future ? ' future' : today ? ' today' : ''}`} x={x} y={H - BOTTOM - height} width={width} height={height} rx={2} />
          {(day === 1 || day % 5 === 0) && <text x={x + width / 2} y={H - 6} textAnchor="middle">{day}</text>}
        </g>;
      })}
      {average > 0 && <line className="avg" x1={LEFT} x2={W} y1={y(average)} y2={y(average)} />}
      <HoverBands count={days} band={band} active={active} onHover={setActive} />
    </svg>
    {active !== null && <ChartTip index={active} band={band} tip={{
      title: `${active + 1} ${MONTHS_GENITIVE[month - 1]}`, income: incomePerDay[active], expense: perDay[active],
      note: summary.forecastAvailable && active + 1 > passed ? 'день ещё впереди' : undefined,
    }} />}
    <figcaption className="legend">
      <span><i className="sw ink" />Расход за день</span>
      {summary.forecastAvailable && <span><i className="sw accent" />Сегодня</span>}
      {average > 0 && <span><i className="dash" />В среднем {moneyRounded(average)} в день</span>}
    </figcaption>
  </figure>;
}

/** Income and spending by month; the running month is marked as unfinished. */
export function YearChart({ summary, year }: { summary: Summary; year: number }) {
  const now = new Date();
  const points = summary.monthlyPoints.map((point) => ({ ...point, index: Number(point.month.slice(5, 7)) - 1 }));
  const max = niceMax(Math.max(...points.map((point) => Math.max(point.income, point.expense)), 1));
  const y = (value: number) => TOP + (H - TOP - BOTTOM) * (1 - value / max);
  const band = (W - LEFT) / 12;
  const runningIndex = year === now.getFullYear() ? now.getMonth() : -1;
  const [active, setActive] = useState<number | null>(null);
  const hovered = active === null ? null : points.find((point) => point.index === active) ?? { income: 0, expense: 0, index: active, month: '' };

  return <figure className="chart-wrap">
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Доходы и расходы по месяцам ${year} года`} onPointerLeave={() => setActive(null)}>
      <Grid max={max} y={y} />
      {points.map((point) => {
        const x = LEFT + point.index * band;
        const width = band * 0.3;
        const running = point.index === runningIndex;
        return <g key={point.month}>
          {point.income > 0 && <rect className="bar inc" x={x + band * 0.18} y={y(point.income)} width={width} height={H - BOTTOM - y(point.income)} rx={2} />}
          {point.expense > 0 && <rect className={`bar${running ? ' today' : ''}`} x={x + band * 0.52} y={y(point.expense)} width={width} height={H - BOTTOM - y(point.expense)} rx={2} />}
          <text x={x + band / 2} y={H - 6} textAnchor="middle">{MONTHS_SHORT[point.index]}</text>
        </g>;
      })}
      <HoverBands count={12} band={band} active={active} onHover={setActive} />
    </svg>
    {hovered && <ChartTip index={hovered.index} band={band} tip={{
      title: `${MONTHS[hovered.index]} ${year}`, income: hovered.income, expense: hovered.expense,
      note: hovered.index === runningIndex ? 'месяц ещё идёт' : undefined,
    }} />}
    <figcaption className="legend">
      <span><i className="sw pos" />Доход</span>
      <span><i className="sw ink" />Расход</span>
      {runningIndex >= 0 && <span><i className="sw accent" />Текущий месяц, ещё идёт</span>}
    </figcaption>
  </figure>;
}

/** Months that are over and have any operations; the running month would drag averages down. */
export function completeMonths(summary: Summary, year: number) {
  const now = new Date();
  return summary.monthlyPoints.filter((point) => {
    const index = Number(point.month.slice(5, 7)) - 1;
    const over = year < now.getFullYear() || (year === now.getFullYear() && index < now.getMonth());
    return over && (point.income > 0 || point.expense > 0);
  });
}
