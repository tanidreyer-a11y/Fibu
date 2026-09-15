import { EXERCISE_LIBRARY } from './exercises';
import type { Experience, PlanDay, SetEntry, WorkoutSession } from './db';
import type { MuscleGroup } from './muscleGroups';

type SplitDay = { label: string; focus: MuscleGroup[] };

// Day 4's template deliberately mirrors an upper/lower/upper/lower cadence —
// the most common real-world split for anyone training 4x/week.
const SPLIT_TEMPLATES: Record<number, SplitDay[]> = {
  1: [{ label: 'Full Body', focus: ['chest', 'lats', 'quads', 'side-delts', 'abs'] }],
  2: [
    { label: 'Full Body A', focus: ['chest', 'lats', 'quads', 'side-delts', 'abs'] },
    { label: 'Full Body B', focus: ['chest-upper', 'traps', 'hamstrings', 'biceps', 'triceps'] },
  ],
  3: [
    { label: 'Full Body A', focus: ['chest', 'lats', 'quads', 'side-delts', 'abs'] },
    { label: 'Full Body B', focus: ['chest-upper', 'traps', 'hamstrings', 'biceps', 'triceps'] },
    { label: 'Full Body C', focus: ['glutes', 'lats', 'front-delts', 'calves', 'obliques'] },
  ],
  4: [
    { label: 'Upper Body A', focus: ['chest', 'lats', 'side-delts', 'biceps', 'triceps'] },
    { label: 'Lower Body A', focus: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] },
    { label: 'Upper Body B', focus: ['chest-upper', 'traps', 'rear-delts', 'biceps', 'triceps'] },
    { label: 'Lower Body B', focus: ['glutes', 'hamstrings', 'quads', 'calves', 'obliques'] },
  ],
  5: [
    { label: 'Push', focus: ['chest', 'front-delts', 'side-delts', 'triceps'] },
    { label: 'Pull', focus: ['lats', 'traps', 'rear-delts', 'biceps'] },
    { label: 'Legs', focus: ['quads', 'hamstrings', 'glutes', 'calves'] },
    { label: 'Upper Body', focus: ['chest-upper', 'lats', 'side-delts', 'biceps', 'triceps'] },
    { label: 'Lower Body', focus: ['glutes', 'hamstrings', 'quads', 'abs'] },
  ],
  6: [
    { label: 'Push A', focus: ['chest', 'front-delts', 'triceps'] },
    { label: 'Pull A', focus: ['lats', 'traps', 'biceps'] },
    { label: 'Legs A', focus: ['quads', 'hamstrings', 'glutes'] },
    { label: 'Push B', focus: ['chest-upper', 'side-delts', 'triceps'] },
    { label: 'Pull B', focus: ['lats', 'rear-delts', 'biceps'] },
    { label: 'Legs B', focus: ['glutes', 'hamstrings', 'calves'] },
  ],
  7: [
    { label: 'Push A', focus: ['chest', 'front-delts', 'triceps'] },
    { label: 'Pull A', focus: ['lats', 'traps', 'biceps'] },
    { label: 'Legs A', focus: ['quads', 'hamstrings', 'glutes'] },
    { label: 'Push B', focus: ['chest-upper', 'side-delts', 'triceps'] },
    { label: 'Pull B', focus: ['lats', 'rear-delts', 'biceps'] },
    { label: 'Legs B', focus: ['glutes', 'hamstrings', 'calves'] },
    { label: 'Weak Points', focus: ['abs', 'calves', 'forearms', 'obliques'] },
  ],
};

function pickExercisesForFocus(focus: MuscleGroup[], perDay: number): string[] {
  const picked: string[] = [];
  for (const group of focus) {
    const candidates = EXERCISE_LIBRARY.filter((e) => e.muscleGroups[0] === group && !picked.includes(e.id));
    // prefer compounds (tagged with more than one muscle group) first
    candidates.sort((a, b) => b.muscleGroups.length - a.muscleGroups.length);
    if (candidates[0]) picked.push(candidates[0].id);
    if (picked.length >= perDay) break;
  }
  return picked;
}

export function generateRuleBasedPlan(daysPerWeek: number, experience: Experience): PlanDay[] {
  const clamped = Math.min(7, Math.max(1, daysPerWeek));
  const template = SPLIT_TEMPLATES[clamped] ?? SPLIT_TEMPLATES[3];
  const perDay = experience === 'beginner' ? 4 : experience === 'intermediate' ? 5 : 6;
  return template.map((day) => ({
    label: day.label,
    muscleFocus: day.focus,
    suggestedExerciseIds: pickExercisesForFocus(day.focus, perDay),
  }));
}

export function computeSessionVolumeKg(session: Pick<WorkoutSession, 'exerciseEntries'>): number {
  return session.exerciseEntries.reduce(
    (sum, entry) => sum + entry.sets.reduce((s, set) => s + set.reps * set.weightKg, 0),
    0,
  );
}

export function computeGroupVolumes(
  session: Pick<WorkoutSession, 'exerciseEntries'>,
): Partial<Record<MuscleGroup, number>> {
  const volumes: Partial<Record<MuscleGroup, number>> = {};
  for (const entry of session.exerciseEntries) {
    const exercise = EXERCISE_LIBRARY.find((e) => e.id === entry.exerciseId);
    if (!exercise) continue;
    const sets = entry.sets.length; // simple set-count volume, weighted toward the primary mover below
    exercise.muscleGroups.forEach((group, i) => {
      const weight = i === 0 ? 1 : 0.4; // primary mover counts full, secondary movers partial
      volumes[group] = (volumes[group] ?? 0) + sets * weight;
    });
  }
  return volumes;
}

