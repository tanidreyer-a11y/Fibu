import { Lock, Medal, Scales } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WeightSheet } from '../components/food/BodyTiles';
import { MuscleDiagram } from '../components/MuscleDiagram';
import { WeightChart } from '../components/WeightChart';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { addDays, localDate } from '../lib/dates';
import { db } from '../lib/db';
import { buildBodyState, MUSCLE_GROUP_LABELS, type MuscleGroup } from '../lib/muscleGroups';
import { ACHIEVEMENTS } from '../lib/progress';
import { computeGroupVolumes, computeSessionVolumeKg } from '../lib/training';
import { displayWeight } from '../lib/units';

const RANGES = [
  { days: 30, label: '30 days' },
  { days: 90, label: '3 months' },
  { days: 3650, label: 'All' },
];

export function Body() {
  const navigate = useNavigate();
  const today = localDate();
  const [range, setRange] = useState(90);
  const [weighing, setWeighing] = useState(false);
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray(), [], []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], []);
  const body = useLiveQuery(() => db.bodyLog.orderBy('date').toArray(), [], []);
  const unlocked = useLiveQuery(() => db.achievements.toArray(), [], []);
  const profile = useLiveQuery(() => db.profile.get('me'));
  const settings = useLiveQuery(() => db.settings.get('app'));
  const units = settings?.units ?? 'kg';
  const exercisesById = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises]);

  const weekAgo = addDays(today, -7);
  const { bodyState, ranked } = useMemo(() => {
    const totals: Partial<Record<MuscleGroup, number>> = {};
    for (const s of (sessions ?? []).filter((x) => x.date > weekAgo)) {
      for (const [group, v] of Object.entries(computeGroupVolumes(s, exercisesById)) as [MuscleGroup, number][]) {
        totals[group] = (totals[group] ?? 0) + v;
      }
    }
    const ranked = (Object.entries(totals) as [MuscleGroup, number][]).sort((a, b) => b[1] - a[1]);
    return { bodyState: buildBodyState(totals), ranked };
  }, [sessions, weekAgo, exercisesById]);

  const chartEntries = (body ?? []).filter((b) => b.date >= addDays(today, -range));
  const unlockedIds = new Map((unlocked ?? []).map((a) => [a.id, a.unlockedAt]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display pr-12 text-2xl font-black text-text">Your body</h1>

      <Card className="animate-rise-in flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Scales size={20} weight="fill" className="text-xp" />
          <h2 className="font-display flex-1 text-[17px] font-black text-text">Weight</h2>
          <Button size="sm" variant="secondary" onClick={() => setWeighing(true)}>
            Log weight
          </Button>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <Chip key={r.days} active={range === r.days} onClick={() => setRange(r.days)} className="!px-3 !py-1.5 text-xs">
              {r.label}
            </Chip>
          ))}
        </div>
        <WeightChart entries={chartEntries} goalKg={profile?.goalWeightKg} units={units} />
      </Card>

      <Card className="animate-rise-in flex flex-col gap-3" style={{ animationDelay: '60ms' }}>
        <h2 className="font-display text-[17px] font-black text-text">Worked this week</h2>
        <MuscleDiagram bodyState={bodyState} emptyHint="Log a workout to see it light up" />
        {ranked.length > 0 && (
          <p className="text-sm font-bold text-text-muted">
            Most work: {ranked.slice(0, 3).map(([g]) => MUSCLE_GROUP_LABELS[g]).join(', ')}.
            {ranked.length > 3 && ` Least: ${MUSCLE_GROUP_LABELS[ranked[ranked.length - 1][0]]}.`}
          </p>
        )}
      </Card>

      <Card className="animate-rise-in flex flex-col gap-3" style={{ animationDelay: '120ms' }}>
        <div className="flex items-center gap-2">
          <Medal size={20} weight="fill" className="text-xp" />
          <h2 className="font-display flex-1 text-[17px] font-black text-text">Badges</h2>
          <span className="text-sm font-extrabold text-text-muted">
            {unlockedIds.size}/{ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const got = unlockedIds.has(a.id);
            return (
              <div
                key={a.id}
                className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-2.5 text-center ${got ? 'border-xp/50 bg-xp-tint' : 'border-border bg-bg-raised-2'}`}
                title={a.detail}
              >
                <span className={`grid h-10 w-10 place-items-center rounded-full ${got ? 'bg-xp text-black' : 'bg-bg-raised text-text-faint'}`}>
                  {got ? <Medal size={22} weight="fill" /> : <Lock size={18} weight="fill" />}
                </span>
                <span className={`text-xs leading-tight font-black ${got ? 'text-text' : 'text-text-faint'}`}>{a.title}</span>
                <span className="text-[10px] leading-tight font-bold text-text-faint">{a.detail}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-[17px] font-black text-text">History</h2>
        {(sessions ?? []).length === 0 && <p className="text-sm font-bold text-text-muted">No workouts logged yet.</p>}
        {(sessions ?? []).slice(0, 40).map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(`/summary/${s.id}`)}
            className="press-3d press-3d-sm flex items-center justify-between rounded-2xl border-2 border-border bg-bg-raised px-4 py-3 text-left [--ledge-color:var(--color-border)]"
          >
            <span>
              <span className="block text-[15px] font-extrabold text-text">{s.dayLabel}</span>
              <span className="block text-xs font-bold text-text-faint">
                {new Date(`${s.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {s.exerciseEntries.length} exercises
              </span>
            </span>
            <span className="text-right">
              <span className="tabular block text-[15px] font-black text-text">
                {displayWeight(computeSessionVolumeKg(s), units).toLocaleString()} {units}
              </span>
              <span className="block text-xs font-bold text-text-faint">volume</span>
            </span>
          </button>
        ))}
      </div>

      {weighing && <WeightSheet date={today} units={units} startKg={body?.[body.length - 1]?.weightKg ?? profile?.weightKg ?? 75} onClose={() => setWeighing(false)} />}
    </div>
  );
}
