import { Check, X } from '@phosphor-icons/react';
import { useState } from 'react';
import type { Units } from '../lib/db';
import { displayWeight, toStorageWeightKg } from '../lib/units';

interface SetRowProps {
  index: number;
  reps: number;
  weightKg: number;
  units: Units;
  done: boolean;
  /** timed moves log seconds and skip the weight column */
  timed?: boolean;
  onChange: (next: { reps: number; weightKg: number }) => void;
  onToggleDone: () => void;
  onRemove: () => void;
}

/** Big tap-to-type box. Keeps a local string so "62." can be typed on the way to "62.5". */
function NumField({ value, onChange, label, decimal, done }: { value: number; onChange: (v: number) => void; label: string; decimal: boolean; done: boolean }) {
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  // Outside changes (a suggestion applied, a unit switch) replace the text; our own typing doesn't.
  if (value !== seen) {
    setSeen(value);
    if (parseFloat(text) !== value) setText(String(value));
  }

  return (
    <input
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      aria-label={label}
      value={text}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.');
        if (!/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        const v = parseFloat(raw);
        onChange(Number.isNaN(v) ? 0 : v);
      }}
      className={`tabular h-12 min-w-0 flex-1 rounded-xl border-2 bg-bg-raised text-center text-[18px] font-black text-text outline-none focus:border-accent ${
        done ? 'border-protein/40' : 'border-border'
      }`}
    />
  );
}

export function SetRow({ index, reps, weightKg, units, done, timed = false, onChange, onToggleDone, onRemove }: SetRowProps) {
  return (
    <div className={`flex items-center gap-1.5 rounded-xl p-0.5 transition-colors duration-200 ${done ? 'bg-protein-tint' : ''}`}>
      <span className={`tabular w-6 shrink-0 text-center text-sm font-black ${done ? 'text-protein-text' : 'text-text-faint'}`}>{index + 1}</span>
      {!timed && (
        <NumField
          label={`Set ${index + 1} weight in ${units}`}
          decimal
          done={done}
          value={displayWeight(weightKg, units)}
          onChange={(v) => onChange({ reps, weightKg: toStorageWeightKg(v, units) })}
        />
      )}
      <NumField
        label={`Set ${index + 1} ${timed ? 'seconds' : 'reps'}`}
        decimal={false}
        done={done}
        value={reps}
        onChange={(v) => onChange({ reps: Math.round(v), weightKg })}
      />
      <button
        type="button"
        aria-label={done ? `Undo set ${index + 1}` : `Complete set ${index + 1}`}
        aria-pressed={done}
        onClick={onToggleDone}
        className={`press-3d press-3d-sm grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 ${
          done
            ? 'border-success bg-success text-accent-ink [--ledge-color:#22700c]'
            : 'border-border bg-bg-raised text-text-faint [--ledge-color:var(--color-border)]'
        }`}
      >
        <Check size={20} weight="bold" />
      </button>
      <button
        type="button"
        aria-label={`Remove set ${index + 1}`}
        className="grid h-12 w-7 shrink-0 place-items-center text-text-faint transition-colors duration-150 [@media(hover:hover)]:hover:text-danger"
        onClick={onRemove}
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}
