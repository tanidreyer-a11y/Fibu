import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useState } from 'react';
import { ManualFoodSheet } from '../components/ManualFoodSheet';
import { Card } from '../components/ui/Card';
import { db, type FoodEntry } from '../lib/db';
import { estimateCalorieTarget, estimateProteinTarget } from '../lib/nutrition';
import { useCountUp } from '../lib/useCountUp';

// @zxing/browser (barcode decoding) and the photo sheet are both sizeable —
// only worth loading once someone actually taps Scan or Photo, not on every visit to this page.
const BarcodeScanSheet = lazy(() => import('../components/BarcodeScanSheet').then((m) => ({ default: m.BarcodeScanSheet })));
const PhotoEstimateSheet = lazy(() => import('../components/PhotoEstimateSheet').then((m) => ({ default: m.PhotoEstimateSheet })));

type ActiveSheet = 'manual' | 'barcode' | 'photo' | null;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Food() {
  const profile = useLiveQuery(() => db.profile.get('me'));
  const settings = useLiveQuery(() => db.settings.get('app'));
  const today = todayStr();
  const entries = useLiveQuery(() => db.foodLog.where('date').equals(today).toArray(), [today], []);

  const [sheet, setSheet] = useState<ActiveSheet>(null);

  const calorieTarget = settings?.calorieTarget ?? (profile ? estimateCalorieTarget(profile.weightKg, profile.goal) : 2200);
  const proteinTarget = settings?.proteinTargetG ?? (profile ? estimateProteinTarget(profile.weightKg, profile.goal) : 150);

  const totals = (entries ?? []).reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const calorieProgress = Math.min(1, totals.calories / Math.max(1, calorieTarget));
  const remaining = Math.round(calorieTarget - totals.calories);
  const displayCalories = useCountUp(totals.calories);
  const displayProtein = useCountUp(Math.round(totals.proteinG));
  const displayCarbs = useCountUp(Math.round(totals.carbsG));
  const displayFat = useCountUp(Math.round(totals.fatG));

  async function addEntry(
    source: FoodEntry['source'],
    confidence: FoodEntry['confidence'],
    entry: Pick<FoodEntry, 'name' | 'calories' | 'proteinG' | 'carbsG' | 'fatG'>,
  ) {
    await db.foodLog.add({
      date: today,
      source,
      confidence,
      createdAt: new Date().toISOString(),
      ...entry,
    });
    if (source === 'manual' || source === 'photo') setSheet(null);
  }

  async function removeEntry(id: number | undefined) {
    if (id == null) return;
    await db.foodLog.delete(id);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-text">Food today</h1>

      <Card className="flex flex-col items-center gap-3">
        <div className="relative h-32 w-32">
          <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-border)" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 42}
              strokeDashoffset={2 * Math.PI * 42 * (1 - calorieProgress)}
              style={{ transition: 'stroke-dashoffset 500ms var(--ease-out)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-2xl font-bold tabular-nums text-text">{displayCalories}</span>
            <span className="text-[11px] text-text-faint">of {calorieTarget} kcal</span>
          </div>
        </div>
        <p className="text-sm text-text-muted">{remaining >= 0 ? `${remaining} kcal left today` : `${-remaining} kcal over today`}</p>
        <div className="flex w-full justify-around border-t border-border-soft pt-3 text-center">
          <div>
            <p className="font-display text-lg font-semibold tabular-nums text-text">{displayProtein}g</p>
            <p className="text-[11px] text-text-faint">protein / {proteinTarget}g</p>
          </div>
          <div>
            <p className="font-display text-lg font-semibold tabular-nums text-text">{displayCarbs}g</p>
            <p className="text-[11px] text-text-faint">carbs</p>
          </div>
          <div>
            <p className="font-display text-lg font-semibold tabular-nums text-text">{displayFat}g</p>
            <p className="text-[11px] text-text-faint">fat</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setSheet('barcode')}
          className="flex flex-col items-center gap-2 rounded-xl border border-border-soft bg-bg-raised py-4 text-text-muted transition-colors duration-150 hover:border-border active:scale-[0.97]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 5v14M8 5v14M11 5v14M14 5v14h2V5M19 5v14" strokeLinecap="round" />
          </svg>
          <span className="text-xs font-medium">Scan</span>
        </button>
        <button
          onClick={() => setSheet('photo')}
          className="flex flex-col items-center gap-2 rounded-xl border border-border-soft bg-bg-raised py-4 text-text-muted transition-colors duration-150 hover:border-border active:scale-[0.97]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="6" width="18" height="14" rx="2" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          <span className="text-xs font-medium">Photo</span>
        </button>
        <button
          onClick={() => setSheet('manual')}
          className="flex flex-col items-center gap-2 rounded-xl border border-border-soft bg-bg-raised py-4 text-text-muted transition-colors duration-150 hover:border-border active:scale-[0.97]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          <span className="text-xs font-medium">Manual</span>
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {(entries ?? []).length === 0 && <p className="py-4 text-center text-sm text-text-muted">Nothing logged yet today.</p>}
        {(entries ?? [])
          .slice()
          .reverse()
          .map((e) => (
            <div key={e.id} className="animate-rise-in flex items-center justify-between rounded-xl border border-border-soft bg-bg-raised px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text">{e.name}</p>
                <p className="text-xs text-text-faint">
                  {e.calories} kcal · {Math.round(e.proteinG)}g protein
                  {e.confidence === 'estimate' ? ' · estimate' : ''}
                </p>
              </div>
              <button
                onClick={() => removeEntry(e.id)}
                aria-label="Remove"
                className="grid h-9 w-9 place-items-center rounded-lg text-text-faint transition-colors duration-150 hover:bg-danger-dim hover:text-danger active:scale-90"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
      </div>

      {sheet === 'manual' && <ManualFoodSheet onClose={() => setSheet(null)} onSave={(e) => addEntry('manual', 'exact', e)} />}
      <Suspense fallback={null}>
        {sheet === 'barcode' && <BarcodeScanSheet onClose={() => setSheet(null)} onSave={(e) => addEntry('barcode', 'exact', e)} />}
        {sheet === 'photo' && <PhotoEstimateSheet onClose={() => setSheet(null)} onSave={(e) => addEntry('photo', 'estimate', e)} />}
      </Suspense>
    </div>
  );
}
