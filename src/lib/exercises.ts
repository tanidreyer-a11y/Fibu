import type { Exercise } from './db';
import type { MuscleGroup } from './muscleGroups';

export type Equipment = 'barbell' | 'dumbbell' | 'kettlebell' | 'machine' | 'cable' | 'smith' | 'bodyweight' | 'band' | 'ez-bar' | 'other';

/** Movement slots the plan engine fills. Swaps stay inside the same slot. */
export type Pattern =
  | 'h-push'
  | 'v-push'
  | 'h-pull'
  | 'v-pull'
  | 'squat'
  | 'lunge'
  | 'hinge'
  | 'glute'
  | 'chest-iso'
  | 'side-delt'
  | 'rear-delt'
  | 'biceps'
  | 'triceps'
  | 'quad-iso'
  | 'ham-curl'
  | 'calves'
  | 'core'
  | 'traps'
  | 'forearms'
  | 'carry'
  | 'conditioning'
  | 'mobility';

export type Level = 'beginner' | 'intermediate' | 'expert';
export type Injury = 'shoulder' | 'knee' | 'lower-back' | 'wrist' | 'elbow';

export interface CuratedExercise {
  id: string;
  name: string;
  muscleGroups: MuscleGroup[];
  equipment: Equipment;
  pattern: Pattern;
  level: Level;
  mechanic: 'compound' | 'isolation';
  /** free-exercise-db id: borrows its photos + instructions and hides the duplicate entry */
  fedb?: string;
  /** our own steps, for moves the open database doesn't cover */
  how?: string[];
  /** timed holds and cardio are logged in seconds, not reps */
  unit?: 'reps' | 'sec';
  /** skipped by the plan engine when the user reports this injury */
  avoid?: Injury[];
  /** needs a pull-up bar (or rings / a sturdy bar) */
  bar?: boolean;
}

const ISOLATION: Pattern[] = ['chest-iso', 'side-delt', 'rear-delt', 'biceps', 'triceps', 'quad-iso', 'ham-curl', 'calves', 'forearms', 'traps'];

function x(
  id: string,
  name: string,
  muscleGroups: MuscleGroup[],
  equipment: Equipment,
  pattern: Pattern,
  level: Level,
  opts: { fedb?: string; how?: string[]; unit?: 'reps' | 'sec'; avoid?: Injury[]; mechanic?: 'compound' | 'isolation'; bar?: boolean } = {},
): CuratedExercise {
  const { mechanic, ...rest } = opts;
  return { id, name, muscleGroups, equipment, pattern, level, mechanic: mechanic ?? (ISOLATION.includes(pattern) ? 'isolation' : 'compound'), ...rest };
}

