import type { EquipmentAccess, Experience, Goal, PlanDay, PlanItem, Prescription, Profile } from './db';
import { EXERCISE_LIBRARY, type CuratedExercise, type Equipment, type Injury, type Level, type Pattern } from './exercises';
import { MUSCLE_GROUP_LABELS } from './muscleGroups';

// ─── Day templates: movement slots in priority order. Session length trims from the end.

type DayTemplate = { label: string; slots: Pattern[] };

const T = {
  fullA: { label: 'Full Body A', slots: ['squat', 'h-push', 'h-pull', 'hinge', 'side-delt', 'core', 'biceps', 'calves'] },
  fullB: { label: 'Full Body B', slots: ['hinge', 'v-push', 'v-pull', 'lunge', 'chest-iso', 'core', 'triceps', 'rear-delt'] },
  fullC: { label: 'Full Body C', slots: ['lunge', 'h-push', 'v-pull', 'glute', 'side-delt', 'core', 'ham-curl', 'biceps'] },
  upperA: { label: 'Upper A', slots: ['h-push', 'h-pull', 'v-push', 'v-pull', 'side-delt', 'biceps', 'triceps', 'rear-delt'] },
  lowerA: { label: 'Lower A', slots: ['squat', 'hinge', 'lunge', 'ham-curl', 'calves', 'core', 'quad-iso'] },
  upperB: { label: 'Upper B', slots: ['v-push', 'v-pull', 'h-push', 'h-pull', 'rear-delt', 'triceps', 'biceps', 'chest-iso'] },
  lowerB: { label: 'Lower B', slots: ['hinge', 'squat', 'glute', 'lunge', 'calves', 'core', 'ham-curl'] },
  push: { label: 'Push', slots: ['h-push', 'v-push', 'h-push', 'side-delt', 'chest-iso', 'triceps', 'triceps'] },
  pull: { label: 'Pull', slots: ['v-pull', 'h-pull', 'h-pull', 'rear-delt', 'biceps', 'biceps', 'traps'] },
  legs: { label: 'Legs', slots: ['squat', 'hinge', 'lunge', 'ham-curl', 'quad-iso', 'calves', 'core'] },
  pushB: { label: 'Push B', slots: ['v-push', 'h-push', 'chest-iso', 'side-delt', 'triceps', 'h-push', 'triceps'] },
  pullB: { label: 'Pull B', slots: ['h-pull', 'v-pull', 'rear-delt', 'v-pull', 'biceps', 'traps', 'biceps'] },
  legsB: { label: 'Legs B', slots: ['hinge', 'lunge', 'squat', 'glute', 'calves', 'ham-curl', 'core'] },
  arms: { label: 'Arms & Core', slots: ['biceps', 'triceps', 'side-delt', 'biceps', 'triceps', 'core', 'forearms'] },
} satisfies Record<string, { label: string; slots: Pattern[] }>;

const SPLITS: Record<number, { name: string; days: DayTemplate[]; why: string }> = {
  1: { name: 'Full Body', days: [T.fullA], why: 'One session a week works best as one full-body workout that hits everything.' },
  2: { name: 'Full Body ×2', days: [T.fullA, T.fullB], why: 'Two full-body days hit every muscle twice a week, the sweet spot for progress.' },
  3: { name: 'Full Body ×3', days: [T.fullA, T.fullB, T.fullC], why: 'Three full-body days train each muscle three times a week with plenty of recovery between.' },
  4: { name: 'Upper / Lower', days: [T.upperA, T.lowerA, T.upperB, T.lowerB], why: 'Upper/lower over 4 days trains every muscle twice a week with a rest day built in.' },
  5: { name: 'Upper / Lower + Push / Pull / Legs', days: [T.upperA, T.lowerA, T.push, T.pull, T.legs], why: 'Five days mixes upper/lower with push/pull/legs, so every muscle gets two hard hits a week.' },
  6: { name: 'Push / Pull / Legs ×2', days: [T.push, T.pull, T.legs, T.pushB, T.pullB, T.legsB], why: 'Push/pull/legs twice through the week gives high volume with each muscle resting 72 hours.' },
  7: { name: 'Push / Pull / Legs ×2 + Arms', days: [T.push, T.pull, T.legs, T.pushB, T.pullB, T.legsB, T.arms], why: 'Seven days runs push/pull/legs twice plus a lighter arms & core day. Listen to your recovery.' },
};

