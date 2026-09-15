import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MuscleDiagram } from '../components/MuscleDiagram';
import { Card } from '../components/ui/Card';
import { db } from '../lib/db';
import { buildBodyState, type MuscleGroup } from '../lib/muscleGroups';
import { computeGroupVolumes, computeSessionVolumeKg } from '../lib/training';
import { displayWeight } from '../lib/units';

export function Body() {
  const navigate = useNavigate();
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray(), [], []);
  const settings = useLiveQuery(() => db.settings.get('app'));
  const units = settings?.units ?? 'kg';

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);

  const weeklyBodyState = useMemo(() => {
    const recent = (sessions ?? []).filter((s) => s.date >= weekAgoStr);
    const totals: Partial<Record<MuscleGroup, number>> = {};
    for (const s of recent) {
      const vols = computeGroupVolumes(s);
      for (const [group, v] of Object.entries(vols) as [MuscleGroup, number][]) {
        totals[group] = (totals[group] ?? 0) + v;
      }
    }
    return buildBodyState(totals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, weekAgoStr]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-text">Your body, this week</h1>
        <p className="mt-1 text-text-muted">Everything you've worked in the last 7 days.</p>
      </div>

      <Card>
        <MuscleDiagram bodyState={weeklyBodyState} emptyHint="Log a workout to see it light up" />
      </Card>

      <div>
        <h2 className="font-display mb-3 font-semibold text-text">History</h2>
        {(sessions ?? []).length === 0 && <p className="text-sm text-text-muted">No workouts logged yet.</p>}
        <div className="flex flex-col gap-2">
          {(sessions ?? []).map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/summary/${s.id}`)}
              className="flex items-center justify-between rounded-xl border border-border-soft bg-bg-raised px-4 py-3 text-left transition-colors duration-150 hover:border-border active:scale-[0.99]"
            >
              <div>
                <p className="text-sm font-medium text-text">{s.dayLabel}</p>
                <p className="text-xs text-text-faint">{new Date(s.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-text">{displayWeight(computeSessionVolumeKg(s), units)} {units}</p>
                <p className="text-xs text-text-faint">{s.intensityScore ?? '—'} intensity</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