// Hand-curated core: the moves the plan engine prescribes. Primary muscle first.
// Ids of the original 82 never change — logged sessions point at them.
export const EXERCISE_LIBRARY: CuratedExercise[] = [
  // ── Chest
  x('barbell-bench-press', 'Barbell Bench Press', ['chest', 'triceps', 'front-delts'], 'barbell', 'h-push', 'beginner', { fedb: 'Barbell_Bench_Press_-_Medium_Grip', avoid: ['shoulder'] }),
  x('incline-barbell-bench-press', 'Incline Barbell Bench Press', ['chest-upper', 'front-delts', 'triceps'], 'barbell', 'h-push', 'intermediate', { fedb: 'Barbell_Incline_Bench_Press_-_Medium_Grip', avoid: ['shoulder'] }),
  x('decline-barbell-bench-press', 'Decline Barbell Bench Press', ['chest-lower', 'triceps'], 'barbell', 'h-push', 'intermediate', { fedb: 'Decline_Barbell_Bench_Press' }),
  x('dumbbell-bench-press', 'Dumbbell Bench Press', ['chest', 'triceps', 'front-delts'], 'dumbbell', 'h-push', 'beginner', { fedb: 'Dumbbell_Bench_Press' }),
  x('incline-dumbbell-press', 'Incline Dumbbell Press', ['chest-upper', 'front-delts', 'triceps'], 'dumbbell', 'h-push', 'beginner', { fedb: 'Incline_Dumbbell_Press' }),
  x('dumbbell-floor-press', 'Dumbbell Floor Press', ['chest', 'triceps'], 'dumbbell', 'h-push', 'beginner', { fedb: 'Dumbbell_Floor_Press' }),
  x('dumbbell-flyes', 'Dumbbell Flyes', ['chest'], 'dumbbell', 'chest-iso', 'beginner', { fedb: 'Dumbbell_Flyes', avoid: ['shoulder'] }),
  x('incline-dumbbell-flyes', 'Incline Dumbbell Flyes', ['chest-upper'], 'dumbbell', 'chest-iso', 'intermediate', { fedb: 'Incline_Dumbbell_Flyes', avoid: ['shoulder'] }),
  x('cable-crossover', 'Cable Crossover', ['chest-lower', 'chest'], 'cable', 'chest-iso', 'beginner', { fedb: 'Cable_Crossover' }),
  x('pec-deck', 'Pec Deck Machine', ['chest'], 'machine', 'chest-iso', 'beginner', { fedb: 'Butterfly' }),
  x('chest-press-machine', 'Chest Press Machine', ['chest', 'triceps'], 'machine', 'h-push', 'beginner', { fedb: 'Leverage_Chest_Press' }),

  // ── Push-up ladder (easiest → hardest; see PUSH_UP_LADDER)
  x('wall-push-up', 'Wall Push-Up', ['chest', 'triceps', 'front-delts'], 'bodyweight', 'h-push', 'beginner', {
    how: [
      'Stand an arm’s length from a wall and place your hands on it at shoulder height, slightly wider than your shoulders.',
      'Keep your body in one straight line from head to heels.',
      'Bend your elbows to bring your chest toward the wall, then press back to straight arms.',
    ],
    avoid: ['wrist'],
  }),
  x('incline-push-up', 'Incline Push-Up', ['chest-lower', 'triceps', 'front-delts'], 'bodyweight', 'h-push', 'beginner', { fedb: 'Incline_Push-Up', avoid: ['wrist'] }),
  x('knee-push-up', 'Knee Push-Up', ['chest', 'triceps', 'front-delts'], 'bodyweight', 'h-push', 'beginner', {
    how: [
      'Start in a push-up position with your knees on the floor and feet lifted.',
      'Keep a straight line from your head to your knees and brace your stomach.',
      'Lower your chest to just above the floor, elbows at about 45°, then push back up.',
    ],
    avoid: ['wrist'],
  }),
  x('push-up', 'Push-Up', ['chest', 'triceps', 'front-delts'], 'bodyweight', 'h-push', 'beginner', { fedb: 'Pushups', avoid: ['wrist'] }),
  x('wide-push-up', 'Wide Push-Up', ['chest', 'front-delts', 'triceps'], 'bodyweight', 'h-push', 'beginner', { fedb: 'Push-Up_Wide', avoid: ['wrist', 'shoulder'] }),
  x('decline-push-up', 'Decline Push-Up', ['chest-upper', 'front-delts', 'triceps'], 'bodyweight', 'h-push', 'intermediate', { fedb: 'Push-Ups_With_Feet_Elevated', avoid: ['wrist'] }),
  x('diamond-push-up', 'Diamond Push-Up', ['triceps', 'chest'], 'bodyweight', 'h-push', 'intermediate', { fedb: 'Push-Ups_-_Close_Triceps_Position', avoid: ['wrist', 'elbow'] }),
  x('spiderman-push-up', 'Spiderman Push-Up', ['chest', 'obliques', 'triceps'], 'bodyweight', 'h-push', 'intermediate', {
    how: [
      'Start in a standard push-up position.',
      'As you lower, bring one knee out to the side toward the same elbow.',
      'Push back up while returning the leg, then repeat on the other side.',
    ],
    avoid: ['wrist'],
  }),
  x('hindu-push-up', 'Hindu Push-Up', ['chest', 'front-delts', 'triceps'], 'bodyweight', 'h-push', 'intermediate', {
    how: [
      'Start in a downward-dog position: hips high, hands and feet on the floor, arms straight.',
      'Bend your elbows and swoop your chest down and forward, close to the floor.',
      'Straighten your arms and lift your chest up, hips low, looking forward. Push your hips back up to return.',
    ],
    avoid: ['wrist', 'lower-back'],
  }),
  x('clap-push-up', 'Clap Push-Up', ['chest', 'triceps', 'front-delts'], 'bodyweight', 'h-push', 'intermediate', { fedb: 'Plyo_Push-up', avoid: ['wrist', 'shoulder'] }),
  x('archer-push-up', 'Archer Push-Up', ['chest', 'triceps', 'front-delts'], 'bodyweight', 'h-push', 'expert', {
    how: [
      'Set your hands about twice shoulder-width apart, fingers turned slightly out.',
      'Lower toward one hand while the other arm stays almost straight out to the side.',
      'Push back to the middle and alternate sides.',
    ],
    avoid: ['wrist', 'shoulder'],
  }),
  x('pseudo-planche-push-up', 'Pseudo Planche Push-Up', ['chest', 'front-delts', 'triceps'], 'bodyweight', 'h-push', 'expert', {
    how: [
      'Start in a push-up position with your hands by your lower ribs, fingers turned out or back.',
      'Lean your shoulders forward past your hands and keep your body rigid.',
      'Lower with your elbows tucked and press back up while keeping the forward lean.',
    ],
    avoid: ['wrist', 'shoulder'],
  }),
  x('single-arm-push-up', 'One-Arm Push-Up', ['chest', 'triceps', 'obliques'], 'bodyweight', 'h-push', 'expert', { fedb: 'Single-Arm_Push-Up', avoid: ['wrist', 'shoulder'] }),

  // ── Back
  x('deadlift', 'Deadlift', ['hamstrings', 'glutes', 'lower-back', 'lats', 'traps'], 'barbell', 'hinge', 'intermediate', { fedb: 'Barbell_Deadlift', avoid: ['lower-back'] }),
  x('barbell-row', 'Barbell Row', ['lats', 'traps', 'biceps'], 'barbell', 'h-pull', 'intermediate', { fedb: 'Bent_Over_Barbell_Row', avoid: ['lower-back'] }),
  x('pendlay-row', 'Pendlay Row', ['lats', 'traps'], 'barbell', 'h-pull', 'expert', { fedb: 'Reverse_Grip_Bent-Over_Rows', avoid: ['lower-back'] }),
  x('dumbbell-row', 'One-Arm Dumbbell Row', ['lats', 'traps', 'biceps'], 'dumbbell', 'h-pull', 'beginner', { fedb: 'One-Arm_Dumbbell_Row' }),
  x('bent-over-dumbbell-row', 'Bent-Over Dumbbell Row', ['lats', 'traps', 'biceps'], 'dumbbell', 'h-pull', 'beginner', { fedb: 'Bent_Over_Two-Dumbbell_Row', avoid: ['lower-back'] }),
  x('t-bar-row', 'T-Bar Row', ['lats', 'traps'], 'machine', 'h-pull', 'intermediate', { fedb: 'T-Bar_Row_with_Handle', avoid: ['lower-back'] }),
  x('seated-cable-row', 'Seated Cable Row', ['lats', 'traps', 'biceps'], 'cable', 'h-pull', 'beginner', { fedb: 'Seated_Cable_Rows' }),
  x('machine-row', 'Machine Row', ['lats', 'traps', 'biceps'], 'machine', 'h-pull', 'beginner', { fedb: 'Leverage_Iso_Row' }),
  x('inverted-row', 'Inverted Row', ['lats', 'traps', 'biceps'], 'bodyweight', 'h-pull', 'beginner', { fedb: 'Inverted_Row', bar: true }),
  x('towel-row', 'Towel Door Row', ['lats', 'traps', 'biceps'], 'bodyweight', 'h-pull', 'beginner', {
    how: [
      'Loop a towel around both handles of a sturdy, closed door (or a solid post) and hold one end in each hand.',
      'Walk your feet close to the door and lean back until your arms are straight.',
      'Pull your chest toward your hands, squeezing your shoulder blades together, then lower slowly.',
    ],
  }),
  x('lat-pulldown', 'Lat Pulldown', ['lats', 'biceps'], 'cable', 'v-pull', 'beginner', { fedb: 'Wide-Grip_Lat_Pulldown' }),
  x('pull-up', 'Pull-Up', ['lats', 'biceps', 'traps'], 'bodyweight', 'v-pull', 'intermediate', { fedb: 'Pullups', avoid: ['shoulder', 'elbow'], bar: true }),
  x('chin-up', 'Chin-Up', ['lats', 'biceps'], 'bodyweight', 'v-pull', 'intermediate', { fedb: 'Chin-Up', avoid: ['elbow'], bar: true }),
  x('band-assisted-pull-up', 'Band-Assisted Pull-Up', ['lats', 'biceps'], 'band', 'v-pull', 'beginner', { fedb: 'Band_Assisted_Pull-Up', bar: true }),
  x('scapular-pull-up', 'Scapular Pull-Up', ['lats', 'traps'], 'bodyweight', 'v-pull', 'beginner', { fedb: 'Scapular_Pull-Up', bar: true }),
  x('dumbbell-pullover', 'Dumbbell Pullover', ['lats', 'chest'], 'dumbbell', 'v-pull', 'beginner', { fedb: 'Straight-Arm_Dumbbell_Pullover', avoid: ['shoulder'], mechanic: 'isolation' }),
  x('straight-arm-pulldown', 'Straight-Arm Pulldown', ['lats'], 'cable', 'v-pull', 'beginner', { fedb: 'Straight-Arm_Pulldown', mechanic: 'isolation' }),
  x('face-pull', 'Face Pull', ['rear-delts', 'traps'], 'cable', 'rear-delt', 'beginner', { fedb: 'Face_Pull' }),
  x('band-pull-apart', 'Band Pull-Apart', ['rear-delts', 'traps'], 'band', 'rear-delt', 'beginner', { fedb: 'Band_Pull_Apart' }),
  x('barbell-shrug', 'Barbell Shrug', ['traps'], 'barbell', 'traps', 'beginner', { fedb: 'Barbell_Shrug' }),
  x('dumbbell-shrug', 'Dumbbell Shrug', ['traps'], 'dumbbell', 'traps', 'beginner', { fedb: 'Dumbbell_Shrug' }),
  x('back-extension', 'Back Extension', ['lower-back', 'glutes', 'hamstrings'], 'other', 'hinge', 'beginner', { fedb: 'Hyperextensions_Back_Extensions' }),
  x('superman', 'Superman', ['lower-back', 'glutes'], 'bodyweight', 'hinge', 'beginner', { fedb: 'Superman' }),
  x('good-morning', 'Good Morning', ['lower-back', 'hamstrings', 'glutes'], 'barbell', 'hinge', 'intermediate', { fedb: 'Good_Morning', avoid: ['lower-back'] }),

  // ── Shoulders
  x('overhead-press', 'Overhead Barbell Press', ['front-delts', 'side-delts', 'triceps'], 'barbell', 'v-push', 'intermediate', { fedb: 'Standing_Military_Press', avoid: ['shoulder', 'lower-back'] }),
  x('seated-db-shoulder-press', 'Seated Dumbbell Shoulder Press', ['front-delts', 'side-delts', 'triceps'], 'dumbbell', 'v-push', 'beginner', { fedb: 'Seated_Dumbbell_Press', avoid: ['shoulder'] }),
  x('arnold-press', 'Arnold Press', ['front-delts', 'side-delts', 'triceps'], 'dumbbell', 'v-push', 'intermediate', { fedb: 'Arnold_Dumbbell_Press', avoid: ['shoulder'] }),
  x('machine-shoulder-press', 'Machine Shoulder Press', ['front-delts', 'side-delts', 'triceps'], 'machine', 'v-push', 'beginner', { fedb: 'Machine_Shoulder_Military_Press', avoid: ['shoulder'] }),
  x('pike-push-up', 'Pike Push-Up', ['front-delts', 'triceps', 'side-delts'], 'bodyweight', 'v-push', 'intermediate', {
    how: [
      'Start in a push-up position, then walk your feet in and lift your hips high so your body makes an upside-down V.',
      'Bend your elbows and lower the top of your head toward the floor between your hands.',
      'Press back up to straight arms, keeping your hips high the whole time.',
    ],
    avoid: ['shoulder', 'wrist'],
  }),
  x('handstand-push-up', 'Handstand Push-Up', ['front-delts', 'triceps', 'traps'], 'bodyweight', 'v-push', 'expert', { fedb: 'Handstand_Push-Ups', avoid: ['shoulder', 'wrist'] }),
  x('lateral-raise', 'Lateral Raise', ['side-delts'], 'dumbbell', 'side-delt', 'beginner', { fedb: 'Side_Lateral_Raise' }),
  x('cable-lateral-raise', 'Cable Lateral Raise', ['side-delts'], 'cable', 'side-delt', 'beginner', { fedb: 'Cable_Seated_Lateral_Raise' }),
  x('band-lateral-raise', 'Band Lateral Raise', ['side-delts'], 'band', 'side-delt', 'beginner', { fedb: 'Lateral_Raise_-_With_Bands' }),
  x('front-raise', 'Front Raise', ['front-delts'], 'dumbbell', 'side-delt', 'beginner', { fedb: 'Front_Dumbbell_Raise' }),
  x('rear-delt-fly', 'Rear Delt Fly', ['rear-delts'], 'dumbbell', 'rear-delt', 'beginner', { fedb: 'Reverse_Flyes' }),
  x('reverse-pec-deck', 'Reverse Pec Deck', ['rear-delts'], 'machine', 'rear-delt', 'beginner', { fedb: 'Reverse_Machine_Flyes' }),
  x('upright-row', 'Upright Row', ['side-delts', 'traps'], 'barbell', 'side-delt', 'intermediate', { fedb: 'Upright_Barbell_Row', avoid: ['shoulder'] }),

  // ── Biceps
  x('barbell-curl', 'Barbell Curl', ['biceps', 'forearms'], 'barbell', 'biceps', 'beginner', { fedb: 'Barbell_Curl', avoid: ['elbow'] }),
  x('ez-bar-curl', 'EZ-Bar Curl', ['biceps', 'forearms'], 'ez-bar', 'biceps', 'beginner', { fedb: 'EZ-Bar_Curl' }),
  x('dumbbell-curl', 'Dumbbell Curl', ['biceps', 'forearms'], 'dumbbell', 'biceps', 'beginner', { fedb: 'Dumbbell_Bicep_Curl' }),
  x('hammer-curl', 'Hammer Curl', ['biceps', 'forearms'], 'dumbbell', 'biceps', 'beginner', { fedb: 'Hammer_Curls' }),
  x('incline-dumbbell-curl', 'Incline Dumbbell Curl', ['biceps'], 'dumbbell', 'biceps', 'intermediate', { fedb: 'Incline_Dumbbell_Curl' }),
  x('preacher-curl', 'Preacher Curl', ['biceps'], 'barbell', 'biceps', 'beginner', { fedb: 'Preacher_Curl', avoid: ['elbow'] }),
  x('cable-curl', 'Cable Curl', ['biceps', 'forearms'], 'cable', 'biceps', 'beginner', { fedb: 'Standing_Biceps_Cable_Curl' }),
  x('concentration-curl', 'Concentration Curl', ['biceps'], 'dumbbell', 'biceps', 'beginner', { fedb: 'Concentration_Curls' }),
  x('band-curl', 'Band Curl', ['biceps', 'forearms'], 'band', 'biceps', 'beginner', {
    how: [
      'Stand on the middle of a resistance band and hold an end in each hand, palms facing forward.',
      'Keep your elbows pinned to your sides and curl your hands up to your shoulders.',
      'Lower slowly under control.',
    ],
  }),

  // ── Triceps
  x('close-grip-bench-press', 'Close-Grip Bench Press', ['triceps', 'chest'], 'barbell', 'triceps', 'intermediate', { fedb: 'Close-Grip_Barbell_Bench_Press', mechanic: 'compound', avoid: ['wrist'] }),
  x('triceps-pushdown', 'Triceps Pushdown', ['triceps'], 'cable', 'triceps', 'beginner', { fedb: 'Triceps_Pushdown' }),
  x('rope-pushdown', 'Rope Pushdown', ['triceps'], 'cable', 'triceps', 'beginner', { fedb: 'Triceps_Pushdown_-_Rope_Attachment' }),
  x('overhead-triceps-extension', 'Overhead Triceps Extension', ['triceps'], 'dumbbell', 'triceps', 'beginner', { fedb: 'Standing_Dumbbell_Triceps_Extension', avoid: ['elbow', 'shoulder'] }),
  x('skull-crushers', 'Skull Crushers', ['triceps'], 'ez-bar', 'triceps', 'intermediate', { fedb: 'EZ-Bar_Skullcrusher', avoid: ['elbow'] }),
  x('dips', 'Dips', ['triceps', 'chest-lower'], 'bodyweight', 'triceps', 'intermediate', { fedb: 'Dips_-_Triceps_Version', mechanic: 'compound', avoid: ['shoulder'] }),
  x('bench-dips', 'Bench Dips', ['triceps', 'chest-lower'], 'bodyweight', 'triceps', 'beginner', { fedb: 'Bench_Dips', avoid: ['shoulder', 'wrist'] }),
  x('cable-overhead-extension', 'Cable Overhead Extension', ['triceps'], 'cable', 'triceps', 'beginner', { fedb: 'Cable_Rope_Overhead_Triceps_Extension', avoid: ['elbow'] }),

  // ── Forearms & carries
  x('wrist-curl', 'Wrist Curl', ['forearms'], 'dumbbell', 'forearms', 'beginner', { fedb: 'Seated_Dumbbell_Palms-Up_Wrist_Curl', avoid: ['wrist'] }),
  x('reverse-wrist-curl', 'Reverse Wrist Curl', ['forearms'], 'dumbbell', 'forearms', 'beginner', { fedb: 'Seated_Dumbbell_Palms-Down_Wrist_Curl', avoid: ['wrist'] }),
  x('farmers-carry', "Farmer's Carry", ['forearms', 'traps'], 'dumbbell', 'carry', 'beginner', { fedb: 'Farmers_Walk', unit: 'sec' }),

  // ── Core
  x('crunch', 'Crunch', ['abs'], 'bodyweight', 'core', 'beginner', { fedb: 'Crunches' }),
  x('bicycle-crunch', 'Bicycle Crunch', ['obliques', 'abs'], 'bodyweight', 'core', 'beginner', { fedb: 'Air_Bike' }),
  x('lying-leg-raise', 'Lying Leg Raise', ['abs', 'hip-flexors'], 'bodyweight', 'core', 'beginner', { fedb: 'Flat_Bench_Lying_Leg_Raise', avoid: ['lower-back'] }),
  x('hanging-leg-raise', 'Hanging Leg Raise', ['abs', 'hip-flexors'], 'bodyweight', 'core', 'intermediate', { fedb: 'Hanging_Leg_Raise', bar: true }),
  x('cable-crunch', 'Cable Crunch', ['abs'], 'cable', 'core', 'beginner', { fedb: 'Cable_Crunch' }),
  x('plank', 'Plank', ['abs', 'obliques'], 'bodyweight', 'core', 'beginner', { fedb: 'Plank', unit: 'sec' }),
  x('side-plank', 'Side Plank', ['obliques'], 'bodyweight', 'core', 'beginner', { fedb: 'Side_Bridge', unit: 'sec' }),
  x('dead-bug', 'Dead Bug', ['abs'], 'bodyweight', 'core', 'beginner', { fedb: 'Dead_Bug' }),
  x('hollow-hold', 'Hollow Body Hold', ['abs'], 'bodyweight', 'core', 'intermediate', {
    unit: 'sec',
    how: [
      'Lie on your back, press your lower back into the floor and reach your arms overhead.',
      'Lift your shoulders and straight legs a few centimetres off the floor so your body forms a shallow banana shape.',
      'Hold while breathing steadily. Bend your knees to make it easier.',
    ],
  }),
  x('russian-twist', 'Russian Twist', ['obliques', 'abs'], 'bodyweight', 'core', 'beginner', { fedb: 'Russian_Twist', avoid: ['lower-back'] }),
  x('ab-wheel-rollout', 'Ab Wheel Rollout', ['abs', 'obliques'], 'other', 'core', 'intermediate', { fedb: 'Ab_Roller', avoid: ['lower-back'] }),
  x('cable-woodchopper', 'Cable Woodchopper', ['obliques', 'abs'], 'cable', 'core', 'beginner', { fedb: 'Standing_Cable_Wood_Chop' }),

  // ── Legs
  x('back-squat', 'Barbell Back Squat', ['quads', 'glutes', 'hamstrings'], 'barbell', 'squat', 'intermediate', { fedb: 'Barbell_Squat', avoid: ['knee', 'lower-back'] }),
  x('front-squat', 'Front Squat', ['quads', 'glutes'], 'barbell', 'squat', 'expert', { fedb: 'Front_Barbell_Squat', avoid: ['knee', 'wrist'] }),
  x('hack-squat', 'Hack Squat', ['quads', 'glutes'], 'machine', 'squat', 'beginner', { fedb: 'Hack_Squat', avoid: ['knee'] }),
  x('leg-press', 'Leg Press', ['quads', 'glutes', 'hamstrings'], 'machine', 'squat', 'beginner', { fedb: 'Leg_Press' }),
  x('goblet-squat', 'Goblet Squat', ['quads', 'glutes'], 'dumbbell', 'squat', 'beginner', { fedb: 'Goblet_Squat', avoid: ['knee'] }),
  x('dumbbell-squat', 'Dumbbell Squat', ['quads', 'glutes'], 'dumbbell', 'squat', 'beginner', { fedb: 'Dumbbell_Squat', avoid: ['knee'] }),
  x('bodyweight-squat', 'Bodyweight Squat', ['quads', 'glutes'], 'bodyweight', 'squat', 'beginner', { fedb: 'Bodyweight_Squat' }),
  x('sumo-squat', 'Sumo Squat', ['quads', 'glutes', 'adductors'], 'bodyweight', 'squat', 'beginner', {
    how: [
      'Stand with your feet wide, toes turned out about 45°.',
      'Push your hips back and bend your knees, tracking them over your toes, until your thighs are about parallel to the floor.',
      'Drive through your whole foot to stand, squeezing your glutes at the top.',
    ],
  }),
  x('pause-squat', 'Pause Squat', ['quads', 'glutes'], 'bodyweight', 'squat', 'intermediate', {
    how: [
      'Stand with feet shoulder-width apart and squat down as deep as you can with a flat back.',
      'Hold the bottom position for a full 3 seconds without bouncing.',
      'Drive back up to standing. The pause takes away the bounce, so every rep is harder.',
    ],
  }),
  x('cossack-squat', 'Cossack Squat', ['quads', 'adductors', 'glutes'], 'bodyweight', 'squat', 'intermediate', {
    how: [
      'Stand with your feet very wide, toes slightly out.',
      'Shift your weight to one side and sit down into that leg while the other leg stays straight, toes pointing up.',
      'Push back to the middle and switch sides.',
    ],
    avoid: ['knee'],
  }),
  x('pistol-squat', 'Pistol Squat', ['quads', 'glutes'], 'bodyweight', 'squat', 'expert', {
    fedb: 'Kettlebell_Pistol_Squat',
    how: [
      'Stand on one leg with the other leg held straight out in front of you.',
      'Squat down on the standing leg as low as you can, arms forward for balance.',
      'Drive back up without letting the free foot touch the floor. Hold a doorframe for help at first.',
    ],
    avoid: ['knee'],
  }),
  x('jump-squat', 'Jump Squat', ['quads', 'glutes', 'calves'], 'bodyweight', 'conditioning', 'intermediate', { fedb: 'Freehand_Jump_Squat', avoid: ['knee'] }),
  x('bulgarian-split-squat', 'Bulgarian Split Squat', ['quads', 'glutes'], 'dumbbell', 'lunge', 'intermediate', { fedb: 'Split_Squat_with_Dumbbells', avoid: ['knee'] }),
  x('split-squat', 'Split Squat', ['quads', 'glutes'], 'bodyweight', 'lunge', 'beginner', { fedb: 'Split_Squats', avoid: ['knee'] }),
  x('walking-lunge', 'Walking Lunge', ['quads', 'glutes', 'hamstrings'], 'dumbbell', 'lunge', 'beginner', { fedb: 'Dumbbell_Lunges', avoid: ['knee'] }),
  x('bodyweight-lunge', 'Bodyweight Walking Lunge', ['quads', 'glutes', 'hamstrings'], 'bodyweight', 'lunge', 'beginner', { fedb: 'Bodyweight_Walking_Lunge', avoid: ['knee'] }),
  x('reverse-lunge', 'Dumbbell Reverse Lunge', ['quads', 'glutes'], 'dumbbell', 'lunge', 'beginner', { fedb: 'Dumbbell_Rear_Lunge' }),
  x('step-up', 'Step-Up', ['quads', 'glutes'], 'dumbbell', 'lunge', 'beginner', { fedb: 'Dumbbell_Step_Ups' }),
  x('leg-extension', 'Leg Extension', ['quads'], 'machine', 'quad-iso', 'beginner', { fedb: 'Leg_Extensions', avoid: ['knee'] }),
  x('wall-sit', 'Wall Sit', ['quads', 'glutes'], 'bodyweight', 'quad-iso', 'beginner', {
    unit: 'sec',
    how: [
      'Lean your back flat against a wall and walk your feet out about two feet.',
      'Slide down until your knees are bent to about 90°, knees over ankles.',
      'Hold with your weight in your heels and your back on the wall.',
    ],
  }),
  x('romanian-deadlift', 'Romanian Deadlift', ['hamstrings', 'glutes', 'lower-back'], 'barbell', 'hinge', 'intermediate', { fedb: 'Romanian_Deadlift', avoid: ['lower-back'] }),
  x('dumbbell-rdl', 'Dumbbell Romanian Deadlift', ['hamstrings', 'glutes', 'lower-back'], 'dumbbell', 'hinge', 'beginner', { fedb: 'Stiff-Legged_Dumbbell_Deadlift', avoid: ['lower-back'] }),
  x('single-leg-rdl', 'Single-Leg Romanian Deadlift', ['hamstrings', 'glutes'], 'bodyweight', 'hinge', 'intermediate', {
    how: [
      'Stand on one leg with a soft knee (hold a dumbbell in the opposite hand to make it harder).',
      'Hinge at the hips, reaching the weight toward the floor as your free leg extends straight behind you.',
      'Keep your hips square and back flat, then drive through your standing heel to return.',
    ],
  }),
  x('kettlebell-swing', 'Kettlebell Swing', ['glutes', 'hamstrings', 'lower-back'], 'kettlebell', 'hinge', 'intermediate', {
    fedb: 'One-Arm_Kettlebell_Swings',
    how: [
      'Stand with feet a little wider than your hips, kettlebell on the floor in front of you.',
      'Hinge, grip the bell with both hands and hike it back between your legs.',
      'Snap your hips forward to swing it to chest height with straight arms, then let it fall back into the next hinge.',
    ],
    avoid: ['lower-back'],
  }),
  x('pull-through', 'Cable Pull-Through', ['glutes', 'hamstrings'], 'cable', 'hinge', 'beginner', { fedb: 'Pull_Through' }),
  x('lying-leg-curl', 'Lying Leg Curl', ['hamstrings'], 'machine', 'ham-curl', 'beginner', { fedb: 'Lying_Leg_Curls' }),
  x('seated-leg-curl', 'Seated Leg Curl', ['hamstrings'], 'machine', 'ham-curl', 'beginner', { fedb: 'Seated_Leg_Curl' }),
  x('nordic-curl', 'Nordic Hamstring Curl', ['hamstrings'], 'bodyweight', 'ham-curl', 'expert', { fedb: 'Natural_Glute_Ham_Raise', avoid: ['knee'] }),
  x('hip-thrust', 'Hip Thrust', ['glutes', 'hamstrings'], 'barbell', 'glute', 'beginner', { fedb: 'Barbell_Hip_Thrust' }),
  x('dumbbell-hip-thrust', 'Dumbbell Hip Thrust', ['glutes', 'hamstrings'], 'dumbbell', 'glute', 'beginner', {
    how: [
      'Sit on the floor with your upper back against a bench or sofa edge and a dumbbell resting on your hips.',
      'Plant your feet flat, about hip-width apart.',
      'Drive through your heels to lift your hips until your body is flat from knees to shoulders, squeeze, then lower.',
    ],
  }),
  x('cable-kickback', 'Cable Kickback', ['glutes'], 'cable', 'glute', 'beginner', { fedb: 'One-Legged_Cable_Kickback' }),
  x('glute-bridge', 'Glute Bridge', ['glutes', 'hamstrings'], 'bodyweight', 'glute', 'beginner', { fedb: 'Butt_Lift_Bridge' }),
  x('single-leg-glute-bridge', 'Single-Leg Glute Bridge', ['glutes', 'hamstrings'], 'bodyweight', 'glute', 'beginner', { fedb: 'Single_Leg_Glute_Bridge' }),
  x('glute-kickback', 'Glute Kickback', ['glutes'], 'bodyweight', 'glute', 'beginner', { fedb: 'Glute_Kickback' }),
  x('hip-abduction-machine', 'Hip Abduction Machine', ['glutes'], 'machine', 'glute', 'beginner', { fedb: 'Thigh_Abductor', mechanic: 'isolation' }),
  x('hip-adduction-machine', 'Hip Adduction Machine', ['adductors'], 'machine', 'glute', 'beginner', { fedb: 'Thigh_Adductor', mechanic: 'isolation' }),
  x('standing-calf-raise', 'Standing Calf Raise', ['calves'], 'machine', 'calves', 'beginner', { fedb: 'Standing_Calf_Raises' }),
  x('seated-calf-raise', 'Seated Calf Raise', ['calves'], 'machine', 'calves', 'beginner', { fedb: 'Seated_Calf_Raise' }),
  x('dumbbell-calf-raise', 'Dumbbell Calf Raise', ['calves'], 'dumbbell', 'calves', 'beginner', { fedb: 'Standing_Dumbbell_Calf_Raise' }),
  x('bodyweight-calf-raise', 'Bodyweight Calf Raise', ['calves'], 'bodyweight', 'calves', 'beginner', {
    how: [
      'Stand on the edge of a step with your heels hanging off, holding a wall for balance.',
      'Rise onto your toes as high as you can and pause.',
      'Lower your heels slowly below the step for a full stretch.',
    ],
  }),
  x('sumo-deadlift', 'Sumo Deadlift', ['glutes', 'adductors', 'hamstrings'], 'barbell', 'hinge', 'intermediate', { fedb: 'Sumo_Deadlift', avoid: ['lower-back'] }),

  // ── Conditioning
  x('burpee', 'Burpee', ['quads', 'chest', 'abs'], 'bodyweight', 'conditioning', 'beginner', {
    how: [
      'From standing, squat down and place your hands on the floor.',
      'Jump your feet back to a push-up position (add a push-up if you like).',
      'Jump your feet back in and leap up with your arms overhead.',
    ],
    avoid: ['wrist', 'knee'],
  }),
  x('mountain-climbers', 'Mountain Climbers', ['abs', 'hip-flexors', 'quads'], 'bodyweight', 'conditioning', 'beginner', { fedb: 'Mountain_Climbers', unit: 'sec', avoid: ['wrist'] }),
  x('jumping-jacks', 'Jumping Jacks', ['calves', 'side-delts'], 'bodyweight', 'conditioning', 'beginner', {
    unit: 'sec',
    how: ['Stand tall with your arms at your sides.', 'Jump your feet out wide while swinging your arms overhead.', 'Jump back to the start and keep a steady rhythm.'],
  }),
  x('jump-rope', 'Jump Rope', ['calves', 'quads'], 'other', 'conditioning', 'beginner', { fedb: 'Rope_Jumping', unit: 'sec' }),
  x('rowing-machine', 'Rowing Machine', ['lats', 'quads', 'hamstrings'], 'machine', 'conditioning', 'beginner', { fedb: 'Rowing_Stationary', unit: 'sec' }),
  x('stationary-bike', 'Stationary Bike', ['quads', 'hamstrings', 'calves'], 'machine', 'conditioning', 'beginner', { fedb: 'Bicycling_Stationary', unit: 'sec' }),
  x('treadmill-run', 'Treadmill Run', ['quads', 'hamstrings', 'calves'], 'machine', 'conditioning', 'beginner', { fedb: 'Running_Treadmill', unit: 'sec' }),
];

