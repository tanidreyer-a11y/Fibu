import type { Exercise } from './db';
import type { Pattern } from './exercises';
import type { MuscleGroup } from './muscleGroups';

export type BodyPart = 'all' | 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'glutes' | 'core' | 'cardio' | 'stretch';

export const BODY_PARTS: { key: BodyPart; label: string; groups?: MuscleGroup[]; patterns?: Pattern[] }[] = [
  { key: 'all', label: 'All' },
  { key: 'chest', label: 'Chest', groups: ['chest', 'chest-upper', 'chest-lower'] },
  { key: 'back', label: 'Back', groups: ['lats', 'traps', 'lower-back', 'neck'] },
  { key: 'shoulders', label: 'Shoulders', groups: ['front-delts', 'side-delts', 'rear-delts'] },
  { key: 'arms', label: 'Arms', groups: ['biceps', 'triceps', 'forearms'] },
  { key: 'legs', label: 'Legs', groups: ['quads', 'hamstrings', 'calves', 'adductors', 'hip-flexors'] },
  { key: 'glutes', label: 'Glutes', groups: ['glutes'] },
  { key: 'core', label: 'Core', groups: ['abs', 'obliques'] },
  { key: 'cardio', label: 'Cardio', patterns: ['conditioning'] },
  { key: 'stretch', label: 'Stretch', patterns: ['mobility'] },
];

export type EquipmentFilter = 'any' | 'bodyweight' | 'dumbbell' | 'barbell' | 'machine' | 'kettlebell' | 'band';

export const EQUIPMENT_FILTERS: { key: EquipmentFilter; label: string; matches: string[] }[] = [
  { key: 'any', label: 'Any equipment', matches: [] },
  { key: 'bodyweight', label: 'Bodyweight', matches: ['bodyweight'] },
  { key: 'dumbbell', label: 'Dumbbell', matches: ['dumbbell'] },
  { key: 'barbell', label: 'Barbell', matches: ['barbell', 'ez-bar', 'smith'] },
  { key: 'machine', label: 'Machine & cable', matches: ['machine', 'cable'] },
  { key: 'kettlebell', label: 'Kettlebell', matches: ['kettlebell'] },
  { key: 'band', label: 'Band', matches: ['band'] },
];

export const EQUIPMENT_LABEL: Record<string, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  machine: 'Machine',
  cable: 'Cable',
  smith: 'Smith machine',
  bodyweight: 'Bodyweight',
  band: 'Band',
  'ez-bar': 'EZ bar',
  other: 'Other',
};

/** "push up", "push-up" and "pushups" all compare equal. */
export function compact(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function matchesQuery(exercise: Pick<Exercise, 'name'>, query: string): boolean {
  const name = compact(exercise.name);
  return query
    .toLowerCase()
    .split(/\s+/)
    .map(compact)
    .filter(Boolean)
    .every((token) => name.includes(token.replace(/s$/, '')));
}

export function inBodyPart(e: Exercise, part: BodyPart): boolean {
  const def = BODY_PARTS.find((b) => b.key === part);
  if (!def || part === 'all') return e.pattern !== 'mobility';
  if (def.patterns) return !!e.pattern && def.patterns.includes(e.pattern);
  if (e.pattern === 'mobility' || e.pattern === 'conditioning') return false;
  return !!def.groups?.includes(e.muscleGroups[0]);
}

export function matchesEquipment(e: Exercise, filter: EquipmentFilter): boolean {
  if (filter === 'any') return true;
  return EQUIPMENT_FILTERS.find((f) => f.key === filter)!.matches.includes(e.equipment);
}

/** Guess a plan slot for a user-created exercise from its primary muscle. */
export function patternForGroup(group: MuscleGroup): Pattern {
  const map: Partial<Record<MuscleGroup, Pattern>> = {
    chest: 'h-push',
    'chest-upper': 'h-push',
    'chest-lower': 'h-push',
    'front-delts': 'v-push',
    'side-delts': 'side-delt',
    'rear-delts': 'rear-delt',
    lats: 'v-pull',
    traps: 'h-pull',
    'lower-back': 'hinge',
    biceps: 'biceps',
    triceps: 'triceps',
    forearms: 'forearms',
    abs: 'core',
    obliques: 'core',
    quads: 'squat',
    hamstrings: 'hinge',
    glutes: 'glute',
    calves: 'calves',
    adductors: 'glute',
  };
  return map[group] ?? 'core';
}
