import { CalendarCheck, CheckCircle, Drop, Flag, ForkKnife, Target } from '@phosphor-icons/react';
import type { Plan, Units } from '../lib/db';
import { CURATED_BY_ID } from '../lib/exercises';
import type { GoalTimeline, NutritionTargets } from '../lib/nutrition';
import { displayWeight } from '../lib/units';
import { MascotAvatar } from './Mascot';
import { Card } from './ui/Card';
import { ProgressBar } from './ui/ProgressBar';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface PlanRevealProps {
  plan: Pick<Plan, 'days' | 'reasons' | 'splitName' | 'schedule' | 'coachNote'>;
  targets: NutritionTargets;
  timeline: GoalTimeline | null;
  goalWeightKg?: number;
  units: Units;
  sessionMinutes: number;
  equipmentLabel: string;
  noteLoading?: boolean;
}

function rangeText(min: number, max: number, unit: 'reps' | 'sec') {
  const r = min === max ? `${min}` : `${min}–${max}`;
  return unit === 'sec' ? `${r}s` : r;
}

export function PlanReveal({ plan, targets, timeline, goalWeightKg, units, sessionMinutes, equipmentLabel, noteLoading }: PlanRevealProps) {
  const schedule = plan.schedule ?? [];
  const firstDay = plan.days[0];

  return (
    <div className="flex flex-col gap-4">
      <Card className="animate-rise-in flex flex-col gap-1 border-accent bg-accent-tint" style={{ animationDelay: '60ms' }}>
        <span className="text-sm font-extrabold text-accent-text">Your plan</span>
        <span className="font-display text-[26px] leading-tight font-black text-text">{plan.splitName}</span>
        <span className="text-sm font-bold text-text-muted">
          {plan.days.length} days a week · {sessionMinutes} min · {equipmentLabel}
        </span>
      </Card>

      {(plan.coachNote || noteLoading) && (
        <div className="animate-rise-in flex items-start gap-3" style={{ animationDelay: '120ms' }}>
          <MascotAvatar size={44} />
          <div className="flex-1 rounded-2xl border-2 border-border bg-bg-raised px-4 py-3 text-[15px] leading-snug font-bold text-text">
            {plan.coachNote ?? <span className="text-text-faint">Fibu is writing you a note…</span>}
          </div>
        </div>
      )}

      <Card className="animate-rise-in flex flex-col gap-3" style={{ animationDelay: '180ms' }}>
        <h3 className="font-display flex items-center gap-2 text-lg font-extrabold text-text">
          <Target size={20} weight="fill" className="text-accent-text" /> Why this fits you
        </h3>
        <ul className="flex flex-col gap-2.5">
          {(plan.reasons ?? []).map((r) => (
            <li key={r} className="flex gap-2.5 text-[15px] leading-snug font-semibold text-text">
              <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-success" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="animate-rise-in flex flex-col gap-3" style={{ animationDelay: '240ms' }}>
        <h3 className="font-display flex items-center gap-2 text-lg font-extrabold text-text">
          <CalendarCheck size={20} weight="fill" className="text-water-text" /> Your week
        </h3>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEK_ORDER.map((weekday) => {
            const dayIndex = schedule.indexOf(weekday);
            const training = dayIndex !== -1;
            return (
              <div key={weekday} className="flex flex-col items-center gap-1">
                <span className="text-[11px] font-extrabold text-text-faint">{DAY_SHORT[weekday]}</span>
                <span
                  className={`grid h-10 w-full place-items-center rounded-xl text-sm font-black ${
                    training ? 'bg-accent text-accent-ink' : 'bg-bg-raised-2 text-text-faint'
                  }`}
                  title={training ? plan.days[dayIndex]?.label : 'Rest'}
                >
                  {training ? dayIndex + 1 : '–'}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-sm font-bold text-text-muted">
          {plan.days.map((d, i) => `${i + 1} ${d.label}`).join(' · ')}. Move days around freely, Fibu just keeps the order.
        </p>
      </Card>

      {firstDay?.items && (
        <Card className="animate-rise-in flex flex-col gap-3" style={{ animationDelay: '300ms' }}>
          <h3 className="font-display text-lg font-extrabold text-text">Day 1: {firstDay.label}</h3>
          <ol className="flex flex-col divide-y-2 divide-border-soft">
            {firstDay.items.map((item) => (
              <li key={item.exerciseIds[0]} className="flex items-center justify-between gap-3 py-2">
                <span className="text-[15px] font-extrabold text-text">{CURATED_BY_ID.get(item.exerciseIds[0])?.name ?? item.exerciseIds[0]}</span>
                <span className="tabular shrink-0 text-sm font-extrabold text-text-muted">
                  {item.sets} × {rangeText(item.repsMin, item.repsMax, item.unit)}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card className="animate-rise-in flex flex-col gap-3" style={{ animationDelay: '360ms' }}>
        <h3 className="font-display flex items-center gap-2 text-lg font-extrabold text-text">
          <ForkKnife size={20} weight="fill" className="text-fat-text" /> Daily fuel
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="tabular font-display text-[34px] leading-none font-black text-text">{targets.calories.toLocaleString()}</span>
          <span className="text-sm font-extrabold text-text-muted">kcal a day</span>
        </div>
        <p className="text-sm font-semibold text-text-muted">{targets.explanation}</p>
        {(
          [
            ['Protein', targets.proteinG, 'protein', 'text-protein-text'],
            ['Carbs', targets.carbsG, 'carbs', 'text-carbs-text'],
            ['Fat', targets.fatG, 'fat', 'text-fat-text'],
          ] as const
        ).map(([label, grams, tone, text]) => (
          <div key={label} className="flex items-center gap-3">
            <span className={`w-16 text-sm font-extrabold ${text}`}>{label}</span>
            <ProgressBar value={(grams * (label === 'Fat' ? 9 : 4)) / targets.calories / 0.5} tone={tone} height={12} className="flex-1" />
            <span className="tabular w-14 text-right text-sm font-extrabold text-text">{grams} g</span>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-xl bg-water-tint px-3 py-2 text-sm font-extrabold text-water-text">
          <Drop size={18} weight="fill" /> {(targets.waterMl / 1000).toFixed(targets.waterMl % 1000 ? 2 : 0).replace(/0$/, '')} L water
        </div>
      </Card>

      {timeline && goalWeightKg && (
        <Card className="animate-rise-in flex items-center gap-3" style={{ animationDelay: '420ms' }}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-xp-tint text-xp-text">
            <Flag size={24} weight="fill" />
          </span>
          <span className="text-[15px] leading-snug font-bold text-text">
            Reach <b className="font-black">{displayWeight(goalWeightKg, units)} {units}</b> around{' '}
            <b className="font-black">{timeline.targetDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</b>, at a
            steady {+(units === 'kg' ? timeline.perWeekKg : displayWeight(timeline.perWeekKg, units)).toFixed(2)} {units} a week.
          </span>
        </Card>
      )}
    </div>
  );
}
