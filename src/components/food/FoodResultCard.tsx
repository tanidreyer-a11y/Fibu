import { PencilSimple } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import type { MealType } from '../../lib/db';
import { MEALS, type FoodDraft } from '../../lib/food';
import { Chip } from '../ui/Chip';
import { Ring } from '../ui/Ring';

const MACROS = [
  { key: 'proteinG', label: 'Protein', dot: 'bg-protein', text: 'text-protein-text', kcal: 4 },
  { key: 'carbsG', label: 'Carbs', dot: 'bg-carbs', text: 'text-carbs-text', kcal: 4 },
  { key: 'fatG', label: 'Fat', dot: 'bg-fat', text: 'text-fat-text', kcal: 9 },
] as const;

export function MealChips({ value, onChange }: { value: MealType; onChange: (m: MealType) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Meal">
      {MEALS.map((m) => (
        <Chip key={m.value} active={value === m.value} onClick={() => onChange(m.value)} role="radio" aria-checked={value === m.value}>
          {m.label}
        </Chip>
      ))}
    </div>
  );
}

function NumberCell({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-extrabold text-text-muted">{label}</span>
      <span className="flex h-12 items-center rounded-xl border-2 border-border-strong bg-bg-raised px-3 focus-within:border-accent">
        <input
          type="text"
          inputMode="decimal"
          value={Number.isFinite(value) ? String(value) : ''}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const v = parseFloat(e.target.value.replace(',', '.'));
            onChange(Number.isNaN(v) ? 0 : v);
          }}
          className="tabular min-w-0 flex-1 bg-transparent text-[17px] font-black text-text outline-none"
        />
        <span className="text-xs font-extrabold text-text-faint">{suffix}</span>
      </span>
    </label>
  );
}

interface FoodResultCardProps {
  draft: FoodDraft;
  onChange: (draft: FoodDraft) => void;
  mealType: MealType;
  onMealType: (m: MealType) => void;
  /** e.g. "Estimate", "From the label", "Per 1 bar (40 g)" */
  badge?: string;
  children?: ReactNode;
}

/** The shared "here's what you're logging" card: big calorie ring, coloured macro rows, meal slot. */
export function FoodResultCard({ draft, onChange, mealType, onMealType, badge, children }: FoodResultCardProps) {
  const [editing, setEditing] = useState(false);
  const macroKcal = draft.proteinG * 4 + draft.carbsG * 4 + draft.fatG * 9 || 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2">
        {editing ? (
          <input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            aria-label="Food name"
            className="h-12 min-w-0 flex-1 rounded-xl border-2 border-border-strong bg-bg-raised px-3 text-[17px] font-extrabold text-text outline-none focus:border-accent"
          />
        ) : (
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-xl leading-tight font-black text-text">{draft.name}</h3>
            {badge && <span className="mt-1 inline-block rounded-md bg-bg-raised-2 px-2 py-0.5 text-xs font-extrabold text-text-muted">{badge}</span>}
          </div>
        )}
        <button
          onClick={() => setEditing((e) => !e)}
          aria-pressed={editing}
          className={`flex h-10 shrink-0 items-center gap-1 rounded-xl px-3 text-sm font-extrabold ${editing ? 'bg-accent text-accent-ink' : 'bg-bg-raised-2 text-text-muted'}`}
        >
          <PencilSimple size={16} weight="bold" /> {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <div className="grid grid-cols-2 gap-3">
          <NumberCell label="Calories" value={draft.calories} suffix="kcal" onChange={(v) => onChange({ ...draft, calories: v })} />
          <NumberCell label="Protein" value={draft.proteinG} suffix="g" onChange={(v) => onChange({ ...draft, proteinG: v })} />
          <NumberCell label="Carbs" value={draft.carbsG} suffix="g" onChange={(v) => onChange({ ...draft, carbsG: v })} />
          <NumberCell label="Fat" value={draft.fatG} suffix="g" onChange={(v) => onChange({ ...draft, fatG: v })} />
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <Ring value={1} size={112} stroke={11} tone="accent" label={`${draft.calories} calories`}>
            <span className="flex flex-col items-center">
              <span className="tabular font-display text-[26px] leading-none font-black text-text">{draft.calories}</span>
              <span className="text-xs font-extrabold text-text-muted">kcal</span>
            </span>
          </Ring>
          <div className="flex flex-1 flex-col gap-2.5">
            {MACROS.map((m) => {
              const grams = draft[m.key];
              const share = Math.round(((grams * m.kcal) / macroKcal) * 100);
              return (
                <div key={m.key} className="flex items-center gap-2">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${m.dot}`} />
                  <span className={`flex-1 text-sm font-extrabold ${m.text}`}>{m.label}</span>
                  <span className="tabular text-[15px] font-black text-text">{Math.round(grams)}g</span>
                  <span className="tabular w-9 text-right text-xs font-bold text-text-faint">{share}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {children}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-extrabold text-text-muted">Add to</span>
        <MealChips value={mealType} onChange={onMealType} />
      </div>
    </div>
  );
}
