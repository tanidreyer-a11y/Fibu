import type { Goal } from './db';

/**
 * Bodyweight-multiplier estimate (no age/sex collected at onboarding, so a
 * full Mifflin-St Jeor calc isn't available) — deliberately simple and
 * editable in Settings, not presented as clinical advice.
 */
export function estimateCalorieTarget(weightKg: number, goal: Goal): number {
  const maintenance = weightKg * 30;
  const multiplier: Record<Goal, number> = {
    muscle_gain: 1.12,
    strength: 1.05,
    fat_loss: 0.8,
    general_fitness: 1.0,
  };
  return Math.round((maintenance * multiplier[goal]) / 10) * 10;
}

export function estimateProteinTarget(weightKg: number, goal: Goal): number {
  const perKg: Record<Goal, number> = {
    muscle_gain: 2.0,
    strength: 2.0,
    fat_loss: 2.2,
    general_fitness: 1.6,
  };
  return Math.round(weightKg * perKg[goal]);
}
