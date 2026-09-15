import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IntensityGauge } from '../components/IntensityGauge';
import { MuscleDiagram } from '../components/MuscleDiagram';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { db } from '../lib/db';
import { buildBodyState } from '../lib/muscleGroups';
import { bestSetForExercise, computeGroupVolumes, suggestProgressiveOverload } from '../lib/training';
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

  if (!session) {
    return <p className="text-text-muted">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="animate-rise-in text-center">
        <p className="text-sm font-medium text-text-faint">{session.dayLabel} · complete</p>
        <h1 className="font-display mt-1 text-2xl font-semibold text-text">Nice work.</h1>
      </div>

      <Card className="animate-rise-in flex flex-col items-center" style={{ animationDelay: '60ms' }}>
        <IntensityGauge result={{ score: session.intensityScore ?? 0, label: session.intensityScore! < 40 ? 'Low' : session.intensityScore! < 70 ? 'Moderate' : 'High' }} />
      </Card>

      <Card className="animate-rise-in" style={{ animationDelay: '100ms' }}>
        <h2 className="font-display mb-3 font-semibold text-text">Muscles worked</h2>
        <MuscleDiagram bodyState={bodyState} />
      </Card>

      <div className="flex flex-col gap-3 animate-rise-in" style={{ animationDelay: '140ms' }}>
        <h2 className="font-display font-semibold text-text">This session</h2>
        {session.exerciseEntries.map((entry) => {
          const exercise = exercisesById.get(entry.exerciseId);
          if (!exercise || entry.sets.length === 0) return null;
          const bestInSession = [...entry.sets].sort((a, b) => b.weightKg - a.weightKg || b.reps - a.reps)[0];
          const priorBest = bestSetForExercise((allSessions ?? []).filter((s) => s.id !== session.id), entry.exerciseId);
          const isPr = !priorBest || bestInSession.weightKg > priorBest.weightKg || (bestInSession.weightKg === priorBest.weightKg && bestInSession.reps > priorBest.reps);
          const suggestion = suggestProgressiveOverload(bestInSession, units);

          return (
            <Card key={entry.exerciseId} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-text">{exercise.name}</h3>
                {isPr && (
                  <span className="rounded-full bg-accent-dim px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                    Best yet
                  </span>
                )}
              </div>
              <p className="text-sm text-text-muted">
                {entry.sets.map((s) => `${displayWeight(s.weightKg, units)}${units}×${s.reps}`).join('  ·  ')}
              </p>
              <p className="text-sm text-accent">{suggestion.message}</p>
            </Card>
          );
        })}
      </div>

      <Button size="lg" onClick={() => navigate('/', { replace: true })}>
        Done
      </Button>
    </div>
  );
}
