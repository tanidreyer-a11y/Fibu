import { Barcode, CaretLeft, CaretRight, Camera, Coffee, Cookie, ForkKnife, MagnifyingGlass, Plus, Sun, type Icon } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useMemo, useState } from 'react';
import { WaterTile, WeightTile } from '../components/food/BodyTiles';
import { FoodSearchSheet } from '../components/food/FoodSearchSheet';
import { ManualFoodSheet } from '../components/food/ManualFoodSheet';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Ring } from '../components/ui/Ring';
import { addDays, friendlyDate, localDate } from '../lib/dates';
import { db, type FoodEntry, type MealType } from '../lib/db';
import { addFood, currentMeal, estimateBurn, MEALS, sumFood, type FoodDraft } from '../lib/food';
import { computeTargets, estimateCalorieTarget, estimateProteinTarget } from '../lib/nutrition';
import { useCountUp } from '../lib/useCountUp';

// The camera code (zxing) and photo flow are sizeable: load them on first use, not on every visit.
const BarcodeScanSheet = lazy(() => import('../components/food/BarcodeScanSheet').then((m) => ({ default: m.BarcodeScanSheet })));
const PhotoMealSheet = lazy(() => import('../components/food/PhotoMealSheet').then((m) => ({ default: m.PhotoMealSheet })));

type ActiveSheet = { kind: 'search' | 'barcode' | 'photo' | 'manual'; meal: MealType } | { kind: 'edit'; entry: FoodEntry } | null;

const MEAL_ICON: Record<MealType, Icon> = { breakfast: Coffee, lunch: Sun, dinner: ForkKnife, snack: Cookie };

