import type { Exercise } from './db';
import type { MuscleGroup } from './muscleGroups';

type SeedExercise = {
  id: string;
  name: string;
  muscleGroups: MuscleGroup[];
  equipment: 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'smith' | 'kettlebell' | 'band';
};

// Primary muscle group listed first per exercise — used for the "best lift" /
// "last time" comparisons and for the diagram. Hand-curated (not pulled from an
// external db) so tags line up exactly with our body-muscles group vocabulary.
export const EXERCISE_LIBRARY: SeedExercise[] = [
  // Chest
  { id: 'barbell-bench-press', name: 'Barbell Bench Press', muscleGroups: ['chest', 'triceps', 'front-delts'], equipment: 'barbell' },
  { id: 'incline-barbell-bench-press', name: 'Incline Barbell Bench Press', muscleGroups: ['chest-upper', 'front-delts', 'triceps'], equipment: 'barbell' },
  { id: 'decline-barbell-bench-press', name: 'Decline Barbell Bench Press', muscleGroups: ['chest-lower', 'triceps'], equipment: 'barbell' },
  { id: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', muscleGroups: ['chest', 'triceps', 'front-delts'], equipment: 'dumbbell' },
  { id: 'incline-dumbbell-press', name: 'Incline Dumbbell Press', muscleGroups: ['chest-upper', 'front-delts', 'triceps'], equipment: 'dumbbell' },
  { id: 'dumbbell-flyes', name: 'Dumbbell Flyes', muscleGroups: ['chest'], equipment: 'dumbbell' },
  { id: 'incline-dumbbell-flyes', name: 'Incline Dumbbell Flyes', muscleGroups: ['chest-upper'], equipment: 'dumbbell' },
  { id: 'cable-crossover', name: 'Cable Crossover', muscleGroups: ['chest-lower', 'chest'], equipment: 'cable' },
  { id: 'pec-deck', name: 'Pec Deck Machine', muscleGroups: ['chest'], equipment: 'machine' },
  { id: 'chest-press-machine', name: 'Chest Press Machine', muscleGroups: ['chest', 'triceps'], equipment: 'machine' },
  { id: 'push-up', name: 'Push-Up', muscleGroups: ['chest', 'triceps', 'front-delts'], equipment: 'bodyweight' },

  // Back
  { id: 'deadlift', name: 'Deadlift', muscleGroups: ['lower-back', 'glutes', 'hamstrings', 'lats', 'traps'], equipment: 'barbell' },
  { id: 'barbell-row', name: 'Barbell Row', muscleGroups: ['lats', 'traps', 'biceps'], equipment: 'barbell' },
  { id: 'pendlay-row', name: 'Pendlay Row', muscleGroups: ['lats', 'traps'], equipment: 'barbell' },
  { id: 'dumbbell-row', name: 'Dumbbell Row', muscleGroups: ['lats', 'traps', 'biceps'], equipment: 'dumbbell' },
  { id: 't-bar-row', name: 'T-Bar Row', muscleGroups: ['lats', 'traps'], equipment: 'machine' },
  { id: 'seated-cable-row', name: 'Seated Cable Row', muscleGroups: ['lats', 'traps', 'biceps'], equipment: 'cable' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', muscleGroups: ['lats', 'biceps'], equipment: 'cable' },
  { id: 'pull-up', name: 'Pull-Up', muscleGroups: ['lats', 'biceps', 'traps'], equipment: 'bodyweight' },
  { id: 'chin-up', name: 'Chin-Up', muscleGroups: ['lats', 'biceps'], equipment: 'bodyweight' },
  { id: 'straight-arm-pulldown', name: 'Straight-Arm Pulldown', muscleGroups: ['lats'], equipment: 'cable' },
  { id: 'face-pull', name: 'Face Pull', muscleGroups: ['rear-delts', 'traps'], equipment: 'cable' },
  { id: 'barbell-shrug', name: 'Barbell Shrug', muscleGroups: ['traps'], equipment: 'barbell' },
  { id: 'dumbbell-shrug', name: 'Dumbbell Shrug', muscleGroups: ['traps'], equipment: 'dumbbell' },
  { id: 'back-extension', name: 'Back Extension', muscleGroups: ['lower-back', 'glutes', 'hamstrings'], equipment: 'bodyweight' },
  { id: 'good-morning', name: 'Good Morning', muscleGroups: ['lower-back', 'hamstrings', 'glutes'], equipment: 'barbell' },

  // Shoulders
  { id: 'overhead-press', name: 'Overhead Barbell Press', muscleGroups: ['front-delts', 'side-delts', 'triceps'], equipment: 'barbell' },
  { id: 'seated-db-shoulder-press', name: 'Seated Dumbbell Shoulder Press', muscleGroups: ['front-delts', 'side-delts', 'triceps'], equipment: 'dumbbell' },
  { id: 'arnold-press', name: 'Arnold Press', muscleGroups: ['front-delts', 'side-delts', 'triceps'], equipment: 'dumbbell' },
  { id: 'lateral-raise', name: 'Lateral Raise', muscleGroups: ['side-delts'], equipment: 'dumbbell' },
  { id: 'cable-lateral-raise', name: 'Cable Lateral Raise', muscleGroups: ['side-delts'], equipment: 'cable' },
  { id: 'front-raise', name: 'Front Raise', muscleGroups: ['front-delts'], equipment: 'dumbbell' },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', muscleGroups: ['rear-delts'], equipment: 'dumbbell' },
  { id: 'reverse-pec-deck', name: 'Reverse Pec Deck', muscleGroups: ['rear-delts'], equipment: 'machine' },
  { id: 'machine-shoulder-press', name: 'Machine Shoulder Press', muscleGroups: ['front-delts', 'side-delts', 'triceps'], equipment: 'machine' },
  { id: 'upright-row', name: 'Upright Row', muscleGroups: ['side-delts', 'traps'], equipment: 'barbell' },

  // Biceps
  { id: 'barbell-curl', name: 'Barbell Curl', muscleGroups: ['biceps', 'forearms'], equipment: 'barbell' },
  { id: 'ez-bar-curl', name: 'EZ-Bar Curl', muscleGroups: ['biceps', 'forearms'], equipment: 'barbell' },
  { id: 'dumbbell-curl', name: 'Dumbbell Curl', muscleGroups: ['biceps', 'forearms'], equipment: 'dumbbell' },
  { id: 'hammer-curl', name: 'Hammer Curl', muscleGroups: ['biceps', 'forearms'], equipment: 'dumbbell' },
  { id: 'incline-dumbbell-curl', name: 'Incline Dumbbell Curl', muscleGroups: ['biceps'], equipment: 'dumbbell' },
  { id: 'preacher-curl', name: 'Preacher Curl', muscleGroups: ['biceps'], equipment: 'barbell' },
  { id: 'cable-curl', name: 'Cable Curl', muscleGroups: ['biceps', 'forearms'], equipment: 'cable' },
  { id: 'concentration-curl', name: 'Concentration Curl', muscleGroups: ['biceps'], equipment: 'dumbbell' },

  // Triceps
  { id: 'close-grip-bench-press', name: 'Close-Grip Bench Press', muscleGroups: ['triceps', 'chest'], equipment: 'barbell' },
  { id: 'triceps-pushdown', name: 'Triceps Pushdown', muscleGroups: ['triceps'], equipment: 'cable' },
  { id: 'overhead-triceps-extension', name: 'Overhead Triceps Extension', muscleGroups: ['triceps'], equipment: 'dumbbell' },
  { id: 'skull-crushers', name: 'Skull Crushers', muscleGroups: ['triceps'], equipment: 'barbell' },
  { id: 'dips', name: 'Dips', muscleGroups: ['triceps', 'chest-lower'], equipment: 'bodyweight' },
  { id: 'cable-overhead-extension', name: 'Cable Overhead Extension', muscleGroups: ['triceps'], equipment: 'cable' },
  { id: 'diamond-push-up', name: 'Diamond Push-Up', muscleGroups: ['triceps', 'chest'], equipment: 'bodyweight' },

  // Forearms
  { id: 'wrist-curl', name: 'Wrist Curl', muscleGroups: ['forearms'], equipment: 'dumbbell' },
  { id: 'reverse-wrist-curl', name: 'Reverse Wrist Curl', muscleGroups: ['forearms'], equipment: 'dumbbell' },
  { id: 'farmers-carry', name: "Farmer's Carry", muscleGroups: ['forearms', 'traps'], equipment: 'dumbbell' },

  // Abs / core
  { id: 'crunch', name: 'Crunch', muscleGroups: ['abs'], equipment: 'bodyweight' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', muscleGroups: ['abs', 'hip-flexors'], equipment: 'bodyweight' },
  { id: 'cable-crunch', name: 'Cable Crunch', muscleGroups: ['abs'], equipment: 'cable' },
  { id: 'plank', name: 'Plank', muscleGroups: ['abs', 'obliques'], equipment: 'bodyweight' },
  { id: 'russian-twist', name: 'Russian Twist', muscleGroups: ['obliques', 'abs'], equipment: 'bodyweight' },
  { id: 'ab-wheel-rollout', name: 'Ab Wheel Rollout', muscleGroups: ['abs', 'obliques'], equipment: 'bodyweight' },
  { id: 'side-plank', name: 'Side Plank', muscleGroups: ['obliques'], equipment: 'bodyweight' },
  { id: 'cable-woodchopper', name: 'Cable Woodchopper', muscleGroups: ['obliques', 'abs'], equipment: 'cable' },

  // Legs
  { id: 'back-squat', name: 'Barbell Back Squat', muscleGroups: ['quads', 'glutes', 'hamstrings'], equipment: 'barbell' },
  { id: 'front-squat', name: 'Front Squat', muscleGroups: ['quads', 'glutes'], equipment: 'barbell' },
  { id: 'leg-press', name: 'Leg Press', muscleGroups: ['quads', 'glutes', 'hamstrings'], equipment: 'machine' },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', muscleGroups: ['quads', 'glutes'], equipment: 'dumbbell' },
  { id: 'walking-lunge', name: 'Walking Lunge', muscleGroups: ['quads', 'glutes', 'hamstrings'], equipment: 'dumbbell' },
  { id: 'leg-extension', name: 'Leg Extension', muscleGroups: ['quads'], equipment: 'machine' },
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', muscleGroups: ['hamstrings', 'glutes', 'lower-back'], equipment: 'barbell' },
  { id: 'lying-leg-curl', name: 'Lying Leg Curl', muscleGroups: ['hamstrings'], equipment: 'machine' },
  { id: 'seated-leg-curl', name: 'Seated Leg Curl', muscleGroups: ['hamstrings'], equipment: 'machine' },
  { id: 'hip-thrust', name: 'Hip Thrust', muscleGroups: ['glutes', 'hamstrings'], equipment: 'barbell' },
  { id: 'cable-kickback', name: 'Cable Kickback', muscleGroups: ['glutes'], equipment: 'cable' },
  { id: 'glute-bridge', name: 'Glute Bridge', muscleGroups: ['glutes', 'hamstrings'], equipment: 'bodyweight' },
  { id: 'hip-abduction-machine', name: 'Hip Abduction Machine', muscleGroups: ['glutes'], equipment: 'machine' },
  { id: 'hip-adduction-machine', name: 'Hip Adduction Machine', muscleGroups: ['adductors'], equipment: 'machine' },
  { id: 'standing-calf-raise', name: 'Standing Calf Raise', muscleGroups: ['calves'], equipment: 'machine' },
  { id: 'seated-calf-raise', name: 'Seated Calf Raise', muscleGroups: ['calves'], equipment: 'machine' },
  { id: 'goblet-squat', name: 'Goblet Squat', muscleGroups: ['quads', 'glutes'], equipment: 'dumbbell' },
  { id: 'sumo-deadlift', name: 'Sumo Deadlift', muscleGroups: ['glutes', 'adductors', 'hamstrings'], equipment: 'barbell' },
  { id: 'step-up', name: 'Step-Up', muscleGroups: ['quads', 'glutes'], equipment: 'dumbbell' },
];

export function seedExercises(): Exercise[] {
  return EXERCISE_LIBRARY.map((e) => ({ ...e, isCustom: false }));
}