const ACCESS: Record<EquipmentAccess, Equipment[]> = {
  gym: ['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'smith', 'bodyweight', 'band', 'ez-bar', 'other'],
  home: ['dumbbell', 'kettlebell', 'bodyweight', 'band'],
  bodyweight: ['bodyweight'],
};

/** Patterns that can't be loaded at home get a sensible stand-in rather than an empty slot. */
const SLOT_FALLBACK: Partial<Record<Pattern, Pattern[]>> = {
  'chest-iso': ['h-push'],
  'quad-iso': ['squat', 'lunge'],
  'ham-curl': ['hinge', 'glute'],
  traps: ['rear-delt', 'h-pull'],
  'rear-delt': ['h-pull'],
  'side-delt': ['v-push', 'rear-delt', 'core'],
  'v-pull': ['h-pull'],
  biceps: ['h-pull'],
  triceps: ['h-push'],
  forearms: ['carry', 'core'],
};

const LEVEL_RANK: Record<Level, number> = { beginner: 0, intermediate: 1, expert: 2 };
const EXPERIENCE_RANK: Record<Experience, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/** The proven go-to lifts. They win ties, so plans read like a coach wrote them. */
const STAPLES = new Set([
  'barbell-bench-press', 'dumbbell-bench-press', 'incline-dumbbell-press', 'push-up', 'back-squat', 'goblet-squat', 'leg-press',
  'deadlift', 'romanian-deadlift', 'dumbbell-rdl', 'hip-thrust', 'barbell-row', 'dumbbell-row', 'seated-cable-row', 'lat-pulldown',
  'pull-up', 'chin-up', 'overhead-press', 'seated-db-shoulder-press', 'lateral-raise', 'face-pull', 'rear-delt-fly', 'dumbbell-curl',
  'hammer-curl', 'triceps-pushdown', 'overhead-triceps-extension', 'lying-leg-curl', 'leg-extension', 'standing-calf-raise',
  'walking-lunge', 'bulgarian-split-squat', 'plank', 'hanging-leg-raise', 'cable-crossover', 'glute-bridge', 'inverted-row',
]);
/** Valid, but a step down for almost everyone who can do the next rung. */
const RARELY_FIRST = new Set(['wall-push-up', 'upright-row', 'scapular-pull-up', 'front-raise', 'good-morning', 'pendlay-row']);

export interface PlanInput {
  daysPerWeek: number;
  experience: Experience;
  goal: Goal;
  equipment?: EquipmentAccess;
  sessionMinutes?: number;
  injuries?: Injury[];
  /** has a pull-up bar (or rings); assumed true at a gym */
  hasBar?: boolean;
}

function scoreExercise(e: CuratedExercise, input: Required<PlanInput>): number {
  const target = EXPERIENCE_RANK[input.experience];
  const level = LEVEL_RANK[e.level];
  let score = 10;
  // Too hard is the real risk. Loaded staples stay right for advanced lifters (they just
  // add weight); bodyweight moves have no plates, so they must also match the level.
  if (level > target) score -= (level - target) * 4;
  if ((e.equipment === 'bodyweight' || e.equipment === 'band') && level < target) score -= (target - level) * 3;
  if (STAPLES.has(e.id)) score += 3;
  if (RARELY_FIRST.has(e.id)) score -= 3;
  if (input.equipment === 'gym') {
    if (input.goal === 'strength' && e.equipment === 'barbell' && e.mechanic === 'compound') score += 3;
    if (input.experience === 'beginner' && (e.equipment === 'machine' || e.equipment === 'cable')) score += 2;
    // At a gym, beginner bodyweight pushing is a step down from loading a bar.
    if (e.equipment === 'bodyweight' && e.pattern === 'h-push') score -= 3;
  }
  if (input.equipment === 'home' && (e.equipment === 'dumbbell' || e.equipment === 'kettlebell')) score += 2;
  if (input.goal === 'fat_loss' && e.mechanic === 'compound') score += 1;
  return score;
}

/**
 * Ranked exercise options for one slot, best first. Stand-ins from fallback
 * patterns follow the real ones, so a thin slot (no pull-up bar at home) still
 * has a B-week option and swaps. Main slots put compound moves first.
 */
export function optionsForSlot(slot: Pattern, input: Required<PlanInput>, main = false): CuratedExercise[] {
  const allowed = ACCESS[input.equipment];
  const target = EXPERIENCE_RANK[input.experience];
  const ok = (e: CuratedExercise) =>
    allowed.includes(e.equipment) && !e.avoid?.some((i) => input.injuries.includes(i)) && (input.hasBar || !e.bar);
  const patterns = [slot, ...(SLOT_FALLBACK[slot] ?? [])];
  const ranked: CuratedExercise[] = [];
  for (let i = 0; i < patterns.length; i++) {
    // A stand-in from another pattern must be at the user's level; the real slot may stretch one level up.
    const maxLevel = i === 0 ? target + 1 : target;
    const pool = EXERCISE_LIBRARY.filter((e) => e.pattern === patterns[i] && ok(e) && LEVEL_RANK[e.level] <= maxLevel);
    pool.sort((a, b) => scoreExercise(b, input) - scoreExercise(a, input));
    ranked.push(...pool);
    if (ranked.length >= 3) break;
  }
  if (main) ranked.sort((a, b) => Number(b.mechanic === 'compound') - Number(a.mechanic === 'compound'));
  return ranked;
}

export function prescribe(e: CuratedExercise, slotIndex: number, input: Required<PlanInput>): Prescription {
  const beginner = input.experience === 'beginner';
  const advanced = input.experience === 'advanced';
  const timed = e.unit === 'sec';

  if (timed) {
    if (e.pattern === 'conditioning') return { sets: input.goal === 'fat_loss' ? 4 : 3, repsMin: 30, repsMax: 45, restSec: 30, unit: 'sec' };
    const [lo, hi] = beginner ? [20, 30] : advanced ? [45, 60] : [30, 45];
    return { sets: 3, repsMin: lo, repsMax: hi, restSec: 45, unit: 'sec' };
  }

  const main = e.mechanic === 'compound' && slotIndex < 3;
  const table: Record<Goal, { main: [number, number, number, number]; acc: [number, number, number, number] }> = {
    strength: { main: [5, 3, 5, 180], acc: [3, 6, 10, 90] },
    muscle_gain: { main: [4, 6, 10, 120], acc: [3, 10, 15, 60] },
    fat_loss: { main: [3, 8, 12, 75], acc: [3, 12, 15, 45] },
    general_fitness: { main: [3, 8, 12, 90], acc: [3, 10, 15, 60] },
  };
  let [sets, repsMin, repsMax, restSec] = main ? table[input.goal].main : table[input.goal].acc;

  // Bodyweight moves can't add plates, so their ranges come from the move, not the slot.
  if (e.equipment === 'bodyweight' || e.equipment === 'band') {
    const hardVertical = e.pattern === 'v-pull' || e.pattern === 'v-push' || (e.pattern === 'h-pull' && e.bar);
    if (e.level === 'expert' || hardVertical) [repsMin, repsMax] = input.goal === 'strength' ? [3, 6] : e.level === 'expert' ? [4, 8] : [5, 10];
    else if (e.mechanic === 'compound') [repsMin, repsMax] = input.goal === 'strength' ? [5, 8] : [8, 15];
    else [repsMin, repsMax] = [12, 20];
    if (e.pattern === 'conditioning') [repsMin, repsMax, restSec] = [10, 15, 45];
  }
  // Abs respond to moderate reps whatever the goal; 5-rep crunch sets help no one.
  if (e.pattern === 'core') [repsMin, repsMax] = input.goal === 'strength' ? [8, 12] : [10, 15];
  if (beginner) sets = Math.max(2, sets - (main ? 1 : 0));
  if (advanced && !main) sets = Math.min(4, sets + 1);
  return { sets, repsMin, repsMax, restSec, unit: 'reps' };
}

function slotsForSession(template: DayTemplate, input: Required<PlanInput>): Pattern[] {
  const count = input.sessionMinutes <= 30 ? 4 : input.sessionMinutes <= 45 ? 5 : input.sessionMinutes <= 60 ? 6 : input.sessionMinutes <= 75 ? 7 : 8;
  const slots = template.slots.slice(0, count);
  if (input.goal === 'fat_loss' && slots.length >= 5) slots[slots.length - 1] = 'conditioning';
  return slots;
}

export interface GeneratedPlan {
  splitName: string;
  days: PlanDay[];
  reasons: string[];
}

export function withDefaults(input: PlanInput): Required<PlanInput> {
  return {
    daysPerWeek: Math.min(7, Math.max(1, Math.round(input.daysPerWeek))),
    experience: input.experience,
    goal: input.goal,
    equipment: input.equipment ?? 'gym',
    sessionMinutes: input.sessionMinutes ?? (input.experience === 'beginner' ? 45 : 60),
    injuries: input.injuries ?? [],
    hasBar: input.hasBar ?? (input.equipment ?? 'gym') === 'gym',
  };
}

export function generatePlan(raw: PlanInput): GeneratedPlan {
  const input = withDefaults(raw);
  const split = SPLITS[input.daysPerWeek] ?? SPLITS[3];

  const days: PlanDay[] = split.days.map((template, dayIndex) => {
    const usedInDay = new Set<string>();
    const items: PlanItem[] = [];
    slotsForSession(template, input).forEach((slot, slotIndex) => {
      const ranked = optionsForSlot(slot, input, slotIndex < 3);
      // Repeated templates (Push B, second h-push slot) rotate further down the list.
      const offset = dayIndex >= split.days.length / 2 && split.days.length >= 6 ? 1 : 0;
      const fresh = ranked.filter((e) => !usedInDay.has(e.id));
      const ordered = [...fresh.slice(offset), ...fresh.slice(0, offset)];
      if (!ordered.length) return;
      usedInDay.add(ordered[0].id);
      if (ordered[1]) usedInDay.add(ordered[1].id);
      items.push({ pattern: slot, exerciseIds: ordered.slice(0, 6).map((e) => e.id), ...prescribe(ordered[0], slotIndex, input) });
    });

    const focus: string[] = [];
    for (const item of items) {
      const primary = EXERCISE_LIBRARY.find((e) => e.id === item.exerciseIds[0])?.muscleGroups[0];
      if (primary && !focus.includes(primary)) focus.push(primary);
    }
    return { label: template.label, muscleFocus: focus, suggestedExerciseIds: items.map((i) => i.exerciseIds[0]), items };
  });

  return { splitName: split.name, days, reasons: explainPlan(input, split.why) };
}

function explainPlan(input: Required<PlanInput>, splitWhy: string): string[] {
  const reasons = [`${input.daysPerWeek} day${input.daysPerWeek === 1 ? '' : 's'} a week: ${splitWhy}`];
  const goalWhy: Record<Goal, string> = {
    muscle_gain: 'Building muscle: big lifts in the 6–10 rep range with 2 minutes rest, then lighter 10–15 rep work to pump volume.',
    strength: 'Getting stronger: heavy 3–5 rep sets on the main lifts with full 3-minute rests, so every set is quality.',
    fat_loss: 'Losing fat: keep lifting heavy enough to hold muscle, shorter rests, and a conditioning finisher to burn extra.',
    general_fitness: 'General fitness: balanced 8–12 rep work for every movement pattern, so you get stronger and fitter together.',
  };
  reasons.push(goalWhy[input.goal]);
  const equipmentWhy: Record<EquipmentAccess, string> = {
    gym: 'Full gym: free weights for the main lifts, machines and cables to finish each muscle safely.',
    home: 'Home with dumbbells: every move uses dumbbells, a kettlebell, bands or your bodyweight.',
    bodyweight: 'No equipment: bodyweight moves with harder variations to climb as you get stronger (e.g. incline → standard → decline → archer push-ups).',
  };
  reasons.push(equipmentWhy[input.equipment]);
  reasons.push(`${input.sessionMinutes}-minute sessions: ${slotsForSession(T.fullA, input).length} exercises a day, warm-up included.`);
  if (input.injuries.length) {
    reasons.push(`Protecting your ${input.injuries.join(', ').replace('-', ' ')}: moves that load it are left out.`);
  }
  if (input.experience === 'beginner') reasons.push('New to training: simpler moves first and one fewer set on the big lifts while your technique settles.');
  return reasons;
}

/** Week A / week B: alternates the picks in each slot so training doesn't go stale. */
export function weekVariant(date = new Date()): 0 | 1 {
  const start = new Date(Date.UTC(date.getFullYear(), 0, 1));
  const days = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start.getTime()) / 86_400_000);
  return (Math.floor((days + start.getUTCDay()) / 7) % 2) as 0 | 1;
}

export function exerciseForItem(item: PlanItem, variant: 0 | 1 = weekVariant()): string {
  return item.exerciseIds[variant] ?? item.exerciseIds[0];
}

export function focusLabel(day: PlanDay): string {
  return day.muscleFocus
    .slice(0, 3)
    .map((g) => MUSCLE_GROUP_LABELS[g as keyof typeof MUSCLE_GROUP_LABELS] ?? g)
    .join(' · ');
}

export function planInputFromProfile(profile: Profile): PlanInput {
  return {
    daysPerWeek: profile.daysPerWeek,
    experience: profile.experience,
    goal: profile.goal,
    equipment: profile.equipment,
    sessionMinutes: profile.sessionMinutes,
    injuries: profile.injuries,
    hasBar: profile.hasPullUpBar,
  };
}

/** Next plan day after the most recent session, so "Today's workout" walks through the week in order. */
export function nextPlanDay(days: PlanDay[], lastDayLabel?: string): PlanDay | undefined {
  if (!days.length) return undefined;
  const i = lastDayLabel ? days.findIndex((d) => d.label === lastDayLabel) : -1;
  return days[(i + 1) % days.length];
}
