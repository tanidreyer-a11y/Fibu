import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db, type Exercise } from '../lib/db';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../lib/muscleGroups';

interface ExercisePickerSheetProps {
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  /** primary muscle group to bias results toward (e.g. when swapping) */
  preferredGroup?: MuscleGroup;
}

/** Mount this only while it should be open (e.g. `{picker && <ExercisePickerSheet ... />}`) — each mount starts with a clean search query. */
export function ExercisePickerSheet({ onClose, onSelect, preferredGroup }: ExercisePickerSheetProps) {
  const [query, setQuery] = useState('');
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], []);

  const filtered = useMemo(() => {
    const list = exercises ?? [];
    const q = query.trim().toLowerCase();
    const matches = q ? list.filter((e) => e.name.toLowerCase().includes(q)) : list;
    if (!q && preferredGroup) {
      return [...matches].sort((a, b) => {
        const aMatch = a.muscleGroups[0] === preferredGroup ? 0 : 1;
        const bMatch = b.muscleGroups[0] === preferredGroup ? 0 : 1;
        return aMatch - bMatch;
      });
    }
    return matches;
  }, [exercises, query, preferredGroup]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      <button aria-label="Close" className="absolute inset-0 bg-black/50 animate-[fade-in_200ms_ease-out_both]" onClick={onClose} />
      <div className="animate-[sheet-up_260ms_var(--ease-drawer,var(--ease-out))_both] relative flex max-h-[80vh] flex-col rounded-t-3xl border-t border-border-soft bg-bg-raised">
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-border" />
        <div className="p-5 pb-3">
          <h2 className="font-display text-lg font-semibold text-text">Choose an exercise</h2>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises…"
            className="mt-3 h-11 w-full rounded-xl border border-border bg-bg-raised-2 px-4 text-sm text-text placeholder:text-text-faint outline-none focus:border-accent"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-text-muted">No exercises match.</p>}
          <ul className="flex flex-col gap-1">
            {filtered.map((exercise) => (
              <li key={exercise.id}>
                <button
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors duration-150 hover:bg-bg-raised-2 active:scale-[0.99]"
                  onClick={() => {
                    onSelect(exercise);
                    onClose();
                  }}
                >
                  <span>
                    <span className="block text-[15px] font-medium text-text">{exercise.name}</span>
                    <span className="block text-xs text-text-faint">
                      {exercise.muscleGroups.map((g) => MUSCLE_GROUP_LABELS[g]).join(' · ')}
                    </span>
                  </span>
                  <span className="text-xs uppercase text-text-faint">{exercise.equipment}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
