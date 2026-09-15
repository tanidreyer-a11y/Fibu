import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IntensityGauge } from '../components/IntensityGauge';
import { MuscleDiagram } from '../components/MuscleDiagram';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { db } from '../lib/db';
import { buildBodyState } from '../lib/muscleGroups';
import { bestSetForExercise, computeGroupVolumes, getSessionReaction, suggestProgressiveOverload } from '../lib/training';
import { displayWeight } from '../lib/units';

export function WorkoutSummary() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sessionId = Number(id);

  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const allSessions = useLiveQuery(() => db.sessions.toArray(), [], []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], []);
  const settings = useLiveQuery(() => db.settings.get('app'));
  const units = settings?.units ?? 'kg';

  const exercisesById = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises]);
  const bodyState = useMemo(() => (session ? buildBodyState(computeGroupVolumes(session)) : {}), [session]);

  const results = useMemo(() => {
    if (!session) return [];
    return session.exerciseEntries
      .map((entry) => {
        const exercise = exercisesById.get(entry.exerciseId);
        if (!exercise || entry.sets.length === 0) return null;
        const bestInSession = [...entry.sets].sort((a, b) => b.weightKg - a.weightKg || b.reps - a.reps)[0];
        const priorBest = bestSetForExercise((allSessions ?? []).filter((s) => s.id !== session.id), entry.exerciseId);
        const isPr = !priorBest || bestInSession.weightKg > priorBest.weightKg || (bestInSession.weightKg === priorBest.weightKg && bestInSession.reps > priorBest.reps);
        return { entry, exercise, isPr, suggestion: suggestProgressiveOverload(bestInSession, units) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [session, exercisesById, allSessions, units]);

  if (!session) {
    return <p className="text-text-muted">Loading…</p>;
  }

  const score = session.intensityScore ?? 0;
  const intensity = { score, label: score < 40 ? ('Low' as const) : score < 70 ? ('Moderate' as const) : ('High' as const) };
  const prCount = results.filter((r) => r.isPr).length;
  const reaction = getSessionReaction(intensity, prCount, session.id ?? 0);

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="animate-rise-in text-center">
        <p className="text-sm font-medium text-text-faint">{session.dayLabel} · complete</p>
        <h1 className="font-display mt-1 text-[26px] font-bold leading-tight text-text">{reaction}</h1>
      </div>

      <Card className="animate-rise-in flex flex-col items-center" style={{ animationDelay: '60ms' }}>
        <IntensityGauge result={intensity} />
      </Card>

      <Card className="animate-rise-in" style={{ animationDelay: '100ms' }}>
        <h2 className="font-display mb-3 font-semibold text-text">Muscles worked</h2>
        <MuscleDiagram bodyState={bodyState} />
      </Card>

      <div className="flex flex-col gap-3 animate-rise-in" style={{ animationDelay: '140ms' }}>
        <h2 className="font-display font-semibold text-text">This session</h2>
        {results.map(({ entry, exercise, isPr, suggestion }) => (
          <Card key={entry.exerciseId} className={`flex flex-col gap-1.5 ${isPr ? 'border-accent/40' : ''}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-text">{exercise.name}</h3>
              {isPr && (
                <span className="animate-pop-in rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-ink">
                  ★ Best yet
                </span>
              )}
            </div>
            <p className="text-sm text-text-muted">
              {entry.sets.map((s) => `${displayWeight(s.weightKg, units)}${units}×${s.reps}`).join('  ·  ')}
            </p>
            <p className="text-sm text-accent">{suggestion.message}</p>
          </Card>
        ))}
      </div>

      <Button size="lg" onClick={() => navigate('/', { replace: true })}>
        Done
      </Button>
    </div>
  );
}
