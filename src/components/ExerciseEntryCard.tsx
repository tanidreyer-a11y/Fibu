import { Card } from './ui/Card';
import { Chip } from './ui/Chip';
import { SetRow } from './SetRow';
import type { Exercise, SetEntry, Units } from '../lib/db';
import { MUSCLE_GROUP_LABELS } from '../lib/muscleGroups';
import { useRestTimer } from '../store/restTimer';
import type { OverloadSuggestion } from '../lib/training';
import { displayWeight } from '../lib/units';

const RPE_OPTIONS = [6, 7, 8, 9, 10];
const DEFAULT_REST_SECONDS = 90;

interface ExerciseEntryCardProps {
  exercise: Exercise;
  sets: SetEntry[];
  units: Units;
  lastHint?: { date: string; set: SetEntry } | null;
  /** Progressive-overload target for this exercise, when history exists — drives both the ghost-value prefill and the tappable cue chip. */
  suggestion?: OverloadSuggestion | null;
  onUpdateSets: (sets: SetEntry[]) => void;
  onSwap: () => void;
  onRemove: () => void;
}

export function ExerciseEntryCard({ exercise, sets, units, lastHint, suggestion, onUpdateSets, onSwap, onRemove }: ExerciseEntryCardProps) {
  const lastSetIndex = sets.length - 1;
  const currentRpe = lastSetIndex >= 0 ? sets[lastSetIndex].rpe : undefined;

  function updateSet(i: number, next: { reps: number; weightKg: number }) {
    onUpdateSets(sets.map((s, idx) => (idx === i ? { ...s, ...next } : s)));
  }

  function removeSet(i: number) {
    onUpdateSets(sets.filter((_, idx) => idx !== i));
  }

  function addSet() {
    useRestTimer.getState().start(DEFAULT_REST_SECONDS);
    const prev = sets[sets.length - 1];
    onUpdateSets([...sets, { reps: prev?.reps ?? 8, weightKg: prev?.weightKg ?? 20 }]);
  }

  function applySuggestion() {
    if (!suggestion) return;
    const target = { reps: suggestion.targetReps, weightKg: suggestion.targetWeightKg };
    if (sets.length === 0) {
      onUpdateSets([target]);
    } else {
      onUpdateSets(sets.map((s, idx) => (idx === lastSetIndex ? { ...s, ...target } : s)));
    }
  }

  function setRpe(rpe: number) {
    if (lastSetIndex < 0) return;
    onUpdateSets(sets.map((s, idx) => (idx === lastSetIndex ? { ...s, rpe } : s)));
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display font-semibold text-text">{exercise.name}</h3>
          <p className="text-xs text-text-faint">{exercise.muscleGroups.map((g) => MUSCLE_GROUP_LABELS[g]).join(' · ')}</p>
          {lastHint && (
            <p className="mt-1 text-xs text-text-muted">
              Last time: {displayWeight(lastHint.set.weightKg, units)}
              {units} × {lastHint.set.reps}
            </p>
          )}
          {suggestion && (
            <div className="mt-2">
              <Chip onClick={applySuggestion} className="!py-1 !px-3 text-xs">
                Try {displayWeight(suggestion.targetWeightKg, units)}
                {units} × {suggestion.targetReps}
              </Chip>
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={onSwap}
            className="grid h-9 w-9 place-items-center rounded-lg text-text-faint transition-colors duration-150 hover:bg-bg-raised-2 hover:text-text active:scale-[0.9]"
            aria-label="Swap exercise"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h13l-3-3M20 17H7l3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={onRemove}
            className="grid h-9 w-9 place-items-center rounded-lg text-text-faint transition-colors duration-150 hover:bg-danger-dim hover:text-danger active:scale-[0.9]"
            aria-label="Remove exercise"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {sets.length > 0 && (
        <div className="flex items-center gap-1.5 px-0.5 text-[10px] font-medium uppercase tracking-wide text-text-faint">
          <span className="w-4 shrink-0" />
          <span className="flex-1 text-center">Weight ({units})</span>
          <span className="flex-1 text-center">Reps</span>
          <span className="w-7 shrink-0" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {sets.map((s, i) => (
          <SetRow key={i} index={i} reps={s.reps} weightKg={s.weightKg} units={units} onChange={(n) => updateSet(i, n)} onRemove={() => removeSet(i)} />
        ))}
      </div>

      <button
        onClick={addSet}
        className="rounded-lg border border-dashed border-border py-2.5 text-sm font-medium text-text-muted transition-colors duration-150 hover:border-text-faint hover:text-text active:scale-[0.98]"
      >
        + Add set
      </button>

      {sets.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-faint">Felt like</span>
          <div className="flex gap-1">
            {RPE_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRpe(r)}
                className={`h-8 w-8 rounded-full text-xs font-medium transition-colors duration-150 ${
                  currentRpe === r ? 'bg-accent text-accent-ink' : 'bg-bg-raised-2 text-text-faint hover:text-text'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