export function Food() {
  const today = localDate();
  const [date, setDate] = useState(today);
  const profile = useLiveQuery(() => db.profile.get('me'));
  const settings = useLiveQuery(() => db.settings.get('app'));
  const entries = useLiveQuery(() => db.foodLog.where('date').equals(date).toArray(), [date], []);
  const sessions = useLiveQuery(() => db.sessions.where('date').equals(date).toArray(), [date], []);
  const [sheet, setSheet] = useState<ActiveSheet>(null);
  const units = settings?.units ?? 'kg';

  const fallback = useMemo(() => (profile?.birthYear ? computeTargets(profile) : null), [profile]);
  const targets = {
    calories: settings?.calorieTarget ?? fallback?.calories ?? (profile ? estimateCalorieTarget(profile.weightKg, profile.goal) : 2200),
    protein: settings?.proteinTargetG ?? fallback?.proteinG ?? (profile ? estimateProteinTarget(profile.weightKg, profile.goal) : 150),
    carbs: settings?.carbsTargetG ?? fallback?.carbsG ?? 250,
    fat: settings?.fatTargetG ?? fallback?.fatG ?? 70,
    water: settings?.waterTargetMl ?? fallback?.waterMl ?? 2500,
  };

  const totals = sumFood(entries ?? []);
  const burned = (sessions ?? []).reduce((sum, s) => {
    const mins = s.completedAt && s.startedAt ? (Date.parse(s.completedAt) - Date.parse(s.startedAt)) / 60000 : 0;
    return sum + estimateBurn(mins >= 5 && mins < 240 ? mins : (profile?.sessionMinutes ?? 45), profile?.weightKg ?? 75);
  }, 0);
  const left = Math.round(targets.calories - totals.calories);
  const eatenShown = useCountUp(Math.round(totals.calories));
  const leftShown = useCountUp(Math.abs(left));

  async function save(draft: FoodDraft, mealType: MealType, source: FoodEntry['source'], confidence: FoodEntry['confidence'], barcode?: string) {
    await addFood(draft, { source, confidence, mealType, date, barcode });
  }

  const byMeal = (meal: MealType) => (entries ?? []).filter((e) => (e.mealType ?? currentMeal(new Date(e.createdAt))) === meal);
  const defaultMeal = date === today ? currentMeal() : 'dinner';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between pr-12">
        <h1 className="font-display text-2xl font-black text-text">Food</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => setDate(addDays(date, -1))} aria-label="Previous day" className="grid h-9 w-9 place-items-center rounded-xl text-text-muted">
            <CaretLeft size={18} weight="bold" />
          </button>
          <span className="min-w-[5.5rem] text-center text-sm font-extrabold text-text">{friendlyDate(date, today)}</span>
          <button
            onClick={() => setDate(addDays(date, 1))}
            disabled={date >= today}
            aria-label="Next day"
            className="grid h-9 w-9 place-items-center rounded-xl text-text-muted disabled:opacity-30"
          >
            <CaretRight size={18} weight="bold" />
          </button>
        </div>
      </div>

      <Card className="animate-rise-in flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex w-20 flex-col items-center">
            <span className="tabular font-display text-xl font-black text-text">{eatenShown}</span>
            <span className="text-xs font-extrabold text-text-faint">Eaten</span>
          </div>
          <Ring value={totals.calories / Math.max(1, targets.calories)} size={150} stroke={14} tone={left < 0 ? 'streak' : 'accent'} label="Calories today">
            <span className="flex flex-col items-center">
              <span className="tabular font-display text-[32px] leading-none font-black text-text">{leftShown}</span>
              <span className="text-xs font-extrabold text-text-muted">{left >= 0 ? 'kcal left' : 'kcal over'}</span>
            </span>
          </Ring>
          <div className="flex w-20 flex-col items-center">
            <span className="tabular font-display text-xl font-black text-text">{burned}</span>
            <span className="text-xs font-extrabold text-text-faint">Burned</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ['Protein', totals.proteinG, targets.protein, 'protein', 'text-protein-text'],
              ['Carbs', totals.carbsG, targets.carbs, 'carbs', 'text-carbs-text'],
              ['Fat', totals.fatG, targets.fat, 'fat', 'text-fat-text'],
            ] as const
          ).map(([label, value, target, tone, text]) => (
            <div key={label} className="flex flex-col gap-1.5">
              <span className={`text-xs font-extrabold ${text}`}>{label}</span>
              <ProgressBar value={value / Math.max(1, target)} tone={tone} height={10} label={`${label} today`} />
              <span className="tabular text-xs font-extrabold text-text-muted">
                <b className="text-text">{Math.round(value)}</b>/{target}g
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2.5">
        {(
          [
            { kind: 'search', label: 'Search', icon: MagnifyingGlass, style: 'border-border bg-bg-raised text-text [--ledge-color:var(--color-border)]' },
            { kind: 'photo', label: 'Scan food', icon: Camera, style: 'border-accent bg-accent text-accent-ink [--ledge-color:var(--color-accent-ledge)]' },
            { kind: 'barcode', label: 'Barcode', icon: Barcode, style: 'border-border bg-bg-raised text-text [--ledge-color:var(--color-border)]' },
          ] as const
        ).map((a) => (
          <button
            key={a.kind}
            onClick={() => setSheet({ kind: a.kind, meal: defaultMeal })}
            className={`press-3d flex flex-col items-center gap-1.5 rounded-2xl border-2 py-3.5 text-sm font-extrabold ${a.style}`}
          >
            <a.icon size={26} weight="fill" />
            {a.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <WaterTile date={date} targetMl={targets.water} />
        <WeightTile date={date} units={units} />
      </div>

      {MEALS.map((m) => {
        const list = byMeal(m.value);
        const kcal = Math.round(sumFood(list).calories);
        const MealIcon = MEAL_ICON[m.value];
        return (
          <Card key={m.value} className="flex flex-col gap-1 !p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-bg-raised-2 text-text-muted">
                <MealIcon size={20} weight="fill" />
              </span>
              <span className="font-display flex-1 text-[17px] font-extrabold text-text">{m.label}</span>
              {kcal > 0 && <span className="tabular text-sm font-extrabold text-text-muted">{kcal} kcal</span>}
              <button
                onClick={() => setSheet({ kind: 'search', meal: m.value })}
                aria-label={`Add to ${m.label}`}
                className="press-3d press-3d-sm grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-ink [--ledge-color:var(--color-accent-ledge)]"
              >
                <Plus size={18} weight="bold" />
              </button>
            </div>
            {list.length > 0 && (
              <ul className="mt-1.5 flex flex-col divide-y-2 divide-border-soft">
                {list.map((e) => (
                  <li key={e.id}>
                    <button onClick={() => setSheet({ kind: 'edit', entry: e })} className="flex w-full items-center gap-3 py-2.5 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-extrabold text-text">{e.name}</span>
                        <span className="tabular block text-xs font-bold text-text-faint">
                          P {Math.round(e.proteinG)} · C {Math.round(e.carbsG)} · F {Math.round(e.fatG)}
                          {e.confidence === 'estimate' ? ' · estimate' : ''}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-[15px] font-black text-text">{e.calories}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}

      {sheet?.kind === 'search' && (
        <FoodSearchSheet
          defaultMeal={sheet.meal}
          onClose={() => setSheet(null)}
          onSave={async (d, meal, source, confidence) => {
            await save(d, meal, source, confidence);
            setSheet(null);
          }}
          onBarcode={() => setSheet({ kind: 'barcode', meal: sheet.meal })}
          onManual={() => setSheet({ kind: 'manual', meal: sheet.meal })}
        />
      )}
      {sheet?.kind === 'manual' && (
        <ManualFoodSheet
          defaultMeal={sheet.meal}
          onClose={() => setSheet(null)}
          onSave={async (d, meal) => {
            await save(d, meal, 'manual', 'exact');
            setSheet(null);
          }}
        />
      )}
      {sheet?.kind === 'edit' && (
        <ManualFoodSheet
          defaultMeal={sheet.entry.mealType ?? defaultMeal}
          entry={sheet.entry}
          onClose={() => setSheet(null)}
          onSave={async (d, meal) => {
            await db.foodLog.update(sheet.entry.id!, { ...d, mealType: meal });
            setSheet(null);
          }}
          onDelete={async () => {
            await db.foodLog.delete(sheet.entry.id!);
            setSheet(null);
          }}
        />
      )}
      <Suspense fallback={null}>
        {sheet?.kind === 'barcode' && (
          <BarcodeScanSheet
            defaultMeal={sheet.meal}
            onClose={() => setSheet(null)}
            onSave={(d, meal, code) => save(d, meal, 'barcode', 'exact', code)}
            onSearchInstead={() => setSheet({ kind: 'search', meal: sheet.meal })}
            onPhotoInstead={() => setSheet({ kind: 'photo', meal: sheet.meal })}
            onManualInstead={() => setSheet({ kind: 'manual', meal: sheet.meal })}
          />
        )}
        {sheet?.kind === 'photo' && (
          <PhotoMealSheet
            defaultMeal={sheet.meal}
            onClose={() => setSheet(null)}
            onSave={async (d, meal, confidence) => {
              await save(d, meal, 'photo', confidence);
              setSheet(null);
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
