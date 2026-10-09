import { CURATED_BY_ID, nextLadderStep } from './exercises';
import type { Exercise, Prescription, SetEntry, WorkoutSession } from './db';
import type { MuscleGroup } from './muscleGroups';

type ExerciseLookup = Pick<Map<string, Pick<Exercise, 'muscleGroups'>>, 'get'>;

export function computeSessionVolumeKg(session: Pick<WorkoutSession, 'exerciseEntries'>): number {
  return session.exerciseEntries.reduce(
    (sum, entry) => sum + entry.sets.reduce((s, set) => s + set.reps * set.weightKg, 0),
    0,
  );
}

/** Pass the full exercise map (db rows) so custom and database moves count too; defaults to the curated core. */
export function computeGroupVolumes(
  session: Pick<WorkoutSession, 'exerciseEntries'>,
  lookup: ExerciseLookup = CURATED_BY_ID,
): Partial<Record<MuscleGroup, number>> {
  const volumes: Partial<Record<MuscleGroup, number>> = {};
  for (const entry of session.exerciseEntries) {
    const exercise = lookup.get(entry.exerciseId);
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
  /** bodyweight moves level up to a harder variation instead of adding weight */
  nextExerciseId?: string;
}

interface OverloadContext {
  exercise?: Pick<Exercise, 'id' | 'equipment' | 'unit'>;
  target?: Pick<Prescription, 'repsMin' | 'repsMax'>;
}

/**
 * Double progression inside the prescribed rep range: add reps until the top of
 * the range, then add the smallest realistic weight jump and drop back to the
 * bottom. Bodyweight moves that hit the top of their range climb the ladder
 * (incline → standard → decline → archer push-up) instead.
 */
export function suggestProgressiveOverload(lastBestSet: SetEntry, units: 'kg' | 'lb' = 'kg', ctx: OverloadContext = {}): OverloadSuggestion {
  const repsMin = ctx.target?.repsMin ?? 8;
  const repsMax = ctx.target?.repsMax ?? (ctx.exercise?.equipment === 'bodyweight' ? 15 : 12);
  const timed = ctx.exercise?.unit === 'sec';
  const bodyweight = lastBestSet.weightKg === 0 || ctx.exercise?.equipment === 'bodyweight';

  if (timed) {
    const next = lastBestSet.reps >= repsMax ? lastBestSet.reps : lastBestSet.reps + 5;
    return { targetWeightKg: lastBestSet.weightKg, targetReps: next, message: `Last time ${lastBestSet.reps}s. Hold for ${next}s today.` };
  }

  if (bodyweight) {
    const next = ctx.exercise ? nextLadderStep(ctx.exercise.id) : null;
    if (lastBestSet.reps >= repsMax && next) {
      const nextName = CURATED_BY_ID.get(next)?.name ?? 'the next variation';
      return {
        targetWeightKg: 0,
        targetReps: repsMin,
        nextExerciseId: next,
        message: `${lastBestSet.reps} reps last time. You've outgrown this one. Try ${nextName}.`,
      };
    }
    const reps = lastBestSet.reps >= repsMax ? lastBestSet.reps + 1 : Math.min(repsMax, lastBestSet.reps + 1);
    return { targetWeightKg: lastBestSet.weightKg, targetReps: reps, message: `${lastBestSet.reps} reps last time. Go for ${reps}.` };
  }

  const freeWeight = ctx.exercise?.equipment === 'dumbbell' || ctx.exercise?.equipment === 'kettlebell';
  const increment = units === 'kg' ? (freeWeight ? 2 : 2.5) : 5;
  if (lastBestSet.reps >= repsMax) {
    const targetWeightKg = Math.round((lastBestSet.weightKg + increment) * 4) / 4;
    return {
      targetWeightKg,
      targetReps: repsMin,
      message: `You topped the ${repsMin}–${repsMax} range at ${lastBestSet.weightKg}kg. Add weight: ${targetWeightKg}kg × ${repsMin}.`,
    };
  }
  const targetReps = Math.max(repsMin, lastBestSet.reps + 1);
  return {
    targetWeightKg: lastBestSet.weightKg,
    targetReps,
    message: `Last time ${lastBestSet.weightKg}kg × ${lastBestSet.reps}. Beat it by a rep: ${lastBestSet.weightKg}kg × ${targetReps}.`,
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
