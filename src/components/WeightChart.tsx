import type { BodyEntry, Units } from '../lib/db';
import { displayWeight } from '../lib/units';

interface WeightChartProps {
  entries: BodyEntry[];
  goalKg?: number;
  units: Units;
}

const W = 320;
const H = 160;
const PAD = { top: 14, right: 12, bottom: 22, left: 34 };

function shortDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Weight over time with the goal as a dashed line. Time on x is real spacing
 * (gaps between weigh-ins show as gaps), and the y range always includes the
 * goal so progress toward it is visible.
 */
export function WeightChart({ entries, goalKg, units }: WeightChartProps) {
  if (entries.length < 2) {
    return <p className="py-6 text-center text-sm font-bold text-text-faint">Log your weight on two different days to see your trend here.</p>;
  }
  const values = entries.map((e) => displayWeight(e.weightKg, units));
  const goal = goalKg != null ? displayWeight(goalKg, units) : undefined;
  const lo = Math.min(...values, goal ?? Infinity);
  const hi = Math.max(...values, goal ?? -Infinity);
  const span = Math.max(1, hi - lo);
  const yMin = lo - span * 0.15;
  const yMax = hi + span * 0.15;
  const t0 = Date.parse(entries[0].date);
  const t1 = Date.parse(entries[entries.length - 1].date);
  const x = (date: string) => PAD.left + ((Date.parse(date) - t0) / Math.max(1, t1 - t0)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  const points = entries.map((e, i) => [x(e.date), y(values[i])] as const);
  const path = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const area = `${path} L${points[points.length - 1][0].toFixed(1)},${H - PAD.bottom} L${points[0][0].toFixed(1)},${H - PAD.bottom} Z`;
  const first = values[0];
  const last = values[values.length - 1];
  const change = Math.round((last - first) * 10) / 10;
  const ticks = [yMax - (yMax - yMin) * 0.1, (yMin + yMax) / 2, yMin + (yMax - yMin) * 0.1];

  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Weight from ${first} to ${last} ${units} between ${shortDate(entries[0].date)} and ${shortDate(entries[entries.length - 1].date)}${goal ? `, goal ${goal} ${units}` : ''}.`}>
        <defs>
          <linearGradient id="weight-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-border-soft)" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(t) + 3.5} textAnchor="end" className="fill-text-faint text-[10px] font-bold tabular-nums">
              {t.toFixed(span < 4 ? 1 : 0)}
            </text>
          </g>
        ))}
        {goal != null && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(goal)} y2={y(goal)} stroke="var(--color-xp)" strokeWidth="2" strokeDasharray="5 4" />
            <text x={W - PAD.right} y={y(goal) - 5} textAnchor="end" className="fill-xp-text text-[10px] font-extrabold">
              Goal {goal}
            </text>
          </g>
        )}
        <path d={area} fill="url(#weight-fill)" />
        <path d={path} fill="none" stroke="var(--color-brand)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map(([px, py], i) => (
          <circle key={entries[i].date} cx={px} cy={py} r={i === points.length - 1 ? 4.5 : 2.5} fill={i === points.length - 1 ? 'var(--color-brand)' : 'var(--color-bg-raised)'} stroke="var(--color-brand)" strokeWidth="2" />
        ))}
        <text x={PAD.left} y={H - 5} className="fill-text-faint text-[10px] font-bold">
          {shortDate(entries[0].date)}
        </text>
        <text x={W - PAD.right} y={H - 5} textAnchor="end" className="fill-text-faint text-[10px] font-bold">
          {shortDate(entries[entries.length - 1].date)}
        </text>
      </svg>
      <figcaption className="text-sm font-bold text-text-muted">
        {change === 0 ? 'No change' : `${change > 0 ? '+' : ''}${change} ${units}`} since {shortDate(entries[0].date)} · now {last} {units}
      </figcaption>
    </figure>
  );
}
