import { ArrowsClockwise, Info, Plus, Target, Trash, TrendUp } from '@phosphor-icons/react';
import type { Exercise, Prescription, SetEntry, Units } from '../lib/db';
import { CURATED_BY_ID } from '../lib/exercises';
import { MUSCLE_GROUP_LABELS } from '../lib/muscleGroups';
import type { OverloadSuggestion } from '../lib/training';
import { displayWeight } from '../lib/units';
import { useRestTimer } from '../store/restTimer';
import { ExerciseThumb } from './ExerciseThumb';
import { SetRow } from './SetRow';
import { Card } from './ui/Card';

export type DraftSet = SetEntry & { done?: boolean };

const RPE_OPTIONS = [
  { value: 6, label: 'Easy' },
  { value: 7, label: '7' },
  { value: 8, label: '8' },
  { value: 9, label: '9' },
  { value: 10, label: 'Max' },
];

interface ExerciseEntryCardProps {
  exercise: Exercise;
  sets: DraftSet[];
  units: Units;
  target?: Prescription;
  lastHint?: { date: string; set: SetEntry } | null;
  suggestion?: OverloadSuggestion | null;
  onUpdateSets: (sets: DraftSet[]) => void;
  onSwap: () => void;
  onRemove: () => void;
  onInfo: () => void;
  onLevelUp?: (exerciseId: string) => void;
}

function targetText(t: Prescription): string {
  const range = t.repsMin === t.repsMax ? `${t.repsMin}` : `${t.repsMin}–${t.repsMax}`;
  return `${t.sets} × ${range}${t.unit === 'sec' ? 's' : ''} · ${t.restSec}s rest`;
}