export interface IntensityResult {
  score: number;
  label: 'Low' | 'Moderate' | 'High';
}

/**
 * Blends average RPE (if logged) with volume relative to the trailing average
 * of the user's last few sessions. With no history, volume contributes a
 * neutral baseline so a first-ever session still gets a sensible score.
 */
export function calculateIntensityScore(
  session: Pick<WorkoutSession, 'exerciseEntries'>,
  recentSessions: Pick<WorkoutSession, 'exerciseEntries'>[],
): IntensityResult {
  const allSets = session.exerciseEntries.flatMap((e) => e.sets);
  const ratedSets = allSets.filter((s): s is SetEntry & { rpe: number } => typeof s.rpe === 'number');
  const effortScore =
    ratedSets.length > 0
      ? (ratedSets.reduce((sum, s) => sum + s.rpe, 0) / ratedSets.length) * 10
      : 70; // no RPE logged — assume a solid working effort rather than penalizing

  const volume = computeSessionVolumeKg(session);
  let volumeScore = 60;
  if (recentSessions.length > 0) {
    const avg = recentSessions.reduce((sum, s) => sum + computeSessionVolumeKg(s), 0) / recentSessions.length;
    if (avg > 0) {
      volumeScore = Math.min(100, Math.max(0, 50 + ((volume - avg) / avg) * 50));
    }
  }

  const score = Math.round(Math.min(100, Math.max(0, effortScore * 0.5 + volumeScore * 0.5)));
  const label = score < 40 ? 'Low' : score < 70 ? 'Moderate' : 'High';
  return { score, label };
}

export interface OverloadSuggestion {
  message: string;
  targetWeightKg: number;
  targetReps: number;
}

/** Simple double-progression: hit 10+ reps -> nudge weight up; otherwise chase one more rep. */
export function suggestProgressiveOverload(lastBestSet: SetEntry, units: 'kg' | 'lb' = 'kg'): OverloadSuggestion {
  const increment = units === 'kg' ? 2.5 : 5;
  if (lastBestSet.reps >= 10) {
    const targetWeightKg = Math.round((lastBestSet.weightKg + increment) * 2) / 2;
    return {
      targetWeightKg,
      targetReps: lastBestSet.reps,
      message: `Last time: ${lastBestSet.weightKg}kg x ${lastBestSet.reps}. You hit double digits — try ${targetWeightKg}kg x ${lastBestSet.reps} today.`,
    };
  }
  return {
    targetWeightKg: lastBestSet.weightKg,
    targetReps: lastBestSet.reps + 1,
    message: `Last time: ${lastBestSet.weightKg}kg x ${lastBestSet.reps}. Chase one more rep — ${lastBestSet.weightKg}kg x ${lastBestSet.reps + 1} today.`,
  };
}

export function bestSetForExercise(sessions: WorkoutSession[], exerciseId: string): SetEntry | null {
  let best: SetEntry | null = null;
  for (const session of sessions) {
    for (const entry of session.exerciseEntries) {
      if (entry.exerciseId !== exerciseId) continue;
      for (const set of entry.sets) {
        if (!best || set.weightKg > best.weightKg || (set.weightKg === best.weightKg && set.reps > best.reps)) {
          best = set;
        }
      }
    }
  }
  return best;
}

export function lastSetForExercise(sessions: WorkoutSession[], exerciseId: string): { date: string; set: SetEntry } | null {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const session of sorted) {
    const entry = session.exerciseEntries.find((e) => e.exerciseId === exerciseId);
    if (entry && entry.sets.length > 0) {
      return { date: session.date, set: entry.sets[entry.sets.length - 1] };
    }
  }
  return null;
}

// Deterministic per-session pick (via a hash of score+prCount) rather than
// random, so revisiting the same summary doesn't change what Fibu "said".
function pickDeterministic<T>(options: T[], seed: number): T {
  return options[Math.abs(seed) % options.length];
}

/** What Fibu actually says on the summary screen — varies by how the session went, not a fixed "Nice work." every time. */
export function getSessionReaction(intensity: IntensityResult, prCount: number, seed: number): string {
  if (prCount > 0 && intensity.label === 'High') {
    return pickDeterministic(
      ["That's a new best — feel that.", 'Numbers don’t lie. Best session yet.', "You just moved the bar. Literally."],
      seed,
    );
  }
  if (prCount > 0) {
    return pickDeterministic(['A new best, and in the books.', 'Quietly a personal record today.', "Didn't feel huge — still a PR."], seed);
  }
  if (intensity.label === 'High') {
    return pickDeterministic(['That was a genuinely hard session.', "That's the kind of session that adds up.", 'Earned, that one.'], seed);
  }
  if (intensity.label === 'Moderate') {
    return pickDeterministic(['Solid. Logged and in the books.', 'Steady work. That counts.', 'A consistent one — those add up too.'], seed);
  }
  return pickDeterministic(['A lighter one — it still counts.', 'Showed up. Some days that’s the whole game.', 'Logged, not skipped.'], seed);
}
