import { useState } from 'react';
import type { FoodEntry } from '../lib/db';
import { Button } from './ui/Button';

interface ManualFoodSheetProps {
  onClose: () => void;
  onSave: (entry: Pick<FoodEntry, 'name' | 'calories' | 'proteinG' | 'carbsG' | 'fatG'>) => void;
}

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-text-faint">{label}</span>
      <div className="flex h-11 items-center rounded-xl border border-border bg-bg-raised-2 px-3">
        <input
          type="number"
          inputMode="decimal"
          value={value || ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-text outline-none"
          placeholder="0"
        />
        <span className="text-xs text-text-faint">{suffix}</span>
      </div>
    </label>
  );
}

export function ManualFoodSheet({ onClose, onSave }: ManualFoodSheetProps) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState(0);
  const [proteinG, setProteinG] = useState(0);
  const [carbsG, setCarbsG] = useState(0);
  const [fatG, setFatG] = useState(0);

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      <button aria-label="Close" className="absolute inset-0 bg-black/50 animate-[fade-in_200ms_ease-out_both]" onClick={onClose} />
      <div className="animate-[sheet-up_260ms_var(--ease-drawer,var(--ease-out))_both] relative flex flex-col gap-4 rounded-t-3xl border-t border-border-soft bg-bg-raised p-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <div className="mx-auto -mt-1 h-1.5 w-10 rounded-full bg-border" />
        <h2 className="font-display text-lg font-semibold text-text">Log food</h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-faint">What was it</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Chicken and rice bowl"
            className="h-11 rounded-xl border border-border bg-bg-raised-2 px-4 text-[15px] text-text placeholder:text-text-faint outline-none focus:border-accent"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories" value={calories} onChange={setCalories} suffix="kcal" />
          <Field label="Protein" value={proteinG} onChange={setProteinG} suffix="g" />
          <Field label="Carbs" value={carbsG} onChange={setCarbsG} suffix="g" />
          <Field label="Fat" value={fatG} onChange={setFatG} suffix="g" />
        </div>

        <Button size="lg" disabled={!name.trim() || calories <= 0} onClick={() => onSave({ name: name.trim(), calories, proteinG, carbsG, fatG })}>
          Add to today
        </Button>
      </div>
    </div>
  );
}