export function ExerciseEntryCard({
  exercise,
  sets,
  units,
  target,
  lastHint,
  suggestion,
  onUpdateSets,
  onSwap,
  onRemove,
  onInfo,
  onLevelUp,
}: ExerciseEntryCardProps) {
  const timed = exercise.unit === 'sec' || target?.unit === 'sec';
  const doneCount = sets.filter((s) => s.done).length;
  const lastDoneIndex = sets.map((s) => !!s.done).lastIndexOf(true);
  const rpeIndex = lastDoneIndex >= 0 ? lastDoneIndex : sets.length - 1;
  const currentRpe = rpeIndex >= 0 ? sets[rpeIndex].rpe : undefined;
  const nextName = suggestion?.nextExerciseId ? CURATED_BY_ID.get(suggestion.nextExerciseId)?.name : undefined;
  const open = sets.filter((s) => !s.done);
  const alreadyApplied =
    !!suggestion && open.length > 0 && open.every((s) => s.reps === suggestion.targetReps && s.weightKg === suggestion.targetWeightKg);

  function updateSet(i: number, next: { reps: number; weightKg: number }) {
    onUpdateSets(sets.map((s, idx) => (idx === i ? { ...s, ...next } : s)));
  }

  function toggleDone(i: number) {
    const willBeDone = !sets[i].done;
    onUpdateSets(sets.map((s, idx) => (idx === i ? { ...s, done: willBeDone } : s)));
    // The rest timer starts when a set is ticked off, not when one is added.
    if (willBeDone) useRestTimer.getState().start(target?.restSec ?? 90);
  }

  function addSet() {
    const prev = sets[sets.length - 1];
    onUpdateSets([...sets, { reps: prev?.reps ?? target?.repsMin ?? 8, weightKg: prev?.weightKg ?? 0, done: false }]);
  }

  function applySuggestion() {
    if (!suggestion) return;
    const next = { reps: suggestion.targetReps, weightKg: suggestion.targetWeightKg };
    onUpdateSets(sets.length ? sets.map((s) => (s.done ? s : { ...s, ...next })) : [{ ...next, done: false }]);
  }

  function setRpe(rpe: number) {
    if (rpeIndex < 0) return;
    onUpdateSets(sets.map((s, idx) => (idx === rpeIndex ? { ...s, rpe } : s)));
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <button onClick={onInfo} aria-label={`How to do ${exercise.name}`} className="shrink-0">
          <ExerciseThumb exercise={exercise} size={52} />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[17px] leading-tight font-extrabold text-text">{exercise.name}</h3>
          <p className="mt-0.5 text-xs font-bold text-text-faint">
            {exercise.muscleGroups
              .slice(0, 3)
              .map((g) => MUSCLE_GROUP_LABELS[g] ?? g)
              .join(' · ')}
          </p>
        </div>
        <div className="-mr-1 flex shrink-0">
          <button onClick={onInfo} className="grid h-10 w-9 place-items-center rounded-lg text-text-faint [@media(hover:hover)]:hover:text-text" aria-label="How to do it">
            <Info size={19} weight="bold" />
          </button>
          <button onClick={onSwap} className="grid h-10 w-9 place-items-center rounded-lg text-text-faint [@media(hover:hover)]:hover:text-text" aria-label="Swap exercise">
            <ArrowsClockwise size={19} weight="bold" />
          </button>
          <button onClick={onRemove} className="grid h-10 w-9 place-items-center rounded-lg text-text-faint [@media(hover:hover)]:hover:text-danger" aria-label="Remove exercise">
            <Trash size={19} weight="bold" />
          </button>
        </div>
      </div>

      {(target || lastHint) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] font-bold">
          {target && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-water-tint px-2 py-1 text-water-text">
              <Target size={14} weight="bold" />
              {targetText(target)}
            </span>
          )}
          {lastHint && (
            <span className="text-text-muted">
              Last: {lastHint.set.weightKg > 0 ? `${displayWeight(lastHint.set.weightKg, units)}${units} × ` : ''}
              {lastHint.set.reps}
              {timed ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {suggestion && (
        nextName && onLevelUp ? (
          <button
            onClick={() => onLevelUp(suggestion.nextExerciseId!)}
            className="press-3d press-3d-sm flex items-center gap-2 rounded-xl border-2 border-xp bg-xp-tint px-3 py-2.5 text-left text-sm font-extrabold text-xp-text [--ledge-color:var(--color-xp)]"
          >
            <TrendUp size={18} weight="bold" />
            <span className="flex-1">Level up: switch to {nextName}</span>
          </button>
        ) : alreadyApplied ? (
          <p className="flex items-center gap-2 rounded-xl bg-protein-tint px-3 py-2 text-sm font-extrabold text-protein-text">
            <TrendUp size={18} weight="bold" className="shrink-0" />
            {suggestion.message}
          </p>
        ) : (
          <button
            onClick={applySuggestion}
            className="press-3d press-3d-sm flex items-center gap-2 rounded-xl border-2 border-protein/50 bg-protein-tint px-3 py-2 text-left text-sm font-extrabold text-protein-text [--ledge-color:var(--color-protein)]"
          >
            <TrendUp size={18} weight="bold" />
            <span className="flex-1">{suggestion.message}</span>
            <span className="shrink-0 text-xs uppercase">Use</span>
          </button>
        )
      )}

      {sets.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-text-faint uppercase">
          <span className="w-6 shrink-0 text-center">Set</span>
          {!timed && <span className="flex-1 text-center">{exercise.equipment === 'bodyweight' ? `+${units}` : units}</span>}
          <span className="flex-1 text-center">{timed ? 'Seconds' : 'Reps'}</span>
          <span className="w-12 shrink-0 text-center">Done</span>
          <span className="w-7 shrink-0" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {sets.map((s, i) => (
          <SetRow
            key={i}
            index={i}
            reps={s.reps}
            weightKg={s.weightKg}
            units={units}
            done={!!s.done}
            timed={timed}
            onChange={(n) => updateSet(i, n)}
            onToggleDone={() => toggleDone(i)}
            onRemove={() => onUpdateSets(sets.filter((_, idx) => idx !== i))}
          />
        ))}
      </div>

      <button
        onClick={addSet}
        className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-2.5 text-sm font-extrabold text-text-muted transition-colors duration-150 [@media(hover:hover)]:hover:border-text-faint [@media(hover:hover)]:hover:text-text"
      >
        <Plus size={16} weight="bold" /> Add set
        {target && doneCount < target.sets && <span className="text-text-faint">({doneCount}/{target.sets} done)</span>}
      </button>

      {doneCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-text-faint">How hard?</span>
          <div className="flex flex-1 gap-1">
            {RPE_OPTIONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setRpe(r.value)}
                aria-pressed={currentRpe === r.value}
                className={`h-8 flex-1 rounded-lg text-xs font-extrabold transition-colors duration-150 ${
                  currentRpe === r.value ? 'bg-accent text-accent-ink' : 'bg-bg-raised-2 text-text-faint [@media(hover:hover)]:hover:text-text'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
