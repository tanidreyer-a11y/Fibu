import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExerciseEntryCard } from '../components/ExerciseEntryCard';
import { ExercisePickerSheet } from '../components/ExercisePickerSheet';
import { VoiceLogSheet } from '../components/VoiceLogSheet';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { db, type Exercise, type ExerciseEntry, type SetEntry, type WorkoutSession } from '../lib/db';
import { calculateIntensityScore, lastSetForExercise, suggestProgressiveOverload } from '../lib/training';

type PickerTarget = { mode: 'add' } | { mode: 'swap'; entryIndex: number };

export function WorkoutLog() {
  const navigate = useNavigate();
  const plan = useLiveQuery(() => db.plan.get('active'));
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], []);
  const settings = useLiveQuery(() => db.settings.get('app'));
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], []);

  const [dayLabel, setDayLabel] = useState<string | null>(null);
  const [entries, setEntries] = useState<ExerciseEntry[]>([]);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const units = settings?.units ?? 'kg';
  const exercisesById = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises]);

  /** Ghost-value prefill: start a new exercise entry at last time's overload target, not a blank guess. */
  function startingSet(exerciseId: string): SetEntry {
    const last = sessions?.length ? lastSetForExercise(sessions, exerciseId) : null;
    if (!last) return { reps: 8, weightKg: 20 };
    const suggestion = suggestProgressiveOverload(last.set, units);
    return { reps: suggestion.targetReps, weightKg: suggestion.targetWeightKg };
  }

  function pickDay(label: string) {
    setDayLabel(label);
    const planDay = plan?.days.find((d) => d.label === label);
    if (planDay) {
      setEntries(
        planDay.suggestedExerciseIds.map((exerciseId) => ({
          exerciseId,
          sets: [startingSet(exerciseId)],
        })),
      );
    } else {
      setEntries([]);
    }
  }

  function updateEntrySets(index: number, sets: ExerciseEntry['sets']) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, sets } : e)));
  }

  function removeEntry(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function handlePickerSelect(exercise: Exercise) {
    if (!picker) return;
    if (picker.mode === 'add') {
      setEntries((prev) => [...prev, { exerciseId: exercise.id, sets: [startingSet(exercise.id)] }]);
    } else {
      setEntries((prev) => prev.map((e, i) => (i === picker.entryIndex ? { exerciseId: exercise.id, sets: [startingSet(exercise.id)] } : e)));
    }
  }

  function handleVoiceConfirm(exerciseId: string, sets: SetEntry[]) {
    setEntries((prev) => [...prev, { exerciseId, sets }]);
    setVoiceOpen(false);
  }

  function cancel() {
    if (entries.some((e) => e.sets.length > 0) && !window.confirm('Discard this workout?')) return;
    navigate('/');
  }

  async function finish() {
    const hasWork = entries.some((e) => e.sets.length > 0);
    if (!hasWork || !dayLabel) return;
    setSaving(true);

    const recent = (sessions ?? [])
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    const draft: Pick<WorkoutSession, 'exerciseEntries'> = { exerciseEntries: entries.filter((e) => e.sets.length > 0) };
    const intensity = calculateIntensityScore(draft, recent);
    const now = new Date();

    const id = await db.sessions.add({
      date: now.toISOString().slice(0, 10),
      dayLabel,
      startedAt: now.toISOString(),
      completedAt: now.toISOString(),
      exerciseEntries: draft.exerciseEntries,
      intensityScore: intensity.score,
    });

    navigate(`/summary/${id}`, { replace: true });
  }

  if (!dayLabel) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">What are you training?</h1>
          <p className="mt-1 text-text-muted">Pick today's focus, or go freeform.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(plan?.days ?? []).map((d) => (
            <Chip key={d.label} onClick={() => pickDay(d.label)}>
              {d.label}
            </Chip>
          ))}
          <Chip onClick={() => pickDay('Freeform')}>Freeform</Chip>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => setDayLabel(null)} className="text-xs font-medium text-text-faint hover:text-text-muted">
            &larr; Change day
          </button>
          <h1 className="font-display text-2xl font-semibold text-text">{dayLabel}</h1>
        </div>
        <button onClick={cancel} className="text-sm font-medium text-text-faint hover:text-danger">
          Cancel
        </button>
      </div>

      {entries.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted">
          No exercises yet. Add whatever you're actually doing today.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {entries.map((entry, i) => {
          const exercise = exercisesById.get(entry.exerciseId);
          if (!exercise) return null;
          const lastHint = (sessions ?? []).length
            ? lastSetForExercise(sessions!, entry.exerciseId)
            : null;
          const suggestion = lastHint ? suggestProgressiveOverload(lastHint.set, units) : null;
          return (
            <ExerciseEntryCard
              key={i}
              exercise={exercise}
              sets={entry.sets}
              units={units}
              lastHint={lastHint}
              suggestion={suggestion}
              onUpdateSets={(sets) => updateEntrySets(i, sets)}
              onSwap={() => setPicker({ mode: 'swap', entryIndex: i })}
              onRemove={() => removeEntry(i)}
            />
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setPicker({ mode: 'add' })}>
          + Add exercise
        </Button>
        {settings?.geminiApiKey && (
          <Button variant="secondary" size="icon" onClick={() => setVoiceOpen(true)} aria-label="Log by voice">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 17v4" strokeLinecap="round" />
            </svg>
          </Button>
        )}
      </div>

      <Button size="lg" disabled={saving || !entries.some((e) => e.sets.length > 0)} onClick={finish}>
        {saving ? 'Saving…' : 'Finish workout'}
      </Button>

      {picker && (
        <ExercisePickerSheet
          onClose={() => setPicker(null)}
          onSelect={handlePickerSelect}
          preferredGroup={picker.mode === 'swap' ? exercisesById.get(entries[picker.entryIndex]?.exerciseId)?.muscleGroups[0] : undefined}
        />
      )}

      {voiceOpen && <VoiceLogSheet units={units} onClose={() => setVoiceOpen(false)} onConfirm={handleVoiceConfirm} />}
    </div>
  );
}
