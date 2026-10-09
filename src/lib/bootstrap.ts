import { db } from './db';
import { ensureExerciseLibrary } from './library';
import { generatePlan, planInputFromProfile } from './plan';
import { loadProgressData, syncAchievements } from './progress';

/** v1 plans were bare exercise lists; give existing users a real plan (slots, sets × reps, rest) once. */
async function upgradeLegacyPlan(): Promise<void> {
  const [profile, plan] = await Promise.all([db.profile.get('me'), db.plan.get('active')]);
  if (!profile || !plan || plan.days.some((d) => d.items?.length)) return;
  const next = generatePlan(planInputFromProfile(profile));
  await db.plan.put({ ...plan, days: next.days, reasons: next.reasons, splitName: next.splitName });
}

let started = false;

/** One-time app start work. Failures are non-fatal: the app runs on whatever is already stored. */
export function bootstrap(): void {
  if (started) return;
  started = true;
  ensureExerciseLibrary().catch((err) => console.warn('[fibu] exercise library', err));
  upgradeLegacyPlan().catch((err) => console.warn('[fibu] plan upgrade', err));
  // Award badges already earned by past activity (quietly; new ones are celebrated after workouts).
  loadProgressData()
    .then(syncAchievements)
    .catch((err) => console.warn('[fibu] achievements', err));
}
