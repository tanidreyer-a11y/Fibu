import type { Units } from '../lib/db';
import { displayWeight, toStorageWeightKg } from '../lib/units';

interface SetRowProps {
  index: number;
  reps: number;
  weightKg: number;
  units: Units;
  onChange: (next: { reps: number; weightKg: number }) => void;
  onRemove: () => void;
}

function MiniStepper({ value, onChange, step }: { value: number; onChange: (v: number) => void; step: number }) {
  return (
    <div className="flex h-11 min-w-0 flex-1 items-center rounded-lg border border-border bg-bg-raised-2">
      <button
        type="button"
        aria-label="Decrease"
        className="grid h-11 w-8 shrink-0 place-items-center text-text-muted active:scale-[0.9]"
        onClick={() => onChange(Math.max(0, Math.round((value - step) * 100) / 100))}
      >
        &minus;
      </button>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(Math.max(0, v));
        }}
        className="min-w-0 flex-1 bg-transparent text-center text-[15px] font-semibold text-text outline-none"
      />
      <button
        type="button"
        aria-label="Increase"
        className="grid h-11 w-8 shrink-0 place-items-center text-text-muted active:scale-[0.9]"
        onClick={() => onChange(Math.round((value + step) * 100) / 100)}
      >
        +
      </button>
    </div>
  );
}

export function SetRow({ index, reps, weightKg, units, onChange, onRemove }: SetRowProps) {
  const displayW = displayWeight(weightKg, units);

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-4 shrink-0 text-center text-xs font-medium text-text-faint">{index + 1}</span>
      <MiniStepper value={displayW} step={units === 'kg' ? 2.5 : 5} onChange={(v) => onChange({ reps, weightKg: toStorageWeightKg(v, units) })} />
      <MiniStepper value={reps} step={1} onChange={(v) => onChange({ reps: v, weightKg })} />
      <button
        type="button"
        aria-label="Remove set"
        className="grid h-11 w-7 shrink-0 place-items-center text-text-faint transition-colors duration-150 hover:text-danger active:scale-[0.9]"
        onClick={onRemove}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
