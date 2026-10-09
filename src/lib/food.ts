import { localDate } from './dates';
import { db, mealTypeForHour, type FoodEntry, type MealType } from './db';

export interface FoodDraft {
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingLabel?: string;
}

export const MEALS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snacks' },
];

export function currentMeal(now = new Date()): MealType {
  return mealTypeForHour(now.getHours());
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function cleanDraft(d: FoodDraft): FoodDraft {
  return {
    ...d,
    name: d.name.trim() || 'Food',
    calories: Math.max(0, Math.round(d.calories)),
    proteinG: Math.max(0, r1(d.proteinG)),
    carbsG: Math.max(0, r1(d.carbsG)),
    fatG: Math.max(0, r1(d.fatG)),
  };
}

/** The one place food gets written, used by every sheet and by the AI coach. */
export async function addFood(
  draft: FoodDraft,
  opts: { source: FoodEntry['source']; confidence: FoodEntry['confidence']; mealType?: MealType; date?: string; barcode?: string },
): Promise<number> {
  const clean = cleanDraft(draft);
  return (await db.foodLog.add({
    ...clean,
    date: opts.date ?? localDate(),
    source: opts.source,
    confidence: opts.confidence,
    mealType: opts.mealType ?? currentMeal(),
    ...(opts.barcode ? { barcode: opts.barcode } : {}),
    createdAt: new Date().toISOString(),
  })) as number;
}

export async function logWater(date: string, ml: number) {
  await db.waterLog.add({ date, ml, createdAt: new Date().toISOString() });
}

export function sumFood(entries: Pick<FoodEntry, 'calories' | 'proteinG' | 'carbsG' | 'fatG'>[]) {
  return entries.reduce(
    (acc, e) => ({ calories: acc.calories + e.calories, proteinG: acc.proteinG + e.proteinG, carbsG: acc.carbsG + e.carbsG, fatG: acc.fatG + e.fatG }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** Rough training burn: MET 5 (vigorous lifting) × bodyweight × hours. Shown as an estimate only. */
export function estimateBurn(durationMin: number, weightKg: number): number {
  return Math.round(5 * weightKg * (durationMin / 60));
}
