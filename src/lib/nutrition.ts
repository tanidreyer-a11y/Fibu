import type { ActivityLevel, Goal, Profile, Sex } from './db';

/**
 * Fallback when age/sex aren't known (profiles from before onboarding v2):
 * a bodyweight multiplier. Editable in Settings, never presented as clinical advice.
 */
export function estimateCalorieTarget(weightKg: number, goal: Goal): number {
  const maintenance = weightKg * 30;
  const multiplier: Record<Goal, number> = { muscle_gain: 1.1, strength: 1.05, fat_loss: 0.8, general_fitness: 1.0 };
  return Math.round((maintenance * multiplier[goal]) / 10) * 10;
}

const PROTEIN_PER_KG: Record<Goal, number> = { muscle_gain: 1.8, strength: 1.8, fat_loss: 2.0, general_fitness: 1.6 };

export function estimateProteinTarget(weightKg: number, goal: Goal): number {
  return Math.round(weightKg * PROTEIN_PER_KG[goal]);
}

export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, very: 1.725 };

export function ageFromBirthYear(birthYear?: number, now = new Date()): number | undefined {
  return birthYear ? now.getFullYear() - birthYear : undefined;
}

/** Mifflin-St Jeor resting burn. "Other" sex uses the midpoint of the two constants. */
export function bmr(weightKg: number, heightCm: number, age: number, sex: Sex = 'other'): number {
  const s = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + s;
}

export interface NutritionTargets {
  bmr: number;
  maintenance: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
  /** plain-language reasoning shown on the plan reveal */
  explanation: string;
}

const round = (n: number, step: number) => Math.round(n / step) * step;

export function computeTargets(p: Pick<Profile, 'weightKg' | 'heightCm' | 'sex' | 'birthYear' | 'goal' | 'activityLevel' | 'daysPerWeek' | 'goalWeightKg'>): NutritionTargets {
  const age = ageFromBirthYear(p.birthYear) ?? 30;
  const base = bmr(p.weightKg, p.heightCm, age, p.sex);
  // Training adds on top of daily life: about 2.5% per weekly session.
  const factor = ACTIVITY_FACTOR[p.activityLevel ?? 'light'] + 0.025 * p.daysPerWeek;
  const maintenance = base * factor;
  const adjust: Record<Goal, number> = { fat_loss: 0.8, muscle_gain: 1.1, strength: 1.05, general_fitness: 1 };
  const floor = p.sex === 'female' ? 1200 : 1500;
  const calories = round(Math.max(floor, maintenance * adjust[p.goal]), 10);

  // Protein on the lighter of current and goal weight when cutting, so very heavy users aren't told to eat 250 g.
  const proteinBasis = p.goal === 'fat_loss' && p.goalWeightKg && p.goalWeightKg < p.weightKg ? Math.max(p.goalWeightKg, p.weightKg * 0.85) : p.weightKg;
  const proteinG = round(proteinBasis * PROTEIN_PER_KG[p.goal], 5);
  const fatG = round((calories * 0.27) / 9, 5);
  const carbsG = Math.max(50, round((calories - proteinG * 4 - fatG * 9) / 4, 5));
  const waterMl = round(p.weightKg * 35, 250);

  const goalLine: Record<Goal, string> = {
    fat_loss: 'a 20% deficit, enough to lose fat steadily without losing strength',
    muscle_gain: 'a 10% surplus, enough to build muscle without much fat',
    strength: 'a small 5% surplus to fuel heavy training',
    general_fitness: 'maintenance, so your energy stays steady',
  };
  return {
    bmr: Math.round(base),
    maintenance: round(maintenance, 10),
    calories,
    proteinG,
    carbsG,
    fatG,
    waterMl,
    explanation: `Your body burns about ${round(maintenance, 10).toLocaleString()} kcal a day with your training. Your target is ${goalLine[p.goal]}.`,
  };
}

export interface GoalTimeline {
  weeks: number;
  targetDate: Date;
  perWeekKg: number;
}

/** Realistic pace: ~0.5% of bodyweight a week when losing, ~0.25 kg a week when gaining. */
export function goalTimeline(weightKg: number, goalWeightKg: number | undefined, goal: Goal, experienceBeginner = false, now = new Date()): GoalTimeline | null {
  if (!goalWeightKg || Math.abs(goalWeightKg - weightKg) < 0.5) return null;
  const losing = goalWeightKg < weightKg;
  if ((losing && goal === 'muscle_gain') || (!losing && goal === 'fat_loss')) return null;
  const perWeekKg = losing ? Math.max(0.25, Math.round(weightKg * 0.005 * 100) / 100) : experienceBeginner ? 0.35 : 0.25;
  const weeks = Math.ceil(Math.abs(goalWeightKg - weightKg) / perWeekKg);
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + weeks * 7);
  return { weeks, targetDate, perWeekKg };
}
