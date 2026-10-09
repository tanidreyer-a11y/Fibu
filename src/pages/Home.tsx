import { Barbell, Check, Drop, Fire, Flag, ForkKnife, Lightning, Moon, Play, Robot } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mascot, MascotSays } from '../components/Mascot';
import { Card, PressCard } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Ring } from '../components/ui/Ring';
import type { Tone } from '../components/ui/tones';
import { getAiDailyMessage } from '../lib/coach';
import { addDays, localDate } from '../lib/dates';
import { db } from '../lib/db';
import { sumFood } from '../lib/food';
import { defaultSchedule, focusLabel, nextPlanDay } from '../lib/plan';
import { weightTrend } from '../lib/progress';
import { getDailyQuote } from '../lib/quotes';
import { displayWeight } from '../lib/units';
import { useCountUp } from '../lib/useCountUp';
import { useProgress } from '../lib/useProgress';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function MiniRing({ value, tone, icon: IconC, label, text, onClick }: { value: number; tone: Tone; icon: typeof Fire; label: string; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5" aria-label={`${label}: ${text}`}>
      <Ring value={value} size={64} stroke={8} tone={tone}>
        <IconC size={20} weight="fill" className={value >= 1 ? 'text-success' : 'text-text-faint'} />
      </Ring>
      <span className="tabular text-[13px] leading-none font-black text-text">{text}</span>
      <span className="text-[11px] leading-none font-extrabold text-text-faint">{label}</span>
    </button>
  );
}