/** Bodyweight push-up progression, easiest first. Overload suggestions climb this when reps get easy. */
export const PUSH_UP_LADDER = [
  'wall-push-up',
  'incline-push-up',
  'knee-push-up',
  'push-up',
  'decline-push-up',
  'diamond-push-up',
  'archer-push-up',
  'pseudo-planche-push-up',
  'single-arm-push-up',
];

export const PULL_UP_LADDER = ['scapular-pull-up', 'band-assisted-pull-up', 'chin-up', 'pull-up'];
export const SQUAT_LADDER = ['bodyweight-squat', 'pause-squat', 'cossack-squat', 'pistol-squat'];
export const PRESS_LADDER = ['pike-push-up', 'handstand-push-up'];

export const LADDERS = [PUSH_UP_LADDER, PULL_UP_LADDER, SQUAT_LADDER, PRESS_LADDER];

export function nextLadderStep(exerciseId: string): string | null {
  for (const ladder of LADDERS) {
    const i = ladder.indexOf(exerciseId);
    if (i !== -1) return ladder[i + 1] ?? null;
  }
  return null;
}

export const CURATED_BY_ID = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e]));

export const FEDB_IMAGE_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/';

export function exerciseImageUrl(path: string): string {
  return FEDB_IMAGE_BASE + path;
}

/** Curated rows in the shape the database stores (photos/instructions merged in at load time from exercises.json). */
export function seedExercises(): Exercise[] {
  return EXERCISE_LIBRARY.map(({ fedb: _fedb, how, ...e }) => ({ ...e, instructions: how, isCustom: false, source: 'fibu' as const }));
}
