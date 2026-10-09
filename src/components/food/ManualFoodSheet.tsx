import { Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import type { FoodEntry, MealType } from '../../lib/db';
import type { FoodDraft } from '../../lib/food';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { MealChips } from './FoodResultCard';

interface ManualFoodSheetProps {
  defaultMeal: MealType;
  /** edit an existing entry instead of adding a new one */
  entry?: FoodEntry;
  onClose: () => void;
  onSave: (draft: FoodDraft, mealType: MealType) => void;
  onDelete?: () => void;
}

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-extrabold text-text-muted">{label}</span>
      <span className="flex h-12 items-center rounded-xl border-2 border-border-strong bg-bg-raised px-3 focus-within:border-accent">
        <input
          type="text"
          inputMode="decimal"
          value={value ? String(value) : ''}
          placeholder="0"
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => onChange(parseFloat(e.target.value.replace(',', '.')) || 0)}
          className="tabular min-w-0 flex-1 bg-transparent text-[17px] font-black text-text outline-none placeholder:text-text-faint"
        />
        <span className="text-xs font-extrabold text-text-faint">{suffix}</span>
      </span>
    </label>
  );
}

export function ManualFoodSheet({ defaultMeal, entry, onClose, onSave, onDelete }: ManualFoodSheetProps) {
  const [name, setName] = useState(entry?.name ?? '');
  const [calories, setCalories] = useState(entry?.calories ?? 0);
  const [proteinG, setProteinG] = useState(entry?.proteinG ?? 0);
  const [carbsG, setCarbsG] = useState(entry?.carbsG ?? 0);
  const [fatG, setFatG] = useState(entry?.fatG ?? 0);
  const [mealType, setMealType] = useState<MealType>(entry?.mealType ?? defaultMeal);
  // Typing macros but not calories? Work calories out for them.
  const fromMacros = Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);

  return (
    <Sheet
      title={entry ? 'Edit food' : 'Enter food'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {onDelete && (
            <Button variant="danger" size="icon" onClick={onDelete} aria-label="Delete this entry">
              <Trash size={20} weight="bold" />
            </Button>
          )}
          <Button
            size="lg"
            className="flex-1"
            disabled={!name.trim() || (calories <= 0 && fromMacros <= 0)}
            onClick={() => onSave({ name, calories: calories > 0 ? calories : fromMacros, proteinG, carbsG, fatG }, mealType)}
          >
            {entry ? 'Save' : `Add to ${mealType === 'snack' ? 'snacks' : mealType}`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-extrabold text-text-muted">What was it?</span>
          <input
            autoFocus={!entry}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Protein shake"
            className="h-12 rounded-xl border-2 border-border-strong bg-bg-raised px-3 text-[16px] font-extrabold text-text outline-none placeholder:text-text-faint focus:border-accent"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories" value={calories} onChange={setCalories} suffix="kcal" />
          <Field label="Protein" value={proteinG} onChange={setProteinG} suffix="g" />
          <Field label="Carbs" value={carbsG} onChange={setCarbsG} suffix="g" />
          <Field label="Fat" value={fatG} onChange={setFatG} suffix="g" />
        </div>
        {calories <= 0 && fromMacros > 0 && <p className="text-sm font-bold text-text-muted">That works out to about {fromMacros} kcal.</p>}
        <MealChips value={mealType} onChange={setMealType} />
      </div>
    </Sheet>
  );
}