export function Home() {
  const navigate = useNavigate();
  const now = new Date();
  const today = localDate(now);
  const dayName = DAY_NAMES[now.getDay()];
  const curatedQuote = getDailyQuote(now);
  const [quote, setQuote] = useState(curatedQuote);

  const profile = useLiveQuery(() => db.profile.get('me'));
  const settings = useLiveQuery(() => db.settings.get('app'));
  const plan = useLiveQuery(() => db.plan.get('active'));
  const food = useLiveQuery(() => db.foodLog.where('date').equals(today).toArray(), [today], []);
  const water = useLiveQuery(() => db.waterLog.where('date').equals(today).toArray(), [today], []);
  const progress = useProgress();
  const units = settings?.units ?? 'kg';

  useEffect(() => {
    let cancelled = false;
    getAiDailyMessage(dayName, curatedQuote).then((text) => {
      if (!cancelled) setQuote(text);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayName]);

  const sessions = progress?.data.sessions ?? [];
  const lastSession = sessions[sessions.length - 1];
  const trainedToday = sessions.filter((s) => s.date === today);
  const upNext = plan ? nextPlanDay(plan.days, lastSession?.dayLabel) : undefined;

  // Monday-based week strip.
  const monday = addDays(today, -((now.getDay() + 6) % 7));
  const weekDates = WEEK.map((_, i) => addDays(monday, i));
  const schedule = plan?.schedule ?? defaultSchedule(profile?.daysPerWeek ?? 3);
  const sessionsThisWeek = sessions.filter((s) => s.date >= monday && s.date <= addDays(monday, 6));
  const workoutsThisWeek = new Set(sessionsThisWeek.map((s) => s.date)).size;
  const weeklyTarget = profile?.daysPerWeek ?? schedule.length;

  const eaten = sumFood(food ?? []);
  const waterMl = (water ?? []).reduce((s, w) => s + w.ml, 0);
  const calorieTarget = settings?.calorieTarget ?? 2200;
  const proteinTarget = settings?.proteinTargetG ?? 150;
  const waterTarget = settings?.waterTargetMl ?? 2500;

  const streakShown = useCountUp(progress?.streak.days ?? 0);
  const xpShown = useCountUp(progress?.xp ?? 0);

  const goal = useMemo(() => {
    const body = progress?.data.body ?? [];
    const goalKg = profile?.goalWeightKg;
    const latest = body[body.length - 1]?.weightKg ?? profile?.weightKg;
    if (!goalKg || latest == null) return null;
    const start = body[0]?.weightKg ?? latest;
    const total = Math.abs(goalKg - start);
    const done = Math.max(0, goalKg < start ? start - latest : latest - start);
    const left = Math.abs(goalKg - latest);
    const trend = weightTrend(body, today);
    const towardGoal = trend != null && (goalKg < start ? trend < 0 : trend > 0);
    return { goalKg, latest, left, pct: total ? Math.min(1, done / total) : 1, trend, towardGoal };
  }, [progress, profile, today]);

  const goalLabel: Record<string, string> = { muscle_gain: 'Build muscle', fat_loss: 'Lose fat', strength: 'Get stronger', general_fitness: 'Get fit' };

  return (
    <div className="flex flex-col gap-4">
      {/* Header: greeting + streak / XP */}
      <div className="flex items-center gap-2 pr-12">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-text-faint">{dayName}</p>
          <h1 className="font-display truncate text-[24px] leading-tight font-black text-text">
            {greeting(now.getHours())}
            {profile?.name ? `, ${profile.name}` : ''}
          </h1>
        </div>
      </div>

      <div className="animate-rise-in flex items-center gap-2">
        <span
          className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-[15px] font-black ${
            progress?.streak.todayDone ? 'border-streak/40 bg-streak-tint text-streak-text' : 'border-border bg-bg-raised text-text-faint'
          }`}
          title={progress?.streak.todayDone ? 'Streak kept today' : 'Log anything today to keep your streak'}
        >
          <Fire size={20} weight="fill" className={progress?.streak.todayDone ? 'text-streak' : ''} />
          <span className="tabular">{streakShown}</span>
          <span className="text-xs font-extrabold">day{progress?.streak.days === 1 ? '' : 's'}</span>
        </span>
        <span className="flex items-center gap-1.5 rounded-xl border-2 border-xp/40 bg-xp-tint px-3 py-1.5 text-[15px] font-black text-xp-text">
          <Lightning size={20} weight="fill" className="text-xp" />
          <span className="tabular">{xpShown}</span>
          <span className="text-xs font-extrabold">XP</span>
        </span>
        {progress && (
          <span className="ml-auto flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-right text-xs font-black text-text-muted">Level {progress.level.level}</span>
            <ProgressBar value={progress.level.into / progress.level.needed} tone="xp" height={8} label={`Level ${progress.level.level} progress`} />
          </span>
        )}
      </div>

      <MascotSays pose={now.getHours() < 12 ? 'wave' : 'stand'} size={96} className="animate-rise-in" bob>
        {!progress?.streak.todayDone && (progress?.streak.days ?? 0) > 0 ? `Keep your ${progress?.streak.days}-day streak going! ` : ''}
        {quote}
      </MascotSays>

      {profile && (!profile.birthYear || !profile.equipment) && (
        <PressCard onClick={() => navigate('/onboarding')} className="flex items-center gap-3 !border-accent [--ledge-color:var(--color-accent)]">
          <Mascot pose="head" size={48} />
          <span className="flex-1">
            <span className="font-display block text-[16px] font-extrabold text-text">Finish your profile</span>
            <span className="block text-[13px] font-bold text-text-muted">A few quick questions and I'll build your proper plan. Your history stays.</span>
          </span>
        </PressCard>
      )}

      {/* Today's workout */}
      {trainedToday.length > 0 ? (
        <Card className="animate-rise-in flex items-center gap-3 border-success/50 bg-protein-tint">
          <span className="animate-pop-in grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-success text-accent-ink">
            <Check size={26} weight="bold" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-display block text-[17px] font-black text-text">Trained today</span>
            <span className="block truncate text-sm font-bold text-text-muted">
              {trainedToday.map((s) => s.dayLabel).join(' + ')}. Recover well{upNext ? `, ${upNext.label} is next` : ''}.
            </span>
          </span>
        </Card>
      ) : upNext ? (
        <Card className="animate-rise-in flex flex-col gap-3" style={{ animationDelay: '60ms' }}>
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-tint text-accent-text">
              <Barbell size={26} weight="fill" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-xs font-extrabold text-text-faint">{schedule.includes(now.getDay()) ? "Today's workout" : 'Up next (rest day today is fine too)'}</span>
              <span className="font-display block text-[20px] leading-tight font-black text-text">{upNext.label}</span>
              <span className="block truncate text-sm font-bold text-text-muted">
                {upNext.items?.length ?? upNext.suggestedExerciseIds.length} moves · {focusLabel(upNext)}
              </span>
            </span>
          </div>
          <button
            onClick={() => {
              try {
                sessionStorage.setItem('fibu:startDay', upNext.label);
              } catch {
                // falls back to the day picker
              }
              navigate('/train');
            }}
            className="press-3d flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent text-base font-black tracking-[0.06em] text-accent-ink uppercase [--ledge-color:var(--color-accent-ledge)]"
          >
            <Play size={20} weight="fill" /> Start workout
          </button>
        </Card>
      ) : null}

      {/* Daily rings */}
      <Card className="animate-rise-in grid grid-cols-4 gap-1 py-4" style={{ animationDelay: '120ms' }}>
        <MiniRing value={eaten.calories / calorieTarget} tone="accent" icon={ForkKnife} label="Calories" text={`${Math.round(eaten.calories)}`} onClick={() => navigate('/food')} />
        <MiniRing value={eaten.proteinG / proteinTarget} tone="protein" icon={Lightning} label="Protein" text={`${Math.round(eaten.proteinG)}g`} onClick={() => navigate('/food')} />
        <MiniRing value={waterMl / waterTarget} tone="water" icon={Drop} label="Water" text={`${(waterMl / 1000).toFixed(1)}L`} onClick={() => navigate('/food')} />
        <MiniRing value={workoutsThisWeek / Math.max(1, weeklyTarget)} tone="success" icon={Barbell} label="This week" text={`${workoutsThisWeek}/${weeklyTarget}`} onClick={() => navigate('/train')} />
      </Card>

      {/* Week path */}
      <Card className="animate-rise-in flex flex-col gap-3" style={{ animationDelay: '180ms' }}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[17px] font-black text-text">This week</h2>
          <span className="text-sm font-extrabold text-text-muted">
            {workoutsThisWeek} of {weeklyTarget} workouts
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((date, i) => {
            const weekday = WEEK[i];
            const done = sessionsThisWeek.some((s) => s.date === date);
            const isToday = date === today;
            const planned = schedule.includes(weekday);
            const past = date < today;
            return (
              <div key={date} className="flex flex-col items-center gap-1">
                <span className={`text-[11px] font-extrabold ${isToday ? 'text-accent-text' : 'text-text-faint'}`}>{DAY_NAMES[weekday].slice(0, 3)}</span>
                <span
                  className={`grid h-10 w-10 place-items-center rounded-full border-2 ${
                    done
                      ? 'border-success bg-success text-accent-ink'
                      : isToday && planned
                        ? 'animate-glow-pulse border-accent bg-accent-tint text-accent-text'
                        : planned
                          ? past
                            ? 'border-dashed border-border bg-bg-raised text-text-faint'
                            : 'border-border bg-bg-raised-2 text-text-muted'
                          : 'border-transparent bg-transparent text-text-faint'
                  }`}
                  aria-label={`${DAY_NAMES[weekday]}: ${done ? 'trained' : planned ? (past ? 'missed' : 'planned') : 'rest'}`}
                >
                  {done ? <Check size={18} weight="bold" /> : planned ? <Barbell size={16} weight="fill" /> : <Moon size={14} weight="fill" />}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Goal */}
      {profile && (
        <Card className="animate-rise-in flex flex-col gap-2.5" style={{ animationDelay: '240ms' }}>
          <div className="flex items-center gap-2">
            <Flag size={20} weight="fill" className="text-xp" />
            <h2 className="font-display flex-1 text-[17px] font-black text-text">{goalLabel[profile.goal] ?? 'Your goal'}</h2>
            {goal && (
              <span className="text-sm font-extrabold text-text-muted">
                → {displayWeight(goal.goalKg, units)} {units}
              </span>
            )}
          </div>
          {goal ? (
            <>
              <ProgressBar value={goal.pct} tone="xp" label="Progress to goal weight" />
              <p className="text-sm font-bold text-text-muted">
                {goal.left < 0.2
                  ? "You've reached your goal weight. Time to set a new one?"
                  : `${displayWeight(goal.left, units)} ${units} to go. `}
                {goal.trend != null && goal.left >= 0.2 &&
                  (goal.towardGoal
                    ? `Trending ${displayWeight(Math.abs(goal.trend), units)} ${units} a week the right way.`
                    : 'Weight is flat or moving the other way this month. Check your calories with Fibu.')}
                {goal.trend == null && goal.left >= 0.2 && 'Weigh in a few times a week to see your trend.'}
              </p>
            </>
          ) : (
            <p className="text-sm font-bold text-text-muted">
              Train {weeklyTarget}× a week and hit {proteinTarget} g protein a day. You're at {workoutsThisWeek}/{weeklyTarget} this week.
            </p>
          )}
        </Card>
      )}

      <PressCard onClick={() => navigate('/chat')} className="animate-rise-in flex items-center gap-3" style={{ animationDelay: '300ms' }}>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-bg-raised-2 text-text-muted">
          <Robot size={24} weight="fill" />
        </span>
        <span className="flex-1">
          <span className="font-display block text-[16px] font-extrabold text-text">Ask Fibu</span>
          <span className="block text-[13px] font-bold text-text-muted">Snap a meal, log a workout by text, or ask about your progress.</span>
        </span>
      </PressCard>
    </div>
  );
}
