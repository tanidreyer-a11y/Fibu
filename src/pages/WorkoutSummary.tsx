import { Barbell, Clock, Lightning, Medal, Star, TrendUp } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Confetti } from '../components/Confetti';
import { IntensityGauge } from '../components/IntensityGauge';
import { MuscleDiagram } from '../components/MuscleDiagram';
import { SpeechBubble } from '../components/Mascot';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CURATED_BY_ID } from '../lib/exercises';
import { db } from '../lib/db';
import { buildBodyState } from '../lib/muscleGroups';
import { computeXp, levelFor, loadProgressData, syncAchievements, type AchievementDef } from '../lib/progress';
import { bestSetForExercise, computeGroupVolumes, computeSessionVolumeKg, getSessionReaction, suggestProgressiveOverload } from '../lib/training';
import { displayWeight } from '../lib/units';
import { useCountUp } from '../lib/useCountUp';

export function WorkoutSummary() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Celebrate only straight after finishing, not when browsing history.
  const fresh = (location.state as { fresh?: boolean } | null)?.fresh === true;
  const sessionId = Number(id);

  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const allSessions = useLiveQuery(() => db.sessions.toArray(), [], []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], []);
  const settings = useLiveQuery(() => db.settings.get('app'));
  const units = settings?.units ?? 'kg';
  const [badges, setBadges] = useState<AchievementDef[]>([]);
  const [levelUp, setLevelUp] = useState<number | null>(null);

  useEffect(() => {
    if (!fresh) return;
    loadProgressData()
      .then(async (data) => {
        // Did this workout's XP cross a level line?
        const total = computeXp(data);
        const mine = data.sessions.find((s) => s.id === sessionId);
        const gained = mine ? 50 + Math.min(mine.exerciseEntries.reduce((n, e) => n + e.sets.length, 0), 30) * 5 : 0;
        const after = levelFor(total).level;
        if (after > levelFor(total - gained).level) setLevelUp(after);
        setBadges(await syncAchievements(data));
      })
      .catch(() => undefined);
  }, [fresh, sessionId]);

  const exercisesById = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises]);
  const bodyState = useMemo(() => (session ? buildBodyState(computeGroupVolumes(session, exercisesById)) : {}), [session, exercisesById]);

  const results = useMemo(() => {
    if (!session) return [];
    // Compare only against sessions that came before this one.
    const earlier = (allSessions ?? []).filter((s) => (s.id ?? 0) < (session.id ?? 0));
    return session.exerciseEntries
      .map((entry) => {
        const exercise = exercisesById.get(entry.exerciseId);
        if (!exercise || entry.sets.length === 0) return null;
        const best = [...entry.sets].sort((a, b) => b.weightKg - a.weightKg || b.reps - a.reps)[0];
        const prior = bestSetForExercise(earlier, entry.exerciseId);
        const firstTime = !prior;
        const isPr = !!prior && (best.weightKg > prior.weightKg || (best.weightKg === prior.weightKg && best.reps > prior.reps));
        return { entry, exercise, isPr, firstTime, next: suggestProgressiveOverload(best, units, { exercise, target: entry.target }) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [session, exercisesById, allSessions, units]);

  const sets = session?.exerciseEntries.reduce((n, e) => n + e.sets.length, 0) ?? 0;
  const xpEarned = useCountUp(session ? 50 + Math.min(sets, 30) * 5 : 0, 900);

  if (!session) return <p className="font-bold text-text-muted">Loading…</p>;

  const score = session.intensityScore ?? 0;
  const intensity = { score, label: score < 40 ? ('Low' as const) : score < 70 ? ('Moderate' as const) : ('High' as const) };
  const prCount = results.filter((r) => r.isPr).length;
  const reaction = getSessionReaction(intensity, prCount, session.id ?? 0);
  const minutes = session.completedAt && session.startedAt ? Math.round((Date.parse(session.completedAt) - Date.parse(session.startedAt)) / 60000) : 0;
  const volume = displayWeight(computeSessionVolumeKg(session), units);

  return (
    <div className="flex flex-col gap-4 pb-4">
      {fresh && <Confetti />}

      <div className="flex items-end gap-3 pr-12">
        <img src="/mascot/fibu-wave.webp" alt="" className={`h-28 w-auto shrink-0 select-none ${fresh ? 'animate-pop-in' : ''}`} draggable={false} />
        <div className="flex flex-1 flex-col gap-2 pb-2">
          <span className="text-sm font-extrabold text-text-faint">{session.dayLabel} · {fresh ? 'complete!' : new Date(`${session.date}T12:00:00`).toLocaleDateString()}</span>
          <SpeechBubble>{reaction}</SpeechBubble>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="flex flex-col items-center gap-1 !p-3 border-xp/50 bg-xp-tint">
          <Lightning size={22} weight="fill" className="text-xp" />
          <span className="tabular font-display text-xl font-black text-text">+{xpEarned}</span>
          <span className="text-[11px] font-extrabold text-xp-text">XP</span>
        </Card>
        <Card className="flex flex-col items-center gap-1 !p-3">
          <Barbell size={22} weight="fill" className="text-text-muted" />
          <span className="tabular font-display text-xl font-black text-text">{volume >= 1000 ? `${(volume / 1000).toFixed(1)}k` : volume}</span>
          <span className="text-[11px] font-extrabold text-text-faint">{units} lifted</span>
        </Card>
        <Card className="flex flex-col items-center gap-1 !p-3">
          <Clock size={22} weight="fill" className="text-text-muted" />
          <span className="tabular font-display text-xl font-black text-text">{minutes > 0 ? minutes : sets}</span>
          <span className="text-[11px] font-extrabold text-text-faint">{minutes > 0 ? 'minutes' : 'sets'}</span>
        </Card>
      </div>

      {levelUp && (
        <div className="animate-pop-in flex items-center gap-3 rounded-2xl border-2 border-b-4 border-xp bg-xp p-4 text-black" style={{ animationDelay: '250ms' }}>
          <Lightning size={34} weight="fill" />
          <span>
            <span className="font-display block text-[22px] leading-tight font-black">Level {levelUp}!</span>
            <span className="block text-sm font-extrabold opacity-80">You levelled up with this workout.</span>
          </span>
        </div>
      )}

      {badges.length > 0 && (
        <Card className="flex flex-col gap-2 border-xp/50 bg-xp-tint">
          <h2 className="font-display flex items-center gap-2 text-[17px] font-black text-text">
            <Medal size={20} weight="fill" className="text-xp" /> New badge{badges.length > 1 ? 's' : ''}!
          </h2>
          {badges.map((b, i) => (
            <div key={b.id} className="animate-pop-in flex items-center gap-3" style={{ animationDelay: `${300 + i * 120}ms` }}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-xp text-black">
                <Medal size={22} weight="fill" />
              </span>
              <span>
                <span className="block text-[15px] font-black text-text">{b.title}</span>
                <span className="block text-xs font-bold text-text-muted">{b.detail}</span>
              </span>
            </div>
          ))}
        </Card>
      )}

      <Card className="flex flex-col items-center">
        <IntensityGauge result={intensity} />
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-[17px] font-black text-text">This session</h2>
        {results.map(({ entry, exercise, isPr, firstTime, next }, i) => {
          const nextName = next.nextExerciseId ? CURATED_BY_ID.get(next.nextExerciseId)?.name : undefined;
          const timed = exercise.unit === 'sec';
          return (
            <Card key={`${entry.exerciseId}-${i}`} className={`flex flex-col gap-1.5 ${isPr ? 'border-xp/60' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[15px] font-black text-text">{exercise.name}</h3>
                {isPr && (
                  <span className="animate-pop-in flex shrink-0 items-center gap-1 rounded-lg bg-xp px-2 py-1 text-[11px] font-black text-black uppercase" style={{ animationDelay: `${400 + i * 80}ms` }}>
                    <Star size={12} weight="fill" /> New best
                  </span>
                )}
                {firstTime && <span className="shrink-0 rounded-lg bg-bg-raised-2 px-2 py-1 text-[11px] font-black text-text-muted uppercase">First time</span>}
              </div>
              <p className="tabular text-sm font-bold text-text-muted">
                {entry.sets.map((s) => (s.weightKg > 0 ? `${displayWeight(s.weightKg, units)}×${s.reps}` : `${s.reps}${timed ? 's' : ''}`)).join('  ·  ')}
              </p>
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-protein-text">
                <TrendUp size={16} weight="bold" />
                {nextName
                  ? `Next time: try ${nextName}`
                  : `Next time: ${next.targetWeightKg > 0 ? `${displayWeight(next.targetWeightKg, units)} ${units} × ` : ''}${next.targetReps}${timed ? 's' : ''}`}
              </p>
            </Card>
          );
        })}
      </div>

      <Card>
        <h2 className="font-display mb-2 text-[17px] font-black text-text">Muscles worked</h2>
        <MuscleDiagram bodyState={bodyState} />
      </Card>

      <Button size="lg" onClick={() => navigate('/', { replace: true })}>
        Done
      </Button>
    </div>
  );
}
